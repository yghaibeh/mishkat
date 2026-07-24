/**
 * مِشْجَبُ استمرارِ الصندوق — **ملفٌّ جديدٌ لا تعديلٌ في `_harness.ts`** (وصفة §٥-أ · فخّ ٣).
 *
 * **بدائيّاتُ المِشْجَب المشترك تُستهلك ولا تُعدَّل** (`freshDb` · `MAIN`/`OTHER` · `rowsOf`)،
 * ووحدةُ عملِ الصندوق تُبنى هنا. ولو وُسِّع `Stores` المشتركُ لتغيّر توقيعُ `unitOfWorkFor`
 * فكسر مستدعياتٍ قائمة (`atomicity.test.ts` يمرّر `{ org, ledger, audit }` حرفياً).
 *
 * ### وحدةُ عملِ الصندوق **أربعةُ مصادر** — وهذا هو الفرقُ الجوهريُّ عن الموجة الأولى
 * `persistentLedger` **معها لا بجانبها**: الصندوقُ لا يملك مالاً (ق-٦٠)، والتسليمُ **قيدٌ في
 * الدفتر وسجلٌّ هنا**. فلو قُذف المستودعان في دفعتين لأمكن أن يبقى **قيدٌ بلا سجلِّ تسليمه**؛
 * ووحدةُ العمل الواحدة تجعل الفارقين **دفعةً واحدة: كلٌّ أو لا شيء** (README الحسم ١).
 *
 * **والسجلُّ واحدٌ مُحقَن** (CR-027 · شرطُ قب-٤٩): `boxStoresFor` تحقنه في الدفتر،
 * ووحدةُ العمل تُلحق `persistentAudit(stores.ledger.audit)` **بذلك السجلِّ بعينه** —
 * فلا سجلّان لدفترٍ واحدٍ يدهس أحدُهما صفوفَ الآخر بالمفتاح `(tenant_id, source, seq)`.
 *
 * **حتميّ** (TESTING_POLICY §٥): لحظةُ العالم القانونيّ مثبَّتة، والمعرّفاتُ من عدّاد المستودع.
 */

import { persistentAudit } from "../../src/db/repositories/auditRepository.js"
import {
  persistentBoxCatalog,
  persistentBoxHandovers,
} from "../../src/db/repositories/boxRepository.js"
import {
  persistentLedger,
  type LedgerReferences,
} from "../../src/db/repositories/ledgerRepository.js"
import type { SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { UnitOfWork, type Scope } from "../../src/db/unitOfWork.js"
import { boxStoresFor, type BoxStores } from "../../src/features/box/data/store.js"
import { buildCanonicalWorld } from "../fixtures/canonical-world.js"
import { CATEGORIES, CATEGORY_ACCOUNTS } from "../features/box/_seed.js"
import { CHART, FUNDS } from "../features/ledger/_seed.js"

/** الشبكتان و`freshDb` من المِشْجَب المشترك — **تُستهلك ولا تُنسخ** (المادة ١/٢). */
export { MAIN, OTHER, freshDb, rowsOf } from "./_harness.js"
/** ولحظةُ الصندوق لحظةُ عالمه القانونيّ، وسياقُه وقاموسُه — بلا نسخٍ لتعريفها هنا. */
export { CATEGORIES, CATEGORY_ACCOUNTS, NOW, boxContext, c } from "../features/box/_seed.js"

export const SQ2 = "sq2"
export const SQ2_PATH = "/men/homs/sq2/"
export const KHALID = "khalid"
export const KHALID_PATH = "/men/homs/sq2/khalid/"
export const BILAL_PATH = "/men/homs/sq2/bilal/"
/** **أوسعُ نطاقٍ يقرؤه سطحٌ مُعلَن** — عقدةُ القسم، ومرساةُ سقف G23 (CR-030). */
export const MEN_PATH = "/men/"

/**
 * مراجعُ الدفتر التي **لا تُعدَّد من `LedgerStore`** (لا سطحَ قراءةٍ لها فيه)، فتُمرَّر
 * صراحةً عند البذر. وحساباتُ فئات الصرف منها — وإلا رفضت النواةُ صرفاً بحسابٍ مجهول.
 */
export const BOX_REFERENCES: LedgerReferences = {
  accounts: [...CHART, ...CATEGORY_ACCOUNTS].map((a) => ({
    tenantId: "",
    id: a.id,
    ar: a.ar,
    kind: a.kind,
  })),
  funds: FUNDS.map((f) => ({ tenantId: "", id: f.id, ar: f.ar, restricted: f.restricted })),
}

/** حزمةٌ طازجةٌ بسجلٍّ **واحدٍ مُحقَن** — من المصنع الواحد لا ببناءٍ يدويّ (شرطُ قب-٤٩). */
export function freshBoxStores(tenantId: string): BoxStores {
  return boxStoresFor(tenantId)
}

/**
 * وحدةُ عملٍ كاملة — **أربعةُ مصادر**: الدفترُ والقاموسُ والتسليماتُ والسجلّ.
 * والقاموسُ مصدرٌ مستقلٌّ (وصفة §٤-٠) وإن كانت الجلسةُ التشغيلية تحتاجهما معاً
 * (الصرفُ يسأل القاموسَ، والتسليمُ يكتب سجلاً).
 */
export function boxUnitOfWork(
  driver: SqliteDriver,
  stores: BoxStores,
  scope: Scope,
  withReferences = false,
): UnitOfWork {
  const uow = new UnitOfWork(driver, scope)
  uow.enlist(persistentLedger(stores.ledger, withReferences ? BOX_REFERENCES : null))
  uow.enlist(persistentBoxCatalog(stores.box))
  uow.enlist(persistentBoxHandovers(stores.box))
  uow.enlist(persistentAudit(stores.ledger.audit))
  return uow
}

/**
 * **وحدةُ عملِ القاموس وحدَه** — بها يُبرهَن مقصدُ الفصل: قراءةُ القاموس بالجذر **لا تلمس
 * تسليماً واحداً**، فلا يفرض أضيقُ النطاقَين على أوسعِهما حملَه.
 */
export function boxCatalogUnitOfWork(
  driver: SqliteDriver,
  stores: BoxStores,
  scope: Scope,
): UnitOfWork {
  const uow = new UnitOfWork(driver, scope)
  uow.enlist(persistentBoxCatalog(stores.box))
  return uow
}

/**
 * **جلسةُ D1 واحدة**: تحميلٌ ⟵ مقطعٌ متزامنٌ يعمل عليه المنطقُ كما هو ⟵ قذفةٌ واحدة.
 * الاختباراتُ **تستهلك** طبقةَ الاستمرار كما تُشحن ولا تحاكيها.
 */
export async function boxSession<T>(
  driver: SqliteDriver,
  tenantId: string,
  fn: (stores: BoxStores) => T,
  scopePath = "/",
): Promise<T> {
  const stores = freshBoxStores(tenantId)
  const uow = boxUnitOfWork(driver, stores, { tenantId, scopePath })
  await uow.hydrate()
  const value = fn(stores)
  await uow.flush()
  return value
}

/** بذرُ المراجع والقاموس **بطريق الكتابة نفسِه** — فلا يُختبر مسارٌ لا يُشحن. */
export async function seedBoxSession(driver: SqliteDriver, tenantId: string): Promise<void> {
  const stores = freshBoxStores(tenantId)
  const uow = boxUnitOfWork(driver, stores, { tenantId, scopePath: "/" }, true)
  await uow.hydrate()
  for (const unit of buildCanonicalWorld().units) {
    stores.ledger.saveUnit({ tenantId, id: unit.id, path: unit.path })
  }
  for (const category of CATEGORIES) {
    stores.box.saveCategory({ tenantId, ...category })
  }
  await uow.flush()
}
