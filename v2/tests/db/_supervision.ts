/**
 * مِشْجَبُ استمرارِ الزيارات الإشرافية — **ملفٌّ جديدٌ لا تعديلٌ في `_harness.ts`**.
 *
 * الموجةُ الأولى ستُّ وحداتٍ تتوازى (`PARALLEL_WORK` §١)، فلو وسّع كلُّ وكيلٍ `Stores`
 * في المِشْجَب المشترك لصار **تعارضُ دمجٍ حتماً**. فالنمطُ المُقرَّر: بدائيّاتُ المِشْجَب
 * المشترك **تُستهلك ولا تُعدَّل** (`freshDb` والهجراتُ المشحونة والشبكتان)، ووحدةُ العمل
 * الخاصةُ بالوحدة تُبنى هنا.
 *
 * **وخلافاً للعُهد: لا سجلَّ تدقيقٍ يُحقن** — الإشرافُ لا يملك سجلاً (G22)، والقيدُ يُعلَن
 * في `defineServerFn` ويكتبه الإطارُ عبر السجلّ الموحَّد. فوحدةُ العمل هنا **مصدرٌ واحد**:
 * مستودعُ الإشراف وحدَه.
 *
 * **حتميّ** (TESTING_POLICY §٥): لحظةُ العالم القانونيّ مثبَّتة، والمعرّفاتُ من عدّاد المستودع.
 */

import { persistentSupervision } from "../../src/db/repositories/supervisionRepository.js"
import type { SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { UnitOfWork, type Scope } from "../../src/db/unitOfWork.js"
import { SupervisionStore } from "../../src/features/supervision/data/store.js"
import { buildCanonicalWorld } from "../fixtures/canonical-world.js"
import { TARGETS } from "../features/supervision/_seed.js"

/** الشبكتان و`freshDb`/`rowsOf` من المِشْجَب المشترك — **تُستهلك ولا تُنسخ** (المادة ١/٢). */
export { MAIN, OTHER, freshDb, rowsOf } from "./_harness.js"
/** ولحظةُ الإشراف لحظةُ عالمه القانونيّ، وأهدافُه ومساراتُه وسياقُه من بذرة الوحدة. */
export {
  NOW,
  MEN_PATH,
  HOMS_PATH,
  SQ2_PATH,
  SQ7_PATH,
  KHALID_PATH,
  BILAL_PATH,
  OMAR_PATH,
  C1,
  C1_PATH,
  C1B,
  C1B_PATH,
  C3,
  C3_PATH,
  C2,
  C2_PATH,
  C_RETIRED,
  C_RETIRED_PATH,
  TARGETS,
  CORE,
  TAHFEEZ_DETAILS,
  BASEERA_DETAILS,
  supervisionContext,
} from "../features/supervision/_seed.js"

/**
 * إسقاطُ الوحدات والأهداف — **قراءةٌ لا مصدرُ حقيقة**: موطنُ الوحدة `org` وكيانُ الهدف
 * الحلقة (ب-٢٨)، وهذه النسخةُ ما يحتاجه الإشرافُ لاشتقاق النطاق والتصنيف.
 */
export function seedSupervisionProjections(store: SupervisionStore): void {
  for (const unit of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId: store.tenantId, id: unit.id, path: unit.path })
  }
  for (const target of TARGETS) store.saveTarget({ tenantId: store.tenantId, ...target })
}

export function supervisionUnitOfWork(
  driver: SqliteDriver,
  store: SupervisionStore,
  scope: Scope,
): UnitOfWork {
  const uow = new UnitOfWork(driver, scope)
  uow.enlist(persistentSupervision(store))
  return uow
}

/**
 * **جلسةُ D1 واحدة**: تحميلٌ ⟵ مقطعٌ متزامنٌ يعمل عليه المنطقُ كما هو ⟵ قذفةٌ واحدة.
 * الاختباراتُ **تستهلك** طبقةَ الاستمرار كما تُشحن ولا تحاكيها.
 */
export async function supervisionSession<T>(
  driver: SqliteDriver,
  tenantId: string,
  fn: (store: SupervisionStore) => T,
  scopePath = "/",
): Promise<T> {
  const store = new SupervisionStore(tenantId)
  const uow = supervisionUnitOfWork(driver, store, { tenantId, scopePath })
  await uow.hydrate()
  const value = fn(store)
  await uow.flush()
  return value
}

/** بذرُ الإسقاطات **بطريق الكتابة نفسِه** — فلا يُختبر مسارٌ لا يُشحن. */
export async function seedSupervisionSession(driver: SqliteDriver, tenantId: string): Promise<void> {
  await supervisionSession(driver, tenantId, seedSupervisionProjections)
}
