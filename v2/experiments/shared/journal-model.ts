/**
 * منطقُ مسوّدة القيد المزدوج — **مشتركٌ بين المرشّحَين عمداً** (نظيرُ `outbox.ts`).
 *
 * `SPEC_finance_ledger` §٩-٢ يسمّي ما يجعل هذه الشاشةَ أثقلَ شاشةٍ تفاعلاً: **حسابٌ حيٌّ
 * متقاطعُ الحقول** (مجموعُ المدين والدائن لكل عملةٍ على حدة يُعاد حسابُه عند كل ضغطة مفتاح)
 * و**أربعُ طبقات تحقّقٍ فوريّ**. وكلُّ ذلك **حسابٌ نقيٌّ لا علاقةَ له بالإطار** — فلو كُتب
 * لأحد المرشّحَين وحده لقِسنا اجتهادَ الكاتب لا كلفةَ الإطار (ضمانةُ الإنصاف الثالثة في
 * `README.md`). فما يبقى فرقاً بعد هذا الملفّ هو **إدارةُ الحالة وإعادةُ التصيير** وحدها.
 *
 * **مسوّدةٌ لا دفتر**: هذه نسخةُ العميل من قواعد `src/features/ledger/services/journal.ts`
 * (التوازن لكل عملة · العملةُ المسموحة §٤-١ · القفلُ الزمنيّ §٢-٥ · المقيَّدُ شرعاً ق-٥٥ ·
 * الخصمُ العقابيّ ب-٣١). **والحدُّ يبقى على الخادم**: إخفاءُ زرٍّ ليس فرضاً (المادة ٤/٦).
 */

export type Side = "debit" | "credit"
export type DeductionKind = "settlement" | "penal"

export type LineDraft = {
  readonly id: string
  readonly accountId: string
  readonly accountKind: "asset" | "liability" | "netAssets" | "revenue" | "expense"
  readonly unitId: string
  readonly currency: string
  readonly side: Side
  /** نصُّ الحقل كما يكتبه المستخدم — التحقّق يقرأ **النصّ** لا رقماً مُنقّىً سلفاً. */
  readonly amountText: string
  readonly fundId: string | null
  readonly deductionKind: DeductionKind | null
}

export type JournalDraft = {
  readonly atIso: string
  readonly memoAr: string
  readonly sourceType: string
  readonly lines: readonly LineDraft[]
}

/** كلُّ رقمٍ تشغيليٍّ من سجل الإعدادات (قب-٦) — يصل الشاشةَ قيمةً محسوبةً على الخادم. */
export type DraftContext = {
  readonly enabledCurrencies: readonly string[]
  readonly penalDeductionsAllowed: boolean
  readonly backdateLockDays: number
  readonly allowFutureDating: boolean
  readonly restrictedFundIds: readonly string[]
  readonly restrictedFundBalances: Readonly<Record<string, number>>
  readonly todayIso: string
  readonly minLines: number
}

export type CurrencyTotals = {
  readonly debit: number
  readonly credit: number
  readonly difference: number
}

export type IssueKey =
  | "journal.errCurrencyNotEnabled"
  | "journal.errPeriodLocked"
  | "journal.errRestrictedOverspend"
  | "journal.errPenalDeduction"
  | "journal.errTooFewLines"
  | "journal.errZeroLine"

/** الرسالةُ **مقترنةٌ بحقلها** لا تنبيهٌ عام (§٩-٢/٣). */
export type Issue = { readonly lineId: string | null; readonly key: IssueKey }

const DAY_MS = 86_400_000

/** ق-٤٨: المال بالسنتات الصحيحة — الكسرُ يُمنع عند الحدّ، والفارغُ صفرٌ لا خطأ. */
export function parseAmount(text: string): number {
  const trimmed = text.trim()
  if (trimmed.length === 0) return 0
  const n = Number(trimmed)
  if (!Number.isFinite(n) || !Number.isSafeInteger(n)) return Number.NaN
  return n
}

/** §٤-٢: التوازنُ **لكل عملةٍ على حدة** — لا جمعَ بلا سعرٍ معلن (ق-٦٢). */
export function balanceByCurrency(
  lines: readonly LineDraft[],
): ReadonlyMap<string, CurrencyTotals> {
  const totals = new Map<string, { debit: number; credit: number }>()
  for (const line of lines) {
    const amount = parseAmount(line.amountText)
    if (Number.isNaN(amount)) continue
    const bucket = totals.get(line.currency) ?? { debit: 0, credit: 0 }
    if (line.side === "debit") bucket.debit += amount
    else bucket.credit += amount
    totals.set(line.currency, bucket)
  }
  const out = new Map<string, CurrencyTotals>()
  for (const [currency, b] of totals) {
    out.set(currency, { debit: b.debit, credit: b.credit, difference: b.debit - b.credit })
  }
  return out
}

export function isBalanced(totals: ReadonlyMap<string, CurrencyTotals>): boolean {
  for (const t of totals.values()) if (t.difference !== 0) return false
  return totals.size > 0
}

/** الطبقةُ الثانية: القفلُ الرجعيّ ومنعُ التأريخ المستقبليّ (ب-٣٩د · ق-٤٥، §٢-٥). */
function datingIssue(draft: JournalDraft, ctx: DraftContext): Issue | null {
  const at = Date.parse(draft.atIso)
  const today = Date.parse(ctx.todayIso)
  if (Number.isNaN(at) || Number.isNaN(today)) return null
  if (!ctx.allowFutureDating && at > today) return { lineId: null, key: "journal.errPeriodLocked" }
  if (at < today - ctx.backdateLockDays * DAY_MS) {
    return { lineId: null, key: "journal.errPeriodLocked" }
  }
  return null
}

/**
 * الطبقةُ الرابعة: ق-٥٥ — المقيَّدُ لا يُصرف فوق رصيده.
 * **الرصيدُ يُقاس على أسطر الأصول الموسومة** لا على طرفَي القيد؛ وهي القاعدةُ البنيويّةُ
 * التي اصطادها اختبارُ ق-٥٥ قبل أيّ مستخدم (قب-٢٧).
 */
function restrictedIssues(draft: JournalDraft, ctx: DraftContext): readonly Issue[] {
  const deltas = new Map<string, number>()
  for (const line of draft.lines) {
    if (line.fundId === null) continue
    if (!ctx.restrictedFundIds.includes(line.fundId)) continue
    if (line.accountKind !== "asset") continue
    const amount = parseAmount(line.amountText)
    if (Number.isNaN(amount)) continue
    const key = `${line.fundId}|${line.currency}`
    deltas.set(key, (deltas.get(key) ?? 0) + (line.side === "debit" ? amount : -amount))
  }
  const out: Issue[] = []
  for (const [key, delta] of deltas) {
    if ((ctx.restrictedFundBalances[key] ?? 0) + delta < 0) {
      const offender = draft.lines.find((l) => `${l.fundId}|${l.currency}` === key)
      out.push({ lineId: offender?.id ?? null, key: "journal.errRestrictedOverspend" })
    }
  }
  return out
}

/** أربعُ طبقاتٍ فوريّة، كلُّ رسالةٍ بحقلها — تُستدعى عند كل ضغطة مفتاح. */
export function validateDraft(draft: JournalDraft, ctx: DraftContext): readonly Issue[] {
  const issues: Issue[] = []

  if (draft.lines.length < ctx.minLines) {
    issues.push({ lineId: null, key: "journal.errTooFewLines" })
  }
  const dating = datingIssue(draft, ctx)
  if (dating !== null) issues.push(dating)

  for (const line of draft.lines) {
    // الطبقةُ الأولى: عملةٌ مسموحةٌ على النطاق (§٤-١).
    if (!ctx.enabledCurrencies.includes(line.currency)) {
      issues.push({ lineId: line.id, key: "journal.errCurrencyNotEnabled" })
    }
    // الطبقةُ الثالثة: الخصمُ العقابيّ ممنوعٌ افتراضاً، والتسويةُ مسموحةٌ دائماً (ب-٣١).
    if (line.deductionKind === "penal" && !ctx.penalDeductionsAllowed) {
      issues.push({ lineId: line.id, key: "journal.errPenalDeduction" })
    }
    const amount = parseAmount(line.amountText)
    if (Number.isNaN(amount) || amount === 0) {
      issues.push({ lineId: line.id, key: "journal.errZeroLine" })
    }
  }

  issues.push(...restrictedIssues(draft, ctx))
  return issues
}

/** §٤-٢: لا إرسالَ حتى يبلغ التوازنُ صفراً وتخلو الطبقاتُ الأربع. */
export function isSubmittable(draft: JournalDraft, ctx: DraftContext): boolean {
  return validateDraft(draft, ctx).length === 0 && isBalanced(balanceByCurrency(draft.lines))
}

// ── تحويلاتُ المسوّدة — الأفعالُ الثلاثة التي تقودها الشاشة ──────────────────

export function emptyLine(id: string, currency: string, side: Side): LineDraft {
  return Object.freeze({
    id,
    accountId: "",
    accountKind: "asset",
    unitId: "u1",
    currency,
    side,
    amountText: "",
    fundId: null,
    deductionKind: null,
  })
}

export function withField(draft: JournalDraft, name: string, value: string): JournalDraft {
  if (name === "memo") return { ...draft, memoAr: value }
  if (name === "at") return { ...draft, atIso: value }
  if (name === "sourceType") return { ...draft, sourceType: value }
  const [kind, id] = name.split(":")
  if (id === undefined) return draft
  return {
    ...draft,
    lines: draft.lines.map((l) => {
      if (l.id !== id) return l
      if (kind === "amount") return { ...l, amountText: value }
      if (kind === "account") return { ...l, accountId: value }
      if (kind === "fund") return { ...l, fundId: value.length === 0 ? null : value }
      if (kind === "currency") return { ...l, currency: value }
      return l
    }),
  }
}

export function addLine(draft: JournalDraft, id: string): JournalDraft {
  const last = draft.lines[draft.lines.length - 1]
  const side: Side = last?.side === "debit" ? "credit" : "debit"
  return { ...draft, lines: [...draft.lines, emptyLine(id, last?.currency ?? "SYP", side)] }
}

export function removeLine(draft: JournalDraft, id: string): JournalDraft {
  return { ...draft, lines: draft.lines.filter((l) => l.id !== id) }
}

/** حمولةُ الطابور (ت-٨) — تُقاس كما تُخزَّن، لا تقديراً (`SPEC_finance_ledger` §٩-٤). */
export function outboxPayload(draft: JournalDraft): string {
  return JSON.stringify({
    kind: "ledger.journal.entry",
    at: draft.atIso,
    memoAr: draft.memoAr,
    sourceType: draft.sourceType,
    lines: draft.lines.map((l) => ({
      accountId: l.accountId,
      unitId: l.unitId,
      currency: l.currency,
      side: l.side,
      amount: parseAmount(l.amountText),
      fundId: l.fundId,
      deductionKind: l.deductionKind,
    })),
  })
}
