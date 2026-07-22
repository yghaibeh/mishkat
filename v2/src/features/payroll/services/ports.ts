/**
 * **منافذُ الوحدة المُعلَنة** — عقدُ الوحدة §١: ما تحتاجه هذه الوحدةُ من غيرها **تعلنه
 * سؤالاً ولا تستورده كياناً**.
 *
 * وأربعةُ أسباب مقيسة، كلٌّ يقتل عيباً موثّقاً:
 *  ١. **صفر إعادةِ حسابٍ لق-٨٦**: حارسُ «المعتمَدُ وحده» يعيش في وحدة التعليم **غيرَ مشروط**؛
 *     ونسخُه هنا يُنتج **مصدرَي حقيقةٍ يتباعدان** (المادة ١/٢) — وهو مرضُ v1 بعينه.
 *  ٢. **صفر منطقِ اعتماد** (G22): «أمختومةٌ خطةُ الشهر؟» سؤالٌ عن **حالٍ** — لا تعرف هذه
 *     الوحدةُ مَن ختم ولا بأيّ سلسلة، والمُنفِّذُ يعيش **داخل مجلد المحرّك**.
 *  ٣. **ولا إعادةَ كتابةٍ لتوجيه NESSA**: «مَن يصرف لمن لا مسجدَ له؟» (ق-٦٥) يجيب عنه
 *     **محرّكُ التوجيه القائم** بقدرة الأمانة (`box.receive`، ق-٥٩) — من مجلده لا من هنا.
 *  ٤. **اتجاهُ الاعتماد منعكس**: المُركِّبُ يصل المنافذَ بمصادرها، فيبقى تبديلُ طبقة البيانات
 *     (D1 بدل الذاكرة — ADR-001 §٥) **تغييرَ تركيبٍ لا تغييرَ منطق**.
 */

import type { Actor } from "../../../authorization/can.js"
import { ROOT_PATH } from "../../../authorization/scope.js"
import type { Cents } from "../../ledger/types.js"
import type { EntitlementPlan, PlanStage } from "../types.js"

/**
 * **حِمْلُ التدريس المعتمَد** كما تحتاجه هذه الوحدة — قراءةٌ لا نسخةُ حقيقة:
 * موطنُه `education::approvedTeachingLoad`، وهو **يحرس ق-٨٦ بنفسه** (المعتمَدُ وحده،
 * والمناهجُ المؤهَّلة وحدها). ونحن **نضرب في السعر ولا نُعيد الفرز**.
 */
export type TeachingLoad = {
  readonly lessonCount: number
  readonly minutes: number
  readonly lessonIds: readonly string[]
  /** دروسٌ سُجِّلت **ولم تُعتمد** — مصدرُ «صفر لأن ٤ دروسٍ بلا اعتماد» (ع-٢٥). */
  readonly unapprovedLessonCount: number
  /** دروسٌ في منهاجٍ **غير مؤهَّلٍ للاحتساب** (ق-٨٦) — سببٌ آخرُ للصفر، مختلفُ العلاج. */
  readonly unpaidCurriculumLessonCount: number
}

/**
 * «كم درساً معتمَداً لهذا المعلّم في هذا المدى؟» — **بمفردات هذه الوحدة**:
 * صاحبُ الكيان يشخّص بمفرداته، و**ملفُّ الوصل وحده** يترجم (عقدُ التعليم §١١).
 */
export type TeachingLoadPort = (
  personId: string,
  from: Date,
  to: Date,
) => TeachingLoad

/** نقاطُ الوحدة في الفترة — مخزَّنةٌ مع قيدها (ق-٤١)، **تُجمَع ولا تُشتقّ من العدد×الوزن**. */
export type ApprovedPoints = {
  readonly points: number
  readonly periodKeys: readonly string[]
  /** نقاطٌ سُجِّلت وسجلُّها **لم يُعتمد بعد** — ع-٢٥ في وجهها الثاني. */
  readonly unapprovedPoints: number
}

/** «كم نقطةً معتمَدة لهذه الوحدة في هذه الفترة؟» */
export type ApprovedPointsPort = (unitPath: string, periodId: string) => ApprovedPoints

/**
 * «أهذا الشخصُ **مستفيدُ نقاط** هذه الوحدة؟» — ق-٣٧: نقاطُ المسجد **لأميره**، ولو نفّذ
 * الأنشطةَ سائرُ الأسرة. **سؤالٌ عن ملكيةِ قيادةٍ لا عن اسم دور** (G6).
 */
export type PointsBeneficiaryPort = (personId: string, unitPath: string) => boolean

/** «مَن على الراتب المقطوع؟» (ق-٣٩) — **بيانُ إسنادٍ لا اسمُ دور** (G6). */
export type FixedSalaryRoster = () => readonly string[]

/**
 * **جوابُ المحرّك عن حال الخطة** — لا نعرف مَن ختم ولا بأيّ سلسلة (G22).
 * `plan` هو **السطرُ المختوم بمدخلاته**، ولا يوجد إلا في `sealed`.
 */
export type Seal = {
  readonly stage: PlanStage
  readonly plan: EntitlementPlan | null
}

export type SealPort = (unitPath: string, periodId: string) => Seal

/**
 * ق-٦٥ — «أيُّ وحدةٍ **يصرف أمينُها** لمن مكانُه هنا؟». `null` = لا أمينَ في السلسلة كلِّها
 * ⇒ **رفضٌ يُقفل ولا يُفتح**. والجوابُ من **محرّك التوجيه القائم**، بقدرة الأمانة (ق-٥٩).
 */
export type PayingUnitPort = (unitPath: string) => string | null

/**
 * ق-٦١ — «سلِّم نزولاً إلى هذه المنطقة». القيدُ الواحدُ الذرّيّ وحارسُ «نازلٌ حصراً»
 * **مبنيّان في وحدة الصندوق**؛ ونسخُهما هنا **دفترٌ موازٍ** — فيُسأل ولا يُنسَخ.
 */
export type HandoverOutcome =
  | { readonly ok: true; readonly entryId: string }
  | { readonly ok: false; readonly code: string }

export type HandoverPort = (input: {
  readonly fromUnitPath: string
  readonly toUnitPath: string
  readonly amountCents: Cents
  readonly currency: string
  readonly memoAr: string
  /** وسمُ الدفعة `salaries:<الفترة>` — **مفتاحُ التكرار الطبيعيّ** (ق-٦٦/ق-٥٠). */
  readonly operationId: string
}) => HandoverOutcome

/**
 * **مراجعُ الحسابات بياناً لا كوداً** — كما تُدار فئاتُ الصرف (ق-٦٤/قب-٦).
 * **صفر حسابٍ مخترَعٍ في الكود**: المُركِّبُ يمرّر معرّفَي الحساب من شجرة النواة.
 */
export type PayrollAccounts = {
  /** حسابُ مصروف الرواتب — دورُ المصروف المعلن في النواة. */
  readonly salaryExpense: string
  /** حسابُ الذمم المدينة على الكادر (ق-٦٩) — **أصلٌ لا مصروف**. */
  readonly staffReceivable: string
  readonly cash: string
}

// ── الرِّبطُ المرجعيّ (bindings) — تركيبٌ لا منطق ─────────────────────────────

/**
 * ق-٣٩ — **«الإدارةُ العليا» تُعرَف بإسنادها إلى الجذر لا باسم دورها** (G6: صفر فحصِ دور).
 *
 * ولماذا الجذر؟ لأنّ الملفَّ الذهبيَّ نفسَه يحصر أدوارَ الإدارة في `allowedUnitTypes: ["root"]`
 * — فالإسنادُ عند الجذر **هو** التجسيدُ البنيويُّ للوصف، وقراءتُه لا تذكر اسمَ دورٍ واحد.
 * وهو **رِبطٌ مرجعيّ**: من أراد سياسةً أخرى بدّل المنفذ ولم يمسّ منطقَ الاشتقاق.
 *
 * والفعّاليةُ الزمنية تُقاس بنفس شروط الإسناد المعتمدة (ق-٢٤/ق-٢٥): معتمَدٌ · غيرُ مؤرشف ·
 * وضمن مداه — فلا يُحاسَب مَن انتهى تكليفُه ولا مَن لم يبدأ بعد.
 */
export function rootAssignedRoster(people: readonly Actor[], now: Date): FixedSalaryRoster {
  return () =>
    people
      .filter((p) =>
        p.assignments.some(
          (a) =>
            a.scopePath === ROOT_PATH &&
            a.approvalStatus === "approved" &&
            !a.unitArchived &&
            a.startDate.getTime() <= now.getTime() &&
            (a.endDate === null || a.endDate.getTime() > now.getTime()),
        ),
      )
      .map((p) => p.personId)
      .sort()
}

/** منفذٌ خامل: **لا ختمَ بعد** — الافتراضُ في كل سياقٍ «لم يُقرّ» (الاعتمادُ فعلٌ يقع). */
export const NO_SEAL: SealPort = () => ({ stage: "derived", plan: null })
