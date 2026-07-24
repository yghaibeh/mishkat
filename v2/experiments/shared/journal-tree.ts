/**
 * الشاشةُ الحاسمة — `/finance/journal/new` كشجرةِ `UiNode` (قب-٢٦ · `SPEC_finance_ledger` §٩).
 *
 * **نقطةُ الدخول الوحيدة للمرشّحَين**: كلاهما يستدعي `journalScreenTree` بعينها، فما يُقاس
 * فرقُ **الإطار** لا اجتهادُ الكاتب — نظيرُ `tree.ts` في قياس T6.
 *
 * **مبنيّةٌ كاملةً على المكتبة المغلقة** (٢٦ مكوّناً) وبمفاتيح نصٍّ لا حروف: لا وسمَ HTML
 * ولا حرفَ عربيٍّ هنا. و**لا تُسجَّل في معجم الشاشات** ولا تدخل G20: هذا **نموذجُ قياسٍ
 * يُهدم** (محظورُ T27/٣)، والشاشةُ الحقيقية تُبنى على القرار لا قبله.
 *
 * **إقرارُ صدق**: `EntityCard` هنا حاملُ **سطرِ قيدٍ قابلٍ للتحرير** (حقولُه أفعالُه)، وهو
 * أقربُ ما في المكتبة المغلقة إلى «بطاقةٍ مكدّسة» (§٤-١ من نظام التصميم). لو بُنيت الشاشةُ
 * حقاً فقد تحتاج المكتبةُ مكوّنَ «سطرِ نموذجٍ متكرر» — **وذلك قرارُ تصميمٍ لا يُتّخذ في
 * مهمة قياس**، وأثرُه على البايتات معدومٌ لأنه هو نفسُه للمرشّحَين.
 */

import { appShell, navProjection } from "../../src/ui/shell/shell.js"
import { field, form, statCard, entityCard, inlineFeedback } from "../../src/ui/components/molecules.js"
import { button, money } from "../../src/ui/components/atoms.js"
import { emptyState } from "../../src/ui/components/organisms.js"
import type { UiNode } from "../../src/ui/components/kernel.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import { formatNumber } from "../../src/ui/text/format.js"
import {
  balanceByCurrency,
  isBalanced,
  isSubmittable,
  validateDraft,
  type DraftContext,
  type Issue,
  type JournalDraft,
  type LineDraft,
} from "./journal-model.js"

/** إعداداتُ النطاق كما تصل الشاشةَ من الخادم (قب-٦) — قيمٌ لا قراءةٌ من سجلٍّ في المتصفح. */
export const MEASURED_CONTEXT: DraftContext = Object.freeze({
  enabledCurrencies: Object.freeze(["SYP", "USD", "TRY"]),
  penalDeductionsAllowed: false,
  backdateLockDays: 14,
  allowFutureDating: false,
  restrictedFundIds: Object.freeze(["zakat", "waqf"]),
  restrictedFundBalances: Object.freeze({ "zakat|SYP": 4_000_000, "waqf|USD": 1_200 }),
  todayIso: "2026-07-24",
  minLines: 2,
})

/** بذرةٌ حتميّةٌ للأسطر — لا عشوائيةَ ولا تاريخٌ في المقيس (منهجُ ADR-002r §٢-٢). */
const ACCOUNTS = ["1010", "4010", "5020", "2010", "1020"] as const
const KINDS = ["asset", "revenue", "expense", "liability", "asset"] as const
const CURRENCIES = ["SYP", "SYP", "USD", "SYP", "TRY"] as const

export function seededLines(count: number): readonly LineDraft[] {
  const out: LineDraft[] = []
  for (let i = 0; i < count; i += 1) {
    const k = i % ACCOUNTS.length
    out.push(
      Object.freeze({
        id: `l${i + 1}`,
        accountId: ACCOUNTS[k] as string,
        accountKind: KINDS[k] as LineDraft["accountKind"],
        unitId: "u1",
        currency: CURRENCIES[k] as string,
        side: i % 2 === 0 ? "debit" : "credit",
        amountText: String(125_000 + i * 1_000),
        fundId: i % 3 === 0 ? "zakat" : null,
        deductionKind: null,
      }),
    )
  }
  return Object.freeze(out)
}

/**
 * **لقطةٌ مملوءةٌ لا فارغة** (قاعدةُ ADR-002r نفسُها): ثمانيةُ أسطرٍ بثلاث عملات — قيدٌ
 * واقعيٌّ لا حدُّ المواصفة الأدنى، وإلا خُفيت حمولةُ النصّ الحقيقية.
 */
export const MEASURED_DRAFT: JournalDraft = Object.freeze({
  atIso: "2026-07-24",
  memoAr: "توزيعُ زكاةِ الفطر على مساجد المربع الأول وتسويةُ سلفةِ الإمام",
  sourceType: "donation",
  lines: seededLines(8),
})

const ISSUE_ICONS: Readonly<Record<string, string>> = Object.freeze({
  "journal.errCurrencyNotEnabled": "alert",
  "journal.errPeriodLocked": "lock",
  "journal.errRestrictedOverspend": "alert",
  "journal.errPenalDeduction": "alert",
  "journal.errTooFewLines": "info",
  "journal.errZeroLine": "info",
})

function issueNode(issue: Issue): UiNode {
  return inlineFeedback({
    messageKey: issue.key,
    tone: "danger",
    iconName: ISSUE_ICONS[issue.key] ?? "alert",
  })
}

/** سطرُ القيد بطاقةً — أربعةُ مقابضَ وفعلُ حذفٍ مملوك. */
function lineCard(line: LineDraft, index: number, issues: readonly Issue[]): UiNode {
  const mine = issues.filter((i) => i.lineId === line.id)
  return entityCard({
    titleAr: `${formatNumber(index + 1)}`,
    facts: [
      { key: "side", labelKey: "journal.side", valueAr: line.side === "debit" ? "١" : "٢" },
      { key: "unit", labelKey: "journal.unit", valueAr: line.unitId },
    ],
    actions: [
      field({
        name: `account:${line.id}`,
        labelKey: "journal.account",
        kind: "text",
        valueAr: line.accountId,
        required: true,
        state: "filled",
      }),
      field({
        name: `currency:${line.id}`,
        labelKey: "journal.currency",
        kind: "select",
        valueAr: line.currency,
        required: true,
        state: "filled",
      }),
      field({
        name: `amount:${line.id}`,
        labelKey: "journal.amount",
        kind: "money",
        valueAr: line.amountText,
        required: true,
        state: mine.length > 0 ? "error" : "filled",
        ...(mine[0] === undefined ? {} : { messageKey: mine[0].key }),
      }),
      field({
        name: `fund:${line.id}`,
        labelKey: "journal.fund",
        kind: "select",
        valueAr: line.fundId ?? "",
        state: line.fundId === null ? "empty" : "filled",
      }),
      button({
        labelKey: "journal.removeLine",
        variant: "ghost",
        capability: "ledger.journal.entry",
        iconName: "trash",
      }),
    ],
  })
}

/**
 * بطاقةُ توازنٍ **لكل عملةٍ على حدة** (§٤-٢) — هذه هي الكتلةُ التي يُعاد حسابُها وتصييرُها
 * عند كل ضغطة مفتاح، وهي موضعُ القياس الحقيقيّ.
 */
function balanceCards(draft: JournalDraft): readonly UiNode[] {
  const totals = balanceByCurrency(draft.lines)
  const out: UiNode[] = []
  for (const [currency, t] of totals) {
    out.push(
      statCard({
        sentenceKey: t.difference === 0 ? "journal.balanced" : "journal.unbalanced",
        valueAr: money({ amount: t.difference, currencyCode: currency, fractionDigits: 0 }).meta
          .textAr as string,
        scopeNoteKey: "journal.scopeNote",
        action: button({
          labelKey: "journal.addLine",
          variant: "ghost",
          capability: "ledger.journal.entry",
          iconName: "plus",
        }),
      }),
    )
  }
  return out
}

/**
 * الشاشةُ كاملةً. **إسقاطٌ للقدرات**: بلا `ledger.journal.entry` لا نموذجَ أصلاً — فراغٌ
 * مُشخِّصٌ لا شاشةٌ بيضاء (ق-١١٢)، وإخفاءُ النموذج ليس حمايةً (الحدُّ على الخادم).
 */
export function journalScreenTree(
  caps: ReadonlySet<CapId>,
  draft: JournalDraft,
  ctx: DraftContext,
): UiNode {
  if (!caps.has("ledger.journal.entry")) {
    return appShell({
      nav: navProjection({ caps, priority: "centralFinance", currentSurface: "centralFinance" }),
      scopePath: "/men/r1/sq1/m1/",
      scopeLabelAr: "مسجد النور — المربع الأول",
      showSearch: caps.has("network.view"),
      content: [
        emptyState({
          audience: "viewer",
          titleKey: "state.deniedTitle",
          diagnosisKey: "state.deniedHint",
        }),
      ],
    })
  }

  const issues = validateDraft(draft, ctx)
  const general = issues.filter((i) => i.lineId === null)
  const balanced = isBalanced(balanceByCurrency(draft.lines))

  const header: UiNode[] = [
    field({
      name: "at",
      labelKey: "journal.date",
      kind: "date",
      valueAr: draft.atIso,
      required: true,
      state: "filled",
    }),
    field({
      name: "memo",
      labelKey: "journal.memo",
      kind: "textarea",
      valueAr: draft.memoAr,
      required: true,
      state: "filled",
    }),
    field({
      name: "sourceType",
      labelKey: "journal.sourceType",
      kind: "select",
      valueAr: draft.sourceType,
      required: true,
      state: "filled",
    }),
  ]

  const body: UiNode[] = [
    ...header,
    ...balanceCards(draft),
    ...draft.lines.map((line, i) => lineCard(line, i, issues)),
    ...general.map(issueNode),
  ]

  if (!balanced) {
    body.push(
      inlineFeedback({ messageKey: "journal.unbalanced", tone: "warning", iconName: "alert" }),
    )
  }

  const submit = button({
    labelKey: "journal.submit",
    variant: "primary",
    capability: "ledger.journal.entry",
    // §٤-٢: **لا إرسالَ حتى يبلغ التوازنُ صفراً** — الحالةُ بنيةٌ لا لون.
    state: isSubmittable(draft, ctx) ? "idle" : "disabled",
  })

  return appShell({
    nav: navProjection({ caps, priority: "centralFinance", currentSurface: "centralFinance" }),
    scopePath: "/men/r1/sq1/m1/",
    scopeLabelAr: "مسجد النور — المربع الأول",
    showSearch: caps.has("network.view"),
    content: [form({ schema: "ledgerJournalInput", fields: body, submit })],
  })
}

/** بناءُ بطاقةِ سطرٍ واحدةٍ — يحتاجها المرشّح (ب) لإدراج سطرٍ بلا إعادةِ بناءِ الشجرة كلها. */
export function journalLineCard(line: LineDraft, index: number, issues: readonly Issue[]): UiNode {
  return lineCard(line, index, issues)
}

export { balanceCards as journalBalanceCards }
