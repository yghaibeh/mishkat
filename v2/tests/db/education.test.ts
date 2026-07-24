/**
 * **استمرارُ منهاج «على بصيرة» على D1** — التسعةُ الإلزامية وحوافُّ التغطية الثلاثة.
 *
 * **والوجهُ الخاصُّ بهذه الوحدة** (الوصفة §٧): **تقرأ مستودعين** — فوحدةُ عملها ثلاثيةُ
 * المصادر، **والميزانيةُ تُقاس لكلِّ مصدرٍ على حدة** ولا تُجمع ذهنياً.
 */

import { describe, expect, it } from "vitest"
import {
  persistentEducationCatalog,
  persistentEducationEntries,
} from "../../src/db/repositories/educationRepository.js"
import { UnitOfWork } from "../../src/db/unitOfWork.js"
import { EducationStore } from "../../src/features/education/data/store.js"
import { CircleLogStore } from "../../src/features/circleLog/data/store.js"
import { recordLesson } from "../../src/features/education/services/lessons.js"
import { curriculumProgress, markProgress } from "../../src/features/education/services/progress.js"
import { approvedTeachingLoad } from "../../src/features/education/services/teacherHours.js"
import { circleDaysFrom } from "../../src/features/education/services/dayLogPort.js"
import { circleModelFrom } from "../../src/features/circleLog/services/circlesPort.js"
import { makeCirclePorts } from "../../src/features/education/services/bindings.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import type { CirclesStore } from "../../src/features/circles/data/store.js"
import type { EducationContext } from "../../src/features/education/services/context.js"
import {
  HELD_AT,
  MAIN,
  NOW,
  OTHER,
  SESSION_A,
  SESSION_B,
  circlePathOf,
  educationSession,
  freshDb,
  rowsOf,
  seedCircleModel,
  seedCircleWithStudents,
  seedEducationReferences,
  seedEducationSession,
} from "./_education.js"

const KHALID_PATH = "/men/homs/sq2/khalid/"
const SETTINGS = createSettingsResolver([])

function baseeraWorld(tenantId = MAIN, unitId = "khalid") {
  const circles = seedCircleModel(tenantId)
  const made = seedCircleWithStudents(circles, { unitId, typeId: "baseera" })
  return { circles, ...made, pathOf: circlePathOf(circles) }
}

/** سياقٌ حقيقيّ: منافذُ الحلقة موصولةٌ بالمصدر الواحد، والجلسةُ تُكتب **بكاتبها هو**. */
function ctxOf(
  circles: CirclesStore,
  education: EducationStore,
  log: CircleLogStore,
  approved: readonly string[] = [],
): EducationContext {
  const isLessonApproved = (id: string): boolean => approved.includes(id)
  return {
    now: NOW,
    actorPersonId: "u-amir",
    settings: SETTINGS,
    ...makeCirclePorts(circles),
    isLessonApproved,
    days: circleDaysFrom({
      logStore: log,
      education,
      circles: circleModelFrom(circles),
      settings: SETTINGS,
      isLessonApproved,
    })("u-amir", NOW),
  }
}

describe("ق-٩٢ بعد عبور القاعدة — **التقدّمُ مشتقٌّ والبصمةُ فوقه**", () => {
  it("**لا عمودَ تقدّمٍ في القاعدة** — والمصفوفةُ تُبنى لحظةَ السؤال", async () => {
    const driver = await freshDb()
    const w = baseeraWorld()
    await seedEducationSession(driver, MAIN, w.pathOf)
    await educationSession(driver, MAIN, w.pathOf, ({ education, log }) => {
      const done = recordLesson(education, ctxOf(w.circles, education, log), {
        circleId: w.circleId,
        sessionId: SESSION_A,
        heldAt: HELD_AT,
        durationMinutes: 60,
        presentEnrollmentIds: [w.studentA],
      })
      if (!done.ok) throw new Error(done.error.code)
    })
    for (const row of await rowsOf(driver, "education_sessions")) {
      for (const column of Object.keys(row as Record<string, unknown>)) {
        expect(`${column}:${/(count|_total|completed_|progress)/.test(column)}`).toBe(`${column}:false`)
      }
    }
    // **والدرسُ يعبر إلى موطنه هو** — لا جدولَ درسٍ في هذه الوحدة (CR-016).
    expect(await rowsOf(driver, "circlelog_sessions")).toHaveLength(1)
    driver.close()
  })

  it("**والبصمةُ تُلحق وتغلب الاشتقاق** بعد العبور — والأحدثُ يغلب", async () => {
    const driver = await freshDb()
    const w = baseeraWorld()
    await seedEducationSession(driver, MAIN, w.pathOf)
    await educationSession(driver, MAIN, w.pathOf, ({ education, log }) => {
      const done = markProgress(education, ctxOf(w.circles, education, log), {
        circleId: w.circleId,
        enrollmentId: w.studentA,
        sessionId: SESSION_A,
        completed: true,
        reasonAr: "حضر مجلساً تعويضياً",
      })
      if (!done.ok) throw new Error(done.error.code)
    })
    const rows = (await rowsOf(driver, "education_progress_corrections")).map(
      (r) => r as Record<string, unknown>,
    )
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!["unit_path"])).toBe(KHALID_PATH)
    expect(String(rows[0]!["reason_ar"])).toBe("حضر مجلساً تعويضياً")

    const matrix = await educationSession(driver, MAIN, w.pathOf, ({ education, log }) =>
      curriculumProgress(education, ctxOf(w.circles, education, log), w.circleId),
    )
    expect(matrix.ok && matrix.value.completedCells).toBe(1)
    driver.close()
  })
})

describe("عزلُ الشبكة والنطاق — وكتالوجُ المنهاج بالجذر", () => {
  it("عزلُ الشبكة: منهاجُ شبكةٍ لا يُقرأ من أخرى", async () => {
    const driver = await freshDb()
    const main = baseeraWorld(MAIN)
    const other = baseeraWorld(OTHER)
    await seedEducationSession(driver, MAIN, main.pathOf)
    const seen = await educationSession(driver, OTHER, other.pathOf, ({ education }) =>
      education.curricula().length,
    )
    expect(seen).toBe(0)
    driver.close()
  })

  it("**والكتالوجُ نطاقُه الجذرُ ويُقرأ من نطاق مسجد** — معجمٌ واحدٌ للشبكة", async () => {
    const driver = await freshDb()
    const w = baseeraWorld()
    await seedEducationSession(driver, MAIN, w.pathOf)
    for (const table of ["education_curricula", "education_levels", "education_books", "education_sessions"]) {
      const paths = (await rowsOf(driver, table)).map((r) =>
        String((r as Record<string, unknown>)["unit_path"]),
      )
      expect(`${table}:${new Set(paths).size}:${paths[0]}`).toBe(`${table}:1:/`)
    }
    const seen = await educationSession(
      driver,
      MAIN,
      w.pathOf,
      ({ education }) => education.sessions().length,
      KHALID_PATH,
    )
    expect(seen).toBe(2)
    driver.close()
  })

  it("**والبصمةُ تُحمَّل مع نطاق حلقتها** لا مع نطاق الشخص", async () => {
    const driver = await freshDb()
    const circles = seedCircleModel(MAIN)
    const khalid = seedCircleWithStudents(circles, { unitId: "khalid", typeId: "baseera" })
    const bilal = seedCircleWithStudents(circles, { unitId: "bilal", typeId: "baseera" })
    const pathOf = circlePathOf(circles)
    await seedEducationSession(driver, MAIN, pathOf)
    await educationSession(driver, MAIN, pathOf, ({ education, log }) => {
      for (const c of [khalid, bilal]) {
        markProgress(education, ctxOf(circles, education, log), {
          circleId: c.circleId,
          enrollmentId: c.studentA,
          sessionId: SESSION_A,
          completed: true,
          reasonAr: "سبب",
        })
      }
    })
    const inKhalid = await educationSession(
      driver,
      MAIN,
      pathOf,
      ({ education }) => education.corrections().map((c) => c.circleId),
      KHALID_PATH,
    )
    expect(inKhalid).toEqual([khalid.circleId])
    driver.close()
  })
})

describe("الذرّية والحتميّة وتطابقُ البديلين", () => {
  it("رميةٌ داخل المقطع ⟵ **لا بصمةَ ولا درسَ** في القاعدة", async () => {
    const driver = await freshDb()
    const w = baseeraWorld()
    await seedEducationSession(driver, MAIN, w.pathOf)
    try {
      await educationSession(driver, MAIN, w.pathOf, ({ education, log }) => {
        markProgress(education, ctxOf(w.circles, education, log), {
          circleId: w.circleId,
          enrollmentId: w.studentA,
          sessionId: SESSION_A,
          completed: true,
          reasonAr: "سبب",
        })
        throw new Error("انقطاعٌ مصطنع")
      })
    } catch {
      /* لا قذف */
    }
    expect(await rowsOf(driver, "education_progress_corrections")).toHaveLength(0)
    driver.close()
  })

  it("**والدرسُ وبصمتُه يُقذفان في دفعةٍ واحدة** — الذرّيةُ عابرةٌ للمصدرين", async () => {
    const driver = await freshDb()
    const w = baseeraWorld()
    await seedEducationSession(driver, MAIN, w.pathOf)
    await educationSession(driver, MAIN, w.pathOf, ({ education, log }) => {
      const ctx = ctxOf(w.circles, education, log)
      recordLesson(education, ctx, {
        circleId: w.circleId,
        sessionId: SESSION_A,
        heldAt: HELD_AT,
        durationMinutes: 60,
        presentEnrollmentIds: [w.studentA],
      })
      markProgress(education, ctx, {
        circleId: w.circleId,
        enrollmentId: w.studentB,
        sessionId: SESSION_B,
        completed: true,
        reasonAr: "سبب",
      })
    })
    expect(await rowsOf(driver, "circlelog_sessions")).toHaveLength(1)
    expect(await rowsOf(driver, "education_progress_corrections")).toHaveLength(1)
    driver.close()
  })

  it("المعرّفُ متتابعٌ عبر جلستين، والحالةُ تُقرأ كما تُركت", async () => {
    const driver = await freshDb()
    const w = baseeraWorld()
    await seedEducationSession(driver, MAIN, w.pathOf)
    for (const enrollmentId of [w.studentA, w.studentB]) {
      await educationSession(driver, MAIN, w.pathOf, ({ education, log }) => {
        markProgress(education, ctxOf(w.circles, education, log), {
          circleId: w.circleId,
          enrollmentId,
          sessionId: SESSION_A,
          completed: true,
          reasonAr: "سبب",
        })
      })
    }
    const ids = (await rowsOf(driver, "education_progress_corrections")).map((r) =>
      String((r as Record<string, unknown>)["id"]),
    )
    expect(new Set(ids).size).toBe(2)
    driver.close()
  })

  it("تطابقُ البديلين **خطوةً خطوة** — الذاكرةُ وD1 يعطيان المصفوفةَ نفسَها", async () => {
    const w = baseeraWorld()
    const memoryEducation = new EducationStore(MAIN)
    const memoryLog = new CircleLogStore(MAIN)
    seedEducationReferences(memoryEducation)
    markProgress(memoryEducation, ctxOf(w.circles, memoryEducation, memoryLog), {
      circleId: w.circleId,
      enrollmentId: w.studentA,
      sessionId: SESSION_A,
      completed: true,
      reasonAr: "سبب",
    })
    const inMemory = JSON.stringify(
      curriculumProgress(memoryEducation, ctxOf(w.circles, memoryEducation, memoryLog), w.circleId),
    )

    const driver = await freshDb()
    const d = baseeraWorld()
    await seedEducationSession(driver, MAIN, d.pathOf)
    await educationSession(driver, MAIN, d.pathOf, ({ education, log }) => {
      markProgress(education, ctxOf(d.circles, education, log), {
        circleId: d.circleId,
        enrollmentId: d.studentA,
        sessionId: SESSION_A,
        completed: true,
        reasonAr: "سبب",
      })
    })
    const onDb = await educationSession(driver, MAIN, d.pathOf, ({ education, log }) =>
      JSON.stringify(curriculumProgress(education, ctxOf(d.circles, education, log), d.circleId)),
    )
    expect(onDb).toBe(inMemory)
    driver.close()
  })
})

describe("ميزانيةُ التحميل — **لكلِّ مصدرٍ على حدة** (G23 · §٤-٠ · الوصفة §٧)", () => {
  it("**أربعةُ مصادرَ في وحدة العمل الواقعية**، ولكلٍّ سقفُه — ولا يُجمع أحدُها بالآخر", () => {
    const education = new EducationStore(MAIN)
    const catalog = persistentEducationCatalog(education)
    const entries = persistentEducationEntries(education, () => "/")
    expect(`${catalog.name}:${catalog.rowBudget}`).toBe("education.catalog:1000")
    expect(`${entries.name}:${entries.rowBudget}`).toBe("education.entries:20000")
    const names = (s: typeof catalog): string[] =>
      s.tables.map((t) => (typeof t === "string" ? t : t.table))
    expect(names(catalog).filter((t) => names(entries).includes(t))).toEqual([])
  })

  it("**وتجاوزُه رميةٌ تُسمّي المصدر**", async () => {
    const driver = await freshDb()
    const w = baseeraWorld()
    await seedEducationSession(driver, MAIN, w.pathOf)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist({ ...persistentEducationCatalog(new EducationStore(MAIN)), rowBudget: 2 })
    await expect(uow.hydrate()).rejects.toThrow(/وحدةُ عمل «education\.catalog»/)
    driver.close()
  })

  it("**وسقفُ مصدرٍ لا يُخفّف سقفَ أخيه**: كتالوجٌ ضيّقٌ لا يمنع تحميلَ البصمات", async () => {
    const driver = await freshDb()
    const w = baseeraWorld()
    await seedEducationSession(driver, MAIN, w.pathOf)
    const store = new EducationStore(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist({ ...persistentEducationEntries(store, w.pathOf), rowBudget: 5 })
    await uow.hydrate()
    expect(store.corrections()).toEqual([])
    expect(store.curricula()).toEqual([])
    driver.close()
  })
})

describe("حوافُّ مستودع المنهاج — والسلبُ أكثرُ من الإيجاب", () => {
  it("**مفتاحُ توجيهٍ لا يُشتقّ يُرمى**: بصمةٌ لحلقةٍ مجهولة لا تُوجَّه إلى الجذر صامتاً", () => {
    const store = new EducationStore(MAIN)
    store.saveCorrection({
      tenantId: MAIN,
      id: "fix-1",
      circleId: "cir-لا-وجود-لها",
      enrollmentId: "enr-1",
      sessionId: SESSION_A,
      completed: true,
      at: NOW,
      byPersonId: "u-amir",
      reasonAr: "سبب",
    })
    expect(() => persistentEducationEntries(store, () => null).project()).toThrow(
      /مفتاحُ توجيهٍ لا يُشتقّ/,
    )
  })

  it("**ومحوُ بصمةٍ من الإسقاط يُرمى** ولا يُترجَم `DELETE` (ملحقٌ فقط — قب-٩)", async () => {
    const driver = await freshDb()
    const w = baseeraWorld()
    await seedEducationSession(driver, MAIN, w.pathOf)
    await educationSession(driver, MAIN, w.pathOf, ({ education, log }) => {
      markProgress(education, ctxOf(w.circles, education, log), {
        circleId: w.circleId,
        enrollmentId: w.studentA,
        sessionId: SESSION_A,
        completed: true,
        reasonAr: "سبب",
      })
    })
    const store = new EducationStore(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(persistentEducationCatalog(store))
    uow.enlist(persistentEducationEntries(store, w.pathOf))
    await uow.hydrate()
    const projected = persistentEducationEntries(store, w.pathOf).project()
    const shrunk = new Map(
      [...projected].map(([name, rows]) =>
        name === "education_progress_corrections" ? [name, new Map()] : [name, rows],
      ),
    )
    expect(() => uow.statementsFor("education.entries", shrunk)).toThrow(
      /education_progress_corrections/,
    )
    driver.close()
  })

  it("**وجلسةُ الكتالوج بالجذر لا تُحمّل بصمةً واحدة** — وهذا هو الفصل (§٤-٠)", async () => {
    const driver = await freshDb()
    const w = baseeraWorld()
    await seedEducationSession(driver, MAIN, w.pathOf)
    await educationSession(driver, MAIN, w.pathOf, ({ education, log }) => {
      const ctx = ctxOf(w.circles, education, log)
      for (let i = 0; i < 60; i += 1) {
        markProgress(education, ctx, {
          circleId: w.circleId,
          enrollmentId: i % 2 === 0 ? w.studentA : w.studentB,
          sessionId: i % 2 === 0 ? SESSION_A : SESSION_B,
          completed: true,
          reasonAr: `سبب ${i}`,
        })
      }
    })
    expect((await rowsOf(driver, "education_progress_corrections")).length).toBe(60)
    const store = new EducationStore(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist({ ...persistentEducationCatalog(store), rowBudget: 50 })
    await uow.hydrate()
    expect(store.sessions().length).toBe(2)
    expect(store.corrections()).toEqual([])
    driver.close()
  })

  it("تحميلٌ من لا شيء لا يرمي ولا يخترع — وعدّادٌ من الصفر", () => {
    const store = new EducationStore(MAIN)
    persistentEducationCatalog(store).load(new Map())
    persistentEducationEntries(store, () => "/").load(new Map())
    expect(store.curricula()).toEqual([])
    expect(store.corrections()).toEqual([])
    expect(store.nextId("fix")).toBe("fix-1")
  })

  it("**وبصمتان تتقاسمان لحظةً واحدة تُرتَّبان حتمياً** بالمعرّف عبر جلستين", async () => {
    const driver = await freshDb()
    const w = baseeraWorld()
    await seedEducationSession(driver, MAIN, w.pathOf)
    await educationSession(driver, MAIN, w.pathOf, ({ education, log }) => {
      const ctx = ctxOf(w.circles, education, log)
      for (const sessionId of [SESSION_A, SESSION_B]) {
        markProgress(education, ctx, {
          circleId: w.circleId,
          enrollmentId: w.studentA,
          sessionId,
          completed: true,
          reasonAr: "سبب",
        })
      }
    })
    const first = await educationSession(driver, MAIN, w.pathOf, ({ education }) =>
      education.corrections().map((c) => c.id),
    )
    const second = await educationSession(driver, MAIN, w.pathOf, ({ education }) =>
      education.corrections().map((c) => c.id),
    )
    expect(second).toEqual(first)
    driver.close()
  })

  it("**وواجهةُ ق-٨٦ تعمل بعد العبور بتوقيعها نفسِه** — لا تُمسّ بحرف", async () => {
    const driver = await freshDb()
    const w = baseeraWorld()
    await seedEducationSession(driver, MAIN, w.pathOf)
    const lessonId = await educationSession(driver, MAIN, w.pathOf, ({ education, log }) => {
      const done = recordLesson(education, ctxOf(w.circles, education, log), {
        circleId: w.circleId,
        sessionId: SESSION_A,
        heldAt: HELD_AT,
        durationMinutes: 90,
        presentEnrollmentIds: [w.studentA],
      })
      if (!done.ok) throw new Error(done.error.code)
      return done.value.id
    })
    const load = await educationSession(driver, MAIN, w.pathOf, ({ education, log }) =>
      approvedTeachingLoad(education, ctxOf(w.circles, education, log, [lessonId]), {
        teacherPersonId: "u-teacher-mosque",
        from: new Date("2026-07-01T00:00:00.000Z"),
        to: NOW,
      }),
    )
    // **الدرسُ المعتمَد وحدَه يُحتسب** (ق-٨٦) — والدقائقُ تعبر القاعدةَ كما كُتبت، بلا مبلغ.
    expect(load.ok && load.value.totalLessonCount).toBe(1)
    expect(load.ok && load.value.totalMinutes).toBe(90)
    expect(load.ok && load.value.lines[0]?.lessonIds).toEqual([lessonId])
    driver.close()
  })
})
