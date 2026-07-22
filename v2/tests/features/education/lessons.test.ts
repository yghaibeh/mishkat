/**
 * **تسجيلُ الدرس بحضورٍ وصور** (ب-١٤/ق-٩٠) — والحرّاسُ التي تعيش في الكاتب الواحد
 * (`services/lessons.ts`، عقدُ الوحدة §٣).
 *
 * والسلبُ أكثرُ من الإيجاب عمداً (TESTING_POLICY §٤): النظامُ الآمن يُعرَّف بما يمنعه.
 */
import { describe, it, expect } from "vitest"
import {
  attendanceOf,
  lessonsOfCircle,
  lessonsOfTeacher,
  photosOf,
  recordLesson,
} from "../../../src/features/education/services/lessons.js"
import { archiveCircle } from "../../../src/features/circles/services/circles.js"
import {
  circlesContext,
  educationContext,
  emptyCircleOf,
  HELD_AT,
  SESSION_A,
  SESSION_B,
  seedWorld,
} from "./_seed.js"

describe("§٣ — الدرسُ ابنُ الحلقة: يُسجَّل بمجلسٍ من منهاج نوعها، بحضورٍ وصور", () => {
  it("درسٌ صحيحٌ يُسجَّل بحضورِ مَن هو ملتحقٌ فعلاً، وبصورٍ منسوبة", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    const done = recordLesson(w.education, ctx, {
      circleId: w.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 90,
      venueAr: "المعهدُ النسائيّ",
      presentEnrollmentIds: [w.enrollmentIds[0]!, w.enrollmentIds[1]!],
      photoKeys: ["media/2026/07/a.jpg", "media/2026/07/b.jpg"],
    })
    expect(done.ok, done.ok === false ? done.error.code : "").toBe(true)
    if (!done.ok) return

    expect(done.value.circleId).toBe(w.circleId)
    expect(done.value.teacherPersonId).toBe("u-teacher")
    expect(done.value.recordedBy).toBe("u-teacher")
    expect(attendanceOf(w.education, done.value.id).filter((a) => a.present)).toHaveLength(2)
    expect(photosOf(w.education, done.value.id)).toHaveLength(2)
    expect(lessonsOfCircle(w.education, w.circleId)).toHaveLength(1)
    expect(lessonsOfTeacher(w.education, "u-teacher")).toHaveLength(1)
  })

  it("**والحضورُ يُسجَّل لكل ملتحقٍ حاضراً أو غائباً** — فالغيابُ حقيقةٌ تُقرأ لا فراغٌ يُفسَّر", () => {
    const w = seedWorld()
    const done = recordLesson(w.education, educationContext(w), {
      circleId: w.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 60,
      presentEnrollmentIds: [w.enrollmentIds[0]!],
    })
    expect(done.ok).toBe(true)
    if (!done.ok) return
    const attendance = attendanceOf(w.education, done.value.id)
    expect(attendance).toHaveLength(3)
    expect(attendance.filter((a) => a.present).map((a) => a.enrollmentId)).toEqual([w.enrollmentIds[0]])
  })

  it("**والتسجيلُ upsert آمنُ الإعادة** (ق-٩٠): إعادةُ تسجيل المجلس نفسِه تُحدِّث ولا تُنشئ ثانياً", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    const first = recordLesson(w.education, ctx, {
      circleId: w.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 60,
      presentEnrollmentIds: [w.enrollmentIds[0]!],
    })
    const second = recordLesson(w.education, ctx, {
      circleId: w.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 75,
      presentEnrollmentIds: [w.enrollmentIds[0]!, w.enrollmentIds[2]!],
    })
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(second.value.id).toBe(first.value.id)
    expect(second.value.durationMinutes).toBe(75)
    expect(lessonsOfCircle(w.education, w.circleId)).toHaveLength(1)
    expect(attendanceOf(w.education, second.value.id).filter((a) => a.present)).toHaveLength(2)
  })

  it("**والمعتمَدُ لا يُكتب عليه** (ق-٨): إعادةُ تسجيل درسٍ اعتُمد ⇒ `LESSON_LOCKED`", () => {
    const w = seedWorld()
    const first = recordLesson(w.education, educationContext(w), {
      circleId: w.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 60,
      presentEnrollmentIds: [w.enrollmentIds[0]!],
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const locked = educationContext(w, { approvedLessonIds: [first.value.id] })
    const again = recordLesson(w.education, locked, {
      circleId: w.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 99,
      presentEnrollmentIds: [w.enrollmentIds[0]!],
    })
    expect(again.ok).toBe(false)
    expect(again.ok === false && again.error.code).toBe("LESSON_LOCKED")
  })
})

describe("§٣ — الحرّاسُ المُشخِّصة (المادة ٣/٤): كلُّ رفضٍ باسمه لا برفضٍ مبهم", () => {
  const base = {
    heldAt: HELD_AT,
    durationMinutes: 60,
  } as const

  it("حلقةٌ مجهولة ⇒ `UNKNOWN_CIRCLE`، ومؤرشفة ⇒ `CIRCLE_ARCHIVED`", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    const unknown = recordLesson(w.education, ctx, {
      ...base,
      circleId: "لا-وجود-لها",
      sessionId: SESSION_A,
      presentEnrollmentIds: [],
    })
    expect(unknown.ok === false && unknown.error.code).toBe("UNKNOWN_CIRCLE")

    archiveCircle(w.circles, circlesContext("u-amir"), { circleId: w.circleId })
    const archived = recordLesson(w.education, ctx, {
      ...base,
      circleId: w.circleId,
      sessionId: SESSION_A,
      presentEnrollmentIds: [w.enrollmentIds[0]!],
    })
    expect(archived.ok === false && archived.error.code).toBe("CIRCLE_ARCHIVED")
  })

  it("مجلسٌ مجهول ⇒ `UNKNOWN_SESSION`، ومجلسٌ من منهاجِ نوعٍ آخر ⇒ `SESSION_TYPE_MISMATCH`", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    const unknown = recordLesson(w.education, ctx, {
      ...base,
      circleId: w.circleId,
      sessionId: "لا-وجود-له",
      presentEnrollmentIds: [w.enrollmentIds[0]!],
    })
    expect(unknown.ok === false && unknown.error.code).toBe("UNKNOWN_SESSION")

    // منهاجٌ ثانٍ لنوعٍ آخر — مجلسُه لا يصلح لحلقةِ هذا النوع.
    w.education.saveCurriculum({ tenantId: w.education.tenantId, id: "cur-sci", ar: "منهاجُ العلمية", circleTypeId: "scientific" })
    w.education.saveLevel({ tenantId: w.education.tenantId, id: "lvl-s", curriculumId: "cur-sci", ar: "م", ordinal: 1 })
    w.education.saveBook({ tenantId: w.education.tenantId, id: "book-s", levelId: "lvl-s", ar: "ك", ordinal: 1 })
    w.education.saveSession({ tenantId: w.education.tenantId, id: "ses-s", bookId: "book-s", ar: "ج", ordinal: 1 })

    const mismatch = recordLesson(w.education, ctx, {
      ...base,
      circleId: w.circleId,
      sessionId: "ses-s",
      presentEnrollmentIds: [w.enrollmentIds[0]!],
    })
    expect(mismatch.ok === false && mismatch.error.code).toBe("SESSION_TYPE_MISMATCH")
  })

  it("مدّةٌ غيرُ صحيحة ⇒ `INVALID_DURATION` (صفراً أو سالبةً أو كسراً)", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    for (const durationMinutes of [0, -1, 1.5]) {
      const done = recordLesson(w.education, ctx, {
        circleId: w.circleId,
        sessionId: SESSION_A,
        heldAt: HELD_AT,
        durationMinutes,
        presentEnrollmentIds: [w.enrollmentIds[0]!],
      })
      expect(done.ok === false && done.error.code, String(durationMinutes)).toBe("INVALID_DURATION")
    }
  })

  it("**حاضرٌ ليس ملتحقاً ⇒ `NOT_ENROLLED`** — ولا سجلَّ طلابٍ ثانٍ يُخترع هنا", () => {
    const w = seedWorld()
    const done = recordLesson(w.education, educationContext(w), {
      ...base,
      circleId: w.circleId,
      sessionId: SESSION_A,
      presentEnrollmentIds: ["enr-غريب"],
    })
    expect(done.ok === false && done.error.code).toBe("NOT_ENROLLED")
  })

  it("وحاضرٌ مكرَّر ⇒ `DUPLICATE_ATTENDANCE`، وحلقةٌ بلا ملتحقين ⇒ `EMPTY_ATTENDANCE`", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    const duplicated = recordLesson(w.education, ctx, {
      ...base,
      circleId: w.circleId,
      sessionId: SESSION_A,
      presentEnrollmentIds: [w.enrollmentIds[0]!, w.enrollmentIds[0]!],
    })
    expect(duplicated.ok === false && duplicated.error.code).toBe("DUPLICATE_ATTENDANCE")

    const empty = recordLesson(w.education, ctx, {
      ...base,
      circleId: w.tahfeezCircleId,
      sessionId: SESSION_A,
      presentEnrollmentIds: [],
    })
    // نوعُ التحفيظ بلا منهاج ⇒ يُردّ **قبل** الحضور: الترتيبُ مقصودٌ ويُختبر بترتيبه.
    expect(empty.ok === false && empty.error.code).toBe("NO_CURRICULUM_FOR_TYPE")
  })

  it("وحلقةٌ بلا ملتحقٍ واحد ⇒ `EMPTY_ATTENDANCE` — لا درسَ على فراغ", () => {
    const w = seedWorld()
    const done = recordLesson(w.education, educationContext(w), {
      ...base,
      circleId: emptyCircleOf(w),
      sessionId: SESSION_A,
      presentEnrollmentIds: [],
    })
    expect(done.ok === false && done.error.code).toBe("EMPTY_ATTENDANCE")
  })

  it("ومفتاحُ صورةٍ فارغ ⇒ `EMPTY_PHOTO_KEY`، ومكرَّر ⇒ `DUPLICATE_PHOTO_KEY`", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    const emptyKey = recordLesson(w.education, ctx, {
      ...base,
      circleId: w.circleId,
      sessionId: SESSION_A,
      presentEnrollmentIds: [w.enrollmentIds[0]!],
      photoKeys: ["  "],
    })
    expect(emptyKey.ok === false && emptyKey.error.code).toBe("EMPTY_PHOTO_KEY")

    const duplicated = recordLesson(w.education, ctx, {
      ...base,
      circleId: w.circleId,
      sessionId: SESSION_B,
      presentEnrollmentIds: [w.enrollmentIds[0]!],
      photoKeys: ["a.jpg", "a.jpg"],
    })
    expect(duplicated.ok === false && duplicated.error.code).toBe("DUPLICATE_PHOTO_KEY")
  })
})
