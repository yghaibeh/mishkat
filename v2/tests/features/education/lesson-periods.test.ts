/**
 * **CR-٠٢٠ عند صاحب القواعد** — ما يعنيه اتّساعُ مفتاح الجلسة لوحدة التعليم (ق-٨٥/٨٦/٩٢).
 *
 * **والحدُّ بين الوحدتين يُقاس هنا**: الفترةُ **قائمةُ صاحب الكيان** — تمرّ من هذه الوحدة
 * **بلا تفسير**، ويعود رفضُها **مترجَماً بمفرداتنا** لا مبتلَعاً ولا مرمياً (dayLogPort §١١).
 *
 * وثلاثةُ أرقامٍ تفترق هنا عمداً، وهو لبُّ «تُجمع ولا تُضاعَف»:
 *  - **التقدّمُ (ق-٩٢) لا يتضاعف**: درسا فترتين على **المجلس نفسِه** ⇒ **خليّةٌ واحدة**.
 *  - **الحضورُ (ق-٩١/سجلّ الطالب) يُجمع باليوم** — مُقاسٌ في `circleLog/session-periods`.
 *  - **وساعاتُ المعلّم (ق-٨٦) تُجمع ولا تُطوى**: مجلسان في فترتين **تدريسان واقعان**،
 *    وطيُّهما هنا **بخسٌ لحقٍّ** لا حمايةٌ من غش. **والفرقُ ليس تناقضاً بل اختلافُ مقيسٍ**:
 *    الحضورُ صفةُ يومٍ، والأجرُ صفةُ **عملٍ وقع**.
 */

import { describe, it, expect } from "vitest"
import { recordLesson } from "../../../src/features/education/services/lessons.js"
import { curriculumProgress } from "../../../src/features/education/services/progress.js"
import { approvedTeachingLoad } from "../../../src/features/education/services/teacherHours.js"
import { settingsWith } from "./_seed.js"
import {
  CURRICULUM_ID,
  educationContext,
  HELD_AT,
  MAIN_TENANT_ID,
  NOW,
  SESSION_A,
  SESSION_B,
  seedWorld,
  type EduWorld,
} from "./_seed.js"

/** إعلانُ فترات الشبكة — **صفوفٌ في موطن الكيان** (ق-٨٩)، لا قائمةٌ في هذه الوحدة. */
function declarePeriods(world: EduWorld): void {
  world.log.savePeriod({ tenantId: MAIN_TENANT_ID, id: "morning", ar: "صباح", ordinal: 1 })
  world.log.savePeriod({ tenantId: MAIN_TENANT_ID, id: "evening", ar: "مساء", ordinal: 2 })
}

function lesson(
  world: EduWorld,
  ctx: ReturnType<typeof educationContext>,
  input: { readonly sessionId: string; readonly periodId?: string; readonly present?: readonly string[] },
) {
  return recordLesson(world.education, ctx, {
    circleId: world.circleId,
    sessionId: input.sessionId,
    heldAt: HELD_AT,
    durationMinutes: 60,
    ...(input.periodId === undefined ? {} : { periodId: input.periodId }),
    presentEnrollmentIds: input.present ?? world.enrollmentIds,
  })
}

describe("CR-٠٢٠/تعليم — **درسان في يومٍ واحدٍ بفترتين**", () => {
  it("درسا صباحٍ ومساءٍ ⇒ **درسان بيومٍ واحد**، وفترةُ كلٍّ ظاهرةٌ في إسقاطه", () => {
    const world = seedWorld()
    declarePeriods(world)
    const ctx = educationContext(world)

    const morning = lesson(world, ctx, { sessionId: SESSION_A, periodId: "morning" })
    const evening = lesson(world, ctx, { sessionId: SESSION_B, periodId: "evening" })
    expect(morning.ok && evening.ok).toBe(true)
    if (!morning.ok || !evening.ok) return

    expect(morning.value.dayKey).toBe(evening.value.dayKey)
    expect([morning.value.periodId, evening.value.periodId].sort()).toEqual(["evening", "morning"])
    expect(morning.value.id).not.toBe(evening.value.id)
    // **صفّان من كيانٍ واحدٍ في موطنٍ واحد** — لا مستودعَ درسٍ ثانٍ هنا (CR-016).
    expect(world.log.sessions()).toHaveLength(2)
  })

  it("**والفترةُ قائمةُ صاحب الكيان**: مجهولتُها تعود **مترجَمةً** لا مبتلَعةً ولا مرميّة", () => {
    const world = seedWorld()
    declarePeriods(world)
    const ctx = educationContext(world)
    const strange = lesson(world, ctx, { sessionId: SESSION_A, periodId: "قبل الفجر" })
    expect(!strange.ok && strange.error.code).toBe("UNKNOWN_PERIOD")

    const blind = lesson(world, ctx, { sessionId: SESSION_A })
    expect(!blind.ok && blind.error.code).toBe("PERIOD_REQUIRED")
    expect(world.log.sessions()).toHaveLength(0)
  })

  it("**وشبكةٌ لم تُقسّم يومَها تعمل كما كانت**: درسٌ بلا فترةٍ يُقبل (التركيبُ الأدنى)", () => {
    const world = seedWorld()
    const ctx = educationContext(world)
    const written = lesson(world, ctx, { sessionId: SESSION_A })
    expect(written.ok).toBe(true)
    expect(written.ok && written.value.periodId).toBe("day")
  })
})

describe("CR-٠٢٠/تعليم — **التقدّمُ يُجمع ولا يُضاعَف** (ق-٩٢)", () => {
  it("درسا فترتين على **المجلس نفسِه** معتمَدان ⇒ **خليّةٌ واحدةٌ مكتملة** لا خليّتان", () => {
    const world = seedWorld()
    declarePeriods(world)
    const writer = educationContext(world)
    const morning = lesson(world, writer, { sessionId: SESSION_A, periodId: "morning" })
    const evening = lesson(world, writer, { sessionId: SESSION_A, periodId: "evening" })
    expect(morning.ok && evening.ok).toBe(true)
    if (!morning.ok || !evening.ok) return

    const ctx = educationContext(world, {
      approvedLessonIds: [morning.value.id, evening.value.id],
    })
    const matrix = curriculumProgress(world.education, ctx, world.circleId)
    expect(matrix.ok).toBe(true)
    if (!matrix.ok) return
    // ثلاثةُ ملتحقين × مجلسان = ستُّ خلايا؛ والمُكمَل **ثلاثٌ** (مجلسٌ واحدٌ للثلاثة) —
    // **لا ستٌّ**: الفترتان درسان على **مجلسٍ واحد**، والخليّةُ خليّةُ مجلسٍ لا خليّةُ درس.
    expect(matrix.value.totalCells).toBe(6)
    expect(matrix.value.completedCells).toBe(3)
    const cells = matrix.value.rows[0]!.cells.filter((c) => c.completed)
    expect(cells.map((c) => c.sessionId)).toEqual([SESSION_A])
  })

  it("**وفترتان على مجلسين ⇒ تقدّمان** — فالجمعُ لا يبتلع عملاً واقعاً", () => {
    const world = seedWorld()
    declarePeriods(world)
    const writer = educationContext(world)
    const a = lesson(world, writer, { sessionId: SESSION_A, periodId: "morning" })
    const b = lesson(world, writer, { sessionId: SESSION_B, periodId: "evening" })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return

    const ctx = educationContext(world, { approvedLessonIds: [a.value.id, b.value.id] })
    const matrix = curriculumProgress(world.education, ctx, world.circleId)
    expect(matrix.ok && matrix.value.completedCells).toBe(6)
  })
})

describe("CR-٠٢٠/تعليم — **ساعاتُ المعلّم تُجمع ولا تُطوى** (ق-٨٦)", () => {
  it("درسان معتمَدان في فترتين ⇒ **درسان وساعتان** — والتوقيعُ لم يتغيّر بحرف", () => {
    const world = seedWorld()
    declarePeriods(world)
    const writer = educationContext(world)
    const morning = lesson(world, writer, { sessionId: SESSION_A, periodId: "morning" })
    const evening = lesson(world, writer, { sessionId: SESSION_B, periodId: "evening" })
    expect(morning.ok && evening.ok).toBe(true)
    if (!morning.ok || !evening.ok) return

    const ctx = educationContext(world, {
      approvedLessonIds: [morning.value.id, evening.value.id],
      settings: settingsWith([
        {
          settingId: "edu.paid_hours.curricula",
          scopePath: "/",
          value: ["baseera"],
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
          id: "ov-paid",
        },
      ]),
    })

    const load = approvedTeachingLoad(world.education, ctx, {
      teacherPersonId: "u-teacher",
      from: new Date("2026-07-01T00:00:00.000Z"),
      to: NOW,
    })
    expect(load.ok).toBe(true)
    if (!load.ok) return
    // **مجلسان في فترتين تدريسان واقعان** — وطيُّهما بخسٌ لحقٍّ لا حمايةٌ من غش (ق-٨٦).
    expect(load.value.totalLessonCount).toBe(2)
    expect(load.value.totalMinutes).toBe(120)
    expect(load.value.lines[0]?.curriculumId).toBe(CURRICULUM_ID)
  })

  it("**والاعتمادُ شرطٌ غيرُ مشروطٍ ولو تعدّدت الفترات**: غيرُ المعتمَد صفرٌ", () => {
    const world = seedWorld()
    declarePeriods(world)
    const writer = educationContext(world)
    expect(lesson(world, writer, { sessionId: SESSION_A, periodId: "morning" }).ok).toBe(true)
    expect(lesson(world, writer, { sessionId: SESSION_B, periodId: "evening" }).ok).toBe(true)

    const load = approvedTeachingLoad(world.education, educationContext(world), {
      teacherPersonId: "u-teacher",
      from: new Date("2026-07-01T00:00:00.000Z"),
      to: NOW,
    })
    expect(load.ok && load.value.totalLessonCount).toBe(0)
  })
})
