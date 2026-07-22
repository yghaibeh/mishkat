/**
 * ق-٨٥ (ق-د١) — **اعتمادُ الدرس المفرد للأقرب: نوعُ اعتمادٍ مسجَّلٌ في المحرّك**.
 *
 * القاعدةُ نصاً: «درسُ الحلقة يعتمده **أميرُ المكان أولاً**، فالطبقةُ الإشرافية الأقرب (NESSA)،
 * والإدارةُ **كسرَ زجاجٍ** عند شغورهما معاً. **والمعلّمُ لا يعتمد درسَ نفسه**». وقد أنهى بها
 * المالكُ سطراً كان يقول «اعتمده: المدير العام» على درسِ حلقة.
 *
 * **ولماذا يعيش هذا الملفُّ في مجلد المحرّك لا في وحدة التعليم؟** لأنه **يستهلك قدرةَ اعتماد**،
 * وبوابة G22 تحصر استهلاكَ قدرات السلسلة في المحرّك وحده (`PARALLEL_WORK` §٣/§٨ وقب-٣٣) —
 * فوضعُه هنا هو ما يُبقي وحدةَ التعليم **صفرَ منطقِ اعتماد**.
 *
 * **والأميرُ أقربُ سلَفٍ بالبنية لا بحالةٍ خاصة**: مِرساةُ الطلب **مسارُ الحلقة** المبنيُّ تحت
 * مسار وحدتها، فيُجيب `approverLayerFor` بأمير المسجد أولاً — وشغورُه يصعد إلى المربع فالمنطقة
 * **تلقائياً** (ق-٢) بلا سطرِ تصعيد. **صفر اسمِ دورٍ هنا** (G6).
 *
 * **والفترةُ هي الدرسُ نفسُه**: `period.id = lessonId` و`endsAt = heldAt` — فيصير شرطُ المحرّك
 * «طلبٌ واحدٌ لكل وحدةٍ وفترة» **«اعتمادَ الدرس المفرد»** حرفياً، ويرث الدرسُ **القفلَ الزمنيّ**
 * (ب-٣٩د) بلا حقلٍ جديدٍ في المحرّك.
 */

import type { EducationStore } from "../../education/data/store.js"
import type { EducationPorts } from "../../education/services/bindings.js"
import type { LessonApprovalCheck, TeachingCircle } from "../../education/services/ports.js"
import { attendanceOf, photosOf } from "../../education/services/lessons.js"
import type { ApprovalStore } from "../data/store.js"
import { defineApprovalType } from "../registry.js"
import { isLocked } from "../services/locking.js"
import type { ApprovalPayloadSource } from "../services/engine.js"

/** معرّفُ النوع — يُقرأ من هنا حصراً فلا يتناثر نصّاً (مصدرُ حقيقةٍ واحد). */
export const EDUCATION_LESSON_TYPE = "education.lesson"

/** النوعُ **بيانٌ يُعلن** — وحقولُ الحراسة نوعُها الحرفيّ `true` فلا يُعطَّل حارسٌ (CR-008). */
export const EDUCATION_LESSON = defineApprovalType({
  id: EDUCATION_LESSON_TYPE,
  entityAr: "درسُ الحلقة المفرد",
  scopeKind: "unit",
  // «ش» — **ملكيةُ المعلّم لحلقته** بابُ التقديم: عملُه هو يُقدَّم لاعتماد مَن فوقه (ق-٩).
  submitCapability: "circle.teach",
  // «ف» — اعتمادُ عمل مَن تحت؛ والأقربيّةُ يحسمها المحرّك بعد القدرة (ق-١/ق-٨٥).
  approveCapability: "report.approve",
  // ق-١٢ — تدخّلٌ فوقيٌّ بقدرةٍ صريحة: مخرجُ الدرس الذي سجّله الأميرُ بنفسه فتعذّر عليه بتُّه (ق-٩).
  overrideCapability: "report.approve.override",
  // ب-٣٠ج — السحبُ **للمقدِّم** قبل البتّ، وبابُه ملكيتُه للحلقة لا قدرةٌ قيادية.
  retractCapability: "circle.teach",
  uniquePerPeriod: true,
  payloadRequired: true,
  approvalLocks: true,
  rejectionReturnsToDraft: true,
  rejectionRequiresReason: true,
})

/**
 * **مِرساةُ الطلب**: مسارُ الحلقة تحت مسار وحدتها — فيصير أميرُ المكان **أقربَ سلَفٍ بالبنية**.
 * وهو نظيرُ ما فعله ق-١٣ في اللجان: بنيةٌ تُجيب، لا حالةٌ خاصةٌ تُكتب في المحرّك.
 */
export function circleAnchorPath(circle: TeachingCircle): string {
  return `${circle.unitPath}${circle.id}/`
}

/** سطرُ حضورٍ في الحمولة — **مشتقٌّ** من سجل الدرس لا من مدخل المقدِّم (ق-٦٧). */
export type LessonAttendanceLine = {
  readonly enrollmentId: string
  readonly present: boolean
}

/**
 * مُولِّدُ الحمولة — يُحقن في سياق الطلب فيبقى المحرّكُ **عامّاً لا يعرف درساً**.
 * **وق-١٠ بنيوياً**: درسٌ لا يوجد، أو لا يخصّ هذه المِرساة ⇒ **حمولةٌ فارغة** ⇒ `EMPTY_PAYLOAD`.
 */
export function educationLessonPayloadSource(
  store: EducationStore,
  ports: EducationPorts,
): ApprovalPayloadSource {
  return (typeId, unitPath, period) => {
    void typeId
    const lesson = store.getLesson(period.id)
    if (lesson === null) return {}
    const circle = ports.circleOf(lesson.circleId)
    if (circle === null || circleAnchorPath(circle) !== unitPath) return {}

    const attendance = attendanceOf(store, lesson.id).map<LessonAttendanceLine>((a) => ({
      enrollmentId: a.enrollmentId,
      present: a.present,
    }))
    return {
      lessonId: lesson.id,
      circleId: lesson.circleId,
      circleTypeId: circle.typeId,
      unitPath: circle.unitPath,
      sessionId: lesson.sessionId,
      heldAt: lesson.heldAt.toISOString(),
      durationMinutes: lesson.durationMinutes,
      venueAr: lesson.venueAr,
      teacherPersonId: lesson.teacherPersonId,
      attendance,
      photoKeys: photosOf(store, lesson.id).map((p) => p.mediaKey),
    }
  }
}

/**
 * ق-٨٥/ق-٨ — **منفذُ حال الاعتماد**: «أهذا الدرسُ معتمَد؟».
 * جوابُه من حالة الطلب في مستودع المحرّك وحده — والسائلُ لا يرى الحالةَ ولا السلسلة،
 * فيبقى منطقُ الاعتماد في موضعه الواحد (G22، نظيرُ منفذ القفل في T10).
 */
export function educationLessonApprovalCheck(store: ApprovalStore): LessonApprovalCheck {
  return (lessonId) =>
    store
      .requests()
      .some((r) => r.typeId === EDUCATION_LESSON_TYPE && r.period.id === lessonId && isLocked(r))
}
