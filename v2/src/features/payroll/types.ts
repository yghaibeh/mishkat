/**
 * أنواعُ الرواتب والمستحقات — عقدُ الوحدة `features/payroll/SPEC.md`.
 *
 * أربعةُ ثوابتٍ تُفرَض **هنا بالنوع** قبل أيّ سطرِ منطق، وكلٌّ يقتل خطراً موثّقاً:
 *
 *  ١. **لا حقلَ مستحقٍّ مخزَّنٍ في كياناتِ هذه الوحدة** (§٢-١): ليس في هذا الملفّ كيانٌ
 *     **مخزَّن** يحمل مستحقاً ولا إجمالياً ولا صافياً. المستحقُّ **اشتقاقٌ لحظةَ السؤال**،
 *     وما تراه من مبالغَ أدناه إمّا **حصيلةُ اشتقاقٍ عابرة** (تُحسب وتُعاد ولا تُحفظ) وإمّا
 *     **واقعةٌ مالية التُزمت** (سلفةٌ خرج نقدُها بقيد). والحارسُ **بنيويٌّ محتوائيّ** يمسح
 *     هذا الملفّ ومستودعَ الوحدة (`entitlement-is-derived.test.ts`) — لا وعدٌ في مراجعة.
 *
 *  ٢. **الصفرُ ليس قيمةً تُحسب بل غيابُ حصيلةٍ له اسم** (§٢-٤، علاجُ ع-٢٥): `TrackOutcome`
 *     اتحادٌ مميَّز — **إمّا حصيلةٌ وإمّا سببٌ ولا ثالثَ لهما**. فيستحيل بنيوياً أن يوجد
 *     مسارٌ صفريٌّ بلا سبب، ولا يحتاج ذلك انضباطَ كاتبٍ ولا مراجعةَ بشر.
 *
 *  ٣. **الحصيلةُ تحمل مدخلاتِ اشتقاقها** (§٢-٣): كلُّ `Track` يحمل `basis` — كم درساً
 *     وأيُّها ومتى وبأيّ معدّل. فالسطرُ المختوم **يُعاد بناءُ رقمه من مدخلاته** بعد سنة،
 *     و«الختمُ ليس نسخاً لعدّاد بل تجميدُ لقطةٍ مع برهانها».
 *
 *  ٤. **أخطاءُ العمل قيمٌ معلنة** (المادة ٣/٤): أخطاءُ هذه الوحدة **تُضاف** إلى أخطاء النواة
 *     ولا تحجبها — فيصل سببُ النواة كما هو إلى الشاشة (`PERIOD_LOCKED` مثلاً).
 */

import type { Cents, LedgerErrorCode } from "../ledger/types.js"

// ── المساراتُ الثلاثة ومدخلاتُ اشتقاقها (§٢-٢) ────────────────────────────────

export type TrackKind = "hours" | "points" | "fixed"

/**
 * مدخلاتُ مسار الساعات — **معرّفاتُ الدروس محفوظةٌ في المدخل نفسِه**: هي برهانُ الرقم.
 * وقيمتُها الحقيقية تظهر بعد الختم: مَن سأل «من أين جاء هذا المبلغ؟» **قرأ الجواب** ولم يسأل.
 */
export type HoursBasis = {
  readonly kind: "hours"
  readonly lessonCount: number
  readonly minutes: number
  readonly lessonIds: readonly string[]
  readonly hourlyRateCents: Cents
}

/** مدخلاتُ مسار النقاط — **الحزمةُ بطرفيها** (مبلغٌ لكل عددٍ من النقاط، ق-٣٦). */
export type PointsBasis = {
  readonly kind: "points"
  readonly points: number
  readonly periodKeys: readonly string[]
  readonly packageAmountCents: Cents
  readonly packagePoints: number
}

/** مدخلاتُ المسار المقطوع (ق-٣٩) — مبلغٌ شهريٌّ لا يتبع عملاً. */
export type FixedBasis = {
  readonly kind: "fixed"
  readonly monthlyAmountCents: Cents
}

export type TrackBasis = HoursBasis | PointsBasis | FixedBasis

/** حصيلةُ مسارٍ واحد: مبلغُه **ومدخلاتُه معاً** — لا مبلغَ يتيمٌ بلا برهانه. */
export type Track = {
  readonly basis: TrackBasis
  readonly amountCents: Cents
}

// ── الصفرُ يشرح نفسه (§٢-٤ — علاجُ ع-٢٥) ──────────────────────────────────────

/**
 * أسبابُ الصمت — **كتالوجٌ مغلق**. كلُّ سببٍ منها جوابٌ على سؤال المشرف في ع-٢٥:
 * «اعتمدتُ، فلماذا المطلوب دفعه ٠$؟».
 */
export type SilenceCode =
  /** ع-٢٥ حرفياً: العملُ موجودٌ والاعتمادُ غائب — وهو أشيعُ أسباب الصفر وأخفاها. */
  | "LESSONS_RECORDED_NOT_APPROVED"
  /** ق-٨٦: منهاجُ الحلقة ليس مما يُحتسب بالساعة. */
  | "CURRICULUM_NOT_PAID"
  | "NO_LESSONS_RECORDED"
  /** ق-م-٢: أجرُ الساعة مسجَّلٌ بلا قيمة — **يُملأ من الإنتاج لا باختراع رقم**. */
  | "HOURLY_RATE_UNSET"
  | "POINTS_RECORDED_NOT_APPROVED"
  | "NO_POINTS_RECORDED"
  /** حزمةُ النقاط مختلّةٌ أو غيرُ مضبوطة (ق-٣٦) — نظيرُ `HOURLY_RATE_UNSET` على المسار الآخر. */
  | "POINT_RATE_UNSET"
  /** ق-٣٧: نقاطُ المسجد لأميره — فغيرُ الأمير لا مسارَ نقاطٍ له. */
  | "NOT_POINTS_BENEFICIARY"
  /** ق-٣٩: ليس على الراتب المقطوع. */
  | "NOT_FIXED_SALARY_STAFF"
  | "FIXED_SALARY_UNSET"

/** سببُ صمتِ مسارٍ بعينه — و`count` عددٌ **مشخِّص** حين يفيد («٤ دروسٍ بلا اعتماد»). */
export type Silence = {
  readonly track: TrackKind
  readonly code: SilenceCode
  readonly count?: number
}

/**
 * **الاتحادُ الذي يقتل الصفرَ الصامت**: مسارٌ يُنتج حصيلةً **أو** سبباً — ولا ثالثَ.
 * ولذلك لا توجد في هذه الوحدة دالةٌ تعيد «صفراً» — تعيد `silence` باسمه.
 */
export type TrackOutcome =
  | { readonly ok: true; readonly track: Track }
  | { readonly ok: false; readonly silence: Silence }

// ── سطرُ المستحق (مشتقٌّ ثم مختوم — §٢) ────────────────────────────────────────

/**
 * سطرُ مستحقِّ شخصٍ في فترة. **ليس كياناً مخزَّناً في هذه الوحدة**: يُشتقّ عند كل سؤال،
 * ويُختَم **في حمولة المحرّك المُجمَّدة** عند الإقرار (§٢-٣) — لا في مستودعٍ هنا.
 */
export type EntitlementLine = {
  readonly personId: string
  /** وحدةُ العمل التي نُسب إليها المستحق (ق-٥٢: «كلُّ مستحقٍّ منسوبٌ لوحدته»). */
  readonly unitPath: string
  /** المساراتُ التي أثمرت — **تُجمَع ولا يُختار أحدُها** (ق-٣٨). */
  readonly tracks: readonly Track[]
  /** أسبابُ المسارات التي لم تُثمر — **حاضرةٌ دائماً حين لا يُثمر مسار** (§٢-٤). */
  readonly silences: readonly Silence[]
  readonly grossCents: Cents
  /** قسطُ السلفة (ق-٦٩) — **الخصمُ الوحيدُ المبنيّ، ومشتقٌّ من عقد السلفة لا مكتوبٌ بيد**. */
  readonly deductionCents: Cents
  /** `net = gross − القسط`، **و`≥ ٠` دائماً** (ق-٦٩). */
  readonly netCents: Cents
}

/** خطةُ شهرٍ لوحدةٍ — **حصيلةُ اشتقاقٍ أو لقطةٌ مختومة**، بحسب المرحلة. */
export type EntitlementPlan = {
  readonly unitPath: string
  readonly periodId: string
  readonly lines: readonly EntitlementLine[]
  readonly totalNetCents: Cents
}

// ── مراحلُ الدورة (§٣ — علاجُ ع-٢١) ───────────────────────────────────────────

/** **المرحلةُ في النموذج لا في الشاشة**: الشاشةُ تعرضها ولا تخترعها (ع-٢١). */
export type PlanStage = "derived" | "pending" | "sealed"

/** فارقُ ما بعد الختم — **يُعلَن ولا يُطبَّق** (§٢-٣): برهانُ أن الختم صمد. */
export type PlanDrift = {
  readonly personId: string
  readonly sealedNetCents: Cents
  readonly liveNetCents: Cents
  readonly deltaCents: Cents
}

/** نموذجُ صفحة الرواتب — **مصدرُ بياناتٍ واحد** (ق-١١١). */
export type MonthlyPlanView = {
  readonly unitPath: string
  readonly periodId: string
  readonly stage: PlanStage
  /** المعروضُ: المختومُ إن خُتم، وإلا الاشتقاقُ الحيّ. */
  readonly lines: readonly EntitlementLine[]
  readonly totalNetCents: Cents
  /** **فارقٌ معلَنٌ لا صمت** — فارغٌ قبل الختم، ويحمل الفروق بعده إن تغيّر العملُ. */
  readonly drift: readonly PlanDrift[]
  /** مَن صُرف له — **مشتقٌّ من سجل الصرف**، لا حقلٌ يُحدَّث (ق-٦٥). */
  readonly paidPersonIds: readonly string[]
}

// ── كياناتُ الوحدة المخزَّنة — **وقائعُ مالية التُزمت لا عدّادات** (§٦) ──────────

/**
 * سلفةٌ (ق-٦٩) — **ذمّةٌ مدينة**: أصلُها نقدٌ خرج بقيدٍ مرحَّل (`entryId` برهانُه).
 * وأصلُها وقسطُها **شرطا عقدٍ** لا عدّادا عمل — ولذلك يُخزَّنان، بخلاف المستحق (§٦).
 */
export type Advance = {
  readonly tenantId: string
  readonly id: string
  readonly personId: string
  readonly unitPath: string
  /** القيدُ الذي أخرج النقد — **البرهان**، ومنه يُقرأ التاريخُ والسند. */
  readonly entryId: string
  readonly principalCents: Cents
  /** القسطُ الشهريّ المتفق عليه — **لا يتجاوز الأصل** (يُرفض عند المنح). */
  readonly instalmentCents: Cents
  readonly grantedAt: Date
  /** **الإقفالُ حالةٌ لا حذف** (المادة ٧/٤): يُختم عند بلوغ المسترد الأصلَ. */
  readonly closedAt: Date | null
}

/**
 * قسطٌ استُرد من راتبٍ **صُرف فعلاً** — واقعةٌ التُزمت، ومعها **قيدُها** برهاناً.
 * (وهو الخصمُ الوحيدُ في النظام — §٧.)
 */
export type AdvanceInstalment = {
  readonly tenantId: string
  readonly id: string
  readonly advanceId: string
  readonly periodId: string
  readonly entryId: string
  readonly amountCents: Cents
}

/**
 * سجلُّ صرفٍ (ق-٦٥/ق-٧١) — **توثيقُ الواقعة ومرجعُها**، بلا مبلغ:
 * المبلغُ في القيد (`entryId`) وفي السطر المختوم، **فلا نسخةَ ثالثة تنحرف** (ق-٦٠ روحاً).
 * وهو مصدرُ «مدفوعٌ» المشتقّ — لا حقلَ `paid` يُحدَّث على سطرٍ لا وجودَ له أصلاً.
 */
export type Payout = {
  readonly tenantId: string
  readonly id: string
  readonly entryId: string
  readonly periodId: string
  /** وحدةُ الصرف: **أمينُها هو الصارف** (ق-٦٥ — من `PayingUnitPort`). */
  readonly payingUnitPath: string
  readonly personIds: readonly string[]
  readonly paidBy: string
  readonly at: Date
}

/** تسليمُ دفعةِ منطقةٍ (ق-٦٦) — **لا يتكرر**: (فترة × منطقة) مفتاحٌ فريد. */
export type RegionDistribution = {
  readonly tenantId: string
  readonly id: string
  readonly periodId: string
  readonly toUnitPath: string
  readonly at: Date
}

/** حافزٌ تشغيليٌّ استثنائيّ (ق-٧٧) — **خارج أجر المعلّم بالبناء**: كيانٌ آخرُ وقيدٌ آخر. */
export type Incentive = {
  readonly tenantId: string
  readonly id: string
  readonly personId: string
  readonly unitPath: string
  readonly entryId: string
  readonly grantedBy: string
  readonly at: Date
}

// ── خريطةُ التوزيع (§٥ — ق-٦٦) ────────────────────────────────────────────────

/** **توقّفٌ بصاحبه**: «المتبقي عند مسجد كذا» — الوحدةُ والشخصُ والمبلغُ والحال. */
export type DistributionStop = {
  readonly unitPath: string
  readonly personId: string
  readonly netCents: Cents
  readonly paid: boolean
}

export type DistributionMap = {
  readonly periodId: string
  readonly rootPath: string
  readonly totalNetCents: Cents
  readonly paidNetCents: Cents
  readonly remainingNetCents: Cents
  readonly stops: readonly DistributionStop[]
  /** المناطقُ التي وُزِّع لها فعلاً — **لا تتكرر** (ق-٦٦). */
  readonly distributedRegions: readonly string[]
}

// ── الأخطاء (§١١) ─────────────────────────────────────────────────────────────

export type PayrollErrorCode =
  | "UNKNOWN_PAYROLL_UNIT"
  | "PLAN_NOT_SEALED"
  | "NO_SEALED_ENTITLEMENT"
  | "ALREADY_PAID"
  | "EMPTY_BATCH"
  | "NOTHING_TO_PAY"
  | "NO_PAYING_UNIT"
  | "NOT_PAYING_UNIT"
  | "INSTALMENT_EXCEEDS_PRINCIPAL"
  | "ADVANCE_NOT_FOUND"
  | "ADVANCE_CLOSED"
  | "REGION_ALREADY_DISTRIBUTED"
  | "NOT_DESCENDANT_REGION"

/** خطأُ الرواتب أو خطأُ النواة **كما هو** — لا تُبتلع أسبابُ النواة ولا تُعاد تسميتُها. */
export type PayrollFailureCode = PayrollErrorCode | LedgerErrorCode

export type PayrollError = {
  readonly code: PayrollFailureCode
  readonly detail?: string
}

export type PayrollOk<T> = { readonly ok: true; readonly value: T }
export type PayrollErr = { readonly ok: false; readonly error: PayrollError }
export type PayrollResult<T> = PayrollOk<T> | PayrollErr

export function payrollOk<T>(value: T): PayrollOk<T> {
  return { ok: true, value }
}

export function payrollErr(code: PayrollFailureCode, detail?: string): PayrollErr {
  return detail === undefined
    ? { ok: false, error: { code } }
    : { ok: false, error: { code, detail } }
}
