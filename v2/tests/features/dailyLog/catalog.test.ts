/**
 * كتالوجُ الأنشطة — **كيانُ بياناتٍ بشاشةٍ مستقلة** (ب-٣٩ج/قب-١١، IA ك-١٨).
 *
 * الاختبارُ الحاسمُ هنا هو **«إدارةٌ بلا مبرمج»**: إضافةُ نشاطٍ جديدٍ **بياناً** تجعله مقبولاً
 * في الإدخال اليوميّ بوزنه وسقفه **بلا سطرِ كودٍ واحد** — وهو معنى «منتج» في ب-٣٩ج.
 * ومعه ق-٤٢ (مخطّطٌ لكل نطاق) وق-٣٦ (النسخُ مؤرَّخةٌ بأثرٍ قادم).
 */
import { describe, it, expect } from "vitest"
import {
  activityAt,
  catalogView,
  schemeForUnit,
  upsertActivity,
} from "../../../src/features/dailyLog/services/catalog.js"
import { recordDailyEntry } from "../../../src/features/dailyLog/services/entries.js"
import {
  ACTIVITIES,
  KHALID,
  KHALID_PATH,
  MEN_PATH,
  NOUR_PATH,
  NOW,
  dailyLogContext,
  seedDailyLogStore,
} from "./_seed.js"

const FUTURE = new Date("2026-08-01T00:00:00.000Z")

describe("ق-٤٢ — المخطّطُ يُختار بالنطاق لا بفرعٍ جنسانيٍّ في الكود", () => {
  it("مسجدُ القسم الرجاليّ يقع على مخطّطه، والمسجدُ النسائيُّ على مخطّطه", () => {
    const store = seedDailyLogStore()
    expect(schemeForUnit(store, KHALID_PATH)?.id).toBe("scheme-men")
    expect(schemeForUnit(store, NOUR_PATH)?.id).toBe("scheme-women")
  })

  it("**والهدفُ واحدٌ للمسارين** — لا هدفَ ثانٍ للنساء (ق-٤٢ نصاً)", () => {
    const ctx = dailyLogContext("u-admin")
    expect(ctx.settings("points.weekly_target", MEN_PATH, NOW)).toBe(
      ctx.settings("points.weekly_target", "/women/", NOW),
    )
  })

  it("ووحدةٌ خارج كل المخطّطات لا تُسجَّل عليها أنشطة — لا مخطّطَ افتراضيٌّ ضمنيّ", () => {
    const store = seedDailyLogStore()
    expect(schemeForUnit(store, "/")).toBeNull()
    const r = recordDailyEntry(store, dailyLogContext("u-admin"), {
      clientUuid: "u-root",
      unitId: "root",
      activityId: "lesson",
      count: 1,
      date: NOW,
    })
    expect(!r.ok && r.error.code).toBe("NO_SCHEME_FOR_SCOPE")
  })

  it("والمخطّطُ المعطَّل لا يُختار ولو طابق نطاقُه", () => {
    const store = seedDailyLogStore()
    store.saveScheme({
      tenantId: store.tenantId,
      id: "scheme-men",
      ar: "مخطّطُ أنشطة الشباب",
      scopePath: MEN_PATH,
      active: false,
    })
    expect(schemeForUnit(store, KHALID_PATH)).toBeNull()
  })

  it("والأعمقُ يغلب الأعمّ حين يتداخل مخطّطان", () => {
    const store = seedDailyLogStore()
    store.saveScheme({
      tenantId: store.tenantId,
      id: "scheme-sq2",
      ar: "مخطّطُ المربع الثاني",
      scopePath: "/men/homs/sq2/",
      active: true,
    })
    expect(schemeForUnit(store, KHALID_PATH)?.id).toBe("scheme-sq2")
  })
})

describe("ب-٣٩ج — الكتالوجُ يُدار بلا مبرمج: إضافةُ نشاطٍ بياناً تكفي", () => {
  it("**نشاطٌ لم يكن في الكود ولا في البذرة يُقبل فور إضافته بياناً — بصفر سطرِ كود**", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-admin")

    const before = recordDailyEntry(store, ctx, {
      clientUuid: "e-new-1",
      unitId: KHALID,
      activityId: "iftar",
      count: 2,
      date: NOW,
    })
    expect(!before.ok && before.error.code).toBe("UNKNOWN_ACTIVITY")

    const added = upsertActivity(store, ctx, {
      schemeId: "scheme-men",
      activityId: "iftar",
      ar: "إفطارُ صائم",
      weight: 4,
      maxPerDay: null,
      requiresParticipation: false,
      active: true,
    })
    expect(added.ok).toBe(true)

    const after = recordDailyEntry(store, ctx, {
      clientUuid: "e-new-2",
      unitId: KHALID,
      activityId: "iftar",
      count: 2,
      date: NOW,
    })
    expect(after.ok && after.value.points).toBe(8)
  })

  it("وتعطيلُ نشاطٍ بياناً يمنعه — ولا يُمحى (المادة ٧/٤)", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-admin")
    const r = recordDailyEntry(store, ctx, {
      clientUuid: "e-retired",
      unitId: KHALID,
      activityId: "retired",
      count: 1,
      date: NOW,
    })
    expect(!r.ok && r.error.code).toBe("ACTIVITY_INACTIVE")
    expect(catalogView(store).activities.some((a) => a.activityId === "retired")).toBe(true)
  })

  it("ونشاطٌ لمخطّطٍ مجهولٍ يُرفض — لا كتالوجَ بلا مخطّطه", () => {
    const store = seedDailyLogStore()
    const r = upsertActivity(store, dailyLogContext("u-admin"), {
      schemeId: "scheme-ghost",
      activityId: "x",
      ar: "نشاطٌ يتيم",
      weight: 1,
      maxPerDay: null,
      requiresParticipation: false,
      active: true,
    })
    expect(!r.ok && r.error.code).toBe("UNKNOWN_SCHEME")
  })

  it("ووزنٌ سالبٌ يُرفض — الوزنُ لا يخصم", () => {
    const store = seedDailyLogStore()
    const r = upsertActivity(store, dailyLogContext("u-admin"), {
      schemeId: "scheme-men",
      activityId: "bad",
      ar: "وزنٌ سالب",
      weight: -1,
      maxPerDay: null,
      requiresParticipation: false,
      active: true,
    })
    expect(!r.ok && r.error.code).toBe("INVALID_WEIGHT")
  })

  it("والنشاطُ من مخطّطٍ آخر لا يُسجَّل على وحدةٍ خارجه (العزلُ بالنطاق)", () => {
    const store = seedDailyLogStore()
    const r = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "e-cross",
      unitId: KHALID,
      activityId: "dawah",
      count: 1,
      date: NOW,
    })
    expect(!r.ok && r.error.code).toBe("UNKNOWN_ACTIVITY")
  })
})

describe("ق-٣٦ — النسخةُ مؤرَّخةٌ: النافذُ ما كان سارياً في تاريخ الإدخال", () => {
  it("النسخةُ السارية عند «الآن» هي الأقدم ما لم تبدأ نسخةٌ أحدث", () => {
    const store = seedDailyLogStore()
    expect(activityAt(store, "scheme-men", "lesson", NOW)?.weight).toBe(5)
  })

  it("**ونسخةٌ بأثرٍ قادمٍ لا تُرى قبل سريانها**", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-admin", { now: FUTURE })
    const r = upsertActivity(store, ctx, {
      schemeId: "scheme-men",
      activityId: "lesson",
      ar: "درسٌ في المسجد",
      weight: 9,
      maxPerDay: null,
      requiresParticipation: false,
      active: true,
    })
    expect(r.ok).toBe(true)
    expect(activityAt(store, "scheme-men", "lesson", NOW)?.weight).toBe(5)
    expect(activityAt(store, "scheme-men", "lesson", FUTURE)?.weight).toBe(9)
  })

  it("ونشاطٌ لا نسخةَ له سارية عند التاريخ ⇒ لا شيء (لا اختراعَ افتراضيّ)", () => {
    const store = seedDailyLogStore()
    expect(activityAt(store, "scheme-men", "lesson", new Date("2025-01-01T00:00:00.000Z"))).toBeNull()
    expect(activityAt(store, "scheme-men", "ghost", NOW)).toBeNull()
  })

  it("ومعاينةُ الكتالوج تعرض كلَّ ما بُذر (لشاشة الإدارة)", () => {
    const store = seedDailyLogStore()
    const view = catalogView(store)
    expect(view.schemes).toHaveLength(2)
    expect(view.activities).toHaveLength(ACTIVITIES.length)
  })
})
