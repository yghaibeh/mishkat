/**
 * **الاختباران الإلزاميّان الرابع والسادس** (T18):
 *  - **ب-٣٥أ/ق-٨٧**: المعلّمُ **يقرأ** ملاحظةَ المشرف ولا **يحرّرها** — والقراءةُ بمفتاح.
 *  - **ق-٩١**: التقييمُ الدوريّ **بالنسب من الإعدادات**، و**الحلقةُ الخاملةُ صفر**.
 *
 * (شقُّ «المعلّمُ لا يحرّر» يُفرَض في **الخادم** بالقدرة — برهانُه في `endpoints.test.ts`؛
 *  وهنا يُثبَت شقُّ **القراءة** وسياستُها.)
 */
import { describe, it, expect } from "vitest"
import { notesForTeacher, notesOf, recordNote } from "../../../src/features/tahfeezLog/services/notes.js"
import { circleRanking } from "../../../src/features/tahfeezLog/services/ranking.js"
import { recordSession } from "../../../src/features/tahfeezLog/services/sessions.js"
import { globalOverride, KHALID_PATH, logContext, NOW, SQ2_PATH, seedWorld } from "./_seed.js"

describe("ق-٨٧ + ب-٣٥أ — ملاحظاتُ الإشراف: يكتبها المشرف، ويقرؤها المعلّم", () => {
  it("المشرفُ يكتب ملاحظةً فتُقرأ باسمه وتاريخها — **سجلٌّ يُلحق لا يُستبدل**", () => {
    const world = seedWorld()
    const ctx = logContext(world, "u-square")
    const first = recordNote(world.log, ctx, {
      circleId: world.circleId,
      bodyAr: "يُنصَح بزيادة وقت المراجعة",
    })
    const second = recordNote(world.log, ctx, {
      circleId: world.circleId,
      bodyAr: "تحسّنٌ ملحوظٌ في التجويد",
    })
    expect(first.ok && second.ok).toBe(true)
    const rows = notesOf(world.log, world.circleId)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.authorPersonId).toBe("u-square")
    expect(rows[0]?.writtenAt).toEqual(NOW)
  })

  it("**والمعلّمُ يقرؤها** (ب-٣٥أ — قرارُ المالك: تُعرض للشفافية)", () => {
    const world = seedWorld()
    recordNote(world.log, logContext(world, "u-square"), {
      circleId: world.circleId,
      bodyAr: "ملاحظةٌ إشرافية",
    })
    const seen = notesForTeacher(world.log, logContext(world, "u-teacher-mosque"), world.circleId)
    expect(seen).toHaveLength(1)
    expect(seen[0]?.bodyAr).toBe("ملاحظةٌ إشرافية")
  })

  it("**وإطفاءُ `edu.supervisor_notes.visible_to_teacher` يُخفي القراءة** — سياسةُ عرضٍ لا حارس", () => {
    const world = seedWorld()
    recordNote(world.log, logContext(world, "u-square"), {
      circleId: world.circleId,
      bodyAr: "ملاحظةٌ إشرافية",
    })
    const hidden = notesForTeacher(
      world.log,
      logContext(world, "u-teacher-mosque", {
        overrides: [globalOverride("edu.supervisor_notes.visible_to_teacher", false)],
      }),
      world.circleId,
    )
    expect(hidden).toEqual([])
    // …ولا يمنح إطفاؤه المعلّمَ تحريراً بحال: الكتابةُ قدرةٌ لا مفتاح (endpoints.test.ts).
    expect(notesOf(world.log, world.circleId)).toHaveLength(1)
  })

  it("وملاحظةٌ فارغةٌ مرفوضة، وحلقةٌ مجهولةٌ مرفوضة", () => {
    const world = seedWorld()
    const ctx = logContext(world, "u-square")
    const empty = recordNote(world.log, ctx, { circleId: world.circleId, bodyAr: "   " })
    expect(!empty.ok && empty.error.code).toBe("EMPTY_NOTE")
    const unknown = recordNote(world.log, ctx, { circleId: "لا-حلقة", bodyAr: "شيء" })
    expect(!unknown.ok && unknown.error.code).toBe("UNKNOWN_CIRCLE")
  })

  it("وملاحظاتُ حلقةٍ لا تظهر في حلقةٍ أخرى — الملاحظةُ ابنةُ حلقتها (IA ك-٥)", () => {
    const world = seedWorld()
    recordNote(world.log, logContext(world, "u-square"), {
      circleId: world.circleId,
      bodyAr: "ملاحظة",
    })
    expect(notesOf(world.log, world.otherCircleId)).toEqual([])
  })
})

describe("**ق-٩١ — التقييمُ الدوريّ: ٦٠٪ حضورٌ + ٤٠٪ علامات، والخاملةُ صفر**", () => {
  function withSessions() {
    const world = seedWorld()
    const ctx = logContext(world, "u-amir")
    // حضورٌ تامٌّ وعلاماتٌ تامّة ⇒ الدرجةُ القصوى.
    recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        { enrollmentId: world.studentA, attendance: "present", memorizationGrade: 10 },
        { enrollmentId: world.studentB, attendance: "present", memorizationGrade: 10 },
      ],
    })
    return { world, ctx }
  }

  it("حلقةٌ بحضورٍ تامٍّ وعلاماتٍ تامّة ⇒ الدرجةُ مجموعُ الوزنين (١٠٠)", () => {
    const { world, ctx } = withSessions()
    const view = circleRanking(world.log, ctx, { unitPath: KHALID_PATH })
    const row = view.rows.find((r) => r.circleId === world.circleId)
    expect(row?.attendancePct).toBe(100)
    expect(row?.gradePct).toBe(100)
    expect(row?.score).toBe(100)
  })

  it("**والنسبُ من الإعدادات**: تُقلَب الأوزانُ فتتغيّر الدرجةُ بلا سطر كود (قب-٦/G14)", () => {
    const world = seedWorld()
    const ctx = logContext(world, "u-amir")
    // حضورٌ كاملٌ بلا أيّ علامة ⇒ الدرجةُ = وزنُ الحضور وحده.
    recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        { enrollmentId: world.studentA, attendance: "present" },
        { enrollmentId: world.studentB, attendance: "present" },
      ],
    })
    const byDefault = circleRanking(world.log, ctx, { unitPath: KHALID_PATH })
    expect(byDefault.rows.find((r) => r.circleId === world.circleId)?.score).toBe(60)

    const flipped = circleRanking(
      world.log,
      logContext(world, "u-amir", {
        overrides: [
          globalOverride("edu.circle_ranking.attendance_weight", 40),
          globalOverride("edu.circle_ranking.grade_weight", 60),
        ],
      }),
      { unitPath: KHALID_PATH },
    )
    expect(flipped.rows.find((r) => r.circleId === world.circleId)?.score).toBe(40)
  })

  it("**والحلقةُ الخاملةُ صفرٌ** ووسمُها منطوق — بلا قسمةٍ على صفر (ق-١١٢)", () => {
    const { world, ctx } = withSessions()
    const view = circleRanking(world.log, ctx, { unitPath: SQ2_PATH })
    const idle = view.rows.find((r) => r.circleId === world.otherCircleId)
    expect(idle?.inactive).toBe(true)
    expect(idle?.score).toBe(0)
    expect(idle?.attendancePct).toBe(0)
  })

  it("**وما خرج عن النافذة لا يُحتسب** — والنافذةُ إعدادٌ حيّ", () => {
    const world = seedWorld()
    recordSession(world.log, logContext(world, "u-amir"), {
      circleId: world.circleId,
      at: new Date("2026-05-01T09:00:00.000Z"),
      rows: [{ enrollmentId: world.studentA, attendance: "present", memorizationGrade: 10 }],
    })
    // خارج النافذة ⇒ الحلقةُ خاملةٌ بدرجةٍ صفر ⇒ والترتيبُ كلُّه أصفارٌ فيُخفى (ق-٩١).
    const narrow = circleRanking(world.log, logContext(world, "u-amir"), { unitPath: KHALID_PATH })
    expect(narrow.hidden).toBe(true)
    const narrowShown = circleRanking(
      world.log,
      logContext(world, "u-amir", {
        overrides: [globalOverride("edu.circle_ranking.hide_all_zero", false)],
      }),
      { unitPath: KHALID_PATH },
    )
    expect(narrowShown.rows.find((r) => r.circleId === world.circleId)?.inactive).toBe(true)

    const wide = circleRanking(
      world.log,
      logContext(world, "u-amir", {
        overrides: [globalOverride("edu.circle_ranking.window_days", 365)],
      }),
      { unitPath: KHALID_PATH },
    )
    expect(wide.rows.find((r) => r.circleId === world.circleId)?.inactive).toBe(false)
  })

  it("**وترتيبٌ كلُّه أصفارٌ لا يُعرض** («على ذلك يُكرَم» — لا تشهير)، ويُعرض إن أُطفئ الإعداد", () => {
    const world = seedWorld()
    const ctx = logContext(world, "u-amir")
    const hidden = circleRanking(world.log, ctx, { unitPath: SQ2_PATH })
    expect(hidden.hidden).toBe(true)
    expect(hidden.rows).toEqual([])

    const shown = circleRanking(
      world.log,
      logContext(world, "u-amir", {
        overrides: [globalOverride("edu.circle_ranking.hide_all_zero", false)],
      }),
      { unitPath: SQ2_PATH },
    )
    expect(shown.hidden).toBe(false)
    expect(shown.rows.length).toBeGreaterThan(0)
  })

  it("والترتيبُ حتميّ: بالدرجة نازلاً ثم بالمعرّف — لا يختلف بين تشغيلين", () => {
    const { world, ctx } = withSessions()
    const view = circleRanking(world.log, ctx, { unitPath: SQ2_PATH })
    expect(view.rows.map((r) => r.circleId)).toEqual([world.circleId, world.otherCircleId])
    const again = circleRanking(world.log, ctx, { unitPath: SQ2_PATH })
    expect(again.rows.map((r) => r.circleId)).toEqual(view.rows.map((r) => r.circleId))
  })

  it("**والغيابُ يخفض الحضورَ لا العلامة**: نصفُ الحضور ⇒ نصفُ وزن الحضور", () => {
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
    const row = circleRanking(world.log, ctx, { unitPath: KHALID_PATH }).rows.find(
      (r) => r.circleId === world.circleId,
    )
    expect(row?.attendancePct).toBe(50)
    expect(row?.gradePct).toBe(100)
    expect(row?.score).toBe(70)
  })

  it("ونطاقٌ بلا حلقةٍ واحدةٍ ⇒ قائمةٌ فارغةٌ بلا إخفاءٍ مصطنع", () => {
    const { world, ctx } = withSessions()
    const view = circleRanking(world.log, ctx, { unitPath: "/women/" })
    expect(view.rows).toEqual([])
    expect(view.hidden).toBe(false)
  })
})
