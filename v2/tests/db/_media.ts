/**
 * مِشْجَبُ استمرارِ الإعلام — **ملفٌّ جديدٌ لا تعديلٌ في `_harness.ts`** (وصفة §٥-أ · فخّ ٣).
 *
 * الموجةُ الأولى ستُّ وحداتٍ تتوازى بعد نموذج العُهد؛ ولو وسّع كلُّ وكيلٍ `Stores` في المِشْجَب
 * المشترك لتعارضت الملفّاتُ ستَّ مرّات. فالنمطُ المُقرَّر: **بدائيّاتُ المِشْجَب المشترك
 * تُستهلك ولا تُعدَّل** (`freshDb` · `MAIN`/`OTHER` · `rowsOf`)، ووحدةُ عملِ الإعلام تُبنى هنا.
 *
 * **وخلافاً للعُهد: لا سجلَّ تدقيقٍ يُحقن** — طبقةُ بيانات الإعلام لا تكتب قيدَ تدقيقٍ أصلاً
 * (لا `AuditJournal` في `MediaStore`)، فوحدةُ العمل **مصدرٌ واحد**: `persistentMedia` وحدَه.
 *
 * **حتميّ** (TESTING_POLICY §٥): لحظةُ العالم القانونيّ مثبَّتة، والمعرّفاتُ من عدّاد المستودع.
 */

import { persistentMedia } from "../../src/db/repositories/mediaRepository.js"
import type { SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { UnitOfWork, type Scope } from "../../src/db/unitOfWork.js"
import { MediaStore } from "../../src/features/media/data/store.js"
import { buildCanonicalWorld } from "../fixtures/canonical-world.js"
import { FORMATS, KINDS } from "../features/media/_seed.js"

/** الشبكتان و`freshDb` من المِشْجَب المشترك — **تُستهلك ولا تُنسخ** (المادة ١/٢). */
export { MAIN, OTHER, freshDb, rowsOf } from "./_harness.js"
/** ولحظةُ الإعلام لحظةُ عالمها القانونيّ، وسياقاتُه وفاعلوه — بلا نسخٍ لتعريفها هنا. */
export {
  NOW,
  KHALID_PATH,
  OMAR_PATH,
  MEDIA_OF_MEN,
  canonicalActor,
  coverageInput,
  mediaContext,
} from "../features/media/_seed.js"

/** مستودعٌ طازجٌ — **بلا سجلٍّ**: الإعلامُ لا يملك تدقيقاً (خلافاً للعُهد). */
export function freshMediaStore(tenantId: string): MediaStore {
  return new MediaStore(tenantId)
}

/**
 * بذرُ المراجع: إسقاطُ الوحدات (نظيرُ `ledger_units`) والمعجمان (بياناتٌ مرجعية).
 * **يسلك طريقَ الكتابة نفسَه** فلا يُختبر مسارٌ لا يُشحن.
 */
export function seedMediaData(store: MediaStore): void {
  const { tenantId } = store
  for (const unit of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId, id: unit.id, ar: unit.ar, path: unit.path })
  }
  for (const kind of KINDS) store.saveKind({ tenantId, ...kind })
  for (const format of FORMATS) store.saveFormat({ tenantId, ...format })
}

export function mediaUnitOfWork(driver: SqliteDriver, store: MediaStore, scope: Scope): UnitOfWork {
  const uow = new UnitOfWork(driver, scope)
  uow.enlist(persistentMedia(store))
  return uow
}

/**
 * **جلسةُ D1 واحدة**: تحميلٌ ⟵ مقطعٌ متزامنٌ يعمل عليه المنطقُ كما هو ⟵ قذفةٌ واحدة.
 * الاختباراتُ **تستهلك** طبقةَ الاستمرار كما تُشحن ولا تحاكيها.
 */
export async function mediaSession<T>(
  driver: SqliteDriver,
  tenantId: string,
  fn: (store: MediaStore) => T,
  scopePath = "/",
): Promise<T> {
  const store = freshMediaStore(tenantId)
  const uow = mediaUnitOfWork(driver, store, { tenantId, scopePath })
  await uow.hydrate()
  const value = fn(store)
  await uow.flush()
  return value
}

/** بذرُ المراجع **بطريق الكتابة نفسِه** — فلا يُختبر مسارٌ لا يُشحن. */
export async function seedMediaSession(driver: SqliteDriver, tenantId: string): Promise<void> {
  await mediaSession(driver, tenantId, (store) => seedMediaData(store))
}
