/**
 * ق-١٠٠ — **النموذجُ مطبوعٌ بحقول النوع** (عقدُ الوحدة §٢).
 *
 * جدولٌ واحدٌ **بياناً**: لكل منهاجٍ حقولُه، والمطابقةُ **تامّةُ الطرفين** (لا ناقصَ ولا زائد).
 * فنوعٌ ثالثٌ يوماً **صفٌّ يُضاف** لا `if` يُكتب — وهذا هو الفرق بين نموذجٍ مُصلَّبٍ في الكود
 * ونموذجٍ يعرف نفسَه.
 *
 * والخطأُ الذي يقتله هذا الحارس موثّقٌ من الميدان: نموذجٌ يُخزَّن بحقولٍ من نوعٍ آخر فيُقرأ
 * **فارغاً** في التقرير — «أدخلتُ ولم يظهر» (ع-١٢). الحلُّ الجذريّ: **لا يُخزَّن أصلاً.**
 */

import type { VisitCurriculum, VisitDetails } from "../types.js"

/** حقولُ كل منهاجٍ — مصدرُ الحقيقة الوحيد للنموذج، ومنه تُبنى الشاشةُ ويُفحص المدخل. */
export const VISIT_FORM_FIELDS: Readonly<Record<VisitCurriculum, readonly string[]>> = Object.freeze(
  {
    // نموذجُ زيارة حلقة التحفيظ الورقيّ (الوثيقة ٢٤) — حقلاً بحقل.
    tahfeez: Object.freeze([
      "quranPlan",
      "teacherMemorization",
      "tajweed",
      "records",
      "ethics",
      "attendanceDiscipline",
    ]),
    // ونموذجُ «على بصيرة» — حقولٌ أخرى لموضوعٍ آخر، لا نسخةٌ منقوصةٌ من الأول.
    baseera: Object.freeze(["lessonNumber", "recentActivities", "attendanceCount"]),
  },
)

export const VISIT_CURRICULA: readonly VisitCurriculum[] = Object.freeze(
  Object.keys(VISIT_FORM_FIELDS) as VisitCurriculum[],
)

/**
 * أتطابق حقولُ المدخل حقولَ النوع **تماماً**؟ — الطرفان معاً: كلُّ حقلٍ مطلوبٍ موجود،
 * ولا حقلَ خارج العقد.
 */
export function matchesForm(curriculum: VisitCurriculum, details: VisitDetails): boolean {
  const expected = VISIT_FORM_FIELDS[curriculum]
  const given = Object.keys(details)
  if (given.length !== expected.length) return false
  return expected.every((field) => Object.prototype.hasOwnProperty.call(details, field))
}
