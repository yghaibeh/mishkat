/**
 * # الثابتُ الحاكم — **المبلغُ المختوم لا يتغيّر**
 *
 * هذا المِلفُّ **حارسُ قلبِ الوحدة**، واسمُه اسمُ الثابت عمداً (قب-٤٦ §١): مَن كسر الختمَ
 * يوماً **يجب أن يسقط له اختبارٌ يقول له ما كسر**، لا اختبارٌ يدلّه على ملفٍّ آخر.
 *
 * **الثابت**: بعد إقرار خطة الشهر، **تعديلُ العمل لا يُغيّر المبلغَ المعروض ولا الإجماليّ**
 * — لأن «المالَ المدفوع واقعةٌ لا اشتقاق». ونقضُه ليس عيباً في العرض بل **تزويرٌ بالإهمال**:
 * راتبُ شهرٍ صُرف يتبدّل بتعديل درسٍ قديم.
 *
 * ---
 * ## لماذا وُلد هذا الملفّ — **درسُ تدقيقٍ يُسجَّل بلسانه** (قب-٤٦ §١)
 *
 * كسر مديرُ البرنامج `shown = sealed ?? live` ⟵ `shown = live` في `services/plan.ts` — أي
 * **ألغى الختمَ كلَّه** — فسقط على مجلد الوحدة **اختبارٌ واحدٌ من ١٠٢** عنوانُه
 * **«كشفُ راتبي يُصفّي على صاحبه»**: **اختبارُ خصوصيةٍ سقط بالمصادفة**، فيَدُلّ مَن يقرؤه
 * على المكان الخطأ. **والعدُّ لم ينفع**: ١٢٩ اختباراً وتغطيةُ ٩٩٪ لم تمسك هذا.
 *
 * > **وتصحيحٌ في التشخيص، أُعلنه ولا أُجمّله**: الثابتُ **كان مُثبَتاً فعلاً** — في
 * > `tests/features/approval/payroll-plan-seal.test.ts` («الختمُ صمد»)، وتشغيلُ الطقم كاملاً
 * > **يُسقط اختبارَين** لا واحداً. لكنّ ذلك الملفّ **يعيش خارج مجلد الوحدة** — نُقل إليه
 * > لأن G22 تمنع مفرداتِ الاعتماد خارج المحرّك. **فبقي الثابتُ محروساً في الطقم ومكشوفاً
 * > في وحدته**: مَن دقّق الوحدةَ وحدها — وهو ما يفعله المدقّق ومَن يعدّل الوحدةَ غداً —
 * > **لم يرَ حارساً**. والعيبُ إذن ليس «اختبارٌ ناقص» بل **«حارسٌ في غير موطنه»**، وهو
 * > أخفى: خضرةُ الطقم تُخفيه، وخضرةُ المجلد تُكذّبه.
 *
 * **والعلاجُ هنا بنيويّ**: هذا الملفُّ يُثبت الثابتَ **بمنفذ الوحدة نفسِه** (`SealPort`)
 * لا بمحرّك الاعتماد — فلا يحمل مفردةَ اعتمادٍ واحدة، **فيبقى في موطنه ولا تنفيه G22**.
 * والرحلةُ الكاملة عبر المحرّك تبقى في موطنها هي. **حارسان لا واحد، كلٌّ في مكانه الصحيح.**
 */
import { describe, it, expect } from "vitest"
import { monthlyPlan, ownPayslip } from "../../../src/features/payroll/services/plan.js"
import { derivePlan } from "../../../src/features/payroll/services/derive.js"
import type { PayrollContext } from "../../../src/features/payroll/services/context.js"
import type { SealPort } from "../../../src/features/payroll/services/ports.js"
import type { EntitlementPlan } from "../../../src/features/payroll/types.js"
import {
  FROM,
  HOURLY_RATE,
  KHALID_PATH,
  NEXT_DAY,
  PERIOD,
  TO,
  payrollContext,
  recordRealLesson,
  seedWorld,
  type PayrollWorld,
} from "./_seed.js"

const INPUT = {
  unitPath: KHALID_PATH,
  periodId: PERIOD.id,
  from: FROM,
  to: TO,
  personIds: ["u-teacher"],
}

/** ختمٌ **مبنيٌّ من الاشتقاق نفسِه** لحظةَ الإقرار — لا رقمٌ يدويٌّ في الاختبار. */
function sealOf(plan: EntitlementPlan): SealPort {
  return (unitPath, periodId) =>
    unitPath === KHALID_PATH && periodId === PERIOD.id
      ? { stage: "sealed", plan }
      : { stage: "derived", plan: null }
}

/**
 * عالمٌ بدرسٍ معتمَدٍ واحد (ساعةٌ = `HOURLY_RATE`)، ثم **يُقرّ**، ثم **يُضاف عملٌ بعده**.
 * وهو السيناريو الحقيقيّ الذي يقتله المبدأ: **درسٌ قديمٌ يُعتمد بعد إقرار الشهر**.
 */
function sealedThenWorkChanged(): { world: PayrollWorld; ctx: PayrollContext } {
  const world = seedWorld()
  const first = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })
  const approved = new Set([first])

  // لحظةُ الإقرار: الحمولةُ تُشتقّ وتُختم بما كان معتمَداً **يومئذٍ**.
  const atSealing = derivePlan(
    world.stores,
    payrollContext({ world, approvedLessonIds: approved }),
    INPUT,
  )

  // …ثم يتغيّر العمل: درسٌ ثانٍ يُسجَّل ويُعتمد **بعد** الإقرار.
  const late = recordRealLesson(world, { sessionId: "ses-2", minutes: 120, heldAt: NEXT_DAY })
  approved.add(late)

  return {
    world,
    ctx: payrollContext({ world, approvedLessonIds: approved, seal: sealOf(atSealing) }),
  }
}

describe("**الثابتُ الحاكم — المبلغُ المختوم لا يتغيّر** (المبدأ الحاكم §٢-٣)", () => {
  it("**الإجماليُّ المعروض لا يتغيّر بعد الإقرار** — «المالُ المدفوع واقعةٌ لا اشتقاق»", () => {
    const { world, ctx } = sealedThenWorkChanged()
    const view = monthlyPlan(world.stores, ctx, INPUT)

    expect(view.stage).toBe("sealed")
    expect(
      view.totalNetCents,
      "**نُقض الختم**: عملٌ لاحقٌ غيّر إجماليَّ شهرٍ أُقرّ — تزويرٌ بالإهمال",
    ).toBe(HOURLY_RATE)
  })

  it("**وصافي كلِّ سطرٍ وإجماليُّه لا يتغيّران** — لا سطرَ ينزلق ولو ثبت المجموع", () => {
    const { world, ctx } = sealedThenWorkChanged()
    const view = monthlyPlan(world.stores, ctx, INPUT)

    expect(view.lines).toHaveLength(1)
    for (const line of view.lines) {
      expect(line.netCents, `صافي ${line.personId} تبدّل بعد الختم`).toBe(HOURLY_RATE)
      expect(line.grossCents, `إجماليّ ${line.personId} تبدّل بعد الختم`).toBe(HOURLY_RATE)
      expect(line.deductionCents).toBe(0)
    }
  })

  it("**ومدخلاتُ الاشتقاق المختومة لا تتغيّر** — الرقمُ وبرهانُه يُجمَّدان معاً", () => {
    const { world, ctx } = sealedThenWorkChanged()
    const basis = monthlyPlan(world.stores, ctx, INPUT).lines[0]?.tracks[0]?.basis

    // درسٌ واحدٌ بستّين دقيقة كما كان يومَ الإقرار — لا اثنان ولا مئةٌ وثمانون.
    expect(basis).toMatchObject({ kind: "hours", lessonCount: 1, minutes: 60 })
    expect(
      basis?.kind === "hours" ? basis.lessonIds.length : 0,
      "**معرّفاتُ الدروس هي البرهان** — فلو تبدّلت لَما أمكن إعادةُ بناء الرقم",
    ).toBe(1)
  })

  it("**وكشفُ راتبي يعرض المختوم كذلك** — لا بابَ ثانٍ يُظهر رقماً آخر لصاحب الحق", () => {
    const { world, ctx } = sealedThenWorkChanged()
    const mine = ownPayslip(world.stores, ctx, INPUT, "u-teacher")

    expect(mine.lines[0]?.netCents, "الحقيقةُ الواحدة في الصفحة (ق-١١١)").toBe(HOURLY_RATE)
    expect(mine.totalNetCents).toBe(HOURLY_RATE)
  })

  /**
   * **التوأمُ السالب** — بلا هذا الاختبار قد يمرّ الثابتُ **بالقصور لا بالصحّة**: لو كان
   * الاشتقاقُ جامداً أصلاً لَثبت الرقمُ بعد الختم **بلا ختم**. فهذا يُثبت أن **التغيّرَ ممكن**،
   * ومن ثَمَّ أنّ ثباتَ الرقم أعلاه **صنيعةُ الختم** لا صنيعةُ جمود.
   */
  it("**والتغيّرُ ممكنٌ فعلاً قبل الختم** — فثباتُه بعده صنيعةُ الختم لا صنيعةُ جمود", () => {
    const { world, ctx } = sealedThenWorkChanged()
    const live = monthlyPlan(world.stores, { ...ctx, seal: () => ({ stage: "derived", plan: null }) }, INPUT)

    expect(live.stage).toBe("derived")
    expect(live.totalNetCents, "ساعةٌ + ساعتان = ثلاثُ ساعات").toBe(3 * HOURLY_RATE)
  })

  it("**والفارقُ يُعلَن ولا يُطبَّق** — الصمتُ عيبٌ، والتطبيقُ الصامتُ تزوير", () => {
    const { world, ctx } = sealedThenWorkChanged()
    const view = monthlyPlan(world.stores, ctx, INPUT)

    expect(view.drift).toHaveLength(1)
    expect(view.drift[0]).toMatchObject({
      personId: "u-teacher",
      sealedNetCents: HOURLY_RATE,
      liveNetCents: 3 * HOURLY_RATE,
      deltaCents: 2 * HOURLY_RATE,
    })
    // …ومع ذلك **المعروضُ هو المختوم**: الفارقُ خبرٌ للمراجعة لا تصحيحٌ يُطبَّق.
    expect(view.totalNetCents).toBe(HOURLY_RATE)
  })
})
