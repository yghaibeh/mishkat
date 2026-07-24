/**
 * **استمرارُ السجلّ اليوميّ على D1** — التسعةُ الإلزامية (الوصفة §٦) وحوافُّ التغطية الثلاثة.
 *
 * **وثابتُ الوحدة الحاكمُ يُقاس بعد عبور القاعدة**: الجلسةُ **كيانٌ واحدٌ مفتاحُه (حلقة × يوم
 * × فترة)** (ق-٩٠ · CR-016 · **CR-020**)، و**صفرُ عدّادٍ مخزَّن** فلا رقمَ يتباعد (ع-١٩/ع-٢٩).
 */

import { describe, expect, it } from "vitest"
import {
  persistentCircleLogCatalog,
  persistentCircleLogEntries,
} from "../../src/db/repositories/circleLogRepository.js"
import { UnitOfWork } from "../../src/db/unitOfWork.js"
import { CircleLogStore } from "../../src/features/circleLog/data/store.js"
import type { CirclesStore } from "../../src/features/circles/data/store.js"
import { recordSession } from "../../src/features/circleLog/services/sessions.js"
import { studentRecordView } from "../../src/features/circleLog/services/derive.js"
import { circleRanking } from "../../src/features/circleLog/services/ranking.js"
import { recordNote } from "../../src/features/circleLog/services/notes.js"
import { issueLink } from "../../src/features/circleLog/services/guardian.js"
import { WHOLE_DAY_PERIOD_ID } from "../../src/features/circleLog/services/periods.js"
import {
  BILAL_PATH,
  KHALID_PATH,
  MAIN,
  MUSHAF_ID,
  NOW,
  OTHER,
  ROOT_SCOPE_PATH,
  SEEDED_SURAHS,
  SQ2_PATH,
  circleLogSession,
  circlePathOf,
  circleLogUnitOfWork,
  declarePeriods,
  freshDb,
  logContext,
  rowsOf,
  seedCircleLogReferences,
  seedCircleLogSession,
  seedCircleModel,
  seedCircleWithStudents,
} from "./_circleLog.js"

type World = {
  readonly circles: CirclesStore
  readonly circleId: string
  readonly studentA: string
  readonly studentB: string
}

function world(tenantId = MAIN, unitId = "khalid"): World {
  const circles = seedCircleModel(tenantId)
  return { circles, ...seedCircleWithStudents(circles, { unitId }) }
}

/** سياقُ الخدمة على **نموذج الحلقات الحقيقيّ** — لا بديلَ في الاختبار. */
function ctxOf(w: World, options: Parameters<typeof logContext>[2] = {}) {
  return logContext(
    { circles: w.circles, log: null as never, circleId: w.circleId, otherCircleId: "", studentA: w.studentA, studentB: w.studentB },
    "u-amir",
    options,
  )
}

function record(
  store: CircleLogStore,
  w: World,
  input: { readonly at?: Date; readonly periodId?: string; readonly mark?: "present" | "absent" } = {},
) {
  return recordSession(store, ctxOf(w), {
    circleId: w.circleId,
    at: input.at ?? NOW,
    ...(input.periodId === undefined ? {} : { periodId: input.periodId }),
    rows: [
      {
        enrollmentId: w.studentA,
        attendance: input.mark ?? "present",
        memorizationGrade: input.mark === "absent" ? null : 8,
        memorization:
          input.mark === "absent"
            ? null
            : { mode: "surah", surahId: SEEDED_SURAHS[0]!.id, fromAyah: 1, toAyah: 3 },
      },
    ],
  })
}

// ═══ الإلزاميّ ١ — ثوابتُ الوحدة على المستودع الحقيقيّ ═══════════════════════════

describe("ق-٩٠ + CR-020 بعد عبور القاعدة — **المفتاحُ (حلقة × يوم × فترة)**", () => {
  it("إعادةُ الإرسال **تستبدل ولا تزدوج** — صفٌّ واحدٌ للفترة نفسِها", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    await circleLogSession(driver, MAIN, w.circles, (store) => record(store, w, { mark: "absent" }))
    await circleLogSession(driver, MAIN, w.circles, (store) => record(store, w, { mark: "present" }))

    const sessions = await rowsOf(driver, "circlelog_sessions")
    expect(sessions).toHaveLength(1)
    const rows = (await rowsOf(driver, "circlelog_session_rows")).map((r) => r as Record<string, unknown>)
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!["attendance"])).toBe("present")
    driver.close()
  })

  it("**وفترتان في اليوم صفّان** — والمفتاحُ في القاعدة يحمل الفترةَ ضلعاً (CR-020)", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    await circleLogSession(driver, MAIN, w.circles, (store) => {
      declarePeriods(store)
      record(store, w, { periodId: "morning" })
      record(store, w, { periodId: "evening" })
    })

    const sessions = (await rowsOf(driver, "circlelog_sessions")).map((r) => r as Record<string, unknown>)
    expect(sessions).toHaveLength(2)
    expect(sessions.map((s) => String(s["period_id"])).sort()).toEqual(["evening", "morning"])
    expect(new Set(sessions.map((s) => String(s["day_key"]))).size).toBe(1)
    driver.close()
  })

  it("**وصفرُ عمودٍ يحفظ عدداً** في أيّ صفٍّ يعبر القاعدة — الحضورُ استعلامٌ (ق-٩١/٩٢)", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    await circleLogSession(driver, MAIN, w.circles, (store) => record(store, w))
    for (const table of ["circlelog_sessions", "circlelog_session_rows"]) {
      for (const row of await rowsOf(driver, table)) {
        for (const column of Object.keys(row as Record<string, unknown>)) {
          expect(`${table}.${column}:${/(count|_total|_num|tally|_pct|average)$/.test(column)}`).toBe(
            `${table}.${column}:false`,
          )
        }
      }
    }
    driver.close()
  })

  it("**والاشتقاقُ يصدق بعد العبور**: الحضورُ والمتوسّطُ يُحسبان من الصفوف لا من رقمٍ مخزَّن", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    await circleLogSession(driver, MAIN, w.circles, (store) => {
      record(store, w, { at: new Date("2026-07-20T09:00:00.000Z"), mark: "present" })
      record(store, w, { at: new Date("2026-07-21T09:00:00.000Z"), mark: "absent" })
    })

    const view = await circleLogSession(driver, MAIN, w.circles, (store) =>
      studentRecordView(store, ctxOf(w), { circleId: w.circleId, enrollmentId: w.studentA }),
    )
    expect(view.ok && view.value.sessions).toBe(2)
    expect(view.ok && view.value.present).toBe(1)
    expect(view.ok && view.value.averageGrade).toBe(8)
    driver.close()
  })
})

// ═══ الإلزاميّ ٢ — عزلُ الشبكة والنطاق ═════════════════════════════════════════

describe("عزلُ الشبكة والنطاق **على المستودع الحقيقيّ**", () => {
  it("عزلُ الشبكة: جلسةُ شبكةٍ لا تُقرأ من أخرى ولو تطابق المسارُ حرفياً", async () => {
    const driver = await freshDb()
    const main = world(MAIN)
    const other = world(OTHER)
    await seedCircleLogSession(driver, MAIN, main.circles)
    await seedCircleLogSession(driver, OTHER, other.circles)
    await circleLogSession(driver, MAIN, main.circles, (store) => record(store, main))

    const seen = await circleLogSession(driver, OTHER, other.circles, (store) => store.sessions().length)
    expect(seen).toBe(0)
    driver.close()
  })

  it("عزلُ النطاق: جلسةُ مسجدٍ **لا تحمّل** سجلَّ جاره — والمسارُ بادئةٌ بشرطةٍ ختامية", async () => {
    const driver = await freshDb()
    const circles = seedCircleModel(MAIN)
    const khalid = { circles, ...seedCircleWithStudents(circles, { unitId: "khalid" }) }
    const bilal = { circles, ...seedCircleWithStudents(circles, { unitId: "bilal" }) }
    await seedCircleLogSession(driver, MAIN, circles)
    await circleLogSession(driver, MAIN, circles, (store) => {
      record(store, khalid)
      record(store, bilal)
    })

    const inKhalid = await circleLogSession(
      driver,
      MAIN,
      circles,
      (store) => store.sessions().map((s) => s.circleId),
      KHALID_PATH,
    )
    expect(inKhalid).toEqual([khalid.circleId])
    const inSq2 = await circleLogSession(driver, MAIN, circles, (store) => store.sessions().length, SQ2_PATH)
    expect(inSq2).toBe(2)
    driver.close()
  })

  it("**وأسطرُ الجلسة تُحمَّل مع نطاق حلقتها** — لا سطرَ يتيمٌ ولا جلسةٌ بلا أسطرها", async () => {
    const driver = await freshDb()
    const circles = seedCircleModel(MAIN)
    const khalid = { circles, ...seedCircleWithStudents(circles, { unitId: "khalid" }) }
    const bilal = { circles, ...seedCircleWithStudents(circles, { unitId: "bilal" }) }
    await seedCircleLogSession(driver, MAIN, circles)
    await circleLogSession(driver, MAIN, circles, (store) => {
      record(store, khalid)
      record(store, bilal)
    })

    const rows = await circleLogSession(
      driver,
      MAIN,
      circles,
      (store) => store.sessions().flatMap((s) => s.rows.map((r) => r.enrollmentId)),
      BILAL_PATH,
    )
    expect(rows).toEqual([bilal.studentA])
    driver.close()
  })
})

// ═══ الإلزاميّ ٣ — مفتاحُ التوجيه: مشتقٌّ من المنفذ لا منسوخٌ ولا جذرٌ صامت ══════

describe("مفتاحُ التوجيه **من موطن الحلقة الحيّ** — والكتالوجُ بالجذر صراحةً", () => {
  it("الجلسةُ وأسطرُها وملاحظتُها ورابطُها تعبر بمسار حلقتها", async () => {
    const driver = await freshDb()
    const w = world(MAIN, "bilal")
    await seedCircleLogSession(driver, MAIN, w.circles)
    await circleLogSession(driver, MAIN, w.circles, (store) => {
      record(store, w)
      recordNote(store, ctxOf(w), { circleId: w.circleId, bodyAr: "ملاحظةٌ إشرافية" })
      issueLink(store, ctxOf(w), { circleId: w.circleId, enrollmentId: w.studentA })
    })
    for (const table of [
      "circlelog_sessions",
      "circlelog_session_rows",
      "circlelog_notes",
      "circlelog_links",
    ]) {
      const rows = (await rowsOf(driver, table)).map((r) => r as Record<string, unknown>)
      expect(`${table}:${rows.length}`).toBe(`${table}:1`)
      expect(`${table}:${String(rows[0]!["unit_path"])}`).toBe(`${table}:${BILAL_PATH}`)
    }
    driver.close()
  })

  it("**والكتالوجُ الثلاثيُّ نطاقُه الجذرُ صراحةً** — معجمٌ للشبكة لا لشظيةِ وحدة", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    await circleLogSession(driver, MAIN, w.circles, (store) => declarePeriods(store))
    for (const table of ["circlelog_surahs", "circlelog_mushafs", "circlelog_periods"]) {
      const paths = (await rowsOf(driver, table)).map((r) =>
        String((r as Record<string, unknown>)["unit_path"]),
      )
      expect(`${table}:${new Set(paths).size}`).toBe(`${table}:1`)
      expect(`${table}:${paths[0]}`).toBe(`${table}:${ROOT_SCOPE_PATH}`)
    }
    driver.close()
  })

  it("**والمعجمُ يُقرأ من نطاق مسجدٍ** — فلا يُحرم المحفّظُ من السور والفترات", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    const seen = await circleLogSession(
      driver,
      MAIN,
      w.circles,
      (store) => ({ surahs: store.surahs().length, mushaf: store.getMushaf(MUSHAF_ID) !== null }),
      KHALID_PATH,
    )
    expect(seen).toEqual({ surahs: SEEDED_SURAHS.length, mushaf: true })
    driver.close()
  })
})

// ═══ الإلزاميّ ٤ — الذرّية ═════════════════════════════════════════════════════

describe("الذرّية — فشلٌ في منتصف عمليةٍ لا يترك نصفَ أثر", () => {
  it("رميةٌ داخل المقطع المتزامن ⟵ **لا جلسةَ ولا سطرَ** في القاعدة", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    const store = new CircleLogStore(MAIN)
    const uow = circleLogUnitOfWork(driver, store, w.circles, { tenantId: MAIN, scopePath: ROOT_SCOPE_PATH })
    await uow.hydrate()
    try {
      record(store, w)
      throw new Error("انقطاعٌ مصطنعٌ بعد التسجيل وقبل القذف")
    } catch {
      /* لا قذف */
    }
    expect(await rowsOf(driver, "circlelog_sessions")).toHaveLength(0)
    expect(await rowsOf(driver, "circlelog_session_rows")).toHaveLength(0)
    driver.close()
  })

  it("**وقراءةٌ بلا كتابة لا تُنتج عبارةً واحدة**", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    await circleLogSession(driver, MAIN, w.circles, (store) => record(store, w))

    const store = new CircleLogStore(MAIN)
    const uow = circleLogUnitOfWork(driver, store, w.circles, { tenantId: MAIN, scopePath: ROOT_SCOPE_PATH })
    await uow.hydrate()
    studentRecordView(store, ctxOf(w), { circleId: w.circleId, enrollmentId: w.studentA })
    const model = circlePathOf(w.circles)
    expect(uow.statementsFor("circleLog.catalog", persistentCircleLogCatalog(store).project())).toEqual([])
    expect(
      uow.statementsFor("circleLog.entries", persistentCircleLogEntries(store, model).project()),
    ).toEqual([])
    driver.close()
  })

  it("**ومحوُ جلسةٍ من الإسقاط يُرمى** ولا يُترجَم `DELETE` (ملحقٌ فقط)", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    await circleLogSession(driver, MAIN, w.circles, (store) => record(store, w))

    const store = new CircleLogStore(MAIN)
    const uow = circleLogUnitOfWork(driver, store, w.circles, { tenantId: MAIN, scopePath: ROOT_SCOPE_PATH })
    await uow.hydrate()
    const projected = persistentCircleLogEntries(store, circlePathOf(w.circles)).project()
    const shrunk = new Map(
      [...projected].map(([name, rows]) =>
        name === "circlelog_sessions" ? [name, new Map()] : [name, rows],
      ),
    )
    expect(() => uow.statementsFor("circleLog.entries", shrunk)).toThrow(/circlelog_sessions/)
    driver.close()
  })

  it("**وسطرُ طالبٍ حُذف من الكشف يُحذف بحقٍّ** — ق-٩٠ يجعل إعادةَ الإرسال استبدالاً", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    await circleLogSession(driver, MAIN, w.circles, (store) =>
      recordSession(store, ctxOf(w), {
        circleId: w.circleId,
        at: NOW,
        rows: [
          { enrollmentId: w.studentA, attendance: "present" },
          { enrollmentId: w.studentB, attendance: "present" },
        ],
      }),
    )
    expect(await rowsOf(driver, "circlelog_session_rows")).toHaveLength(2)
    // إعادةُ إرسالٍ بطالبٍ واحد — **حذفٌ مشروعٌ معلَن** لا محوٌ صامت.
    await circleLogSession(driver, MAIN, w.circles, (store) => record(store, w))
    expect(await rowsOf(driver, "circlelog_session_rows")).toHaveLength(1)
    driver.close()
  })
})

// ═══ الإلزاميّ ٥ — تطابقُ البديلين ═════════════════════════════════════════════

describe("تطابقُ البديلين — السجلُّ في الذاكرة وعلى D1", () => {
  it("السيناريو نفسُه يعطي النتائجَ نفسَها على البديلين **خطوةً خطوة**", async () => {
    const steps: string[] = []
    const watch = (store: CircleLogStore, w: World, label: string): void => {
      const view = studentRecordView(store, ctxOf(w), {
        circleId: w.circleId,
        enrollmentId: w.studentA,
      })
      steps.push(`${label}:${JSON.stringify(view)}`)
    }

    const memoryWorld = world()
    const memory = new CircleLogStore(MAIN)
    seedCircleLogReferences(memory)
    record(memory, memoryWorld, { at: new Date("2026-07-20T09:00:00.000Z") })
    watch(memory, memoryWorld, "أ/١")
    record(memory, memoryWorld, { at: NOW, mark: "absent" })
    watch(memory, memoryWorld, "أ/٢")
    const inMemory = [...steps]

    steps.length = 0
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    await circleLogSession(driver, MAIN, w.circles, (store) => {
      record(store, w, { at: new Date("2026-07-20T09:00:00.000Z") })
      watch(store, w, "أ/١")
    })
    await circleLogSession(driver, MAIN, w.circles, (store) => {
      record(store, w, { at: NOW, mark: "absent" })
      watch(store, w, "أ/٢")
    })
    expect(steps).toEqual(inMemory)
    driver.close()
  })

  it("الحالةُ الدائمة تُقرأ بعد الجلسة كما تُركت — التحميلُ والإسقاطُ متعاكسان", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    await circleLogSession(driver, MAIN, w.circles, (store) => record(store, w))
    const first = await circleLogSession(driver, MAIN, w.circles, (store) =>
      JSON.stringify(store.sessions()),
    )
    const second = await circleLogSession(driver, MAIN, w.circles, (store) =>
      JSON.stringify(store.sessions()),
    )
    expect(second).toBe(first)
    driver.close()
  })
})

// ═══ الإلزاميّ ٦ — الحتميّة عبر الجلسات وتحت نطاقٍ جزئيّ ═══════════════════════

describe("الحتميّة تنجو عبور القاعدة — العدّادُ يُستأنف ولا يعود صفراً", () => {
  it("المعرّفُ متتابعٌ عبر ثلاث جلسات — فلا تُدهس ملاحظةٌ بملاحظة", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    for (let i = 0; i < 3; i += 1) {
      await circleLogSession(driver, MAIN, w.circles, (store) =>
        recordNote(store, ctxOf(w), { circleId: w.circleId, bodyAr: `ملاحظة ${i}` }),
      )
    }
    const ids = (await rowsOf(driver, "circlelog_notes")).map((r) =>
      String((r as Record<string, unknown>)["id"]),
    )
    expect(new Set(ids).size).toBe(3)
    driver.close()
  })

  it("**والنطاقُ الجزئيُّ لا يُنقص العدّاد**: جلسةُ مسجدٍ لا تدهس معرّفَ جاره", async () => {
    const driver = await freshDb()
    const circles = seedCircleModel(MAIN)
    const khalid = { circles, ...seedCircleWithStudents(circles, { unitId: "khalid" }) }
    const bilal = { circles, ...seedCircleWithStudents(circles, { unitId: "bilal" }) }
    await seedCircleLogSession(driver, MAIN, circles)
    await circleLogSession(driver, MAIN, circles, (store) =>
      recordNote(store, ctxOf(bilal), { circleId: bilal.circleId, bodyAr: "ملاحظةُ بلال" }),
    )
    await circleLogSession(
      driver,
      MAIN,
      circles,
      (store) => recordNote(store, ctxOf(khalid), { circleId: khalid.circleId, bodyAr: "ملاحظةُ خالد" }),
      KHALID_PATH,
    )
    const ids = (await rowsOf(driver, "circlelog_notes")).map((r) =>
      String((r as Record<string, unknown>)["id"]),
    )
    expect(new Set(ids).size).toBe(2)
    driver.close()
  })

  it("ولا ساعةَ في المستودع: قاعدتان مستقلتان تُنتجان الصفوفَ نفسَها حرفياً", async () => {
    const runs: string[] = []
    for (let i = 0; i < 2; i += 1) {
      const driver = await freshDb()
      const w = world()
      await seedCircleLogSession(driver, MAIN, w.circles)
      await circleLogSession(driver, MAIN, w.circles, (store) => record(store, w))
      runs.push(JSON.stringify(await rowsOf(driver, "circlelog_session_rows")))
      driver.close()
    }
    expect(runs[1]).toBe(runs[0])
  })
})

// ═══ الإلزاميّ ٧ — ميزانيةُ التحميل (G23) ═══════════════════════════════════════

describe("ميزانيةُ التحميل — أخطرُ سقفٍ في الموجة (G23 · §٤-٠ · CR-030)", () => {
  it("**مصدران لا واحد**، ولكلٍّ سقفٌ موجبٌ — والكتالوجُ أضيقُ بمراتب", () => {
    const store = new CircleLogStore(MAIN)
    const catalog = persistentCircleLogCatalog(store)
    const entries = persistentCircleLogEntries(store, circlePathOf(seedCircleModel(MAIN)))
    expect(`${catalog.name}:${catalog.rowBudget > 0}`).toBe("circleLog.catalog:true")
    expect(`${entries.name}:${entries.rowBudget > 0}`).toBe("circleLog.entries:true")
    expect(catalog.rowBudget < entries.rowBudget).toBe(true)
    const names = (s: typeof catalog): string[] =>
      s.tables.map((t) => (typeof t === "string" ? t : t.table))
    expect(names(catalog).filter((t) => names(entries).includes(t))).toEqual([])
  })

  it("**وتجاوزُه رميةٌ تُسمّي المصدرَ والجدولَ الأكبر** — لا «تجاوزٌ» مبهمة", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    await circleLogSession(driver, MAIN, w.circles, (store) => record(store, w))
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: ROOT_SCOPE_PATH })
    uow.enlist({
      ...persistentCircleLogEntries(new CircleLogStore(MAIN), circlePathOf(w.circles)),
      rowBudget: 1,
    })
    await expect(uow.hydrate()).rejects.toThrow(/وحدةُ عمل «circleLog\.entries»/)
    driver.close()
  })

  it("**جلسةُ الكتالوج بالجذر لا تُحمّل سطرَ حضورٍ واحداً** — وهذا هو الفصل (§٤-٠)", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    // حمولةٌ تشغيليةٌ **أكبرُ من سقف الكتالوج المُصطنَع أدناه** — وإلا كان الحارسُ لا يقدر أن يحمرّ.
    await circleLogSession(driver, MAIN, w.circles, (store) => {
      for (let day = 1; day <= 60; day += 1) {
        const at = new Date(Date.UTC(2026, 3, day, 9))
        record(store, w, { at })
      }
    })
    expect((await rowsOf(driver, "circlelog_sessions")).length).toBe(60)

    const store = new CircleLogStore(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: ROOT_SCOPE_PATH })
    uow.enlist({ ...persistentCircleLogCatalog(store), rowBudget: 50 })
    await uow.hydrate() // لا يرمي: لم يُحمَّل إلا الكتالوج
    expect(store.surahs().length).toBe(SEEDED_SURAHS.length)
    expect(store.sessions()).toEqual([])
    expect(store.notes()).toEqual([])
    driver.close()
  })

  it("**والتضييقُ بالمسار يُنقص المحمولَ فعلاً** — نمطٌ (أ) خالص (T26-ج)", async () => {
    const driver = await freshDb()
    const circles = seedCircleModel(MAIN)
    const khalid = { circles, ...seedCircleWithStudents(circles, { unitId: "khalid" }) }
    const bilal = { circles, ...seedCircleWithStudents(circles, { unitId: "bilal" }) }
    await seedCircleLogSession(driver, MAIN, circles)
    await circleLogSession(driver, MAIN, circles, (store) => {
      record(store, khalid)
      record(store, bilal)
    })
    const atRoot = await circleLogSession(driver, MAIN, circles, (s) => s.sessions().length)
    const atMosque = await circleLogSession(
      driver,
      MAIN,
      circles,
      (s) => s.sessions().length,
      KHALID_PATH,
    )
    // **٢ بالجذر و١ بالمسجد** — فالتضييقُ مقيسٌ لا موعود (نظيرُ `scope-axis` للنمط أ).
    expect(`${atRoot}/${atMosque}`).toBe("2/1")
    driver.close()
  })
})

// ═══ الإلزاميّ ٨ + حوافُّ التغطية — والسلبُ أكثرُ من الإيجاب ════════════════════

describe("حوافُّ مستودع السجلّ — والسلبُ أكثرُ من الإيجاب", () => {
  it("**مفتاحُ توجيهٍ لا يُشتقّ يُرمى**: جلسةٌ لحلقةٍ مجهولة لا تُوجَّه إلى الجذر صامتاً", () => {
    const store = new CircleLogStore(MAIN)
    store.upsertSession({
      tenantId: MAIN,
      id: "session-1",
      circleId: "cir-لا-وجود-لها",
      dayKey: "2026-07-22",
      periodId: WHOLE_DAY_PERIOD_ID,
      heldAt: NOW,
      shape: { kind: "recitation" },
      rows: [],
      recordedByPersonId: "u-amir",
      recordedAt: NOW,
    })
    const model = circlePathOf(seedCircleModel(MAIN))
    expect(() => persistentCircleLogEntries(store, model).project()).toThrow(/مفتاحُ توجيهٍ لا يُشتقّ/)
  })

  it("تحميلٌ من لا شيء لا يرمي ولا يخترع — قاعدةٌ فارغةٌ مستودعٌ فارغٌ وعدّادٌ من الصفر", () => {
    const store = new CircleLogStore(MAIN)
    persistentCircleLogCatalog(store).load(new Map())
    persistentCircleLogEntries(store, circlePathOf(seedCircleModel(MAIN))).load(new Map())
    expect(store.sessions()).toEqual([])
    expect(store.surahs()).toEqual([])
    expect(store.nextId("session")).toBe("session-1")
  })

  it("**وجلستان تتقاسمان يوماً واحداً تُرتَّبان حتمياً** بالفترة — لا بترتيب الإدخال", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    await circleLogSession(driver, MAIN, w.circles, (store) => {
      declarePeriods(store)
      record(store, w, { periodId: "evening" })
      record(store, w, { periodId: "morning" })
    })
    const first = await circleLogSession(driver, MAIN, w.circles, (store) =>
      studentRecordView(store, ctxOf(w), { circleId: w.circleId, enrollmentId: w.studentA }),
    )
    const second = await circleLogSession(driver, MAIN, w.circles, (store) =>
      studentRecordView(store, ctxOf(w), { circleId: w.circleId, enrollmentId: w.studentA }),
    )
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    // **والجمعُ يعبر القاعدة**: فترتان في يومٍ ⟵ **يومٌ واحد** (CR-020).
    expect(first.ok && first.value.sessions).toBe(1)
    expect(first.ok && first.value.days).toHaveLength(2)
    driver.close()
  })

  it("**وفروعُ الشكل والأعمدة الفارغة تعبر صريحةً**: تحفيظٌ بنطاقٍ · بصفحات · بلا تقييم", async () => {
    const driver = await freshDb()
    const w = world()
    await seedCircleLogSession(driver, MAIN, w.circles)
    await circleLogSession(driver, MAIN, w.circles, (store) =>
      recordSession(store, ctxOf(w), {
        circleId: w.circleId,
        at: NOW,
        rows: [
          {
            enrollmentId: w.studentA,
            attendance: "present",
            memorization: { mode: "surah", surahId: SEEDED_SURAHS[0]!.id, fromAyah: 1, toAyah: 3 },
            memorizationGrade: 9,
            review: { mode: "pages", mushafId: MUSHAF_ID, fromPage: 10, toPage: 12 },
            reviewGrade: 7,
          },
          { enrollmentId: w.studentB, attendance: "excused" },
        ],
      }),
    )
    const rows = (await rowsOf(driver, "circlelog_session_rows")).map(
      (r) => r as Record<string, unknown>,
    )
    const withRefs = rows.find((r) => r["memo_mode"] !== null)!
    expect(String(withRefs["memo_mode"])).toBe("surah")
    expect(String(withRefs["review_mode"])).toBe("pages")
    expect(Number(withRefs["review_from"])).toBe(10)
    const bare = rows.find((r) => r["memo_mode"] === null)!
    expect(String(bare["attendance"])).toBe("excused")
    expect(bare["review_ref"]).toBeNull()

    // **والقراءةُ تعيد الوجهين كما كُتبا** — التحميلُ والإسقاطُ متعاكسان على الاتحاد.
    const back = await circleLogSession(driver, MAIN, w.circles, (store) =>
      store.sessions()[0]!.rows.map((r) => r.evaluation?.review?.mode ?? null),
    )
    expect(back.sort()).toEqual([null, "pages"])
    driver.close()
  })

  it("**وترتيبُ حلقاتٍ يعبر القاعدة** (ق-٩١) — والحلقةُ الخاملةُ صفرٌ لا تختفي", async () => {
    const driver = await freshDb()
    const circles = seedCircleModel(MAIN)
    const active = { circles, ...seedCircleWithStudents(circles, { unitId: "khalid" }) }
    seedCircleWithStudents(circles, { unitId: "khalid" })
    await seedCircleLogSession(driver, MAIN, circles)
    await circleLogSession(driver, MAIN, circles, (store) => record(store, active))

    const ranking = await circleLogSession(driver, MAIN, circles, (store) =>
      circleRanking(store, ctxOf(active), { unitPath: KHALID_PATH }),
    )
    expect(ranking.rows).toHaveLength(2)
    expect(ranking.rows.filter((r) => r.inactive)).toHaveLength(1)
    expect(ranking.rows.find((r) => r.circleId === active.circleId)?.attendancePct).toBe(100)
    driver.close()
  })
})
