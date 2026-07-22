/**
 * **حوافُّ الوحدة** — الطرقُ التي لا يسلكها المسارُ السعيد: إعدادٌ بنوعٍ خاطئ، ومعدّلٌ لم
 * يُضبط، وختمٌ مختلُّ الشكل، وقراءاتُ المستودع، وارتدادُ المعاملة.
 *
 * **وليست هذه «رفعَ نسبة»**: كلُّ حالةٍ هنا **سؤالٌ ماليٌّ حقيقيّ** — ماذا يحدث حين يخطئ
 * الإعداد؟ وحين تصل حمولةٌ مختلّة؟ وحين يفشل القيدُ في منتصف العملية؟ الجوابُ في المال
 * لا يجوز أن يكون «لا ندري» (TESTING_POLICY §٣: التغطيةُ شرطٌ لازمٌ غيرُ كافٍ، والمقيسُ
 * **جودةُ التوكيدات**).
 */
import { describe, it, expect } from "vitest"
import {
  settingNumberOrUnset,
  settingText,
} from "../../../src/features/payroll/services/context.js"
import {
  baseCurrency,
  fixedSalaryCents,
  hourlyRateCents,
  minutesToCents,
  pointPackage,
  pointsToCents,
} from "../../../src/features/payroll/services/rates.js"
import { NO_SEAL, rootAssignedRoster } from "../../../src/features/payroll/services/ports.js"
import { monthlyPlan, ownPayslip } from "../../../src/features/payroll/services/plan.js"
import { derivePlan } from "../../../src/features/payroll/services/derive.js"
import { disburse } from "../../../src/features/payroll/services/payout.js"
import { grantAdvance, recordInstalment } from "../../../src/features/payroll/services/advances.js"
import { grantIncentive } from "../../../src/features/payroll/services/incentives.js"
import {
  distributeToRegion,
  distributionMap,
} from "../../../src/features/payroll/services/distribution.js"
import { computePayrollCaps } from "../../../src/features/payroll/screens/caps.js"
import { payrollErr, payrollOk } from "../../../src/features/payroll/types.js"
import { PayrollStore } from "../../../src/features/payroll/data/store.js"
import type { Cents } from "../../../src/features/ledger/types.js"
import type { Actor } from "../../../src/authorization/can.js"
import {
  DECISION,
  FROM,
  HOMS_PATH,
  HOURLY_RATE,
  KHALID_PATH,
  NOW,
  PERIOD,
  TO,
  VACANT_SQUARE_PATH,
  canonicalActor,
  payrollContext,
  ratedSettings,
  recordRealLesson,
  seedWorld,
  settingsWith,
} from "./_seed.js"

const INPUT = {
  unitPath: KHALID_PATH,
  periodId: PERIOD.id,
  from: FROM,
  to: TO,
  personIds: ["u-teacher"],
}

describe("قراءةُ الإعدادات — **الخطأُ في النوع خطأٌ برمجيٌّ يُرمى، لا قيمةٌ تُخمَّن**", () => {
  it("إعدادٌ ليس نصاً ⇒ رميةٌ مُشخِّصة باسمه", () => {
    const world = seedWorld()
    const ctx = payrollContext({ world })
    expect(() => settingText(ctx, "points.weekly_target", "/")).toThrow(/ليس نصاً/)
  })

  it("**والإعدادُ المسجَّل بلا افتراضيّ غيابٌ لا صفر** (ق-م-٢) — والنوعُ الخاطئ يبقى رمية", () => {
    const world = seedWorld()
    const unset = payrollContext({ world, settings: settingsWith() })
    expect(settingNumberOrUnset(unset, "finance.hourly_rate.amount", "/")).toBeNull()
    expect(settingNumberOrUnset(unset, "points.weekly_target", "/")).toBe(70)
    expect(() => settingNumberOrUnset(unset, "finance.currency.base", "/")).toThrow(/ليس رقماً/)
  })
})

describe("المعدّلات — **حزمةٌ ناقصةٌ لا تُنتج معدّلاً مخترعاً** (ق-٣٦)", () => {
  it("أجرُ الساعة والراتبُ المقطوع: مضبوطان يُقرآن، وغيرُ المضبوطَين `null`", () => {
    const world = seedWorld()
    expect(hourlyRateCents(payrollContext({ world }), "/")).toBe(HOURLY_RATE)
    expect(fixedSalaryCents(payrollContext({ world }), "/")).toBe(10_000)

    const bare = payrollContext({ world, settings: settingsWith() })
    expect(hourlyRateCents(bare, "/")).toBeNull()
    expect(fixedSalaryCents(bare, "/")).toBeNull()
  })

  it("**وحزمةُ النقاط بطرفيها أو لا معدّل**: مقامٌ غيرُ موجب ⇒ `null` لا قسمةٌ على صفر", () => {
    const world = seedWorld()
    expect(pointPackage(payrollContext({ world }), "/")).toEqual({
      amountCents: 5000,
      perUnit: 280,
    })

    const broken = payrollContext({
      world,
      settings: ratedSettings([
        { settingId: "finance.point_rate.per_unit", scopePath: "/", value: 0, validFrom: FROM },
      ]),
    })
    expect(pointPackage(broken, "/"), "**لا تُقسَم على صفرٍ ولا يُخترع معدّل**").toBeNull()
  })

  it("**والمقامُ المختلُّ يُنتج سبباً معروضاً لا انهياراً** (ع-٢٥)", () => {
    const world = seedWorld()
    const ctx = payrollContext({
      world,
      beneficiaries: [["u-amir", KHALID_PATH]],
      points: { [KHALID_PATH]: { points: 280, periodKeys: ["w1"], unapprovedPoints: 0 } },
      settings: ratedSettings([
        { settingId: "finance.point_rate.per_unit", scopePath: "/", value: 0, validFrom: FROM },
      ]),
    })
    const line = derivePlan(world.stores, ctx, { ...INPUT, personIds: ["u-amir"] }).lines[0]!
    expect(line.silences.find((s) => s.track === "points")?.code).toBe("POINT_RATE_UNSET")
  })

  it("والقسمةُ صحيحةٌ نحو الأسفل في المسارين (ق-٤٨) — لا كسرَ يتسرّب", () => {
    expect(minutesToCents(50, 333 as Cents)).toBe(277)
    expect(pointsToCents(7, 5000 as Cents, 280)).toBe(125)
    expect(Number.isInteger(minutesToCents(7, 101 as Cents))).toBe(true)
  })

  it("وعملةُ الدفتر من الإعداد لا من الكود", () => {
    const world = seedWorld()
    expect(baseCurrency(payrollContext({ world }), "/")).toBe("USD")
  })
})

describe("منافذُ الوحدة — **الافتراضُ في كل سياقٍ «لم يقع»**", () => {
  it("`NO_SEAL`: لا ختمَ ما لم يقع فعلٌ — والاعتمادُ فعلٌ يقع لا حالةٌ ضمنية", () => {
    expect(NO_SEAL(KHALID_PATH, PERIOD.id)).toEqual({ stage: "derived", plan: null })
  })

  /** ق-٣٩ — **إسنادُ الجذر لا اسمُ الدور** (G6)، وبشروط الإسناد الفعّال (ق-٢٤/ق-٢٥). */
  it("**رِبطُ الراتب المقطوع**: الجذرُ وحده، والمعتمَدُ وحده، وضمن مداه وحده", () => {
    const base = canonicalActor("u-admin")
    const at = (over: Partial<Actor["assignments"][number]>, path = "/"): Actor => ({
      ...base,
      personId: `p-${JSON.stringify(over)}${path}`,
      assignments: [{ ...base.assignments[0]!, scopePath: path, ...over }],
    })

    const people: Actor[] = [
      at({}),
      at({}, "/men/"),
      at({ approvalStatus: "pending" }),
      at({ unitArchived: true }),
      at({ endDate: new Date("2026-01-01T00:00:00.000Z") }),
      at({ startDate: new Date("2027-01-01T00:00:00.000Z") }),
    ]
    const roster = rootAssignedRoster(people, NOW)()

    expect(roster, "المعتمَدُ على الجذر ضمن مداه وحده").toEqual([people[0]!.personId])
  })
})

describe("خطةُ الشهر — **الحمولةُ المختلّةُ تُقفل ولا تنهار**، والكشفُ الشخصيُّ يُصفّى", () => {
  it("**ختمٌ مُعلَنٌ بلا حمولةٍ صالحة ⇒ يُعرَض الاشتقاقُ الحيّ ولا فارقَ مزعوم**", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })
    const ctx = payrollContext({
      world,
      approvedLessonIds: new Set([lessonId]),
      seal: () => ({ stage: "sealed", plan: null }),
    })

    const view = monthlyPlan(world.stores, ctx, INPUT)
    expect(view.stage).toBe("sealed")
    expect(view.totalNetCents, "لا شاشةَ تنهار").toBe(HOURLY_RATE)
    expect(view.drift, "ولا فارقَ يُزعم بلا مختومٍ يُقارن به").toEqual([])
  })

  it("**وكشفُ راتبي يُصفّي كلَّ شيء على صاحبه**: سطراً وفارقاً ووسمَ صرف", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })
    const base = payrollContext({ world, approvedLessonIds: new Set([lessonId]) })
    const sealedPlan = derivePlan(world.stores, base, INPUT)

    const ctx = payrollContext({
      world,
      approvedLessonIds: new Set(),
      seal: () => ({ stage: "sealed", plan: sealedPlan }),
    })

    const mine = ownPayslip(world.stores, ctx, INPUT, "u-teacher")
    expect(mine.lines.map((l) => l.personId)).toEqual(["u-teacher"])
    expect(mine.drift, "الفارقُ يظهر في كشفه هو أيضاً").toHaveLength(1)

    const stranger = ownPayslip(world.stores, ctx, INPUT, "u-amir")
    expect(stranger.lines, "ولا سطرَ لغير صاحبه").toEqual([])
    expect(stranger.paidPersonIds).toEqual([])
  })
})

describe("المستودعُ — **قراءاتٌ مجمَّدةٌ وارتدادٌ ذرّيّ**", () => {
  it("كلُّ قراءةٍ تُعيد ما حُفظ، والشبكةُ مختومةٌ من المستودع لا من المدخل", () => {
    const store = new PayrollStore("t-x")
    store.saveAdvance({
      tenantId: "مزوَّر",
      id: "adv-1",
      personId: "p1",
      unitPath: KHALID_PATH,
      entryId: "e1",
      principalCents: 500 as Cents,
      instalmentCents: 100 as Cents,
      grantedAt: NOW,
      closedAt: null,
    })
    expect(store.getAdvance("adv-1")?.tenantId, "الشبكةُ من المستودع").toBe("t-x")
    expect(store.advances()).toHaveLength(1)
    expect(store.getAdvance("لا-وجود")).toBeNull()
    expect(store.openAdvancesOf("p1")).toHaveLength(1)
    expect(store.openAdvancesOf("p2")).toHaveLength(0)

    store.appendInstalment({
      tenantId: "t-x",
      id: "ins-1",
      advanceId: "adv-1",
      periodId: PERIOD.id,
      entryId: "e2",
      amountCents: 100 as Cents,
    })
    expect(store.instalmentsOf("adv-1")).toHaveLength(1)
    expect(store.instalmentsOf("adv-2")).toHaveLength(0)

    store.appendIncentive({
      tenantId: "t-x",
      id: "inc-1",
      personId: "p1",
      unitPath: KHALID_PATH,
      entryId: "e3",
      grantedBy: "u-admin",
      at: NOW,
    })
    expect(store.incentives()).toHaveLength(1)
    expect(store.nextId("x")).toMatch(/^x-\d+$/)
  })

  it("**والمعاملةُ ترتدّ بكاملها عند أيّ رمية** — لا نصفَ حالة", () => {
    const store = new PayrollStore("t-y")
    expect(() =>
      store.transaction(() => {
        store.appendDistribution({
          tenantId: "t-y",
          id: "d-1",
          periodId: PERIOD.id,
          toUnitPath: HOMS_PATH,
          at: NOW,
        })
        throw new Error("تعثّرٌ في المنتصف")
      }),
    ).toThrow(/تعثّر/)
    expect(store.distributionsIn(PERIOD.id), "**ارتدّ كلُّ شيء**").toHaveLength(0)
    expect(store.hasDistribution(PERIOD.id, HOMS_PATH)).toBe(false)
  })

  it("**وارتدادُ الصرف عابرٌ للمستودعين**: قيدٌ فاشلٌ لا يترك سجلَّ صرف", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })
    const base = payrollContext({ world, approvedLessonIds: new Set([lessonId]) })
    const plan = derivePlan(world.stores, base, INPUT)
    const ctx = payrollContext({
      world,
      approvedLessonIds: new Set([lessonId]),
      seal: () => ({ stage: "sealed", plan }),
      // عملةٌ غيرُ مفعَّلة ⇒ النواةُ ترفض القيد ⇒ لا سجلَّ صرفٍ يبقى.
      settings: ratedSettings([
        { settingId: "finance.currency.base", scopePath: "/", value: "TRY", validFrom: FROM },
        { settingId: "finance.currencies.enabled", scopePath: "/", value: ["USD"], validFrom: FROM },
      ]),
    })

    const outcome = disburse(world.stores, ctx, {
      unitPath: KHALID_PATH,
      periodId: PERIOD.id,
      payingUnitId: "khalid",
      personIds: ["u-teacher"],
      memoAr: "رواتب",
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.code, "سببُ النواة يصل كما هو").toBe("CURRENCY_NOT_ENABLED")
    expect(world.stores.payroll.payouts(), "ولا سجلَّ صرفٍ يبقى").toHaveLength(0)
    expect(world.stores.ledger.entries()).toHaveLength(0)
  })
})

describe("حوافُّ السلفة والحافز والتوزيع", () => {
  it("**مبلغٌ كسريٌّ يُرفض عند الحدّ** لا يُقرَّب صامتاً (ق-٤٨)", () => {
    const world = seedWorld()
    const ctx = payrollContext({ world })
    const fractional = grantAdvance(world.stores, ctx, {
      personId: "u-teacher",
      unitId: "khalid",
      operationId: "adv-f",
      principalCents: 10.5 as Cents,
      instalmentCents: 1 as Cents,
      memoAr: "سلفة",
    })
    expect(fractional.ok).toBe(false)
    if (!fractional.ok) expect(fractional.error.code).toBe("FRACTIONAL_AMOUNT")

    const badInstalment = grantAdvance(world.stores, ctx, {
      personId: "u-teacher",
      unitId: "khalid",
      operationId: "adv-f2",
      principalCents: 100 as Cents,
      instalmentCents: 2.5 as Cents,
      memoAr: "سلفة",
    })
    expect(badInstalment.ok).toBe(false)

    const badIncentive = grantIncentive(world.stores, ctx, {
      personId: "u-teacher",
      unitId: "khalid",
      operationId: "inc-f",
      amountCents: 3.5 as Cents,
      memoAr: "حافز",
    })
    expect(badIncentive.ok).toBe(false)
  })

  /** دفاعٌ في العمق: صفٌّ مهاجَرٌ يخالف ثابتَ «المفتوحةُ متبقّيها موجب» لا يُنتج قسطاً صفرياً. */
  it("**وسلفةٌ مفتوحةٌ استُوفيت أقساطُها لا تُنتج قسطاً** — لا سطرَ خصمٍ بلا معنى", async () => {
    const { dueInstalmentFor } = await import(
      "../../../src/features/payroll/services/advances.js"
    )
    const world = seedWorld()
    world.stores.payroll.saveAdvance({
      tenantId: "t-main",
      id: "adv-legacy",
      personId: "u-teacher",
      unitPath: KHALID_PATH,
      entryId: "e-legacy",
      principalCents: 500 as Cents,
      instalmentCents: 500 as Cents,
      grantedAt: NOW,
      closedAt: null,
    })
    world.stores.payroll.appendInstalment({
      tenantId: "t-main",
      id: "ins-legacy",
      advanceId: "adv-legacy",
      periodId: PERIOD.id,
      entryId: "e-legacy-2",
      amountCents: 500 as Cents,
    })
    expect(dueInstalmentFor(world.stores, "u-teacher", 10_000 as Cents)).toBeNull()
  })

  it("**وقيدٌ يرفضه الدفترُ يُسقط المنحَ كلَّه** — لا سلفةَ بلا قيدها، ولا حافزَ", () => {
    const world = seedWorld()
    const ctx = payrollContext({
      world,
      settings: ratedSettings([
        { settingId: "finance.currency.base", scopePath: "/", value: "TRY", validFrom: FROM },
        { settingId: "finance.currencies.enabled", scopePath: "/", value: ["USD"], validFrom: FROM },
      ]),
    })

    const advance = grantAdvance(world.stores, ctx, {
      personId: "u-teacher",
      unitId: "khalid",
      operationId: "adv-rej",
      principalCents: 100 as Cents,
      instalmentCents: 10 as Cents,
      memoAr: "سلفة",
    })
    expect(advance.ok).toBe(false)
    if (!advance.ok) expect(advance.error.code).toBe("CURRENCY_NOT_ENABLED")
    expect(world.stores.payroll.advances()).toHaveLength(0)

    const incentive = grantIncentive(world.stores, ctx, {
      personId: "u-teacher",
      unitId: "khalid",
      operationId: "inc-rej",
      amountCents: 100 as Cents,
      memoAr: "حافز",
    })
    expect(incentive.ok).toBe(false)
    expect(world.stores.payroll.incentives()).toHaveLength(0)
  })

  it("**ومستفيدُ نقاطٍ بلا نشاطٍ أصلاً**: «لا نشاطَ مسجّلاً» لا «لم يُعتمد» (ع-٢٥)", () => {
    const world = seedWorld()
    const ctx = payrollContext({ world, beneficiaries: [["u-amir", KHALID_PATH]] })
    const line = derivePlan(world.stores, ctx, { ...INPUT, personIds: ["u-amir"] }).lines[0]!
    expect(line.silences.find((s) => s.track === "points")?.code).toBe("NO_POINTS_RECORDED")
  })

  it("**وقسطٌ يُسجَّل على سلفةٍ مجهولة لا يُقفل شيئاً** — قراءةٌ آمنة", () => {
    const world = seedWorld()
    recordInstalment(world.stores, payrollContext({ world }), {
      advanceId: "لا-وجود-لها",
      periodId: PERIOD.id,
      entryId: "e-x",
      amountCents: 10 as Cents,
    })
    expect(world.stores.payroll.instalmentsOf("لا-وجود-لها")).toHaveLength(1)
    expect(world.stores.payroll.advances()).toHaveLength(0)
  })

  it("**وخريطةُ التوزيع تُسقط السطرَ الصفريَّ ولا تعدّه توقّفاً** (ق-١١٢)", () => {
    const world = seedWorld()
    const base = payrollContext({ world })
    const zeroPlan = derivePlan(world.stores, base, INPUT)
    const ctx = payrollContext({ world, seal: () => ({ stage: "sealed", plan: zeroPlan }) })

    const map = distributionMap(world.stores, ctx, {
      periodId: PERIOD.id,
      rootPath: HOMS_PATH,
      unitPaths: [KHALID_PATH],
    })
    expect(map.stops, "صفرٌ ليس توقّفاً — لا مالَ واقفاً هناك").toEqual([])
    expect(map.totalNetCents).toBe(0)
  })

  it("**والمناطقُ الموزَّعة تظهر في الخريطة** مرتَّبةً — «لا تتكرر» يُرى لا يُخمَّن", () => {
    const world = seedWorld()
    const ctx = payrollContext({ world, handover: () => ({ ok: true, entryId: "e-1" }) })
    expect(
      distributeToRegion(world.stores, ctx, {
        periodId: PERIOD.id,
        fromUnitPath: HOMS_PATH,
        toUnitPath: VACANT_SQUARE_PATH,
        amountCents: 100 as Cents,
        memoAr: "دفعة",
      }).ok,
    ).toBe(true)

    const map = distributionMap(world.stores, ctx, {
      periodId: PERIOD.id,
      rootPath: HOMS_PATH,
      unitPaths: [],
    })
    expect(map.distributedRegions).toEqual([VACANT_SQUARE_PATH])
  })
})

describe("قشرةُ القدرات — **الشخصيةُ لا تُحسب بنطاق** (§١.١)", () => {
  it("`payroll.own` ليست في القشرة المنطاقة ولو ملكها الفاعل", () => {
    const caps = computePayrollCaps(canonicalActor("u-finance"), KHALID_PATH, DECISION)
    expect(caps.has("payroll.own"), "وإلا ظهر بابٌ شخصيٌّ للجميع").toBe(false)
    expect(caps.has("payroll.view")).toBe(true)
  })
})

describe("أخطاءُ العمل قيمٌ معلنة (المادة ٣/٤)", () => {
  it("`payrollErr` بتفصيلٍ وبلا تفصيل، و`payrollOk` يحمل قيمته", () => {
    expect(payrollErr("ALREADY_PAID")).toEqual({ ok: false, error: { code: "ALREADY_PAID" } })
    expect(payrollErr("ALREADY_PAID", "u-teacher")).toEqual({
      ok: false,
      error: { code: "ALREADY_PAID", detail: "u-teacher" },
    })
    expect(payrollOk(7)).toEqual({ ok: true, value: 7 })
  })
})
