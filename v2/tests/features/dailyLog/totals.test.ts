/**
 * الجمعُ والهدفُ والتصنيف — ق-٤١ (الجمعُ من القيود المخزَّنة) وق-٣٦ (بأثرٍ قادمٍ فقط)
 * وق-٤٣ (الهدفُ بعدد سُبوت الشهر لا بعدد السجلات) وق-٤٤/قب-١١ (التصنيفُ نسبةً من الهدف).
 *
 * **الماضي لا يُعاد كتابتُه**: هذا هو الثابتُ الذي تحرسه أقسى اختباراتِ هذا الملفّ —
 * تغييرُ وزنِ نشاطٍ اليوم أو معدّلِ النقطة **لا يمسّ** مجموعَ أسبوعٍ مضى بنقطةٍ واحدة.
 */
import { describe, it, expect } from "vitest"
import { upsertActivity } from "../../../src/features/dailyLog/services/catalog.js"
import { recordDailyEntry } from "../../../src/features/dailyLog/services/entries.js"
import {
  periodPoints,
  targetForSpan,
  tierOf,
  unitDailyLogView,
} from "../../../src/features/dailyLog/services/totals.js"
import { KHALID, KHALID_PATH, LAST_WEEK, NOW, WEEK, dailyLogContext, seedDailyLogStore } from "./_seed.js"

const FROM = new Date("2026-01-01T00:00:00.000Z")
const LAST_WEEK_DAY = new Date("2026-07-13T09:00:00.000Z")
const NEXT_MONTH = new Date("2026-08-05T00:00:00.000Z")

/** يوليو ٢٠٢٦: أربعةُ سُبوت · أغسطس ٢٠٢٦: خمسة — نفسُ العدد من السجلات في الحالتين. */
const JULY = { fromDayKey: "2026-07-01", toDayKey: "2026-07-31" }
const AUGUST = { fromDayKey: "2026-08-01", toDayKey: "2026-08-31" }

function storeWithLastWeekEntry() {
  const store = seedDailyLogStore()
  const past = dailyLogContext("u-amir", { now: LAST_WEEK_DAY })
  const r = recordDailyEntry(store, past, {
    clientUuid: "c-past",
    unitId: KHALID,
    activityId: "lesson",
    count: 2,
    date: LAST_WEEK_DAY,
  })
  if (!r.ok) throw new Error(r.error.code)
  return store
}

describe("ق-٤١ — الجمعُ من القيود المخزَّنة لا من العدد×الوزن", () => {
  it("**تغييرُ وزنِ نشاطٍ اليوم لا يغيّر مجموعَ أسبوعٍ ماضٍ**", () => {
    const store = storeWithLastWeekEntry()
    expect(periodPoints(store, KHALID_PATH, LAST_WEEK)).toBe(10)

    const raised = upsertActivity(store, dailyLogContext("u-admin"), {
      schemeId: "scheme-men",
      activityId: "lesson",
      ar: "درسٌ في المسجد",
      weight: 50,
      maxPerDay: null,
      requiresParticipation: false,
      active: true,
    })
    expect(raised.ok).toBe(true)

    expect(periodPoints(store, KHALID_PATH, LAST_WEEK)).toBe(10)
  })

  it("**وتعطيلُ نشاطٍ اليوم لا يمحو نقاطَ ماضيه** — الأهليةُ حُسمت يومَ الإدخال", () => {
    const store = storeWithLastWeekEntry()
    upsertActivity(store, dailyLogContext("u-admin"), {
      schemeId: "scheme-men",
      activityId: "lesson",
      ar: "درسٌ في المسجد",
      weight: 5,
      maxPerDay: null,
      requiresParticipation: false,
      active: false,
    })
    expect(periodPoints(store, KHALID_PATH, LAST_WEEK)).toBe(10)
  })

  it("والوزنُ الجديد يسري على الإدخال الجديد وحده", () => {
    const store = storeWithLastWeekEntry()
    const ctx = dailyLogContext("u-admin")
    upsertActivity(store, ctx, {
      schemeId: "scheme-men",
      activityId: "lesson",
      ar: "درسٌ في المسجد",
      weight: 50,
      maxPerDay: null,
      requiresParticipation: false,
      active: true,
    })
    const now = recordDailyEntry(store, ctx, {
      clientUuid: "c-now",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
    })
    expect(now.ok && now.value.points).toBe(50)
    expect(periodPoints(store, KHALID_PATH, WEEK)).toBe(50)
    expect(periodPoints(store, KHALID_PATH, LAST_WEEK)).toBe(10)
  })

  it("وفترةٌ بلا قيودٍ مجموعُها صفرٌ لا `undefined` (قاعدةُ الصفر — ق-١١٢)", () => {
    expect(periodPoints(seedDailyLogStore(), KHALID_PATH, WEEK)).toBe(0)
  })
})

describe("ق-٣٦ — المعدّلُ مؤرَّخٌ بأثرٍ قادمٍ فقط: الماضي ثابت", () => {
  it("**رفعُ معدّل النقطة بأثرٍ قادمٍ لا يغيّر قراءتَه في تاريخٍ ماضٍ**", () => {
    const ctx = dailyLogContext("u-admin", {
      settings: [
        {
          settingId: "finance.point_rate.amount",
          scopePath: "/",
          value: 9_000,
          validFrom: NEXT_MONTH,
        },
      ],
    })
    expect(ctx.settings("finance.point_rate.amount", "/", NOW)).toBe(5_000)
    expect(ctx.settings("finance.point_rate.amount", "/", NEXT_MONTH)).toBe(9_000)
  })

  it("وتعادلُ تاريخِ السريان يُكسر بالمعرّف حتمياً — لا لا-حتميّةَ في المعدّل", () => {
    const ctx = dailyLogContext("u-admin", {
      settings: [
        { settingId: "finance.point_rate.amount", scopePath: "/", value: 7_000, validFrom: FROM, id: "b" },
        { settingId: "finance.point_rate.amount", scopePath: "/", value: 8_000, validFrom: FROM, id: "a" },
      ],
    })
    expect(ctx.settings("finance.point_rate.amount", "/", NOW)).toBe(8_000)
  })
})

describe("ق-٤٣ — الهدفُ بعدد سُبوت الفترة لا بعدد السجلات المُدخَلة", () => {
  it("**شهرٌ بأربعة سُبوتٍ هدفُه ٤×الهدف الأسبوعيّ، وشهرٌ بخمسةٍ هدفُه ٥×** — بنفس عدد السجلات", () => {
    const ctx = dailyLogContext("u-amir")
    expect(targetForSpan(ctx, KHALID_PATH, JULY)).toBe(280)
    expect(targetForSpan(ctx, KHALID_PATH, AUGUST)).toBe(350)
  })

  it("**والهدفُ لا يتغيّر بعدد ما أُدخل** — سجلٌّ واحدٌ أو عشرة، الهدفُ واحد", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir")
    const before = targetForSpan(ctx, KHALID_PATH, JULY)
    recordDailyEntry(store, ctx, {
      clientUuid: "c-t1",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
    })
    expect(targetForSpan(ctx, KHALID_PATH, JULY)).toBe(before)
  })

  it("وتغييرُ يوم بدء الأسبوع إعداداً يغيّر العدّ — لا «سبتٌ» صلبٌ في الكود", () => {
    // آذار ٢٠٢٦: أربعةُ سُبوتٍ وخمسةُ آحاد — فالفرقُ يظهر بتبديل الإعداد وحده.
    const march = { fromDayKey: "2026-03-01", toDayKey: "2026-03-31" }
    expect(targetForSpan(dailyLogContext("u-amir"), KHALID_PATH, march)).toBe(280)

    const sunday = dailyLogContext("u-amir", {
      settings: [
        { settingId: "time.week_start_day", scopePath: "/", value: "sunday", validFrom: FROM },
      ],
    })
    expect(targetForSpan(sunday, KHALID_PATH, march)).toBe(350)
  })

  it("ورفعُ الهدف الأسبوعيّ للقسم يرفع هدفَ الشهر (إعدادٌ حيٌّ بمستوى القسم)", () => {
    const ctx = dailyLogContext("u-amir", {
      settings: [{ settingId: "points.weekly_target", scopePath: "/men/", value: 100, validFrom: FROM }],
    })
    expect(targetForSpan(ctx, KHALID_PATH, JULY)).toBe(400)
  })
})

describe("ق-٤٤/قب-١١ — التصنيفُ نسبةً من الهدف: ١٠٠٪ / ٥٠٪ من الإعدادات", () => {
  const ctx = dailyLogContext("u-amir")

  it("بلوغُ الهدف أو تجاوزُه ⇒ «متميّز»", () => {
    expect(tierOf(ctx, KHALID_PATH, 280, 280)).toBe("excellent")
    expect(tierOf(ctx, KHALID_PATH, 400, 280)).toBe("excellent")
  })

  it("ونصفُ الهدف فما فوق دونه ⇒ «دون الهدف»", () => {
    expect(tierOf(ctx, KHALID_PATH, 140, 280)).toBe("below")
    expect(tierOf(ctx, KHALID_PATH, 279, 280)).toBe("below")
  })

  it("ودون النصف ⇒ «متعثّر»", () => {
    expect(tierOf(ctx, KHALID_PATH, 139, 280)).toBe("struggling")
    expect(tierOf(ctx, KHALID_PATH, 0, 280)).toBe("struggling")
  })

  it("**وتغييرُ العتبتين إعداداً يغيّر التصنيف** — لا مقياسَ صلبٌ في الكود", () => {
    const strict = dailyLogContext("u-amir", {
      settings: [
        { settingId: "points.tier.below_pct", scopePath: "/", value: 80, validFrom: FROM },
      ],
    })
    expect(tierOf(strict, KHALID_PATH, 140, 280)).toBe("struggling")
  })

  it("وهدفٌ صفريٌّ لا يكسر القسمة — الفراغُ لا يُصنَّف متميّزاً بالخطأ", () => {
    expect(tierOf(ctx, KHALID_PATH, 0, 0)).toBe("struggling")
  })
})

describe("نموذجُ الصفحة الواحد (ق-١١١) — كلُّ رقمٍ من مصدرٍ واحد", () => {
  it("يجمع نقاطَ الفترة وهدفَها وتصنيفَها وقيودَها في لقطةٍ واحدة", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir")
    recordDailyEntry(store, ctx, {
      clientUuid: "c-v1",
      unitId: KHALID,
      activityId: "lesson",
      count: 2,
      date: NOW,
    })
    recordDailyEntry(store, ctx, {
      clientUuid: "c-v2",
      unitId: KHALID,
      freeTextAr: "نشاطٌ خارج الكتالوج",
      count: 1,
      date: NOW,
    })

    const view = unitDailyLogView(store, ctx, KHALID_PATH, { periodKey: WEEK, span: JULY })
    expect(view.unitPath).toBe(KHALID_PATH)
    expect(view.periodKey).toBe(WEEK)
    expect(view.points).toBe(10)
    expect(view.target).toBe(280)
    expect(view.tier).toBe("struggling")
    expect(view.entries).toHaveLength(2)
    expect(view.freeEntries).toHaveLength(1)
    expect(view.familyStudentCount).toBeNull()
  })

  it("**واللقطةُ تعلن حصيلةَ الفترة صفراً حين لا إدخال** — أساسُ ق-١٠", () => {
    const view = unitDailyLogView(seedDailyLogStore(), dailyLogContext("u-amir"), KHALID_PATH, {
      periodKey: WEEK,
      span: JULY,
    })
    expect(view.points).toBe(0)
    expect(view.entries).toHaveLength(0)
    expect(view.submittable).toBe(false)
  })
})
