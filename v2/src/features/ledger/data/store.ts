/**
 * مستودعُ الدفتر — طبقة بيانات النواة (`SPEC_finance_ledger` §٢.٣، §٣.٢، §٨.١).
 *
 * **لماذا في الذاكرة الآن؟** المخطط والهجرات مؤجَّلان في ADR-001 §٦-١ (نقطة اللاعودة: مفتاح
 * التوجيه وموضع التدقيق قبل أول هجرة). هذا المستودع يجسّد **عقود** النواة ويُثبت سلوكها،
 * ويُبدَّل لاحقاً بتنفيذٍ على D1 دون تغيير سطرٍ في الخدمات (عزلُ ADR-001 §٥).
 *
 * أربعةُ ثوابتٍ تعيش **هنا** لا في الخدمة، فتستحيل مخالفتُها بأي مسارٍ يبلغ البيانات:
 *  ١. **الكاتبُ الوحيد ذرّيّ**: `transaction` تلتقط لقطةً وتُرجعها عند أي رمية — بما فيها
 *     **عدّادُ السندات**، فالفشلُ لا يحرق رقماً (مصدرُ الفجوات الكلاسيكيّ — §٦.٢).
 *  ٢. **التكاملُ المرجعيّ سلطةُ طبقة البيانات**: حسابٌ أو صندوقٌ أو وحدةٌ مجهولة ⇒ رميةٌ عند
 *     السطر نفسه ⇒ ارتدادٌ كامل. الخدمةُ لا تكرّر هذا الفحص (المادة ١/٢: مصدرُ حقيقةٍ واحد).
 *  ٣. **الختمُ لا يمرّ على قيدٍ مختلّ**: `sealEntry` يتحقق من التوازن لكل عملةٍ ومن اكتمال
 *     الأسطر — فلا يوجد في المستودع رأسٌ بلا أسطرَ متوازنة **بحكم البناء**.
 *  ٤. **لا محو**: ليس في هذا السطح دالةُ حذفٍ ولا تعديلٍ لقيدٍ مُرحَّل، والكياناتُ **مجمَّدة**
 *     فمحاولةُ التعديل في المكان ترمي (ق-٤٩، §٢.٤).
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا تاريخَ زمن-تشغيل
 * (الساعة تُحقن). ولا SQL ولا مكتبة قاعدة هنا (G17): بِنى JS خالصة.
 */

import { AuditJournal, type AuditMark } from "../../../audit/journal.js"
import {
  LedgerStorageError,
  type Cents,
  type Fund,
  type FundRollupRow,
  type JournalEntry,
  type JournalLine,
  type LedgerAccount,
  type LedgerUnit,
  type PendingAction,
} from "../types.js"

/**
 * فاصلُ مفتاح الرولّ-أب — محرفٌ **لا يظهر في معرّفٍ ولا في مسارٍ ولا في رمز عملة**، فلا
 * يلتبس `zakat|USD` بصندوقٍ اسمُه `zakat|USD`. يُكتب هروباً لا حرفاً خاماً (نظيرُ
 * `unitOfWork.naturalKey`): المحرفُ غيرُ المرئيّ في المصدر يُنسَخ خطأً ولا يُرى.
 */
const ROLLUP_SEPARATOR = "\u0000"

function rollupKey(fundId: string, currency: string): string {
  return `${fundId}${ROLLUP_SEPARATOR}${currency}`
}

/** رأسُ القيد قبل التسجيل — المعرّفُ والشبكةُ وربطُ العكس من المستودع لا من المدخل. */
export type EntryDraft = Omit<JournalEntry, "tenantId" | "id" | "reversedBy">
export type LineDraft = Omit<JournalLine, "tenantId" | "id" | "entryId">

type Snapshot = {
  readonly entryMap: Map<string, JournalEntry>
  readonly lineList: JournalLine[]
  readonly postingKeyMap: Map<string, string>
  readonly actionMap: Map<string, PendingAction>
  /** علامةٌ لا نسخة: السجلُّ ملحقٌ فقط فالارتدادُ قصٌّ (`AuditJournal.mark`). */
  readonly auditMark: AuditMark
  readonly fundRollup: Map<string, Map<string, number>>
  readonly seq: number
  readonly voucherSeq: number
}

export class LedgerStore {
  private accountMap = new Map<string, LedgerAccount>()
  private fundMap = new Map<string, Fund>()
  private unitMap = new Map<string, LedgerUnit>()
  private entryMap = new Map<string, JournalEntry>()
  private lineList: JournalLine[] = []
  /** مفتاحُ التكرار النشط ⟵ القيد الحامل له (§٣.٢). */
  private postingKeyMap = new Map<string, string>()
  private actionMap = new Map<string, PendingAction>()
  /**
   * **الرولّ-أب** (ع-٦): (صندوق × عملة) ⟵ (مسارُ الوحدة ⟵ رصيدٌ بالسنت).
   * لا يُقرأ بالمفتاح ولا يُكتب إلا في `appendLine` — والقراءةُ العامّة `fundRollupRows()`
   * و`fundBalance()` تمرّان على البنية ولا تبلغانها بمفتاح. **الباب واحدٌ ومقيسٌ بحارس.**
   */
  private fundRollup = new Map<string, Map<string, number>>()
  private seq = 0
  private voucherSeq = 0

  /**
   * المستودعُ **مقسَّمٌ بالشبكة** (§٨.١): يحمل شبكتَه ويختمها على كلِّ كيانٍ يحفظه — فـ`tenantId`
   * يُشتقّ من سياق المستودع لا من مدخل العميل، ولا يُبلَغ كيانُ شبكةٍ من مستودع أخرى.
   */
  constructor(
    readonly tenantId: string,
    /**
     * **سجلُّ التدقيق الواحد** (CR-027) — يُحقن ولا يُملَك: الدفترُ ينادي المِرفقَ العابر
     * ولا يحمل سجلاً خاصاً به. والافتراضُ سجلٌّ مستقلٌّ للاستعمال المنفرد؛ ومَن يجمع
     * مستودعين في وحدة عملٍ واحدة **يمرّر السجلَّ نفسَه** فيسكنان جدولاً واحداً.
     */
    readonly audit: AuditJournal = new AuditJournal(tenantId),
  ) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  // ── المراجع (شجرةُ الحسابات والصناديق وإسقاطُ الوحدات) ──────────────────────
  saveAccount(a: LedgerAccount): void {
    this.accountMap.set(a.id, Object.freeze({ ...a, tenantId: this.tenantId }))
  }
  getAccount(id: string): LedgerAccount | null {
    return this.accountMap.get(id) ?? null
  }
  saveFund(f: Fund): void {
    this.fundMap.set(f.id, Object.freeze({ ...f, tenantId: this.tenantId }))
  }
  getFund(id: string): Fund | null {
    return this.fundMap.get(id) ?? null
  }
  saveUnit(u: LedgerUnit): void {
    this.unitMap.set(u.id, Object.freeze({ ...u, tenantId: this.tenantId }))
  }
  getUnit(id: string): LedgerUnit | null {
    return this.unitMap.get(id) ?? null
  }
  /** الوحدةُ بمسارها — لاشتقاق وحدةِ كيانٍ مخزَّنٍ يحمل مسارَه لا معرّفَها (§٥.٢). */
  unitByPath(path: string): LedgerUnit | null {
    for (const u of this.unitMap.values()) if (u.path === path) return u
    return null
  }
  /**
   * إسقاطُ الوحدات للقراءة — تحتاجه العروضُ الهابطة (صناديقُ ما تحت الوحدة) كي تُظهر
   * الوحدةَ **الصفريّة** ولا تُخفيها (ق-١١٢). قراءةٌ مجمَّدةٌ لا تفتح بابَ تعديل.
   */
  units(): readonly LedgerUnit[] {
    return Object.freeze([...this.unitMap.values()])
  }

  // ── القراءة ────────────────────────────────────────────────────────────────
  /** الدفترُ يُقرأ ولا يُعدَّل: القائمةُ المُعادة **مجمَّدة** فلا يُنتزع منها سطر (§٢.٤). */
  entries(): readonly JournalEntry[] {
    return Object.freeze([...this.entryMap.values()])
  }
  lines(): readonly JournalLine[] {
    return Object.freeze([...this.lineList])
  }
  linesOf(entryId: string): readonly JournalLine[] {
    return Object.freeze(this.lineList.filter((l) => l.entryId === entryId))
  }
  getEntry(id: string): JournalEntry | null {
    return this.entryMap.get(id) ?? null
  }
  /** القيدُ الحاملُ لمفتاحِ تكرارٍ **نشط**، أو `null` (§٣.٢). */
  activePostingEntryId(key: string): string | null {
    return this.postingKeyMap.get(key) ?? null
  }

  /**
   * رصيدُ صندوقٍ شرعيٍّ بعملةٍ — **تجميعٌ مسبق لا مجموعٌ حيّ** (ADR-001 ع-٦، CR-026 أ).
   *
   * يُقرأ من الرولّ-أب المبنيِّ سطراً سطراً، لا بمسحٍ على الأسطر: الأسطرُ تنمو بلا سقف
   * (~٤٣ مليوناً عند ١٠٠×) والرولّ-أب محدودٌ بـ(صناديق × عملات × وحدات محمَّلة).
   * والجمعُ هنا على **الوحدات المحمَّلة لهذا الصندوق** — وهو المدى نفسُه الذي كان يمسحه
   * المجموعُ الحيّ، **فسلوكُ ق-٥٥ لا يتغيّر حرفاً**: النطاقُ المحمَّل هو النطاقُ المحسوب.
   *
   * ويُحسب على **أسطر الأصول** الموسومة بالصندوق: هي حركةُ ماله الفعليّة. ولولا ذلك لألغى
   * وسمُ الطرفين (نقدٌ وإيراد) أثرَ الرصيد فصار صفراً دائماً — والفلترةُ تقع عند **الكتابة**
   * في `appendLine` لا عند القراءة، فلا يبقى مُستدعٍ يتذكّر أيَّ سطرٍ يسم.
   */
  fundBalance(fundId: string, currency: string): Cents {
    const wanted = rollupKey(fundId, currency)
    let net = 0
    for (const [key, byUnit] of this.fundRollup) {
      if (key !== wanted) continue
      for (const balance of byUnit.values()) net += balance
    }
    return net as Cents
  }

  /**
   * صفوفُ الرولّ-أب — **السطحُ المعلن الوحيد** الذي يُبنى منه صفُّ القاعدة، ومدخلُ المطابقة.
   * قراءةٌ مجمَّدة لا تفتح باب تعديل (نظيرُ `entries()`/`lines()`).
   */
  fundRollupRows(): readonly FundRollupRow[] {
    const rows: FundRollupRow[] = []
    for (const [key, byUnit] of this.fundRollup) {
      const [fundId, currency] = key.split(ROLLUP_SEPARATOR)
      for (const [unitPath, balance] of byUnit) {
        rows.push(
          Object.freeze({
            unitPath,
            fundId: fundId!,
            currency: currency!,
            balance: balance as Cents,
          }),
        )
      }
    }
    return Object.freeze(rows)
  }

  // ── الكتابة: مسارٌ واحدٌ فتحاً وإلحاقاً وختماً ──────────────────────────────
  /** يخصّص رقمَ السند **داخل المعاملة** — فيرتدّ مع الفشل ولا تنشأ فجوة (§٦.٢). */
  allocateVoucherSeq(): number {
    this.voucherSeq += 1
    return this.voucherSeq
  }

  openEntry(draft: EntryDraft): string {
    const id = this.nextId("je")
    this.entryMap.set(
      id,
      Object.freeze({ ...draft, id, tenantId: this.tenantId, reversedBy: null }),
    )
    return id
  }

  appendLine(entryId: string, line: LineDraft): void {
    if (!this.entryMap.has(entryId)) {
      throw new LedgerStorageError("ENTRY_NOT_FOUND", entryId)
    }
    if (this.getAccount(line.accountId) === null) {
      throw new LedgerStorageError("UNKNOWN_ACCOUNT", line.accountId)
    }
    if (line.fundId !== null && this.getFund(line.fundId) === null) {
      throw new LedgerStorageError("UNKNOWN_FUND", line.fundId)
    }
    if (line.debit < 0 || line.credit < 0) {
      throw new LedgerStorageError("NEGATIVE_AMOUNT", line.accountId)
    }
    if (line.debit > 0 && line.credit > 0) {
      throw new LedgerStorageError("DOUBLE_SIDED_LINE", line.accountId)
    }
    if (line.debit === 0 && line.credit === 0) {
      throw new LedgerStorageError("ZERO_LINE", line.accountId)
    }
    this.lineList.push(
      Object.freeze({ ...line, tenantId: this.tenantId, id: this.nextId("jl"), entryId }),
    )

    // ── الرولّ-أب: **مسارُ الكتابة الوحيد** (ع-٦، CR-026 أ) ────────────────────
    // لا دالّةَ تُحدّثه على حدة ولا مسارَ يقبل رقماً من مُستدعٍ: الرقمُ **دالّةُ السطر
    // الذي يُكتب الآن** لا غير — فمن لا يستطيع كتابةَ سطرٍ لا يستطيع تحريكَ الرصيد.
    // وحركةُ مال الصندوق هي **أسطرُ الأصول** الموسومة (نظيرُ ق-٦٠ حرفياً).
    if (line.fundId !== null && this.getAccount(line.accountId)?.kind === "asset") {
      const key = rollupKey(line.fundId, line.currency)
      const byUnit = this.fundRollup.get(key) ?? new Map<string, number>()
      byUnit.set(line.unitPath, (byUnit.get(line.unitPath) ?? 0) + line.debit - line.credit)
      this.fundRollup.set(key, byUnit)
    }
  }

  /**
   * الختم: **لا قيدَ يُغلق إلا متوازناً مكتملاً**، ويُثبَّت عنده مفتاحُ التكرار.
   * أيُّ خرقٍ هنا يرمي فيرتدّ كلُّ شيء (§٢.٣) — فلا نصفَ قيدٍ في المستودع أبداً.
   */
  sealEntry(entryId: string): JournalEntry {
    const entry = this.entryMap.get(entryId)
    if (entry === undefined) throw new LedgerStorageError("ENTRY_NOT_FOUND", entryId)
    const lines = this.lineList.filter((l) => l.entryId === entryId)
    if (lines.length < 2) throw new LedgerStorageError("TOO_FEW_LINES", entryId)

    const byCurrency = new Map<string, { debit: number; credit: number }>()
    for (const l of lines) {
      const t = byCurrency.get(l.currency) ?? { debit: 0, credit: 0 }
      byCurrency.set(l.currency, { debit: t.debit + l.debit, credit: t.credit + l.credit })
    }
    for (const [currency, t] of byCurrency) {
      if (t.debit !== t.credit) throw new LedgerStorageError("UNBALANCED", currency)
    }

    if (entry.postingKey !== null) {
      if (this.postingKeyMap.has(entry.postingKey)) {
        throw new LedgerStorageError("DUPLICATE_POSTING_KEY", entry.postingKey)
      }
      this.postingKeyMap.set(entry.postingKey, entryId)
    }
    return entry
  }

  /** ربطُ العكس بأصله — **ويحرّر مفتاحَ التكرار** فيُقبل ترحيلٌ جديدٌ به (§٣.٣). */
  linkReversal(originalId: string, reversalId: string): void {
    const original = this.entryMap.get(originalId)
    if (original === undefined) throw new LedgerStorageError("ENTRY_NOT_FOUND", originalId)
    this.entryMap.set(originalId, Object.freeze({ ...original, reversedBy: reversalId }))
    if (original.postingKey !== null) this.postingKeyMap.delete(original.postingKey)
  }

  // ── أفعالُ الاعتماد الثنائي (§٥) ────────────────────────────────────────────
  saveAction(a: PendingAction): void {
    this.actionMap.set(a.id, Object.freeze({ ...a, tenantId: this.tenantId }))
  }
  getAction(id: string): PendingAction | null {
    return this.actionMap.get(id) ?? null
  }
  actions(): readonly PendingAction[] {
    return Object.freeze([...this.actionMap.values()])
  }

  // ── المعاملة الذرّية ───────────────────────────────────────────────────────
  private snapshot(): Snapshot {
    // نسخٌ سطحيٌّ يكفي لأن كل كيانٍ مخزَّنٍ **مجمَّدٌ ويُستبدل ولا يُعدَّل في مكانه**.
    return {
      entryMap: new Map(this.entryMap),
      lineList: [...this.lineList],
      postingKeyMap: new Map(this.postingKeyMap),
      actionMap: new Map(this.actionMap),
      // **السجلُّ يرتدّ مع المستودع**: قيدُ تدقيقٍ عن أثرٍ ارتدّ هو شهادةُ زورٍ على النظام.
      auditMark: this.audit.mark(),
      // الرولّ-أب يُنسخ **بمستويين**: خريطتُه الداخلية تُعدَّل في مكانها عند كتابة السطر،
      // فنسخٌ سطحيٌّ كان سيُبقي الرصيدَ متحرّكاً بعد الارتداد — **وهذا أخطرُ من فقدِ سطر**.
      fundRollup: new Map([...this.fundRollup].map(([key, byUnit]) => [key, new Map(byUnit)])),
      seq: this.seq,
      voucherSeq: this.voucherSeq,
    }
  }

  private restore(s: Snapshot): void {
    this.entryMap = s.entryMap
    this.lineList = s.lineList
    this.postingKeyMap = s.postingKeyMap
    this.actionMap = s.actionMap
    this.audit.rollbackTo(s.auditMark)
    this.fundRollup = s.fundRollup
    this.seq = s.seq
    this.voucherSeq = s.voucherSeq
  }

  /**
   * **مقطعٌ حرجٌ متزامن**: لا `await` في داخله بحكم التوقيع المتزامن — فلا تتشابك عمليتان
   * على عدّاد السندات، والفشلُ يُرجع كلَّ شيء بما فيه العدّاد (§٢.٣ + §٦.٢).
   */
  transaction<T>(fn: () => T): T {
    const before = this.snapshot()
    try {
      return fn()
    } catch (e) {
      this.restore(before)
      throw e
    }
  }
}
