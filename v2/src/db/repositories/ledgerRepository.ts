/**
 * مستودعُ الدفتر على D1 — **خلف العقد القائم بلا تغيير توقيعٍ واحد**.
 *
 * وأصعبُ ما فيه **التحميل**: معرّفاتُ الدفتر تأتي من عدّادٍ متتابع (`je-1`، `jl-2`…)، فلو
 * حُشيت الصفوفُ حشواً لاختلفت المعرّفاتُ عن المحفوظة. فالتحميلُ **إعادةُ تشغيلٍ بترتيب
 * التخصيص**: يُستدعى `openEntry`/`appendLine` بالترتيب نفسِه فيولّد العدّادُ المعرّفاتِ
 * نفسَها — ويُتحقّق من ذلك صفّاً صفّاً.
 *
 * ومكسبٌ بنيويّ من هذا الطريق: `sealEntry` يُعاد تنفيذُه على كلِّ قيدٍ يُحمَّل ⟵ **توازنُ
 * الدفتر يُعاد برهانُه عند كل تحميل**، فقيدٌ مختلٌّ في القاعدة **لا يُقرأ صامتاً** بل يُرمى.
 */

import { verifyLoadedRollup } from "../../features/ledger/data/rollup.js"
import { LedgerStore } from "../../features/ledger/data/store.js"
import type {
  AccountKind,
  ActionKind,
  ActionPayload,
  ActionStatus,
  Cents,
  CurrencyCode,
  DeductionKind,
  Fund,
  JournalEntry,
  LedgerAccount,
  LedgerErrorCode,
  LineKind,
  SourceType,
} from "../../features/ledger/types.js"
import {
  encodeDate,
  encodeNullable,
  readDate,
  readDateOrNull,
  readInt,
  readText,
  readTextOrNull,
} from "../encode.js"
import { TENANT_ROOT_PATH, tableSpec } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"
import { naturalKey, primaryKeyOf, type PersistentStore, type RowSet } from "../unitOfWork.js"
import { sequenceRow, suffixOf } from "./shared.js"

const SOURCE = "ledger"
const SEQUENCE = "ledger.seq"
const VOUCHER_SEQUENCE = "ledger.voucher"

/**
 * سقفُ صفوف وحدة العمل (G23 · CR-026 ب) — **مشتقٌّ من أرقامٍ مقيسة لا مُقدَّر**:
 * ADR-001 ملحق أ يقيس ~٤٣٢٬٠٠٠ سطرَ قيدٍ في السنة لشبكةٍ من ٤٠٠ مسجد، أي **~١٬٠٨٠ سطراً
 * للمسجد الواحد في السنة**. ونطاقُ التحميل العمليّ **نطاقُ وحدة** (مسجدٌ أو منطقة)، وأوسعُ
 * منطقةٍ في الشبكة اليوم دون العشرين مسجداً ⟵ ~٢٢٬٠٠٠ سطرٍ في السنة، ومعها رؤوسُها
 * وأرصدتُها وأفعالُها. فالسقفُ **٦٠٬٠٠٠** يترك فائضاً معلوماً ويبقى **دون سقف الذاكرة
 * بمراحل** (١٢٨ م.ب — ADR §١-٤).
 *
 * **وهو سقفٌ يُقاس لا يُتوقَّع**: تجاوزُه لا يعني «تضخّمَ البيانات» بل أن قراءةً جديدةً
 * وسّعت النطاق — وهذا بعينه ما أراد قب-٤٨ أن يُسمعه.
 */
const ROW_BUDGET = 60_000

function table(rows: RowSet, name: string): ReadonlyMap<string, SqlRow> {
  return rows.get(name) ?? new Map<string, SqlRow>()
}

function collect(entries: readonly SqlRow[], name: string): [string, ReadonlyMap<string, SqlRow>] {
  const spec = tableSpec(name)
  return [name, new Map(entries.map((entry) => [primaryKeyOf(spec, entry), entry]))]
}

function encodePayload(payload: ActionPayload): string {
  return JSON.stringify(payload)
}

function decodePayload(text: string): ActionPayload {
  const parsed = JSON.parse(text) as ActionPayload
  if (parsed.kind !== "journal.manual") return parsed
  // التاريخُ يعبر JSON نصّاً — يُعاد بناؤه صراحةً فلا يتسلّل نصٌّ مكانَ تاريخ.
  const at = new Date(parsed.entry.at as unknown as string)
  return { ...parsed, entry: { ...parsed.entry, at } }
}

/**
 * شجرةُ الحسابات والصناديقُ **مراجعُ بياناتٍ تُدار** (ق-٦٤) لا حالةَ عملياتٍ تنمو، ولا
 * سبيلَ لتعدادها من `LedgerStore` (لا سطحَ قراءةٍ لها فيه، وتوسيعُه تعديلٌ في وحدة ميزة
 * ممنوعٌ هنا). فتُمرَّر صراحةً عند البذر والنقل، وتُعاد كما حُمِّلت فيما عدا ذلك.
 */
export type LedgerReferences = {
  readonly accounts: readonly LedgerAccount[]
  readonly funds: readonly Fund[]
}

export function persistentLedger(
  store: LedgerStore,
  references: LedgerReferences | null = null,
): PersistentStore {
  const tenantId = store.tenantId
  let hydratedSeq = 0
  let hydratedVoucher = 0
  let loadedAccounts: readonly SqlRow[] = []
  let loadedFunds: readonly SqlRow[] = []

  const derivedSeq = (): number => {
    let max = hydratedSeq
    for (const entry of store.entries()) max = Math.max(max, suffixOf(entry.id))
    for (const line of store.lines()) max = Math.max(max, suffixOf(line.id))
    for (const action of store.actions()) max = Math.max(max, suffixOf(action.id))
    return max
  }

  const derivedVoucher = (): number => {
    let max = hydratedVoucher
    for (const entry of store.entries()) max = Math.max(max, entry.voucherSeq)
    return max
  }

  /** المفتاحُ **النشط** مشتقٌّ لا مخزَّنٌ مرتين: قيدٌ يحمل مفتاحاً ولم يُعكس (§٣.٢/§٣.٣). */
  const activeKeys = (): readonly JournalEntry[] =>
    store.entries().filter((entry) => entry.postingKey !== null && entry.reversedBy === null)

  return {
    name: SOURCE,
    rowBudget: ROW_BUDGET,
    tables: [
      "ledger_accounts",
      "funds",
      "ledger_units",
      "journal_entries",
      "journal_lines",
      "fund_balances",
      "active_posting_keys",
      "finance_actions",
      { table: "sequences", owns: (r) => String(r["name"] ?? "").startsWith(`${SOURCE}.`) },
    ],

    project: () =>
      new Map([
        collect(
          store.entries().map((entry) => ({
            tenant_id: tenantId,
            unit_path: entry.unitPath,
            id: entry.id,
            voucher_no: entry.voucherNo,
            voucher_seq: entry.voucherSeq,
            at: encodeDate(entry.at),
            memo_ar: entry.memoAr,
            source_type: entry.sourceType,
            source_id: entry.sourceId,
            posting_key: entry.postingKey,
            reversal_of: entry.reversalOf,
            reversed_by: entry.reversedBy,
            reason_ar: entry.reasonAr,
            posted_by: entry.postedBy,
          })),
          "journal_entries",
        ),
        collect(
          store.lines().map((line) => ({
            tenant_id: tenantId,
            unit_path: line.unitPath,
            id: line.id,
            entry_id: line.entryId,
            account_id: line.accountId,
            fund_id: line.fundId,
            currency: line.currency,
            debit: line.debit,
            credit: line.credit,
            kind: line.kind,
            deduction_kind: line.deductionKind,
          })),
          "journal_lines",
        ),
        // **الرولّ-أب** (ع-٦): صفوفُه تُبنى من السطح المعلن `fundRollupRows()` وحدَه —
        // لا حسابَ هنا ولا تجميع. طبقةُ الاستمرار **تنقل الرقم ولا تصنعه**؛ ومَن يصنع
        // الرقم في موضعين يصنع مصدرَي حقيقةٍ لشيءٍ واحد (المادة ١/٢).
        collect(
          store.fundRollupRows().map((row) => ({
            tenant_id: tenantId,
            unit_path: row.unitPath,
            fund_id: row.fundId,
            currency: row.currency,
            balance: row.balance,
          })),
          "fund_balances",
        ),
        collect(
          activeKeys().map((entry) => ({
            tenant_id: tenantId,
            unit_path: entry.unitPath,
            posting_key: entry.postingKey,
            entry_id: entry.id,
          })),
          "active_posting_keys",
        ),
        collect(
          store.units().map((unit) => ({
            tenant_id: tenantId,
            unit_path: unit.path,
            id: unit.id,
          })),
          "ledger_units",
        ),
        collect(
          store.actions().map((action) => ({
            tenant_id: tenantId,
            unit_path: action.unitPath,
            id: action.id,
            kind: action.kind,
            payload: encodePayload(action.payload),
            requested_by: action.requestedBy,
            requested_at: encodeDate(action.requestedAt),
            status: action.status,
            decided_by: action.decidedBy,
            decided_at: encodeNullable(action.decidedAt, encodeDate),
            reason_ar: action.reasonAr,
            result_entry_id: action.resultEntryId,
            failure_code: action.failureCode,
          })),
          "finance_actions",
        ),
        collect(
          [
            sequenceRow(tenantId, SEQUENCE, derivedSeq()),
            sequenceRow(tenantId, VOUCHER_SEQUENCE, derivedVoucher()),
          ],
          "sequences",
        ),
        collect(
          references === null
            ? loadedAccounts
            : references.accounts.map((account) => ({
                tenant_id: tenantId,
                unit_path: TENANT_ROOT_PATH,
                id: account.id,
                ar: account.ar,
                kind: account.kind,
              })),
          "ledger_accounts",
        ),
        collect(
          references === null
            ? loadedFunds
            : references.funds.map((fund) => ({
                tenant_id: tenantId,
                unit_path: TENANT_ROOT_PATH,
                id: fund.id,
                ar: fund.ar,
                restricted: fund.restricted ? 1 : 0,
              })),
          "funds",
        ),
      ]),

    load: (rows) => {
      // **خطُّ أساس الرولّ-أب قبل التحميل** — فيُقاس أثرُ التحميل وحدَه (انظر ٤ أدناه).
      const rollupBefore = store.fundRollupRows()

      // ١) المراجعُ أولاً: التكاملُ المرجعيّ يُفحص عند كل سطرٍ يُلحق.
      loadedAccounts = [...table(rows, "ledger_accounts").values()]
      loadedFunds = [...table(rows, "funds").values()]
      for (const row of table(rows, "ledger_accounts").values()) {
        store.saveAccount({
          tenantId,
          id: readText(row, "id"),
          ar: readText(row, "ar"),
          kind: readText(row, "kind") as AccountKind,
        })
      }
      for (const row of table(rows, "funds").values()) {
        store.saveFund({
          tenantId,
          id: readText(row, "id"),
          ar: readText(row, "ar"),
          restricted: readInt(row, "restricted") !== 0,
        })
      }
      for (const row of table(rows, "ledger_units").values()) {
        store.saveUnit({ tenantId, id: readText(row, "id"), path: readText(row, "unit_path") })
      }

      // ٢) إعادةُ التشغيل بترتيب التخصيص — فتُولَد المعرّفاتُ نفسُها لا مثيلاتُها.
      const bySuffix = new Map<number, { kind: "entry" | "line" | "action"; row: SqlRow }>()
      for (const row of table(rows, "journal_entries").values()) {
        bySuffix.set(suffixOf(readText(row, "id")), { kind: "entry", row })
      }
      for (const row of table(rows, "journal_lines").values()) {
        bySuffix.set(suffixOf(readText(row, "id")), { kind: "line", row })
      }
      for (const row of table(rows, "finance_actions").values()) {
        bySuffix.set(suffixOf(readText(row, "id")), { kind: "action", row })
      }
      const highest = bySuffix.size === 0 ? 0 : Math.max(...bySuffix.keys())

      for (let tick = 1; tick <= highest; tick += 1) {
        const slot = bySuffix.get(tick)
        if (slot === undefined) {
          // فجوةٌ (نطاقٌ جزئيّ): تُستهلك نبضةٌ فارغة كي يبقى العدّادُ محاذياً للمحفوظ.
          store.nextId("_hydrate")
          continue
        }
        if (slot.kind === "entry") {
          const generated = store.openEntry({
            voucherNo: readText(slot.row, "voucher_no"),
            voucherSeq: readInt(slot.row, "voucher_seq"),
            at: readDate(slot.row, "at"),
            unitPath: readText(slot.row, "unit_path"),
            memoAr: readText(slot.row, "memo_ar"),
            sourceType: readText(slot.row, "source_type") as SourceType,
            sourceId: readText(slot.row, "source_id"),
            postingKey: readTextOrNull(slot.row, "posting_key"),
            reversalOf: readTextOrNull(slot.row, "reversal_of"),
            reasonAr: readTextOrNull(slot.row, "reason_ar"),
            postedBy: readText(slot.row, "posted_by"),
          })
          const stored = readText(slot.row, "id")
          if (generated !== stored) {
            throw new Error(`انحرافُ عدّادٍ عند التحميل: وُلِّد ${generated} والمحفوظ ${stored}`)
          }
        } else if (slot.kind === "line") {
          store.appendLine(readText(slot.row, "entry_id"), {
            accountId: readText(slot.row, "account_id"),
            unitPath: readText(slot.row, "unit_path"),
            fundId: readTextOrNull(slot.row, "fund_id"),
            currency: readText(slot.row, "currency") as CurrencyCode,
            debit: readInt(slot.row, "debit") as Cents,
            credit: readInt(slot.row, "credit") as Cents,
            kind: readText(slot.row, "kind") as LineKind,
            deductionKind: readTextOrNull(slot.row, "deduction_kind") as DeductionKind | null,
          })
        } else {
          const generated = store.nextId("act")
          const stored = readText(slot.row, "id")
          if (generated !== stored) {
            throw new Error(`انحرافُ عدّادٍ عند التحميل: وُلِّد ${generated} والمحفوظ ${stored}`)
          }
          store.saveAction({
            tenantId,
            id: stored,
            kind: readText(slot.row, "kind") as ActionKind,
            payload: decodePayload(readText(slot.row, "payload")),
            unitPath: readText(slot.row, "unit_path"),
            requestedBy: readText(slot.row, "requested_by"),
            requestedAt: readDate(slot.row, "requested_at"),
            status: readText(slot.row, "status") as ActionStatus,
            decidedBy: readTextOrNull(slot.row, "decided_by"),
            decidedAt: readDateOrNull(slot.row, "decided_at"),
            reasonAr: readTextOrNull(slot.row, "reason_ar"),
            resultEntryId: readTextOrNull(slot.row, "result_entry_id"),
            failureCode: readTextOrNull(slot.row, "failure_code") as LedgerErrorCode | null,
          })
        }
      }

      // ٣) الختمُ بترتيب المعرّف: **يُعاد برهانُ التوازن على كل قيدٍ يُحمَّل**، ويُبنى
      //    خريطةُ المفاتيح النشطة. وربطُ العكس فورَ ختمه ⟵ يتحرّر مفتاحُه لِما بعده.
      const entryIds = [...table(rows, "journal_entries").values()]
        .map((row) => readText(row, "id"))
        .sort((a, b) => suffixOf(a) - suffixOf(b))
      for (const id of entryIds) {
        store.sealEntry(id)
        const reversalOf = store.getEntry(id)?.reversalOf ?? null
        if (reversalOf !== null) store.linkReversal(reversalOf, id)
      }

      // ٤) **الرولّ-أب يُتحقَّق منه ولا يُحمَّل** (ع-٦، القيدُ الأول): إعادةُ تشغيل الأسطر
      //    أعادت بناءَه للتوّ، فيُقارَن بالمحفوظ. ولو حُمِّل حَملاً لصار للقاعدة **مِقبضٌ
      //    يكتب الرصيدَ في الذاكرة** — ومن يكتب الرقم يزوّره. والاختلافُ **يُرمى**: لا
      //    `UPDATE` صامتٌ يُخفي أن مصدراً ما كان يُفسد الرقم.
      //    وهي مطابقةٌ تجري **على كل جلسة** لا ليلياً فقط — أرخصُ مطابقةٍ وأكثرُها تكراراً.
      verifyLoadedRollup(
        rollupBefore,
        store.fundRollupRows(),
        [...table(rows, "fund_balances").values()].map((row) => ({
          unitPath: readText(row, "unit_path"),
          fundId: readText(row, "fund_id"),
          currency: readText(row, "currency"),
          balance: readInt(row, "balance") as Cents,
        })),
      )

      // ٥) العدّادات: الأعلى بين المشتقّ والمحفوظ — فالنطاقُ الجزئيّ لا يُنقص عدّاداً.
      const sequences = table(rows, "sequences")
      const storedValue = (name: string): number => {
        const row = sequences.get(naturalKey(tenantId, name))
        return row === undefined ? 0 : readInt(row, "value")
      }
      hydratedSeq = Math.max(highest, storedValue(SEQUENCE))
      // العدّادُ بلغ `highest` بإعادة التشغيل؛ يُتمّ إلى المحفوظ إن كان أعلى (نطاقٌ جزئيّ).
      for (let tick = highest; tick < hydratedSeq; tick += 1) store.nextId("_hydrate")
      hydratedVoucher = Math.max(derivedVoucher(), storedValue(VOUCHER_SEQUENCE))
      for (let i = 0; i < hydratedVoucher; i += 1) store.allocateVoucherSeq()

    },
  }
}
