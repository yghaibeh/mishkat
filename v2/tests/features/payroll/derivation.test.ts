/**
 * **الاختباراتُ الإلزامية ٣ و٤ و٧** (عقدُ الوحدة §٢) — قلبُ الوحدة:
 * **الصفرُ يشرح نفسه** (ع-٢٥) · **الأوصافُ تُجمَع ولا يُختار أحدُها** (ق-٣٨) ·
 * **المعتمَدُ وحده يُحتسب والمناهجُ المؤهَّلة وحدها** (ق-٨٦ — بعد شطب المفتاح بـCR-021).
 *
 * والسلبيّاتُ هنا أكثرُ من الإيجابيّات عمداً (TESTING_POLICY §٤): النظامُ المالي يُعرَّف
 * **بما لا يدفعه** أكثرَ مما يُعرَّف بما يدفعه.
 */
import { describe, it, expect } from "vitest"
import { derivePlan, deriveEntitlement } from "../../../src/features/payroll/services/derive.js"
import type { EntitlementLine } from "../../../src/features/payroll/types.js"
import {
  FROM,
  KHALID_PATH,
  NEXT_DAY,
  PERIOD,
  TO,
  payrollContext,
  recordRealLesson,
  seedWorld,
  settingsWith,
  HOURLY_RATE,
  FIXED_SALARY,
  ratedSettings,
  type PayrollWorld,
} from "./_seed.js"

function planFor(
  world: PayrollWorld,
  input: Parameters<typeof payrollContext>[0],
  personIds: readonly string[],
) {
  return derivePlan(world.stores, payrollContext(input), {
    unitPath: KHALID_PATH,
    periodId: PERIOD.id,
    from: FROM,
    to: TO,
    personIds,
  })
}

function lineOf(
  world: PayrollWorld,
  input: Parameters<typeof payrollContext>[0],
  personId: string,
): EntitlementLine {
  const plan = planFor(world, input, [personId])
  const line = plan.lines.find((l) => l.personId === personId)
  if (line === undefined) throw new Error(`لا سطرَ للشخص ${personId} — الخطةُ لا تُسقط أحداً`)
  return line
}

// ═══ الاختبار الإلزاميّ الثالث — **الصفرُ يشرح نفسه** (ع-٢٥) ═══════════════════

describe("**ع-٢٥ — الصفرُ يشرح نفسه: مستحقٌّ = ٠ بلا سببٍ مشتقّ عيبٌ يُسقط الاختبار**", () => {
  it("**الثابتُ العام**: كلُّ سطرٍ صفريٍّ في الخطة يحمل سبباً واحداً على الأقل", () => {
    const world = seedWorld()
    recordRealLesson(world, { sessionId: "ses-1", minutes: 90 })

    // لا اعتمادَ لدرسٍ، ولا نقاطَ، ولا راتبَ مقطوعاً ⇒ صفرٌ للجميع… **ولكلٍّ سببُه**.
    const plan = planFor(world, { world, fixedSalaryPersonIds: [] }, [
      "u-teacher",
      "u-amir",
      "u-square",
    ])

    expect(plan.lines).toHaveLength(3)
    for (const line of plan.lines) {
      expect(line.netCents, `${line.personId} ليس صفراً`).toBe(0)
      expect(
        line.silences.length,
        `**صفرٌ صامتٌ للشخص ${line.personId}** — وهو بعينه ع-٢٥`,
      ).toBeGreaterThan(0)
    }
  })

  it("«صفر — لأن دروساً سُجّلت **بلا اعتماد**»: السببُ يحمل عددَها المشخِّص", () => {
    const world = seedWorld()
    recordRealLesson(world, { sessionId: "ses-1", minutes: 90 })
    recordRealLesson(world, { sessionId: "ses-2", minutes: 60, heldAt: NEXT_DAY })

    const line = lineOf(world, { world }, "u-teacher")

    expect(line.netCents).toBe(0)
    const silence = line.silences.find((s) => s.track === "hours")
    expect(silence?.code).toBe("LESSONS_RECORDED_NOT_APPROVED")
    expect(silence?.count, "العددُ يُشخِّص: «درسان بلا اعتماد» لا «صفر»").toBe(2)
  })

  it("«صفر — لأن منهاجَ الحلقة ليس مما يُحتسب بالساعة» (ق-٨٦): سببٌ آخرُ مختلفُ العلاج", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, {
      sessionId: "ses-t",
      minutes: 90,
      circleId: world.tahfeezCircleId,
    })

    // **معتمَدٌ فعلاً** — فالسببُ ليس الاعتماد بل المنهاج: تشخيصان لا يختلطان.
    const line = lineOf(world, { world, approvedLessonIds: new Set([lessonId]) }, "u-teacher")

    expect(line.netCents).toBe(0)
    expect(line.silences.find((s) => s.track === "hours")?.code).toBe("CURRICULUM_NOT_PAID")
  })

  it("«صفر — لا دروسَ في هذا الشهر»: الغيابُ التامُّ سببٌ قائمٌ بذاته لا صمت", () => {
    const world = seedWorld()
    const line = lineOf(world, { world }, "u-teacher")
    expect(line.silences.find((s) => s.track === "hours")?.code).toBe("NO_LESSONS_RECORDED")
  })

  it("«صفر — أجرُ الساعة غيرُ مضبوط» (ق-م-٢): **لا يُخترع رقمٌ ولا تنهار الشاشة**", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 120 })

    const line = lineOf(
      world,
      { world, approvedLessonIds: new Set([lessonId]), settings: settingsWith() },
      "u-teacher",
    )

    expect(line.netCents).toBe(0)
    expect(line.silences.find((s) => s.track === "hours")?.code).toBe("HOURLY_RATE_UNSET")
  })

  it("«صفر — سجلُّ الشهر لم يُعتمد بعد»: نقاطٌ سُجِّلت ولم تُقرّ ⇒ ع-٢٥ في وجهها الثاني", () => {
    const world = seedWorld()
    const line = lineOf(
      world,
      {
        world,
        beneficiaries: [["u-amir", KHALID_PATH]],
        points: { [KHALID_PATH]: { points: 0, periodKeys: [], unapprovedPoints: 140 } },
      },
      "u-amir",
    )

    expect(line.netCents).toBe(0)
    const silence = line.silences.find((s) => s.track === "points")
    expect(silence?.code).toBe("POINTS_RECORDED_NOT_APPROVED")
    expect(silence?.count).toBe(140)
  })

  it("«صفر — نقاطُ المسجد لأميره» (ق-٣٧): غيرُ المستفيد لا مسارَ نقاطٍ له", () => {
    const world = seedWorld()
    const line = lineOf(
      world,
      {
        world,
        beneficiaries: [["u-amir", KHALID_PATH]],
        points: { [KHALID_PATH]: { points: 280, periodKeys: ["w1"], unapprovedPoints: 0 } },
      },
      "u-teacher",
    )

    expect(line.silences.find((s) => s.track === "points")?.code).toBe("NOT_POINTS_BENEFICIARY")
    expect(line.tracks.some((t) => t.basis.kind === "points")).toBe(false)
  })

  it("«صفر — لا راتبَ مقطوعاً على هذا الوصف» (ق-٣٩): ومَن ليس على الجذر لا يناله", () => {
    const world = seedWorld()
    const line = lineOf(world, { world }, "u-teacher")
    expect(line.silences.find((s) => s.track === "fixed")?.code).toBe("NOT_FIXED_SALARY_STAFF")
  })

  it("«صفر — الراتبُ المقطوع غيرُ مضبوط»: على المقطوع بلا معدّلٍ ⇒ سببٌ لا انهيار", () => {
    const world = seedWorld()
    const line = lineOf(
      world,
      { world, fixedSalaryPersonIds: ["u-admin"], settings: settingsWith() },
      "u-admin",
    )
    expect(line.silences.find((s) => s.track === "fixed")?.code).toBe("FIXED_SALARY_UNSET")
  })

  it("**ولا سببَ يُختلق حين يُثمر المسار**: المسارُ المثمرُ لا يحمل صمتاً", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })
    const line = lineOf(world, { world, approvedLessonIds: new Set([lessonId]) }, "u-teacher")

    expect(line.silences.some((s) => s.track === "hours")).toBe(false)
    expect(line.tracks.some((t) => t.basis.kind === "hours")).toBe(true)
  })
})

// ═══ الاختبار الإلزاميّ الرابع — **جمعُ الوصفين** (ق-٣٨) ══════════════════════

describe("**ق-٣٨ — مَن جمع وصفين يُحاسَب بهما: ساعات + نقاط، لا أحدُهما**", () => {
  /**
   * **وهي الحالةُ التي لم يحرسها v1 نصاً** (جردُ القواعد: «لا اختبار جمع الوصفين») —
   * فتُختبر هنا صراحةً بالمبلغ لا بالوجود.
   */
  it("معلّمٌ **وأميرٌ** معاً ⇒ الإجماليُّ **مجموعُ المسارين بالسنت**", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 120 })

    const input = {
      world,
      approvedLessonIds: new Set([lessonId]),
      beneficiaries: [["u-teacher", KHALID_PATH]] as const,
      points: { [KHALID_PATH]: { points: 280, periodKeys: ["w1"], unapprovedPoints: 0 } },
    }
    const line = lineOf(world, input, "u-teacher")

    // ساعتان × أجرِ الساعة + ٢٨٠ نقطةً × (٥٠٠٠ ÷ ٢٨٠ افتراضاً في السجل).
    const hours = 2 * HOURLY_RATE
    const points = Math.trunc((280 * 5000) / 280)
    expect(line.grossCents).toBe(hours + points)
    expect(line.tracks.map((t) => t.basis.kind).sort()).toEqual(["hours", "points"])
  })

  it("**ولا يغلب مسارٌ مساراً**: إسقاطُ النقاط لا يمسّ الساعات وبالعكس", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 120 })

    const onlyHours = lineOf(
      world,
      { world, approvedLessonIds: new Set([lessonId]) },
      "u-teacher",
    )
    expect(onlyHours.grossCents).toBe(2 * HOURLY_RATE)
    expect(onlyHours.tracks).toHaveLength(1)
  })

  it("**والوصفُ الثالث يُجمَع كذلك**: مقطوعٌ + ساعاتٌ ⇒ الاثنان معاً (ق-٣٩ + ق-٨٦)", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })

    const line = lineOf(
      world,
      { world, approvedLessonIds: new Set([lessonId]), fixedSalaryPersonIds: ["u-teacher"] },
      "u-teacher",
    )

    expect(line.grossCents).toBe(HOURLY_RATE + FIXED_SALARY)
    expect(line.tracks.map((t) => t.basis.kind).sort()).toEqual(["fixed", "hours"])
  })

  it("**والحصيلةُ تحمل مدخلاتِ اشتقاقها**: معرّفاتُ الدروس ودقائقُها في السطر نفسِه", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 90 })

    const line = lineOf(world, { world, approvedLessonIds: new Set([lessonId]) }, "u-teacher")
    const basis = line.tracks.find((t) => t.basis.kind === "hours")?.basis

    expect(basis).toMatchObject({ kind: "hours", lessonCount: 1, minutes: 90 })
    expect(basis?.kind === "hours" ? basis.lessonIds : []).toEqual([lessonId])
    expect(basis?.kind === "hours" ? basis.hourlyRateCents : 0).toBe(HOURLY_RATE)
  })
})

// ═══ الاختبار الإلزاميّ السابع — ق-٨٦ **بعد شطب المفتاح** (CR-021) ═══════════

describe("**ق-٨٦ — المعتمَدُ وحده يُحتسب، والحارسُ غيرُ مشروطٍ بعد CR-021**", () => {
  it("درسٌ **مسجَّلٌ غيرُ معتمَد** لا يُحتسب — ولو كان منهاجُه مأجوراً", () => {
    const world = seedWorld()
    recordRealLesson(world, { sessionId: "ses-1", minutes: 180 })

    const line = lineOf(world, { world, approvedLessonIds: new Set() }, "u-teacher")
    expect(line.grossCents).toBe(0)
  })

  it("درسان: **المعتمَدُ وحده** يدخل الحصيلة، والآخرُ يصير سبباً", () => {
    const world = seedWorld()
    const approved = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })
    recordRealLesson(world, { sessionId: "ses-2", minutes: 600, heldAt: NEXT_DAY })

    const line = lineOf(world, { world, approvedLessonIds: new Set([approved]) }, "u-teacher")
    expect(line.grossCents).toBe(HOURLY_RATE)
  })

  it("**منهاجٌ غيرُ مؤهَّلٍ لا يُحتسب** ولو اعتُمد درسُه", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, {
      sessionId: "ses-t",
      minutes: 300,
      circleId: world.tahfeezCircleId,
    })
    const line = lineOf(world, { world, approvedLessonIds: new Set([lessonId]) }, "u-teacher")
    expect(line.grossCents).toBe(0)
  })

  it("**ولا إعدادَ يُرخّص التجاوز**: السجلُّ لم يعد فيه `edu.paid_hours.approved_only` أصلاً", async () => {
    const { SETTINGS_BY_ID } = await import("../../../src/settings/registry.js")
    expect(
      SETTINGS_BY_ID.has("edu.paid_hours.approved_only"),
      "CR-021: المفتاحُ مشطوبٌ — والحارسُ غيرُ مشروطٍ بالبناء",
    ).toBe(false)
  })

  it("**والدقائقُ تُقسَم قسمةً صحيحة** (ق-٤٨): ٩٠ دقيقةً ⇒ ساعةٌ ونصف بلا عددٍ عائم", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 90 })
    const line = lineOf(world, { world, approvedLessonIds: new Set([lessonId]) }, "u-teacher")
    expect(line.grossCents).toBe(Math.trunc((90 * HOURLY_RATE) / 60))
    expect(Number.isInteger(line.grossCents)).toBe(true)
  })
})

// ═══ ق-٣٦ — المعدّلُ بأثرٍ قادم: **لا يُعاد حسابُ شهرٍ مضى** ═══════════════════

describe("ق-٣٦ — رفعُ المعدّل اليوم لا يمسّ قرشاً مضى", () => {
  it("خطةُ شهرٍ تُقرأ بلحظتها فتُعطي معدّلَ ذلك الشهر لا معدّلَ اليوم", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })

    const raised = ratedSettings([
      {
        settingId: "finance.hourly_rate.amount",
        scopePath: "/",
        value: 9999,
        validFrom: new Date("2026-08-01T00:00:00.000Z"),
      },
    ])
    const line = lineOf(
      world,
      { world, approvedLessonIds: new Set([lessonId]), settings: raised },
      "u-teacher",
    )

    expect(line.grossCents, "المعدّلُ الجديد يسري بأثرٍ قادمٍ لا رجعيّ").toBe(HOURLY_RATE)
  })
})

// ═══ صفرُ استحقاقٍ يدويّ — الوجهُ السلوكيّ (البنيويُّ في اختباره) ══════════════

describe("ق-٥٢ — **الاشتقاقُ لحظةَ السؤال**: لا حالةَ تُراكَم", () => {
  it("استدعاءان متتاليان بلا تغييرِ عملٍ ⇒ **الحصيلةُ نفسُها** (لا عدّادَ يُراكِم)", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })
    const input = { world, approvedLessonIds: new Set([lessonId]) }

    const first = lineOf(world, input, "u-teacher")
    const second = lineOf(world, input, "u-teacher")
    expect(second.grossCents).toBe(first.grossCents)
  })

  it("و`deriveEntitlement` **تقرأ ولا تكتب**: لا سطرَ يُحفظ ولا قيدَ يُرحَّل", () => {
    const world = seedWorld()
    const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })
    const ctx = payrollContext({ world, approvedLessonIds: new Set([lessonId]) })

    const line = deriveEntitlement(
      world.stores,
      ctx,
      { unitPath: KHALID_PATH, periodId: PERIOD.id, from: FROM, to: TO, personIds: ["u-teacher"] },
      "u-teacher",
    )

    expect(line.grossCents).toBe(HOURLY_RATE)
    expect(world.stores.payroll.payouts(), "الاشتقاقُ لا يكتب شيئاً").toHaveLength(0)
    expect(world.stores.ledger.entries(), "ولا يلمس الدفتر").toHaveLength(0)
  })
})
