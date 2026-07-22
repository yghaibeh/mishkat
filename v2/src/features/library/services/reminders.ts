/**
 * §٨ — **الواجهةُ المعلنة للتذكير: «ما هو إلزاميٌّ ومتأخّر»** — **ولا مُجدوِلَ يُبنى**.
 *
 * ذيلُ ق-٩٦ يطلب «تذكيراً أسبوعياً للإلزامية المتأخرة». و**لا مُجدوِلَ في v2 بعد** (نظيرُ ما
 * أوقفه وكيلُ T11 في ذيل ق-٩٩)، وبناءُ واحدٍ هنا يُنشئ **الثانيَ من صنفه** — وهو عينُ مرض
 * v1: منطقٌ مبعثرٌ في كل وحدة. فالمُصدَّرُ **الاشتقاق** وحده، تستهلكه وحدةُ الإشعارات
 * والمجدولات حين تُبنى: **مصدرٌ واحدٌ لا اثنان**.
 *
 * وثلاثةُ حدودٍ مُعلَنة:
 *  ١. **العتبةُ إعدادٌ حيّ** `materials.mandatory_overdue_days` (G14/قب-٦) — لا رقمَ في الكود،
 *     **وطولُ اليوم نفسُه مشتقٌّ** من مرساتَي مفتاحَي يومٍ متتاليين (منهجُ `supervision/cadence`).
 *  ٢. **الدوريةُ ليست شأنَ هذه الوحدة**: `materials.reminder_interval_days` إعدادُ المستهلِك،
 *     **ولا تقرؤه** — وقراءتُها له أولُ سطرٍ في مُجدوِلٍ ثانٍ.
 *  ٣. **التأخّرُ ما جاوز العتبة**: عند الحدّ تماماً لم تنقضِ بعد (نفسُ حدّ ق-٩٩).
 */

import { dayAnchor, dayKeyIn, shiftDayKey } from "../../dailyLog/services/time.js"
import type { LibraryStore } from "../data/store.js"
import { settingNumber, settingText, type LibraryContext } from "./context.js"
import { materialReaches, materialsInScope } from "./reach.js"
import { stateOf } from "./timeline.js"

/** معرّفُ الإعداد الحاكم — مصدرُ العتبة الوحيد (قب-٦). */
export const OVERDUE_SETTING = "materials.mandatory_overdue_days"

/**
 * طولُ اليوم **مشتقٌّ من التقويم نفسِه**: الفرقُ بين مرساتَي يومين متتاليين. فلا ثابتَ
 * زمنيٌّ مكتوبٌ في الشجرة (G14) ولا وحدةَ قياسٍ مخترعة.
 */
const REFERENCE_DAY_KEY = "2026-01-01"
const DAY_MS =
  dayAnchor(shiftDayKey(REFERENCE_DAY_KEY, 1)).getTime() - dayAnchor(REFERENCE_DAY_KEY).getTime()

/** عددُ الأيام بين مفتاحَي يوم — جبرٌ على المفاتيح لا على اللحظات (فلا يزحزحه توقيتٌ صيفيّ). */
function daysBetweenDayKeys(fromDayKey: string, toDayKey: string): number {
  return Math.round((dayAnchor(toDayKey).getTime() - dayAnchor(fromDayKey).getTime()) / DAY_MS)
}

/** صفٌّ في الواجهة المعلنة: **مَن تأخّر، عن أيّ مادة، منذ كم يوم** — ولا شيء غير ذلك. */
export type OverdueMandatory = {
  readonly personId: string
  readonly materialId: string
  readonly materialTitleAr: string
  readonly unitPath: string
  readonly deliveredDayKey: string
  readonly daysSinceDelivered: number
}

/**
 * **الواجهةُ المعلنة** (§٨): إلزاميٌّ استُلم ولم يُنجَز وقد جاوز العتبة، على نطاقٍ وما تحته.
 * والفتحُ لا يُسقط التذكير — **الإنجازُ وحده** يُسقطه (ق-٩٦: «التأكد من إنجاز قراءتها»).
 */
export function overdueMandatory(
  store: LibraryStore,
  ctx: LibraryContext,
  scopePath: string,
): readonly OverdueMandatory[] {
  const zone = settingText(ctx, "time.zone", scopePath)
  const todayKey = dayKeyIn(ctx.now, zone)
  const materials = materialsInScope(store, scopePath, false).filter((m) => m.mandatory)

  const rows: OverdueMandatory[] = []
  for (const personId of ctx.ports.peopleIn(scopePath)) {
    for (const material of materials) {
      if (!materialReaches(store, ctx, material, personId)) continue
      const progress = store.getProgress(material.id, personId)
      if (progress === null) continue
      if (stateOf(progress) === "completed") continue

      const deliveredDayKey = dayKeyIn(progress.deliveredAt, zone)
      const daysSinceDelivered = daysBetweenDayKeys(deliveredDayKey, todayKey)
      if (daysSinceDelivered <= settingNumber(ctx, OVERDUE_SETTING, material.unitPath)) continue

      rows.push({
        personId,
        materialId: material.id,
        materialTitleAr: material.titleAr,
        unitPath: material.unitPath,
        deliveredDayKey,
        daysSinceDelivered,
      })
    }
  }

  // الترتيبُ بالحاجة: الأطولُ تأخّراً أولاً، ثم المعرّفان حتميّةً.
  return Object.freeze(
    rows.sort(
      (a, b) =>
        b.daysSinceDelivered - a.daysSinceDelivered ||
        a.personId.localeCompare(b.personId) ||
        a.materialId.localeCompare(b.materialId),
    ),
  )
}
