/**
 * مِشْجَبُ استمرارِ الرواتب — **ملفٌّ جديدٌ لا تعديلٌ في `_harness.ts`** (وصفة §٥-أ · فخّ ٣).
 *
 * ووحدةُ العمل هنا **ثلاثةُ مصادر**: الدفترُ والرواتبُ والسجلّ. و`persistentLedger` **معها
 * لا بجانبها**: الرواتبُ لا تملك مالاً (§٢-١)، وكلُّ واقعةٍ فيها **قيدٌ في الدفتر وسجلٌّ
 * هنا**. فلو قُذف المستودعان في دفعتين لأمكن أن يبقى **قيدُ صرفٍ بلا سجلِّه** — ووحدةُ العمل
 * الواحدة تجعل الفارقين **دفعةً واحدة: كلٌّ أو لا شيء** (README الحسم ١).
 *
 * **والسجلُّ واحدٌ مُحقَن** (CR-027 · شرطُ قب-٤٩): `payrollStoresFor` تحقنه في الدفتر،
 * ووحدةُ العمل تُلحق `persistentAudit(stores.ledger.audit)` **بذلك السجلِّ بعينه**.
 *
 * **حتميّ** (TESTING_POLICY §٥): لحظةُ العالم مثبَّتة، والمعرّفاتُ من عدّاد المستودع.
 */

import { persistentAudit } from "../../src/db/repositories/auditRepository.js"
import {
  persistentLedger,
  type LedgerReferences,
} from "../../src/db/repositories/ledgerRepository.js"
import { persistentPayroll } from "../../src/db/repositories/payrollRepository.js"
import type { SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { UnitOfWork, type Scope } from "../../src/db/unitOfWork.js"
import { payrollStoresFor, type PayrollStores } from "../../src/features/payroll/data/store.js"
import type { Cents } from "../../src/features/ledger/types.js"
import type { EntitlementPlan } from "../../src/features/payroll/types.js"
import type { SealPort } from "../../src/features/payroll/services/ports.js"
import { buildCanonicalWorld } from "../fixtures/canonical-world.js"
import { CHART, FUNDS } from "../features/ledger/_seed.js"
import { ACCOUNTS } from "../features/payroll/_seed.js"

/** الشبكتان و`freshDb` من المِشْجَب المشترك — **تُستهلك ولا تُنسخ** (المادة ١/٢). */
export { MAIN, OTHER, freshDb, rowsOf } from "./_harness.js"
/** ولحظةُ الرواتب لحظةُ عالمها، وحساباتُها وسياقُها — بلا نسخٍ لتعريفها هنا. */
export {
  ACCOUNTS,
  BILAL_PATH,
  KHALID_PATH,
  NOW,
  PERIOD,
  canonicalDirectory,
  payrollContext,
  ratedSettings,
  seedWorld,
} from "../features/payroll/_seed.js"

export const KHALID = "khalid"
export const BILAL = "bilal"
/** **أوسعُ نطاقٍ يقرؤه سطحٌ مُعلَن** — عقدةُ القسم، ومرساةُ سقف G23 (CR-030). */
export const MEN_PATH = "/men/"

/** مراجعُ الدفتر التي **لا تُعدَّد من `LedgerStore`** — تُمرَّر صراحةً عند البذر. */
/**
 * **وشجرةُ الحسابات تُبذَر كاملةً لا مقتطعة**: `ledger_accounts` **ليس ملحقاً فقط**، فإسقاطٌ
 * ينقصه حسابٌ محفوظٌ **يُترجَم `DELETE`** — وبذرةٌ بأربعة حساباتٍ على قاعدةٍ فيها منقولُ v1
 * كانت **تمحو حساباتِه** ثم يسقط تحميلُها بـ`UNKNOWN_ACCOUNT`. فتُضمّ شجرةُ الدفتر القانونية
 * (`CHART`) إلى حسابات الرواتب الثلاثة. *(عطبٌ وقعتُ فيه فعلاً، ويُسجَّل لأنه يتكرّر.)*
 */
export const PAYROLL_REFERENCES: LedgerReferences = {
  accounts: [
    ...CHART.map((a) => ({ tenantId: "", id: a.id, ar: a.ar, kind: a.kind })),
    { tenantId: "", id: ACCOUNTS.salaryExpense, ar: "مصروف الرواتب", kind: "expense" as const },
    { tenantId: "", id: ACCOUNTS.staffReceivable, ar: "ذمم الكادر المدينة", kind: "asset" as const },
  ],
  funds: FUNDS.map((f) => ({ tenantId: "", id: f.id, ar: f.ar, restricted: f.restricted })),
}

/** حزمةٌ طازجةٌ بسجلٍّ **واحدٍ مُحقَن** — من المصنع الواحد لا ببناءٍ يدويّ (شرطُ قب-٤٩). */
export function freshPayrollStores(tenantId: string): PayrollStores {
  return payrollStoresFor(tenantId)
}

/** وحدةُ عملٍ كاملة — **ثلاثةُ مصادر**: الدفترُ والرواتبُ والسجلّ. */
export function payrollUnitOfWork(
  driver: SqliteDriver,
  stores: PayrollStores,
  scope: Scope,
  withReferences = false,
): UnitOfWork {
  const uow = new UnitOfWork(driver, scope)
  uow.enlist(persistentLedger(stores.ledger, withReferences ? PAYROLL_REFERENCES : null))
  uow.enlist(persistentPayroll(stores.payroll))
  uow.enlist(persistentAudit(stores.ledger.audit))
  return uow
}

/** **جلسةُ D1 واحدة**: تحميلٌ ⟵ مقطعٌ متزامنٌ ⟵ قذفةٌ واحدة. */
export async function payrollSession<T>(
  driver: SqliteDriver,
  tenantId: string,
  fn: (stores: PayrollStores) => T,
  scopePath = "/",
): Promise<T> {
  const stores = freshPayrollStores(tenantId)
  const uow = payrollUnitOfWork(driver, stores, { tenantId, scopePath })
  await uow.hydrate()
  const value = fn(stores)
  await uow.flush()
  return value
}

/** بذرُ المراجع ووحدات العالم **بطريق الكتابة نفسِه** — فلا يُختبر مسارٌ لا يُشحن. */
export async function seedPayrollSession(driver: SqliteDriver, tenantId: string): Promise<void> {
  const stores = freshPayrollStores(tenantId)
  const uow = payrollUnitOfWork(driver, stores, { tenantId, scopePath: "/" }, true)
  await uow.hydrate()
  for (const unit of buildCanonicalWorld().units) {
    stores.ledger.saveUnit({ tenantId, id: unit.id, path: unit.path })
  }
  await uow.flush()
}

/**
 * **ختمٌ صريحٌ في الاختبار** — موطنُ الختم الحقيقيّ محرّكُ الاعتماد (منفذُ `seal`)، وهذه
 * الطبقةُ **تستهلكه ولا تملكه** (G22). فما يُقاس هنا **استمرارُ الرواتب** لا آليةُ الختم؛
 * وآليةُ الختم على المصدر الحقيقيّ مقيسةٌ في `tests/features/payroll/*` بلا مساسٍ منّي.
 */
export function sealedPlan(
  unitPath: string,
  periodId: string,
  lines: readonly { personId: string; netCents: number; grossCents?: number }[],
): SealPort {
  const plan: EntitlementPlan = {
    unitPath,
    periodId,
    lines: lines.map((line) => ({
      personId: line.personId,
      unitPath,
      tracks: [],
      silences: [],
      grossCents: (line.grossCents ?? line.netCents) as Cents,
      deductionCents: 0 as Cents,
      netCents: line.netCents as Cents,
    })),
    totalNetCents: lines.reduce((sum, line) => sum + line.netCents, 0) as Cents,
  }
  return (askedUnit, askedPeriod) =>
    askedUnit === unitPath && askedPeriod === periodId
      ? { stage: "sealed", plan }
      : { stage: "derived", plan: null }
}
