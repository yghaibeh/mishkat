/**
 * ب-٤٣/ع-١٨ — **إدارةُ لجنةٍ أغنى**: عددُ الشباب المشاركين وأسماؤهم وتاريخُ الإنجاز.
 * وق-١٣ في شقّه **القابل للاختبار داخل هذه الوحدة**: مساهمةُ اللجان في سجل المسجد
 * **دالةُ اشتقاقٍ لا حقلٌ مخزَّن**، ولا تحتسب إلا ما أُقرّ — و«ما أُقرّ» يصل **مُعطىً من
 * خارج الوحدة** (سلسلةُ المحرّك)، فليس في هذه الوحدة سطرُ اعتمادٍ واحد (G22).
 */
import { describe, it, expect } from "vitest"
import { formCommittee } from "../../../src/features/committees/services/committees.js"
import {
  recordActivity,
  activitiesOf,
  mosqueRecordContribution,
} from "../../../src/features/committees/services/activities.js"
import {
  DAWAH,
  KHALID,
  KHALID_PATH,
  BILAL,
  BILAL_PATH,
  NOW,
  PERIOD,
  RELIEF,
  committeeContext,
  seedCommitteeStore,
} from "./_seed.js"

const YESTERDAY = new Date("2026-07-19T00:00:00.000Z")
const TOMORROW = new Date("2026-07-21T00:00:00.000Z")

function seeded() {
  const store = seedCommitteeStore()
  const relief = formCommittee(store, committeeContext("u-amir"), {
    id: RELIEF.id,
    mosqueUnitId: KHALID,
    labelAr: RELIEF.labelAr,
    headPersonId: RELIEF.headPersonId,
    headNameAr: RELIEF.headNameAr,
  })
  if (!relief.ok) throw new Error(relief.error.code)
  return { store, relief: relief.value }
}

function record(
  store: ReturnType<typeof seeded>["store"],
  over: Partial<{
    committeeId: string
    periodId: string
    titleAr: string
    participantCount: number
    participantNamesAr: readonly string[]
    completedAt: Date
  }> = {},
) {
  return recordActivity(store, committeeContext("u-committee-head"), {
    committeeId: RELIEF.id,
    periodId: PERIOD,
    titleAr: "توزيعُ سلالٍ غذائية",
    participantCount: 3,
    participantNamesAr: ["أحمد", "بلال", "خالد"],
    completedAt: YESTERDAY,
    ...over,
  })
}

describe("ب-٤٣/ع-١٨ — النشاطُ يحمل عددَ المشاركين وأسماءَهم وتاريخَ الإنجاز", () => {
  it("يُسجَّل النشاطُ بثلاثته: العددُ والأسماءُ الحرّة وتاريخُ الإنجاز", () => {
    const { store } = seeded()
    const done = record(store)
    if (!done.ok) throw new Error(done.error.code)
    expect(done.value.participantCount).toBe(3)
    expect(done.value.participantNamesAr).toEqual(["أحمد", "بلال", "خالد"])
    expect(done.value.completedAt).toEqual(YESTERDAY)
    expect(activitiesOf(store, RELIEF.id, PERIOD)).toHaveLength(1)
  })

  it("**والأسماءُ حرّةٌ هنا كذلك** (ق-٣١): لا حقلَ معرّفِ شخصٍ في النشاط أصلاً", () => {
    const { store } = seeded()
    const done = record(store)
    if (!done.ok) throw new Error(done.error.code)
    expect(Object.keys(done.value)).not.toContain("participantPersonIds")
    expect(Object.keys(done.value)).not.toContain("personId")
  })

  it("ويجوز عددٌ بلا أسماء (الخصوصيةُ أولاً — ق-٣١): الأسماءُ اختياريّةٌ والعددُ لا", () => {
    const { store } = seeded()
    const done = record(store, { participantNamesAr: [] })
    expect(done.ok).toBe(true)
  })

  it("**ولا يتناقض سطران**: عددٌ يخالف الأسماءَ المذكورة مردودٌ (ج٧: حدودُ القيم)", () => {
    const { store } = seeded()
    const done = record(store, { participantCount: 9, participantNamesAr: ["أحمد"] })
    expect(done.ok).toBe(false)
    if (!done.ok) expect(done.error.code).toBe("PARTICIPANT_COUNT_MISMATCH")
  })

  it("وعددٌ سالبٌ مردود", () => {
    const { store } = seeded()
    const done = record(store, { participantCount: -1, participantNamesAr: [] })
    expect(done.ok).toBe(false)
    if (!done.ok) expect(done.error.code).toBe("NEGATIVE_PARTICIPANTS")
  })

  it("وعنوانٌ فارغٌ مردود", () => {
    const { store } = seeded()
    const done = record(store, { titleAr: "  " })
    expect(done.ok).toBe(false)
    if (!done.ok) expect(done.error.code).toBe("EMPTY_ACTIVITY_TITLE")
  })

  it("ونشاطٌ للجنةٍ مجهولةٍ مردود", () => {
    const { store } = seeded()
    const done = record(store, { committeeId: "لا-لجنة" })
    expect(done.ok).toBe(false)
    if (!done.ok) expect(done.error.code).toBe("COMMITTEE_NOT_FOUND")
  })

  it("**وتاريخُ الإنجاز في المستقبل يُردّ بإعدادٍ حيّ لا بحكمٍ صلب** (قب-٦/ق-٤٥)", () => {
    const { store } = seeded()
    const blocked = record(store, { completedAt: TOMORROW })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.error.code).toBe("FUTURE_COMPLETION_DATE")
  })

  it("**ورفعُ الإعداد وحده يقلب السلوك بلا تغيير سطرِ كود** (قب-٦)", () => {
    const { store } = seeded()
    const allowed = recordActivity(
      store,
      committeeContext("u-committee-head", [
        {
          settingId: "records.allow_future_dating",
          scopePath: "/",
          value: true,
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]),
      {
        committeeId: RELIEF.id,
        periodId: PERIOD,
        titleAr: "نشاطٌ مؤرَّخٌ غداً",
        participantCount: 0,
        participantNamesAr: [],
        completedAt: TOMORROW,
      },
    )
    expect(allowed.ok).toBe(true)
  })

  it("**والوحدةُ خلف مفتاح تفعيلها** (قب-٧): تعطيلُ `feature.committees` يمنع الإدخال ولا يمحو", () => {
    const { store } = seeded()
    const before = activitiesOf(store, RELIEF.id, PERIOD)
    const off = recordActivity(
      store,
      committeeContext("u-committee-head", [
        {
          settingId: "feature.committees",
          scopePath: "/",
          value: false,
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]),
      {
        committeeId: RELIEF.id,
        periodId: PERIOD,
        titleAr: "نشاطٌ بعد التعطيل",
        participantCount: 0,
        participantNamesAr: [],
        completedAt: YESTERDAY,
      },
    )
    expect(off.ok).toBe(false)
    if (!off.ok) expect(off.error.code).toBe("MODULE_DISABLED")
    expect(activitiesOf(store, RELIEF.id, PERIOD)).toHaveLength(before.length)
  })
})

describe("ق-١٣ — مساهمةُ اللجان في سجل المسجد **اشتقاقٌ**، ولا تُحتسب إلا المُقرّة", () => {
  it("**قبل الإقرار: صفر** — نشاطٌ مسجَّلٌ ولجنتُه ليست في المُقرّ فلا يدخل السجل", () => {
    const { store } = seeded()
    record(store)
    const before = mosqueRecordContribution(store, {
      mosquePath: KHALID_PATH,
      periodId: PERIOD,
      confirmedCommitteeIds: new Set(),
    })
    expect(before.activityCount).toBe(0)
    expect(before.participantCount).toBe(0)
    expect(before.committeeIds).toEqual([])
  })

  it("**وبعد الإقرار: تُحتسب** — اللجنةُ في المُقرّ فيدخل نشاطُها ومشاركوه", () => {
    const { store } = seeded()
    record(store)
    record(store, { titleAr: "درسٌ أسبوعيّ", participantCount: 2, participantNamesAr: ["زيد", "عمر"] })
    const after = mosqueRecordContribution(store, {
      mosquePath: KHALID_PATH,
      periodId: PERIOD,
      confirmedCommitteeIds: new Set([RELIEF.id]),
    })
    expect(after.activityCount).toBe(2)
    expect(after.participantCount).toBe(5)
    expect(after.committeeIds).toEqual([RELIEF.id])
  })

  it("**ولا تخلط فترةٌ بفترة**: نشاطُ فترةٍ أخرى لا يدخل سجل هذه الفترة", () => {
    const { store } = seeded()
    record(store, { periodId: "1447-11" })
    const now = mosqueRecordContribution(store, {
      mosquePath: KHALID_PATH,
      periodId: PERIOD,
      confirmedCommitteeIds: new Set([RELIEF.id]),
    })
    expect(now.activityCount).toBe(0)
  })

  it("**ولا يدخل سجلَّ مسجدٍ نشاطُ لجنةِ مسجدٍ آخر** (عزلُ النطاق بالاحتواء)", () => {
    const { store } = seeded()
    const other = formCommittee(store, committeeContext("u-amir-bilal"), {
      id: DAWAH.id,
      mosqueUnitId: BILAL,
      labelAr: DAWAH.labelAr,
      headPersonId: null,
      headNameAr: DAWAH.headNameAr,
    })
    if (!other.ok) throw new Error(other.error.code)
    record(store, { committeeId: DAWAH.id, participantCount: 7, participantNamesAr: [] })

    const khalid = mosqueRecordContribution(store, {
      mosquePath: KHALID_PATH,
      periodId: PERIOD,
      confirmedCommitteeIds: new Set([RELIEF.id, DAWAH.id]),
    })
    expect(khalid.participantCount).toBe(0)

    const bilal = mosqueRecordContribution(store, {
      mosquePath: BILAL_PATH,
      periodId: PERIOD,
      confirmedCommitteeIds: new Set([RELIEF.id, DAWAH.id]),
    })
    expect(bilal.participantCount).toBe(7)
    expect(bilal.committeeIds).toEqual([DAWAH.id])
  })

  it("**وصفر رقمٍ مخزَّن**: المساهمةُ تتغيّر بتغيّر الأنشطة بلا حقلِ مجموعٍ يُحدَّث", () => {
    const { store } = seeded()
    const args = {
      mosquePath: KHALID_PATH,
      periodId: PERIOD,
      confirmedCommitteeIds: new Set([RELIEF.id]),
    }
    expect(mosqueRecordContribution(store, args).activityCount).toBe(0)
    record(store)
    expect(mosqueRecordContribution(store, args).activityCount).toBe(1)
    record(store, { titleAr: "نشاطٌ ثانٍ", participantCount: 0, participantNamesAr: [] })
    expect(mosqueRecordContribution(store, args).activityCount).toBe(2)
  })

  it("وأنشطةُ الفترة للجنةٍ بعينها تُقرأ مرتَّبةً حتمياً (لا ترتيبَ إدراجٍ يتسرّب)", () => {
    const { store } = seeded()
    record(store, { titleAr: "ب" })
    record(store, { titleAr: "أ" })
    const ids = activitiesOf(store, RELIEF.id, PERIOD).map((a) => a.id)
    expect([...ids].sort()).toEqual(ids)
    expect(NOW.getTime()).toBeGreaterThan(YESTERDAY.getTime())
  })
})
