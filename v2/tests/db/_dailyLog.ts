/**
 * مِشْجَبُ استمرارِ سجل اليوم — **ملفٌّ جديدٌ لا تعديلٌ في `_harness.ts`** (وصفة فخّ ٣).
 *
 * الموجةُ الأولى ستُّ وحداتٍ تتوازى، ولو وسّع كلٌّ `Stores` في المِشْجَب المشترك لصار
 * تعارضُ دمجٍ في ستّ تسليمات. فالنمطُ المُقرَّر: **بدائيّاتُ المِشْجَب تُستهلك ولا تُعدَّل**
 * (`freshDb` والهجراتُ المشحونة والشبكتان)، ووحدةُ عملِ الوحدة تُبنى في ملفِّها.
 *
 * **ولا سجلَّ تدقيقٍ يُحقن هنا** — بخلاف العُهد: سجلُّ اليوم لا يملك تدقيقاً محلياً، وتدقيقُ
 * سطوحه يُعلَن في `defineServerFn` (طبقةٌ أخرى) لا في المستودع. فوحدةُ العمل مستودعٌ واحد.
 *
 * **حتميّ** (TESTING_POLICY §٥): لحظةُ العالم مثبَّتة، والمعرّفاتُ من عدّاد المستودع.
 */

import {
  persistentDailyCatalog,
  persistentDailyEntries,
} from "../../src/db/repositories/dailyLogRepository.js"
import type { SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { UnitOfWork, type Scope } from "../../src/db/unitOfWork.js"
import { DailyLogStore } from "../../src/features/dailyLog/data/store.js"
import { seedDailyLogStore } from "../features/dailyLog/_seed.js"

/** الشبكتان و`freshDb` من المِشْجَب المشترك — **تُستهلك ولا تُنسخ** (المادة ١/٢). */
export { MAIN, OTHER, freshDb, rowsOf } from "./_harness.js"
/** ولحظةُ الوحدة ومساراتُها وسياقُها وبذرتُها من عالمها القانونيّ الواحد. */
export {
  NOW,
  KHALID,
  KHALID_PATH,
  BILAL_PATH,
  SQ2_PATH,
  MEN_PATH,
  NOUR,
  NOUR_PATH,
  TODAY,
  WEEK,
  dailyLogContext,
} from "../features/dailyLog/_seed.js"

export type DailyLogStores = {
  readonly dailyLog: DailyLogStore
}

/** مستودعٌ طازجٌ لهذه الشبكة — لا سجلَّ تدقيقٍ محليّ (تدقيقُ السطوح في طبقةٍ أخرى). */
export function freshDailyLogStores(tenantId: string): DailyLogStores {
  return { dailyLog: new DailyLogStore(tenantId) }
}

/**
 * بذرُ العالم القانونيّ في مستودعٍ قائم — الوحداتُ (رجاليّةٌ ونسائية) والكتالوجُ (مخطّطان
 * وأنشطتُهما)، مأخوذةٌ من `_seed` نفسِه فلا عالمَ ثانٍ يتباعد.
 */
export function seedDailyLogInto(store: DailyLogStore): void {
  const tenantId = store.tenantId
  const seeded = seedDailyLogStore(tenantId)
  for (const unit of seeded.units()) store.saveUnit({ tenantId, id: unit.id, path: unit.path })
  for (const scheme of seeded.schemes()) store.saveScheme({ ...scheme, tenantId })
  for (const activity of seeded.activities()) store.saveActivity({ ...activity, tenantId })
}

/**
 * وحدةُ عملٍ تشغيلية — **مصدران** (الوصفة §٤-٠ · CR-029): الكتالوجُ بالجذر والقيودُ بالوحدة.
 * وكلاهما يُقذفان في **دفعةٍ واحدة**، فالذرّيةُ عابرةٌ للمصدرين كما هي في العُهد.
 */
export function dailyLogUnitOfWork(
  driver: SqliteDriver,
  stores: DailyLogStores,
  scope: Scope,
): UnitOfWork {
  const uow = new UnitOfWork(driver, scope)
  uow.enlist(persistentDailyCatalog(stores.dailyLog))
  uow.enlist(persistentDailyEntries(stores.dailyLog))
  return uow
}

/**
 * **وحدةُ عملِ الكتالوج وحدَه** — وهي **الغرضُ المقيسُ من الفصل** (§٤-٠): جلسةُ
 * `activityCatalog.view` نطاقُها الجذرُ، تقرأ المخطّطاتِ والأنشطةَ **ولا تُحمّل قيداً واحداً**.
 */
export function dailyCatalogUnitOfWork(
  driver: SqliteDriver,
  store: DailyLogStore,
  scopePath = "/",
): UnitOfWork {
  const uow = new UnitOfWork(driver, { tenantId: store.tenantId, scopePath })
  uow.enlist(persistentDailyCatalog(store))
  return uow
}

/**
 * **جلسةُ D1 واحدة**: تحميلٌ ⟵ مقطعٌ متزامنٌ يعمل عليه المنطقُ كما هو ⟵ قذفةٌ واحدة.
 * الاختباراتُ **تستهلك** طبقةَ الاستمرار كما تُشحن ولا تحاكيها.
 */
export async function dailyLogSession<T>(
  driver: SqliteDriver,
  tenantId: string,
  fn: (store: DailyLogStore) => T,
  scopePath = "/",
): Promise<T> {
  const stores = freshDailyLogStores(tenantId)
  const uow = dailyLogUnitOfWork(driver, stores, { tenantId, scopePath })
  await uow.hydrate()
  const value = fn(stores.dailyLog)
  await uow.flush()
  return value
}

/** بذرُ العالم **بطريق الكتابة نفسِه** — فلا يُختبر مسارٌ لا يُشحن. */
export async function seedDailyLogSession(driver: SqliteDriver, tenantId: string): Promise<void> {
  await dailyLogSession(driver, tenantId, seedDailyLogInto)
}
