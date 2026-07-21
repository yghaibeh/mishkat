/**
 * ق-١٣ — **أنشطةُ اللجنة تدخل سجلَّ المسجد: نوعُ اعتمادٍ مسجَّلٌ في المحرّك**.
 *
 * القاعدةُ مدفوعةُ الثمن نصاً: «مسؤولُ اللجنة يُدخل أنشطة لجنته فتدخل سجلَّ المسجد **مسودةً
 * بانتظار إقرار الأمير**؛ لا تُحتسب نقاطُها إلا بعد إقراره». وخطأُ v1 المكلف الذي أنتج
 * القاعدةَ حارساً: نقاطُ اللجان **ما كانت ستُحتسب أبداً** (`shuraConfirmed=false` للأبد).
 *
 * **لماذا يعيش هذا الملفُّ في مجلد المحرّك لا في وحدة اللجان؟** لأنه **يستهلك قدرةَ اعتماد**
 * (`report.approve` وأختَيها)، و**بوابة G22** تحصر استهلاكَ قدرات السلسلة في المحرّك وحده —
 * فوضعُه هنا هو ما يُبقي وحدةَ اللجان **صفرَ منطقِ اعتماد**. (وهذا يخالف حرفَ `PARALLEL_WORK`
 * §٣ «ونوعُ الاعتماد نفسُه يُعرَّف داخل وحدتك» ⟵ **رُفع CR-011** والقرارُ لصاحبه؛ والدستور
 * أعلى من نصّ المهمة حتى يُبتّ.)
 *
 * **والأميرُ أقربُ سلَفٍ بالبنية لا بحالةٍ خاصة**: مسارُ اللجنة يُبنى **تحت مسار مسجدها**
 * (`committees/services/committees.ts`)، فيُجيب `approverLayerFor` بأميره أولاً — وشغورُه
 * يصعد للمربع تلقائياً (ق-٢) بلا سطرِ تصعيد. **صفر اسمِ دورٍ هنا** (G6).
 */

import type { CommitteeStore } from "../../committees/data/store.js"
import { activitiesOf } from "../../committees/services/activities.js"
import type { ApprovalStore } from "../data/store.js"
import { defineApprovalType } from "../registry.js"
import type { ApprovalPayloadSource } from "../services/engine.js"

/** معرّفُ النوع — يُقرأ من هنا حصراً فلا يتناثر نصّاً (مصدرُ حقيقةٍ واحد). */
export const COMMITTEE_ACTIVITY_TYPE = "committee.activity"

/** النوعُ **بيانٌ يُعلن**: كيانُه وقدراتُه وشرطا تقديمه وأثرا بتّه (عقدُ المحرّك §٧). */
export const COMMITTEE_ACTIVITY = defineApprovalType({
  id: COMMITTEE_ACTIVITY_TYPE,
  entityAr: "أنشطةُ اللجنة في سجل المسجد",
  scopeKind: "unit",
  // «ش» — **ملكيةُ اللجنة** هي بابُ التقديم: مسؤولُها وحده يقدّم عملَها (ق-١٣، ك-٢٣).
  submitCapability: "committee.own",
  // «ف» — إقرارُ عمل مَن تحت؛ والأقربيّةُ يحسمها المحرّك بعد القدرة (ق-١، عدسةُ الأمير §٢.٥ بابُه ٣).
  approveCapability: "report.approve",
  // ق-١٢ — تدخّلٌ فوقيٌّ بقدرةٍ صريحةٍ عند تعذّر الأقرب (لرأس القسم والمنطقة، لا للإدارة).
  overrideCapability: "report.approve.override",
  // ب-٣٠ج — السحبُ **للمقدِّم** قبل البتّ، وبابُه ملكيتُه للجنة لا قدرةٌ قيادية.
  retractCapability: "committee.own",
  uniquePerPeriod: true,
  payloadRequired: true,
  approvalLocks: true,
  rejectionReturnsToDraft: true,
  rejectionRequiresReason: true,
})

/** سطرُ نشاطٍ في الحمولة — **مشتقٌّ** من سجل اللجنة لا من مدخل المقدِّم. */
export type CommitteeActivityLine = {
  readonly id: string
  readonly titleAr: string
  readonly participantCount: number
  readonly completedAt: string
}

/**
 * مُولِّدُ الحمولة — يُحقن في سياق الطلب فيبقى المحرّكُ **عامّاً لا يعرف لجنةً**.
 * ومسارُ اللجنة هو مفتاحُ الوصل: منه تُستخرج اللجنةُ فتُقرأ أنشطةُ فترتها.
 */
export function committeeActivityPayloadSource(store: CommitteeStore): ApprovalPayloadSource {
  return (typeId, unitPath, period) => {
    void typeId
    const committee = store.committees().find((c) => c.path === unitPath)
    if (committee === undefined) return {}
    const activities = activitiesOf(store, committee.id, period.id)
    // ق-١٠: لا تقديمَ على فراغ — لجنةٌ بلا نشاطٍ في الفترة حمولتُها فارغةٌ فيردّها المحرّك.
    if (activities.length === 0) return {}
    const lines: CommitteeActivityLine[] = activities.map((a) => ({
      id: a.id,
      titleAr: a.titleAr,
      participantCount: a.participantCount,
      completedAt: a.completedAt.toISOString(),
    }))
    return {
      committeeId: committee.id,
      mosquePath: committee.mosquePath,
      periodId: period.id,
      activityCount: lines.length,
      participantCount: lines.reduce((sum, l) => sum + l.participantCount, 0),
      lines,
    }
  }
}

/**
 * **جسرُ ق-١٣ إلى سجل المسجد**: أيُّ اللجان أُقرّ عملُها في هذه الفترة؟
 *
 * تُقرأ الإجابةُ من **حالة الطلب في مستودع المحرّك** — فلا حقلَ «مُقرّ» في كيان اللجنة ولا
 * حالةَ اعتمادٍ خارج المحرّك (G22)؛ ووحدةُ اللجان تستقبل هذه المجموعةَ **مُعطىً** وتشتقّ
 * مساهمتَها منها، فلا تعرف ما معنى «أُقرّ» ولا مَن يُقرّ.
 */
export function confirmedCommitteeIds(store: ApprovalStore, periodId: string): ReadonlySet<string> {
  const out = new Set<string>()
  for (const request of store.requests()) {
    if (request.typeId !== COMMITTEE_ACTIVITY_TYPE) continue
    if (request.state !== "approved") continue
    if (request.period.id !== periodId) continue
    const committeeId = request.payload.committeeId
    if (typeof committeeId === "string") out.add(committeeId)
  }
  return out
}
