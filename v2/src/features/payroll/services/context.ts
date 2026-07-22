/**
 * سياقُ خدمات الرواتب — **امتدادٌ لسياق النواة لا بديلٌ عنه**.
 *
 * `LedgerContext` يحمل الساعةَ ومُحلِّلَ الإعدادات والفاعل (**تُحقن ولا تُستورد** —
 * `SPEC_settings` §١-٨)، وتضيف الرواتبُ عليه **منافذَها المعلنة** (عقدُ الوحدة §١)
 * ومراجعَ الحسابات بياناً. فلا تعرف الخدمةُ دوراً ولا تستورد محرّكاً ولا تعرف صندوقاً.
 *
 * **وقراءةُ الإعدادات هنا بنطاقٍ وبتاريخٍ دائماً** — وهو ما يجعل «لا يُعاد حسابُ الماضي»
 * (ق-٣٦) صحيحاً **بالبناء**: خطةُ شهرٍ مضى تُقرأ بلحظتها فتُعطي معدّلَ ذلك الشهر.
 */

import type { SettingValue } from "../../../settings/registry.js"
import type { LedgerContext } from "../../ledger/services/journal.js"
import type {
  ApprovedPointsPort,
  FixedSalaryRoster,
  HandoverPort,
  PayingUnitPort,
  PayrollAccounts,
  PointsBeneficiaryPort,
  SealPort,
  TeachingLoadPort,
} from "./ports.js"

export type PayrollContext = LedgerContext & {
  readonly teachingLoad: TeachingLoadPort
  readonly approvedPoints: ApprovedPointsPort
  readonly isPointsBeneficiary: PointsBeneficiaryPort
  readonly fixedSalaryRoster: FixedSalaryRoster
  readonly seal: SealPort
  readonly payingUnit: PayingUnitPort
  readonly accounts: PayrollAccounts
  /** يُحقن حين يُراد التوزيعُ النازل (ق-٦٦)؛ وغيابُه يعني **لا مسارَ توزيعٍ** لا تجاوزَه. */
  readonly handover?: HandoverPort
}

/**
 * قراءةُ نصٍّ من السجل — بلا `any` وبلا رقمٍ صلب (G3/G14).
 *
 * **ولا قارئَ للعدد ولا للمفتاح هنا**: كلُّ أرقام هذه الوحدة **مالٌ قد لا يكون مضبوطاً**
 * (ق-م-٢) فتقرؤه `settingNumberOrUnset`؛ ولا مفتاحَ تفعيلٍ تقرؤه الوحدةُ أصلاً (§١٣).
 * فقارئان لا ثالثَ لهما — **ولا دالّةَ تُصدَّر بلا مستهلك** (المادة ١/٥).
 */
export function settingText(ctx: PayrollContext, id: string, scopePath: string): string {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "string") throw new TypeError(`الإعداد ${id} ليس نصاً`)
  return value
}

/**
 * **إعدادٌ مسجَّلٌ بلا افتراضيٍّ عمداً** (ق-م-٢): المُحلِّلُ **يرمي** بدل أن يخترع رقماً —
 * وهو الصواب. لكنّ الرواتبَ لا يجوز أن **تسقط** لأجل معدّلٍ لم يُضبط بعد: الصوابُ أن
 * **يُشخَّص الصمت** («صفر — أجرُ الساعة غيرُ مضبوط») لا أن تنهار الشاشة كلُّها (ع-٢٥ روحاً).
 *
 * فهذه الدالةُ تحوّل الرميةَ إلى **غياب**، والغيابَ يحوّله المُشتقُّ إلى **سببٍ معروض**.
 * ولا تبتلع خطأً آخر: القيمةُ الموجودةُ غيرُ الرقمية **ترمي كما يجب** (خطأٌ برمجيّ لا عمل).
 */
export function settingNumberOrUnset(
  ctx: PayrollContext,
  id: string,
  scopePath: string,
): number | null {
  let value: SettingValue
  try {
    value = ctx.settings(id, scopePath, ctx.now)
  } catch {
    return null
  }
  if (typeof value !== "number") throw new TypeError(`الإعداد ${id} ليس رقماً`)
  return value
}
