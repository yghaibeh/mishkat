/**
 * حدودُ طبقة البيانات: المنفذُ (SQL) والترميزُ ووحدةُ العمل — **بتوكيداتٍ سالبةٍ غالبة**.
 *
 * وأخصُّ ما هنا **عقدُ محرّك D1**: هو الوحيدُ الذي يعمل في الإنتاج، ولا تجري عليه اختباراتُ
 * التكامل (لا مِقبض D1 في CI) — فيُختبر **شكلُ نداءاته** ضد بديلٍ مزيَّف. بوابةٌ لا تُثبت
 * حراسةَ ما يعمل في الإنتاج وهمُ أمان (المادة ٠).
 */

import { describe, expect, it } from "vitest"
import { d1Driver, type D1Like } from "../../src/db/sql/d1Driver.js"
import { openSqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import {
  readBoolean,
  readDate,
  readDateOrNull,
  readInt,
  readIntOrNull,
  readText,
  readTextOrNull,
} from "../../src/db/encode.js"
import { diffStatements, naturalKey, primaryKeyOf } from "../../src/db/unitOfWork.js"
import { hasTable, tableSpec } from "../../src/db/schema.js"
import type { SqlRow, SqlStatement } from "../../src/db/sql/driver.js"
import { MAIN, freshDb, seedSession, session } from "./_harness.js"
import { OrgStore } from "../../src/features/org/data/store.js"

/** بديلٌ مزيَّف لـD1 يسجّل ما نُودي به — يقيس **شكل النداء** لا نتيجتَه. */
function fakeD1(): { db: D1Like; calls: string[]; batched: number[] } {
  const calls: string[] = []
  const batched: number[] = []
  const make = (sql: string): ReturnType<D1Like["prepare"]> => {
    const statement = {
      bind: (...values: (string | number | null)[]) => {
        calls.push(`${sql}|${values.join(",")}`)
        return statement
      },
      all: <T>() => Promise.resolve({ results: [] as T[] }),
    }
    return statement
  }
  return {
    db: {
      prepare: make,
      batch: (statements) => {
        batched.push(statements.length)
        return Promise.resolve([])
      },
      exec: (sql) => {
        calls.push(`exec|${sql}`)
        return Promise.resolve([])
      },
    },
    calls,
    batched,
  }
}

describe("عقدُ محرّك D1 — الوحيدُ الذي يعمل في الإنتاج", () => {
  it("الاستعلامُ يمرّ بمعاملاتٍ **مربوطة** لا بسلسلةٍ مبنيّة (المادة ٨/٢)", async () => {
    const fake = fakeD1()
    await d1Driver(fake.db).all({ sql: "SELECT ? FROM t", params: ["t-main"] })
    expect(fake.calls).toEqual(["SELECT ? FROM t|t-main"])
  })

  it("الدفعةُ تُنادى **مرةً واحدة** بكلِّ العبارات — لا نداءَ لكلِّ عبارة", async () => {
    const fake = fakeD1()
    const statements: SqlStatement[] = [
      { sql: "INSERT INTO a VALUES (?)", params: [1] },
      { sql: "INSERT INTO b VALUES (?)", params: [2] },
    ]
    await d1Driver(fake.db).batch(statements)
    expect(fake.batched).toEqual([2])
  })

  it("دفعةٌ فارغة **لا تُنادي** القاعدة أصلاً — فلا رحلةَ شبكةٍ بلا عمل", async () => {
    const fake = fakeD1()
    await d1Driver(fake.db).batch([])
    expect(fake.batched).toEqual([])
    expect(fake.calls).toEqual([])
  })

  it("الهجرةُ تمرّ بـ`exec` لا بالدفعة — عباراتٌ متعددةٌ بلا معاملات", async () => {
    const fake = fakeD1()
    await d1Driver(fake.db).exec("CREATE TABLE t (id TEXT)")
    expect(fake.calls).toEqual(["exec|CREATE TABLE t (id TEXT)"])
  })
})

describe("الترميز — لا قراءةَ صامتة", () => {
  const row: SqlRow = { text: "قيمة", number: 7, empty: null }

  it("عمودٌ مفقود **يُرمى** ولا يُقرأ `undefined`", () => {
    expect(() => readText(row, "غائب")).toThrow(/عمودٌ مفقود/)
  })

  it("نوعٌ مخالف **يُرمى**: عددٌ مكان نصّ ونصٌّ مكان عدد", () => {
    expect(() => readText(row, "number")).toThrow(/ليس نصّاً/)
    expect(() => readInt(row, "text")).toThrow(/ليس عدداً/)
    expect(() => readTextOrNull(row, "number")).toThrow(/ليس نصّاً ولا فارغاً/)
    expect(() => readIntOrNull(row, "text")).toThrow(/ليس عدداً ولا فارغاً/)
  })

  it("الفارغُ يُقرأ فارغاً، والقيمُ تعبر كما هي", () => {
    expect(readTextOrNull(row, "empty")).toBeNull()
    expect(readIntOrNull(row, "empty")).toBeNull()
    expect(readDateOrNull(row, "empty")).toBeNull()
    expect(readText(row, "text")).toBe("قيمة")
    expect(readInt(row, "number")).toBe(7)
    expect(readBoolean({ flag: 1 }, "flag")).toBe(true)
    expect(readBoolean({ flag: 0 }, "flag")).toBe(false)
    expect(readDate({ at: 1_700_000_000_000 }, "at").getTime()).toBe(1_700_000_000_000)
  })
})

describe("المخطط ووحدةُ العمل", () => {
  it("جدولٌ بلا مخطط **يُرمى** — لا يُقذف ما لا مخططَ له", () => {
    expect(hasTable("box_handovers")).toBe(false)
    expect(() => tableSpec("box_handovers")).toThrow(/جدولٌ بلا مخطط/)
  })

  it("المفتاحُ الطبيعيّ يُركَّب بترتيب إعلانه لا بترتيب الصفّ", () => {
    const spec = tableSpec("audit_log")
    const key = primaryKeyOf(spec, { seq: 3, source: "ledger", tenant_id: MAIN })
    expect(key).toBe(naturalKey(MAIN, "ledger", 3))
    // والفاصلُ لا يظهر في معرّفٍ ولا مسار — فلا يلتبس مفتاحان مركّبان.
    expect(key.includes(" ")).toBe(false)
  })

  it("الفارقُ: صفٌّ لم يتغيّر **لا يُنتج عبارة**", () => {
    const spec = tableSpec("org_units")
    const row: SqlRow = { tenant_id: MAIN, unit_path: "/men/", id: "men" }
    const before = new Map([["k", row]])
    const after = new Map([["k", { ...row }]])
    expect(diffStatements(spec, before, after)).toEqual([])
  })

  it("الفارقُ: صفٌّ تغيّر يُنتج **إدراجاً بمفتاحٍ طبيعيّ** لا تحديثاً أعمى (ع-٤)", () => {
    const spec = tableSpec("org_units")
    const before = new Map([["k", { tenant_id: MAIN, unit_path: "/men/", id: "men" } as SqlRow]])
    const after = new Map([["k", { tenant_id: MAIN, unit_path: "/men/", id: "men2" } as SqlRow]])
    const [statement] = diffStatements(spec, before, after)
    expect(statement!.sql).toContain("ON CONFLICT (tenant_id, id) DO UPDATE")
  })

  it("الفارقُ: صفٌّ اختفى من جدولٍ يقبل المحو يُنتج حذفاً بمفتاحه", () => {
    const spec = tableSpec("active_posting_keys")
    const before = new Map([
      ["k", { tenant_id: MAIN, unit_path: "/men/", posting_key: "donation:d-1" } as SqlRow],
    ])
    const [statement] = diffStatements(spec, before, new Map())
    expect(statement!.sql).toContain("DELETE FROM active_posting_keys")
  })

  it("مستودعٌ لم يُحمَّل لا تُحسب عباراتُه — رميةٌ لا لقطةٌ فارغة", async () => {
    const driver = await freshDb()
    const { UnitOfWork } = await import("../../src/db/unitOfWork.js")
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    expect(() => uow.statementsFor("مجهول", new Map())).toThrow(/لم يُحمَّل/)
    driver.close()
  })

  it("مسارٌ فيه محرفُ بدلٍ لا يوسّع النطاق — `LIKE` مُهرَّبة", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ org }) => {
      org.saveUnit({
        tenantId: MAIN,
        id: "m_x",
        type: "mosque" as never,
        labelAr: "مسجدٌ باسمٍ فيه شرطةٌ سفلية",
        parentId: "r1",
        path: "/men/r1/m_x/",
        section: "men",
        archived: false,
      })
    })
    await session(
      driver,
      MAIN,
      ({ org }) => {
        // `_` محرفُ بدلٍ في `LIKE`: بلا تهريبٍ كان `/men/r1/m_x/` سيبتلع `/men/r1/m1/`.
        expect([...org.units.values()].map((u) => u.id)).toEqual(["m_x"])
      },
      "/men/r1/m_x/",
    )
    driver.close()
  })
})

describe("مستودعُ الشجرة على القاعدة", () => {
  it("الحسابُ والإسنادُ والطلبُ تعبر القاعدةَ وتعود كما هي", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ org }) => {
      org.saveAccount({
        tenantId: MAIN,
        personId: "p-1",
        username: "amir.m1",
        status: "active",
        sessionEpoch: 1,
      })
      org.addAssignment({
        tenantId: MAIN,
        id: "a-2",
        personId: "p-1",
        roleId: "amir" as never,
        unitId: "m1",
        scopePath: "/men/r1/m1/",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: null,
        approvalStatus: "approved",
      })
      org.saveRequest({
        tenantId: MAIN,
        id: "req-3",
        personId: "p-4",
        username: "talib",
        requestedRoleId: "student" as never,
        requestedUnitId: "m2",
        status: "pending",
        origin: "public",
      })
    })
    await session(driver, MAIN, ({ org }) => {
      expect(org.getAccount("p-1")!.username).toBe("amir.m1")
      expect(org.hasUsername("amir.m1")).toBe(true)
      expect(org.assignmentsForPerson("p-1")).toHaveLength(1)
      expect(org.getRequest("req-3")!.requestedUnitId).toBe("m2")
      // العدّادُ يعبر: المعرّفُ التالي بعد `req-3`/`p-4` هو الخامس لا الأول.
      expect(org.nextId("a")).toBe("a-5")
    })
    driver.close()
  })

  it("إنهاءُ إسنادٍ بكتابةٍ **مباشرةٍ في الحقل** يعبر القاعدة — فالفارقُ يُحسب لا يُلتقط", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ org }) => {
      org.addAssignment({
        tenantId: MAIN,
        id: "a-1",
        personId: "p-2",
        roleId: "amir" as never,
        unitId: "m1",
        scopePath: "/men/r1/m1/",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: null,
        approvalStatus: "approved",
      })
    })
    await session(driver, MAIN, ({ org }) => {
      const current = org.assignments[0]!
      // نظيرُ `services/assignments.ts:20` حرفياً: إسنادٌ في المكان بلا نداءِ دالّة.
      org.assignments[0] = { ...current, endDate: new Date("2026-06-01T00:00:00.000Z") }
    })
    await session(driver, MAIN, ({ org }) => {
      expect(org.assignments[0]!.endDate?.toISOString()).toBe("2026-06-01T00:00:00.000Z")
    })
    driver.close()
  })

  it("طلبٌ يشير إلى وحدةٍ مجهولة **يُرمى** — لا مفتاحَ توجيهٍ يُخترع", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await expect(
      session(driver, MAIN, ({ org }: { org: OrgStore }) => {
        org.saveRequest({
          tenantId: MAIN,
          id: "req-1",
          personId: "p-2",
          username: "غريب",
          requestedRoleId: "student" as never,
          requestedUnitId: "لا-وجود-لها",
          status: "pending",
          origin: "public",
        })
      }),
    ).rejects.toThrow(/مفتاحُ توجيهٍ لا يُشتقّ/)
    driver.close()
  })

  it("قاعدةٌ بلا هجرةٍ تُرمى عند القراءة — لا قراءةَ من العدم", async () => {
    const driver = openSqliteDriver()
    await expect(driver.all({ sql: "SELECT * FROM org_units", params: [] })).rejects.toThrow()
    driver.close()
  })
})

describe("الاعتمادُ الثنائيّ يعبر القاعدة — حمولةٌ مجمَّدةٌ تعود كما جُمِّدت (ق-٥٣)", () => {
  it("الفعلُ المعلَّق وحمولتُه وتاريخُها تعود من القاعدة بلا انحراف", async () => {
    const { proposeAction } = await import("../../src/features/ledger/services/dualControl.js")
    const { createSettingsResolver } = await import("../../src/settings/resolver.js")
    const at = new Date("2026-07-19T00:00:00.000Z")
    const ctx = { now: at, actorPersonId: "u-finance", settings: createSettingsResolver([]) }
    const driver = await freshDb()
    await seedSession(driver, MAIN)

    const proposedId = await session(driver, MAIN, ({ ledger }) => {
      const proposed = proposeAction(ledger, ctx, {
        unitId: "m1",
        requestedBy: "u-finance",
        payload: {
          kind: "journal.manual",
          entry: {
            at,
            unitId: "m1",
            memoAr: "قيدٌ يدويٌّ ينتظر البتّ",
            sourceType: "manualJournal",
            sourceId: "mj-1",
            lines: [],
          },
        },
      })
      expect(proposed.ok).toBe(true)
      return proposed.ok ? proposed.value.id : "لا"
    })

    await session(driver, MAIN, ({ ledger }) => {
      const action = ledger.getAction(proposedId)!
      expect(action.status).toBe("pending")
      expect(action.unitPath).toBe("/men/r1/m1/")
      expect(action.payload.kind).toBe("journal.manual")
      if (action.payload.kind === "journal.manual") {
        // التاريخُ عبر JSON نصّاً ويعود **تاريخاً** — لا نصٌّ يتسلّل مكانه.
        expect(action.payload.entry.at).toBeInstanceOf(Date)
        expect(action.payload.entry.at.toISOString()).toBe(at.toISOString())
      }
      // ونطاقُ قيد تدقيقه اشتُقّ من الفعل نفسِه لا من الجذر.
      expect(ledger.audit.all().map((a) => a.action)).toEqual(["ledger.action.propose"])
    })

    const rows = await driver.all({
      sql: "SELECT unit_path, scope_exact FROM audit_log",
      params: [],
    })
    expect(rows.map((r) => `${String(r["unit_path"])}|${Number(r["scope_exact"])}`)).toEqual([
      "/men/r1/m1/|1",
    ])
    driver.close()
  })

  it("سجلُّ الشجرة يعود من القاعدة بترتيبه ونطاقه", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ org }) => {
      for (const target of ["p-1", "p-2"]) {
        org.audit.append({
          at: new Date("2026-07-19T00:00:00.000Z"),
          actorPersonId: "u-admin",
          action: "users.provision",
          capability: "user.manage",
          unitPath: "/men/r1/m1/",
          targetType: "account",
          targetId: target,
          reason: null,
          // **تصريحٌ إلزاميّ** (CR-028): قيدُ اختبارٍ لا كيانَ مخزَّناً وراءه —
          // فـ«لا لقطةَ تنطبق» **تُقال بقيمةٍ معلنة** ولا يُسكَت عنها.
          before: null,
          after: null,
        })
      }
    })
    await session(driver, MAIN, ({ org }) => {
      expect(org.audit.all().map((a) => a.targetId)).toEqual(["p-1", "p-2"])
      expect(org.audit.all()[0]!.unitPath).toBe("/men/r1/m1/")
    })
    driver.close()
  })
})

describe("حوافُّ الطبقة — دفاعاتٌ تُختبر لا تُفترض", () => {
  it("لاحقةُ العدّاد: معرّفٌ ليس من العدّاد **لا يرفعه** (معرّفاتُ الوحدات مقاطعُ مسار — ت-٢)", async () => {
    const { suffixOf } = await import("../../src/db/repositories/shared.js")
    expect(suffixOf("je-7")).toBe(7)
    expect(suffixOf("m1")).toBe(0)
    expect(suffixOf("u-finance")).toBe(0)
    expect(suffixOf("/men/r1/")).toBe(0)
  })

  it("جدولٌ كلُّ أعمدته مفتاحٌ طبيعيّ يُدرَج بلا تحديثٍ أعمى", () => {
    const spec = {
      name: "sequences",
      columns: [
        { name: "tenant_id", type: "text" as const, nullable: false },
        { name: "name", type: "text" as const, nullable: false },
      ],
      primaryKey: ["tenant_id", "name"],
      appendOnly: false,
      infrastructure: false,
    }
    const after = new Map([["k", { tenant_id: MAIN, name: "org.seq" } as SqlRow]])
    const [statement] = diffStatements(spec, new Map(), after)
    expect(statement!.sql).toContain("DO NOTHING")
  })

  it("صفٌّ اختلف عددُ أعمدته يُعدّ مختلفاً — فلا يمرّ تغييرُ شكلٍ صامتاً", () => {
    const spec = tableSpec("sequences")
    const before = new Map([["k", { tenant_id: MAIN, name: "org.seq" } as SqlRow]])
    const after = new Map([
      ["k", { tenant_id: MAIN, unit_path: "/", name: "org.seq", value: 3 } as SqlRow],
    ])
    expect(diffStatements(spec, before, after)).toHaveLength(1)
  })

  it("ساعةُ الهجرة **تُحقن** — فلا زمنَ تشغيلٍ داخل الطبقة (TESTING_POLICY §٥)", async () => {
    const { applyMigrations } = await import("../../src/db/migrations/runner.js")
    const { shippedMigrations } = await import("./_harness.js")
    const driver = openSqliteDriver()
    await applyMigrations(driver, shippedMigrations(), () => 1_700_000_000_000)
    const rows = await driver.all({ sql: "SELECT applied_at FROM _migrations", params: [] })
    expect(new Set(rows.map((r) => Number(r["applied_at"])))).toEqual(new Set([1_700_000_000_000]))
    expect(rows).toHaveLength(shippedMigrations().length)
    driver.close()
  })

  it("قيدُ تدقيقٍ بلا قدرةٍ مخزَّنة يُحمَّل بقدرةٍ فارغةٍ صريحة لا بـ`undefined`", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await driver.batch([
      {
        sql:
          "INSERT INTO audit_log (tenant_id, unit_path, source, seq, at, actor_person_id, action," +
          " capability, target_type, target_id, reason, scope_exact, actor_roles_at_time," +
          " impersonated_by, decision, reason_code, request_id, before, after)" +
          " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        params: [
          MAIN, "/men/r1/m1/", "audit", 1, 1_752_000_000_000, "u-admin", "legacy.action",
          null, null, "p-9", null, 1, null, null, null, null, null, null, null,
        ],
      },
    ])
    await session(driver, MAIN, ({ org }) => {
      // القدرةُ تعود **`null` صريحاً** لا نصّاً فارغاً: العقدُ يقول «لا قدرةَ مسجَّلة»،
      // والنصُّ الفارغ كان يُخفي الفرقَ بين «لا قدرة» و«قدرةٌ اسمُها فراغ».
      expect(org.audit.all()).toHaveLength(1)
      expect(org.audit.all()[0]!.capability).toBeNull()
      expect(org.audit.all()[0]!.targetType).toBe("")
    })
    driver.close()
  })
})

describe("حارسُ انحراف العدّاد — القاعدةُ لا تُقرأ على عمياء", () => {
  it("قيدٌ بمعرّفٍ ليس من عدّاد الدفتر **يُرمى** عند التحميل", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await driver.batch([
      {
        sql:
          "INSERT INTO journal_entries (tenant_id, unit_path, id, voucher_no, voucher_seq, at," +
          " memo_ar, source_type, source_id, posting_key, reversal_of, reversed_by, reason_ar, posted_by)" +
          " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        params: [
          MAIN, "/men/r1/m1/", "zz-1", "R-0001", 1, 1_752_000_000_000, "قيدٌ بمعرّفٍ دخيل",
          "donation", "d-1", null, null, null, null, "u-finance",
        ],
      },
    ])
    await expect(session(driver, MAIN, () => undefined)).rejects.toThrow(/انحرافُ عدّاد/)
    driver.close()
  })

  it("فعلٌ معلَّقٌ بمعرّفٍ ليس من العدّاد **يُرمى** كذلك", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await driver.batch([
      {
        sql:
          "INSERT INTO finance_actions (tenant_id, unit_path, id, kind, payload, requested_by," +
          " requested_at, status, decided_by, decided_at, reason_ar, result_entry_id, failure_code)" +
          " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        params: [
          MAIN, "/men/r1/m1/", "xx-1", "journal.reverse",
          JSON.stringify({ kind: "journal.reverse", entryId: "je-1", reasonAr: "سبب" }),
          "u-finance", 1_752_000_000_000, "pending", null, null, null, null, null,
        ],
      },
    ])
    await expect(session(driver, MAIN, () => undefined)).rejects.toThrow(/انحرافُ عدّاد/)
    driver.close()
  })

  it("دفترُ الهجرات يُقرأ بأسمائه — وقراءتُه على قاعدةٍ بكرٍ تُنشئه ولا ترمي", async () => {
    const { appliedMigrations } = await import("../../src/db/migrations/runner.js")
    const { shippedMigrations } = await import("./_harness.js")
    const bare = openSqliteDriver()
    expect(await appliedMigrations(bare)).toEqual([])
    bare.close()
    const driver = await freshDb()
    // القائمةُ **مشتقّةٌ من المجلد المشحون** لا مسرودة — فهجرةٌ جديدة لا تحتاج تحريرَ اختبار.
    expect(await appliedMigrations(driver)).toEqual(shippedMigrations().map((m) => m.name))
    expect(await appliedMigrations(driver)).toContain("0001_org_ledger_pilot.sql")
    driver.close()
  })
})
