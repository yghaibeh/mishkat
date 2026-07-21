/**
 * ق-٩٩ — **دورةُ الزيارة إعدادٌ حيّ، والتصنيفُ مشتقٌّ عند القراءة** (عقدُ الوحدة §١).
 *
 * «المطلوب إضافة أعمالٍ للمشرف عندنا وليس مجرد اعتماد» (المالك نصاً): فهذه الدالةُ هي **عملُه
 * الميدانيّ** مقروءاً — مَن يستحقّ زيارةً الآن ومنذ متى أُهمل. وثلاثةُ ثوابتٍ فيها:
 *  ١. **لا رقمَ صلب** (G14/قب-٦): الدورةُ من `supervision.visit_cadence_days`، **وطولُ اليوم
 *     نفسُه يُشتقّ من مرساتَي مفتاحَي يومٍ متتاليين** لا من ثابتٍ زمنيّ مكتوب.
 *  ٢. **التصنيفُ لا يُخزَّن**: يُحسب عند كل قراءة، فضبطُ الإعداد يغيّره فوراً بلا هجرةِ بيانات
 *     ولا إعادةِ حسابٍ للماضي.
 *  ٣. **الترتيبُ بالحاجة** (ق-١٠٨): ما لم يُزَر قطُّ أولاً، ثم الأطولُ إهمالاً — قائمةُ عملٍ
 *     لا جدولُ أرقام.
 */

import { contains } from "../../../authorization/scope.js"
import { dayAnchor, dayKeyIn, shiftDayKey } from "../../dailyLog/services/time.js"
import type { SupervisionStore } from "../data/store.js"
import { settingNumber, settingText, type SupervisionContext } from "./context.js"
import type { SupervisionVisit, TargetStatus, VisitStatus } from "../types.js"

/** معرّفُ الإعداد الحاكم — مصدرُ الدورة الوحيد (قب-٦). */
export const VISIT_CADENCE_SETTING = "supervision.visit_cadence_days"

/**
 * طولُ اليوم **مشتقٌّ من التقويم نفسِه**: الفرقُ بين مرساتَي يومين متتاليين. فلا ثابتَ
 * زمنيٌّ مكتوبٌ في الشجرة (G14) ولا وحدةَ قياسٍ مخترعة.
 */
const REFERENCE_DAY_KEY = "2026-01-01"
const DAY_MS =
  dayAnchor(shiftDayKey(REFERENCE_DAY_KEY, 1)).getTime() - dayAnchor(REFERENCE_DAY_KEY).getTime()

/** عددُ الأيام بين مفتاحَي يوم — جبرٌ على المفاتيح لا على اللحظات (فلا يزحزحه توقيتٌ صيفيّ). */
export function daysBetweenDayKeys(fromDayKey: string, toDayKey: string): number {
  return Math.round((dayAnchor(toDayKey).getTime() - dayAnchor(fromDayKey).getTime()) / DAY_MS)
}

/** آخرُ زيارةٍ لهدف — أو `null` إن لم يُزَر قطّ (حالةٌ ذاتُ أثرٍ لا فراغٌ صامت). */
function lastVisitOf(store: SupervisionStore, targetId: string): SupervisionVisit | null {
  return store.visitsOfTarget(targetId)[0] ?? null
}

function statusOf(daysSince: number | null, cadenceDays: number): VisitStatus {
  if (daysSince === null) return "notVisited"
  // **التأخرُ ما جاوز الدورة**: عند الحدّ تماماً لم تنقضِ الدورةُ بعد.
  return daysSince > cadenceDays ? "late" : "recent"
}

/**
 * حالاتُ أهداف نطاقٍ — **بالاحتواء** (ق-١٧: الاطّلاعُ الهابط مباح، والصعودُ ممنوع)،
 * والموقوفُ لا يدخل اللوحة.
 */
export function targetStatuses(
  store: SupervisionStore,
  ctx: SupervisionContext,
  scopePath: string,
): readonly TargetStatus[] {
  const zone = settingText(ctx, "time.zone", scopePath)
  const todayKey = dayKeyIn(ctx.now, zone)

  const rows: TargetStatus[] = []
  for (const target of store.targets()) {
    if (!target.active) continue
    if (!contains(scopePath, target.path)) continue

    const last = lastVisitOf(store, target.id)
    const daysSince = last === null ? null : daysBetweenDayKeys(last.dayKey, todayKey)
    const cadenceDays = settingNumber(ctx, VISIT_CADENCE_SETTING, target.path)

    rows.push({
      targetId: target.id,
      path: target.path,
      curriculum: target.curriculum,
      lastVisitDayKey: last?.dayKey ?? null,
      daysSinceLastVisit: daysSince,
      status: statusOf(daysSince, cadenceDays),
      cadenceDays,
    })
  }

  // الترتيبُ بالحاجة: ما لم يُزَر أولاً، ثم الأطولُ إهمالاً، ثم المعرّفُ حتميّةً.
  return Object.freeze(
    rows.sort((a, b) => {
      if (a.daysSinceLastVisit === null && b.daysSinceLastVisit !== null) return -1
      if (b.daysSinceLastVisit === null && a.daysSinceLastVisit !== null) return 1
      const byNeed = (b.daysSinceLastVisit ?? 0) - (a.daysSinceLastVisit ?? 0)
      return byNeed !== 0 ? byNeed : a.targetId.localeCompare(b.targetId)
    }),
  )
}
