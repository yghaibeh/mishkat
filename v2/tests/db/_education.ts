/**
 * مِشْجَبُ استمرارِ منهاج «على بصيرة» — **ملفٌّ جديدٌ لا تعديلٌ في `_harness.ts`** (فخّ ٣).
 *
 * > **وثلاثةُ خلافاتٍ مُعلَنة**: (١) **لا `AuditJournal`** (تدقيقُها على `defineServerFn`)؛
 * > (٢) مصنعُ البصمات يستقبل **قارئَ مسارٍ** لأنّ الحلقةَ ليست ملكَه (ب-٢٨)؛
 * > (٣) **وحدةُ العمل الحقيقيةُ ثلاثيةُ المصادر** — كتالوجُنا وبصماتُنا **وسجلُّ اليوم**،
 * >     و**الميزانيةُ تُقاس لكلِّ مصدرٍ على حدة** (الوصفة §٧) فلا تُجمع ذهنياً.
 */

import {
  persistentEducationCatalog,
  persistentEducationEntries,
} from "../../src/db/repositories/educationRepository.js"
import {
  persistentCircleLogCatalog,
  persistentCircleLogEntries,
} from "../../src/db/repositories/circleLogRepository.js"
import type { SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { UnitOfWork, type Scope } from "../../src/db/unitOfWork.js"
import { EducationStore } from "../../src/features/education/data/store.js"
import { CircleLogStore } from "../../src/features/circleLog/data/store.js"
import type { CirclesStore } from "../../src/features/circles/data/store.js"

export { MAIN, OTHER, freshDb, rowsOf } from "./_harness.js"
export { circlePathOf, seedCircleModel, seedCircleWithStudents } from "./_circleLog.js"
export {
  BOOK_ID,
  CURRICULUM_ID,
  HELD_AT,
  LEVEL_ID,
  NEXT_DAY,
  NOW,
  SESSION_A,
  SESSION_B,
  educationContext,
  seedEducationStore,
} from "../features/education/_seed.js"

import { BOOK_ID, CURRICULUM_ID, LEVEL_ID, SESSION_A, SESSION_B } from "../features/education/_seed.js"

/** بذرُ كتالوج المنهاج **بطريق الكتابة نفسِه** — فلا يُختبر مسارٌ لا يُشحن. */
export function seedEducationReferences(store: EducationStore): void {
  const tenantId = store.tenantId
  store.saveCurriculum({ tenantId, id: CURRICULUM_ID, ar: "منهاجُ على بصيرة", circleTypeId: "baseera" })
  store.saveLevel({ tenantId, id: LEVEL_ID, curriculumId: CURRICULUM_ID, ar: "المستوى الأول", ordinal: 1 })
  store.saveBook({ tenantId, id: BOOK_ID, levelId: LEVEL_ID, ar: "كتابُ التوحيد", ordinal: 1 })
  store.saveSession({ tenantId, id: SESSION_A, bookId: BOOK_ID, ar: "المجلسُ الأول", ordinal: 1 })
  store.saveSession({ tenantId, id: SESSION_B, bookId: BOOK_ID, ar: "المجلسُ الثاني", ordinal: 2 })
}

/** **وحدةُ عملِ الوحدة وحدَها** — مصدران (§٤-٠). */
export function educationUnitOfWork(
  driver: SqliteDriver,
  store: EducationStore,
  circles: CirclesStore,
  scope: Scope,
  pathOf: (circleId: string) => string | null,
): UnitOfWork {
  void circles
  const uow = new UnitOfWork(driver, scope)
  uow.enlist(persistentEducationCatalog(store))
  uow.enlist(persistentEducationEntries(store, pathOf))
  return uow
}

/**
 * **وحدةُ عملٍ ثلاثيةُ المصادر** — كما يبنيها المُركِّبُ في الإنتاج: كتالوجُنا وبصماتُنا
 * **وسجلُّ اليوم بمصدرَيه**؛ فالكتابةُ في موطن الكيان **تُقذف في الدفعة نفسِها**.
 */
export function educationWithLogUnitOfWork(
  driver: SqliteDriver,
  education: EducationStore,
  log: CircleLogStore,
  scope: Scope,
  pathOf: (circleId: string) => string | null,
): UnitOfWork {
  const uow = new UnitOfWork(driver, scope)
  uow.enlist(persistentEducationCatalog(education))
  uow.enlist(persistentEducationEntries(education, pathOf))
  uow.enlist(persistentCircleLogCatalog(log))
  uow.enlist(persistentCircleLogEntries(log, pathOf))
  return uow
}

/** **جلسةُ D1 واحدة** على المصدرين الأربعة. */
export async function educationSession<T>(
  driver: SqliteDriver,
  tenantId: string,
  pathOf: (circleId: string) => string | null,
  fn: (stores: { education: EducationStore; log: CircleLogStore }) => T,
  scopePath = "/",
): Promise<T> {
  const education = new EducationStore(tenantId)
  const log = new CircleLogStore(tenantId)
  const uow = educationWithLogUnitOfWork(driver, education, log, { tenantId, scopePath }, pathOf)
  await uow.hydrate()
  const value = fn({ education, log })
  await uow.flush()
  return value
}

export async function seedEducationSession(
  driver: SqliteDriver,
  tenantId: string,
  pathOf: (circleId: string) => string | null,
): Promise<void> {
  await educationSession(driver, tenantId, pathOf, ({ education }) => seedEducationReferences(education))
}
