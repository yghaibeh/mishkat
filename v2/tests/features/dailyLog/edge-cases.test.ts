/**
 * حوافُّ الوحدة — الحالاتُ التي **يُخطئ فيها المستدعي** أو تُساء بها الإعدادات.
 *
 * قاعدةُ المادة ٣/٤: **أخطاءُ العمل قيمٌ معلنة، والاستثناءُ للحالات البرمجية وحدها**.
 * فهنا يُفحص الطرفان: الخطأُ المعلن يُعاد قيمةً تُعرض للمستخدم، والإعدادُ الفاسد أو يومُ
 * الأسبوع المجهول **يرمي** لأنه عطبُ تهيئةٍ لا اختيارُ مستخدم — والصمتُ عليه أخطرُ من الرمي.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { DailyLogStore, naturalKeyOf } from "../../../src/features/dailyLog/data/store.js"
import { makeDailyLogEndpoints } from "../../../src/features/dailyLog/server/endpoints.js"
import {
  activityAt,
  catalogView,
  upsertActivity,
  upsertScheme,
} from "../../../src/features/dailyLog/services/catalog.js"
import {
  settingBoolean,
  settingNumber,
  settingText,
} from "../../../src/features/dailyLog/services/context.js"
import { awardFor } from "../../../src/features/dailyLog/services/eligibility.js"
import { recordDailyEntry } from "../../../src/features/dailyLog/services/entries.js"
import { setFamilyRoster } from "../../../src/features/dailyLog/services/roster.js"
import { targetForSpan } from "../../../src/features/dailyLog/services/totals.js"
import {
  dayKeyIn,
  weekEndExclusive,
  weekKeyOf,
  weekStartsInSpan,
} from "../../../src/features/dailyLog/services/time.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import {
  KHALID,
  KHALID_PATH,
  MEN_PATH,
  NOW,
  READ,
  TODAY,
  WEEK,
  WRITE,
  canonicalActor,
  dailyLogContext,
  seedDailyLogStore,
} from "./_seed.js"

const FROM = new Date("2026-01-01T00:00:00.000Z")
const SPAN = { fromDayKey: "2026-07-01", toDayKey: "2026-07-31" }

/** مستودعٌ مبذورٌ للقراءة وحدها — لا حالةَ مشتركةٌ بين الاختبارات. */
function store0(): DailyLogStore {
  return seedDailyLogStore()
}

beforeEach(() => clearRegistryForTests())

describe("المستودعُ: ذرّيةٌ ومفاتيحُ قراءةٍ واحدة", () => {
  it("**الرميةُ تُرجع المستودعَ كما كان** — لا قيدَ نصفَ مكتوبٍ ولا عدّادٌ يُحرق", () => {
    const store = seedDailyLogStore()
    const before = store.entries().length
    expect(() =>
      store.transaction(() => {
        store.saveEntry({
          tenantId: store.tenantId,
          id: store.nextId("dle"),
          clientUuid: "boom",
          unitPath: KHALID_PATH,
          activityId: "lesson",
          freeTextAr: null,
          dayKey: TODAY,
          periodKey: WEEK,
          count: 1,
          creditedCount: 1,
          points: 1,
          studentIds: [],
          creditedStudentIds: [],
          block: "none",
          byPersonId: "u-amir",
          at: NOW,
        })
        throw new Error("عطبٌ في منتصف العملية")
      }),
    ).toThrow()
    expect(store.entries()).toHaveLength(before)
    // العدّادُ يرتدّ مع المعاملة: المعرّفُ التالي هو نفسُه لا الذي يليه.
    expect(store.nextId("dle")).toBe("dle-1")
  })

  it("والمفتاحُ الطبيعيُّ **لا يوجد للنشاط الحرّ** — فلا يُصادر قيداً حرّاً آخر", () => {
    expect(naturalKeyOf(KHALID_PATH, null, TODAY)).toBeNull()
    expect(naturalKeyOf(KHALID_PATH, "lesson", TODAY)).toBe(`${KHALID_PATH}|lesson|${TODAY}`)
  })

  it("**وقيدان حرّان في اليوم نفسِه يتعايشان** — النصُّ الحرُّ ليس نشاطاً واحداً", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir")
    recordDailyEntry(store, ctx, {
      clientUuid: "f-1",
      unitId: KHALID,
      freeTextAr: "حملةُ نظافة",
      count: 1,
      date: NOW,
    })
    recordDailyEntry(store, ctx, {
      clientUuid: "f-2",
      unitId: KHALID,
      freeTextAr: "زيارةُ مريض",
      count: 1,
      date: NOW,
    })
    expect(store.entries()).toHaveLength(2)
  })

  it("وقراءاتُ المستودع المسمّاة تعمل: الوحدةُ والمخطّطُ والقيدُ بمعرّفاتها", () => {
    const store = seedDailyLogStore()
    expect(store.getUnit(KHALID)?.path).toBe(KHALID_PATH)
    expect(store.getUnit("ghost")).toBeNull()
    expect(store.getScheme("scheme-men")?.scopePath).toBe(MEN_PATH)
    expect(store.getScheme("ghost")).toBeNull()
    expect(store.getEntry("ghost")).toBeNull()
    expect(store.findByClientUuid("ghost")).toBeNull()
    expect(store.findByNaturalKey("ghost")).toBeNull()
    expect(store.units().length).toBeGreaterThan(0)
  })

  it("**والشبكةُ تُختم عند الحفظ** ولو أرسل المستدعي شبكةً أخرى — الختمُ لا يُفاوَض", () => {
    const store = new DailyLogStore("t-main")
    store.saveUnit({ tenantId: "t-forged", id: "x", path: "/x/" })
    expect(store.getUnit("x")?.tenantId).toBe("t-main")
  })
})

describe("الكتالوجُ: مخطّطاتٌ تُدار، وحدودُ إدخالٍ معلنة", () => {
  it("**المخطّطُ يُضاف ويُعطَّل بياناً** — قسمٌ جديدٌ بلا سطرِ كود", () => {
    const store = seedDailyLogStore()
    const added = upsertScheme(store, {
      id: "scheme-new",
      ar: "مخطّطٌ جديد",
      scopePath: "/men/homs/",
      active: true,
    })
    expect(added.ok && added.value.tenantId).toBe(store.tenantId)
    expect(catalogView(store).schemes.some((s) => s.id === "scheme-new")).toBe(true)
  })

  it("**وسقفٌ يوميٌّ غيرُ موجبٍ مرفوض** — سقفُ صفرٍ يعني «لا نقاطَ أبداً» فيُقال صراحةً", () => {
    const r = upsertActivity(seedDailyLogStore(), dailyLogContext("u-admin"), {
      schemeId: "scheme-men",
      activityId: "bad-cap",
      ar: "سقفٌ صفريّ",
      weight: 1,
      maxPerDay: 0,
      requiresParticipation: false,
      active: true,
    })
    expect(!r.ok && r.error.code).toBe("INVALID_WEIGHT")
  })

  it("**ونسخةٌ بأثرٍ رجعيٍّ مرفوضةٌ بنيوياً** (ق-٣٦): «بأثرٍ قادمٍ فقط» حارسٌ لا وعد", () => {
    const r = upsertActivity(seedDailyLogStore(), dailyLogContext("u-admin"), {
      schemeId: "scheme-men",
      activityId: "lesson",
      ar: "درسٌ في المسجد",
      weight: 99,
      maxPerDay: null,
      requiresParticipation: false,
      active: true,
      validFrom: FROM,
    })
    expect(!r.ok && r.error.code).toBe("BACKDATED_VERSION")
  })

  it("**وتعديلان في اليوم نفسِه نسخةٌ واحدة** — لا نسختان متعادلتان تتنازعان", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-admin")
    const base = {
      schemeId: "scheme-men",
      activityId: "twice",
      ar: "نشاطٌ عُدِّل مرتين",
      maxPerDay: null,
      requiresParticipation: false,
      active: true,
    }
    upsertActivity(store, ctx, { ...base, weight: 3 })
    upsertActivity(store, ctx, { ...base, weight: 8 })
    const versions = store.activities().filter((a) => a.activityId === "twice")
    expect(versions).toHaveLength(1)
    expect(activityAt(store, "scheme-men", "twice", NOW)?.weight).toBe(8)
  })
})

describe("الحتميّة: التعادلُ يُكسر بالمعرّف لا بترتيب الإدراج", () => {
  it("**مخطّطان بنفس عمق النطاق ⇒ يفوز الأصغرُ معرّفاً دائماً** — لا نتيجةَ تتبدّل بترتيب البذر", () => {
    const build = (order: readonly string[]) => {
      const store = seedDailyLogStore()
      for (const id of order) {
        upsertScheme(store, { id, ar: "مخطّطٌ متعادل", scopePath: "/men/homs/sq2/", active: true })
      }
      return schemeIdFor(store)
    }
    const schemeIdFor = (store: DailyLogStore) =>
      catalogView(store)
        .schemes.filter((s) => s.scopePath === "/men/homs/sq2/")
        .map((s) => s.id)
    // الترتيبان المعكوسان يعطيان نفس القائمة المرتَّبة — والفوزُ للأصغر معرّفاً.
    expect(build(["scheme-b", "scheme-a"])).toEqual(["scheme-a", "scheme-b"])
    expect(build(["scheme-a", "scheme-b"])).toEqual(["scheme-a", "scheme-b"])
  })

  it("**ونسختان بنفس تاريخ السريان ⇒ حتميّةٌ بالمعرّف** (درسُ لا-حتميّة `rateForMonth` في v1)", () => {
    const store = seedDailyLogStore()
    const version = (id: string, weight: number) =>
      store.saveActivity({
        tenantId: store.tenantId,
        id,
        schemeId: "scheme-men",
        activityId: "tie",
        ar: "نشاطٌ متعادلُ السريان",
        weight,
        maxPerDay: null,
        requiresParticipation: false,
        active: true,
        validFrom: FROM,
      })
    version("v-b", 8)
    version("v-a", 3)
    expect(activityAt(store, "scheme-men", "tie", NOW)?.weight).toBe(3)
  })

  it("**ومعاينةُ الكتالوج ترتّب نسخَ النشاط الواحد بتاريخ سريانها** — الأقدمُ أولاً", () => {
    const store = seedDailyLogStore()
    upsertActivity(store, dailyLogContext("u-admin"), {
      schemeId: "scheme-men",
      activityId: "lesson",
      ar: "درسٌ في المسجد",
      weight: 12,
      maxPerDay: null,
      requiresParticipation: false,
      active: true,
    })
    const lessons = catalogView(store).activities.filter((a) => a.activityId === "lesson")
    expect(lessons).toHaveLength(2)
    expect(lessons[0]!.validFrom.getTime()).toBeLessThan(lessons[1]!.validFrom.getTime())
  })

  it("**وصفرُ عددٍ محتسَبٍ بلا ازدواجٍ سببُه `none`** — لا يُلصَق بالقيد سببٌ لم يقع", () => {
    const definition = store0().activities().find((a) => a.activityId === "lesson")!
    expect(
      awardFor(dailyLogContext("u-amir"), {
        definition,
        unitPath: KHALID_PATH,
        requestedCount: 0,
        deduplicated: false,
        attendees: null,
        roster: null,
      }),
    ).toEqual({ creditedCount: 0, points: 0, block: "none" })
  })
})

describe("الزمن: عطبُ التهيئة يرمي ولا يُجاب صامتاً", () => {
  it("**يومُ بدءِ أسبوعٍ مجهولٌ يرمي** — الجوابُ الصامت على مدخلٍ فاسدٍ هو الثغرة نفسُها", () => {
    expect(() => weekKeyOf(TODAY, "funday")).toThrow(/يومُ بدءِ أسبوعٍ/)
    expect(() => weekStartsInSpan(SPAN.fromDayKey, SPAN.toDayKey, "funday")).toThrow(
      /يومُ بدءِ أسبوعٍ/,
    )
  })

  it("**ونهايةُ الأسبوع حدٌّ أعلى مفتوحٌ** = بدءُ الأسبوع التالي بالضبط", () => {
    expect(dayKeyIn(weekEndExclusive(WEEK), "UTC")).toBe("2026-07-25")
  })

  it("ومدىً معكوسُ الحدود عدّتُه صفرٌ لا رمية — «لا سبت فيه» جوابٌ صحيح", () => {
    expect(weekStartsInSpan("2026-07-31", "2026-07-01", "saturday")).toBe(0)
  })

  it("**وإعدادٌ بنوعٍ خاطئ يرمي**: الأرقامُ والمفاتيحُ والنصوصُ لا تُقرأ بالظنّ", () => {
    const ctx = dailyLogContext("u-amir")
    expect(() => settingNumber(ctx, "time.zone", KHALID_PATH)).toThrow(/ليس رقماً/)
    expect(() => settingBoolean(ctx, "points.weekly_target", KHALID_PATH)).toThrow(/ليس مفتاحاً/)
    expect(() => settingText(ctx, "points.weekly_target", KHALID_PATH)).toThrow(/ليس نصاً/)
  })
})

describe("الأهليةُ على الحوافّ", () => {
  it("**أسرةٌ عددُها صفرٌ لا تكسر القسمة** — ولا تمنح نقطةً بنسبةٍ وهمية", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir")
    setFamilyRoster(store, ctx, { unitId: KHALID, studentCount: 0 })
    const r = recordDailyEntry(store, ctx, {
      clientUuid: "z-1",
      unitId: KHALID,
      activityId: "jamaah",
      count: 1,
      date: NOW,
      attendees: 0,
    })
    expect(r.ok && r.value.points).toBe(0)
    expect(r.ok && r.value.block).toBe("belowParticipation")
  })

  it("**وضبطُ العدد على `null` يعيد المنع** — «غيرُ مضبوطٍ» حالةٌ يُرجَع إليها لا فراغٌ نهائيّ", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir")
    setFamilyRoster(store, ctx, { unitId: KHALID, studentCount: 10 })
    setFamilyRoster(store, ctx, { unitId: KHALID, studentCount: null })
    const r = recordDailyEntry(store, ctx, {
      clientUuid: "z-2",
      unitId: KHALID,
      activityId: "jamaah",
      count: 1,
      date: NOW,
      attendees: 10,
    })
    expect(r.ok && r.value.block).toBe("familyRosterUnset")
  })

  it("**وإطفاءُ fail-closed مع نشاطٍ مشروطٍ يمرّره بلا تحقّق** — سياسةٌ تُضبط بعينٍ مفتوحة", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir", {
      settings: [
        { settingId: "points.participation_fail_closed", scopePath: "/", value: false, validFrom: FROM },
      ],
    })
    const r = recordDailyEntry(store, ctx, {
      clientUuid: "z-3",
      unitId: KHALID,
      activityId: "jamaah",
      count: 3,
      date: NOW,
    })
    expect(r.ok && r.value.points).toBe(1)
    expect(r.ok && r.value.block).toBe("dailyCap")
  })
})

describe("سطوحُ الخادم على الحوافّ", () => {
  it("**معاينةُ الكتالوج للمدير وحده** — والقراءةُ تُظهر ما بُذر", async () => {
    const store = seedDailyLogStore()
    const ep = makeDailyLogEndpoints(store, createSettingsResolver([]), () => false)
    const r = await ep.catalogView.invoke({}, canonicalActor("u-admin"), READ)
    expect(r.ok && r.value.activities.length).toBeGreaterThan(0)

    const denied = await ep.catalogView.invoke({}, canonicalActor("u-amir"), READ)
    expect(denied.ok).toBe(false)
  })

  it("**ونموذجُ الصفحة يصل عبر السطح كما هو** — لا حسابَ ثانٍ في الطريق (ق-١١١)", async () => {
    const store = seedDailyLogStore()
    const ep = makeDailyLogEndpoints(store, createSettingsResolver([]), () => false)
    await ep.record.invoke(
      { unitId: KHALID, clientUuid: "s-1", activityId: "lesson", count: 2, date: NOW },
      canonicalActor("u-amir"),
      WRITE,
    )
    const viewed = await ep.view.invoke(
      { unitId: KHALID, periodKey: WEEK, span: SPAN },
      canonicalActor("u-amir"),
      READ,
    )
    expect(viewed.ok && viewed.value.points).toBe(10)
    expect(viewed.ok && viewed.value.target).toBe(
      targetForSpan(dailyLogContext("u-amir"), KHALID_PATH, SPAN),
    )
    expect(viewed.ok && viewed.value.submittable).toBe(true)
  })

  it("**وضبطُ عدد الأسرة يمرّ بالسطح ويظهر في النموذج** (ب-٣٢)", async () => {
    const store = seedDailyLogStore()
    const ep = makeDailyLogEndpoints(store, createSettingsResolver([]), () => false)
    const set = await ep.roster.invoke(
      { unitId: KHALID, studentCount: 14 },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(set.ok && set.value.ok).toBe(true)
    const viewed = await ep.view.invoke(
      { unitId: KHALID, periodKey: WEEK, span: SPAN },
      canonicalActor("u-amir"),
      READ,
    )
    expect(viewed.ok && viewed.value.familyStudentCount).toBe(14)
  })

  it("**والقفلُ المحقون يصل الخدمةَ من السطح** — منفذٌ واحدٌ لا فرعان", async () => {
    const store = seedDailyLogStore()
    const ep = makeDailyLogEndpoints(store, createSettingsResolver([]), () => true)
    const r = await ep.record.invoke(
      { unitId: KHALID, clientUuid: "s-lock", activityId: "lesson", count: 1, date: NOW },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(r.ok && r.value.ok === false && r.value.error.code).toBe("PERIOD_LOCKED")
  })
})
