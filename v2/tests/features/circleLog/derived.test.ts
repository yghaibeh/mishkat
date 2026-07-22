/**
 * **الاختبارُ الإلزاميّ الثامن** (T18) — **صفر عدّادٍ مخزَّن** للتقدّم أو الحضور:
 * كلُّ رقمٍ **اشتقاقٌ لحظةَ السؤال** (شقُّه البنيويّ في `single-source.test.ts`).
 *
 * ثلاثةُ بلاغاتٍ ميدانية جذرُها واحد — رقمٌ مخزَّنٌ تباعد عن واقعه (ع-١٢/ع-١٩/ع-٢٩) —
 * وعلاجُها هنا: **لا يوجد عدّادٌ يُحدَّث فيُنسى**، فيستحيل التباعدُ أصلاً.
 */
import { describe, it, expect } from "vitest"
import { circleDayView, studentRecordView } from "../../../src/features/circleLog/services/derive.js"
import { recordSession } from "../../../src/features/circleLog/services/sessions.js"
import { enroll } from "../../../src/features/circles/services/enrollment.js"
import { circlesContext, logContext, NOW, seedWorld } from "./_seed.js"

describe("**سجلُّ اليوم مشتقٌّ من سجلّ العضوية الواحد** (موتُ «أُضيف ولم يظهر»)", () => {
  it("كشفُ اليوم يحوي **كلَّ ملتحقٍ حاليّ** ولو لم يُسجَّل بعد — الغائبُ سطرٌ لا فراغ", () => {
    const world = seedWorld()
    const view = circleDayView(world.log, logContext(world, "u-amir"), {
      circleId: world.circleId,
      at: NOW,
    })
    expect(view.ok).toBe(true)
    if (!view.ok) return
    expect(view.value.recorded).toBe(false)
    expect(view.value.rows.map((r) => r.nameAr)).toEqual(["عبد الله", "معاذ"])
    expect(view.value.rows.every((r) => r.attendance === null)).toBe(true)
  })

  it("**وطالبٌ يُضاف اليومَ يظهر في الكشف فوراً** — لا سجلَّين ولا جسرَ مزامنة (ق-٨٨ متقاعد)", () => {
    const world = seedWorld()
    enroll(world.circles, circlesContext("u-amir"), {
      circleId: world.circleId,
      nameAr: "أنس",
    })
    const view = circleDayView(world.log, logContext(world, "u-amir"), {
      circleId: world.circleId,
      at: NOW,
    })
    expect(view.ok && view.value.rows.map((r) => r.nameAr)).toContain("أنس")
  })

  it("ومَن غادر الحلقة يسقط من كشف اليوم — العضويةُ تاريخٌ يُقرأ لا صفٌّ يُمحى", () => {
    const world = seedWorld()
    world.circles.stampLeft(world.studentB, NOW)
    const view = circleDayView(world.log, logContext(world, "u-amir"), {
      circleId: world.circleId,
      at: NOW,
    })
    expect(view.ok && view.value.rows.map((r) => r.nameAr)).toEqual(["عبد الله"])
  })

  it("وبعد التسجيل يظهر ما كُتب: حضورٌ وعلاماتٌ **واسمُ السورة مشتقٌّ من الكتالوج**", () => {
    const world = seedWorld()
    const ctx = logContext(world, "u-amir")
    recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        {
          enrollmentId: world.studentA,
          attendance: "present",
          memorization: { mode: "surah", surahId: "001", fromAyah: 1, toAyah: 7 },
          memorizationGrade: 9,
        },
      ],
    })
    const view = circleDayView(world.log, ctx, { circleId: world.circleId, at: NOW })
    expect(view.ok).toBe(true)
    if (!view.ok) return
    expect(view.value.recorded).toBe(true)
    const row = view.value.rows.find((r) => r.enrollmentId === world.studentA)
    expect(row?.memorizationAr).toBe("الفاتحة")
    expect(row?.memorizationGrade).toBe(9)
    // **الحدُّ يصل الشاشةَ من اللقطة** لا رقماً في الواجهة (ع-٩).
    expect(view.value.gradeMax).toBe(10)
  })

  it("ووضعُ الصفحات يُعرض باسم المصحف المرجعيّ — لا نصَّ حرٍّ يُصنَع في الكود", () => {
    const world = seedWorld()
    const ctx = logContext(world, "u-amir")
    recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        {
          enrollmentId: world.studentA,
          attendance: "present",
          review: { mode: "pages", mushafId: "hafs", fromPage: 1, toPage: 3 },
        },
      ],
    })
    const view = circleDayView(world.log, ctx, { circleId: world.circleId, at: NOW })
    const row = view.ok ? view.value.rows.find((r) => r.enrollmentId === world.studentA) : null
    expect(row?.reviewAr).toBe("مصحف المدينة")
  })

  it("وحلقةٌ مجهولةٌ ⇒ رفضٌ مصنَّفٌ لا كشفٌ فارغ (ق-١١٢)", () => {
    const world = seedWorld()
    const view = circleDayView(world.log, logContext(world, "u-amir"), {
      circleId: "لا-حلقة",
      at: NOW,
    })
    expect(!view.ok && view.error.code).toBe("UNKNOWN_CIRCLE")
  })
})

describe("**سجلُّ الطالب التراكميّ اشتقاقٌ لا عدّاد** (ع-٢٩)", () => {
  function recorded() {
    const world = seedWorld()
    const ctx = logContext(world, "u-amir")
    recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: new Date("2026-07-20T09:00:00.000Z"),
      rows: [{ enrollmentId: world.studentA, attendance: "present", memorizationGrade: 8 }],
    })
    recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: new Date("2026-07-21T09:00:00.000Z"),
      rows: [{ enrollmentId: world.studentA, attendance: "absent" }],
    })
    recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [{ enrollmentId: world.studentA, attendance: "present", tajweedGrade: 10 }],
    })
    return { world, ctx }
  }

  it("الحضورُ والمتوسّطُ **يُحسبان الآن** من الجلسات — ثلاثُ جلساتٍ وحضوران ⇒ ٦٦٫٧٪", () => {
    const { world, ctx } = recorded()
    const view = studentRecordView(world.log, ctx, {
      circleId: world.circleId,
      enrollmentId: world.studentA,
    })
    expect(view.ok).toBe(true)
    if (!view.ok) return
    expect(view.value.sessions).toBe(3)
    expect(view.value.present).toBe(2)
    expect(view.value.absent).toBe(1)
    expect(Math.round(view.value.attendancePct)).toBe(67)
    expect(view.value.averageGrade).toBe(9)
    expect(view.value.days.map((d) => d.dayKey)).toEqual([
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
    ])
  })

  it("**وجلسةٌ جديدةٌ تغيّر الرقمَ فوراً** — لا عدّادَ يُحدَّث فيُنسى", () => {
    const { world, ctx } = recorded()
    const before = studentRecordView(world.log, ctx, {
      circleId: world.circleId,
      enrollmentId: world.studentA,
    })
    recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: new Date("2026-07-19T09:00:00.000Z"),
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    const after = studentRecordView(world.log, ctx, {
      circleId: world.circleId,
      enrollmentId: world.studentA,
    })
    expect(before.ok && before.value.sessions).toBe(3)
    expect(after.ok && after.value.sessions).toBe(4)
  })

  it("وطالبٌ بلا جلسةٍ واحدةٍ ⇒ أصفارٌ ومتوسّطٌ غائب (`null`) لا صفرٌ كاذب", () => {
    const world = seedWorld()
    const view = studentRecordView(world.log, logContext(world, "u-amir"), {
      circleId: world.circleId,
      enrollmentId: world.studentB,
    })
    expect(view.ok).toBe(true)
    if (!view.ok) return
    expect(view.value.sessions).toBe(0)
    expect(view.value.attendancePct).toBe(0)
    expect(view.value.averageGrade).toBeNull()
  })

  it("وتسجيلٌ مجهولٌ أو من حلقةٍ أخرى ⇒ مرفوض", () => {
    const world = seedWorld()
    const ctx = logContext(world, "u-amir")
    const unknown = studentRecordView(world.log, ctx, {
      circleId: world.circleId,
      enrollmentId: "لا-تسجيل",
    })
    expect(!unknown.ok && unknown.error.code).toBe("ENROLLMENT_NOT_IN_CIRCLE")
    const foreign = studentRecordView(world.log, ctx, {
      circleId: world.otherCircleId,
      enrollmentId: world.studentA,
    })
    expect(!foreign.ok && foreign.error.code).toBe("ENROLLMENT_NOT_IN_CIRCLE")
  })

  it("وحلقةٌ مجهولةٌ ⇒ مرفوضة", () => {
    const world = seedWorld()
    const view = studentRecordView(world.log, logContext(world, "u-amir"), {
      circleId: "لا-حلقة",
      enrollmentId: world.studentA,
    })
    expect(!view.ok && view.error.code).toBe("UNKNOWN_CIRCLE")
  })

  it("**وسجلُّ الطالب لا يحمل رقمَ زميلِه**: جلسةٌ فيها طالبان ⇒ سجلُّ كلٍّ سجلُّه", () => {
    const world = seedWorld()
    const ctx = logContext(world, "u-amir")
    recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        { enrollmentId: world.studentA, attendance: "present", memorizationGrade: 10 },
        { enrollmentId: world.studentB, attendance: "absent" },
      ],
    })
    const a = studentRecordView(world.log, ctx, {
      circleId: world.circleId,
      enrollmentId: world.studentA,
    })
    const b = studentRecordView(world.log, ctx, {
      circleId: world.circleId,
      enrollmentId: world.studentB,
    })
    expect(a.ok && a.value.present).toBe(1)
    expect(b.ok && b.value.present).toBe(0)
    expect(a.ok && JSON.stringify(a.value)).not.toContain("معاذ")
  })
})
