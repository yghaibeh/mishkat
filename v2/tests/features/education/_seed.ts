/**
 * بذرةُ عالم «على بصيرة» — تُبنى على **العالم القانونيّ الواحد** (TESTING_POLICY §٥) وعلى
 * **نموذج الحلقات الموحّد نفسِه** (T16): فلا حلقةٌ ثانيةٌ تُخترع هنا ولا سجلُّ طلابٍ ثانٍ —
 * الحلقاتُ تُنشأ بمستودع `circles` بدوالِّه المعلنة، وهذه الوحدةُ تقرؤها **بمنافذ** (عقدُ §١).
 *
 * **حتميّ**: لحظةٌ مثبَّتة ومعرّفاتٌ متتابعة — لا عشوائيّة ولا ساعةَ زمن-تشغيل.
 */

import { CirclesStore } from "../../../src/features/circles/data/store.js"
import { createCircle, assignTeacher } from "../../../src/features/circles/services/circles.js"
import { enroll } from "../../../src/features/circles/services/enrollment.js"
import { makeScopeReach } from "../../../src/features/circles/services/directory.js"
import type { CirclesContext } from "../../../src/features/circles/services/context.js"
import { EducationStore } from "../../../src/features/education/data/store.js"
import { CircleLogStore } from "../../../src/features/circleLog/data/store.js"
import { circleModelFrom } from "../../../src/features/circleLog/services/circlesPort.js"
import { circleDaysFrom, sessionShapeFrom } from "../../../src/features/education/services/dayLogPort.js"
import type { SessionContext } from "../../../src/features/circleLog/services/context.js"
import type { EducationContext } from "../../../src/features/education/services/context.js"
import {
  makeCirclePorts,
  type EducationPorts,
} from "../../../src/features/education/services/bindings.js"
import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import { createSettingsResolver, type SettingOverride } from "../../../src/settings/resolver.js"
import type { Actor, DecisionContext } from "../../../src/authorization/can.js"

export const MAIN_TENANT_ID = "t-main"
/** الشبكةُ الثانية — بنفس المسارات النسبيّة عمداً، فيثبت العزلُ أنّ التطابق لا يسرّب (قب-١٨). */
export const SECOND_TENANT_ID = "t-aleppo"

/** لحظةُ العالم المثبَّتة — كلُّ تاريخٍ في الاختبارات مشتقٌّ منها. */
export const NOW = new Date("2026-07-22T09:00:00.000Z")
export const HELD_AT = new Date("2026-07-20T09:00:00.000Z")
/** اليومُ التالي — **الكيانُ «جلسةٌ يومية»** فمفتاحُه (حلقة × يوم): درسان ⇒ يومان (ق-٩٠). */
export const NEXT_DAY = new Date("2026-07-21T09:00:00.000Z")

export const KHALID_PATH = "/men/homs/sq2/khalid/"
export const OMAR_PATH = "/men/homs/sq7/omar/"

export const DECISION: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
export const WRITE: DecisionContext = { ...DECISION, intent: "write" }

/** أنواعُ الحلقات — **بياناتٌ مرجعية** من كتالوج T16 نفسِه (لا معجمَ ثانٍ). */
export const SEEDED_TYPES: readonly { readonly id: string; readonly ar: string }[] = Object.freeze([
  { id: "tahfeez", ar: "تحفيظ" },
  { id: "baseera", ar: "على بصيرة" },
  { id: "scientific", ar: "علمية" },
  { id: "rashidi", ar: "الرشيدي" },
])

export function canonicalDirectory(personId: string): Actor | null {
  return buildCanonicalWorld().people.find((p) => p.personId === personId) ?? null
}

export function canonicalActor(personId: string): Actor {
  const actor = canonicalDirectory(personId)
  if (actor === null) throw new Error(`لا فاعلَ بهذا المعرّف في العالم القانونيّ: ${personId}`)
  return actor
}

export function circlesContext(actorPersonId: string): CirclesContext {
  return { now: NOW, actorPersonId, reaches: makeScopeReach(canonicalDirectory, NOW) }
}

/** مستودعُ الحلقات مبذوراً بوحدات العالم القانونيّ وكتالوج الأنواع (T16). */
export function seedCirclesStore(tenantId: string = MAIN_TENANT_ID): CirclesStore {
  const store = new CirclesStore(tenantId)
  for (const unit of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId, id: unit.id, path: unit.path })
  }
  for (const type of SEEDED_TYPES) store.saveType({ tenantId, id: type.id, ar: type.ar })
  return store
}

/**
 * **منهاجٌ واحدٌ اليوم** — صفوفٌ في المستودع لا سطرٌ في الكود (قب-٢٢): منهاجُ نوعِ `baseera`
 * بمستوىً وكتابٍ ومجلسَين. والثاني يُضاف في اختباره **بياناً** ليُثبت أنه يعمل بلا كود.
 */
export const CURRICULUM_ID = "cur-baseera"
export const LEVEL_ID = "lvl-1"
export const BOOK_ID = "book-1"
export const SESSION_A = "ses-1"
export const SESSION_B = "ses-2"

export function seedEducationStore(tenantId: string = MAIN_TENANT_ID): EducationStore {
  const store = new EducationStore(tenantId)
  store.saveCurriculum({ tenantId, id: CURRICULUM_ID, ar: "منهاجُ على بصيرة", circleTypeId: "baseera" })
  store.saveLevel({ tenantId, id: LEVEL_ID, curriculumId: CURRICULUM_ID, ar: "المستوى الأول", ordinal: 1 })
  store.saveBook({ tenantId, id: BOOK_ID, levelId: LEVEL_ID, ar: "كتابُ التوحيد", ordinal: 1 })
  store.saveSession({ tenantId, id: SESSION_A, bookId: BOOK_ID, ar: "المجلسُ الأول", ordinal: 1 })
  store.saveSession({ tenantId, id: SESSION_B, bookId: BOOK_ID, ar: "المجلسُ الثاني", ordinal: 2 })
  return store
}

export const SETTINGS = createSettingsResolver([])

export function settingsWith(overrides: readonly SettingOverride[]) {
  return createSettingsResolver(overrides)
}

/** عالمُ الاختبار: حلقةُ «على بصيرة» في مسجد خالد، معلّمُها `u-teacher`، وثلاثةُ ملتحقين. */
export type EduWorld = {
  readonly circles: CirclesStore
  readonly education: EducationStore
  /**
   * **مستودعُ الجلسة اليومية** (CR-016) — الكيانُ الواحدُ في موطنه: تكتب فيه وحدةُ التعليم
   * **بكاتبه هو** عبر المنفذ، وتقرأ منه؛ فلا مستودعَ درسٍ ثانٍ في هذه البذرة أصلاً.
   */
  readonly log: CircleLogStore
  readonly circleId: string
  readonly enrollmentIds: readonly string[]
  /** حلقةٌ ثانيةٌ نوعُها `tahfeez` — بلا منهاجٍ اليوم (يُثبت `NO_CURRICULUM_FOR_TYPE`). */
  readonly tahfeezCircleId: string
}

export function seedWorld(tenantId: string = MAIN_TENANT_ID): EduWorld {
  const circles = seedCirclesStore(tenantId)
  const created = createCircle(circles, circlesContext("u-amir"), {
    unitId: "khalid",
    typeId: "baseera",
    nameAr: "حلقةُ على بصيرة",
    capacity: 20,
  })
  if (!created.ok) throw new Error(created.error.code)
  const circleId = created.value.id
  const assigned = assignTeacher(circles, circlesContext("u-amir"), {
    circleId,
    teacherPersonId: "u-teacher",
  })
  if (!assigned.ok) throw new Error(assigned.error.code)

  const enrollmentIds: string[] = []
  for (const nameAr of ["أحمد", "بلال", "خالد"]) {
    const done = enroll(circles, circlesContext("u-amir"), { circleId, nameAr })
    if (!done.ok) throw new Error(done.error.code)
    enrollmentIds.push(done.value.id)
  }

  const second = createCircle(circles, circlesContext("u-amir"), {
    unitId: "khalid",
    typeId: "tahfeez",
    nameAr: "حلقةُ الحفظ",
    capacity: 10,
  })
  if (!second.ok) throw new Error(second.error.code)
  for (const nameAr of ["سعد", "عمّار"]) {
    const done = enroll(circles, circlesContext("u-amir"), { circleId: second.value.id, nameAr })
    if (!done.ok) throw new Error(done.error.code)
  }

  return {
    circles,
    education: seedEducationStore(tenantId),
    log: new CircleLogStore(tenantId),
    circleId,
    enrollmentIds,
    tahfeezCircleId: second.value.id,
  }
}

/** منافذُ الحلقة موصولةً بالمصدر الواحد — **تُستعمل ولا تُعاد** (عقدُ الوحدة §١). */
export function educationPorts(world: EduWorld): EducationPorts {
  return makeCirclePorts(world.circles)
}

/** حلقةٌ إضافيةٌ من نوع المنهاج المبذور **بلا ملتحقٍ واحد** — لإثبات «لا درسَ على فراغ». */
export function emptyCircleOf(world: EduWorld, unitId: string = "khalid"): string {
  const created = createCircle(world.circles, circlesContext("u-amir"), {
    unitId,
    typeId: "baseera",
    nameAr: "حلقةٌ بلا ملتحقين",
    capacity: 5,
  })
  if (!created.ok) throw new Error(created.error.code)
  return created.value.id
}

/**
 * سياقُ خدمات التعليم — **المنافذُ موصولةٌ بالمصدر الواحد** (وحدةُ الحلقات)، ومنفذُ الاعتماد
 * يُمرَّر صراحةً: افتراضُه «لا شيءَ معتمَد» فيبقى **الاعتمادُ فعلاً يقع** لا حالةً ضمنية.
 */
export function educationContext(
  world: EduWorld,
  input: {
    readonly actorPersonId?: string
    readonly approvedLessonIds?: readonly string[]
    readonly settings?: ReturnType<typeof createSettingsResolver>
    readonly now?: Date
  } = {},
): EducationContext {
  const approved = new Set(input.approvedLessonIds ?? [])
  const now = input.now ?? NOW
  const actorPersonId = input.actorPersonId ?? "u-teacher"
  const settings = input.settings ?? SETTINGS
  const isLessonApproved = (lessonId: string): boolean => approved.has(lessonId)
  return {
    now,
    actorPersonId,
    settings,
    ...makeCirclePorts(world.circles),
    isLessonApproved,
    days: circleDays(world, { settings, isLessonApproved })(actorPersonId, now),
  }
}

/**
 * **سياقُ صاحب الكيان** — كما يبنيه المُركِّبُ في الإنتاج: منفذُ الشكل موصولٌ **بكتالوج
 * مناهجنا**، ومنفذُ القفل بمنفذ الاعتماد. فاختبارُ الشكلين يجري على **التركيب الحقيقيّ**.
 */
export function logContextOf(
  world: EduWorld,
  input: {
    readonly actorPersonId?: string
    readonly now?: Date
    readonly settings?: ReturnType<typeof createSettingsResolver>
    readonly approvedLessonIds?: readonly string[]
  } = {},
): SessionContext {
  const approved = new Set(input.approvedLessonIds ?? [])
  return {
    now: input.now ?? NOW,
    actorPersonId: input.actorPersonId ?? "u-teacher",
    settings: input.settings ?? SETTINGS,
    circles: circleModelFrom(world.circles),
    shape: sessionShapeFrom(world.education),
    isSessionLocked: (sessionId) => approved.has(sessionId),
  }
}

/**
 * **منفذُ الجلسة اليومية** موصولاً بموطن الكيان — لا ببديلٍ في الاختبار:
 * فالاختبارُ يمرّ على **الكاتب الحقيقيّ** ولو أخطأ التوحيدُ لسقط هنا لا في الإنتاج.
 */
export function circleDays(
  world: EduWorld,
  input: {
    readonly settings?: ReturnType<typeof createSettingsResolver>
    readonly isLessonApproved?: (lessonId: string) => boolean
  } = {},
) {
  return circleDaysFrom({
    logStore: world.log,
    education: world.education,
    circles: circleModelFrom(world.circles),
    settings: input.settings ?? SETTINGS,
    isLessonApproved: input.isLessonApproved ?? (() => false),
  })
}
