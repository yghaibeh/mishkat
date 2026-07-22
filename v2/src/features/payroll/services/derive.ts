/**
 * **قلبُ الوحدة** — ق-٥٢: «المستحقُّ يُحسب من عمل النظام نفسِه، **لا إدخال يدوي**»،
 * وق-٣٨: «مَن جمع وصفين يُحاسَب بهما»، وع-٢٥: «**الصفرُ يشرح نفسه**».
 *
 * ثلاثةُ ثوابتٍ تعيش في **شكل** هذا الملفّ لا في انضباط كاتبه:
 *
 *  ١. **لا مبلغَ يدخل من الخارج**: ليس في أيّ مدخلٍ هنا حقلُ مبلغٍ واحد — المدخلُ **مَن** و**متى**
 *     و**أين**، والمبالغُ كلُّها **مشتقّةٌ** من المصادر المعتمَدة ومن سجل الإعدادات. فمسارُ
 *     الكتابة اليدوية للمبلغ **غيرُ موجودٍ بالبنية** لا ممنوعٌ بحارس (الاختبار الإلزاميّ الأول).
 *
 *  ٢. **الجمعُ بنيويٌّ لا شرطيّ** (ق-٣٨): المساراتُ الثلاثة **تُقيَّم كلُّها دائماً** ثم
 *     تُجمع حصائلُها — فلا `else` يُسقط مساراً، ولا سبيلَ بنيوياً لأن «يغلب» أحدُها الآخر.
 *     وهي **الحالةُ التي لم يحرسها v1 نصاً**، فصار الحرسُ هنا في الشكل نفسِه.
 *
 *  ٣. **الصفرُ ليس قيمةً تُحسب بل غيابُ حصيلةٍ له اسم** (ع-٢٥): كلُّ مسارٍ يعيد `TrackOutcome`
 *     — **إمّا حصيلةٌ وإمّا سببٌ ولا ثالث**. فلا توجد في هذا الملفّ دالةٌ تستطيع أن تُرجع
 *     صفراً صامتاً **ولو أراد كاتبُها**: النوعُ لا يسمح.
 *
 * **وصفر رقمٍ تشغيليّ** (قب-٦/G14): كلُّ معدّلٍ من `rates.ts`، ويُقرأ **بنطاقٍ وبتاريخ**
 * فلا يُعاد حسابُ شهرٍ مضى (ق-٣٦).
 */

import { ZERO_CENTS } from "../../ledger/services/money.js"
import type { Cents } from "../../ledger/types.js"
import type { PayrollStores } from "../data/store.js"
import { dueInstalmentFor } from "./advances.js"
import type { PayrollContext } from "./context.js"
import {
  fixedSalaryCents,
  hourlyRateCents,
  minutesToCents,
  pointPackage,
  pointsToCents,
} from "./rates.js"
import type {
  EntitlementLine,
  EntitlementPlan,
  SilenceCode,
  Track,
  TrackKind,
  TrackOutcome,
} from "../types.js"

export type DeriveInput = {
  readonly unitPath: string
  readonly periodId: string
  /** نافذةٌ صريحة `[from, to)` — **لا «الشهر الحالي» ضمنياً** (نظيرُ عقد التعليم §٦/٤). */
  readonly from: Date
  readonly to: Date
  /** مَن تُشتقّ لهم الخطة — قائمةٌ يمرّرها المُركِّب، **لا استعلامَ داخل الخدمة** (§٤.٥). */
  readonly personIds: readonly string[]
}

function earned(basis: Track["basis"], amountCents: Cents): TrackOutcome {
  return { ok: true, track: { basis, amountCents } }
}

/** الصمتُ باسمه — مقيَّدٌ بكتالوج الأسباب المغلق، فلا سببَ يُخترع خارج العقد. */
function silent(track: TrackKind, code: SilenceCode, count?: number): TrackOutcome {
  return {
    ok: false,
    silence: count === undefined ? { track, code } : { track, code, count },
  }
}

/**
 * **مسارُ الساعات** (ق-٨٦) — ولا يُعاد هنا حسابُ «المعتمَدُ وحده»: المنفذُ يأتي **مفروزاً**
 * من `education::approvedTeachingLoad` حيث يعيش الحارسُ غيرَ مشروط. ونحن **نضرب في السعر
 * ونشرح ما لم يُحتسب** — والتشخيصان لا يختلطان: «بلا اعتماد» علاجُه غيرُ «منهاجٍ لا يُحتسب».
 */
function hoursTrack(ctx: PayrollContext, input: DeriveInput, personId: string): TrackOutcome {
  const load = ctx.teachingLoad(personId, input.from, input.to)

  if (load.lessonCount === 0) {
    if (load.unapprovedLessonCount > 0) {
      // ع-٢٥ حرفياً: العملُ موجودٌ والاعتمادُ غائب — **والعددُ يُشخِّص**.
      return silent("hours", "LESSONS_RECORDED_NOT_APPROVED", load.unapprovedLessonCount)
    }
    if (load.unpaidCurriculumLessonCount > 0) {
      return silent("hours", "CURRICULUM_NOT_PAID", load.unpaidCurriculumLessonCount)
    }
    return silent("hours", "NO_LESSONS_RECORDED")
  }

  // ق-م-٢: المعدّلُ الغائبُ **غيابٌ يُشخَّص** لا صفرٌ يُخترع ولا شاشةٌ تنهار.
  const rate = hourlyRateCents(ctx, input.unitPath)
  if (rate === null) return silent("hours", "HOURLY_RATE_UNSET", load.lessonCount)

  return earned(
    {
      kind: "hours",
      lessonCount: load.lessonCount,
      minutes: load.minutes,
      lessonIds: load.lessonIds,
      hourlyRateCents: rate,
    },
    minutesToCents(load.minutes, rate),
  )
}

/**
 * **مسارُ النقاط** (ق-٣٣/ق-٥١) — **ومستفيدُه أميرُ الوحدة** (ق-٣٧): «قيمةُ عمل المسجد بعدد
 * نقاطه، والاستحقاقُ كلُّه لأميره ولو نفّذ الأنشطةَ سائرُ الأسرة». فالسؤالُ عن **ملكية قيادةٍ**
 * يجيب عنه منفذٌ — **لا اسمَ دورٍ هنا** (G6).
 */
function pointsTrack(ctx: PayrollContext, input: DeriveInput, personId: string): TrackOutcome {
  if (!ctx.isPointsBeneficiary(personId, input.unitPath)) {
    return silent("points", "NOT_POINTS_BENEFICIARY")
  }

  const points = ctx.approvedPoints(input.unitPath, input.periodId)
  if (points.points === 0) {
    if (points.unapprovedPoints > 0) {
      return silent("points", "POINTS_RECORDED_NOT_APPROVED", points.unapprovedPoints)
    }
    return silent("points", "NO_POINTS_RECORDED")
  }

  const pkg = pointPackage(ctx, input.unitPath)
  if (pkg === null) return silent("points", "POINT_RATE_UNSET", points.points)

  return earned(
    {
      kind: "points",
      points: points.points,
      periodKeys: points.periodKeys,
      packageAmountCents: pkg.amountCents,
      packagePoints: pkg.perUnit,
    },
    pointsToCents(points.points, pkg.amountCents, pkg.perUnit),
  )
}

/**
 * **المسارُ المقطوع** (ق-٣٩) — «رواتبُ الإدارة العليا مبلغٌ مقطوع، لا بالنقاط ولا بالساعة».
 * ومَن هم؟ **منفذٌ يجيب** (`FixedSalaryRoster`)، ورِبطُه المرجعيّ **إسنادُ الجذر** — فلا
 * اسمَ دورٍ في هذا الملفّ ولا في المنفذ (G6).
 */
function fixedTrack(ctx: PayrollContext, input: DeriveInput, personId: string): TrackOutcome {
  if (!ctx.fixedSalaryRoster().includes(personId)) {
    return silent("fixed", "NOT_FIXED_SALARY_STAFF")
  }
  const amount = fixedSalaryCents(ctx, input.unitPath)
  if (amount === null) return silent("fixed", "FIXED_SALARY_UNSET")
  return earned({ kind: "fixed", monthlyAmountCents: amount }, amount)
}

/**
 * **اشتقاقُ سطرِ شخصٍ واحد** — ق-٥٢: من العمل المعتمَد وحده، لحظةَ السؤال، بلا حالةٍ تُراكَم.
 * **يقرأ ولا يكتب**: لا يلمس الدفترَ ولا يحفظ سطراً — والسلفةُ تُقرأ لأن قسطَها جزءٌ من الصافي.
 */
export function deriveEntitlement(
  stores: PayrollStores,
  ctx: PayrollContext,
  input: DeriveInput,
  personId: string,
): EntitlementLine {
  // **الثلاثةُ تُقيَّم دائماً** — والجمعُ بعدها؛ فلا مسارَ يُسقط مساراً (ق-٣٨).
  const outcomes = [
    hoursTrack(ctx, input, personId),
    pointsTrack(ctx, input, personId),
    fixedTrack(ctx, input, personId),
  ]

  const tracks = outcomes.flatMap((o) => (o.ok ? [o.track] : []))
  const silences = outcomes.flatMap((o) => (o.ok ? [] : [o.silence]))
  const grossCents = tracks.reduce<number>((sum, t) => sum + t.amountCents, 0) as Cents

  // ق-٦٩: القسطُ **مشتقٌّ من عقد السلفة** لا مكتوبٌ في نموذج — وهو الخصمُ الوحيد (ب-٣١).
  const due = dueInstalmentFor(stores, personId, grossCents)
  const deductionCents = (due?.amountCents ?? ZERO_CENTS) as Cents

  return {
    personId,
    unitPath: input.unitPath,
    tracks,
    silences,
    grossCents,
    deductionCents,
    // `net ≥ ٠` بالبناء: القسطُ لا يتجاوز الإجماليَّ أصلاً (`dueInstalmentFor`).
    netCents: (grossCents - deductionCents) as Cents,
  }
}

/** خطةُ الشهر — **تجمع المستحقات ولا تعتمدها**: الإقرارُ فعلُ المحرّك (ق-٥١، §٣). */
export function derivePlan(
  stores: PayrollStores,
  ctx: PayrollContext,
  input: DeriveInput,
): EntitlementPlan {
  // ترتيبٌ حتميّ — فالحمولةُ المختومة تُقارَن بنفسها بعد سنة (TESTING_POLICY §٥).
  const lines = [...input.personIds]
    .sort()
    .map((personId) => deriveEntitlement(stores, ctx, input, personId))

  return {
    unitPath: input.unitPath,
    periodId: input.periodId,
    lines,
    totalNetCents: lines.reduce<number>((sum, l) => sum + l.netCents, 0) as Cents,
  }
}
