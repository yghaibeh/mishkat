/**
 * ق-٥١ — **خطةُ رواتب الشهر: نوعُ اعتمادٍ مسجَّلٌ في المحرّك** (عقدُ الرواتب §٣، `PARALLEL_WORK` §٨).
 *
 * «البرنامج يرشّح **والإدارة تقرّ آخر الشهر**» صار **سطرَ إعلانٍ** لا وحدةَ منطقٍ ثانية.
 * ولذلك **لم يُكتب سطرُ اعتمادٍ واحدٌ في وحدة الرواتب**: هذا الملفّ يعيش في مجلد المحرّك،
 * ويستهلك من الرواتب **دالّةَ اشتقاقٍ قائمة** لا مفاهيمَ اعتماد.
 *
 * **وهنا يقع الختمُ الذي يقوم عليه المبدأ الحاكم** (عقدُ الرواتب §٢-٣): الحمولةُ **تُشتقّ**
 * لحظةَ التقديم وتُجمَّد عميقاً (`deepFreeze` في `shared.ts`)، ثم **يقفلها** الاعتماد (ق-٨).
 * فالسطرُ المدفوعُ **واقعةٌ محفوظةٌ مع مدخلات اشتقاقها** — كم درساً وأيُّها وكم نقطةً وبأيّ
 * معدّل — **بلا مستودعٍ ثانٍ ولا عدّادٍ مخزَّن في وحدة الرواتب**. وهو وجهُ الالتقاء بين
 * ق-٥٢ («لا استحقاقَ يُكتب باليد») وق-٥١ («والإدارةُ تقرّ»): **يُشتقّ حتى يُقرّ، ثم يُختَم**.
 *
 * وثلاثةُ بنودٍ يعيش كلٌّ منها هنا **لأن مكانَه الطبيعيَّ هنا لا لأن بوابةً تمنعه هناك**:
 * تعريفُ النوع (قدرةُ بتٍّ — G22)، ومُولِّدُ الحمولة (الختمُ فعلُ المحرّك)، ومنفذُ
 * **«مَن يصرف لمن لا مسجدَ له»** (ق-٦٥) — فجوابُه توجيهُ NESSA، وموطنُه هذا المجلد.
 */

import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import type { Cents } from "../../ledger/types.js"
import { derivePlan, type DeriveInput } from "../../payroll/services/derive.js"
import type { PayrollStores } from "../../payroll/data/store.js"
import type { PayrollContext } from "../../payroll/services/context.js"
import type { PayingUnitPort, SealPort } from "../../payroll/services/ports.js"
import type { EntitlementPlan, PlanStage } from "../../payroll/types.js"
import { defineApprovalType } from "../registry.js"
import type { ApprovalStore } from "../data/store.js"
import { approvalType } from "../registry.js"
import { isLocked } from "../services/locking.js"
import { ancestorsOf, candidatesAt, type RoutingContext } from "../services/routing.js"
import type { ApprovalPayloadSource } from "../services/engine.js"

/** النوعُ **بيانٌ يُعلن**: كيانُه وقدرتاه وشرطا تقديمه وأثرا بتّه (عقدُ المحرّك §٧). */
export const PAYROLL_PLAN = defineApprovalType({
  id: "payroll.plan",
  entityAr: "خطةُ رواتب الشهر",
  scopeKind: "unit",
  // «ذ» — الوحدةُ بعينها تُقدّم خطتَها، فلا يقدّم مشرفٌ عن وحدةٍ تحته (ق-٩).
  submitCapability: "payroll.run",
  // «ف» — إقرارُ الإدارة آخرَ الشهر (ق-٥١)؛ والأقربيّةُ يحسمها المحرّك بعد القدرة (ق-١).
  approveCapability: "payroll.approve",
  // لا تدخّلَ فوقياً ولا سحبَ لخطة الرواتب: لا قدرةَ لهما في الكتالوج ⇒ **لا مسارَ أصلاً**.
  // (والسحبُ بعد التقديم في المال بابُ التباسٍ لا حاجة: الرفضُ بسببٍ يعيدها مسودةً — ق-٧.)
  overrideCapability: null,
  retractCapability: null,
  uniquePerPeriod: true,
  payloadRequired: true,
  approvalLocks: true,
  rejectionReturnsToDraft: true,
  rejectionRequiresReason: true,
})

/**
 * قدرةُ **الأمانة** (ق-٥٩) — بها يُعرَف «أمينُ الوحدة»، وهي نفسُها التي يقيس بها الصندوقُ
 * أمينَه: **مصدرُ قياسٍ واحد لا اثنان** (المادة ١/٢). وليست قدرةَ بتٍّ فلا تمسّها G22.
 */
const CUSTODY_CAPABILITY: CapId = "box.receive"

/**
 * مُولِّدُ حمولة خطة الشهر — **يُحقن في سياق الطلب فيبقى المحرّكُ عامّاً لا يعرف راتباً**.
 * والحمولةُ **مشتقّةٌ من مصدرها** لا من مدخل المقدِّم (ق-٦٧ معمَّمة): المقدِّمُ يقول «قدِّم
 * شهر كذا» **ولا يمرّر مبلغاً واحداً** — وهو الوجهُ البنيويُّ لق-٥٢.
 */
export function payrollPlanPayloadSource(
  stores: PayrollStores,
  ctx: PayrollContext,
  window: { readonly from: Date; readonly to: Date; readonly personIds: readonly string[] },
): ApprovalPayloadSource {
  return (typeId, unitPath, period) => {
    void typeId
    const input: DeriveInput = {
      unitPath,
      periodId: period.id,
      from: window.from,
      to: window.to,
      personIds: window.personIds,
    }
    return { plan: derivePlan(stores, ctx, input) }
  }
}

/**
 * **قراءةُ الختم** — تحويلُ حمولةٍ مجمَّدةٍ إلى خطةٍ مطبوعة. والقراءةُ **دفاعيّة**: حمولةٌ
 * مختلّةُ الشكل تُعيد `null` فيُرفض الصرفُ بـ`PLAN_NOT_SEALED`، **ولا تنهار الشاشة**.
 * (وهو الموضعُ الوحيدُ الذي يعبر فيه الختمُ حدَّ الأنواع — فحُصر في سطرٍ واحدٍ محروس.)
 */
function readSealedPlan(payload: Readonly<Record<string, unknown>>): EntitlementPlan | null {
  const plan = payload["plan"]
  if (plan === null || typeof plan !== "object") return null
  const candidate = plan as Partial<EntitlementPlan>
  if (typeof candidate.periodId !== "string") return null
  if (!Array.isArray(candidate.lines)) return null
  if (typeof candidate.totalNetCents !== "number") return null
  return plan as EntitlementPlan
}

/**
 * **منفذُ الختم** موصولاً بالمحرّك: «أمختومةٌ خطةُ هذا الشهر؟ وما مدخلاتُها؟».
 * ووحدةُ الرواتب **لا تعرف مَن ختم ولا بأيّ سلسلة** — تسأل عن **حالٍ** (G22).
 */
export function payrollSealFrom(store: ApprovalStore): SealPort {
  return (unitPath, periodId) => {
    const request = store.findByKey(PAYROLL_PLAN.id, unitPath, periodId)
    if (request === null) return { stage: "derived", plan: null }
    // القفلُ **حالٌ يُقرأ بدالةِ المحرّك الواحدة** (ق-٨) — لا مقارنةَ حالةٍ منسوخةٍ هنا.
    const stage: PlanStage = isLocked(request) ? "sealed" : "pending"
    return { stage, plan: stage === "sealed" ? readSealedPlan(request.payload) : null }
  }
}

/**
 * ق-٦٥ — **«مَن لا مسجدَ له يصرف له أمينُ أقرب وحدةٍ مالكة»**: استهلاكٌ لمحرّك التوجيه
 * القائم **بلا سطرِ NESSA واحدٍ يُعاد كتابتُه**.
 *
 * والترتيبُ مقصود: **الوحدةُ نفسُها أولاً** — فمن له مسجدٌ ذو أمينٍ يصرف له أمينُه، وهو
 * الطريقُ العاديّ. فإن خلت ⇒ **صعودٌ في الأسلاف** بترتيب المحرّك نفسِه (`ancestorsOf`:
 * من الأعمق إلى الجذر) فيقع على **أوّل سلَفٍ فيه أمينٌ نشط**. وخلوُّ السلسلة كلِّها ⇒ `null`
 * ⇒ **رفضٌ يُقفل ولا يُفتح** — لا «الإدارة» ضمناً ولا صرفٌ من فراغ (ق-٣: كسرُ الزجاج بابٌ آخر).
 *
 * > **ودقّةٌ كلّفت اختباراً أحمرَ قبل سطرِ الكود**: `box.receive` نوعُ نطاقها **«ذ» (مطابقةٌ
 * > تامّة)** — وهو المقصودُ في ق-٥٩: مشرفُ القسم أمينُ صندوق **قسمه** ولا يهبط أميناً لصندوق
 * > مسجدٍ تحته. فلا يصحّ أن نسأل «أيملك السلَفُ الأمانةَ **على وحدة المستحق**؟» — الجوابُ
 * > «لا» أبداً، فتُصبح السلسلةُ كلُّها شاغرةً وهماً. **السؤالُ الصحيح**: «أفي هذا السلَفِ
 * > أمينٌ **لصندوقه هو**؟» — فمن لا وحدةَ له يصرف له أمينُ أقرب وحدةٍ مالكة **من صندوقها**،
 * > وهو نصُّ ق-٦٥ حرفياً. **ولذلك يُسأل كلُّ مسارٍ عن نفسه** لا عن مسار المستحق.
 */
export function payingUnitFrom(routing: RoutingContext): PayingUnitPort {
  return (unitPath) => {
    for (const path of [unitPath, ...ancestorsOf(unitPath)]) {
      if (candidatesAt(routing, CUSTODY_CAPABILITY, path, path).length > 0) return path
    }
    return null
  }
}

/** المجموعُ المختومُ لمنطقةٍ — تحتاجه دفعةُ التوزيع (ق-٦٦) وتقرؤه من الختم لا من عدّاد. */
export function sealedTotalOf(seal: SealPort, unitPath: string, periodId: string): Cents {
  const sealed = seal(unitPath, periodId)
  return (sealed.plan?.totalNetCents ?? 0) as Cents
}

/** هل النوعُ مسجَّلٌ فعلاً؟ — يستعمله اختبارُ التسجيل، ولا يُسرد اسمُه في بوابةٍ (CR-011). */
export function payrollPlanRegistered(): boolean {
  return approvalType(PAYROLL_PLAN.id) !== null
}
