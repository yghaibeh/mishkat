/**
 * **CR-٠٢٠ — جلستان في اليوم: المفتاحُ يتّسع ولا ينشطر الكيان** (قرارُ المالك ٢٠٢٦-٠٧-٢٢ · قب-٤٥).
 *
 * ستةُ ثوابتٍ تُقاس هنا، وكلُّ واحدٍ منها **يقدر أن يحمرّ** (الوصفة فخّ ٦-ب):
 *  ١. الفترةُ **قائمةٌ محصورة** (ق-٨٩) — لا نصٌّ حرٌّ ولا رقمٌ يُخترَع.
 *  ٢. **التركيبُ الأدنى**: شبكةٌ لم تُقسّم يومَها ⇒ جلسةٌ واحدةٌ بفترة «اليوم كلِّه» — **حالُ ما
 *     قبل CR-020 بحرفه**، فلا تسليمَ يكسر شبكةً قائمة.
 *  ٣. **فترتان ⇒ صفّان** (وهو ما أذن به المالك)، **ونفسُ الفترة ⇒ صفٌّ واحد** (وهو الحارسُ
 *     الذي بقي: لا يُفتح باب الازدواج الذي منعه المفتاح أصلاً).
 *  ٤. **الكيانُ واحدٌ ومميِّزُه شكلُه** (CR-016): اتّساعُ المفتاح لم يُنشئ نوعاً ثانياً ولا مستودعاً.
 *  ٥. **لا اختيارَ صامتاً**: شبكةٌ أعلنت فتراتٍ وجاءها تسجيلٌ بلا فترة ⇒ **رفضٌ مُشخِّص**.
 *  ٦. **الحضورُ والتقدّمُ يُجمعان عبر فترات اليوم ولا يُضاعفان** — وهو ثمنُ الفتح لو أُهمل.
 */

import { describe, it, expect } from "vitest"
import { CircleLogStore } from "../../../src/features/circleLog/data/store.js"
import { recordSession } from "../../../src/features/circleLog/services/sessions.js"
import { circleDayView, studentRecordView } from "../../../src/features/circleLog/services/derive.js"
import { circleRanking } from "../../../src/features/circleLog/services/ranking.js"
import {
  ATTENDANCE_STRENGTH,
  declaredPeriods,
  periodRef,
  strongerMark,
  WHOLE_DAY_PERIOD_ID,
} from "../../../src/features/circleLog/services/periods.js"
import { ATTENDANCE_MARKS, type AttendanceMark } from "../../../src/features/circleLog/types.js"
import {
  declarePeriods,
  globalOverride,
  KHALID_PATH,
  logContext,
  MAIN_TENANT_ID,
  NOW,
  SEEDED_PERIODS,
  seedWorld,
  type World,
} from "./_seed.js"

const DAY = new Date("2026-07-22T09:00:00.000Z")

function morningAndEvening(world: World, marks: readonly [AttendanceMark, AttendanceMark]) {
  const ctx = logContext(world, "u-amir")
  const morning = recordSession(world.log, ctx, {
    circleId: world.circleId,
    at: DAY,
    periodId: "morning",
    rows: [{ enrollmentId: world.studentA, attendance: marks[0] }],
  })
  const evening = recordSession(world.log, ctx, {
    circleId: world.circleId,
    at: DAY,
    periodId: "evening",
    rows: [{ enrollmentId: world.studentA, attendance: marks[1] }],
  })
  return { ctx, morning, evening }
}

// ── ١: القائمةُ المحصورة والتركيبُ الأدنى ────────────────────────────────────

describe("CR-٠٢٠/١ — **الفترةُ قائمةٌ محصورةٌ من صفوف** (ق-٨٩ · نظيرُ ب-٢٨)", () => {
  it("شبكةٌ لم تُعلن فتراتٍ ⇒ فترتُها الوحيدة **اليومُ كلُّه**، وجلسةُ يومها واحدة", () => {
    const world = seedWorld()
    expect(declaredPeriods(world.log).map((p) => p.id)).toEqual([WHOLE_DAY_PERIOD_ID])

    const written = recordSession(world.log, logContext(world, "u-amir"), {
      circleId: world.circleId,
      at: DAY,
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(written.ok).toBe(true)
    // **حالُ ما قبل CR-020 بحرفه**: صفٌّ واحدٌ لليوم، وفترتُه معلنةٌ لا فارغة.
    expect(written.ok && written.value.periodId).toBe(WHOLE_DAY_PERIOD_ID)
    expect(world.log.sessions()).toHaveLength(1)
  })

  it("**وفترةٌ خارج القائمة تُردّ** — لا كتابةَ حرّةً في المفتاح الطبيعيّ", () => {
    const world = seedWorld()
    const written = recordSession(world.log, logContext(world, "u-amir"), {
      circleId: world.circleId,
      at: DAY,
      periodId: "بعد المغرب",
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(!written.ok && written.error.code).toBe("UNKNOWN_PERIOD")
    expect(world.log.sessions()).toHaveLength(0)
  })

  it("**والفتراتُ تُعلَن صفّاً فتعمل بلا سطرِ كود** — «صباح/مساء» صفّان لا اسمان في المصدر", () => {
    const world = seedWorld()
    declarePeriods(world.log)
    // **تُشتقّ من الصفوف ولا تُسرد** (CR-011): القائمةُ هي ما أُعلن، مرتَّبةً بترتيبه.
    expect(declaredPeriods(world.log).map((p) => p.id)).toEqual(SEEDED_PERIODS.map((p) => p.id))
    expect(periodRef(world.log, "morning")?.ar).toBe("صباح")
    // ثالثةٌ **تُضاف صفّاً**: لا تعديلَ في مصدرٍ ولا في نوع.
    world.log.savePeriod({ tenantId: MAIN_TENANT_ID, id: "night", ar: "ليل", ordinal: 3 })
    expect(declaredPeriods(world.log).map((p) => p.id)).toEqual(["morning", "evening", "night"])
  })

  it("**وإعلانُ الفترات يُقاعِد «اليومَ كلَّه»** — فلا يبقى بابٌ ثالثٌ للازدواج بجانبها", () => {
    const world = seedWorld()
    declarePeriods(world.log)
    const written = recordSession(world.log, logContext(world, "u-amir"), {
      circleId: world.circleId,
      at: DAY,
      periodId: WHOLE_DAY_PERIOD_ID,
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(!written.ok && written.error.code).toBe("UNKNOWN_PERIOD")
  })
})

// ── ٢: المفتاحُ يتّسع ولا ينشطر الكيان ───────────────────────────────────────

describe("CR-٠٢٠/٢ — **يتّسع مفتاحُها ولا ينشطر كيانُها** (CR-016 محفوظ)", () => {
  it("**فترتان في اليوم ⇒ صفّان** — وهو بعينه ما أذن به المالك (صباح/مساء)", () => {
    const world = seedWorld()
    declarePeriods(world.log)
    const { morning, evening } = morningAndEvening(world, ["present", "present"])
    expect(morning.ok && evening.ok).toBe(true)

    const rows = world.log.sessions()
    expect(rows).toHaveLength(2)
    expect(rows.map((s) => s.periodId).sort()).toEqual(["evening", "morning"])
    // **يومٌ واحدٌ وحلقةٌ واحدة** — الفترةُ وحدَها هي ما فرّق، ومعرّفاهما من عدّادٍ واحد.
    expect(new Set(rows.map((s) => s.dayKey)).size).toBe(1)
    expect(new Set(rows.map((s) => s.circleId)).size).toBe(1)
    expect(new Set(rows.map((s) => s.id)).size).toBe(2)
  })

  it("**وجلستان بنفس الفترة ⇒ صفٌّ واحد** — الحارسُ الذي بقي (ق-٩٠ upsert)", () => {
    const world = seedWorld()
    declarePeriods(world.log)
    const ctx = logContext(world, "u-amir")
    const first = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: DAY,
      periodId: "morning",
      rows: [{ enrollmentId: world.studentA, attendance: "absent" }],
    })
    const second = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: DAY,
      periodId: "morning",
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(first.ok && second.ok).toBe(true)
    expect(world.log.sessions()).toHaveLength(1)
    // **استبدالٌ لا إضافة**: المعرّفُ نفسُه والأسطرُ الأحدث.
    expect(first.ok && second.ok && first.value.id).toBe(second.ok ? second.value.id : "")
    expect(world.log.getSession(world.circleId, "2026-07-22", "morning")?.rows[0]?.attendance).toBe(
      "present",
    )
  })

  it("**والكيانُ واحد**: صفّا الفترتين من نوعٍ واحدٍ ومستودعٍ واحدٍ وعدّادٍ واحد", () => {
    const world = seedWorld()
    declarePeriods(world.log)
    morningAndEvening(world, ["present", "left"])
    const rows = world.log.sessions()
    // **لا نوعَ «جلسةِ مساء»** — نفسُ الحقول ونفسُ الشكل ونفسُ المستودع.
    expect(rows.every((s) => s.shape.kind === "recitation")).toBe(true)
    expect(rows.every((s) => Object.keys(s).sort().join() === Object.keys(rows[0]!).sort().join())).toBe(true)
  })

  it("**وقفلُ فترةٍ لا يقفل أختَها** (ق-٨): المعتمَدُ صباحاً لا يمنع تسجيلَ المساء", () => {
    const world = seedWorld()
    declarePeriods(world.log)
    const open = logContext(world, "u-amir")
    const morning = recordSession(world.log, open, {
      circleId: world.circleId,
      at: DAY,
      periodId: "morning",
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(morning.ok).toBe(true)
    const lockedId = morning.ok ? morning.value.id : ""
    const locked = logContext(world, "u-amir", { isSessionLocked: (id) => id === lockedId })

    const again = recordSession(world.log, locked, {
      circleId: world.circleId,
      at: DAY,
      periodId: "morning",
      rows: [{ enrollmentId: world.studentA, attendance: "absent" }],
    })
    expect(!again.ok && again.error.code).toBe("SESSION_LOCKED")

    const evening = recordSession(world.log, locked, {
      circleId: world.circleId,
      at: DAY,
      periodId: "evening",
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(evening.ok).toBe(true)
  })
})

// ── ٣: لا اختيارَ صامتاً ─────────────────────────────────────────────────────

describe("CR-٠٢٠/٣ — **لا تخضرّ عند الغموض** (قاعدةُ CR-011 على مستهلِك)", () => {
  it("شبكةٌ أعلنت فتراتٍ وجاءها تسجيلٌ بلا فترة ⇒ `PERIOD_REQUIRED` لا أولى الفترات", () => {
    const world = seedWorld()
    declarePeriods(world.log)
    const written = recordSession(world.log, logContext(world, "u-amir"), {
      circleId: world.circleId,
      at: DAY,
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(!written.ok && written.error.code).toBe("PERIOD_REQUIRED")
    // **والرفضُ يُسمّي القائمة** فيُصلَح المُرسِل ولا يُخمَّن.
    expect(!written.ok && written.error.detail).toBe("morning,evening")
    expect(world.log.sessions()).toHaveLength(0)
  })

  it("**والقراءةُ كالكتابة**: كشفُ يومٍ بلا فترةٍ في شبكةٍ قسّمت يومَها ⇒ رفضٌ لا خلطُ فترتين", () => {
    const world = seedWorld()
    declarePeriods(world.log)
    morningAndEvening(world, ["present", "absent"])
    const ctx = logContext(world, "u-amir")

    const blind = circleDayView(world.log, ctx, { circleId: world.circleId, at: DAY })
    expect(!blind.ok && blind.error.code).toBe("PERIOD_REQUIRED")

    const evening = circleDayView(world.log, ctx, {
      circleId: world.circleId,
      at: DAY,
      periodId: "evening",
    })
    expect(evening.ok && evening.value.periodId).toBe("evening")
    expect(evening.ok && evening.value.rows.find((r) => r.enrollmentId === world.studentA)?.attendance).toBe(
      "absent",
    )
  })
})

// ── ٤: الجمعُ عبر فترات اليوم — ولا مضاعفة ───────────────────────────────────

describe("CR-٠٢٠/٤ — **الحضورُ يُجمع عبر فترات اليوم ولا يُضاعَف**", () => {
  it("حضر صباحاً وغاب مساءً ⇒ **يومٌ واحدٌ حاضر** لا جلستان إحداهما غياب", () => {
    const world = seedWorld()
    declarePeriods(world.log)
    const { ctx } = morningAndEvening(world, ["present", "absent"])

    const view = studentRecordView(world.log, ctx, {
      circleId: world.circleId,
      enrollmentId: world.studentA,
    })
    expect(view.ok).toBe(true)
    if (!view.ok) return
    // **العدُّ باليوم**: يومٌ واحدٌ، حضورُه حضورٌ، ونسبتُه مئةٌ لا خمسون.
    expect(view.value.sessions).toBe(1)
    expect(view.value.present).toBe(1)
    expect(view.value.absent).toBe(0)
    expect(view.value.attendancePct).toBe(100)
    // **والتفصيلُ بالفترة يبقى**: سطرٌ لكلِّ فترةٍ سُجِّلت، فلا تُطمس المعلومة.
    expect(view.value.days.map((d) => d.periodId)).toEqual(["evening", "morning"])
  })

  it("**وحضورُ الفترتين لا يضاعف العدد**: يومان بأربع فترات ⇒ **يومان**", () => {
    const world = seedWorld()
    declarePeriods(world.log)
    const ctx = logContext(world, "u-amir")
    for (const at of [DAY, new Date("2026-07-21T09:00:00.000Z")]) {
      for (const periodId of ["morning", "evening"]) {
        recordSession(world.log, ctx, {
          circleId: world.circleId,
          at,
          periodId,
          rows: [{ enrollmentId: world.studentA, attendance: "present" }],
        })
      }
    }
    const view = studentRecordView(world.log, ctx, {
      circleId: world.circleId,
      enrollmentId: world.studentA,
    })
    expect(view.ok && view.value.sessions).toBe(2)
    expect(view.ok && view.value.days).toHaveLength(4)
  })

  it("**وتقييمُ ق-٩١ لا يتضاعف بالفترات**: حلقةُ فترتين تُقاس بأيامها لا بفتراتها", () => {
    const world = seedWorld()
    declarePeriods(world.log)
    const { ctx } = morningAndEvening(world, ["present", "absent"])
    const ranking = circleRanking(world.log, ctx, { unitPath: KHALID_PATH })
    const row = ranking.rows.find((r) => r.circleId === world.circleId)
    // الطالبُ حضر يومَه ⇒ **مئةٌ**؛ ولولا الجمعُ لصارت خمسين ولانحدر ترتيبُ الحلقة بلا ذنب.
    expect(row?.attendancePct).toBe(100)
    expect(row?.inactive).toBe(false)
  })

  it("**والأقوى حضوراً يغلب** — والترتيبُ يغطّي الرباعيَّ كلَّه بلا سردٍ ثانٍ (ق-٩٠)", () => {
    expect([...ATTENDANCE_STRENGTH].sort()).toEqual([...ATTENDANCE_MARKS].sort())
    expect(strongerMark("absent", "present")).toBe("present")
    expect(strongerMark("present", "absent")).toBe("present")
    expect(strongerMark("excused", "left")).toBe("left")
    expect(strongerMark("absent", "excused")).toBe("excused")
    // **حتميّةٌ لا تتبع ترتيبَ الفترات**: الجوابُ نفسُه من الطرفين.
    expect(strongerMark("left", "present")).toBe(strongerMark("present", "left"))
  })

  it("**وعلامةٌ خامسةٌ حالةٌ برمجية** لا «أضعفُ الحضور» صامتةً (المادة ٣/٤)", () => {
    expect(() => strongerMark("attended" as AttendanceMark, "absent")).toThrow(TypeError)
  })
})

// ── ٥: ما لم يتغيّر ──────────────────────────────────────────────────────────

describe("CR-٠٢٠/٥ — **ما لم يمسَّه الاتّساع**", () => {
  it("عزلُ الشبكة باقٍ: فترةُ شبكةٍ لا تُقرأ من أخرى ولو تطابق المعرّف", () => {
    const world = seedWorld()
    declarePeriods(world.log)
    morningAndEvening(world, ["present", "present"])
    const other = new CircleLogStore("t-second")
    expect(other.periods()).toHaveLength(0)
    expect(other.getSession(world.circleId, "2026-07-22", "morning")).toBe(null)
  })

  it("**ونافذةُ التأريخ تسبق الفترة**: غدٌ مرفوضٌ بسببه هو لا بسبب فترةٍ ناقصة", () => {
    const world = seedWorld()
    declarePeriods(world.log)
    const written = recordSession(world.log, logContext(world, "u-amir"), {
      circleId: world.circleId,
      at: new Date("2026-07-23T09:00:00.000Z"),
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    // ترتيبُ الحرّاس ملزمٌ: اليومُ ⟵ الفترةُ — فيُشخَّص الخرقُ الأولُ بسببه.
    expect(!written.ok && written.error.code).toBe("FUTURE_DATING_BLOCKED")
  })

  it("**والفترةُ لا تلتفّ على إعدادٍ**: تأريخُ الغد بإعدادٍ يسمح يقبل الفترتين معاً", () => {
    const world = seedWorld()
    declarePeriods(world.log)
    const ctx = logContext(world, "u-amir", {
      now: NOW,
      overrides: [globalOverride("records.allow_future_dating", true)],
    })
    const written = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: new Date("2026-07-23T09:00:00.000Z"),
      periodId: "evening",
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(written.ok && written.value.periodId).toBe("evening")
  })
})
