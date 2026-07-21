/**
 * ق-٥ — **السجلُّ الأسبوعيُّ للمسجد: نوعُ اعتمادٍ مسجَّلٌ في المحرّك** (عقدُ الوحدة §٠/§٧).
 *
 * هنا تُنجَز عدةُ ما وعد به عقدُ المحرّك نصاً: «يومَ تُسجَّل وحدةُ السجلّ الأسبوعيّ في مهمّتها
 * يصير تسجيلُها **سطرَ بيانٍ** لا وحدةَ منطق». ولذلك **لم يُمسّ سطرٌ واحدٌ في خدمات المحرّك
 * ولا في مستودعه ولا في سطوحه القائمة**: هذا ملفٌّ جديدٌ في موضع التسجيل المُعلَن، ويستهلك
 * من وحدة سجل اليوم **دوالَّ قراءةٍ قائمة** لا مفاهيمَ اعتماد.
 *
 * وفيه ثلاثةُ أدوارٍ لا رابعَ لها:
 *  ١. **النوع** (`WEEKLY_RECORD`): كيانُه وقدراتُه وشرطا تقديمه وأثرا بتّه — بياناً يُعلن.
 *  ٢. **مُولِّدُ الحمولة**: التقريرُ **يُشتقّ من قيود اليوم** ولا يُدخله المقدِّم؛ وحصيلةٌ
 *     صفريةٌ ⇒ **حمولةٌ فارغة** ⇒ `EMPTY_PAYLOAD` — وهو **ق-١٠ بنيوياً** لا زرّاً يُخفى.
 *  ٣. **منفذُ القفل**: يجيب وحدةَ سجل اليوم عن «أهذه الفترةُ مقفلةٌ للكتابة؟» (ق-٨) —
 *     فتعرف تلك الوحدةُ الحالَ ولا تعرف السلسلةَ، ويبقى منطقُ الاعتماد في موضعه الواحد (G22).
 */

import { entriesOfPeriod } from "../../dailyLog/services/entries.js"
import type { DailyLogStore } from "../../dailyLog/data/store.js"
import type { PeriodLockCheck } from "../../dailyLog/services/context.js"
import type { ApprovalStore } from "../data/store.js"
import { defineApprovalType } from "../registry.js"
import { isLocked } from "../services/locking.js"
import type { ApprovalPayloadSource } from "../services/engine.js"

/** النوعُ **بيانٌ يُعلن** — وحقولُ الحراسة نوعُها الحرفيّ `true` فلا يُعطَّل حارسٌ (CR-008). */
export const WEEKLY_RECORD = defineApprovalType({
  id: "weekly.record",
  entityAr: "السجلُّ الأسبوعيُّ للمسجد",
  scopeKind: "unit",
  // «ذ» — الوحدةُ بعينها تقدّم سجلَّها: إقرارُ الأمير هو التقديم (ق-٥ · ب-٣٠أ).
  submitCapability: "report.submit",
  // «ف» — عملُ مَن تحت؛ والأقربيّةُ يحسمها المحرّك بعد القدرة (ق-١).
  approveCapability: "report.approve",
  // ق-١٢: تدخّلٌ فوقيٌّ بقدرةٍ صريحة — والإدارةُ ممنوعةٌ منه **من المصفوفة** لا بفرعٍ هنا.
  overrideCapability: "report.approve.override",
  // ب-٣٠ج: للأمير سحبُ إقراره قبل اعتماد الطبقة.
  retractCapability: "report.retract",
  uniquePerPeriod: true,
  payloadRequired: true,
  approvalLocks: true,
  rejectionReturnsToDraft: true,
  rejectionRequiresReason: true,
})

/** سطرُ نشاطٍ في حمولة السجل — **أرقامٌ مخزَّنةٌ تُنقل** لا تُعاد حسابُها (ق-٤١). */
export type WeeklyRecordActivityLine = {
  readonly activityId: string
  readonly count: number
  readonly points: number
}

/** ب-٤٢ — النشاطُ الحرُّ **يظهر لمعتمِد السجل** بصفر نقاطه ليقرّر فيه. */
export type WeeklyRecordFreeLine = {
  readonly textAr: string
  readonly count: number
}

/**
 * مُولِّدُ الحمولة — يُحقن في سياق الطلب فيبقى المحرّكُ **عامّاً لا يعرف سجلَّ يوم**.
 * والجمعُ **من `points` المخزَّنة في القيود** (ق-٤١): فأهليةُ كل قيدٍ حُسمت يوم إدخاله،
 * وتغييرُ وزنٍ أو معدّلٍ بعده لا يُعيد كتابةَ ما مضى.
 */
export function weeklyRecordPayloadSource(store: DailyLogStore): ApprovalPayloadSource {
  return (typeId, unitPath, period) => {
    const entries = entriesOfPeriod(store, unitPath, period.id)
    // **ق-١٠ بنيوياً**: لا حصيلةَ ⇒ لا حمولةَ ⇒ لا تقديم — في الخادم لا في الواجهة.
    if (entries.length === 0) return {}

    const activities: WeeklyRecordActivityLine[] = []
    const free: WeeklyRecordFreeLine[] = []
    let points = 0
    for (const e of entries) {
      points += e.points
      if (e.activityId === null) free.push({ textAr: e.freeTextAr ?? "", count: e.count })
      else activities.push({ activityId: e.activityId, count: e.creditedCount, points: e.points })
    }

    void typeId
    return { unitPath, periodId: period.id, points, activities, free }
  }
}

/**
 * ق-٨ — **منفذُ القفل**: «أهذه الفترةُ مقفلةٌ للكتابة على هذه الوحدة؟».
 * جوابُه من حالة الطلب في مستودع المحرّك وحده — والسائلُ لا يرى الحالةَ ولا السلسلة.
 */
export function weeklyRecordLockCheck(store: ApprovalStore): PeriodLockCheck {
  return (unitPath, periodKey) => {
    const request = store.findByKey(WEEKLY_RECORD.id, unitPath, periodKey)
    return request !== null && isLocked(request)
  }
}
