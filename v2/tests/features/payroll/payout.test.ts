/**
 * **الاختباران الإلزاميّان الخامس والسادس** (عقدُ الوحدة §٤/§٦):
 * ق-٦٥ (لا صرفَ بلا استحقاق · ولا دفعَ مرتين) · ق-٧١ (قيدٌ واحد · لا فارغةَ ولا مكررة) ·
 * ق-٦٦ (دفعةُ المنطقة لا تتكرر) · ق-٦٩ (السلفة) · ق-٧٢ (**توازنُ الدفتر بعد كل مسار**).
 *
 * **والسلبيّاتُ هنا ضِعفا الإيجابيّات**: المالُ يُعرَّف بما يمنعه.
 */
import { describe, it, expect } from "vitest"
import { balanceProof } from "../../../src/features/ledger/services/journal.js"
import { balancesByCurrency } from "../../../src/features/ledger/services/balances.js"
import { grantAdvance, outstandingOf } from "../../../src/features/payroll/services/advances.js"
import { disburse } from "../../../src/features/payroll/services/payout.js"
import { grantIncentive } from "../../../src/features/payroll/services/incentives.js"
import {
  distributeToRegion,
  distributionMap,
} from "../../../src/features/payroll/services/distribution.js"
import { derivePlan } from "../../../src/features/payroll/services/derive.js"
import type { PayrollContext } from "../../../src/features/payroll/services/context.js"
import type { SealPort } from "../../../src/features/payroll/services/ports.js"
import type { Cents } from "../../../src/features/ledger/types.js"
import {
  ACCOUNTS,
  BILAL_PATH,
  FROM,
  HOMS_PATH,
  HOURLY_RATE,
  KHALID_PATH,
  PERIOD,
  TO,
  VACANT_SQUARE_PATH,
  payrollContext,
  recordRealLesson,
  seedWorld,
  type PayrollWorld,
} from "./_seed.js"

const INPUT = { unitPath: KHALID_PATH, periodId: PERIOD.id, from: FROM, to: TO, personIds: ["u-teacher"] }

/** ختمٌ **حقيقيُّ الشكل** مبنيٌّ من الاشتقاق نفسِه — لا رقمٌ يدويٌّ في الاختبار. */
function sealedFrom(world: PayrollWorld, ctx: PayrollContext, unitPath = KHALID_PATH): SealPort {
  const plan = derivePlan(world.stores, ctx, { ...INPUT, unitPath })
  return (asked, periodId) =>
    asked === unitPath && periodId === PERIOD.id
      ? { stage: "sealed", plan }
      : { stage: "derived", plan: null }
}

function worldWithSealedHour(minutes = 60) {
  const world = seedWorld()
  const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes })
  const base = payrollContext({ world, approvedLessonIds: new Set([lessonId]) })
  const ctx = payrollContext({
    world,
    approvedLessonIds: new Set([lessonId]),
    seal: sealedFrom(world, base),
  })
  return { world, ctx }
}

function pay(world: PayrollWorld, ctx: PayrollContext, personIds: readonly string[] = ["u-teacher"]) {
  return disburse(world.stores, ctx, {
    unitPath: KHALID_PATH,
    periodId: PERIOD.id,
    payingUnitId: "khalid",
    personIds,
    memoAr: "رواتبُ الشهر",
  })
}

// ═══ الاختبار الإلزاميّ الخامس — ق-٦٥ · ق-٧١ ═════════════════════════════════

describe("**ق-٦٥ — لا صرفَ بلا استحقاقٍ محسوب، ولا استحقاقٌ يُدفع مرتين**", () => {
  it("**لا صرفَ على خطةٍ غيرِ مختومة**: «المالُ المدفوع واقعةٌ لا اشتقاق»", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })
    const ctx = payrollContext({ world, approvedLessonIds: new Set([lessonId]) })

    const outcome = pay(world, ctx)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.code).toBe("PLAN_NOT_SEALED")
    expect(world.stores.ledger.entries(), "ولا قيدَ يُترك خلفه").toHaveLength(0)
  })

  /**
   * **ثغرةٌ اصطادها الكسرُ المُوجَّه** (قب-٤٦ §١): حارسُ الصرف يشترط شرطين —
   * `stage === "sealed"` **و**حمولةً غيرَ فارغة. وكان **الشرطُ الأول بلا اختبار**: لم يكن
   * في الطقم كلِّه منفذُ ختمٍ يعيد **مرحلةً غيرَ مختومةٍ مع حمولةٍ حاضرة**، فكسرُه يمرّ صامتاً.
   *
   * **والحالةُ ليست مصطنعة**: أوّلُ مَن يريد عرضَ أرقام الخطة **وهي تنتظر الإقرار** سيُعيد
   * الخطةَ المشتقّة مع `stage: "pending"` — وهو تغييرٌ بريءٌ في منفذٍ، **يفتح الصرفَ على
   * خطةٍ لم تُقرّ** فينهار المبدأ الحاكم من بابٍ لا أحدَ ينظر إليه. فالشرطُ يُثبَّت هنا.
   */
  it("**ولا صرفَ على خطةٍ تنتظر الإقرار — ولو حضرت حمولتُها** (ق-٥١)", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })
    const base = payrollContext({ world, approvedLessonIds: new Set([lessonId]) })
    const plan = derivePlan(world.stores, base, INPUT)

    const ctx = payrollContext({
      world,
      approvedLessonIds: new Set([lessonId]),
      // مُقدَّمةٌ وتنتظر الإدارة، **وحمولتُها حاضرةٌ للعرض** — والصرفُ يبقى مغلقاً.
      seal: () => ({ stage: "pending", plan }),
    })

    const outcome = pay(world, ctx)
    expect(outcome.ok, "**المرحلةُ شرطٌ لا الحمولةُ وحدها**").toBe(false)
    if (!outcome.ok) expect(outcome.error.code).toBe("PLAN_NOT_SEALED")
    expect(world.stores.ledger.entries(), "ولا قيدَ يُترك خلفه").toHaveLength(0)
  })

  it("**ولا صرفَ لمن لا سطرَ له في المختوم**", () => {
    const { world, ctx } = worldWithSealedHour()
    const outcome = pay(world, ctx, ["u-amir"])
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.code).toBe("NO_SEALED_ENTITLEMENT")
  })

  it("**ولا يُدفع استحقاقٌ مرتين** — والوسمُ آليٌّ لحظةَ الصرف ومشتقٌّ لا حقلٌ يُحدَّث", () => {
    const { world, ctx } = worldWithSealedHour()

    const first = pay(world, ctx)
    expect(first.ok).toBe(true)

    const second = pay(world, ctx)
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.error.code).toBe("ALREADY_PAID")
    expect(world.stores.ledger.entries(), "قيدٌ واحدٌ لا اثنان").toHaveLength(1)
  })

  it("**ولا دفعةَ فارغة** (ق-٧١): بلا مستحقين ⇒ رفضٌ قبل قراءة أيّ شيء", () => {
    const { world, ctx } = worldWithSealedHour()
    const outcome = pay(world, ctx, [])
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.code).toBe("EMPTY_BATCH")
  })

  it("**ولا يُصرف صافٍ صفريّ**: قيدٌ بلا مالٍ قيدٌ بلا معنى", () => {
    const world = seedWorld()
    // لا درسَ ولا نقاطَ ⇒ سطرٌ مختومٌ **صفريٌّ بسببه**، ولا يُصرف.
    const base = payrollContext({ world })
    const ctx = payrollContext({ world, seal: sealedFrom(world, base) })

    const outcome = pay(world, ctx)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.code).toBe("NOTHING_TO_PAY")
  })

  it("**ووحدةُ الصرف تُطابَق بجواب المحرّك** (ق-٦٥): المُعلَنةُ المخالفة تُرفض", () => {
    const { world } = worldWithSealedHour()
    const lessonId = world.log.sessions()[0]?.id
    const base = payrollContext({ world, approvedLessonIds: new Set([lessonId ?? ""]) })
    const ctx = payrollContext({
      world,
      approvedLessonIds: new Set([lessonId ?? ""]),
      seal: sealedFrom(world, base),
      // المحرّكُ يقول «بلال»، والمُعلَنُ «خالد» ⇒ رفض.
      payingUnit: () => BILAL_PATH,
    })

    const outcome = pay(world, ctx)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.code).toBe("NOT_PAYING_UNIT")
  })

  it("**وخلوُّ السلسلة من أمينٍ ⇒ رفضٌ يُقفل** لا صرفٌ من فراغ", () => {
    const { world } = worldWithSealedHour()
    const lessonId = world.log.sessions()[0]?.id
    const base = payrollContext({ world, approvedLessonIds: new Set([lessonId ?? ""]) })
    const ctx = payrollContext({
      world,
      approvedLessonIds: new Set([lessonId ?? ""]),
      seal: sealedFrom(world, base),
      payingUnit: () => null,
    })

    const outcome = pay(world, ctx)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.code).toBe("NO_PAYING_UNIT")
  })

  it("**ووحدةُ صرفٍ مجهولة تُرفض** — الكيانُ غيرُ الموجود يعني رفضاً", () => {
    const { world, ctx } = worldWithSealedHour()
    const outcome = disburse(world.stores, ctx, {
      unitPath: KHALID_PATH,
      periodId: PERIOD.id,
      payingUnitId: "لا-وجود-له",
      personIds: ["u-teacher"],
      memoAr: "رواتب",
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.code).toBe("UNKNOWN_PAYROLL_UNIT")
  })

  it("**والصرفُ الناجح: قيدٌ واحدٌ متوازنٌ بالإجمالي** (ق-٧١/ق-٧٢)", () => {
    const { world, ctx } = worldWithSealedHour(120)
    const outcome = pay(world, ctx)
    expect(outcome.ok).toBe(true)

    expect(world.stores.ledger.entries()).toHaveLength(1)
    expect(balanceProof(world.stores.ledger).balanced, "برهانُ التوازن يصمد").toBe(true)

    const cash = balancesByCurrency(world.stores.ledger, KHALID_PATH, ACCOUNTS.cash).get("USD")
    expect(cash?.net, "النقدُ نقص بمقدار الصافي").toBe(-2 * HOURLY_RATE)
  })

  it("**ومفتاحُ التكرار طبيعيٌّ**: القيدُ موسومٌ بمعرّف الصرف لا برقمٍ عشوائيّ (ق-٥٠)", () => {
    const { world, ctx } = worldWithSealedHour()
    const outcome = pay(world, ctx)
    if (!outcome.ok) throw new Error(outcome.error.code)
    const entry = world.stores.ledger.getEntry(outcome.value.entryId)
    expect(entry?.postingKey).toBe(`payroll:${outcome.value.id}`)
  })
})

// ═══ الاختبار الإلزاميّ السادس — ق-٦٩ السلفة ══════════════════════════════════

describe("**ق-٦٩ — السلفةُ ذمّةٌ مدينة تُسترد آلياً**", () => {
  function grant(world: PayrollWorld, ctx: PayrollContext, principal: number, instalment: number) {
    return grantAdvance(world.stores, ctx, {
      personId: "u-teacher",
      unitId: "khalid",
      operationId: `adv-op-${principal}-${instalment}`,
      principalCents: principal as Cents,
      instalmentCents: instalment as Cents,
      memoAr: "سلفةٌ للمعلّم",
    })
  }

  it("**المنحُ ذمّةٌ لا مصروف: صافي الأصول ثابتٌ بالسنت**", () => {
    const world = seedWorld()
    const ctx = payrollContext({ world })

    const before = balancesByCurrency(world.stores.ledger, KHALID_PATH)
    expect(before.size, "الدفترُ نظيفٌ قبل المنح").toBe(0)

    expect(grant(world, ctx, 1000, 400).ok).toBe(true)

    const cash = balancesByCurrency(world.stores.ledger, KHALID_PATH, ACCOUNTS.cash).get("USD")
    const receivable = balancesByCurrency(
      world.stores.ledger,
      KHALID_PATH,
      ACCOUNTS.staffReceivable,
    ).get("USD")

    expect(cash?.net).toBe(-1000)
    expect(receivable?.net).toBe(1000)
    // **أصلٌ حلّ محلَّ أصل** — فمجموعُهما صفرٌ: لا مصروفَ ولا نقصَ في صافي الأصول.
    expect((cash?.net ?? 0) + (receivable?.net ?? 0), "صافي الأصول ثابت").toBe(0)
    expect(balanceProof(world.stores.ledger).balanced).toBe(true)
  })

  it("**والقسطُ الأكبر من الأصل يُرفض** — عقدٌ مختلٌّ لا يُقبل ابتداءً", () => {
    const world = seedWorld()
    const ctx = payrollContext({ world })
    const outcome = grant(world, ctx, 1000, 1200)
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.code).toBe("INSTALMENT_EXCEEDS_PRINCIPAL")
    expect(world.stores.ledger.entries(), "ولا قيدَ يُترك خلفه").toHaveLength(0)
  })

  it("**وأصلٌ أو قسطٌ غيرُ موجبٍ يُرفض**", () => {
    const world = seedWorld()
    const ctx = payrollContext({ world })
    expect(grant(world, ctx, 0, 0).ok).toBe(false)
    expect(grant(world, ctx, 1000, 0).ok).toBe(false)
  })

  it("**ووحدةٌ مجهولةٌ تُرفض**", () => {
    const world = seedWorld()
    const outcome = grantAdvance(world.stores, payrollContext({ world }), {
      personId: "u-teacher",
      unitId: "لا-وجود-له",
      operationId: "adv-x",
      principalCents: 1000 as Cents,
      instalmentCents: 100 as Cents,
      memoAr: "سلفة",
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.code).toBe("UNKNOWN_PAYROLL_UNIT")
  })

  it("**والاستردادُ آليّ من الراتب و`net ≥ ٠`**: القسطُ لا يتجاوز الإجماليّ", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })
    const ctx0 = payrollContext({ world, approvedLessonIds: new Set([lessonId]) })
    // قسطٌ **أكبرُ من راتب الشهر** (٤٠٠) ⇒ يُقتطع بما لا يتجاوزه فقط.
    expect(grant(world, ctx0, 5000, 5000).ok).toBe(true)

    const line = derivePlan(world.stores, ctx0, INPUT).lines[0]!
    expect(line.grossCents).toBe(HOURLY_RATE)
    expect(line.deductionCents, "القسطُ محصورٌ بالإجماليّ").toBe(HOURLY_RATE)
    expect(line.netCents, "**ولا يخرج الموظفُ مديناً بشهرِ عمله**").toBe(0)
  })

  it("**وآخرُ قسطٍ الباقي فقط، وتُقفل عند الصفر**", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 600 }) // ١٠ ساعات
    const ctx0 = payrollContext({ world, approvedLessonIds: new Set([lessonId]) })
    const granted = grant(world, ctx0, 1000, 700)
    if (!granted.ok) throw new Error(granted.error.code)

    const ctx = payrollContext({
      world,
      approvedLessonIds: new Set([lessonId]),
      seal: sealedFrom(world, ctx0),
    })
    const first = pay(world, ctx)
    expect(first.ok).toBe(true)
    expect(outstandingOf(world.stores, granted.value.id), "بقي ٣٠٠").toBe(300)
    expect(world.stores.payroll.getAdvance(granted.value.id)?.closedAt, "لم تُقفل بعد").toBeNull()

    // الشهرُ التالي: **الباقي فقط** لا القسطُ الكامل.
    const nextPeriod = { ...INPUT, periodId: "2026-08" }
    const nextCtx = payrollContext({
      world,
      approvedLessonIds: new Set([lessonId]),
      seal: (_unitPath, p) =>
        p === "2026-08"
          ? { stage: "sealed", plan: derivePlan(world.stores, ctx0, nextPeriod) }
          : { stage: "derived", plan: null },
    })
    const line = derivePlan(world.stores, nextCtx, nextPeriod).lines[0]!
    expect(line.deductionCents, "**الباقي فقط** لا ٧٠٠").toBe(300)

    const second = disburse(world.stores, nextCtx, {
      unitPath: KHALID_PATH,
      periodId: "2026-08",
      payingUnitId: "khalid",
      personIds: ["u-teacher"],
      memoAr: "رواتبُ الشهر التالي",
    })
    expect(second.ok).toBe(true)
    expect(outstandingOf(world.stores, granted.value.id)).toBe(0)
    expect(
      world.stores.payroll.getAdvance(granted.value.id)?.closedAt,
      "**تُقفل عند الصفر** — حالةٌ لا حذف",
    ).not.toBeNull()
  })

  it("**والمقفلةُ لا تُسترد ثانيةً**: لا قسطَ على سلفةٍ انتهت", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 600 })
    const ctx0 = payrollContext({ world, approvedLessonIds: new Set([lessonId]) })
    const granted = grant(world, ctx0, 300, 300)
    if (!granted.ok) throw new Error(granted.error.code)

    const ctx = payrollContext({
      world,
      approvedLessonIds: new Set([lessonId]),
      seal: sealedFrom(world, ctx0),
    })
    expect(pay(world, ctx).ok).toBe(true)
    expect(world.stores.payroll.getAdvance(granted.value.id)?.closedAt).not.toBeNull()

    const after = derivePlan(world.stores, ctx0, { ...INPUT, periodId: "2026-09" }).lines[0]!
    expect(after.deductionCents, "لا قسطَ بعد الإقفال").toBe(0)
  })

  it("**ومَن لا سلفةَ له لا خصمَ عليه** — الخصمُ الوحيدُ مشتقٌّ من عقدِ سلفة (ب-٣١)", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })
    const line = derivePlan(
      world.stores,
      payrollContext({ world, approvedLessonIds: new Set([lessonId]) }),
      INPUT,
    ).lines[0]!
    expect(line.deductionCents).toBe(0)
    expect(line.netCents).toBe(line.grossCents)
  })

  it("**والمتبقّي على سلفةٍ مجهولة صفر** — قراءةٌ آمنةٌ لا رمية", () => {
    const world = seedWorld()
    expect(outstandingOf(world.stores, "لا-وجود-لها")).toBe(0)
  })
})

// ═══ ق-٦٦ — خريطةُ التوزيع ودفعةُ المنطقة ═════════════════════════════════════

describe("**ق-٦٦ — خريطةٌ تُري كلَّ توقّفٍ بصاحبه، ودفعةُ المنطقة لا تتكرر**", () => {
  it("**الخريطةُ مشتقّةٌ**: إجماليٌّ ومصروفٌ ومتبقٍّ، وكلُّ توقّفٍ بوحدته وصاحبه", () => {
    const { world, ctx } = worldWithSealedHour(120)
    const before = distributionMap(world.stores, ctx, {
      periodId: PERIOD.id,
      rootPath: HOMS_PATH,
      unitPaths: [KHALID_PATH],
    })

    expect(before.totalNetCents).toBe(2 * HOURLY_RATE)
    expect(before.paidNetCents).toBe(0)
    expect(before.remainingNetCents).toBe(2 * HOURLY_RATE)
    expect(before.stops).toEqual([
      { unitPath: KHALID_PATH, personId: "u-teacher", netCents: 2 * HOURLY_RATE, paid: false },
    ])

    expect(pay(world, ctx).ok).toBe(true)

    const after = distributionMap(world.stores, ctx, {
      periodId: PERIOD.id,
      rootPath: HOMS_PATH,
      unitPaths: [KHALID_PATH],
    })
    expect(after.paidNetCents, "«صُرف كذا من كذا»").toBe(2 * HOURLY_RATE)
    expect(after.remainingNetCents).toBe(0)
    expect(after.stops[0]?.paid).toBe(true)
  })

  it("**ووحدةٌ خارج الجذر لا تدخل الخريطة** — الاحتواءُ لا التجاور", () => {
    const { world, ctx } = worldWithSealedHour()
    const map = distributionMap(world.stores, ctx, {
      periodId: PERIOD.id,
      rootPath: "/women/",
      unitPaths: [KHALID_PATH],
    })
    expect(map.stops).toEqual([])
    expect(map.totalNetCents).toBe(0)
  })

  it("**ووحدةٌ بلا ختمٍ لا تُنتج توقّفاً** — لا رقمَ وهميّ (ق-١١٢)", () => {
    const { world, ctx } = worldWithSealedHour()
    const map = distributionMap(world.stores, ctx, {
      periodId: PERIOD.id,
      rootPath: HOMS_PATH,
      unitPaths: [BILAL_PATH],
    })
    expect(map.stops).toEqual([])
  })

  it("**ودفعةُ المنطقة لا تتكرر** (ق-٦٦ نصاً)", () => {
    const { world } = worldWithSealedHour()
    const ctx = payrollContext({ world, handover: () => ({ ok: true, entryId: "e-1" }) })
    const input = {
      periodId: PERIOD.id,
      fromUnitPath: HOMS_PATH,
      toUnitPath: VACANT_SQUARE_PATH,
      amountCents: 5000 as Cents,
      memoAr: "دفعةُ رواتب المنطقة",
    }

    expect(distributeToRegion(world.stores, ctx, input).ok).toBe(true)
    const again = distributeToRegion(world.stores, ctx, input)
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.code).toBe("REGION_ALREADY_DISTRIBUTED")
  })

  it("**والتسليمُ نازلٌ حصراً**: الصاعدُ والغريبةُ والوحدةُ نفسُها تُرفض (ق-٦١)", () => {
    const { world } = worldWithSealedHour()
    const ctx = payrollContext({ world, handover: () => ({ ok: true, entryId: "e-1" }) })
    const base = { periodId: PERIOD.id, amountCents: 5000 as Cents, memoAr: "دفعة" }

    for (const [fromUnitPath, toUnitPath] of [
      [KHALID_PATH, HOMS_PATH],
      [HOMS_PATH, HOMS_PATH],
      [KHALID_PATH, BILAL_PATH],
    ]) {
      const outcome = distributeToRegion(world.stores, ctx, {
        ...base,
        fromUnitPath: fromUnitPath!,
        toUnitPath: toUnitPath!,
      })
      expect(outcome.ok, `${fromUnitPath} ⟵ ${toUnitPath}`).toBe(false)
    }
  })

  it("**ولا دفعةَ بلا مبلغ، ولا مسارَ توزيعٍ بلا منفذ** — فشلٌ يُقفل ولا يُفتح", () => {
    const { world } = worldWithSealedHour()
    const withPort = payrollContext({ world, handover: () => ({ ok: true, entryId: "e-1" }) })
    const zero = distributeToRegion(world.stores, withPort, {
      periodId: PERIOD.id,
      fromUnitPath: HOMS_PATH,
      toUnitPath: VACANT_SQUARE_PATH,
      amountCents: 0 as Cents,
      memoAr: "دفعة",
    })
    expect(zero.ok).toBe(false)

    const noPort = payrollContext({ world })
    const blocked = distributeToRegion(world.stores, noPort, {
      periodId: PERIOD.id,
      fromUnitPath: HOMS_PATH,
      toUnitPath: VACANT_SQUARE_PATH,
      amountCents: 5000 as Cents,
      memoAr: "دفعة",
    })
    expect(blocked.ok).toBe(false)
  })

  it("**وفشلُ التسليم في موطنه يصل كما هو** — لا يُبتلع سببُ الصندوق", () => {
    const { world } = worldWithSealedHour()
    const ctx = payrollContext({
      world,
      handover: () => ({ ok: false, code: "NOT_RECEIVING_CUSTODIAN" }),
    })
    const outcome = distributeToRegion(world.stores, ctx, {
      periodId: PERIOD.id,
      fromUnitPath: HOMS_PATH,
      toUnitPath: VACANT_SQUARE_PATH,
      amountCents: 5000 as Cents,
      memoAr: "دفعة",
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.detail).toBe("NOT_RECEIVING_CUSTODIAN")
    expect(world.stores.payroll.distributionsIn(PERIOD.id), "ولا سجلَّ يُترك").toHaveLength(0)
  })
})

// ═══ ق-٧٧ — الحوافزُ استثناءٌ **لا تدخل أجرَ المعلّم** ═════════════════════════

describe("**ق-٧٧ — الحافزُ استثناءٌ لا التزام، ولا يُدمج في أجر المعلّم**", () => {
  it("**منحُ حافزٍ لمعلّمٍ لا يُغيّر إجماليَّ مستحقّه بقرشٍ واحد** — بالبنية لا بالانتباه", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })
    const ctx = payrollContext({ world, approvedLessonIds: new Set([lessonId]) })

    const before = derivePlan(world.stores, ctx, INPUT).lines[0]!.grossCents

    const granted = grantIncentive(world.stores, ctx, {
      personId: "u-teacher",
      unitId: "khalid",
      operationId: "inc-1",
      amountCents: 20_000 as Cents,
      memoAr: "تجهيزاتُ حلقة",
    })
    expect(granted.ok).toBe(true)

    const after = derivePlan(world.stores, ctx, INPUT).lines[0]!
    expect(after.grossCents, "**الساعةُ هي الأساس**").toBe(before)
    expect(after.tracks).toHaveLength(1)
    expect(balanceProof(world.stores.ledger).balanced).toBe(true)
  })

  /**
   * **ثغرةٌ ثانيةٌ اصطادها الكسرُ المُوجَّه**: عقدُ الوحدة §٧ يقول «قيدٌ مستقلٌّ **بمصدرٍ
   * مستقل** — فلا يختلط بأجرٍ في تقريرٍ ولا في دفتر». وكان `sourceType` **بلا اختبار**:
   * تبديلُه إلى `payroll` يمرّ صامتاً — **فيصير الحافزُ أجراً في كل تقريرٍ يقرأ نوعَ المصدر**،
   * وهو بعينه ما تمنعه ق-٧٧ («لا حوافزُ أداءٍ مدمجةٌ في أجر المعلم»).
   * فالفصلُ يُثبَّت **في الدفتر** لا في نيّة الكاتب.
   */
  it("**والحافزُ مصروفٌ في الدفتر لا راتب** — فلا يختلط بالأجر في تقرير (ق-٧٧)", () => {
    const world = seedWorld()
    const ctx = payrollContext({ world })
    const granted = grantIncentive(world.stores, ctx, {
      personId: "u-teacher",
      unitId: "khalid",
      operationId: "inc-src",
      amountCents: 20_000 as Cents,
      memoAr: "تجهيزاتُ حلقة",
    })
    if (!granted.ok) throw new Error(granted.error.code)

    const entry = world.stores.ledger.getEntry(granted.value.entryId)
    expect(entry?.sourceType, "**مصروفٌ لا راتب** — الفصلُ في الدفتر لا في النيّة").toBe("expense")
    expect(entry?.postingKey).toBe("expense:inc-src")
  })

  it("**ولا حافزَ بمبلغٍ غيرِ موجب، ولا في وحدةٍ مجهولة**", () => {
    const world = seedWorld()
    const ctx = payrollContext({ world })
    const base = { personId: "u-teacher", memoAr: "حافز", operationId: "inc-2" }

    expect(
      grantIncentive(world.stores, ctx, { ...base, unitId: "khalid", amountCents: 0 as Cents }).ok,
    ).toBe(false)
    expect(
      grantIncentive(world.stores, ctx, { ...base, unitId: "س", amountCents: 100 as Cents }).ok,
    ).toBe(false)
  })
})
