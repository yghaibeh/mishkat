/**
 * **استمرارُ العُهد على D1** — T26-ب-١ (الاختبارات الإلزامية ١…٩).
 *
 * وحدةُ العُهد أوّلُ المنقولات بعد وحدتَي الريادة، واختيرت لأنها **الوحيدةُ التي كانت تحمل
 * سجلَّ تدقيقٍ محلياً** (`CustodyAuditRecord`) — فهي التي تُظهر بند CR-027 كاملاً.
 *
 * وثوابتُها الأربعةُ تُقاس هنا **على المستودع الحقيقيّ** لا على الذاكرة:
 *  · **ق-٧٨/ق-٨٠ لا محو** — واختفاءُ صفٍّ يُرمى ولا يُترجم `DELETE`؛ وانتقالُ الحالة **تحديثٌ**.
 *  · **ق-٧٩ الإقرارُ بيد المستلِم وحده** — بعد عبور القاعدة لا في الذاكرة.
 *  · **ق-٨١ عزلُ النطاق** — شبكةً ونطاقاً، والشبكتان بنفس المسارات النسبيّة عمداً.
 *  · **ق-٨٣ التدقيقُ دائماً** — بنطاقه الصريح وبـقبل/بعد، ويظهر في تدقيق نطاقه.
 */

import { describe, expect, it } from "vitest"
import { AUDIT_ACTIONS_WITHOUT_SCOPE, AuditJournal } from "../../src/audit/journal.js"
import { persistentAudit } from "../../src/db/repositories/auditRepository.js"
import { persistentCustody } from "../../src/db/repositories/custodyRepository.js"
import { UnitOfWork } from "../../src/db/unitOfWork.js"
import { CustodyStore } from "../../src/features/custody/data/store.js"
import { amendAsset, registerAsset } from "../../src/features/custody/services/assets.js"
import { acknowledgeReceipt, recordCustodyMove } from "../../src/features/custody/services/chain.js"
import {
  assetStateOf,
  assetsInScope,
  chainOf,
  openCustodyOf,
} from "../../src/features/custody/services/derive.js"
import { custodyClearance } from "../../src/features/custody/services/handoff.js"
import type { SqlStatement } from "../../src/db/sql/driver.js"
import {
  BILAL_PATH,
  KHALID_PATH,
  MAIN,
  NOW,
  OTHER,
  custodyContext,
  custodySession,
  freshCustodyStores,
  freshDb,
  rowsOf,
  seedCustodySession,
  seedCustodyUnits,
  type CustodyStores,
} from "./_custody.js"

/** أصلٌ في مسجد خالد — يُسجَّل بالطريق المُعلَن لا بحقنٍ في المستودع. */
function register(stores: CustodyStores, labelAr = "حاسوبٌ محمول", unitId = "khalid"): string {
  const done = registerAsset(stores.custody, custodyContext("u-finance"), { unitId, labelAr })
  if (!done.ok) throw new Error(`تعذّر تسجيلُ الأصل: ${done.error.code}`)
  return done.value.id
}

function hand(stores: CustodyStores, assetId: string, toPersonId: string): string {
  const done = recordCustodyMove(stores.custody, custodyContext("u-amir"), {
    assetId,
    action: "hand",
    toPersonId,
    conditionAr: "سليم",
  })
  if (!done.ok) throw new Error(`تعذّرت الحركة: ${done.error.code}`)
  return done.value.id
}

/** قراءةُ عبارات مصدرٍ بعينه مقابل أساسه — بها يُقاس **ما يُكتب** لا ما يُقرأ. */
async function statementsAfter(
  driver: Awaited<ReturnType<typeof freshDb>>,
  tenantId: string,
  fn: (stores: CustodyStores) => void,
): Promise<readonly SqlStatement[]> {
  const stores = freshCustodyStores(tenantId)
  const source = persistentCustody(stores.custody)
  const uow = new UnitOfWork(driver, { tenantId, scopePath: "/" })
  uow.enlist(source)
  uow.enlist(persistentAudit(stores.audit))
  await uow.hydrate()
  fn(stores)
  return uow.statementsFor(source.name, source.project())
}

// ═══ الاختبار الإلزاميّ ١ — ق-٧٨/ق-٨٠: لا محو، والحالةُ تحديثٌ ══════════════════

describe("ق-٨٠/ق-٧٨ — سلسلةٌ لا تُمحى: الاختفاءُ يُرمى ولا يُترجم `DELETE`", () => {
  it("ق-٨٠ — محوُ حركةٍ من الإسقاط **يُرمى**، ولا `DELETE` يُولَّد", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    await custodySession(driver, MAIN, (stores) => {
      hand(stores, register(stores), "u-teacher")
    })

    const stores = freshCustodyStores(MAIN)
    const source = persistentCustody(stores.custody)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(source)
    uow.enlist(persistentAudit(stores.audit))
    await uow.hydrate()

    const projected = source.project()
    const forged = new Map(projected)
    forged.set("custody_moves", new Map())
    expect(() => uow.statementsFor(source.name, forged)).toThrow(/custody_moves/)
    driver.close()
  })

  it("ق-٧٨ — ومحوُ **أصلٍ** كذلك يُرمى: الأصلُ حالاتٌ صريحةٌ لا حذفٌ صامت", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    await custodySession(driver, MAIN, (stores) => register(stores))

    const stores = freshCustodyStores(MAIN)
    const source = persistentCustody(stores.custody)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(source)
    uow.enlist(persistentAudit(stores.audit))
    await uow.hydrate()

    const projected = source.project()
    const forged = new Map(projected)
    forged.set("custody_assets", new Map())
    expect(() => uow.statementsFor(source.name, forged)).toThrow(/custody_assets/)
    driver.close()
  })

  it("**ولا عبارةَ حذفٍ واحدة** تُولَّد على السلسلة مهما تعاقبت الحالاتُ الخاتمة", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    const statements = await statementsAfter(driver, MAIN, (stores) => {
      const assetId = register(stores)
      hand(stores, assetId, "u-teacher")
      // نقلٌ ثم إعادةٌ ثم إخراجٌ من الخدمة — أشدُّ ما يُغري بنمذجة الحالة حذفاً وإدراجاً.
      hand(stores, assetId, "u-committee-head")
      for (const action of ["return", "decommission"] as const) {
        expect(
          recordCustodyMove(stores.custody, custodyContext("u-amir"), {
            assetId,
            action,
            conditionAr: "حال",
          }).ok,
        ).toBe(true)
      }
    })
    expect(statements.filter((s) => /^DELETE/.test(s.sql))).toEqual([])
    driver.close()
  })

  it("ق-٨٠ — انتقالُ الحالة **تحديثٌ**: الإقرارُ يُبقي الصفَّ نفسَه ولا يُنشئ صفاً جديداً", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    const moveId = await custodySession(driver, MAIN, (stores) =>
      hand(stores, register(stores), "u-teacher"),
    )
    const before = await rowsOf(driver, "custody_moves")
    expect(before).toHaveLength(1)

    const statements = await statementsAfter(driver, MAIN, ({ custody }) => {
      expect(
        acknowledgeReceipt(custody, custodyContext("u-teacher"), {
          moveId,
          personId: "u-teacher",
        }).ok,
      ).toBe(true)
    })
    // **عبارةٌ واحدةٌ على الحركة، وهي تحديثٌ بالمفتاح الطبيعيّ** — لا حذفٌ ولا إدراجٌ ثانٍ.
    const onMoves = statements.filter((s) => s.sql.includes("custody_moves"))
    expect(onMoves).toHaveLength(1)
    expect(onMoves[0]!.sql).toContain("ON CONFLICT (tenant_id, id) DO UPDATE")

    await custodySession(driver, MAIN, ({ custody }) => {
      expect(
        acknowledgeReceipt(custody, custodyContext("u-teacher"), {
          moveId,
          personId: "u-teacher",
        }).ok,
      ).toBe(true)
    })
    const after = (await rowsOf(driver, "custody_moves")) as readonly Record<string, unknown>[]
    // **الصفُّ نفسُه بقي**: عددُه واحدٌ ومعرّفُه لم يتبدّل — والحالةُ تحرّكت بختمٍ لا بصفٍّ جديد.
    expect(after).toHaveLength(1)
    expect(after[0]!["id"]).toBe(moveId)
    expect(after[0]!["acknowledged_by"]).toBe("u-teacher")
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٢ — ق-٧٩: الإقرارُ بيد المستلِم وحده ═══════════════════

describe("ق-٧٩ — الإقرارُ بيد المستلِم وحده، **بعد عبور القاعدة**", () => {
  it("غيرُ المستلِم لا يقرّ — ولو كان أميرَ المسجد الذي سلّم", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    const moveId = await custodySession(driver, MAIN, (stores) =>
      hand(stores, register(stores), "u-teacher"),
    )
    await custodySession(driver, MAIN, ({ custody }) => {
      for (const person of ["u-amir", "u-committee-head", "u-admin"]) {
        const denied = acknowledgeReceipt(custody, custodyContext(person), { moveId, personId: person })
        if (denied.ok) throw new Error(`أقرّ عن غيره: ${person}`)
        expect(`${person}:${denied.error.code}`).toBe(`${person}:NOT_RECEIVING_HOLDER`)
      }
    })
    // ولا بصمةَ إقرارٍ في القاعدة — الرفضُ لا يترك أثراً.
    const rows = (await rowsOf(driver, "custody_moves")) as readonly Record<string, unknown>[]
    expect(rows[0]!["acknowledged_by"]).toBeNull()
    driver.close()
  })

  it("والمستلِمُ يقرّ فتصير الحالةُ `held` — والبصمةُ تعبر القاعدةَ بزمنها", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    const moveId = await custodySession(driver, MAIN, (stores) =>
      hand(stores, register(stores), "u-teacher"),
    )
    await custodySession(driver, MAIN, ({ custody }) => {
      expect(
        acknowledgeReceipt(custody, custodyContext("u-teacher"), { moveId, personId: "u-teacher" })
          .ok,
      ).toBe(true)
    })
    await custodySession(driver, MAIN, ({ custody }) => {
      const move = custody.getMove(moveId)!
      expect(move.acknowledgedBy).toBe("u-teacher")
      expect(move.acknowledgedAt?.toISOString()).toBe(NOW.toISOString())
      expect(assetStateOf(custody, move.assetId)?.status).toBe("held")
    })
    driver.close()
  })

  it("**وختمٌ ثانٍ مرفوضٌ بعد التحميل** — الحالةُ المحمَّلة تحرس كما تحرس المكتوبة", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    const moveId = await custodySession(driver, MAIN, (stores) => {
      const id = hand(stores, register(stores), "u-teacher")
      acknowledgeReceipt(stores.custody, custodyContext("u-teacher"), {
        moveId: id,
        personId: "u-teacher",
      })
      return id
    })
    await custodySession(driver, MAIN, ({ custody }) => {
      const again = acknowledgeReceipt(custody, custodyContext("u-teacher"), {
        moveId,
        personId: "u-teacher",
      })
      if (again.ok) throw new Error("أُقرّ مرتين")
      expect(again.error.code).toBe("ALREADY_ACKNOWLEDGED")
    })
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٣ — ق-٨١: عزلُ النطاق على المستودع الحقيقيّ ═══════════

describe("ق-٨١ — عزلُ النطاق **على المستودع الحقيقيّ** لا على الذاكرة", () => {
  it("عزلُ الشبكة: عهدةُ شبكةٍ **لا تُقرأ** من أخرى ولو تطابق المسارُ حرفياً", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    await seedCustodySession(driver, OTHER)
    const alien = await custodySession(driver, OTHER, (stores) =>
      hand(stores, register(stores, "بروجكتر حلب"), "u-teacher"),
    )

    await custodySession(driver, MAIN, ({ custody }) => {
      expect(custody.assets()).toEqual([])
      expect(custody.moves()).toEqual([])
      expect(custody.getMove(alien)).toBeNull()
      expect(assetsInScope(custody, KHALID_PATH)).toEqual([])
      expect(openCustodyOf(custody, "u-teacher")).toEqual([])
    })
    driver.close()
  })

  it("عزلُ الشبكة: كتابةُ شبكةٍ **لا تمسّ** صفَّ الأخرى ولو حمل المعرّفَ نفسَه", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    await seedCustodySession(driver, OTHER)
    await custodySession(driver, OTHER, (stores) => register(stores, "أصلُ حلب"))
    await custodySession(driver, MAIN, (stores) => register(stores, "أصلُ حمص"))

    const rows = (await rowsOf(driver, "custody_assets")) as readonly Record<string, unknown>[]
    // معرّفٌ واحدٌ (`as-1`) في شبكتين — والمفتاحُ الطبيعيّ يفصلهما بالشبكة لا بالمسار.
    expect(rows.map((r) => `${String(r["tenant_id"])}|${String(r["id"])}|${String(r["label_ar"])}`).sort()).toEqual([
      "t-aleppo|as-1|أصلُ حلب",
      "t-main|as-1|أصلُ حمص",
    ])
    driver.close()
  })

  it("عزلُ النطاق: جلسةُ مسجدٍ **لا تحمّل** عهدةَ جاره — والمسارُ بادئةٌ بشرطةٍ ختامية", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    await custodySession(driver, MAIN, (stores) => {
      register(stores, "حاسوبُ خالد", "khalid")
      register(stores, "حاسوبُ بلال", "bilal")
    })

    await custodySession(
      driver,
      MAIN,
      ({ custody }) => {
        expect(custody.assets().map((a) => a.labelAr)).toEqual(["حاسوبُ بلال"])
        expect(assetsInScope(custody, KHALID_PATH)).toEqual([])
      },
      BILAL_PATH,
    )
    driver.close()
  })

  it("**ولا يُسلَّم لشخصٍ خارج النطاق** بعد عبور القاعدة — الحارسُ في العمق لا في الشاشة", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    const assetId = await custodySession(driver, MAIN, (stores) => register(stores))
    await custodySession(driver, MAIN, ({ custody }) => {
      const denied = recordCustodyMove(custody, custodyContext("u-amir"), {
        assetId,
        action: "hand",
        toPersonId: "u-amir-bilal",
        conditionAr: "سليم",
      })
      if (denied.ok) throw new Error("سُلّمت خارج النطاق")
      expect(denied.error.code).toBe("RECIPIENT_OUT_OF_SCOPE")
    })
    expect(await rowsOf(driver, "custody_moves")).toHaveLength(0)
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٤ — ق-٨٣: التدقيقُ بنطاقه، وفي تدقيق نطاقه ═══════════

describe("ق-٨٣ — كلُّ تبديلِ حائزٍ وتعديلِ أصلٍ يُنتج قيداً **يحمل نطاقَه**", () => {
  it("قيدُ الحركة يعبر القاعدةَ بنطاق المسجد و`scope_exact = 1` — لا جذرٌ ولا اشتقاق", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    await custodySession(driver, MAIN, (stores) => {
      hand(stores, register(stores), "u-teacher")
    })
    const rows = (await rowsOf(driver, "audit_log")) as readonly Record<string, unknown>[]
    expect(rows.map((r) => `${String(r["action"])}|${String(r["unit_path"])}|${Number(r["scope_exact"])}`)).toEqual([
      "custody.asset.register|/men/homs/sq2/khalid/|1",
      "custody.move.record|/men/homs/sq2/khalid/|1",
    ])
    // **مصدرٌ واحد**: لا `custody` مصدراً ثانياً في العمود — التصنيفُ في `action` (CR-027).
    expect(new Set(rows.map((r) => String(r["source"])))).toEqual(new Set(["audit"]))
    driver.close()
  })

  it("**وقبل/بعد يعبران القاعدة**: «من كان يحوزها» لا يضيع ولو تبدّل مرتين", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    await custodySession(driver, MAIN, (stores) => {
      const assetId = register(stores)
      hand(stores, assetId, "u-teacher")
      hand(stores, assetId, "u-committee-head")
    })
    const rows = (await rowsOf(driver, "audit_log")) as readonly Record<string, unknown>[]
    const moves = rows.filter((r) => r["action"] === "custody.move.record")
    expect(moves).toHaveLength(2)
    expect(String(moves[0]!["before"])).toContain("inUnit")
    expect(String(moves[0]!["after"])).toContain("u-teacher")
    expect(String(moves[1]!["before"])).toContain("u-teacher")
    expect(String(moves[1]!["after"])).toContain("u-committee-head")
    expect(String(moves[0]!["target_type"])).toBe("asset")
    driver.close()
  })

  it("**حدثُ العهدة يظهر في تدقيق مسجده** — وهو ما جاءت له CR-027", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    await custodySession(driver, MAIN, (stores) => {
      hand(stores, register(stores, "حاسوبُ خالد", "khalid"), "u-teacher")
    })
    await custodySession(driver, MAIN, ({ audit }) => {
      expect(audit.listInScope(KHALID_PATH, 50).map((e) => e.action)).toEqual([
        "custody.asset.register",
        "custody.move.record",
      ])
      // وجارُه لا يرى شيئاً، والمربعُ فوقهما يرى بالاحتواء لا بالمصادفة.
      expect(audit.listInScope(BILAL_PATH, 50)).toEqual([])
      expect(audit.listInScope("/men/homs/sq2/", 50)).toHaveLength(2)
    })
    driver.close()
  })

  it("وتعديلُ الأصل يُدوَّن كذلك — وقيدُه يحمل نطاقَ موطنه", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    const assetId = await custodySession(driver, MAIN, (stores) => register(stores))
    await custodySession(driver, MAIN, ({ custody }) => {
      expect(
        amendAsset(custody, custodyContext("u-finance"), {
          assetId,
          fields: { labelAr: "حاسوبٌ محمولٌ جديد" },
        }).ok,
      ).toBe(true)
    })
    const amend = ((await rowsOf(driver, "audit_log")) as readonly Record<string, unknown>[]).find(
      (r) => r["action"] === "custody.asset.amend",
    )!
    expect(String(amend["unit_path"])).toBe(KHALID_PATH)
    expect(String(amend["before"])).toContain("حاسوبٌ محمول")
    expect(String(amend["after"])).toContain("حاسوبٌ محمولٌ جديد")
    driver.close()
  })

  it("**والحَجْرُ لم يُوسَّع**: لا فعلَ عُهدةٍ واحدٌ انضمّ إلى قائمة ما لا يُقال نطاقُه", () => {
    expect([...AUDIT_ACTIONS_WITHOUT_SCOPE]).toEqual(["ledger.post.failed"])
  })

  it("وسجلُّ شبكةٍ لا يظهر في تدقيق أخرى — العزلُ يشمل السجلَّ كما يشمل السلسلة", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    await seedCustodySession(driver, OTHER)
    await custodySession(driver, OTHER, (stores) => register(stores, "أصلُ حلب"))
    await custodySession(driver, MAIN, ({ audit }) => {
      expect(audit.listInScope(KHALID_PATH, 50)).toEqual([])
    })
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٥ — ق-٨٢: لا تُطوى صفحةُ كادرٍ وبيده عهدة ═════════════

describe("ق-٨٢ — تكاملُ الاستقالة باقٍ عاملاً **بعد النقل**", () => {
  it("من بيده عهدةٌ يُكشف بعد عبور القاعدة — والتأخّرُ في الإقرار ليس مخرجاً", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    await custodySession(driver, MAIN, (stores) => {
      hand(stores, register(stores), "u-teacher")
    })
    await custodySession(driver, MAIN, ({ custody }) => {
      const clearance = custodyClearance(custody, "u-teacher")
      expect(clearance.clear).toBe(false)
      // **بانتظار إقراره ومع ذلك محسوبٌ عليه** — وهذا هو بيت القصيد في ق-٨٢.
      expect(clearance.open.map((o) => `${o.labelAr}|${o.status}`)).toEqual([
        "حاسوبٌ محمول|pendingAck",
      ])
      expect(custodyClearance(custody, "u-amir").clear).toBe(true)
    })
    driver.close()
  })

  it("وتُبرَّأ ذمّتُه بعد إعادةٍ مسجَّلة — لا بمحوِ صفٍّ ولا بمرور الوقت", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    const assetId = await custodySession(driver, MAIN, (stores) => {
      const id = register(stores)
      hand(stores, id, "u-teacher")
      return id
    })
    await custodySession(driver, MAIN, ({ custody }) => {
      expect(
        recordCustodyMove(custody, custodyContext("u-amir"), {
          assetId,
          action: "return",
          conditionAr: "أُعيد سليماً",
        }).ok,
      ).toBe(true)
    })
    await custodySession(driver, MAIN, ({ custody }) => {
      expect(custodyClearance(custody, "u-teacher").clear).toBe(true)
      // والسلسلةُ كاملةٌ باقية: التبرئةُ **إضافةُ حدثٍ** لا محوُ سابقه (ق-٧٨).
      expect(chainOf(custody, assetId).map((m) => m.kind)).toEqual(["handover", "return"])
    })
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٦ — الذرّية: لا نصفَ أثر ══════════════════════════════

describe("الذرّية — فشلٌ في منتصف عمليةٍ لا يترك نصفَ أثر", () => {
  it("رميةٌ داخل المعاملة ⟵ لا حركةَ ولا قيدَ تدقيقٍ **في القاعدة**", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    const assetId = await custodySession(driver, MAIN, (stores) => register(stores))
    const boom = new Error("انفجارٌ مصطنعٌ بعد كتابة الحركة وقبل تمام العملية")

    await expect(
      custodySession(driver, MAIN, ({ custody, audit }) => {
        custody.transaction(() => {
          custody.appendMove({
            tenantId: MAIN,
            id: custody.nextId("mv"),
            assetId,
            seq: 1,
            kind: "handover",
            fromPersonId: null,
            toPersonId: "u-teacher",
            conditionAr: "سليم",
            noteAr: null,
            at: NOW,
            byPersonId: "u-amir",
            acknowledgedBy: null,
            acknowledgedAt: null,
          })
          audit.append({
            at: NOW,
            actorPersonId: "u-amir",
            action: "custody.move.record",
            unitPath: KHALID_PATH,
            capability: null,
            targetType: "asset",
            targetId: assetId,
            reason: null,
            before: "—",
            after: "u-teacher",
          })
          throw boom
        })
      }),
    ).rejects.toThrow(boom)

    // **الفارقُ يُحسب لا يُلتقط**: الذاكرةُ ارتدّت ⟵ صفرُ عبارةٍ ⟵ صفرُ أثرٍ دائم.
    expect(await rowsOf(driver, "custody_moves")).toHaveLength(0)
    expect(
      ((await rowsOf(driver, "audit_log")) as readonly Record<string, unknown>[]).map((r) =>
        String(r["action"]),
      ),
    ).toEqual(["custody.asset.register"])
    driver.close()
  })

  it("وحركةٌ مرفوضةٌ دلالياً لا تترك قيدَ تدقيقٍ ولا تحرق معرّفاً عبر القاعدة", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    const assetId = await custodySession(driver, MAIN, (stores) => register(stores))
    await custodySession(driver, MAIN, ({ custody }) => {
      expect(
        recordCustodyMove(custody, custodyContext("u-amir"), {
          assetId,
          action: "hand",
          toPersonId: "u-amir-bilal",
          conditionAr: "سليم",
        }).ok,
      ).toBe(false)
    })
    const moveId = await custodySession(driver, MAIN, (stores) => hand(stores, assetId, "u-teacher"))
    // المعرّفُ التالي بعد `as-1` هو `mv-2` — الرفضُ لم يستهلك نبضةَ عدّاد.
    expect(moveId).toBe("mv-2")
    expect(
      ((await rowsOf(driver, "audit_log")) as readonly Record<string, unknown>[]).map((r) =>
        String(r["action"]),
      ),
    ).toEqual(["custody.asset.register", "custody.move.record"])
    driver.close()
  })

  it("وحدةُ عملٍ خليطةٌ تُرمى — لا تُقذف عهدةٌ ومستودعٌ بلا مخطط", async () => {
    const driver = await freshDb()
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(persistentCustody(new CustodyStore(MAIN)))
    uow.enlist({
      name: "مستودعٌ بلا مخطط",
      rowBudget: 10,
      tables: ["custody_insurance"],
      project: () => new Map(),
      load: () => undefined,
    })
    await expect(uow.hydrate()).rejects.toThrow(/custody_insurance/)
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٧ — تطابقُ البديلين ════════════════════════════════════

/** لقطةُ ما تراه **الخدمة** — لا ما يدخل القاعدة: البديلان يجيبان الجوابَ نفسَه أو لا. */
type Observation = {
  readonly assets: readonly string[]
  readonly states: readonly string[]
  readonly chain: readonly string[]
  readonly openTeacher: readonly string[]
  readonly audit: readonly string[]
}

function observe({ custody, audit }: CustodyStores): Observation {
  return {
    assets: custody.assets().map((a) => `${a.id}|${a.labelAr}|${a.unitPath}`),
    states: custody
      .assets()
      .map((a) => assetStateOf(custody, a.id)!)
      .map((s) => `${s.assetId}|${s.status}|${s.holderPersonId ?? "—"}|${s.acknowledged}`),
    chain: custody
      .moves()
      .map((m) => `${m.id}|${m.seq}|${m.kind}|${m.fromPersonId ?? "—"}|${m.toPersonId ?? "—"}|${m.acknowledgedBy ?? "—"}`),
    openTeacher: openCustodyOf(custody, "u-teacher").map((o) => `${o.assetId}|${o.status}`),
    audit: audit.all().map((e) => `${e.action}|${e.unitPath}|${e.targetId}|${e.before ?? "—"}⟵${e.after ?? "—"}`),
  }
}

/** خطواتُ السيناريو — متزامنةٌ بحتة، تُشغَّل **حرفياً** على البديلين. */
const STEPS: readonly ((stores: CustodyStores) => void)[] = [
  (stores) => {
    expect(register(stores)).toBe("as-1")
  },
  (stores) => {
    expect(hand(stores, "as-1", "u-teacher")).toBe("mv-2")
  },
  ({ custody }) => {
    expect(
      acknowledgeReceipt(custody, custodyContext("u-teacher"), {
        moveId: "mv-2",
        personId: "u-teacher",
      }).ok,
    ).toBe(true)
  },
  (stores) => {
    // نقلُ عهدة — **الاسمُ يُشتقّ**: الثانيةُ `transfer` لا `handover`.
    expect(hand(stores, "as-1", "u-committee-head")).toBe("mv-3")
  },
  ({ custody }) => {
    // محاولةٌ مرفوضة: لا تترك أثراً على أيّ من البديلين.
    expect(
      recordCustodyMove(custody, custodyContext("u-amir"), {
        assetId: "as-1",
        action: "hand",
        toPersonId: "u-amir-bilal",
        conditionAr: "سليم",
      }).ok,
    ).toBe(false)
  },
  ({ custody }) => {
    expect(
      amendAsset(custody, custodyContext("u-finance"), {
        assetId: "as-1",
        fields: { serialAr: "س-٧" },
      }).ok,
    ).toBe(true)
  },
  ({ custody }) => {
    expect(
      recordCustodyMove(custody, custodyContext("u-amir"), {
        assetId: "as-1",
        action: "damage",
        conditionAr: "سقط فانكسر",
      }).ok,
    ).toBe(true)
  },
]

describe("تطابقُ البديلين — العُهدُ في الذاكرة وعلى D1", () => {
  it("السيناريو نفسُه يعطي النتائج نفسَها على البديلين **خطوةً خطوة**", async () => {
    const memory = freshCustodyStores(MAIN)
    seedCustodyUnits(memory.custody)
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)

    for (const [index, step] of STEPS.entries()) {
      step(memory)
      const inMemory = observe(memory)
      const onD1 = await custodySession(driver, MAIN, (stores) => {
        step(stores)
        return observe(stores)
      })
      expect(`الخطوة ${index + 1}: ${JSON.stringify(onD1)}`).toBe(
        `الخطوة ${index + 1}: ${JSON.stringify(inMemory)}`,
      )
    }
    driver.close()
  })

  it("الحالةُ الدائمة تُقرأ بعد الجلسة كما تُركت — التحميلُ والإسقاطُ متعاكسان", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    for (const step of STEPS) await custodySession(driver, MAIN, step)
    const first = await custodySession(driver, MAIN, observe)
    const second = await custodySession(driver, MAIN, observe)
    expect(second).toEqual(first)
    driver.close()
  })

  it("قراءةٌ بلا كتابة **لا تُنتج عبارةً واحدة** — فالتحميلُ لا يُلوّث سلسلةً ملحقةً فقط", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    await custodySession(driver, MAIN, (stores) => hand(stores, register(stores), "u-teacher"))
    const before = await rowsOf(driver, "custody_moves")
    const statements = await statementsAfter(driver, MAIN, ({ custody }) => {
      void chainOf(custody, "as-1")
    })
    expect(statements).toEqual([])
    expect(await rowsOf(driver, "custody_moves")).toEqual(before)
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٨ — الحتميّة والعدّاد عبر الجلسات ═════════════════════

describe("الحتميّة تنجو عبور القاعدة — العدّادُ يُستأنف ولا يعود صفراً", () => {
  it("المعرّفُ متتابعٌ عبر ثلاث جلسات — فلا يُدهس أصلٌ بأصلٍ ولا حركةٌ بحركة", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    const ids: string[] = []
    for (const label of ["أوّل", "ثانٍ", "ثالث"]) {
      ids.push(await custodySession(driver, MAIN, (stores) => register(stores, label)))
    }
    expect(ids).toEqual(["as-1", "as-2", "as-3"])
    expect(await rowsOf(driver, "custody_assets")).toHaveLength(3)
    driver.close()
  })

  it("**والنطاقُ الجزئيُّ لا يُنقص العدّاد**: جلسةُ مسجدٍ لا تدهس معرّفَ جاره", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    await custodySession(driver, MAIN, (stores) => register(stores, "حاسوبُ خالد", "khalid"))
    // جلسةٌ لا ترى إلا مسجد بلال، ومع ذلك يُستأنف العدّادُ من المحفوظ.
    const second = await custodySession(
      driver,
      MAIN,
      (stores) => register(stores, "حاسوبُ بلال", "bilal"),
      BILAL_PATH,
    )
    expect(second).toBe("as-2")
    const rows = (await rowsOf(driver, "custody_assets")) as readonly Record<string, unknown>[]
    expect(rows.map((r) => String(r["id"])).sort()).toEqual(["as-1", "as-2"])
    driver.close()
  })

  it("ولا ساعةَ في المستودع: قاعدتان مستقلتان تُنتجان الصفوفَ نفسَها حرفياً", async () => {
    const runs: string[] = []
    for (let i = 0; i < 2; i += 1) {
      const driver = await freshDb()
      await seedCustodySession(driver, MAIN)
      await custodySession(driver, MAIN, (stores) => hand(stores, register(stores), "u-teacher"))
      runs.push(JSON.stringify(await rowsOf(driver, "custody_moves")))
      driver.close()
    }
    expect(runs[1]).toBe(runs[0])
  })
})

// ═══ الاختبار الإلزاميّ ٩ — ميزانيةُ التحميل (G23) ════════════════════════════

describe("ميزانيةُ التحميل — العُهدُ تُعلن سقفَها وتُقاس عليه (G23)", () => {
  it("سقفُ العُهد موجبٌ ومُعلَنٌ في المصنع — لا مستودعَ بلا سقف", () => {
    const source = persistentCustody(new CustodyStore(MAIN))
    expect(`${source.name}:${source.rowBudget > 0}`).toBe("custody:true")
  })

  it("**وتجاوزُه رميةٌ تُسمّي الوحدةَ والجدولَ الأكبر** — لا «تجاوزٌ» مبهمة", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    await custodySession(driver, MAIN, (stores) => {
      const assetId = register(stores)
      hand(stores, assetId, "u-teacher")
    })
    const stores = freshCustodyStores(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist({ ...persistentCustody(stores.custody), rowBudget: 2 })
    await expect(uow.hydrate()).rejects.toThrow(/وحدةُ عمل «custody»/)
    await expect(uow.hydrate()).rejects.toThrow(/custody_units=/)
    driver.close()
  })
})

// ═══ حوافُّ الطبقة — دفاعاتٌ تُختبر لا تُفترض ═══════════════════════════════════

describe("حوافُّ مستودع العُهد — والسلبُ أكثرُ من الإيجاب", () => {
  it("**مفتاحُ توجيهٍ لا يُشتقّ يُرمى**: حركةٌ إلى أصلٍ مجهول لا تُوجَّه إلى الجذر صامتاً", () => {
    const store = new CustodyStore(MAIN)
    store.appendMove({
      tenantId: MAIN,
      id: "mv-1",
      assetId: "as-لا-وجود-له",
      seq: 1,
      kind: "handover",
      fromPersonId: null,
      toPersonId: "u-teacher",
      conditionAr: "سليم",
      noteAr: null,
      at: NOW,
      byPersonId: "u-amir",
      acknowledgedBy: null,
      acknowledgedAt: null,
    })
    // الرميةُ **تُسمّي الحركةَ وأصلَها** — حارسٌ لا يقول أين يُكلّف مطاردةً في غير موضعها.
    expect(() => persistentCustody(store).project()).toThrow(/مفتاحُ توجيهٍ لا يُشتقّ/)
  })

  it("تحميلٌ من لا شيء لا يرمي ولا يخترع — قاعدةٌ فارغةٌ مستودعٌ فارغٌ وعدّادٌ من الصفر", () => {
    const store = new CustodyStore(MAIN)
    persistentCustody(store).load(new Map())
    expect(store.assets()).toEqual([])
    expect(store.moves()).toEqual([])
    expect(store.nextId("as")).toBe("as-1")
  })

  it("**سلسلتان بترتيبٍ حتميّ**: أصلان تحمل حركتاهما `seq` نفسَه فلا يلتبس ترتيبُهما", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    await custodySession(driver, MAIN, (stores) => {
      hand(stores, register(stores, "أوّل"), "u-teacher")
      hand(stores, register(stores, "ثانٍ"), "u-committee-head")
    })
    const first = await custodySession(driver, MAIN, ({ custody }) =>
      custody.moves().map((m) => `${m.id}|${m.assetId}|${m.seq}`),
    )
    const second = await custodySession(driver, MAIN, ({ custody }) =>
      custody.moves().map((m) => `${m.id}|${m.assetId}|${m.seq}`),
    )
    expect(first).toEqual(["mv-2|as-1|1", "mv-4|as-3|1"])
    expect(second).toEqual(first)
    driver.close()
  })
})

// ═══ سجلٌّ واحدٌ تتقاسمه الوحدات — بندُ ناقل الوحدة ٢ (CR-027) ═══════════════

describe("سجلُّ التدقيق واحدٌ يُحقن — ولا تملكه وحدة", () => {
  it("`CustodyAuditRecord` المحليُّ لم يعد له وجودٌ في مصدر الوحدة", async () => {
    const { readFileSync } = await import("node:fs")
    const { fileURLToPath } = await import("node:url")
    const unit = fileURLToPath(new URL("../../src/features/custody/", import.meta.url))
    /** يُجرَّد التعليقُ كي **لا يُدان التوثيقُ بما يشرحه** — نفسُ منهج البوابات وحارسِ المسار الواحد. */
    const code = (path: string): string =>
      readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
    for (const file of ["types.ts", "data/store.ts"]) {
      const source = code(`${unit}${file}`)
      expect(`${file}:${/CustodyAuditRecord/.test(source)}`).toBe(`${file}:false`)
      expect(`${file}:${/auditList|appendAudit/.test(source)}`).toBe(`${file}:false`)
    }
  })

  it("قيدُ العُهد وقيدُ وحدةٍ أخرى يسكنان **سجلاً واحداً بتسلسلٍ واحد**", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    const shared = new AuditJournal(MAIN)
    const custody = new CustodyStore(MAIN, shared)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(persistentCustody(custody))
    uow.enlist(persistentAudit(shared))
    await uow.hydrate()
    register({ custody, audit: shared })
    shared.append({
      at: NOW,
      actorPersonId: "u-admin",
      action: "users.provision",
      unitPath: KHALID_PATH,
      capability: "user.manage",
      targetType: "account",
      targetId: "p-1",
      reason: null,
    })
    await uow.flush()

    const rows = (await rowsOf(driver, "audit_log")) as readonly Record<string, unknown>[]
    expect(rows.map((r) => `${Number(r["seq"])}:${String(r["action"])}`)).toEqual([
      "1:custody.asset.register",
      "2:users.provision",
    ])
    // وحقلا قبل/بعد **صريحان**: مَن لا يملكهما يقول `null` ولا يُغفلهما.
    expect(rows[1]!["before"]).toBeNull()
    driver.close()
  })

  it("ووحدةُ عملٍ بسجلَّين **لا توجد**: التسلسلُ ملكُ السجلّ المُحقَن لا ملكُ الوحدة", async () => {
    const driver = await freshDb()
    await seedCustodySession(driver, MAIN)
    await custodySession(driver, MAIN, (stores) => register(stores))
    await custodySession(driver, MAIN, (stores) => register(stores, "أصلٌ ثانٍ"))
    const rows = (await rowsOf(driver, "audit_log")) as readonly Record<string, unknown>[]
    // تسلسلٌ متصاعدٌ عبر الجلسات — لا إعادةَ ترقيمٍ من ١ تدهس قيداً محفوظاً.
    expect(rows.map((r) => Number(r["seq"]))).toEqual([1, 2])
    driver.close()
  })
})
