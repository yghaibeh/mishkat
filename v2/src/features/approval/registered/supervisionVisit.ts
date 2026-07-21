/**
 * ق-١٦ — **الزيارةُ الإشرافية: نوعُ اعتمادٍ مسجَّلٌ في المحرّك** (عقدُ المحرّك §٠/§٧، قب-٣٣).
 *
 * موضعُ هذا الملفّ **نقطةُ التمديد المعلَنة** (`PARALLEL_WORK` §٣/§٨): النوعُ يُعرَّف هنا لا
 * في وحدة الميزة — لأنّ إعلانَه يحمل **قدرةَ الاعتماد** (`visit.approve`)، وهي مفردةُ اعتمادٍ
 * لا تُكتب خارج مجلد المحرّك (G22). ولذلك **لم يُمسّ سطرٌ واحدٌ** في `services/` ولا `data/`
 * ولا `registry.ts`: أُضيف ملفّان لا غير — هذا وسطوحُه.
 *
 * وفيه ثلاثةُ أدوارٍ لا رابعَ لها:
 *  ١. **النوع** (`SUPERVISION_VISIT`): كيانُه وقدراتُه وشرطا تقديمه وأثرا بتّه — بياناً يُعلن.
 *  ٢. **مُولِّدُ الحمولة**: تقريرُ الزيارة **يُشتقّ من الزيارة المسجَّلة** ولا يُدخله المقدِّم؛
 *     وزيارةٌ لا وجود لها ⇒ **حمولةٌ فارغة** ⇒ `EMPTY_PAYLOAD` — فلا اعتمادَ على فراغ.
 *  ٣. **منفذُ الحُكم**: يجيب وحدةَ الإشراف عن «أمعتمَدةٌ هذه الزيارة ومَن اعتمدها؟» (ق-١٠٢) —
 *     فتعرف تلك الوحدةُ **الحُكمَ** ولا تعرف السلسلةَ، ويبقى منطقُ الاعتماد في موضعه الواحد.
 *
 * **ولمَ كانت المرساةُ وحدةَ الزائر؟** لأن ق-١٦ نصّت أن الزيارة «تظهر عند الأقرب **فوقه**»:
 * فلو رُفعت بمسار الحلقة المزورة لَصار «الأقربُ فوقها» أميرَ المسجد — وهو ليس مشرفاً على مَن
 * زار. المرساةُ تأتي من الزيارة نفسِها (`supervisorPath`) وقد اشتُقّت يوم تسجيلها.
 */

import type { SupervisionStore } from "../../supervision/data/store.js"
import type {
  SupervisionVisit,
  VisitVerdict,
} from "../../supervision/types.js"
import type { VisitVerdictLookup } from "../../supervision/services/context.js"
import type { ApprovalStore } from "../data/store.js"
import { defineApprovalType } from "../registry.js"
import type { ApprovalPayloadSource } from "../services/engine.js"
import type { ApprovalPeriod } from "../types.js"

/** النوعُ **بيانٌ يُعلن** — وحقولُ الحراسة نوعُها الحرفيّ `true` فلا يُعطَّل حارسٌ (CR-008). */
export const SUPERVISION_VISIT = defineApprovalType({
  id: "supervision.visit",
  entityAr: "الزيارةُ الإشرافية",
  scopeKind: "unit",
  // «و» — مَن زار يرفع زيارتَه عن وحدته (ق-١٦).
  submitCapability: "visit.conduct",
  // «ف» — عملُ مَن تحت؛ والأقربيّةُ يحسمها المحرّك بعد القدرة (ق-١).
  approveCapability: "visit.approve",
  // **لا تدخّلَ فوقيَّ معلنٌ للزيارة**: عدساتُ الأدوار لا تمنحه، وما لم يُعلَن لا يُمارَس (ق-١٢).
  overrideCapability: null,
  // **ولا سحبَ**: الزيارةُ شهادةُ ميدانٍ وقعت — تُرفض بسببٍ ولا تُسحب (ق-٧).
  retractCapability: null,
  uniquePerPeriod: true,
  payloadRequired: true,
  approvalLocks: true,
  rejectionReturnsToDraft: true,
  rejectionRequiresReason: true,
})

/**
 * **فترةُ الزيارة هي الزيارةُ نفسُها**: مفتاحُ المحرّك `(النوع، الوحدة، الفترة)` فيصير
 * لكل زيارةٍ طلبٌ واحدٌ لا يتكرّر (ق-٦٧ مطبَّقةً على كيانٍ لا على شهر)، ونهايتُها **يومُ
 * وقوعها** فيسري عليها القفلُ الزمنيّ (ب-٣٩د) بلا استثناءٍ مكتوب.
 */
export function supervisionVisitPeriodOf(visit: SupervisionVisit): ApprovalPeriod {
  return { id: visit.id, endsAt: visit.visitedAt }
}

/**
 * مُولِّدُ الحمولة — يُحقن في سياق الطلب فيبقى المحرّكُ **عامّاً لا يعرف زيارةً**.
 * والتقريرُ **يُشتقّ** من الزيارة المخزَّنة: فما يعتمده الأقربُ هو ما رآه الزائرُ وسجّله،
 * لا نصٌّ يُكتب ثانيةً عند الرفع.
 */
export function supervisionVisitPayloadSource(store: SupervisionStore): ApprovalPayloadSource {
  return (typeId, unitPath, period) => {
    const visit = store.getVisit(period.id)
    // زيارةٌ لا وجود لها — أو رُفعت من وحدةٍ ليست مرساتَها ⇒ لا حمولةَ ⇒ لا تقديم.
    if (visit === null || visit.supervisorPath !== unitPath) return {}

    void typeId
    return {
      visitId: visit.id,
      unitPath,
      targetPath: visit.targetPath,
      curriculum: visit.curriculum,
      dayKey: visit.dayKey,
      visitedBy: visit.byPersonId,
      core: visit.core,
      details: visit.details,
    }
  }
}

/** لا حكمَ لزيارةٍ لم تُرفع أو لم تُبتّ — ولا اسمَ معتمِدٍ يُخترع (ق-١٠٢). */
const PENDING: VisitVerdict = Object.freeze({ approved: false, approvedByPersonId: null })

/**
 * ق-١٠٢ — **منفذُ الحُكم**: «أمعتمَدةٌ هذه الزيارة ومَن اعتمدها؟».
 * جوابُه من حالة الطلب في مستودع المحرّك وحده — والسائلُ لا يرى الحالةَ ولا السلسلة،
 * فيستحيل أن يُعرض معتمَدٌ بلا اسم معتمِده أو أن يُكتب الاسمُ في مكانين.
 */
export function supervisionVisitVerdict(store: ApprovalStore): VisitVerdictLookup {
  return (visitId) => {
    const request = store
      .requests()
      .find((r) => r.typeId === SUPERVISION_VISIT.id && r.period.id === visitId)
    if (request === undefined || request.state !== "approved") return PENDING
    return { approved: true, approvedByPersonId: request.approvedBy }
  }
}
