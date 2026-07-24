/**
 * **استمرارُ سجل اليوم على D1** — T26-ب (الاختبارات الإلزامية ١…٩ + حوافّ التغطية).
 *
 * ثوابتُ الوحدة تُقاس هنا **على المستودع الحقيقيّ** لا على الذاكرة:
 *  · **ق-٤١/ق-٤٥ لا محو** — القيدُ يُحدَّث في مكانه upsert ولا يُحذف؛ واختفاءُ صفٍّ يُرمى.
 *  · **ق-٤٢ الكتالوجُ شبكيّ** — مخطّطٌ نطاقُه سلفُ الوحدة يُحمَّل في جلسة المسجد (يسكن الجذر).
 *  · **قب-١٨ عزلُ النطاق** — شبكةً ونطاقاً، والشبكتان بنفس المسارات النسبيّة عمداً.
 *  · **الذرّيةُ والحتميّةُ وتطابقُ البديلين وG23** — كما في نموذج العُهد المُراجَع.
 */

import { describe, expect, it } from "vitest"
import { persistentDailyLog } from "../../src/db/repositories/dailyLogRepository.js"
import { UnitOfWork } from "../../src/db/unitOfWork.js"
import { DailyLogStore } from "../../src/features/dailyLog/data/store.js"
import { recordDailyEntry, entriesOfPeriod } from "../../src/features/dailyLog/services/entries.js"
import { setFamilyRoster, familyRosterOf } from "../../src/features/dailyLog/services/roster.js"
import { schemeForUnit, activityAt } from "../../src/features/dailyLog/services/catalog.js"
import { periodPoints } from "../../src/features/dailyLog/services/totals.js"
import type { SqlStatement } from "../../src/db/sql/driver.js"
import type { DailyEntry } from "../../src/features/dailyLog/types.js"
import {
  BILAL_PATH,
  KHALID,
  KHALID_PATH,
  MAIN,
  NOW,
  NOUR,
  NOUR_PATH,
  OTHER,
  WEEK,
  dailyLogContext,
  dailyLogSession,
  freshDailyLogStores,
  freshDb,
  rowsOf,
  seedDailyLogInto,
  seedDailyLogSession,
} from "./_dailyLog.js"

/** إدخالُ قيدٍ بالطريق المُعلَن لا بحقنٍ في المستودع. */
function record(
  store: DailyLogStore,
  opts: {
    clientUuid: string
    unitId?: string
    activityId?: string
    freeTextAr?: string
    count?: number
    studentIds?: readonly string[]
    attendees?: number
    actor?: string
  },
): DailyEntry {
  // بناءٌ يُسقط الحقولَ غيرَ المُعطاة (لا `undefined` صريحة — `exactOptionalPropertyTypes`).
  const done = recordDailyEntry(store, dailyLogContext(opts.actor ?? "u-amir"), {
    clientUuid: opts.clientUuid,
    unitId: opts.unitId ?? KHALID,
    count: opts.count ?? 1,
    date: NOW,
    ...(opts.activityId !== undefined ? { activityId: opts.activityId } : {}),
    ...(opts.freeTextAr !== undefined ? { freeTextAr: opts.freeTextAr } : {}),
    ...(opts.studentIds !== undefined ? { studentIds: opts.studentIds } : {}),
    ...(opts.attendees !== undefined ? { attendees: opts.attendees } : {}),
  })
  if (!done.ok) throw new Error(`تعذّر القيد: ${done.error.code}`)
  return done.value
}

/** قراءةُ عبارات المستودع مقابل أساسه — بها يُقاس **ما يُكتب** لا ما يُقرأ. */
async function statementsAfter(
  driver: Awaited<ReturnType<typeof freshDb>>,
  tenantId: string,
  fn: (store: DailyLogStore) => void,
): Promise<readonly SqlStatement[]> {
  const stores = freshDailyLogStores(tenantId)
  const source = persistentDailyLog(stores.dailyLog)
  const uow = new UnitOfWork(driver, { tenantId, scopePath: "/" })
  uow.enlist(source)
  await uow.hydrate()
  fn(stores.dailyLog)
  return uow.statementsFor(source.name, source.project())
}

// ═══ الاختبار الإلزاميّ ١ — ق-٤١/ق-٤٥: لا محو، والقيدُ يُحدَّث في مكانه ═══════════

describe("ق-٤١/ق-٤٥ — قيودٌ لا تُمحى: الاختفاءُ يُرمى ولا يُترجم `DELETE`", () => {
  it("ق-٤٥ — محوُ قيدٍ من الإسقاط **يُرمى**، ولا `DELETE` يُولَّد (النقطةُ مالٌ ق-٣٣)", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    await dailyLogSession(driver, MAIN, (store) => record(store, { clientUuid: "c-1", activityId: "lesson" }))

    const stores = freshDailyLogStores(MAIN)
    const source = persistentDailyLog(stores.dailyLog)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(source)
    await uow.hydrate()

    const forged = new Map(source.project())
    forged.set("daily_entries", new Map())
    expect(() => uow.statementsFor(source.name, forged)).toThrow(/daily_entries/)
    driver.close()
  })

  it("**ولا عبارةَ حذفٍ واحدة** تُولَّد مهما تعاقبت المزامناتُ والتحديثات", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    const statements = await statementsAfter(driver, MAIN, (store) => {
      record(store, { clientUuid: "c-1", activityId: "lesson", count: 1 })
      // مزامنةٌ ثانيةٌ بنفس البصمة تُحدِّث القيدَ نفسَه — أشدُّ ما يُغري بحذفٍ وإدراج.
      record(store, { clientUuid: "c-1", activityId: "lesson", count: 3 })
      record(store, { clientUuid: "c-2", activityId: "lesson", count: 2, unitId: "bilal" })
    })
    expect(statements.filter((s) => /^DELETE/.test(s.sql))).toEqual([])
    driver.close()
  })

  it("ق-٤٥ — المزامنةُ الثانية **تحديثٌ**: بصمةٌ واحدةٌ ⟵ الصفُّ نفسُه لا صفٌّ جديد", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    const first = await dailyLogSession(driver, MAIN, (store) =>
      record(store, { clientUuid: "c-sync", activityId: "lesson", count: 1 }),
    )
    expect(await rowsOf(driver, "daily_entries")).toHaveLength(1)

    const statements = await statementsAfter(driver, MAIN, (store) => {
      record(store, { clientUuid: "c-sync", activityId: "lesson", count: 4 })
    })
    const onEntries = statements.filter((s) => s.sql.includes("daily_entries"))
    expect(onEntries).toHaveLength(1)
    expect(onEntries[0]!.sql).toContain("ON CONFLICT (tenant_id, id) DO UPDATE")

    await dailyLogSession(driver, MAIN, (store) => {
      record(store, { clientUuid: "c-sync", activityId: "lesson", count: 4 })
    })
    const rows = (await rowsOf(driver, "daily_entries")) as readonly Record<string, unknown>[]
    // **الصفُّ نفسُه بقي**: عددُه واحدٌ ومعرّفُه لم يتبدّل — والعدُّ تحرّك بتحديثٍ لا بصفٍّ جديد.
    expect(rows).toHaveLength(1)
    expect(rows[0]!["id"]).toBe(first.id)
    expect(Number(rows[0]!["count"])).toBe(4)
    expect(Number(rows[0]!["points"])).toBe(20)
    driver.close()
  })

  it("ق-٤١ — النقاطُ **المخزَّنة** تعبر القاعدةَ كما حُسمت، ويجمعها `periodPoints`", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    await dailyLogSession(driver, MAIN, (store) => {
      setFamilyRoster(store, dailyLogContext("u-amir"), { unitId: KHALID, studentCount: 10 })
      record(store, { clientUuid: "c-1", activityId: "lesson", count: 1 }) // ٥
      record(store, { clientUuid: "c-2", activityId: "jamaah", count: 1, attendees: 10 }) // ١ (مفتاحٌ طبيعيٌّ آخر)
    })
    // القراءةُ بعد عبور القاعدة: النقاطُ مخزَّنةٌ لا مشتقّةٌ من العدد×الوزن الآنيّ.
    const points = await dailyLogSession(driver, MAIN, (store) => periodPoints(store, KHALID_PATH, WEEK))
    const rows = (await rowsOf(driver, "daily_entries")) as readonly Record<string, unknown>[]
    expect(rows.map((r) => Number(r["points"])).sort((a, b) => a - b)).toEqual([1, 5])
    expect(points).toBe(6)
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٢ — ق-٤٥: المفتاحُ الطبيعيّ يفصل، والبصمةُ تُوحّد ══════════

describe("ق-٤٥ — فهرسان فريدان: لا قيدان لنفس النشاط في اليوم، ولا مضاعفةَ نقاط", () => {
  it("نفسُ (وحدة/نشاط/يوم) ببصمتين ⟵ الموجودُ يُحدَّث، فقيدٌ واحدٌ في القاعدة", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    await dailyLogSession(driver, MAIN, (store) => {
      record(store, { clientUuid: "c-a", activityId: "lesson", count: 1 })
      // بصمةٌ أخرى لكن **نفسُ المفتاح الطبيعيّ** (نفسُ النشاط واليوم والوحدة) ⟵ تحديثٌ.
      record(store, { clientUuid: "c-b", activityId: "lesson", count: 2 })
    })
    const rows = (await rowsOf(driver, "daily_entries")) as readonly Record<string, unknown>[]
    expect(rows).toHaveLength(1)
    expect(Number(rows[0]!["count"])).toBe(2)
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٣ — قب-١٨: عزلُ النطاق على المستودع الحقيقيّ ═══════════

describe("قب-١٨ — عزلُ النطاق **على المستودع الحقيقيّ** لا على الذاكرة", () => {
  it("عزلُ الشبكة: قيدُ شبكةٍ **لا يُقرأ** من أخرى ولو تطابق المسارُ حرفياً", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    await seedDailyLogSession(driver, OTHER)
    await dailyLogSession(driver, OTHER, (store) =>
      record(store, { clientUuid: "c-alien", activityId: "lesson", count: 7 }),
    )
    await dailyLogSession(driver, MAIN, (store) => {
      expect(store.entries()).toEqual([])
      expect(periodPoints(store, KHALID_PATH, WEEK)).toBe(0)
    })
    driver.close()
  })

  it("عزلُ الشبكة: كتابةُ شبكةٍ **لا تمسّ** صفَّ الأخرى ولو حمل المعرّفَ نفسَه", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    await seedDailyLogSession(driver, OTHER)
    await dailyLogSession(driver, OTHER, (store) => record(store, { clientUuid: "c-x", activityId: "lesson", count: 1 }))
    await dailyLogSession(driver, MAIN, (store) => record(store, { clientUuid: "c-x", activityId: "lesson", count: 9 }))

    const rows = (await rowsOf(driver, "daily_entries")) as readonly Record<string, unknown>[]
    // معرّفٌ واحدٌ (`dle-1`) في شبكتين — المفتاحُ الطبيعيّ يفصلهما بالشبكة لا بالمسار.
    expect(
      rows.map((r) => `${String(r["tenant_id"])}|${String(r["id"])}|${Number(r["count"])}`).sort(),
    ).toEqual(["t-aleppo|dle-1|1", "t-main|dle-1|9"])
    driver.close()
  })

  it("عزلُ النطاق: جلسةُ مسجدٍ **لا تحمّل** قيدَ جاره ولا عددَ أسرته — بادئةٌ بشرطةٍ ختامية", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    await dailyLogSession(driver, MAIN, (store) => {
      record(store, { clientUuid: "c-k", activityId: "lesson", unitId: KHALID })
      record(store, { clientUuid: "c-b", activityId: "lesson", unitId: "bilal" })
      setFamilyRoster(store, dailyLogContext("u-amir"), { unitId: KHALID, studentCount: 10 })
    })

    await dailyLogSession(
      driver,
      MAIN,
      (store) => {
        // جلسةُ بلال ترى قيدَ بلال وحدَه، ولا ترى عددَ أسرة خالد.
        expect(store.entries().map((e) => e.unitPath)).toEqual([BILAL_PATH])
        expect(entriesOfPeriod(store, KHALID_PATH, WEEK)).toEqual([])
        expect(familyRosterOf(store, KHALID_PATH)).toBeNull()
      },
      BILAL_PATH,
    )
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٤ — ق-٤٢: الكتالوجُ شبكيٌّ يُقرأ من كل وحدة (قرارُ التوجيه) ══

describe("ق-٤٢ — المخطّطُ يُختار بالنطاق، والكتالوجُ **شبكيٌّ يسكن الجذر** فيُقرأ بعد القاعدة", () => {
  it("جلسةُ مسجدٍ تحمّل مخطّطاً نطاقُه **سلفُها** (`/men/`) — لأنه يسكن الجذر لا نطاقَه", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    // جلسةٌ نطاقُها المسجد وحدَه — ومع ذلك يُحلّ مخطّطُ `/men/` (سلفٌ لا خلَف).
    await dailyLogSession(
      driver,
      MAIN,
      (store) => {
        const scheme = schemeForUnit(store, KHALID_PATH)
        expect(scheme?.id).toBe("scheme-men")
        // ونسخةُ النشاط تُقرأ كذلك: `lesson` يوم NOW موجودةٌ بوزنها.
        expect(activityAt(store, "scheme-men", "lesson", NOW)?.weight).toBe(5)
      },
      KHALID_PATH,
    )
    driver.close()
  })

  it("ومسجدُ النساء يحلّ مخطّطَه (`/women/`) — «مسارُ النساء حالةٌ من القاعدة لا فرعٌ في الكود»", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    await dailyLogSession(
      driver,
      MAIN,
      (store) => {
        expect(schemeForUnit(store, NOUR_PATH)?.id).toBe("scheme-women")
        // والمسجدُ يُدخل بمخطّطه بلا سطرِ كودٍ جنسانيّ.
        const done = recordDailyEntry(store, dailyLogContext("u-amir"), {
          clientUuid: "c-nour",
          unitId: NOUR,
          activityId: "dawah",
          count: 1,
          date: NOW,
        })
        expect(done.ok).toBe(true)
      },
      NOUR_PATH,
    )
    const rows = (await rowsOf(driver, "daily_entries")) as readonly Record<string, unknown>[]
    expect(String(rows[0]!["unit_path"])).toBe(NOUR_PATH)
    driver.close()
  })

  it("**الكتالوجُ يعبر القاعدةَ بـ`unit_path='/'`، ونطاقُ سريانه `scope_path` عمودُ بيانات**", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    const schemes = (await rowsOf(driver, "daily_schemes")) as readonly Record<string, unknown>[]
    for (const s of schemes) expect(String(s["unit_path"])).toBe("/") // توجيهٌ شبكيّ
    expect(schemes.map((s) => `${String(s["id"])}|${String(s["scope_path"])}`).sort()).toEqual([
      "scheme-men|/men/",
      "scheme-women|/women/",
    ])
    const activities = (await rowsOf(driver, "daily_activities")) as readonly Record<string, unknown>[]
    for (const a of activities) expect(String(a["unit_path"])).toBe("/")
    driver.close()
  })

  it("**ولا سجلَّ تدقيقٍ محليّ يملكه المستودع** — تدقيقُ سطوحه في `defineServerFn` (لا CR-027 هنا)", async () => {
    const { readFileSync } = await import("node:fs")
    const { fileURLToPath } = await import("node:url")
    const unit = fileURLToPath(new URL("../../src/features/dailyLog/", import.meta.url))
    const code = (path: string): string =>
      readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
    for (const file of ["types.ts", "data/store.ts"]) {
      const source = code(`${unit}${file}`)
      expect(`${file}:${/AuditRecord|auditList|appendAudit/.test(source)}`).toBe(`${file}:false`)
    }
  })
})

// ═══ الاختبار الإلزاميّ ٥ — الذرّية: لا نصفَ أثر ══════════════════════════════

describe("الذرّية — فشلٌ في منتصف عمليةٍ لا يترك نصفَ أثر", () => {
  it("رميةٌ داخل المعاملة ⟵ لا قيدَ **في القاعدة** (الفارقُ يُحسب لا يُلتقط)", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    const boom = new Error("انفجارٌ مصطنعٌ بعد كتابة القيد وقبل تمام العملية")

    await expect(
      dailyLogSession(driver, MAIN, (store) => {
        store.transaction(() => {
          store.saveEntry({
            tenantId: MAIN,
            id: store.nextId("dle"),
            clientUuid: "c-boom",
            unitPath: KHALID_PATH,
            activityId: "lesson",
            freeTextAr: null,
            dayKey: "2026-07-20",
            periodKey: WEEK,
            count: 1,
            creditedCount: 1,
            points: 5,
            studentIds: [],
            creditedStudentIds: [],
            block: "none",
            byPersonId: "u-amir",
            at: NOW,
          })
          throw boom
        })
      }),
    ).rejects.toThrow(boom)

    // الذاكرةُ ارتدّت ⟵ صفرُ عبارةٍ ⟵ صفرُ أثرٍ دائم.
    expect(await rowsOf(driver, "daily_entries")).toHaveLength(0)
    driver.close()
  })

  it("وقيدٌ مرفوضٌ دلالياً (تاريخٌ مستقبليّ) لا يترك أثراً ولا يحرق معرّفاً عبر القاعدة", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    await dailyLogSession(driver, MAIN, (store) => {
      const denied = recordDailyEntry(store, dailyLogContext("u-amir"), {
        clientUuid: "c-future",
        unitId: KHALID,
        activityId: "lesson",
        count: 1,
        date: new Date("2027-01-01T00:00:00.000Z"),
      })
      expect(denied.ok).toBe(false)
    })
    // المعرّفُ التالي `dle-1` — الرفضُ لم يستهلك نبضةَ عدّاد.
    const entry = await dailyLogSession(driver, MAIN, (store) =>
      record(store, { clientUuid: "c-ok", activityId: "lesson" }),
    )
    expect(entry.id).toBe("dle-1")
    driver.close()
  })

  it("وحدةُ عملٍ خليطةٌ تُرمى — لا يُقذف سجلٌّ ومستودعٌ بلا مخطط", async () => {
    const driver = await freshDb()
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(persistentDailyLog(new DailyLogStore(MAIN)))
    uow.enlist({
      name: "مستودعٌ بلا مخطط",
      rowBudget: 10,
      tables: ["daily_attachments"],
      project: () => new Map(),
      load: () => undefined,
    })
    await expect(uow.hydrate()).rejects.toThrow(/daily_attachments/)
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٦ — تطابقُ البديلين ════════════════════════════════════

/** لقطةُ ما يراه **المنطق** — لا ما يدخل القاعدة: البديلان يجيبان الجوابَ نفسَه أو لا. */
type Observation = {
  readonly entries: readonly string[]
  readonly khalidPoints: number
  readonly roster: string
  readonly schemeForKhalid: string
}

function observe(store: DailyLogStore): Observation {
  return {
    entries: store
      .entries()
      .map(
        (e) =>
          `${e.id}|${e.unitPath}|${e.activityId ?? "—"}|${e.count}|${e.creditedCount}|${e.points}|${e.block}|[${e.studentIds.join(",")}]|[${e.creditedStudentIds.join(",")}]`,
      )
      .sort(),
    khalidPoints: periodPoints(store, KHALID_PATH, WEEK),
    roster: `${familyRosterOf(store, KHALID_PATH)?.studentCount ?? "unset"}`,
    schemeForKhalid: schemeForUnit(store, KHALID_PATH)?.id ?? "none",
  }
}

/** خطواتُ السيناريو — متزامنةٌ بحتة، تُشغَّل **حرفياً** على البديلين. */
const STEPS: readonly ((store: DailyLogStore) => void)[] = [
  (store) => {
    expect(record(store, { clientUuid: "c-lesson", activityId: "lesson", count: 1 }).id).toBe("dle-1")
  },
  (store) => {
    // ضبطُ العدد يفتح النشاطَ المشروط (ب-٣٢).
    expect(setFamilyRoster(store, dailyLogContext("u-amir"), { unitId: KHALID, studentCount: 10 }).ok).toBe(true)
  },
  (store) => {
    // جماعةٌ بحضورٍ كافٍ ⟵ نقطةٌ (maxPerDay=1، requiresParticipation).
    expect(record(store, { clientUuid: "c-jamaah", activityId: "jamaah", count: 1, attendees: 10 }).points).toBe(1)
  },
  (store) => {
    // نشاطٌ حرٌّ: توثيقٌ بلا نقاطٍ آلية (activityId=null).
    const free = record(store, { clientUuid: "c-free", freeTextAr: "تنظيفُ المسجد", count: 1 })
    expect(`${free.activityId}|${free.points}|${free.block}`).toBe("null|0|freeActivity")
  },
  (store) => {
    // مزامنةٌ ثانيةٌ بنفس البصمة ⟵ تحديثٌ لا مضاعفة.
    expect(record(store, { clientUuid: "c-lesson", activityId: "lesson", count: 3 }).count).toBe(3)
  },
]

describe("تطابقُ البديلين — سجلُّ اليوم في الذاكرة وعلى D1", () => {
  it("السيناريو نفسُه يعطي النتائج نفسَها على البديلين **خطوةً خطوة**", async () => {
    const memory = freshDailyLogStores(MAIN)
    seedDailyLogInto(memory.dailyLog)
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)

    for (const [index, step] of STEPS.entries()) {
      step(memory.dailyLog)
      const inMemory = observe(memory.dailyLog)
      const onD1 = await dailyLogSession(driver, MAIN, (store) => {
        step(store)
        return observe(store)
      })
      expect(`الخطوة ${index + 1}: ${JSON.stringify(onD1)}`).toBe(
        `الخطوة ${index + 1}: ${JSON.stringify(inMemory)}`,
      )
    }
    driver.close()
  })

  it("الحالةُ الدائمة تُقرأ بعد الجلسة كما تُركت — التحميلُ والإسقاطُ متعاكسان", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    for (const step of STEPS) await dailyLogSession(driver, MAIN, step)
    const first = await dailyLogSession(driver, MAIN, observe)
    const second = await dailyLogSession(driver, MAIN, observe)
    expect(second).toEqual(first)
    driver.close()
  })

  it("قراءةٌ بلا كتابة **لا تُنتج عبارةً واحدة** — فالتحميلُ لا يُلوّث جدولاً ملحقاً فقط", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    await dailyLogSession(driver, MAIN, (store) => record(store, { clientUuid: "c-1", activityId: "lesson" }))
    const before = await rowsOf(driver, "daily_entries")
    const statements = await statementsAfter(driver, MAIN, (store) => {
      void periodPoints(store, KHALID_PATH, WEEK)
    })
    expect(statements).toEqual([])
    expect(await rowsOf(driver, "daily_entries")).toEqual(before)
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٧ — الحتميّة والعدّاد عبر الجلسات ═════════════════════

describe("الحتميّة تنجو عبور القاعدة — العدّادُ يُستأنف ولا يعود صفراً", () => {
  it("المعرّفُ متتابعٌ عبر ثلاث جلسات — فلا يُدهس قيدٌ بقيد", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    // ثلاثةُ مفاتيحَ طبيعيةٍ مختلفة (وحداتٌ مختلفة) — فكلُّ قيدٍ جديدٌ لا تحديثٌ لسابقه.
    const plan = [
      { uuid: "a", unitId: KHALID, activityId: "lesson" },
      { uuid: "b", unitId: "bilal", activityId: "lesson" },
      { uuid: "c", unitId: NOUR, activityId: "dawah" },
    ]
    const ids: string[] = []
    for (const p of plan) {
      ids.push(
        (await dailyLogSession(driver, MAIN, (store) =>
          record(store, { clientUuid: p.uuid, unitId: p.unitId, activityId: p.activityId }),
        )).id,
      )
    }
    expect(ids).toEqual(["dle-1", "dle-2", "dle-3"])
    driver.close()
  })

  it("**والنطاقُ الجزئيُّ لا يُنقص العدّاد**: جلسةُ مسجدٍ لا تدهس معرّفَ جاره", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    await dailyLogSession(driver, MAIN, (store) => record(store, { clientUuid: "c-k", activityId: "lesson", unitId: KHALID }))
    // جلسةٌ لا ترى إلا مسجد بلال، ومع ذلك يُستأنف العدّادُ من المحفوظ.
    const second = await dailyLogSession(
      driver,
      MAIN,
      (store) => record(store, { clientUuid: "c-b", activityId: "lesson", unitId: "bilal" }),
      BILAL_PATH,
    )
    expect(second.id).toBe("dle-2")
    const rows = (await rowsOf(driver, "daily_entries")) as readonly Record<string, unknown>[]
    expect(rows.map((r) => String(r["id"])).sort()).toEqual(["dle-1", "dle-2"])
    driver.close()
  })

  it("ولا ساعةَ في المستودع: قاعدتان مستقلتان تُنتجان الصفوفَ نفسَها حرفياً", async () => {
    const runs: string[] = []
    for (let i = 0; i < 2; i += 1) {
      const driver = await freshDb()
      await seedDailyLogSession(driver, MAIN)
      await dailyLogSession(driver, MAIN, (store) => record(store, { clientUuid: "c-1", activityId: "lesson" }))
      runs.push(JSON.stringify(await rowsOf(driver, "daily_entries")))
      driver.close()
    }
    expect(runs[1]).toBe(runs[0])
  })
})

// ═══ الاختبار الإلزاميّ ٨ — ميزانيةُ التحميل (G23) ════════════════════════════

describe("ميزانيةُ التحميل — سجلُّ اليوم يُعلن سقفَه ويُقاس عليه (G23)", () => {
  it("سقفُ سجل اليوم موجبٌ ومُعلَنٌ في المصنع — لا مستودعَ بلا سقف", () => {
    const source = persistentDailyLog(new DailyLogStore(MAIN))
    expect(`${source.name}:${source.rowBudget > 0}`).toBe("dailyLog:true")
  })

  it("**وتجاوزُه رميةٌ تُسمّي الوحدةَ والجدولَ الأكبر** — لا «تجاوزٌ» مبهمة، وبزنادِ CR-026", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    await dailyLogSession(driver, MAIN, (store) => {
      record(store, { clientUuid: "c-1", activityId: "lesson" })
      record(store, { clientUuid: "c-2", activityId: "lesson", unitId: "bilal" })
    })
    const stores = freshDailyLogStores(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist({ ...persistentDailyLog(stores.dailyLog), rowBudget: 2 })
    await expect(uow.hydrate()).rejects.toThrow(/وحدةُ عمل «dailyLog»/)
    await expect(uow.hydrate()).rejects.toThrow(/CR-026/)
    driver.close()
  })
})

// ═══ حوافُّ الطبقة — دفاعاتٌ تُختبر لا تُفترض (السلبُ أكثرُ من الإيجاب) ═══════════

describe("حوافُّ مستودع سجل اليوم — والسلبُ أكثرُ من الإيجاب", () => {
  it("تحميلٌ من لا شيء لا يرمي ولا يخترع — قاعدةٌ فارغةٌ مستودعٌ فارغٌ وعدّادٌ من الصفر", () => {
    const store = new DailyLogStore(MAIN)
    persistentDailyLog(store).load(new Map())
    expect(store.entries()).toEqual([])
    expect(store.schemes()).toEqual([])
    expect(store.rosters()).toEqual([])
    expect(store.nextId("dle")).toBe("dle-1")
  })

  it("**القيمُ الفارغةُ تعبر القاعدةَ صريحةً**: نشاطٌ حرٌّ · عددٌ غيرُ مضبوط · سقفٌ بلا حدّ", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    await dailyLogSession(driver, MAIN, (store) => {
      record(store, { clientUuid: "c-free", freeTextAr: "توثيقٌ حرّ", count: 1 }) // activity_id=null
      setFamilyRoster(store, dailyLogContext("u-amir"), { unitId: KHALID, studentCount: null }) // student_count=null
    })
    const round = await dailyLogSession(driver, MAIN, (store) => ({
      free: store.entries().map((e) => `${e.activityId}|${e.freeTextAr}|${e.block}`),
      roster: familyRosterOf(store, KHALID_PATH)?.studentCount ?? "null",
      // `lesson` سقفُه null و`jamaah` سقفُه ١ — الفارغُ والمضبوطُ يعبران معاً.
      lessonCap: activityAt(store, "scheme-men", "lesson", NOW)?.maxPerDay ?? "null",
      jamaahCap: activityAt(store, "scheme-men", "jamaah", NOW)?.maxPerDay ?? "null",
    }))
    expect(round.free).toEqual(["null|توثيقٌ حرّ|freeActivity"])
    expect(round.roster).toBe("null")
    expect(round.lessonCap).toBe("null")
    expect(round.jamaahCap).toBe(1)
    driver.close()
  })

  it("**صفٌّ معطوبٌ في القاعدة يُرمى** — لا يُقرأ بـ`undefined` صامتة (المادة ٣/٣)", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    // قيدٌ حقلُ `points` فيه نصٌّ لا عدد — يُدسّ في القاعدة ثم يُحمَّل فيُرمى عند القراءة المتحقَّقة.
    await driver.batch([
      {
        sql:
          "INSERT INTO daily_entries (tenant_id, unit_path, id, client_uuid, activity_id, free_text_ar," +
          " day_key, period_key, count, credited_count, points, student_ids, credited_student_ids," +
          " block, by_person_id, at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        params: [
          MAIN, KHALID_PATH, "dle-9", "c-corrupt", "lesson", null,
          "2026-07-20", WEEK, 1, 1, "ليس-عدداً", "[]", "[]", "none", "u-amir", NOW.getTime(),
        ],
      },
    ])
    await expect(dailyLogSession(driver, MAIN, () => undefined)).rejects.toThrow(/points/)
    driver.close()
  })
})
