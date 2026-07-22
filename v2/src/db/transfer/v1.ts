/**
 * نقلُ بيانات v1 إلى مخطط v2 (ADR-001 §٧-١، المادة ٧/٢) — **لوحدتَي الريادة فقط**.
 *
 * **يمرّ بنفس البوابة التي يمرّ بها الإنتاج**: يبني العالمَ في مستودعَي v2 بدوالّهما
 * المعلنة ثم يقذفه بـ`flush` واحدة. فيُفرض على المنقول **كلُّ** ما يُفرض على المكتوب اليوم:
 * التكاملُ المرجعيّ، وتوازنُ القيد عند الختم، ومفتاحُ التوجيه، وتتابعُ المعرّفات.
 * ولو كُتب النقلُ بعباراتٍ مباشرة لصار **مسارَ كتابةٍ ثانياً** يعبر منه ما لا يعبر بوابتَه.
 *
 * وما لا يعبر **يُبلَّغ ويُعدّ** ولا يُبتلع: `try/catch` يبتلع فشلاً ويمضي إخفاقٌ صامت،
 * وهو أسوأ من الرمية.
 */

import { LedgerStore } from "../../features/ledger/data/store.js"
import { OrgStore } from "../../features/org/data/store.js"
import type { AccountKind, Cents, CurrencyCode } from "../../features/ledger/types.js"
import type { UnitTypeId } from "../../authorization/generated/roles.generated.js"
import type { Section } from "../../features/org/types.js"
import { readInt, readText, readTextOrNull } from "../encode.js"
import type { SqlDriver, SqlRow } from "../sql/driver.js"
import { UnitOfWork } from "../unitOfWork.js"
import { persistentLedger, type LedgerReferences } from "../repositories/ledgerRepository.js"
import { persistentOrg } from "../repositories/orgRepository.js"

/** اصطلاحُ v1: عملةٌ فارغة = الأساس (سجل ٠٠٦٦) — تُترجم صراحةً ولا تعبر فارغة. */
const V1_BASE_CURRENCY: CurrencyCode = "USD"
/** بادئةُ سندِ المنقول — مُعلنةٌ هنا لأن v1 بلا أرقام سندات (§٦.٢ يوجب رقماً). */
const TRANSFER_VOUCHER_PREFIX = "M1-"

export type TransferRejection = {
  readonly id: string
  readonly reason: "UNRESOLVED_ROUTING_KEY" | "UNBALANCED" | "REJECTED_BY_LEDGER"
  readonly detail: string
}

export type TransferReport = {
  readonly units: number
  readonly entries: number
  readonly lines: number
  readonly rejected: readonly TransferRejection[]
}

type V1Line = {
  readonly id: string
  readonly entryId: string
  readonly accountId: string
  readonly fundId: string
  readonly debit: number
  readonly credit: number
  readonly currency: string | null
  readonly unitId: string | null
}

/** حساباتُ v1 مراجعُ بياناتٍ تُشتقّ من الأسطر المنقولة — لا قائمةٌ تُسرد (CR-011). */
function chartFrom(lines: readonly V1Line[]): LedgerReferences {
  const kindOf = (accountId: string): AccountKind => {
    if (accountId.startsWith("revenue")) return "revenue"
    if (accountId.startsWith("expense")) return "expense"
    if (accountId.startsWith("liability") || accountId.startsWith("clearing")) return "liability"
    if (accountId.startsWith("netAssets")) return "netAssets"
    return "asset"
  }
  const accounts = [...new Set(lines.map((line) => line.accountId))].sort()
  const funds = [...new Set(lines.map((line) => line.fundId))].sort()
  return {
    accounts: accounts.map((id) => ({ tenantId: "", id, ar: id, kind: kindOf(id) })),
    funds: funds.map((id) => ({ tenantId: "", id, ar: id, restricted: id === "zakat" })),
  }
}

export async function transferV1(
  source: SqlDriver,
  target: SqlDriver,
  tenantId: string,
): Promise<TransferReport> {
  const unitRows = await source.all({
    sql: "SELECT id, parent_id, path, type, section, name, status FROM org_units ORDER BY path",
    params: [],
  })
  const entryRows = await source.all({
    sql: "SELECT id, entry_date, memo, source, source_ref, reversal_of, created_by FROM journal_entries ORDER BY entry_date, id",
    params: [],
  })
  const lineRows = await source.all({
    sql: "SELECT id, entry_id, account_id, fund_id, debit_cents, credit_cents, currency, unit_id FROM journal_lines ORDER BY id",
    params: [],
  })

  const org = new OrgStore(tenantId)
  const ledger = new LedgerStore(tenantId)
  const pathOf = new Map<string, string>()

  for (const row of unitRows) {
    const id = readText(row, "id")
    const path = readText(row, "path")
    pathOf.set(id, path)
    org.saveUnit({
      tenantId,
      id,
      type: readText(row, "type") as UnitTypeId,
      labelAr: readText(row, "name"),
      parentId: readTextOrNull(row, "parent_id"),
      path,
      section: readTextOrNull(row, "section") as Section | null,
      // **تعطيلٌ منطقيٌّ لا حذف** (المادة ٧/٤): ما ليس `active` في v1 يُؤرشف.
      archived: readText(row, "status") !== "active",
    })
    ledger.saveUnit({ tenantId, id, path })
  }

  const lines: readonly V1Line[] = lineRows.map((row: SqlRow) => ({
    id: readText(row, "id"),
    entryId: readText(row, "entry_id"),
    accountId: readText(row, "account_id"),
    fundId: readText(row, "fund_id"),
    debit: readInt(row, "debit_cents"),
    credit: readInt(row, "credit_cents"),
    currency: readTextOrNull(row, "currency"),
    unitId: readTextOrNull(row, "unit_id"),
  }))
  const references = chartFrom(lines)
  for (const account of references.accounts) ledger.saveAccount({ ...account, tenantId })
  for (const fund of references.funds) ledger.saveFund({ ...fund, tenantId })

  const rejected: TransferRejection[] = []
  let entries = 0
  let transferredLines = 0

  for (const row of entryRows) {
    const v1Id = readText(row, "id")
    const own = lines.filter((line) => line.entryId === v1Id)
    // مفتاحُ التوجيه **يُشتقّ أو يُردّ** — ولا يُوجَّه إلى الجذر صامتاً.
    const orphan = own.find((line) => line.unitId === null || !pathOf.has(line.unitId))
    if (orphan !== undefined) {
      rejected.push({
        id: v1Id,
        reason: "UNRESOLVED_ROUTING_KEY",
        detail: `السطر ${orphan.id} بلا وحدةٍ تُشتقّ منها مفتاحُ التوجيه`,
      })
      continue
    }
    const headPath = pathOf.get(own[0]!.unitId!)!

    try {
      // كلُّ قيدٍ في معاملته: الفاشلُ يرتدّ وحدَه ولا يُسقط ما قبله.
      ledger.transaction(() => {
        const voucherSeq = ledger.allocateVoucherSeq()
        const sourceType = mapSourceType(readTextOrNull(row, "source"))
        const sourceId = readTextOrNull(row, "source_ref") ?? v1Id
        const entryId = ledger.openEntry({
          voucherNo: `${TRANSFER_VOUCHER_PREFIX}${String(voucherSeq).padStart(4, "0")}`,
          voucherSeq,
          at: new Date(readInt(row, "entry_date")),
          unitPath: headPath,
          memoAr: readTextOrNull(row, "memo") ?? "",
          sourceType,
          sourceId,
          postingKey: `${sourceType}:${sourceId}`,
          reversalOf: null,
          reasonAr: null,
          postedBy: readTextOrNull(row, "created_by") ?? "نقلُ v1",
        })
        for (const line of own) {
          ledger.appendLine(entryId, {
            accountId: line.accountId,
            unitPath: pathOf.get(line.unitId!)!,
            fundId: line.fundId,
            currency: line.currency ?? V1_BASE_CURRENCY,
            debit: line.debit as Cents,
            credit: line.credit as Cents,
            kind: "normal",
            deductionKind: null,
          })
        }
        // الختمُ يفرض التوازنَ لكلِّ عملة — فلا يعبر مختلٌّ فيفسد الدفتر.
        ledger.sealEntry(entryId)
        entries += 1
        transferredLines += own.length
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      rejected.push({
        id: v1Id,
        reason: message.includes("UNBALANCED") ? "UNBALANCED" : "REJECTED_BY_LEDGER",
        detail: message,
      })
    }
  }

  const report = { units: unitRows.length, entries, lines: transferredLines, rejected }

  // **النقلُ idempotent**: قاعدةٌ فيها نقلٌ سابق تُترك كما هي. ولا يكفي «الكتابةُ بالمفتاح
  // الطبيعيّ» هنا لأن معرّفات v2 تُولَّد بالعدّاد، فإعادةُ التوليد على قاعدةٍ مملوءة كانت
  // ستُنتج معرّفاتٍ جديدةً لقيودٍ قديمة — فالفحصُ **قبل** الكتابة لا بعدها.
  const probe = new UnitOfWork(target, { tenantId, scopePath: "/" })
  const probeOrg = new OrgStore(tenantId)
  const probeLedger = new LedgerStore(tenantId)
  probe.enlist(persistentOrg(probeOrg))
  probe.enlist(persistentLedger(probeLedger))
  await probe.hydrate()
  if (probeOrg.units.size > 0 || probeLedger.entries().length > 0) return report

  const uow = new UnitOfWork(target, { tenantId, scopePath: "/" })
  uow.enlist(persistentOrg(org))
  uow.enlist(persistentLedger(ledger, references))
  await uow.hydrate()
  await uow.flush()
  return report
}

/** كتالوجُ مصادر v1 المفتوح ⟵ الكتالوجُ المغلق في v2 (§٣.٢) — وما لا يُعرف قيدٌ يدويّ. */
function mapSourceType(v1Source: string | null): "donation" | "expense" | "payroll" | "manualJournal" {
  switch (v1Source) {
    case "donation":
      return "donation"
    case "expense":
    case "fuel":
      return "expense"
    case "payroll":
    case "payout":
      return "payroll"
    default:
      return "manualJournal"
  }
}
