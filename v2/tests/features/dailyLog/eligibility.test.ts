/**
 * أهليةُ النقاط — ق-٤٠ (سقفٌ يوميّ وعتبةُ مشاركة، **والخادمُ قاطع**) وب-٣٢ (fail-closed:
 * «نقطةٌ بلا تحقّقٍ نقطةٌ زائفة») وب-٤٢ (النشاطُ الحرّ توثيقٌ بلا نقاطٍ آلية).
 *
 * **الخادمُ قاطع**: لا يستقبل مدخلُ الإدخال «نقاطاً» أصلاً — يستقبل عدداً وحضوراً، والنقاطُ
 * تُحسب هنا. فالالتفافُ على الواجهة لا يشتري نقطةً واحدة.
 */
import { describe, it, expect } from "vitest"
import { upsertActivity } from "../../../src/features/dailyLog/services/catalog.js"
import { recordDailyEntry } from "../../../src/features/dailyLog/services/entries.js"
import { setFamilyRoster } from "../../../src/features/dailyLog/services/roster.js"
import { periodPoints } from "../../../src/features/dailyLog/services/totals.js"
import { KHALID, KHALID_PATH, NOW, WEEK, dailyLogContext, seedDailyLogStore } from "./_seed.js"

const FROM = new Date("2026-01-01T00:00:00.000Z")

function withRoster(count: number) {
  const store = seedDailyLogStore()
  const r = setFamilyRoster(store, dailyLogContext("u-amir"), { unitId: KHALID, studentCount: count })
  if (!r.ok) throw new Error(r.error.code)
  return store
}

describe("ق-٤٠ — السقفُ اليوميّ: الخادمُ يقصّ ما زاد ولو مرّ من الواجهة", () => {
  it("**نشاطٌ سقفُه نقطةٌ في اليوم لا يعطي أكثرَ ولو أُرسل عشرات المرات**", () => {
    const store = withRoster(10)
    const ctx = dailyLogContext("u-amir")
    const r = recordDailyEntry(store, ctx, {
      clientUuid: "c-cap",
      unitId: KHALID,
      activityId: "jamaah",
      count: 30,
      date: NOW,
      attendees: 10,
    })
    expect(r.ok && r.value.creditedCount).toBe(1)
    expect(r.ok && r.value.points).toBe(1)
    expect(r.ok && r.value.block).toBe("dailyCap")
  })

  it("ونشاطٌ بلا سقفٍ يُحتسب كلُّه", () => {
    const store = withRoster(10)
    const r = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "c-nocap",
      unitId: KHALID,
      activityId: "lesson",
      count: 4,
      date: NOW,
    })
    expect(r.ok && r.value.points).toBe(20)
  })

  it("**والسقفُ يُقاس على اليوم كلِّه لا على القيد الواحد** (قيدان في يومٍ لا يتجاوزانه)", () => {
    const store = withRoster(10)
    const ctx = dailyLogContext("u-amir")
    recordDailyEntry(store, ctx, {
      clientUuid: "c-c1",
      unitId: KHALID,
      activityId: "jamaah",
      count: 1,
      date: NOW,
      attendees: 10,
    })
    const second = recordDailyEntry(store, ctx, {
      clientUuid: "c-c2",
      unitId: "bilal",
      activityId: "jamaah",
      count: 1,
      date: NOW,
      attendees: 10,
    })
    expect(second.ok).toBe(true)
    expect(periodPoints(store, KHALID_PATH, WEEK)).toBe(1)
  })
})

describe("ق-٤٠ — عتبةُ المشاركة من الإعداد لا من الكود", () => {
  it("**حضورٌ دون العتبة ⇒ صفرُ نقاطٍ بسببٍ معلن**", () => {
    const store = withRoster(10)
    const r = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "c-low",
      unitId: KHALID,
      activityId: "jamaah",
      count: 1,
      date: NOW,
      attendees: 6,
    })
    expect(r.ok && r.value.points).toBe(0)
    expect(r.ok && r.value.block).toBe("belowParticipation")
  })

  it("وحضورٌ عند العتبة بالضبط يُقبل — الحدُّ شامل", () => {
    const store = withRoster(10)
    const r = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "c-eq",
      unitId: KHALID,
      activityId: "jamaah",
      count: 1,
      date: NOW,
      attendees: 7,
    })
    expect(r.ok && r.value.points).toBe(1)
  })

  it("**وخفضُ العتبة إعداداً يقلب النتيجة** — لا رقمَ صلبٌ في الكود (G14/قب-٦)", () => {
    const store = withRoster(10)
    const ctx = dailyLogContext("u-amir", {
      settings: [
        { settingId: "points.participation_min_pct", scopePath: "/", value: 50, validFrom: FROM },
      ],
    })
    const r = recordDailyEntry(store, ctx, {
      clientUuid: "c-lower",
      unitId: KHALID,
      activityId: "jamaah",
      count: 1,
      date: NOW,
      attendees: 6,
    })
    expect(r.ok && r.value.points).toBe(1)
  })

  it("وغيابُ عددِ الحاضرين في نشاطٍ مشروطٍ ⇒ لا نقاط (لا احتسابَ بالظنّ)", () => {
    const store = withRoster(10)
    const r = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "c-noatt",
      unitId: KHALID,
      activityId: "jamaah",
      count: 1,
      date: NOW,
    })
    expect(r.ok && r.value.points).toBe(0)
    expect(r.ok && r.value.block).toBe("belowParticipation")
  })

  it("والنشاطُ غيرُ المشروط لا يُسأل عن حضورٍ أصلاً", () => {
    const store = seedDailyLogStore()
    const r = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "c-free-of-cond",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
    })
    expect(r.ok && r.value.points).toBe(5)
  })
})

describe("ب-٣٢ — fail-closed: حين لا يُضبط عددُ الطلاب تُمنع النقاط حتى يُضبط", () => {
  it("**نشاطٌ مشروطٌ وعددُ الأسرة غيرُ مضبوط ⇒ صفرُ نقاطٍ والسجلُّ يبقى توثيقاً**", () => {
    const store = seedDailyLogStore()
    const r = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "c-fc",
      unitId: KHALID,
      activityId: "jamaah",
      count: 1,
      date: NOW,
      attendees: 10,
    })
    expect(r.ok && r.value.points).toBe(0)
    expect(r.ok && r.value.block).toBe("familyRosterUnset")
    expect(periodPoints(store, KHALID_PATH, WEEK)).toBe(0)
  })

  it("**وضبطُ العدد يفتح النقاط فوراً** — «حتى يُضبط» لا «إلى الأبد»", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir")
    recordDailyEntry(store, ctx, {
      clientUuid: "c-fc2",
      unitId: KHALID,
      activityId: "jamaah",
      count: 1,
      date: NOW,
      attendees: 10,
    })
    setFamilyRoster(store, ctx, { unitId: KHALID, studentCount: 10 })
    const again = recordDailyEntry(store, ctx, {
      clientUuid: "c-fc2",
      unitId: KHALID,
      activityId: "jamaah",
      count: 1,
      date: NOW,
      attendees: 10,
    })
    expect(again.ok && again.value.points).toBe(1)
  })

  it("والنشاطُ غيرُ المشروط لا يتأثر بغياب العدد — المنعُ مقصورٌ على المشروط", () => {
    const store = seedDailyLogStore()
    const r = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "c-fc3",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
    })
    expect(r.ok && r.value.points).toBe(5)
  })

  it("**وإطفاءُ `points.participation_fail_closed` قرارُ مالكٍ يُضبط لا حارسٌ يُلتفّ عليه**", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir", {
      settings: [
        { settingId: "points.participation_fail_closed", scopePath: "/", value: false, validFrom: FROM },
      ],
    })
    const r = recordDailyEntry(store, ctx, {
      clientUuid: "c-fc4",
      unitId: KHALID,
      activityId: "jamaah",
      count: 1,
      date: NOW,
      attendees: 10,
    })
    expect(r.ok && r.value.points).toBe(1)
  })

  it("وعددُ أسرةٍ سالبٌ يُرفض عند الضبط لا عند الاحتساب", () => {
    const store = seedDailyLogStore()
    const r = setFamilyRoster(store, dailyLogContext("u-amir"), { unitId: KHALID, studentCount: -3 })
    expect(!r.ok && r.error.code).toBe("INVALID_STUDENT_COUNT")
  })

  it("وضبطُ العدد على وحدةٍ مجهولةٍ مرفوض", () => {
    const store = seedDailyLogStore()
    const r = setFamilyRoster(store, dailyLogContext("u-amir"), { unitId: "ghost", studentCount: 3 })
    expect(!r.ok && r.error.code).toBe("UNKNOWN_UNIT")
  })
})

describe("ب-٤٢ — النشاطُ الحرّ: توثيقٌ بلا نقاطٍ آلية، ويظهر لمعتمِد السجل", () => {
  it("**نشاطٌ حرٌّ نصّيٌّ يُسجَّل بصفر نقاطٍ آلية**", () => {
    const store = seedDailyLogStore()
    const r = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "c-free",
      unitId: KHALID,
      freeTextAr: "حملةُ نظافةٍ لساحة المسجد",
      count: 1,
      date: NOW,
    })
    expect(r.ok && r.value.points).toBe(0)
    expect(r.ok && r.value.block).toBe("freeActivity")
    expect(r.ok && r.value.freeTextAr).toBe("حملةُ نظافةٍ لساحة المسجد")
  })

  it("ونصٌّ فارغٌ يُرفض — «اكتب ما هو هذا النشاط» شرطٌ لا زينة (ع-١٥)", () => {
    const store = seedDailyLogStore()
    const r = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "c-free2",
      unitId: KHALID,
      freeTextAr: "   ",
      count: 1,
      date: NOW,
    })
    expect(!r.ok && r.error.code).toBe("EMPTY_FREE_TEXT")
  })

  it("وقيدٌ بلا نشاطٍ ولا نصٍّ حرٍّ يُرفض — لا قيدَ مجهولَ الهوية", () => {
    const store = seedDailyLogStore()
    const r = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "c-none",
      unitId: KHALID,
      count: 1,
      date: NOW,
    })
    expect(!r.ok && r.error.code).toBe("ACTIVITY_OR_FREE_TEXT_REQUIRED")
  })

  it("**وضبطُ `points.free_activity_scores` على «صحيح» لا يغيّر شيئاً** — الإعدادُ لا يُلغي قرارَ ب-٤٢ (CR-010)", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-amir", {
      settings: [
        { settingId: "points.free_activity_scores", scopePath: "/", value: true, validFrom: FROM },
      ],
    })
    const r = recordDailyEntry(store, ctx, {
      clientUuid: "c-free3",
      unitId: KHALID,
      freeTextAr: "نشاطٌ يُراد تنقيطُه آلياً",
      count: 1,
      date: NOW,
    })
    expect(r.ok && r.value.points).toBe(0)
    expect(r.ok && r.value.block).toBe("freeActivity")
  })

  it("**والطريقُ المشروع وحيد**: تضيفه الإدارةُ للكتالوج فيصير منقّطاً بوزنٍ معلن (ب-٤٢)", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-admin")
    const added = upsertActivity(store, ctx, {
      schemeId: "scheme-men",
      activityId: "cleanup",
      ar: "حملةُ نظافة",
      weight: 2,
      maxPerDay: null,
      requiresParticipation: false,
      active: true,
    })
    expect(added.ok).toBe(true)
    const r = recordDailyEntry(store, ctx, {
      clientUuid: "c-free4",
      unitId: KHALID,
      activityId: "cleanup",
      count: 1,
      date: NOW,
    })
    expect(r.ok && r.value.points).toBe(2)
  })
})
