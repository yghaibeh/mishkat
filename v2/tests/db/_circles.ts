/**
 * مِشْجَبُ استمرارِ نموذج الحلقات — **ملفٌّ جديدٌ لا تعديلٌ في `_harness.ts`** (الوصفة فخّ ٣).
 *
 * بدائيّاتُ المِشْجَب المشترك **تُستهلك ولا تُعدَّل** (`freshDb`/الشبكتان/`rowsOf`)،
 * ووحدةُ عملِ الحلقات تُبنى هنا.
 *
 * > **وخلافُ الوصفة الأوّلُ مُعلَنٌ صراحةً**: **لا `AuditJournal` في وحدة العمل**. لم تحمل
 * > `circles` سجلاً محلياً قطّ — تدقيقُها يُعلَن على `defineServerFn.audit` لا في المستودع
 * > ولا في الخدمة (كحال `library`)، فبندُ ناقل الوحدة ٢/٣ **غيرُ ذي موضوع** هنا.
 *
 * **ومصدران لا واحد** (§٤-٠): كتالوجُ الأنواع بالجذر، والسجلُّ التشغيليُّ بالوحدة.
 *
 * **حتميّ** (TESTING_POLICY §٥): المعرّفاتُ من عدّاد المستودع، ولحظةُ العالم مثبَّتة.
 */

import {
  persistentCirclesCatalog,
  persistentCirclesRegistry,
} from "../../src/db/repositories/circlesRepository.js"
import type { SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { UnitOfWork, type Scope } from "../../src/db/unitOfWork.js"
import { CirclesStore } from "../../src/features/circles/data/store.js"
import { buildCanonicalWorld } from "../fixtures/canonical-world.js"

/** الشبكتان و`freshDb` من المِشْجَب المشترك — **تُستهلك ولا تُنسخ** (المادة ١/٢). */
export { MAIN, OTHER, freshDb, rowsOf } from "./_harness.js"
/** بذرةُ الحلقات ولحظتُها وسياقُها ومساراتُها — من عالمها القانونيّ الواحد، بلا نسخةٍ ثانية. */
export {
  BILAL_PATH,
  HOMS_PATH,
  KHALID_PATH,
  MEN_PATH,
  NOW,
  OMAR_PATH,
  ROOT_SCOPE_PATH,
  SEEDED_TYPES,
  SQ2_PATH,
  circlesContext,
} from "../features/circles/_seed.js"

import { SEEDED_TYPES } from "../features/circles/_seed.js"

/**
 * بذرُ الإسقاطِ والكتالوج في مستودعٍ طازج: الوحداتُ (نظيرُ `ledger_units`) وأنواعُ الحلقات
 * (بياناتٌ مرجعيةٌ نطاقُها الشبكة). **بطريق الكتابة نفسِه** فلا يُختبر مسارٌ لا يُشحن.
 */
export function seedCirclesReferences(store: CirclesStore): void {
  const tenantId = store.tenantId
  for (const unit of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId, id: unit.id, path: unit.path })
  }
  for (const type of SEEDED_TYPES) store.saveType({ tenantId, ...type })
}

/**
 * وحدةُ عملٍ تشغيلية — **مصدران** (الوصفة §٤-٠): الكتالوجُ بالجذر والتشغيليُّ بالوحدة.
 * وكلاهما يُقذفان في **دفعةٍ واحدة**، فالذرّيةُ عابرةٌ للمصدرين.
 */
export function circlesUnitOfWork(
  driver: SqliteDriver,
  store: CirclesStore,
  scope: Scope,
): UnitOfWork {
  const uow = new UnitOfWork(driver, scope)
  uow.enlist(persistentCirclesCatalog(store))
  uow.enlist(persistentCirclesRegistry(store))
  return uow
}

/**
 * **وحدةُ عملِ الكتالوج وحدَه** — وهي **الغرضُ المقيسُ من الفصل** (§٤-٠): جلسةٌ نطاقُها
 * الجذرُ تقرأ كتالوجَ الأنواع **ولا تُحمّل صفَّ حلقةٍ ولا التحاقٍ واحداً**.
 */
export function circlesCatalogUnitOfWork(
  driver: SqliteDriver,
  store: CirclesStore,
  scopePath = "/",
): UnitOfWork {
  const uow = new UnitOfWork(driver, { tenantId: store.tenantId, scopePath })
  uow.enlist(persistentCirclesCatalog(store))
  return uow
}

/**
 * **جلسةُ D1 واحدة**: تحميلٌ ⟵ مقطعٌ متزامنٌ يعمل عليه المنطقُ كما هو ⟵ قذفةٌ واحدة.
 * الاختباراتُ **تستهلك** طبقةَ الاستمرار كما تُشحن ولا تحاكيها.
 */
export async function circlesSession<T>(
  driver: SqliteDriver,
  tenantId: string,
  fn: (store: CirclesStore) => T,
  scopePath = "/",
): Promise<T> {
  const store = new CirclesStore(tenantId)
  const uow = circlesUnitOfWork(driver, store, { tenantId, scopePath })
  await uow.hydrate()
  const value = fn(store)
  await uow.flush()
  return value
}

/** بذرُ الإسقاط والكتالوج **بطريق الكتابة نفسِه** — فلا يُختبر مسارٌ لا يُشحن. */
export async function seedCirclesSession(driver: SqliteDriver, tenantId: string): Promise<void> {
  await circlesSession(driver, tenantId, (store) => seedCirclesReferences(store))
}
