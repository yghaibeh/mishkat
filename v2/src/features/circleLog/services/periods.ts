/**
 * **CR-٠٢٠ — فترةُ الجلسة**: الضلعُ الثالث في المفتاح الطبيعيّ (قرارُ المالك ٢٠٢٦-٠٧-٢٢ · قب-٤٥).
 *
 * المالك: «**يُسمح بجلستين (صباح/مساء)**» — واقعٌ ميدانيّ. فمفتاحُ (حلقة × يوم) **يتّسع بفاصلٍ
 * صريح** إلى (حلقة × يوم × **فترة**)، و**الجلسةُ تبقى كياناً واحداً بمميِّزه** (CR-016):
 * **يتّسع مفتاحُها ولا ينشطر كيانُها** — لا سجلَّ صباحٍ وسجلَّ مساءٍ يخيطهما جسر.
 *
 * **والفترةُ قائمةٌ محصورة** (ق-٨٩) **من صفوفٍ لا من كود** (CR-020 §٤-ب نصّاً: «من بياناتٍ
 * مرجعية لا من كود — نظيرُ ب-٢٨»): فشبكةٌ تعقد ثلاث فتراتٍ تُضيف صفّاً، **بلا سطر**. ولو
 * سرَدَ هذا الملفُّ «صباحاً ومساءً» لأعاد بناءَ ع-٨ حرفياً (نوعٌ يعرفه الكودُ وآخرُ لا يعرفه).
 *
 * ## التركيبُ الأدنى — **يومٌ غيرُ مقسَّم**، ونمطُ `RECITATION_SHAPE_ONLY` بعينه
 * شبكةٌ **لم تُعلن فتراتٍ** ⇒ فترتُها الوحيدة **اليومُ كلُّه** (`day`) — وهو **حالُ ما قبل
 * CR-020 بحرفه**: جلسةٌ واحدةٌ لليوم، وإعادةُ الإرسال استبدالٌ آمن (ق-٩٠).
 * وشبكةٌ **أعلنت فتراتٍ** ⇒ **فتراتُها هي وحدها**، و«اليومُ كلُّه» **يتقاعد** فلا يبقى بجانبها
 * **باباً ثالثاً للازدواج** — وهو بعينه ما حرص عليه نصُّ القرار: *«لا يُفتح باب الازدواج
 * الذي منعه المفتاح أصلاً»*.
 *
 * ## ولماذا `PERIOD_REQUIRED` ولا تُختار الأولى صامتةً
 * **لا تخضرّ عند الغموض** (قاعدةُ CR-011 على مستهلِك): شبكةٌ أعلنت صباحاً ومساءً ثم وصلها
 * تسجيلٌ **بلا فترة** ⇒ **رفضٌ مُشخِّص** لا اختيارُ أولى الفترات نيابةً عن المعلّم. فاختيارٌ
 * صامتٌ هنا يكتب حضورَ المساء في خانة الصباح، **وذلك محوٌ صامتٌ لا خطأُ عرض**.
 */

import type { CircleLogStore } from "../data/store.js"
import { logErr, logOk, type AttendanceMark, type DayLogResult, type SessionPeriodRef } from "../types.js"

/**
 * **التركيبُ الأدنى**: معرّفُ «اليومِ كلِّه» — فترةُ شبكةٍ لم تُقسّم يومَها.
 * وهو **قيمةٌ في المفتاح لا اسمٌ لنوع**: لا يحمل دلالةَ عمل، ولا يفرّع عليه سطرٌ واحد.
 */
export const WHOLE_DAY_PERIOD_ID = "day"

/** مرجعُ «اليومِ كلِّه» — ونصُّه من قاموس الوحدة (`circleLog.day`) لا حرفاً مبعثراً. */
export function wholeDayPeriod(tenantId: string): SessionPeriodRef {
  return Object.freeze({ tenantId, id: WHOLE_DAY_PERIOD_ID, ar: "اليوم", ordinal: 0 })
}

/**
 * **فتراتُ الشبكة المُعلنة** — صفوفُها إن أعلنت، و**اليومُ كلُّه** إن لم تُعلن.
 * والقائمةُ **تُشتقّ من الصفوف ولا تُسرد** (CR-011/قب-٤٠).
 */
export function declaredPeriods(store: CircleLogStore): readonly SessionPeriodRef[] {
  const rows = store.periods()
  return rows.length === 0 ? Object.freeze([wholeDayPeriod(store.tenantId)]) : rows
}

/** مرجعُ فترةٍ بعينها — من الصفوف، أو **اليومُ كلُّه** حين لا صفوف. */
export function periodRef(store: CircleLogStore, periodId: string): SessionPeriodRef | null {
  return declaredPeriods(store).find((p) => p.id === periodId) ?? null
}

/**
 * **حسمُ فترة الجلسة** — مدخلُها اختياريٌّ، وجوابُها **معرّفٌ من القائمة المحصورة أو رفضٌ**:
 *  - لم تُعلن الشبكةُ فتراتٍ ⇒ الغائبُ **اليومُ كلُّه**، وما سواه `UNKNOWN_PERIOD`.
 *  - أعلنت ⇒ الغائبُ `PERIOD_REQUIRED` (لا اختيارَ صامتاً)، والمذكورُ يُطابَق أو يُرفض.
 */
export function resolvePeriodId(
  store: CircleLogStore,
  given: string | undefined,
): DayLogResult<string> {
  const declared = store.periods()
  if (declared.length === 0) {
    if (given === undefined || given === WHOLE_DAY_PERIOD_ID) return logOk(WHOLE_DAY_PERIOD_ID)
    return logErr("UNKNOWN_PERIOD", given)
  }
  if (given === undefined) return logErr("PERIOD_REQUIRED", declared.map((p) => p.id).join(","))
  if (!declared.some((p) => p.id === given)) return logErr("UNKNOWN_PERIOD", given)
  return logOk(given)
}

/**
 * **جمعُ الحضور عبر فترات اليوم — ولا يُضاعَف** (CR-020 نصّاً).
 *
 * الحضورُ **صفةُ يومٍ لا صفةُ فترة**: طالبٌ حضر صباحاً وغاب مساءً **حضر ذلك اليوم**، ويومُه
 * يُعدّ **مرّةً واحدة**. ولولا هذا الجمعُ لصار الفتحُ الذي أذن به المالك **مضاعفةً في المقام
 * والبسط معاً**: حلقةٌ تعقد فترتين تُقاس على ضِعف ما تُقاس عليه جارتُها (ق-٩١)، وسجلُّ الطالب
 * يقول «ستُّ جلسات» عن ثلاثة أيام (ع-٢٩ في ثوبٍ جديد).
 *
 * **والأقوى حضوراً يغلب**: حاضرٌ ⟵ تاركٌ (حضر ثم انصرف) ⟵ مستأذنٌ ⟵ غائب. فالرتبةُ **ترتيبُ
 * حضورٍ فعليٍّ لا تفضيلٌ إداريّ**، والغيابُ **أضعفُها** لأنه وحدَه نفيٌ للحضور.
 * **والترتيبُ قائمةٌ مرتَّبةٌ لا أرقامٌ بجانب العلامات** — فلا رقمَ تشغيليٌّ صلبٌ في الخدمات.
 */
export const ATTENDANCE_STRENGTH: readonly AttendanceMark[] = Object.freeze([
  "absent",
  "excused",
  "left",
  "present",
])

/**
 * رتبةُ العلامة — **موضعُها في الترتيب لا رقمٌ بجانبها** (G14 نظيراً: لا عددَ تشغيليٍّ صلب).
 * **ولا تخضرّ عند الغموض**: علامةٌ خامسةٌ لم تُرتَّب **حالةٌ برمجية** (المادة ٣/٤) لا «أضعفُ
 * الحضور» صامتةً — فالرباعيُّ مغلقٌ بق-٩٠، وخامسٌ خطأُ ترجمةٍ لا خطأُ تشغيل.
 */
function strength(mark: AttendanceMark): number {
  const rank = ATTENDANCE_STRENGTH.indexOf(mark)
  if (rank < 0) throw new TypeError(`علامةُ حضورٍ بلا رتبةٍ في ترتيب جمع الفترات: ${mark}`)
  return rank
}

/** علامةُ اليوم من علامتَي فترتيه — **الأقوى حضوراً**، وحتميّةٌ لا تتبع ترتيبَ الفترات. */
export function strongerMark(a: AttendanceMark, b: AttendanceMark): AttendanceMark {
  return strength(a) >= strength(b) ? a : b
}

/**
 * **طيُّ علاماتِ فتراتِ اليوم في علامةٍ واحدة** — مفتاحُ الطيّ يقرّره المُستدعي
 * (يومٌ وحده في سجلّ طالب، ويومٌ × ملتحقٌ في تقييم حلقة).
 */
export function foldMarks<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  markOf: (item: T) => AttendanceMark,
): ReadonlyMap<string, AttendanceMark> {
  const folded = new Map<string, AttendanceMark>()
  for (const item of items) {
    const key = keyOf(item)
    const seen = folded.get(key)
    folded.set(key, seen === undefined ? markOf(item) : strongerMark(seen, markOf(item)))
  }
  return folded
}
