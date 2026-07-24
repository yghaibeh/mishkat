/**
 * مِشْجَبُ استمرارِ اللجان — **ملفٌّ جديدٌ لا تعديلٌ في `_harness.ts`** (وصفة §٥ · فخّ ٣).
 *
 * الموجةُ الأولى ستُّ وحداتٍ تتوازى؛ ولو وسّع كلُّ وكيلٍ `Stores` في المِشْجَب المشترك لصار
 * تعارضُ دمجٍ حتماً. فالنمطُ المُقرَّر: **بدائيّاتُ المِشْجَب المشترك تُستهلك ولا تُعدَّل**
 * (`freshDb` · `MAIN`/`OTHER` · `rowsOf`)، ووحدةُ العمل الخاصةُ تُبنى هنا.
 *
 * **ووحدةُ عمل اللجان تُدرج هذا المصدرَ وحدَه** — بلا `persistentAudit`: وحدةُ اللجان لا
 * تكتب في سجلّ التدقيق أصلاً (لا `AuditJournal` في `CommitteeStore`)، فلا سجلَّ يُقذف معها.
 * وهي **أولُ وحدةٍ بلا سجلّ** في الموجة، وذلك مُصرَّحٌ به لا مُغفَل.
 *
 * **حتميّ** (TESTING_POLICY §٥): لحظةُ العالم القانونيّ مثبَّتة، والمعرّفاتُ من عدّاد المستودع.
 */

import { persistentCommittee } from "../../src/db/repositories/committeesRepository.js"
import type { SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { UnitOfWork, type Scope } from "../../src/db/unitOfWork.js"
import { CommitteeStore } from "../../src/features/committees/data/store.js"
import { buildCanonicalWorld } from "../fixtures/canonical-world.js"

/** الشبكتان و`freshDb` و`rowsOf` من المِشْجَب المشترك — **تُستهلك ولا تُنسخ** (المادة ١/٢). */
export { MAIN, OTHER, freshDb, rowsOf } from "./_harness.js"
/** ولحظةُ اللجان ومساراتُها من بذرة عالمها القانونيّ — فلا عالمَ ثانٍ يتباعد. */
export {
  NOW,
  KHALID,
  KHALID_PATH,
  BILAL,
  BILAL_PATH,
  SQ2_PATH,
  HOMS_PATH,
  PERIOD,
  RELIEF,
  DAWAH,
  committeeContext,
} from "../features/committees/_seed.js"

export function freshCommitteeStore(tenantId: string): CommitteeStore {
  return new CommitteeStore(tenantId)
}

/**
 * إسقاطُ وحدات العالم القانونيّ — **قراءةٌ لا مصدرُ حقيقة**: موطنُ الوحدة `org`، وهذه النسخةُ
 * ما تحتاجه اللجانُ لاشتقاق النطاق (نظيرُ `ledger_units`/`custody_units` حرفياً).
 */
export function seedCommitteeUnits(store: CommitteeStore): void {
  for (const unit of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId: store.tenantId, id: unit.id, path: unit.path })
  }
}

export function committeeUnitOfWork(
  driver: SqliteDriver,
  store: CommitteeStore,
  scope: Scope,
): UnitOfWork {
  const uow = new UnitOfWork(driver, scope)
  uow.enlist(persistentCommittee(store))
  return uow
}

/**
 * **جلسةُ D1 واحدة**: تحميلٌ ⟵ مقطعٌ متزامنٌ يعمل عليه المنطقُ كما هو ⟵ قذفةٌ واحدة.
 * الاختباراتُ **تستهلك** طبقةَ الاستمرار كما تُشحن ولا تحاكيها.
 */
export async function committeeSession<T>(
  driver: SqliteDriver,
  tenantId: string,
  fn: (store: CommitteeStore) => T,
  scopePath = "/",
): Promise<T> {
  const store = freshCommitteeStore(tenantId)
  const uow = committeeUnitOfWork(driver, store, { tenantId, scopePath })
  await uow.hydrate()
  const value = fn(store)
  await uow.flush()
  return value
}

/** بذرُ إسقاط الوحدات **بطريق الكتابة نفسِه** — فلا يُختبر مسارٌ لا يُشحن. */
export async function seedCommitteeSession(driver: SqliteDriver, tenantId: string): Promise<void> {
  await committeeSession(driver, tenantId, (store) => seedCommitteeUnits(store))
}
