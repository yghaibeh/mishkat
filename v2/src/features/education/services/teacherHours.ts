/**
 * **ق-٨٦ — مالية المعلّم من الدروس المعتمدة فقط**: الواجهةُ المعلنة التي تستهلكها وحدةُ
 * الرواتب لاحقاً (عقدُ الوحدة §٦). **ولا رواتبَ تُبنى هنا ولا مبلغَ يُحسب.**
 *
 * أربعةُ ثوابتٍ في هذا الاشتقاق، كلٌّ يقتل خطراً موثّقاً:
 *  ١. **المعتمَدُ وحده يُحتسب** — نصُّ القاعدة «منعاً للغش»: المسجَّلُ غيرُ المعتمَد لا يُحتسب
 *     **بلا شرطٍ ولا إعدادٍ يُرخّص**. وقد رُفع `CR-DRAFT-education-paid-hours-approved-only`
 *     لأنّ في السجل مفتاحاً يَعِد بتعطيل هذا الحارس — **ولم يُقرأ هنا** (قاعدةُ CR-008 §١-٨أ).
 *  ٢. **المناهجُ المأجورة من الإعداد لا من الكود** (قب-٦): `edu.paid_hours.curricula` —
 *     **صفر اسمِ نوعٍ في هذا الملفّ**، فرفعُ الإعداد وحده يغيّر السلوك بلا سطر كود.
 *  ٣. **لا تخضرّ عند الغموض** (قاعدةُ CR-011 مطبَّقةً على مستهلِك): الإعدادُ بعد CR-014
 *     **يشتقّ معجمَه من كتالوج الأنواع**، والتحقّقُ من العضوية **عندنا** — فنوعٌ مُدرَجٌ في
 *     الإعداد وليس في الكتالوج ⇒ رفضٌ مُشخِّص لا احتسابُ صفرٍ صامت.
 *  ٤. **دقائقُ لا نقود** (G14): لا ضربَ في سعرٍ ولا قسمةَ على ستّين — التحويلُ والمبلغُ
 *     (`finance.hourly_rate.amount`) في موطنهما.
 */

import type { EducationStore } from "../data/store.js"
import { settingList, type EducationContext } from "./context.js"
import { curriculumForCircleType } from "./curriculum.js"
import { educationErr, educationOk, type EducationResult, type Lesson } from "../types.js"

/** معرّفُ الإعداد — من السجل المركزيّ، والقيمةُ منه لا من هنا (قب-٦). */
const PAID_CURRICULA_SETTING = "edu.paid_hours.curricula"

/** سطرُ حِمْلٍ لحلقةٍ واحدة — **بلا مبلغٍ ولا سعرٍ ولا راتب** (حدُّ الوحدة). */
export type TeachingLoadLine = {
  readonly circleId: string
  readonly circleTypeId: string
  readonly curriculumId: string
  readonly lessonCount: number
  readonly minutes: number
  readonly lessonIds: readonly string[]
}

export type TeachingLoad = {
  readonly teacherPersonId: string
  readonly from: Date
  readonly to: Date
  readonly lines: readonly TeachingLoadLine[]
  readonly totalLessonCount: number
  readonly totalMinutes: number
}

export type TeachingLoadInput = {
  readonly teacherPersonId: string
  /** نافذةٌ صريحة `[from, to)` — لا «الشهر الحالي» ضمنياً. */
  readonly from: Date
  readonly to: Date
}

/**
 * **الواجهةُ المعلنة لمالية المعلّم** — تُستهلَك من وحدة الرواتب حين تُبنى، ولا تعرف عنها
 * هذه الوحدةُ شيئاً. والنطاقُ الذي يُقرأ به الإعدادُ هو **الجذر**: بندٌ عالميٌّ في السجل.
 */
export function approvedTeachingLoad(
  store: EducationStore,
  ctx: EducationContext,
  input: TeachingLoadInput,
): EducationResult<TeachingLoad> {
  const paidTypeIds = settingList(ctx, PAID_CURRICULA_SETTING, "/")
  const known = new Set(ctx.circleTypeIds())
  const stray = paidTypeIds.find((id) => !known.has(id))
  if (stray !== undefined) return educationErr("UNKNOWN_PAID_CURRICULUM", stray)
  const paid = new Set(paidTypeIds)

  const byCircle = new Map<string, { typeId: string; curriculumId: string; lessons: Lesson[] }>()
  for (const lesson of store.lessons()) {
    if (lesson.teacherPersonId !== input.teacherPersonId) continue
    // **الاعتمادُ شرطٌ غيرُ مشروط** — لا إعدادَ يُرخّص تجاوزَه (ق-٨٦ «منعاً للغش»).
    if (!ctx.isLessonApproved(lesson.id)) continue
    if (lesson.heldAt.getTime() < input.from.getTime()) continue
    if (lesson.heldAt.getTime() >= input.to.getTime()) continue

    const circle = ctx.circleOf(lesson.circleId)
    if (circle === null) continue
    if (!paid.has(circle.typeId)) continue
    const curriculum = curriculumForCircleType(store, circle.typeId)
    if (curriculum === null) continue

    const bucket = byCircle.get(circle.id)
    if (bucket === undefined) {
      byCircle.set(circle.id, { typeId: circle.typeId, curriculumId: curriculum.id, lessons: [lesson] })
    } else {
      bucket.lessons.push(lesson)
    }
  }

  const lines = [...byCircle.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map<TeachingLoadLine>(([circleId, bucket]) => {
      const ordered = [...bucket.lessons].sort((a, b) => a.id.localeCompare(b.id))
      return {
        circleId,
        circleTypeId: bucket.typeId,
        curriculumId: bucket.curriculumId,
        lessonCount: ordered.length,
        minutes: ordered.reduce((sum, l) => sum + l.durationMinutes, 0),
        lessonIds: ordered.map((l) => l.id),
      }
    })

  return educationOk({
    teacherPersonId: input.teacherPersonId,
    from: input.from,
    to: input.to,
    lines,
    totalLessonCount: lines.reduce((sum, l) => sum + l.lessonCount, 0),
    totalMinutes: lines.reduce((sum, l) => sum + l.minutes, 0),
  })
}
