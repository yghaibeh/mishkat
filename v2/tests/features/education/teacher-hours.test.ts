/**
 * **الاختبارُ الإلزاميّ الرابع** (T19) — **ق-٨٦**: مالية المعلّم **من الدروس المعتمدة فقط**
 * («منعاً للغش» — نصُّ القاعدة)، **ولمناهج الإعداد وحدها**.
 *
 * وهذه **الواجهةُ المعلنة** التي تستهلكها وحدةُ الرواتب لاحقاً — ولا رواتبَ تُبنى هنا:
 * نُصدِّر **دقائق ودروساً**، والمالُ في موطنه (`finance.hourly_rate.amount`).
 */
import { describe, it, expect } from "vitest"
import { approvedTeachingLoad } from "../../../src/features/education/services/teacherHours.js"
import { recordLesson } from "../../../src/features/education/services/lessons.js"
import {
  educationContext,
  HELD_AT,
  NEXT_DAY,
  NOW,
  SESSION_A,
  SESSION_B,
  seedWorld,
  settingsWith,
  type EduWorld,
} from "./_seed.js"

const FROM = new Date("2026-07-01T00:00:00.000Z")
const TO = new Date("2026-08-01T00:00:00.000Z")

/**
 * **يومُ الدرس صريحٌ لا ضمنيّ** (CR-016): الكيانُ «الجلسةُ **اليومية**» ومفتاحُه (حلقة × يوم)،
 * فدرسان لحلقةٍ واحدةٍ **يومان** — وإعادةُ اليوم نفسِه استبدالٌ لا إضافة (ق-٩٠ «upsert»).
 */
function record(
  w: EduWorld,
  sessionId: string,
  minutes: number,
  circleId?: string,
  heldAt: Date = HELD_AT,
): string {
  const done = recordLesson(w.education, educationContext(w), {
    circleId: circleId ?? w.circleId,
    sessionId,
    heldAt,
    durationMinutes: minutes,
    presentEnrollmentIds: w.circles
      .enrollments()
      .filter((e) => e.circleId === (circleId ?? w.circleId))
      .map((e) => e.id),
  })
  if (!done.ok) throw new Error(done.error.code)
  return done.value.id
}

describe("**ق-٨٦ — المعتمَدُ وحدَه يُحتسب، والمسجَّلُ غيرُ المعتمَد لا يُحتسب أبداً**", () => {
  it("درسان مسجَّلان وواحدٌ معتمَد ⇒ **المعتمَدُ وحده** في الحصيلة", () => {
    const w = seedWorld()
    const approvedId = record(w, SESSION_A, 90)
    record(w, SESSION_B, 60, undefined, NEXT_DAY)

    const done = approvedTeachingLoad(
      w.education,
      educationContext(w, { approvedLessonIds: [approvedId] }),
      { teacherPersonId: "u-teacher", from: FROM, to: TO },
    )
    expect(done.ok, done.ok === false ? done.error.code : "").toBe(true)
    if (!done.ok) return
    expect(done.value.totalLessonCount).toBe(1)
    expect(done.value.totalMinutes).toBe(90)
    expect(done.value.lines).toHaveLength(1)
    expect(done.value.lines[0]?.lessonIds).toEqual([approvedId])
    expect(done.value.lines[0]?.circleTypeId).toBe("baseera")
  })

  it("**وبلا اعتمادٍ أصلاً: صفرُ دقيقةٍ وصفرُ درس** — التسجيلُ لا يُنتج مالاً", () => {
    const w = seedWorld()
    record(w, SESSION_A, 90)
    const done = approvedTeachingLoad(w.education, educationContext(w), {
      teacherPersonId: "u-teacher",
      from: FROM,
      to: TO,
    })
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.value.totalLessonCount).toBe(0)
    expect(done.value.totalMinutes).toBe(0)
    expect(done.value.lines).toEqual([])
  })

  it("**والمناهجُ المأجورة من الإعداد لا من الكود** (قب-٦/CR-014): نوعٌ خارج الإعداد لا يُحتسب", () => {
    const w = seedWorld()
    // منهاجٌ ثانٍ لنوعٍ آخر + حلقةٌ منه مُسنَدةٌ للمعلّم نفسِه.
    w.education.saveCurriculum({ tenantId: w.education.tenantId, id: "cur-t", ar: "منهاجٌ ثانٍ", circleTypeId: "tahfeez" })
    w.education.saveLevel({ tenantId: w.education.tenantId, id: "lvl-t", curriculumId: "cur-t", ar: "م", ordinal: 1 })
    w.education.saveBook({ tenantId: w.education.tenantId, id: "book-t", levelId: "lvl-t", ar: "ك", ordinal: 1 })
    w.education.saveSession({ tenantId: w.education.tenantId, id: "ses-t", bookId: "book-t", ar: "ج", ordinal: 1 })
    const circle = w.circles.getCircle(w.tahfeezCircleId)!
    w.circles.saveCircle({ ...circle, teacherPersonId: "u-teacher" })

    const paid = record(w, SESSION_A, 60)
    const unpaid = record(w, "ses-t", 120, w.tahfeezCircleId)

    const done = approvedTeachingLoad(
      w.education,
      educationContext(w, { approvedLessonIds: [paid, unpaid] }),
      { teacherPersonId: "u-teacher", from: FROM, to: TO },
    )
    expect(done.ok).toBe(true)
    if (!done.ok) return
    // الإعدادُ الافتراضيّ يحتسب نوعاً واحداً — فالمعتمَدُ من النوع الآخر **لا يُحتسب**.
    expect(done.value.totalMinutes).toBe(60)
    expect(done.value.lines.map((l) => l.circleTypeId)).toEqual(["baseera"])
  })

  it("**ورفعُ الإعداد وحدَه يغيّر السلوك بلا سطرِ كود** — النوعُ الثاني يصير مأجوراً", () => {
    const w = seedWorld()
    w.education.saveCurriculum({ tenantId: w.education.tenantId, id: "cur-t", ar: "منهاجٌ ثانٍ", circleTypeId: "tahfeez" })
    w.education.saveLevel({ tenantId: w.education.tenantId, id: "lvl-t", curriculumId: "cur-t", ar: "م", ordinal: 1 })
    w.education.saveBook({ tenantId: w.education.tenantId, id: "book-t", levelId: "lvl-t", ar: "ك", ordinal: 1 })
    w.education.saveSession({ tenantId: w.education.tenantId, id: "ses-t", bookId: "book-t", ar: "ج", ordinal: 1 })
    const circle = w.circles.getCircle(w.tahfeezCircleId)!
    w.circles.saveCircle({ ...circle, teacherPersonId: "u-teacher" })

    const a = record(w, SESSION_A, 60)
    const b = record(w, "ses-t", 120, w.tahfeezCircleId)

    const settings = settingsWith([
      {
        settingId: "edu.paid_hours.curricula",
        scopePath: "/",
        value: ["baseera", "tahfeez"],
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    ])
    const done = approvedTeachingLoad(
      w.education,
      educationContext(w, { approvedLessonIds: [a, b], settings }),
      { teacherPersonId: "u-teacher", from: FROM, to: TO },
    )
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.value.totalMinutes).toBe(180)
    expect(done.value.totalLessonCount).toBe(2)
  })

  it("**ولا تخضرّ عند الغموض**: نوعٌ في الإعداد وليس في كتالوج الأنواع ⇒ `UNKNOWN_PAID_CURRICULUM`", () => {
    const w = seedWorld()
    const settings = settingsWith([
      {
        settingId: "edu.paid_hours.curricula",
        scopePath: "/",
        value: ["baseera", "نوعٌ-مخترع"],
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    ])
    const done = approvedTeachingLoad(w.education, educationContext(w, { settings }), {
      teacherPersonId: "u-teacher",
      from: FROM,
      to: TO,
    })
    expect(done.ok).toBe(false)
    expect(done.ok === false && done.error.code).toBe("UNKNOWN_PAID_CURRICULUM")
  })

  it("**والنافذةُ الزمنية صريحةٌ** `[from, to)`: درسٌ خارجها لا يُحتسب ولو اعتُمد", () => {
    const w = seedWorld()
    const id = record(w, SESSION_A, 60)
    const ctx = educationContext(w, { approvedLessonIds: [id] })
    const outside = approvedTeachingLoad(w.education, ctx, {
      teacherPersonId: "u-teacher",
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-09-01T00:00:00.000Z"),
    })
    expect(outside.ok && outside.value.totalMinutes).toBe(0)
    // والحدُّ الأعلى **مفتوح**: درسٌ في لحظة `to` بعينها خارجَها.
    const boundary = approvedTeachingLoad(w.education, ctx, {
      teacherPersonId: "u-teacher",
      from: FROM,
      to: HELD_AT,
    })
    expect(boundary.ok && boundary.value.totalMinutes).toBe(0)
  })

  it("**ودروسُ معلّمٍ آخر لا تتسرّب**: الاشتقاقُ على المعلّم المخزَّن في الدرس", () => {
    const w = seedWorld()
    const id = record(w, SESSION_A, 60)
    const done = approvedTeachingLoad(
      w.education,
      educationContext(w, { approvedLessonIds: [id] }),
      { teacherPersonId: "u-amir", from: FROM, to: TO },
    )
    expect(done.ok && done.value.totalMinutes).toBe(0)
    expect(NOW.getTime()).toBeGreaterThan(HELD_AT.getTime())
  })
})

describe("**ولا مالَ يُحسب هنا** (ق-٨٦ حدُّه): دقائقُ ودروسٌ فقط — والمبلغُ في موطنه", () => {
  it("الواجهةُ المعلنة تُصدِّر `minutes` و`lessonCount` ولا تُصدِّر مبلغاً", () => {
    const w = seedWorld()
    const id = record(w, SESSION_A, 45)
    const done = approvedTeachingLoad(
      w.education,
      educationContext(w, { approvedLessonIds: [id] }),
      { teacherPersonId: "u-teacher", from: FROM, to: TO },
    )
    expect(done.ok).toBe(true)
    if (!done.ok) return
    const keys = Object.keys(done.value.lines[0] ?? {})
    for (const forbidden of ["amount", "money", "rate", "salary", "cents"]) {
      expect(keys.some((k) => k.toLowerCase().includes(forbidden)), forbidden).toBe(false)
    }
    expect(keys.sort()).toEqual(["circleId", "circleTypeId", "curriculumId", "lessonCount", "lessonIds", "minutes"])
  })
})
