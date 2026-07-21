/**
 * صفحة محروسة فارغة — تُثبت أن الحراسة تعمل قبل وجود أي ميزة.
 *
 * الواجهة **لا تقرر**: تستقبل القدرات المحسوبة من الخادم وتعرض بها فقط،
 * والرسالة عند المنع تُصاغ من `ReasonCode` لا من منطق في المتصفح.
 */
import { REASON_LABELS_AR, type ReasonCode } from "../authorization/reasons.js"

export type DashboardView =
  | { readonly kind: "granted"; readonly headingAr: string; readonly emptyStateAr: string }
  | { readonly kind: "denied"; readonly messageAr: string }

export function dashboardView(decision: {
  allowed: boolean
  reason: ReasonCode
}): DashboardView {
  if (!decision.allowed) {
    // الحالة الفارغة مُشخِّصة لا شاشة بيضاء (ق-١١٢): تقول السبب ومَن يُسأل.
    return { kind: "denied", messageAr: REASON_LABELS_AR[decision.reason] }
  }
  return {
    kind: "granted",
    headingAr: "لوحة النطاق",
    emptyStateAr: "لا بيانات بعد — لم تُبنَ أي ميزة في هذه المرحلة (السياج قبل الميزات).",
  }
}
