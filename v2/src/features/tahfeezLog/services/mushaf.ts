/**
 * ق-٨٩ — **قائمةٌ لا كتابةٌ حرّة** (عقدُ الوحدة §٤).
 *
 * شكوى المالك نصاً: «لماذا حقولُ التحفيظ حرّة؟ يفضَّل خيارات». والعلاجُ هنا **بالنوع أولاً**
 * ثم بالتحقّق: `Recitation` **لا تحمل حقلَ اسمِ سورةٍ أصلاً** — فالكتابةُ الحرّة مستحيلةٌ لا
 * ممنوعة؛ والاسمُ العربيُّ **يُشتقّ من الكتالوج** عند العرض.
 *
 * **والكتالوجُ بياناتٌ مرجعية** (قب-٢٢): عددُ آيات كل سورة وعددُ صفحات المصحف **صفوفٌ تُبذَر**
 * لا ثوابتُ كود — فلا قائمةَ سورٍ في هذا الملفّ ولا رقمٌ واحدٌ صلب (G14)، ومصحفٌ ثانٍ يُضاف
 * صفّاً فيعمل بلا سطر كود.
 */

import type { TahfeezLogStore } from "../data/store.js"
import { logErr, logOk, type Recitation, type DayLogResult } from "../types.js"

/** أدنى آيةٍ وأدنى صفحةٍ — **حدُّ الترقيم الطبيعيّ** لا رقمٌ تشغيليّ يُضبط بإعداد. */
const FIRST_UNIT = 1

/** مدىً صالحٌ في نفسه: يبدأ من الأول، ولا يعلو حدَّه، ولا ينقلب. */
function withinRange(from: number, to: number, limit: number): boolean {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return false
  if (from < FIRST_UNIT || to < from) return false
  return to <= limit
}

/**
 * **التحقّقُ عند الحدّ** (المادة ٣/٣): كلُّ نطاقِ حفظٍ أو مراجعةٍ يمرّ من هنا قبل أن يُكتب،
 * والرفضُ **مصنَّفٌ يشرح أيَّ حدٍّ خُرق** لا «مدخلٌ غير صالح» مبهم (ق-١١٢).
 */
export function validateRecitation(
  store: TahfeezLogStore,
  recitation: Recitation,
): DayLogResult<null> {
  if (recitation.mode === "surah") {
    const surah = store.getSurah(recitation.surahId)
    if (surah === null) return logErr("UNKNOWN_SURAH", recitation.surahId)
    if (!withinRange(recitation.fromAyah, recitation.toAyah, surah.ayahCount)) {
      return logErr("AYAH_OUT_OF_RANGE", `${recitation.fromAyah}-${recitation.toAyah}`)
    }
    return logOk(null)
  }

  const mushaf = store.getMushaf(recitation.mushafId)
  if (mushaf === null) return logErr("UNKNOWN_MUSHAF", recitation.mushafId)
  if (!withinRange(recitation.fromPage, recitation.toPage, mushaf.pageCount)) {
    return logErr("PAGE_OUT_OF_RANGE", `${recitation.fromPage}-${recitation.toPage}`)
  }
  return logOk(null)
}

/** اسمُ المرجع **من الكتالوج** — فلا حرفَ عربيٍّ يُصنَع في الكود، ولا اسمٌ يُخزَّن مكرَّراً. */
export function recitationRefAr(store: TahfeezLogStore, recitation: Recitation | null): string {
  if (recitation === null) return ""
  if (recitation.mode === "surah") return store.getSurah(recitation.surahId)?.ar ?? ""
  return store.getMushaf(recitation.mushafId)?.ar ?? ""
}
