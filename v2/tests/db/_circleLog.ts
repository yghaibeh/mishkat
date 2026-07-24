/**
 * مِشْجَبُ استمرارِ السجلّ اليوميّ — **ملفٌّ جديدٌ لا تعديلٌ في `_harness.ts`** (الوصفة فخّ ٣).
 *
 * > **وخلافان مُعلَنان صراحةً**:
 * >  ١. **لا `AuditJournal` في وحدة العمل** — لم تحمل الوحدةُ سجلاً محلياً قطّ (تدقيقُها على
 * >     `defineServerFn`)، فبندُ ناقل الوحدة ٢/٣ **غيرُ ذي موضوع**.
 * >  ٢. **مصنعُ المصدر التشغيليّ يستقبل `CircleModelPort`** — لأنّ مفتاحَ التوجيه **يُشتقّ من
 * >     موطن الحلقة الحيّ ولا يُنسخ إلى الكيان** (ب-٢٨ يحرسه نصّاً). فوحدةُ العمل هنا تُبنى
 * >     على **مستودعَين**: سجلُّ اليوم ونموذجُ الحلقات — كما يفعل المُركِّبُ في الإنتاج.
 *
 * **حتميّ** (TESTING_POLICY §٥): المعرّفاتُ من عدّاد المستودع، ولحظةُ العالم مثبَّتة.
 */

import {
  persistentCircleLogCatalog,
  persistentCircleLogEntries,
} from "../../src/db/repositories/circleLogRepository.js"
import type { SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { UnitOfWork, type Scope } from "../../src/db/unitOfWork.js"
import { CircleLogStore } from "../../src/features/circleLog/data/store.js"
import { CirclesStore } from "../../src/features/circles/data/store.js"
import { createCircle, assignTeacher } from "../../src/features/circles/services/circles.js"
import { enroll } from "../../src/features/circles/services/enrollment.js"
import { buildCanonicalWorld } from "../fixtures/canonical-world.js"

/** الشبكتان و`freshDb` من المِشْجَب المشترك — **تُستهلك ولا تُنسخ** (المادة ١/٢). */
export { MAIN, OTHER, freshDb, rowsOf } from "./_harness.js"
export {
  BILAL_PATH,
  KHALID_PATH,
  MEN_PATH,
  MUSHAF_ID,
  MUSHAF_PAGES,
  NOW,
  ROOT_SCOPE_PATH,
  SEEDED_PERIODS,
  SEEDED_SURAHS,
  SEEDED_TYPES,
  SQ2_PATH,
  declarePeriods,
  logContext,
  sequentialTokens,
} from "../features/circleLog/_seed.js"

import { MUSHAF_ID, SEEDED_SURAHS, SEEDED_TYPES } from "../features/circleLog/_seed.js"

/**
 * **قارئُ مسار الحلقة** — أضيقُ عقدٍ يكفي طبقةَ البيانات: سؤالٌ واحدٌ لا منفذٌ كامل،
 * ويقرأ **موطنَ الحلقة الحيّ** من مستودعها (لا نسخةً في كيان الجلسة — ب-٢٨).
 */
export function circlePathOf(circles: CirclesStore) {
  return (circleId: string): string | null => circles.getCircle(circleId)?.unitPath ?? null
}

/** بذرُ الكتالوج المرجعيّ — بطريق الكتابة نفسِه، فلا يُختبر مسارٌ لا يُشحن. */
export function seedCircleLogReferences(store: CircleLogStore): void {
  const tenantId = store.tenantId
  for (const s of SEEDED_SURAHS) store.saveSurah({ tenantId, ...s })
  store.saveMushaf({ tenantId, id: MUSHAF_ID, ar: "مصحف المدينة", pageCount: 604 })
}

/** نموذجُ الحلقات في الذاكرة — **مصدرُ مفتاح التوجيه** (يُقرأ ولا يُنسخ). */
export function seedCircleModel(tenantId: string): CirclesStore {
  const circles = new CirclesStore(tenantId)
  for (const unit of buildCanonicalWorld().units) {
    circles.saveUnit({ tenantId, id: unit.id, path: unit.path })
  }
  for (const type of SEEDED_TYPES) circles.saveType({ tenantId, id: type.id, ar: type.ar })
  return circles
}

/** حلقةٌ وطالبان **بمسار T16 المُعلَن** لا بحقنٍ في مستودع. */
export function seedCircleWithStudents(
  circles: CirclesStore,
  input: { readonly unitId?: string; readonly typeId?: string } = {},
): { readonly circleId: string; readonly studentA: string; readonly studentB: string } {
  const ctx = { now: new Date("2026-07-22T09:00:00.000Z"), actorPersonId: "u-amir", reaches: () => true }
  const made = createCircle(circles, ctx, {
    unitId: input.unitId ?? "khalid",
    typeId: input.typeId ?? "tahfeez",
    nameAr: "حلقةُ الفجر",
    capacity: 20,
  })
  if (!made.ok) throw new Error(made.error.code)
  assignTeacher(circles, ctx, { circleId: made.value.id, teacherPersonId: "u-teacher-mosque" })
  const enrolledId = (nameAr: string): string => {
    const done = enroll(circles, ctx, { circleId: made.value.id, nameAr })
    if (!done.ok) throw new Error(done.error.code)
    return done.value.id
  }
  return { circleId: made.value.id, studentA: enrolledId("عبد الله"), studentB: enrolledId("معاذ") }
}

/**
 * وحدةُ عملٍ — **مصدران** (§٤-٠): الكتالوجُ بالجذر والتشغيليُّ بالوحدة، ويُقذفان في **دفعةٍ
 * واحدة** فالذرّيةُ عابرةٌ للمصدرين.
 */
export function circleLogUnitOfWork(
  driver: SqliteDriver,
  store: CircleLogStore,
  circles: CirclesStore,
  scope: Scope,
): UnitOfWork {
  const uow = new UnitOfWork(driver, scope)
  uow.enlist(persistentCircleLogCatalog(store))
  uow.enlist(persistentCircleLogEntries(store, circlePathOf(circles)))
  return uow
}

/** **جلسةُ D1 واحدة**: تحميلٌ ⟵ مقطعٌ متزامن ⟵ قذفةٌ واحدة. */
export async function circleLogSession<T>(
  driver: SqliteDriver,
  tenantId: string,
  circles: CirclesStore,
  fn: (store: CircleLogStore) => T,
  scopePath = "/",
): Promise<T> {
  const store = new CircleLogStore(tenantId)
  const uow = circleLogUnitOfWork(driver, store, circles, { tenantId, scopePath })
  await uow.hydrate()
  const value = fn(store)
  await uow.flush()
  return value
}

/** بذرُ الكتالوج **بطريق الكتابة نفسِه**. */
export async function seedCircleLogSession(
  driver: SqliteDriver,
  tenantId: string,
  circles: CirclesStore,
): Promise<void> {
  await circleLogSession(driver, tenantId, circles, (store) => seedCircleLogReferences(store))
}
