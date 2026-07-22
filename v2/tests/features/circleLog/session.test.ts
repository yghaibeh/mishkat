/**
 * **الاختباران الإلزاميّان الثاني والثالث** (T18) — ع-٩ العلامةُ من ١٠ إلزاماً **والحدُّ من
 * الإعداد**، وق-٨٩ **قائمةٌ لا كتابةٌ حرّة** — ومعهما هيكلُ ق-٩٠ (حضورٌ رباعيّ وupsert).
 *
 * شكوى الميدان حرفياً (ع-٩): «العلامة في الحفظ/المراجعة/التجويد لا بدّ جعلُها من ١٠ إلزاماً…
 * لأنّ الخيار الحالي يتيح له أن يكتب الرقم الذي شاء». والعلاجُ **عند الحدّ في الخادم**،
 * **وحدُّه إعدادٌ حيّ**: يُبرهَن بتغيير الإعداد فيتغيّر المقبولُ بلا سطر كود (قب-٦/G14).
 */
import { describe, it, expect } from "vitest"
import { recordSession } from "../../../src/features/circleLog/services/sessions.js"
import type { Recitation } from "../../../src/features/circleLog/types.js"
import { globalOverride, logContext, NOW, seedWorld } from "./_seed.js"

const SURAH_FATIHA: Recitation = { mode: "surah", surahId: "001", fromAyah: 1, toAyah: 7 }

function worldWithContext(overrides: Parameters<typeof logContext>[2] = {}) {
  const world = seedWorld()
  return { world, ctx: logContext(world, "u-amir", overrides) }
}

describe("ق-٩٠ — الجلسةُ اليومية: حضورٌ رباعيّ، ومفتاحُها (حلقة × يوم)", () => {
  it("المعلّمُ يسجّل يومَ حلقته بحضورٍ رباعيٍّ وحفظٍ وعلامة — فيُقرأ ما كُتب", () => {
    const { world, ctx } = worldWithContext()
    const done = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        {
          enrollmentId: world.studentA,
          attendance: "present",
          memorization: SURAH_FATIHA,
          memorizationGrade: 9,
          tajweedGrade: 8,
        },
        { enrollmentId: world.studentB, attendance: "excused" },
      ],
    })
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.value.dayKey).toBe("2026-07-22")
    expect(done.value.rows.map((r) => r.attendance)).toEqual(["present", "excused"])
    expect(done.value.recordedByPersonId).toBe("u-amir")
  })

  it("**وإعادةُ الإرسال آمنة** (upsert): اليومُ نفسُه يُستبدَل ولا تُولَد جلسةٌ ثانية", () => {
    const { world, ctx } = worldWithContext()
    const first = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [{ enrollmentId: world.studentA, attendance: "absent" }],
    })
    expect(first.ok).toBe(true)
    const second = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(second.ok).toBe(true)
    expect(world.log.sessions()).toHaveLength(1)
    expect(world.log.getSession(world.circleId, "2026-07-22")?.rows[0]?.attendance).toBe("present")
  })

  it("ويومان مختلفان جلستان — فالمفتاحُ (حلقة × يوم) لا الحلقةُ وحدها", () => {
    const { world, ctx } = worldWithContext()
    recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: new Date("2026-07-21T09:00:00.000Z"),
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(world.log.sessions()).toHaveLength(2)
  })

  it("**وحدُّ اليوم بالمنطقة المضبوطة لا بـUTC**: عملُ منتصف الليل الدمشقيّ يُنسب ليومه", () => {
    // ٢٠٢٦-٠٧-٢٢ ٢٢:٣٠ بتوقيت UTC = ٢٠٢٦-٠٧-٢٣ ٠١:٣٠ في دمشق ⇒ اليومُ التالي لا السابق.
    const world = seedWorld()
    const at = new Date("2026-07-22T22:30:00.000Z")
    const done = recordSession(world.log, logContext(world, "u-amir", { now: at }), {
      circleId: world.circleId,
      at,
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(done.ok && done.value.dayKey).toBe("2026-07-23")
  })

  it("وجلسةٌ بلا سطرٍ واحدٍ مرفوضة — السجلُّ توثيقُ حضورٍ لا صفٌّ فارغ", () => {
    const { world, ctx } = worldWithContext()
    const done = recordSession(world.log, ctx, { circleId: world.circleId, at: NOW, rows: [] })
    expect(!done.ok && done.error.code).toBe("EMPTY_SESSION")
  })

  it("وحلقةٌ مجهولةٌ مرفوضة — والنطاقُ يُشتقّ من الحلقة المخزَّنة لا من المدخل", () => {
    const { world, ctx } = worldWithContext()
    const done = recordSession(world.log, ctx, {
      circleId: "circle-لا-وجود-له",
      at: NOW,
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(!done.ok && done.error.code).toBe("UNKNOWN_CIRCLE")
  })

  it("وحلقةٌ مؤرشفةٌ لا تُسجَّل — الأرشفةُ تعطيلٌ منطقيٌّ يسري على ما فوقها", () => {
    const { world, ctx } = worldWithContext()
    const circle = world.circles.getCircle(world.circleId)!
    world.circles.saveCircle({ ...circle, archivedAt: NOW })
    const done = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(!done.ok && done.error.code).toBe("CIRCLE_ARCHIVED")
  })

  it("**والطالبُ من سجلّ العضوية الواحد**: تسجيلٌ من حلقةٍ أخرى مرفوض (موتُ «أضفتُ ٢٠ طالباً ولا أحد»)", () => {
    const { world, ctx } = worldWithContext()
    const done = recordSession(world.log, ctx, {
      circleId: world.otherCircleId,
      at: NOW,
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(!done.ok && done.error.code).toBe("ENROLLMENT_NOT_IN_CIRCLE")
  })

  it("وسطران لطالبٍ واحدٍ في اليوم مرفوضان — لا حضورَ مزدوجٌ يلوّث النسبة", () => {
    const { world, ctx } = worldWithContext()
    const done = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        { enrollmentId: world.studentA, attendance: "present" },
        { enrollmentId: world.studentA, attendance: "absent" },
      ],
    })
    expect(!done.ok && done.error.code).toBe("DUPLICATE_STUDENT_ROW")
  })

  it("والتأريخُ في المستقبل مرفوضٌ بالإعداد — ويُقبل حين يسمح الإعدادُ به", () => {
    const { world, ctx } = worldWithContext()
    const future = new Date("2026-08-01T09:00:00.000Z")
    const blocked = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: future,
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(!blocked.ok && blocked.error.code).toBe("FUTURE_DATING_BLOCKED")

    const allowed = recordSession(
      world.log,
      logContext(world, "u-amir", {
        overrides: [globalOverride("records.allow_future_dating", true)],
      }),
      {
        circleId: world.circleId,
        at: future,
        rows: [{ enrollmentId: world.studentA, attendance: "present" }],
      },
    )
    expect(allowed.ok).toBe(true)
  })
})

describe("**ع-٩ — العلامةُ من ١٠ إلزاماً، والحدُّ إعدادٌ لا رقمٌ صلب**", () => {
  it("علامةٌ فوق الحدّ ⇒ **مرفوضةٌ من الخادم** (لا يكتب الرقمَ الذي شاء)", () => {
    const { world, ctx } = worldWithContext()
    const done = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [{ enrollmentId: world.studentA, attendance: "present", memorizationGrade: 11 }],
    })
    expect(!done.ok && done.error.code).toBe("GRADE_OUT_OF_RANGE")
  })

  it("وعلامةٌ سالبةٌ مرفوضة، وكسريّةٌ مرفوضة — المدى `[٠ … الحدّ]` بأعدادٍ صحيحة", () => {
    const { world, ctx } = worldWithContext()
    for (const grade of [-1, 2.5]) {
      const done = recordSession(world.log, ctx, {
        circleId: world.circleId,
        at: NOW,
        rows: [{ enrollmentId: world.studentA, attendance: "present", tajweedGrade: grade }],
      })
      expect(!done.ok && done.error.code, `العلامة ${grade}`).toBe("GRADE_OUT_OF_RANGE")
    }
  })

  it("والحدُّ **من الإعداد**: يُرفع `edu.grade.max` فتُقبل العلامةُ نفسُها بلا سطرِ كود", () => {
    const world = seedWorld()
    const rows = [
      { enrollmentId: world.studentA, attendance: "present" as const, reviewGrade: 20 },
    ]
    const withDefault = recordSession(world.log, logContext(world, "u-amir"), {
      circleId: world.circleId,
      at: NOW,
      rows,
    })
    expect(!withDefault.ok && withDefault.error.code).toBe("GRADE_OUT_OF_RANGE")

    const withRaised = recordSession(
      world.log,
      logContext(world, "u-amir", { overrides: [globalOverride("edu.grade.max", 20)] }),
      { circleId: world.circleId, at: NOW, rows },
    )
    expect(withRaised.ok).toBe(true)
  })

  it("**ولا علامةَ لغائب**: الغيابُ مع علامةٍ مرفوضٌ فلا يتلوّث متوسّطُ ق-٩١", () => {
    const { world, ctx } = worldWithContext()
    const done = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [{ enrollmentId: world.studentA, attendance: "absent", memorizationGrade: 10 }],
    })
    expect(!done.ok && done.error.code).toBe("GRADE_WITHOUT_ATTENDANCE")
  })

  it("والعلامةُ الغائبة (`null`) مقبولةٌ — التسجيلُ حضوراً بلا تقييمٍ حالةٌ مشروعة", () => {
    const { world, ctx } = worldWithContext()
    const done = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [{ enrollmentId: world.studentA, attendance: "present", memorizationGrade: null }],
    })
    expect(done.ok).toBe(true)
  })
})

describe("**ق-٨٩ — قائمةٌ لا كتابةٌ حرّة**: نطاقُ الحفظ من كتالوجٍ مرجعيّ", () => {
  it("سورةٌ **خارج القائمة** ⇒ مرفوضة (النصُّ الحرُّ لا يبلغ السجل)", () => {
    const { world, ctx } = worldWithContext()
    const done = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        {
          enrollmentId: world.studentA,
          attendance: "present",
          memorization: { mode: "surah", surahId: "سورة اخترعتُها", fromAyah: 1, toAyah: 3 },
        },
      ],
    })
    expect(!done.ok && done.error.code).toBe("UNKNOWN_SURAH")
  })

  it("وآيةٌ فوق عدد آيات السورة ⇒ مرفوضة — **والعددُ بيانٌ مرجعيٌّ لا رقمٌ صلب**", () => {
    const { world, ctx } = worldWithContext()
    const done = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        {
          enrollmentId: world.studentA,
          attendance: "present",
          memorization: { mode: "surah", surahId: "001", fromAyah: 1, toAyah: 8 },
        },
      ],
    })
    expect(!done.ok && done.error.code).toBe("AYAH_OUT_OF_RANGE")
  })

  it("ومدىً مقلوبٌ أو آيةٌ صفرٌ ⇒ مرفوضان", () => {
    const { world, ctx } = worldWithContext()
    for (const range of [
      { fromAyah: 5, toAyah: 2 },
      { fromAyah: 0, toAyah: 3 },
    ]) {
      const done = recordSession(world.log, ctx, {
        circleId: world.circleId,
        at: NOW,
        rows: [
          {
            enrollmentId: world.studentA,
            attendance: "present",
            review: { mode: "surah", surahId: "002", ...range },
          },
        ],
      })
      expect(!done.ok && done.error.code, JSON.stringify(range)).toBe("AYAH_OUT_OF_RANGE")
    }
  })

  it("**ووضعُ الصفحات كذلك من المرجع**: صفحةٌ فوق عدد صفحات المصحف ⇒ مرفوضة", () => {
    const { world, ctx } = worldWithContext()
    const done = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        {
          enrollmentId: world.studentA,
          attendance: "present",
          memorization: { mode: "pages", mushafId: "hafs", fromPage: 600, toPage: 605 },
        },
      ],
    })
    expect(!done.ok && done.error.code).toBe("PAGE_OUT_OF_RANGE")
  })

  it("ومصحفٌ مجهولٌ ⇒ مرفوض؛ ومدىً صالحٌ ⇒ مقبول", () => {
    const { world, ctx } = worldWithContext()
    const unknown = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        {
          enrollmentId: world.studentA,
          attendance: "present",
          memorization: { mode: "pages", mushafId: "مصحفٌ مخترَع", fromPage: 1, toPage: 2 },
        },
      ],
    })
    expect(!unknown.ok && unknown.error.code).toBe("UNKNOWN_MUSHAF")

    const good = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        {
          enrollmentId: world.studentA,
          attendance: "present",
          memorization: { mode: "pages", mushafId: "hafs", fromPage: 1, toPage: 3 },
        },
      ],
    })
    expect(good.ok).toBe(true)
  })
})

describe("**ب-٤١/ع-١٠ — المادةُ الإثرائية بعلامة**: نوعُها من كتالوج T16 لا من معجمٍ ثانٍ", () => {
  it("مادةٌ إثرائيةٌ بنوعٍ قائمٍ وعلامةٍ ⇒ تُقبل («فيكون السجلُّ أشملَ وأعمّ»)", () => {
    const { world, ctx } = worldWithContext()
    const done = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        {
          enrollmentId: world.studentA,
          attendance: "present",
          enrichment: { typeId: "baseera", grade: 7 },
        },
      ],
    })
    expect(done.ok && done.value.rows[0]?.evaluation?.enrichment?.typeId).toBe("baseera")
  })

  it("**ونوعٌ خارج كتالوج T16 ⇒ مرفوض** — معجمُ الأنواع واحدٌ في النظام كلِّه (درسُ CR-014)", () => {
    const { world, ctx } = worldWithContext()
    const done = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        {
          enrollmentId: world.studentA,
          attendance: "present",
          enrichment: { typeId: "نوعٌ مخترَع", grade: 7 },
        },
      ],
    })
    expect(!done.ok && done.error.code).toBe("UNKNOWN_ENRICHMENT_TYPE")
  })

  it("وعلامةُ الإثرائية تخضع لحدّ ع-٩ نفسِه — لا بابَ خلفيٍّ للعلامة الحرّة", () => {
    const { world, ctx } = worldWithContext()
    const done = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        {
          enrollmentId: world.studentA,
          attendance: "present",
          enrichment: { typeId: "baseera", grade: 99 },
        },
      ],
    })
    expect(!done.ok && done.error.code).toBe("GRADE_OUT_OF_RANGE")
  })

  it("**ونوعٌ خامسٌ يُضاف صفّاً في كتالوج T16 فيعمل إثرائياً فوراً** (قب-٢٢ — بلا سطر كود)", () => {
    const world = seedWorld()
    const ctx = logContext(world, "u-amir")
    const before = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        {
          enrollmentId: world.studentA,
          attendance: "present",
          enrichment: { typeId: "seerah", grade: 5 },
        },
      ],
    })
    expect(!before.ok && before.error.code).toBe("UNKNOWN_ENRICHMENT_TYPE")

    world.circles.saveType({ tenantId: "t-main", id: "seerah", ar: "السيرة" })
    const after = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        {
          enrollmentId: world.studentA,
          attendance: "present",
          enrichment: { typeId: "seerah", grade: 5 },
        },
      ],
    })
    expect(after.ok).toBe(true)
  })
})
