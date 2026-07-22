/**
 * **قواعدُ درس المنهاج فوق الجلسة الواحدة** (عقدُ الوحدة §٣، CR-016).
 *
 * **ما تغيّر بالتوحيد وما لم يتغيّر**:
 *  - **لم يتغيّر**: ق-٨٤ بابان (المعلّمُ المالك وأميرُ المكان) يفوّضان **دالةً واحدة**؛ والمجلسُ
 *    من قائمةٍ مغلقة (ق-٨٩)؛ والمعتمَدُ لا يُكتب عليه (ق-٨)؛ والحضورُ لكل ملتحقٍ صفٌّ.
 *  - **تغيّر**: هذه الدالةُ **لم تعد تكتب كياناً**. تتحقّق من **قواعدها هي** (المنهاجُ والمجلسُ
 *    ونوعُ الحلقة) ثم **تفوّض الكتابةَ إلى كاتب الجلسة في موطنها** عبر المنفذ. فالكاتبُ واحدٌ
 *    في النظام كلِّه لا واحدٌ في كل وحدة.
 *
 * **وترتيبُ الحرّاس محفوظٌ ويُختبر بترتيبه**: الحلقةُ ⟵ منهاجُ نوعها ⟵ المجلسُ ⟵ (ثم عند
 * صاحب الكيان) الشكلُ ⟵ القفلُ ⟵ المدةُ ⟵ الحضورُ ⟵ الصور. فالتشخيصُ الأدقُّ يسبق الأعمّ.
 */

import type { EducationStore } from "../data/store.js"
import type { EducationContext } from "./context.js"
import { curriculumForCircleType, curriculumOfSession } from "./curriculum.js"
import { educationErr, type EducationResult } from "../types.js"
import type { CircleDay } from "./ports.js"

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
 * **تسجيلُ درس المنهاج** — `upsert` بمفتاح **(الحلقة، اليوم)** عند صاحب الكيان (ق-٩٠)،
 * فإعادةُ الإرسال آمنة. و**المعتمَدُ لا يُكتب عليه** (ق-٨): القفلُ يُسأل عنه **منفذاً**
 * ولا يُقرأ من حقلٍ هنا.
 */
export function recordLesson(
  store: EducationStore,
  ctx: EducationContext,
  input: RecordLessonInput,
): EducationResult<CircleDay> {
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

  // **الكتابةُ في موطن الكيان** — لا مستودعَ ثانٍ هنا، ولا مزامنةَ بين سجلّين (CR-016).
  // (الاختياريُّ **يُحذف ولا يُمرَّر `undefined`** — `exactOptionalPropertyTypes` مُفعَّل.)
  return ctx.days.record({
    circleId: circle.id,
    heldAt: input.heldAt,
    curriculumSessionId: session.id,
    durationMinutes: input.durationMinutes,
    ...(input.venueAr === undefined ? {} : { venueAr: input.venueAr }),
    presentEnrollmentIds: input.presentEnrollmentIds,
    ...(input.photoKeys === undefined ? {} : { photoKeys: input.photoKeys }),
  })
}

// ── القراءاتُ المشتقّة (صفر عدّادٍ مخزَّن، وصفر نسخةٍ ثانية) ──────────────────────

export function lessonsOfCircle(ctx: EducationContext, circleId: string): readonly CircleDay[] {
  return ctx.days.ofCircle(circleId)
}

/**
 * دروسُ معلّمٍ — **من إسناد الحلقة المخزَّن لحظةَ السؤال** لا من نسخةٍ في الدرس.
 *
 * وهذا **إصلاحٌ كشفه التوحيد**: كان الدرسُ يحمل `teacherPersonId` منسوخاً من الحلقة، وهو
 * **نسخةُ حقلٍ من كيانٍ آخر** — عينُ ما يحرسه ب-٢٨. فصار الإسنادُ يُسأل عنه في موطنه.
 */
export function lessonsOfTeacher(ctx: EducationContext, personId: string): readonly CircleDay[] {
  return ctx.days.ofTeacher(personId)
}
