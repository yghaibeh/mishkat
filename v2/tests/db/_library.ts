/**
 * مِشْجَبُ استمرارِ المكتبة — **ملفٌّ جديدٌ لا تعديلٌ في `_harness.ts`** (الوصفة فخّ ٣).
 *
 * الموجةُ سبعُ وحداتٍ تتوازى؛ فلو وسّع كلُّ وكيلٍ المِشْجَبَ المشترك لتصادمت التسليمات.
 * فالنمطُ المُقرَّر: **بدائيّاتُ المِشْجَب المشترك تُستهلك ولا تُعدَّل** (`freshDb`/الشبكتان)،
 * ووحدةُ عملِ المكتبة تُبنى هنا.
 *
 * > **وخلافُ الوصفة الأوّلُ مُعلَنٌ هنا صراحةً**: **لا `AuditJournal` في وحدة العمل**. لم
 * > تحمل المكتبةُ سجلاً محلياً قطّ (تدقيقُها على `defineServerFn` لا في المستودع)، فبند
 * > ناقل الوحدة ٢/٣ (السجلُّ الواحد) **غيرُ ذي موضوع**، ووحدةُ عملها **مصدرٌ واحد**.
 *
 * **حتميّ** (TESTING_POLICY §٥): المعرّفاتُ من عدّاد المستودع، ولحظةُ العالم مثبَّتة.
 */

import { persistentLibrary } from "../../src/db/repositories/libraryRepository.js"
import type { SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { UnitOfWork, type Scope } from "../../src/db/unitOfWork.js"
import { LibraryStore } from "../../src/features/library/data/store.js"
import { buildCanonicalWorld } from "../fixtures/canonical-world.js"

/** الشبكتان و`freshDb` من المِشْجَب المشترك — **تُستهلك ولا تُنسخ** (المادة ١/٢). */
export { MAIN, OTHER, freshDb, rowsOf } from "./_harness.js"
/** بذرةُ المكتبة ولحظتُها وسياقُها ومساراتُها — من عالمها القانونيّ الواحد، بلا نسخةٍ ثانية. */
export {
  AUDIENCES,
  CATEGORIES,
  FORMATS,
  NOW,
  KHALID_PATH,
  MEN_PATH,
  ROOT_PATH,
  UPLOAD_LIMIT,
  libraryContext,
  materialInput,
  linkMaterialInput,
} from "../features/library/_seed.js"

import { AUDIENCES, CATEGORIES, FORMATS } from "../features/library/_seed.js"

/**
 * بذرُ الإسقاطِ والمعاجم في مستودعٍ طازج: الوحداتُ (نظيرُ `ledger_units`) والفئاتُ والجماهيرُ
 * والصيغُ (بياناتٌ مرجعيةٌ نطاقُها الشبكة). **بطريق الكتابة نفسِه** فلا يُختبر مسارٌ لا يُشحن.
 */
export function seedLibraryReferences(store: LibraryStore): void {
  const tenantId = store.tenantId
  for (const unit of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId, id: unit.id, ar: unit.ar, path: unit.path })
  }
  for (const c of CATEGORIES) store.saveCategory({ tenantId, ...c })
  for (const a of AUDIENCES) store.saveAudience({ tenantId, ...a })
  for (const f of FORMATS) store.saveFormat({ tenantId, ...f })
}

export function libraryUnitOfWork(
  driver: SqliteDriver,
  store: LibraryStore,
  scope: Scope,
): UnitOfWork {
  const uow = new UnitOfWork(driver, scope)
  uow.enlist(persistentLibrary(store))
  return uow
}

/**
 * **جلسةُ D1 واحدة**: تحميلٌ ⟵ مقطعٌ متزامنٌ يعمل عليه المنطقُ كما هو ⟵ قذفةٌ واحدة.
 * الاختباراتُ **تستهلك** طبقةَ الاستمرار كما تُشحن ولا تحاكيها.
 */
export async function librarySession<T>(
  driver: SqliteDriver,
  tenantId: string,
  fn: (store: LibraryStore) => T,
  scopePath = "/",
): Promise<T> {
  const store = new LibraryStore(tenantId)
  const uow = libraryUnitOfWork(driver, store, { tenantId, scopePath })
  await uow.hydrate()
  const value = fn(store)
  await uow.flush()
  return value
}

/** بذرُ الإسقاط والمعاجم **بطريق الكتابة نفسِه** — فلا يُختبر مسارٌ لا يُشحن. */
export async function seedLibrarySession(driver: SqliteDriver, tenantId: string): Promise<void> {
  await librarySession(driver, tenantId, (store) => seedLibraryReferences(store))
}
