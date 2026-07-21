/**
 * شجرةُ العرض المقيسة — **الشاشة البرهانية نفسها** لا شاشةٌ جديدة (مهمة T6 §٢).
 *
 * المرشّحان يستهلكان هذا الملف بعينه، فلا يقاس فرقٌ في المحتوى بل فرقُ **الإطار** وحده.
 * المصدر: `src/features/home/screens/screens.ts` (رئيسية أمير المسجد) بقدرات الدور
 * المولَّدة من المصفوفة الذهبية — لا قائمةَ قدراتٍ ثانية هنا.
 */

import { amirHomeScreen, type AmirHomeSnapshot } from "../../src/features/home/screens/screens.js"
import { ROLE_CAPABILITIES } from "../../src/authorization/generated/roles.generated.js"
import { formatNumber } from "../../src/ui/text/format.js"
import type { UiNode } from "../../src/ui/components/kernel.js"

/**
 * لقطةٌ **مملوءة** لا فارغة: الصفحة الفارغة تخفي حمولة النصّ الحقيقية.
 * القيم مُختلَقةٌ للقياس فقط (لا بيانات إنتاج) ومنسّقةٌ بطبقة النصوص نفسها.
 */
export const MEASURED_SNAPSHOT: AmirHomeSnapshot = Object.freeze({
  mosqueLabelAr: "مسجد النور — المربع الأول",
  scopePath: "/men/r1/sq1/m1/",
  weekPointsAr: formatNumber(58),
  weekRemainingAr: formatNumber(12),
  circlesCountAr: formatNumber(4),
  committeesCountAr: formatNumber(3),
  pendingApprovalsAr: formatNumber(2),
  todayLogEntered: false,
  boxBalance: { amount: 1250000, currencyCode: "SYP", fractionDigits: 0 },
})

/** شجرةُ رئيسية الأمير كما يراها الدور `amir` — نقطةُ الدخول الوحيدة للمرشّحَين. */
export function proofScreenTree(): UiNode {
  return amirHomeScreen(ROLE_CAPABILITIES.amir, MEASURED_SNAPSHOT)
}
