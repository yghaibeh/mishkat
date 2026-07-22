/**
 * مِشْجَبُ استمرارِ العُهد — **ملفٌّ جديدٌ لا تعديلٌ في `_harness.ts`**.
 *
 * ولهذا سببٌ يخصّ T26-ب لا يخصّ العُهد: الموجةُ الأولى **سبعُ وحداتٍ تتوازى** بعد هذا
 * النموذج (`PARALLEL_WORK` §١)، ولو وسّع كلُّ وكيلٍ `Stores` في المِشْجَب المشترك لصار
 * **تعارضُ دمجٍ في سبعة تسليماتٍ حتماً** — وهو ما تحذّر منه الوثيقةُ نصّاً. فالنمطُ
 * المُقرَّر هنا: **بدائيّاتُ المِشْجَب المشترك تُستهلك ولا تُعدَّل** (`freshDb` والهجراتُ
 * المشحونة والشبكتان)، ووحدةُ العمل الخاصةُ بالوحدة تُبنى في ملفِّها.
 *
 * **والسجلُّ واحدٌ يُحقن** (CR-027 · بندُ ناقل الوحدة ٢): مستودعُ العُهد ومستودعُ التدقيق
 * يتقاسمان `AuditJournal` **واحداً** في وحدة العمل نفسِها — وإلا سكن قيدُ الوحدة سجلاً
 * وقيدُ غيرها سجلاً آخر فمحا أحدُهما صفوفَ الآخر بالمفتاح الطبيعيّ نفسِه.
 *
 * **حتميّ** (TESTING_POLICY §٥): لحظةُ العالم القانونيّ مثبَّتة، والمعرّفاتُ من عدّاد المستودع.
 */

import { AuditJournal } from "../../src/audit/journal.js"
import { persistentAudit } from "../../src/db/repositories/auditRepository.js"
import { persistentCustody } from "../../src/db/repositories/custodyRepository.js"
import type { SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { UnitOfWork, type Scope } from "../../src/db/unitOfWork.js"
import { CustodyStore } from "../../src/features/custody/data/store.js"
import { buildCanonicalWorld } from "../fixtures/canonical-world.js"

/** الشبكتان و`freshDb` من المِشْجَب المشترك — **تُستهلك ولا تُنسخ** (المادة ١/٢). */
export { MAIN, OTHER, freshDb, rowsOf } from "./_harness.js"
/** ولحظةُ العُهد لحظةُ عالمها القانونيّ — فبها وحدَها تصدق «التكاليفُ الفعّالة». */
export { NOW, KHALID_PATH, BILAL_PATH, SQ2_PATH, custodyContext } from "../features/custody/_seed.js"

export type CustodyStores = {
  readonly custody: CustodyStore
  readonly audit: AuditJournal
}

/** مستودعٌ طازجٌ بسجلٍّ **واحدٍ مُحقَن** — لا سجلَّ محلياً بعد CR-027. */
export function freshCustodyStores(tenantId: string): CustodyStores {
  const audit = new AuditJournal(tenantId)
  return { custody: new CustodyStore(tenantId, audit), audit }
}

/**
 * إسقاطُ وحدات العالم القانونيّ — **قراءةٌ لا مصدرُ حقيقة**: موطنُ الوحدة `org`، وهذه
 * النسخةُ ما تحتاجه العُهدُ لاشتقاق النطاق (نظيرُ `ledger_units` حرفياً).
 */
export function seedCustodyUnits(store: CustodyStore): void {
  for (const unit of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId: store.tenantId, id: unit.id, path: unit.path })
  }
}

export function custodyUnitOfWork(
  driver: SqliteDriver,
  stores: CustodyStores,
  scope: Scope,
): UnitOfWork {
  const uow = new UnitOfWork(driver, scope)
  uow.enlist(persistentCustody(stores.custody))
  uow.enlist(persistentAudit(stores.audit))
  return uow
}

/**
 * **جلسةُ D1 واحدة**: تحميلٌ ⟵ مقطعٌ متزامنٌ يعمل عليه المنطقُ كما هو ⟵ قذفةٌ واحدة.
 * الاختباراتُ **تستهلك** طبقةَ الاستمرار كما تُشحن ولا تحاكيها.
 */
export async function custodySession<T>(
  driver: SqliteDriver,
  tenantId: string,
  fn: (stores: CustodyStores) => T,
  scopePath = "/",
): Promise<T> {
  const stores = freshCustodyStores(tenantId)
  const uow = custodyUnitOfWork(driver, stores, { tenantId, scopePath })
  await uow.hydrate()
  const value = fn(stores)
  await uow.flush()
  return value
}

/** بذرُ إسقاط الوحدات **بطريق الكتابة نفسِه** — فلا يُختبر مسارٌ لا يُشحن. */
export async function seedCustodySession(driver: SqliteDriver, tenantId: string): Promise<void> {
  await custodySession(driver, tenantId, ({ custody }) => seedCustodyUnits(custody))
}
