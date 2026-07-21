/**
 * نزاهةُ الإدخال اليوميّ — ق-٤٥ (upsert بمفتاحٍ طبيعيٍّ و`client_uuid`، ولا تأريخَ مستقبلياً،
 * والتوقيتُ من الإعداد) وق-٤٦ (نشاطُ الطالب الواحد لا يُحتسب مرتين عبر جهتين) وق-٨ (القفل).
 *
 * كلُّ قاعدةٍ هنا وُلدت من **خطأٍ مكلّفٍ في الميدان**: مضاعفةُ نقاط الأسبوع بالمزامنة
 * المتزامنة، ونافذةُ ٠٠:٠٠–٠٣:٠٠ الدمشقية التي كانت تنسب عملَ اليوم إلى أمس.
 */
import { describe, it, expect } from "vitest"
import { entriesOfPeriod, recordDailyEntry } from "../../../src/features/dailyLog/services/entries.js"
import { periodPoints } from "../../../src/features/dailyLog/services/totals.js"
import {
  BILAL_PATH,
  KHALID,
  KHALID_PATH,
  NOW,
  TODAY,
  WEEK,
  dailyLogContext,
  seedDailyLogStore,
} from "./_seed.js"

const AFTER_DAMASCUS_MIDNIGHT = new Date("2026-07-19T22:00:00.000Z")
const TOMORROW = new Date("2026-07-21T00:00:00.000Z")

describe("ق-٤٥ — upsert بمفتاحٍ طبيعيٍّ و`client_uuid`: مزامنتان لا تضاعفان النقاط", () => {
  it("**إرسالُ نفسِ `client_uuid` مرتين ⇒ سجلٌّ واحدٌ ونقاطٌ واحدة**", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir")
    const input = {
      clientUuid: "c-1",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
    }
    const first = recordDailyEntry(store, ctx, input)
    const again = recordDailyEntry(store, ctx, input)

    expect(first.ok && again.ok).toBe(true)
    expect(first.ok && again.ok && first.value.id).toBe(again.ok ? again.value.id : "")
    expect(entriesOfPeriod(store, KHALID_PATH, WEEK)).toHaveLength(1)
    expect(periodPoints(store, KHALID_PATH, WEEK)).toBe(5)
  })

  it("وإرسالٌ ثانٍ بنفس المفتاح الطبيعيّ (وحدة/نشاط/يوم) ولو بـ`uuid` آخر **يحدِّث ولا يضيف**", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir")
    recordDailyEntry(store, ctx, {
      clientUuid: "c-a",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
    })
    const second = recordDailyEntry(store, ctx, {
      clientUuid: "c-b",
      unitId: KHALID,
      activityId: "lesson",
      count: 3,
      date: NOW,
    })
    expect(second.ok && second.value.points).toBe(15)
    expect(entriesOfPeriod(store, KHALID_PATH, WEEK)).toHaveLength(1)
    expect(periodPoints(store, KHALID_PATH, WEEK)).toBe(15)
  })

  it("ووحدتان مختلفتان في اليوم نفسِه سجلّان مستقلّان — المفتاحُ يحمل الوحدة", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir")
    recordDailyEntry(store, ctx, { clientUuid: "c-k", unitId: KHALID, activityId: "lesson", count: 1, date: NOW })
    recordDailyEntry(store, ctx, { clientUuid: "c-b", unitId: "bilal", activityId: "lesson", count: 1, date: NOW })
    expect(entriesOfPeriod(store, KHALID_PATH, WEEK)).toHaveLength(1)
    expect(entriesOfPeriod(store, BILAL_PATH, WEEK)).toHaveLength(1)
  })
})

describe("ق-٤٥ — لا تأريخَ مستقبلياً، والحدُّ من الإعداد لا من الكود", () => {
  it("**تأريخٌ في الغد ⇒ مرفوض**", () => {
    const store = seedDailyLogStore()
    const r = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "c-f",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: TOMORROW,
    })
    expect(!r.ok && r.error.code).toBe("FUTURE_DATED")
  })

  it("ورفعُ إعداد `records.allow_future_dating` يغيّر السلوك بلا تغيير سطرِ كود", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir", {
      settings: [
        {
          settingId: "records.allow_future_dating",
          scopePath: "/",
          value: true,
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    })
    const r = recordDailyEntry(store, ctx, {
      clientUuid: "c-f2",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: TOMORROW,
    })
    expect(r.ok).toBe(true)
  })

  it("وعددٌ غيرُ موجبٍ يُرفض — لا قيدَ بلا عمل", () => {
    const store = seedDailyLogStore()
    const r = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "c-z",
      unitId: KHALID,
      activityId: "lesson",
      count: 0,
      date: NOW,
    })
    expect(!r.ok && r.error.code).toBe("NON_POSITIVE_COUNT")
  })

  it("ووحدةٌ مجهولةٌ في مستودع هذه الشبكة ⇒ مرفوضة", () => {
    const store = seedDailyLogStore()
    const r = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "c-u",
      unitId: "ghost",
      activityId: "lesson",
      count: 1,
      date: NOW,
    })
    expect(!r.ok && r.error.code).toBe("UNKNOWN_UNIT")
  })
})

describe("ق-٤٥ — حدودُ اليوم بتوقيت **الإعداد** لا بـUTC", () => {
  it("**لحظةٌ بعد منتصف الليل الدمشقيّ تُنسب إلى اليوم الصحيح** لا إلى أمس", () => {
    const store = seedDailyLogStore()
    const r = recordDailyEntry(store, dailyLogContext("u-amir", { now: AFTER_DAMASCUS_MIDNIGHT }), {
      clientUuid: "c-mid",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: AFTER_DAMASCUS_MIDNIGHT,
    })
    expect(r.ok && r.value.dayKey).toBe(TODAY)
  })

  it("**وضبطُ المنطقة الزمنية إعداداً يغيّر اليومَ نفسَه** — لا توقيتَ مثبَّتٌ في الكود", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir", {
      now: AFTER_DAMASCUS_MIDNIGHT,
      settings: [
        {
          settingId: "time.zone",
          scopePath: "/",
          value: "UTC",
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    })
    const r = recordDailyEntry(store, ctx, {
      clientUuid: "c-utc",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: AFTER_DAMASCUS_MIDNIGHT,
    })
    expect(r.ok && r.value.dayKey).toBe("2026-07-19")
  })

  it("وأسبوعُ القيد يتبع يومَ بدء الأسبوع من الإعداد", () => {
    const store = seedDailyLogStore()
    const saturday = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "c-w",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
    })
    expect(saturday.ok && saturday.value.periodKey).toBe(WEEK)

    const store2 = seedDailyLogStore()
    const sunday = recordDailyEntry(
      store2,
      dailyLogContext("u-amir", {
        settings: [
          {
            settingId: "time.week_start_day",
            scopePath: "/",
            value: "sunday",
            validFrom: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
      }),
      { clientUuid: "c-w2", unitId: KHALID, activityId: "lesson", count: 1, date: NOW },
    )
    expect(sunday.ok && sunday.value.periodKey).toBe("2026-07-19")
  })
})

describe("ق-٤٦ — نشاطُ الطالب الواحد لا يُحتسب مرتين عبر جهتين", () => {
  it("**طالبٌ سُجِّل نشاطُه في مسجده ثم في جهةٍ أخرى في اليوم نفسِه ⇒ يُحتسب مرة واحدة**", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir")
    const first = recordDailyEntry(store, ctx, {
      clientUuid: "c-s1",
      unitId: KHALID,
      activityId: "lesson",
      count: 2,
      date: NOW,
      studentIds: ["s-1", "s-2"],
    })
    const second = recordDailyEntry(store, ctx, {
      clientUuid: "c-s2",
      unitId: "bilal",
      activityId: "lesson",
      count: 2,
      date: NOW,
      studentIds: ["s-2", "s-3"],
    })

    expect(first.ok && first.value.creditedCount).toBe(2)
    expect(second.ok && second.value.creditedCount).toBe(1)
    expect(second.ok && second.value.points).toBe(5)
  })

  it("والمكرَّرُ كلُّه ⇒ صفرُ نقاطٍ بسببٍ معلن، والسجلُّ يبقى توثيقاً", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir")
    recordDailyEntry(store, ctx, {
      clientUuid: "c-d1",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
      studentIds: ["s-9"],
    })
    const dup = recordDailyEntry(store, ctx, {
      clientUuid: "c-d2",
      unitId: "bilal",
      activityId: "lesson",
      count: 1,
      date: NOW,
      studentIds: ["s-9"],
    })
    expect(dup.ok && dup.value.points).toBe(0)
    expect(dup.ok && dup.value.block).toBe("alreadyCredited")
  })

  it("ويومان مختلفان ليسا ازدواجاً — القاعدةُ يوميّةٌ لا أبدية", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir")
    recordDailyEntry(store, ctx, {
      clientUuid: "c-y1",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: new Date("2026-07-19T09:00:00.000Z"),
      studentIds: ["s-7"],
    })
    const nextDay = recordDailyEntry(store, ctx, {
      clientUuid: "c-y2",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
      studentIds: ["s-7"],
    })
    expect(nextDay.ok && nextDay.value.points).toBe(5)
  })

  it("وتحديثُ القيد نفسِه لا يعدّ طلابَه مزدوجين (الاحتسابُ لا يخنق نفسَه)", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir")
    recordDailyEntry(store, ctx, {
      clientUuid: "c-self",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
      studentIds: ["s-5"],
    })
    const updated = recordDailyEntry(store, ctx, {
      clientUuid: "c-self",
      unitId: KHALID,
      activityId: "lesson",
      count: 2,
      date: NOW,
      studentIds: ["s-5", "s-6"],
    })
    expect(updated.ok && updated.value.creditedCount).toBe(2)
    expect(updated.ok && updated.value.points).toBe(10)
  })
})

describe("ق-٨ — القفلُ: لا كتابةَ على فترةٍ مقفلة، والقفلُ **يُحقن** ولا يُستنتج", () => {
  it("**فترةٌ مقفلةٌ ترفض قيداً جديداً** — لا رفعَ لمجموعٍ معتمَد", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir", { isPeriodLocked: () => true })
    const r = recordDailyEntry(store, ctx, {
      clientUuid: "c-lock",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
    })
    expect(!r.ok && r.error.code).toBe("PERIOD_LOCKED")
  })

  it("والقفلُ يُسأل بالوحدة والفترة بعينهما — لا قفلَ شاملٌ ضمنيّ", () => {
    const store = seedDailyLogStore()
    const asked: string[] = []
    const ctx = dailyLogContext("u-amir", {
      isPeriodLocked: (unitPath, periodKey) => {
        asked.push(`${unitPath}|${periodKey}`)
        return false
      },
    })
    recordDailyEntry(store, ctx, {
      clientUuid: "c-ask",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
    })
    expect(asked).toEqual([`${KHALID_PATH}|${WEEK}`])
  })
})
