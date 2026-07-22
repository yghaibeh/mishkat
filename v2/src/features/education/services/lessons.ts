/**
 * **الكاتبُ الوحيد** لكيان الدرس وحضورِه وصورِه (عقدُ الوحدة §٣).
 *
 * وهو واحدٌ **بالقياس لا بالنيّة**: `single-circle-entity.test.ts` يمسح الوحدةَ فيفشل عند
 * كاتبٍ ثانٍ. ولذلك بابا الإدخال في `server/endpoints.ts` (المعلّمُ المالك وأميرُ المكان —
 * ق-٨٤) **يفوّضان هذه الدالةَ نفسَها**: بابان للصلاحية، ومنطقٌ واحدٌ لا يتباعد.
 *
 * وترتيبُ الحرّاس **مقصودٌ ويُختبر بترتيبه**: الحلقةُ ⟵ منهاجُ نوعها ⟵ المجلسُ ⟵ القفلُ ⟵
 * الشكلُ ⟵ الحضورُ ⟵ الصور. فالتشخيصُ الأدقُّ يسبق الأعمّ (ق-١١٢ روحاً).
 */

import type { EducationStore } from "../data/store.js"
import type { EducationContext } from "./context.js"
import { curriculumForCircleType, curriculumOfSession } from "./curriculum.js"
import {
  educationErr,
  educationOk,
  type EducationResult,
  type Lesson,
  type LessonAttendance,
  type LessonPhoto,
} from "../types.js"

export type RecordLessonInput = {
  readonly circleId: string
  readonly sessionId: string
  readonly heldAt: Date
  readonly durationMinutes: number
  readonly venueAr?: string
  /** الحاضرون — والباقي **يُسجَّل غائباً**: الغيابُ حقيقةٌ تُقرأ لا فراغٌ يُفسَّر. */
  readonly presentEnrollmentIds: readonly string[]
  /** مراجعُ صورٍ في خدمة الوسائط (IA ك-٣٤) — لا ملفاتٌ ولا تحقّقُ صيغةٍ هنا. */
  readonly photoKeys?: readonly string[]
}

/**
 * **تسجيلُ الدرس** — `upsert` بمفتاح `(الحلقة، المجلس)` فإعادةُ الإرسال آمنة (ق-٩٠)،
 * **والمعتمَدُ لا يُكتب عليه** (ق-٨): الحالُ يُسأل عنه **منفذاً** لا يُقرأ من حقلٍ هنا.
 */
export function recordLesson(
  store: EducationStore,
  ctx: EducationContext,
  input: RecordLessonInput,
): EducationResult<Lesson> {
  const circle = ctx.circleOf(input.circleId)
  if (circle === null) return educationErr("UNKNOWN_CIRCLE", input.circleId)
  if (circle.archivedAt !== null) return educationErr("CIRCLE_ARCHIVED", input.circleId)

  // **المنهاجُ صفةُ نوعِ الحلقة** (ب-٢٨): نوعٌ بلا منهاجٍ ⇒ لا درسَ منهاجٍ عليه.
  const curriculum = curriculumForCircleType(store, circle.typeId)
  if (curriculum === null) return educationErr("NO_CURRICULUM_FOR_TYPE", circle.typeId)

  const session = store.getSession(input.sessionId)
  if (session === null) return educationErr("UNKNOWN_SESSION", input.sessionId)
  if (curriculumOfSession(store, session.id)?.id !== curriculum.id) {
    return educationErr("SESSION_TYPE_MISMATCH", session.id)
  }

  const existing = store.findLesson(circle.id, session.id)
  if (existing !== null && ctx.isLessonApproved(existing.id)) {
    return educationErr("LESSON_LOCKED", existing.id)
  }

  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0) {
    return educationErr("INVALID_DURATION", String(input.durationMinutes))
  }

  const roster = ctx.rosterOf(circle.id)
  if (roster.length === 0) return educationErr("EMPTY_ATTENDANCE", circle.id)

  const present = input.presentEnrollmentIds
  if (new Set(present).size !== present.length) {
    return educationErr("DUPLICATE_ATTENDANCE", circle.id)
  }
  const rosterIds = new Set(roster.map((m) => m.id))
  const stranger = present.find((id) => !rosterIds.has(id))
  if (stranger !== undefined) return educationErr("NOT_ENROLLED", stranger)

  const photoKeys = input.photoKeys ?? []
  if (photoKeys.some((k) => k.trim().length === 0)) return educationErr("EMPTY_PHOTO_KEY")
  if (new Set(photoKeys.map((k) => k.trim())).size !== photoKeys.length) {
    return educationErr("DUPLICATE_PHOTO_KEY")
  }

  const lesson: Lesson = {
    tenantId: store.tenantId,
    id: existing?.id ?? store.nextId("lesson"),
    circleId: circle.id,
    sessionId: session.id,
    heldAt: input.heldAt,
    durationMinutes: input.durationMinutes,
    venueAr: input.venueAr === undefined || input.venueAr.trim().length === 0 ? null : input.venueAr.trim(),
    // **معلّمُ الحلقة المخزَّن** لا مدخلُ العميل — فلا يُنسَب درسٌ لمن لم يُسنَد (ق-٨٦).
    teacherPersonId: circle.teacherPersonId,
    recordedBy: ctx.actorPersonId,
    recordedAt: ctx.now,
  }
  store.saveLesson(lesson)

  const presentSet = new Set(present)
  store.saveAttendance(
    lesson.id,
    roster.map<LessonAttendance>((member) => ({
      tenantId: store.tenantId,
      id: `${lesson.id}:${member.id}`,
      lessonId: lesson.id,
      enrollmentId: member.id,
      present: presentSet.has(member.id),
    })),
  )
  store.savePhotos(
    lesson.id,
    photoKeys.map<LessonPhoto>((mediaKey, index) => ({
      tenantId: store.tenantId,
      id: `${lesson.id}:p${index}`,
      lessonId: lesson.id,
      mediaKey: mediaKey.trim(),
    })),
  )

  return educationOk(lesson)
}

// ── القراءاتُ المشتقّة (صفر عدّادٍ مخزَّن) ─────────────────────────────────────

export function lessonsOfCircle(store: EducationStore, circleId: string): readonly Lesson[] {
  return store
    .lessons()
    .filter((l) => l.circleId === circleId)
    .sort((a, b) => a.id.localeCompare(b.id))
}

/** دروسُ معلّمٍ — **من الإسناد المخزَّن في الدرس** لا من عدّادٍ يُحدَّث (ع-٢٩ نظيراً). */
export function lessonsOfTeacher(store: EducationStore, personId: string): readonly Lesson[] {
  return store
    .lessons()
    .filter((l) => l.teacherPersonId === personId)
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function attendanceOf(store: EducationStore, lessonId: string): readonly LessonAttendance[] {
  return store
    .attendance()
    .filter((a) => a.lessonId === lessonId)
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function photosOf(store: EducationStore, lessonId: string): readonly LessonPhoto[] {
  return store
    .photos()
    .filter((p) => p.lessonId === lessonId)
    .sort((a, b) => a.id.localeCompare(b.id))
}
