/**
 * مُحلِّل الإعدادات — عقد `SPEC_settings` §١-٨: «حقنٌ لا استيرادٌ مبعثر».
 *
 * ثلاثة ثوابت:
 *  1. **النطاق معامل إلزامي** كما في `can()` — لا قراءة بلا نطاق، فلا تتسرب قيمة
 *     العالمي مكان قيمة الوحدة سهواً.
 *  2. **`at` إلزامي** — وهو ما يجعل «إعادة الحساب بالنسخة المثبّتة» ممكناً بالبناء،
 *     فلا يُعاد حساب الماضي أبداً (ق-٣٦).
 *  3. **يُحقن ولا يُستورد**: طبقة الخدمات تستقبل المُحلِّل في سياق الطلب —
 *     والمستورد المباشر لا يُختبر ولا يُبدَّل في الاختبار.
 */

import { SETTINGS_BY_ID, type SettingValue } from "./registry.js"
import { contains } from "../authorization/scope.js"

export type SettingOverride = {
  readonly settingId: string
  readonly scopePath: string
  readonly value: SettingValue
  readonly validFrom: Date
  /** معرّف النسخة — يكسر تعادل `validFrom` حتمياً (ق-٣٦: لا-حتمية `rateForMonth` كانت خطأً مكلفاً). */
  readonly id?: string
}

export type SettingsResolver = (id: string, scopePath: string, at: Date) => SettingValue

/** عمق النطاق: عدد مقاطعه. الأعمق أدقُّ، والأدقُّ يغلب الأعمَّ. */
function depth(path: string): number {
  return path.split("/").filter((seg) => seg.length > 0).length
}

/** سقف التخصيص المسموح لكل مستوى، معبَّراً بأقصى عمق نطاق (§١-٣). */
const MAX_DEPTH_FOR_LEVEL = { global: 0, section: 1, unit: Number.POSITIVE_INFINITY } as const

export function createSettingsResolver(overrides: readonly SettingOverride[]): SettingsResolver {
  // قاعدة السقف تُفرض عند بناء المُحلِّل: قيمةٌ مخالفةٌ للسقف لا تدخل الذاكرة أصلاً.
  for (const o of overrides) {
    const def = SETTINGS_BY_ID.get(o.settingId)
    if (def === undefined) {
      throw new Error(`إعداد غير مسجَّل في السجل: ${o.settingId}`)
    }
    if (depth(o.scopePath) > MAX_DEPTH_FOR_LEVEL[def.level]) {
      throw new Error(
        `تجاوزُ سقف التخصيص: الإعداد ${o.settingId} سقفه «${def.level}» ولا يُضبط عند ${o.scopePath}`,
      )
    }
  }

  return function get(id: string, scopePath: string, at: Date): SettingValue {
    const def = SETTINGS_BY_ID.get(id)
    if (def === undefined) throw new Error(`إعداد غير مسجَّل في السجل: ${id}`)

    const applicable = overrides.filter(
      (o) =>
        o.settingId === id &&
        contains(o.scopePath, scopePath) &&
        o.validFrom.getTime() <= at.getTime(),
    )

    if (applicable.length === 0) {
      if (def.default === null) {
        throw new Error(
          `الإعداد ${id} مسجَّل بلا قيمة افتراضية (ق-م-٢) ولا قيمة مضبوطة على ${scopePath} — يُملأ من الإنتاج لا باختراع رقم`,
        )
      }
      return def.default
    }

    // الأدقُّ يغلب الأعمَّ؛ فإن تساوى العمق فأحدث `validFrom`؛ فإن تعادلا فالمعرّف — حتمياً.
    const winner = [...applicable].sort((a, b) => {
      const byDepth = depth(b.scopePath) - depth(a.scopePath)
      if (byDepth !== 0) return byDepth
      const byDate = b.validFrom.getTime() - a.validFrom.getTime()
      if (byDate !== 0) return byDate
      return (a.id ?? "").localeCompare(b.id ?? "")
    })[0]

    return winner!.value
  }
}
