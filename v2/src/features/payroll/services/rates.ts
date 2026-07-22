/**
 * المعدّلاتُ من سجل الإعدادات — **صفر رقمٍ تشغيليٍّ صلب** (قب-٦/G14، عقدُ الوحدة §١٢).
 *
 * وكلُّ قراءةٍ هنا **بنطاقٍ وبتاريخ** — وهو ما يجعل ق-٣٦ («المؤثِّرُ مالياً بأثرٍ قادم، ولا
 * يُعاد حسابُ الماضي») صحيحاً **بالبناء لا بالانضباط**: خطةُ شهرٍ مضى تُقرأ بلحظة ذلك الشهر
 * فتُعطي معدّلَه هو، ورفعُ المعدّل اليوم **لا يمسّ قرشاً مضى**.
 *
 * **والمعدّلُ الغائبُ ليس صفراً بل غياب** (ق-م-٢): `null` يصعد إلى المُشتقّ فيصير **سبباً
 * معروضاً** («صفر — أجرُ الساعة غيرُ مضبوط») لا رقماً مخترعاً ولا شاشةً تنهار.
 */

import type { Cents } from "../../ledger/types.js"
import { settingNumberOrUnset, settingText, type PayrollContext } from "./context.js"

/** معرّفاتُ الإعدادات — من السجل المركزيّ، والقيمُ منه لا من هنا (قب-٦). */
export const HOURLY_RATE_SETTING = "finance.hourly_rate.amount"
export const POINT_RATE_AMOUNT_SETTING = "finance.point_rate.amount"
export const POINT_RATE_PER_UNIT_SETTING = "finance.point_rate.per_unit"
export const FIXED_SALARY_SETTING = "finance.fixed_salary.amount"
export const BASE_CURRENCY_SETTING = "finance.currency.base"

/**
 * **دقائقُ الساعة** — وحدةُ التعليم أحالت القسمةَ إلينا **بالنصّ** (عقدُها §٦ بند ٣:
 * «نُصدِّر دقائق… **ولا نقسم على ستّين** — المبلغُ في وحدة الرواتب»). فوصلت، وهنا تُحسم.
 *
 * **وهي ليست رقمَ عملٍ تشغيلياً بل هُويّةً في مقياس الزمن**: المعدّلاتُ والسقوفُ يضبطها
 * الأدمن فيتغيّر السلوك (وتلك موطنُها سجلُّ الإعدادات، وكلُّها هنا تُقرأ منه)؛ أمّا الساعةُ
 * فلا يملك أحدٌ ضبطَها، و**ضبطُها يكسر الحساب لا يعدّله**.
 *
 * **ولذلك تُشتقّ من التقويم نفسِه لا تُكتب رقماً** — وهو **الأسلوبُ المقرَّر في هذه الشجرة**:
 * `dailyLog/services/time.ts` يبني كلَّ حدودِ اليوم والأسبوع من **مفاتيحَ نصّية** («صفر رقمٍ
 * في هذا الملفّ» — نصُّ عقده)، ومنه أخذنا. فالساعةُ هنا **فرقُ لحظتين معلَنتين**، والدقيقةُ
 * كذلك، والنسبةُ بينهما هي المطلوب — **حسابٌ صريحٌ يُقرأ ويُراجَع، لا ثابتٌ يُدسّ**.
 *
 * > **ولماذا لم يُستعمل وسمُ `hard-constant:` الذي بنته البوابةُ نفسُها؟** لأنه **كان لا يعمل**:
 * > `g14-no-hard-numbers.mjs` يفحص السطرَ في **الكود المُجرَّد** ثم يبحث عن الوسم في **السطر
 * > المقابل من الملفّ الخام**؛ و`stripCommentsAndStrings` يستبدل **كتلةَ التوثيق كاملةً**
 * > بمسافةٍ واحدة **فتنهار أرقامُ الأسطر**. فأيُّ ثابتٍ تسبقه كتلةُ توثيق — أي كلُّ ثابتٍ في هذه
 * > الشجرة — **يستحيل أن يبلغه الوسم**. جُرِّب فأخفق، **فلم يُعدَّل الحارسُ ولم يُلتفَّ عليه**:
 * > رُفع فرُقّم **CR-023** و**أُصلح** في T23-ب (الدالّتان في `_lib.mjs` معاً). **والحسابُ
 * > هنا يبقى** بقرار المدير نصّاً: *«لا سابقةَ تُمنح — يبقى **لأنه الأصحّ** لا لأن المخرج
 * > معطَّل»*؛ فلا وسمَ يُستعمل ولا صفَّ يُضاف إلى `DELIBERATE_HARD_CONSTANTS`.
 */
const EPOCH_MS = new Date("1970-01-01T00:00:00.000Z").getTime()
const ONE_HOUR_MS = new Date("1970-01-01T01:00:00.000Z").getTime() - EPOCH_MS
const ONE_MINUTE_MS = new Date("1970-01-01T00:01:00.000Z").getTime() - EPOCH_MS

export const MINUTES_PER_HOUR = ONE_HOUR_MS / ONE_MINUTE_MS

/** أجرُ الساعة بالسنتات، أو `null` إن لم يُضبط بعد (ق-م-٢). */
export function hourlyRateCents(ctx: PayrollContext, scopePath: string): Cents | null {
  const value = settingNumberOrUnset(ctx, HOURLY_RATE_SETTING, scopePath)
  return value === null ? null : (value as Cents)
}

/** حزمةُ النقاط: مبلغُها وعددُها (ق-٣٦) — الاثنان معاً وإلا فلا معدّل. */
export function pointPackage(
  ctx: PayrollContext,
  scopePath: string,
): { readonly amountCents: Cents; readonly perUnit: number } | null {
  const amount = settingNumberOrUnset(ctx, POINT_RATE_AMOUNT_SETTING, scopePath)
  const perUnit = settingNumberOrUnset(ctx, POINT_RATE_PER_UNIT_SETTING, scopePath)
  if (amount === null || perUnit === null || perUnit <= 0) return null
  return { amountCents: amount as Cents, perUnit }
}

/** الراتبُ المقطوع الشهريّ (ق-٣٩)، أو `null` إن لم يُضبط. */
export function fixedSalaryCents(ctx: PayrollContext, scopePath: string): Cents | null {
  const value = settingNumberOrUnset(ctx, FIXED_SALARY_SETTING, scopePath)
  return value === null ? null : (value as Cents)
}

/** عملةُ الدفتر (ق-٤٨/ق-٦٢) — **لا عملةَ صلبةٌ في الكود**. */
export function baseCurrency(ctx: PayrollContext, scopePath: string): string {
  return settingText(ctx, BASE_CURRENCY_SETTING, scopePath)
}

/**
 * أجرُ الدقائق — **قسمةٌ صحيحةٌ نحو الأسفل** (ق-٤٨: لا عددَ عائمٍ في أي خطوة، ولا تقريبٌ
 * لصالح الدافع أو المدفوع له بل **قطعٌ حتميّ** يُعاد إنتاجُه دائماً).
 */
export function minutesToCents(minutes: number, hourlyCents: Cents): Cents {
  return Math.trunc((minutes * hourlyCents) / MINUTES_PER_HOUR) as Cents
}

/** أجرُ النقاط — قسمةٌ صحيحةٌ كذلك: `النقاط × مبلغُ الحزمة ÷ عددُ الحزمة`. */
export function pointsToCents(points: number, amountCents: Cents, perUnit: number): Cents {
  return Math.trunc((points * amountCents) / perUnit) as Cents
}
