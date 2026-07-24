/**
 * **سجلُّ التدقيق الواحد** — `db/README.md` الحسم ٣ (نقطةُ اللاعودة الثانية) وقرارُ CR-027.
 *
 * السجلُّ **واحدٌ مركزيّ** لا سجلٌّ لكلِّ وحدة، ويحمل **النطاق صراحةً** لا اشتقاقاً.
 * وما يستحيل أن يُقال نطاقُه **مُعلنٌ ومحروسٌ بـ`toEqual`** — فلا ينمو صامتاً ولا ينكمش.
 *
 * **والأثرُ الذي جاءت من أجله CR-027**: قيدُ تدقيقٍ عن حدثٍ في مسجدٍ بعينه **يظهر في تدقيق
 * ذلك المسجد** — وهو ما كان ناقصاً، ومسؤولٌ يفتّش سجلَّ مسجده كان يرى صفحةً ناقصةً
 * **ولا يعلم أنها ناقصة**.
 */

import { describe, expect, it } from "vitest"
import { postJournal } from "../../src/features/ledger/services/journal.js"
import { postEventSafely } from "../../src/features/ledger/services/posting.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import type { Cents } from "../../src/features/ledger/types.js"
import { AUDIT_ACTIONS_WITHOUT_SCOPE } from "../../src/audit/journal.js"
import { MAIN, NOW, freshDb, seedSession, session } from "./_harness.js"

const c = (n: number): Cents => n as Cents
const CTX = { now: NOW, actorPersonId: "u-finance", settings: createSettingsResolver([]) }

function donation(sourceId: string): Parameters<typeof postJournal>[2] {
  return {
    at: NOW,
    unitId: "m1",
    memoAr: "تبرعٌ نقديّ",
    sourceType: "donation" as const,
    sourceId,
    lines: [
      { accountId: "cash", unitId: "m1", currency: "USD", side: "debit" as const, amount: c(500) },
      {
        accountId: "revenue.donations",
        unitId: "m1",
        currency: "USD",
        side: "credit" as const,
        amount: c(500),
      },
    ],
  }
}

type AuditRow = {
  source: string
  action: string
  unit_path: string
  scope_exact: number
  seq: number
  capability: string | null
  target_type: string | null
}

async function auditRows(driver: Awaited<ReturnType<typeof freshDb>>): Promise<readonly AuditRow[]> {
  return (await driver.all({
    sql:
      "SELECT source, action, unit_path, scope_exact, seq, capability, target_type " +
      "FROM audit_log ORDER BY seq",
    params: [],
  })) as unknown as readonly AuditRow[]
}

describe("سجلُّ التدقيق — **واحدٌ موحَّد** لا سجلٌّ لكلِّ وحدة (CR-027)", () => {
  it("قيدُ الشجرة وقيدُ الدفتر يسكنان **سجلاً واحداً بتسلسلٍ واحد** — لا مصدرَين", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ org, ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1")).ok).toBe(true)
      org.audit.append({
        at: NOW,
        actorPersonId: "u-admin",
        action: "users.provision",
        capability: "user.manage",
        unitPath: "/men/r1/m1/",
        targetType: "account",
        targetId: "p-1",
        reason: null,
        // **تصريحٌ إلزاميّ** (CR-028): قيدُ اختبارٍ لا كيانَ مخزَّناً وراءه —
        // فـ«لا لقطةَ تنطبق» **تُقال بقيمةٍ معلنة** ولا يُسكَت عنها.
        before: null,
        after: null,
      })
    })
    const rows = await auditRows(driver)
    // **مصدرٌ واحد**: العمودُ بقي ضلعاً في المفتاح الطبيعيّ، والتصنيفُ في `action` لا يُكرَّر.
    expect(new Set(rows.map((r) => r.source))).toEqual(new Set(["audit"]))
    expect(rows.map((r) => `${r.seq}:${r.action}`)).toEqual(["1:ledger.post", "2:users.provision"])
    driver.close()
  })

  it("**النطاقُ يُقال ولا يُشتقّ**: قيدُ تدقيق الدفتر يحمل وحدةَ حدثه", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1")).ok).toBe(true)
    })
    const posted = (await auditRows(driver)).find((r) => r.action === "ledger.post")!
    expect(posted.unit_path).toBe("/men/r1/m1/")
    expect(posted.scope_exact).toBe(1)
    // ونوعُ الهدف صار مذكوراً — كان `NULL` قبل التوحيد (جدولُ CR-027 §١).
    expect(posted.target_type).toBe("journalEntry")
    driver.close()
  })

  it("**حدثٌ في مسجدٍ يظهر في تدقيق ذلك المسجد** — وهو ما جاءت له CR-027", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ org, ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1")).ok).toBe(true)
      org.audit.append({
        at: NOW,
        actorPersonId: "u-admin",
        action: "registration.approve",
        capability: "registration.approve",
        unitPath: "/men/r1/m2/",
        targetType: "account",
        targetId: "p-9",
        reason: null,
        // **تصريحٌ إلزاميّ** (CR-028): قيدُ اختبارٍ لا كيانَ مخزَّناً وراءه —
        // فـ«لا لقطةَ تنطبق» **تُقال بقيمةٍ معلنة** ولا يُسكَت عنها.
        before: null,
        after: null,
      })

      // تدقيقُ المسجد الأول يرى حدثَه **وحدَه** — لا حدثَ جاره.
      expect(ledger.audit.listInScope("/men/r1/m1/", 50).map((e) => e.action)).toEqual([
        "ledger.post",
      ])
      // وتدقيقُ المسجد الثاني يرى حدثَه هو.
      expect(org.audit.listInScope("/men/r1/m2/", 50).map((e) => e.action)).toEqual([
        "registration.approve",
      ])
      // والمنطقةُ فوقهما ترى الاثنين **بالاحتواء** لا بالمصادفة.
      expect(org.audit.listInScope("/men/r1/", 50)).toHaveLength(2)
    })
    driver.close()
  })

  it("والقراءةُ بالنطاق تصمد **بعد عبور القاعدة** لا في الذاكرة فقط", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1")).ok).toBe(true)
    })
    await session(driver, MAIN, ({ audit }) => {
      expect(audit.listInScope("/men/r1/m1/", 50).map((e) => e.action)).toEqual(["ledger.post"])
      expect(audit.listInScope("/men/r1/m2/", 50)).toEqual([])
    })
    driver.close()
  })

  it("ما لا يُقال نطاقُه يُوجَّه إلى جذر الشبكة **موسوماً** لا مُموَّهاً", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      const failed = postEventSafely(ledger, CTX, {
        sourceType: "donation",
        sourceId: "d-معطوب",
        at: NOW,
        unitId: "لا-وجود-لها",
        memoAr: "وحدةٌ مجهولة",
        lines: donation("d-معطوب").lines,
      })
      expect(failed.posted).toBe(false)
    })
    const rows = await auditRows(driver)
    expect(rows.map((r) => `${r.action}|${r.unit_path}|${r.scope_exact}`)).toEqual([
      "ledger.post.failed|/|0",
    ])
    driver.close()
  })
})

describe("حَجْرُ الأفعال التي لا يُقال نطاقُها — لا ينمو ولا ينكمش صامتاً", () => {
  it("القائمةُ المعلنة تطابق ما يقع فعلاً — `toEqual` لا `toContain`", () => {
    expect([...AUDIT_ACTIONS_WITHOUT_SCOPE]).toEqual(["ledger.post.failed"])
  })

  it("كلُّ فعلٍ في القائمة **يعجز فعلاً** عن قول نطاقه — فلا يبقى فيها ميت", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(
        postEventSafely(ledger, CTX, {
          sourceType: "donation",
          sourceId: "d-معطوب",
          at: NOW,
          unitId: "لا-وجود-لها",
          memoAr: "وحدةٌ مجهولة",
          lines: donation("d-معطوب").lines,
        }).posted,
      ).toBe(false)
    })
    const inexact = (await auditRows(driver)).filter((r) => r.scope_exact === 0)
    expect(inexact.map((r) => r.action)).toEqual([...AUDIT_ACTIONS_WITHOUT_SCOPE])
    driver.close()
  })

  it("فعلٌ خارج القائمة يُوجَّه إلى الجذر ⟵ **يُرمى** ولا يمرّ صامتاً", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await expect(
      session(driver, MAIN, ({ ledger }) => {
        ledger.audit.append({
          at: NOW,
          actorPersonId: "u-finance",
          action: "ledger.فعلٌ-مستحدث",
          unitPath: "/",
          capability: null,
          targetType: "مجهول",
          targetId: "هدفٌ-لا-يُعرف",
          reason: null,
          // **تصريحٌ إلزاميّ** (CR-028): قيدُ اختبارٍ لا كيانَ مخزَّناً وراءه —
          // فـ«لا لقطةَ تنطبق» **تُقال بقيمةٍ معلنة** ولا يُسكَت عنها.
          before: null,
          after: null,
        })
      }),
    ).rejects.toThrow(/ledger\.فعلٌ-مستحدث/)
    driver.close()
  })

  it("ومسارٌ مخالفٌ لثابت التمثيل يُرمى — لا يُقبل «نطاقٌ» ليس نطاقاً (§١.٥)", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await expect(
      session(driver, MAIN, ({ ledger }) => {
        ledger.audit.append({
          at: NOW,
          actorPersonId: "u-finance",
          action: "ledger.post",
          unitPath: "men/r1",
          capability: null,
          targetType: "journalEntry",
          targetId: "je-1",
          reason: null,
          // **تصريحٌ إلزاميّ** (CR-028): قيدُ اختبارٍ لا كيانَ مخزَّناً وراءه —
          // فـ«لا لقطةَ تنطبق» **تُقال بقيمةٍ معلنة** ولا يُسكَت عنها.
          before: null,
          after: null,
        })
      }),
    ).rejects.toThrow(/ثابت التمثيل/)
    driver.close()
  })
})

describe("التسلسلُ ملكُ السجلّ — والنطاقُ الجزئيُّ لا يدهس ما لم يره", () => {
  it("قيدٌ جديدٌ في نطاقٍ ضيّق **لا يكتب فوق** قيدِ وحدةٍ خارجه", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ org }) => {
      for (const [unit, target] of [
        ["/men/r1/m1/", "p-1"],
        ["/men/r1/m2/", "p-2"],
      ]) {
        org.audit.append({
          at: NOW,
          actorPersonId: "u-admin",
          action: "users.provision",
          capability: "user.manage",
          unitPath: unit!,
          targetType: "account",
          targetId: target!,
          reason: null,
          // **تصريحٌ إلزاميّ** (CR-028): قيدُ اختبارٍ لا كيانَ مخزَّناً وراءه —
          // فـ«لا لقطةَ تنطبق» **تُقال بقيمةٍ معلنة** ولا يُسكَت عنها.
          before: null,
          after: null,
        })
      }
    })

    // جلسةٌ **لا ترى إلا المسجد الأول** ثم تُلحق قيداً جديداً فيه.
    await session(
      driver,
      MAIN,
      ({ org }) => {
        expect(org.audit.all().map((e) => e.targetId)).toEqual(["p-1"])
        org.audit.append({
          at: NOW,
          actorPersonId: "u-admin",
          action: "users.provision",
          capability: "user.manage",
          unitPath: "/men/r1/m1/",
          targetType: "account",
          targetId: "p-3",
          reason: null,
          // **تصريحٌ إلزاميّ** (CR-028): قيدُ اختبارٍ لا كيانَ مخزَّناً وراءه —
          // فـ«لا لقطةَ تنطبق» **تُقال بقيمةٍ معلنة** ولا يُسكَت عنها.
          before: null,
          after: null,
        })
      },
      "/men/r1/m1/",
    )

    // **قيدُ المسجد الثاني باقٍ**: التسلسلُ استُؤنف من المحفوظ لا من موضع القائمة.
    const rows = await auditRows(driver)
    expect(rows.map((r) => `${r.seq}:${r.unit_path}`)).toEqual([
      "1:/men/r1/m1/",
      "2:/men/r1/m2/",
      "3:/men/r1/m1/",
    ])
    driver.close()
  })
})

describe("التدرّجُ بالعمر — مصمَّمٌ اليوم وغيرُ مبنيٍّ اليوم", () => {
  it("سجلُّ التدقيق مفهرسٌ على (شبكة، وقت) — فترحيلُ القديم مسحُ مدىً لا مسحٌ كامل", async () => {
    const driver = await freshDb()
    const indexes = await driver.all({ sql: "PRAGMA index_list(audit_log)", params: [] })
    const sets: string[] = []
    for (const index of indexes) {
      const info = await driver.all({
        sql: `PRAGMA index_info(${String(index["name"])})`,
        params: [],
      })
      sets.push(info.map((c2) => String(c2["name"])).join(","))
    }
    expect(sets).toContain("tenant_id,at")
    driver.close()
  })

  it("لا مفتاحَ أجنبيّاً يشير إلى سجلّ التدقيق — فحذفُ المؤرشَف لا يكسر شيئاً", async () => {
    const driver = await freshDb()
    const tables = await driver.all({
      sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      params: [],
    })
    for (const table of tables) {
      const keys = await driver.all({
        sql: `PRAGMA foreign_key_list(${String(table["name"])})`,
        params: [],
      })
      expect(keys.map((k) => String(k["table"]))).not.toContain("audit_log")
    }
    driver.close()
  })

  it("حمولةُ `before/after` نصٌّ لا مزيةُ محرّك (ع-٣)", async () => {
    const driver = await freshDb()
    const columns = await driver.all({ sql: "PRAGMA table_info(audit_log)", params: [] })
    for (const name of ["before", "after"]) {
      const column = columns.find((c2) => String(c2["name"]) === name)!
      expect(`${name}:${String(column["type"])}`).toBe(`${name}:TEXT`)
    }
    driver.close()
  })
})

describe("لا سجلَّ محليّاً بعد اليوم — الجذرُ لا العَرَض (المادة ١/٢)", () => {
  it("`AuditRecord` المحليُّ لم يعد له وجودٌ في وحدتَي الريادة", async () => {
    const { readFileSync } = await import("node:fs")
    const { dirname, join } = await import("node:path")
    const { fileURLToPath } = await import("node:url")
    const src = join(dirname(fileURLToPath(import.meta.url)), "../../src")
    for (const unit of ["ledger", "org"]) {
      const store = readFileSync(join(src, `features/${unit}/data/store.ts`), "utf8")
      expect(`${unit}:${/type AuditRecord/.test(store)}`).toBe(`${unit}:false`)
      expect(`${unit}:${/auditList|audit:\s*AuditRecord/.test(store)}`).toBe(`${unit}:false`)
    }
  })
})
