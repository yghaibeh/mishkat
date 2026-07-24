/**
 * استمرارُ الصندوق على D1 — **الاختباراتُ تستهلك طبقةَ الاستمرار كما تُشحن ولا تحاكيها**.
 *
 * وأخصُّ ما في هذه الوحدة أن ثابتَها الحاكم **عابرٌ للمستودعين**: *لا قيدٌ بلا سجلِّ تسليمه،
 * ولا سجلٌّ بلا قيده* (ق-٦١ · README الحسم ١). وفي الذاكرة تحمله `atomically`؛ وعلى القاعدة
 * تحمله **الدفعةُ الواحدة** — فالبرهانُ هنا أن الفارقين يُطبَّقان معاً أو لا يُطبَّق أيٌّ منهما.
 *
 * **حتميّ** (TESTING_POLICY §٥): لا عشوائيّة ولا ساعةَ زمن-تشغيل.
 */

import { describe, expect, it } from "vitest"
import { AuditJournal } from "../../src/audit/journal.js"
import { persistentAudit } from "../../src/db/repositories/auditRepository.js"
import {
  persistentBoxCatalog,
  persistentBoxHandovers,
} from "../../src/db/repositories/boxRepository.js"
import { persistentLedger } from "../../src/db/repositories/ledgerRepository.js"
import { LoadBudgetExceededError, UnitOfWork } from "../../src/db/unitOfWork.js"
import { BoxStore, boxStoresFor } from "../../src/features/box/data/store.js"
import { LedgerStore } from "../../src/features/ledger/data/store.js"
import {
  acknowledgeHandover,
  handoverDown,
  pendingHandoversFor,
} from "../../src/features/box/services/handover.js"
import { receiveIntoBox, spendFromBox } from "../../src/features/box/services/operations.js"
import { ownBoxBalances } from "../../src/features/box/services/boxBalances.js"
import {
  BILAL_PATH,
  KHALID,
  KHALID_PATH,
  MAIN,
  MEN_PATH,
  OTHER,
  SQ2,
  SQ2_PATH,
  boxCatalogUnitOfWork,
  boxContext,
  boxSession,
  boxUnitOfWork,
  c,
  freshBoxStores,
  freshDb,
  rowsOf,
  seedBoxSession,
} from "./_box.js"
import type { BoxStores } from "../../src/features/box/data/store.js"

const SQUARE = () => boxContext("u-square")

/** يملأ صندوقَ المربع نقداً — بالطريق المُعلَن لا بحقنٍ في المستودع. */
function fillSquare(stores: BoxStores, operationId = "rcv-sq2", amount = 50_000): void {
  const done = receiveIntoBox(stores, SQUARE(), {
    unitId: SQ2,
    operationId,
    memoAr: "قبضتُ لصندوق المربع",
    lines: [{ currency: "USD", amount: c(amount) }],
  })
  if (!done.ok) throw new Error(`تعذّر القبض: ${done.error.code}`)
}

/** تسليمٌ نازل من المربع إلى مسجد خالد — أمينُه `u-amir` (العالمُ القانونيّ). */
function handToKhalid(stores: BoxStores, operationId: string, amount = 20_000): string {
  const done = handoverDown(stores, SQUARE(), {
    fromUnitId: SQ2,
    toUnitId: KHALID,
    toCustodianPersonId: "u-amir",
    operationId,
    memoAr: "سلّمتُ لمسجد خالد",
    currency: "USD",
    amount: c(amount),
  })
  if (!done.ok) throw new Error(`تعذّر التسليم: ${done.error.code}`)
  return done.value.handover.id
}

// ═══ ١) ثوابتُ الوحدة على المستودع الحقيقيّ ═══════════════════════════════════

describe("الصندوق على القاعدة — ثوابتُ الوحدة تنجو العبور", () => {
  it("التسليمُ يعبر الجلسة **بمسار وجهته**، والقيدُ وسجلُّه معاً (ق-٦١)", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    const id = await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores)
      return handToKhalid(stores, "hnd-op-1")
    })

    const rows = await rowsOf(driver, "box_handovers")
    expect(rows).toHaveLength(1)
    const row = rows[0] as Record<string, unknown>
    expect(String(row["id"])).toBe(id)
    // **وحدةُ الوجهة** هي مفتاحُ التوجيه — أعمقُ المسارين بحكم ق-٦١.
    expect(String(row["unit_path"])).toBe(KHALID_PATH)
    expect(String(row["from_unit_path"])).toBe(SQ2_PATH)
    expect(row["acknowledged_by"]).toBeNull()
    expect(row["acknowledged_at"]).toBeNull()

    // **ولا قيدَ بلا سجلِّ تسليمه**: القيدُ المشارُ إليه موجودٌ في الدفتر على القاعدة نفسِها.
    const entries = await driver.all({
      sql: "SELECT id FROM journal_entries WHERE tenant_id = ? AND id = ?",
      params: [MAIN, String(row["entry_id"])],
    })
    expect(entries).toHaveLength(1)
    driver.close()
  })

  it("**والإقرارُ تحديثٌ على الصفّ نفسِه** — البصمتان معاً، ولا صفَّ ثانياً (ق-٦١)", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    const id = await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores)
      return handToKhalid(stores, "hnd-op-1")
    })
    await boxSession(driver, MAIN, (stores) => {
      const done = acknowledgeHandover(stores, boxContext("u-amir"), {
        handoverId: id,
        personId: "u-amir",
      })
      if (!done.ok) throw new Error(done.error.code)
    })

    const rows = await rowsOf(driver, "box_handovers")
    expect(rows).toHaveLength(1)
    const row = rows[0] as Record<string, unknown>
    expect(String(row["handed_over_by"])).toBe("u-square")
    expect(String(row["acknowledged_by"])).toBe("u-amir")
    expect(typeof row["acknowledged_at"]).toBe("number")
    driver.close()
  })

  it("والقاموسُ يعبر بجذر الشبكة، والمُوقَفةُ **تبقى صفّاً** لا تُمحى (ق-٦٤/المادة ٧/٤)", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    const rows = (await rowsOf(driver, "box_categories")) as Record<string, unknown>[]
    expect(rows).toHaveLength(3)
    expect(new Set(rows.map((r) => String(r["unit_path"])))).toEqual(new Set(["/"]))
    const retired = rows.find((r) => String(r["id"]) === "retired")!
    expect(retired["active"]).toBe(0)
    driver.close()
  })

  /**
   * **والوجهُ السلوكيُّ فوق البنيويّ** (قب-٥٢ ١): إعلانُ «نطاقُه الجذر» يُثبت الإعلان،
   * وهذا يُثبت **الأثر** — قاموسٌ أُسكن فرعاً بعينه (`/men/`) يبدو صحيحاً في جلسة الرجال
   * **ويختفي صامتاً** عن قسم النساء. والصمتُ هنا **صرفٌ يُرفض بفئةٍ مجهولة** لا خطأٌ مرئيّ.
   */
  it("**والقاموسُ يُقرأ من كلِّ فرع** — قسمُ النساء يراه كما يراه قسمُ الرجال (النمط ب)", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    const inMen = await boxSession(
      driver,
      MAIN,
      (stores) => stores.box.categories().map((cat) => cat.id).sort(),
      MEN_PATH,
    )
    const inWomen = await boxSession(
      driver,
      MAIN,
      (stores) => stores.box.categories().map((cat) => cat.id).sort(),
      "/women/",
    )
    expect(`رجال=${inMen.join("،")} · نساء=${inWomen.join("،")}`).toBe(
      "رجال=fuel،retired،transport · نساء=fuel،retired،transport",
    )
    driver.close()
  })

  it("**والصرفُ يقرأ القاموسَ المحمَّل من القاعدة** — لا مخططٌ يُنشأ ثم لا يُستعمل", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    const net = await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores)
      const done = spendFromBox(stores, SQUARE(), {
        unitId: SQ2,
        operationId: "spend-1",
        memoAr: "محروقات",
        categoryId: "fuel",
        currency: "USD",
        amount: c(5_000),
      })
      if (!done.ok) throw new Error(done.error.code)
      return ownBoxBalances(stores.ledger, SQ2_PATH).get("USD")?.net
    })
    expect(net).toBe(45_000)
    driver.close()
  })
})

// ═══ ٢) عزلُ الشبكة والنطاق ══════════════════════════════════════════════════

describe("الصندوق — عزلُ الشبكة والنطاق", () => {
  it("تسليمُ شبكةٍ **لا يُقرأ** من الأخرى ولو تطابق المسارُ النسبيُّ حرفاً (قب-١٨)", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    await seedBoxSession(driver, OTHER)
    await boxSession(driver, OTHER, (stores) => {
      fillSquare(stores)
      handToKhalid(stores, "hnd-op-other")
    })

    await boxSession(driver, MAIN, (stores) => {
      expect(stores.box.handovers()).toEqual([])
    })
    const mine = await driver.all({
      sql: "SELECT id FROM box_handovers WHERE tenant_id = ?",
      params: [MAIN],
    })
    expect(mine).toEqual([])
    driver.close()
  })

  it("**والتضييقُ بالمسار يُنقص المحمول فعلاً** (النمط أ): مسجدٌ آخرُ لا يرى تسليمَ جاره", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores)
      handToKhalid(stores, "hnd-op-1")
    })

    const atSquare = await boxSession(
      driver,
      MAIN,
      (stores) => stores.box.handovers().map((h) => h.toUnitPath),
      SQ2_PATH,
    )
    const atBilal = await boxSession(
      driver,
      MAIN,
      (stores) => stores.box.handovers().map((h) => h.toUnitPath),
      BILAL_PATH,
    )
    expect(`مربع=${atSquare.length} · بلال=${atBilal.length}`).toBe("مربع=1 · بلال=0")
    expect(atSquare).toEqual([KHALID_PATH])
    driver.close()
  })
})

// ═══ ٣) نطاقُ التدقيق — الحدثُ يظهر في تدقيق نطاقه ═══════════════════════════

describe("الصندوق — قيدُ التدقيق يقول نطاقَه ويظهر فيه (CR-027)", () => {
  it("`box.handover` نطاقُه **الوحدةُ المستلِمة**، ويُقرأ من نطاقها ومن نطاقٍ يحويه", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores)
      handToKhalid(stores, "hnd-op-1")
    })

    const rows = (await driver.all({
      sql: "SELECT unit_path, action, scope_exact, before, after FROM audit_log WHERE action = ?",
      params: ["box.handover"],
    })) as Record<string, unknown>[]
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!["unit_path"])).toBe(KHALID_PATH)
    // **لا فعلَ بلا نطاق**: الحَجْرُ لم يُوسَّع، فالوسمُ «نطاقٌ دقيق».
    expect(rows[0]!["scope_exact"]).toBe(1)
    // ق-٨٣/CR-028: لا حائزَ قبله، وبعده **بصمةُ الأمين المنتظر** — لا فراغٌ صامت.
    expect(rows[0]!["before"]).toBeNull()
    expect(String(rows[0]!["after"])).toContain("u-amir")

    await boxSession(driver, MAIN, (stores) => {
      const inKhalid = stores.ledger.audit.listInScope(KHALID_PATH, 50)
      const inSquare = stores.ledger.audit.listInScope(SQ2_PATH, 50)
      const inBilal = stores.ledger.audit.listInScope(BILAL_PATH, 50)
      const count = (list: readonly { action: string }[]): number =>
        list.filter((e) => e.action === "box.handover").length
      expect(`خالد=${count(inKhalid)} · مربع=${count(inSquare)} · بلال=${count(inBilal)}`).toBe(
        "خالد=1 · مربع=1 · بلال=0",
      )
    })
    driver.close()
  })
})

// ═══ ٤) الذرّية العابرةُ للمستودعين — رميةٌ ⟵ صفرُ عبارة ═════════════════════

describe("الصندوق — الذرّية: لا قيدٌ بلا سجلِّ تسليمه ولا سجلٌّ بلا قيده", () => {
  it("رميةٌ داخل `atomically` ⟵ **صفرُ عبارةٍ للمستودعين معاً** (الفارقُ يُحسب لا يُلتقط)", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    const stores = freshBoxStores(MAIN)
    // **المصادرُ هي هي** لا نسخٌ منها: مصنعٌ ثانٍ لم يُحمَّل يُسقط حالةً لم يرها فيكذب الفارق.
    const ledgerSource = persistentLedger(stores.ledger)
    const handoverSource = persistentBoxHandovers(stores.box)
    const auditSource = persistentAudit(stores.ledger.audit)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(ledgerSource)
    uow.enlist(persistentBoxCatalog(stores.box))
    uow.enlist(handoverSource)
    uow.enlist(auditSource)
    await uow.hydrate()
    fillSquare(stores)
    await uow.flush()

    // تسليمٌ يقع ثم يُجهض بعد كتابة القيد وسجلِّه معاً — الارتدادُ يُصفّر الفارقين.
    expect(() =>
      stores.box.transaction(() =>
        stores.ledger.transaction(() => {
          handToKhalid(stores, "hnd-doomed")
          throw new Error("إجهاضٌ متعمَّد بعد كتابة الطرفين")
        }),
      ),
    ).toThrow("إجهاضٌ متعمَّد")

    const handoverStatements = uow.statementsFor("boxHandovers", handoverSource.project())
    const ledgerStatements = uow.statementsFor("ledger", ledgerSource.project())
    const auditStatements = uow.statementsFor("audit", auditSource.project())
    expect(
      `تسليم=${handoverStatements.length} · دفتر=${ledgerStatements.length} · تدقيق=${auditStatements.length}`,
    ).toBe("تسليم=0 · دفتر=0 · تدقيق=0")

    await uow.flush()
    expect(await rowsOf(driver, "box_handovers")).toEqual([])
    driver.close()
  })

  it("**والنجاحُ يقذف الطرفين في دفعةٍ واحدة** — لا نصفَ أثرٍ يبقى", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores)
      handToKhalid(stores, "hnd-op-1")
    })
    const handovers = (await rowsOf(driver, "box_handovers")) as Record<string, unknown>[]
    const entries = await driver.all({
      sql: "SELECT id FROM journal_entries WHERE id = ?",
      params: [String(handovers[0]!["entry_id"])],
    })
    expect(`سجلّ=${handovers.length} · قيد=${entries.length}`).toBe("سجلّ=1 · قيد=1")
    driver.close()
  })
})

// ═══ ٥) تطابقُ البديلين خطوةً خطوة ═══════════════════════════════════════════

describe("الصندوق — تطابقُ البديلين: الذاكرةُ والقاعدةُ تقولان الشيءَ نفسَه", () => {
  it("ثلاثُ خطواتٍ متتاليةٍ ⟵ لقطتان متطابقتان حرفياً", async () => {
    /** لقطةُ ما يُقاس — **لا `nextId()` هنا**: العدّادُ يحترق على أحد البديلين فيكذب. */
    const snapshot = (stores: BoxStores): string =>
      JSON.stringify({
        handovers: stores.box.handovers().map((h) => [h.id, h.toUnitPath, h.acknowledgedBy]),
        categories: stores.box.categories().map((cat) => [cat.id, cat.active]),
        balance: ownBoxBalances(stores.ledger, SQ2_PATH).get("USD")?.net ?? null,
      })

    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)

    const persisted: string[] = []
    let id = ""
    await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores)
      persisted.push(snapshot(stores))
      id = handToKhalid(stores, "hnd-op-1")
      persisted.push(snapshot(stores))
    })
    await boxSession(driver, MAIN, (stores) => {
      const done = acknowledgeHandover(stores, boxContext("u-amir"), {
        handoverId: id,
        personId: "u-amir",
      })
      if (!done.ok) throw new Error(done.error.code)
      persisted.push(snapshot(stores))
    })

    // البديلُ في الذاكرة: المستودعُ نفسُه، بلا قاعدةٍ ولا وحدةِ عمل.
    const memory = freshBoxStores(MAIN)
    for (const unit of [
      { id: SQ2, path: SQ2_PATH },
      { id: KHALID, path: KHALID_PATH },
    ]) {
      memory.ledger.saveUnit({ tenantId: MAIN, ...unit })
    }
    for (const account of [
      { id: "cash", ar: "النقد", kind: "asset" as const },
      { id: "revenue.donations", ar: "إيرادُ التبرعات", kind: "revenue" as const },
    ]) {
      memory.ledger.saveAccount({ tenantId: MAIN, ...account })
    }
    const inMemory: string[] = []
    fillSquare(memory)
    inMemory.push(snapshot(memory))
    const memoryId = handToKhalid(memory, "hnd-op-1")
    inMemory.push(snapshot(memory))
    const acked = acknowledgeHandover(memory, boxContext("u-amir"), {
      handoverId: memoryId,
      personId: "u-amir",
    })
    if (!acked.ok) throw new Error(acked.error.code)
    inMemory.push(snapshot(memory))

    // القاموسُ لا يُبذَر في البديل الذاكريّ، فيُقارَن ما عدا الفئات خطوةً خطوة.
    const withoutCategories = (rows: string[]): unknown[] =>
      rows.map((row) => {
        const parsed = JSON.parse(row) as Record<string, unknown>
        delete parsed["categories"]
        return parsed
      })
    expect(withoutCategories(persisted)).toEqual(withoutCategories(inMemory))
    driver.close()
  })
})

// ═══ ٦) الحتميّةُ عبر الجلسات وتحت نطاقٍ جزئيّ ═══════════════════════════════

describe("الصندوق — الحتميّة: العدّادُ يُستأنف ولا يدهس محفوظاً خارج النطاق", () => {
  it("جلسةٌ بنطاقٍ **جزئيّ** لا تُعيد استعمال معرّفٍ محفوظ", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores)
      handToKhalid(stores, "hnd-op-1")
      handToKhalid(stores, "hnd-op-2")
    })

    // نطاقُ بلال **لا يحمّل تسليماً واحداً**، فلو عاد العدّادُ صفراً لدهس `hnd-1`.
    await boxSession(
      driver,
      MAIN,
      (stores) => {
        expect(stores.box.handovers()).toEqual([])
        expect(stores.box.nextId("hnd")).toBe("hnd-3")
      },
      BILAL_PATH,
    )

    const ids = ((await rowsOf(driver, "box_handovers")) as Record<string, unknown>[])
      .map((r) => String(r["id"]))
      .sort()
    expect(ids).toEqual(["hnd-1", "hnd-2"])
    driver.close()
  })

  it("**والعدّادُ يُخزَّن ويُستأنف** عبر الجلسات — لا يبدأ من الصفر مرّتين", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores)
      handToKhalid(stores, "hnd-op-1")
    })
    const stored = (await driver.all({
      sql: "SELECT value FROM sequences WHERE tenant_id = ? AND name = ?",
      params: [MAIN, "box.seq"],
    })) as Record<string, unknown>[]
    expect(Number(stored[0]!["value"])).toBe(1)

    await boxSession(driver, MAIN, (stores) => {
      handToKhalid(stores, "hnd-op-2")
    })
    const ids = ((await rowsOf(driver, "box_handovers")) as Record<string, unknown>[])
      .map((r) => String(r["id"]))
      .sort()
    expect(ids).toEqual(["hnd-1", "hnd-2"])
    driver.close()
  })
})

// ═══ ٧) §٤-٠: مصنعان — البنيويُّ يُثبت الإعلان، والسلوكيُّ يُثبت الأثر ═══════

describe("الصندوق — **مصنعان لا واحد** (وصفة §٤-٠ · CR-029)", () => {
  it("**بنيويّ**: مصنعُ القاموس يملك جدولَه وحدَه، ومصنعُ التسليمات جدولَه وعدّادَه", () => {
    const store = new BoxStore(MAIN)
    const catalog = persistentBoxCatalog(store).tables.map((t) =>
      typeof t === "string" ? t : t.table,
    )
    const handovers = persistentBoxHandovers(store).tables.map((t) =>
      typeof t === "string" ? t : t.table,
    )
    expect(catalog).toEqual(["box_categories"])
    expect(handovers).toEqual(["box_handovers", "sequences"])
    // **ولا تقاطعَ بينهما** — وإلا حمّل أحدُهما ما ليس له.
    expect(catalog.filter((t) => handovers.includes(t))).toEqual([])
  })

  it("**سلوكيّ**: قراءةُ القاموس بالجذر **لا تُحمّل تسليماً واحداً** — بذرةٌ تُظهر الفرق", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    // **بذرةٌ تقدر أن تُحمّر الحارس** (فخّ ٦-ب): تسليماتٌ في وحداتٍ شتّى، فلو جمعهما مصنعٌ
    // واحدٌ لحمّلتها جلسةُ القاموس بالجذر كلَّها.
    await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores, "rcv-big", 500_000)
      for (let i = 1; i <= 12; i += 1) handToKhalid(stores, `hnd-op-${i}`, 1_000)
    })
    expect(await rowsOf(driver, "box_handovers")).toHaveLength(12)

    const stores = freshBoxStores(MAIN)
    const uow = boxCatalogUnitOfWork(driver, stores, { tenantId: MAIN, scopePath: "/" })
    await uow.hydrate()
    expect(
      `فئات=${stores.box.categories().length} · تسليمات=${stores.box.handovers().length}`,
    ).toBe("فئات=3 · تسليمات=0")
    driver.close()
  })
})

// ═══ ٨) G23 — ميزانيةُ التحميل تُسمع النموّ ═══════════════════════════════════

describe("الصندوق — G23: السقفُ يرمي مُسمِّياً مصدرَه وجدولَه", () => {
  it("سقفٌ مكسورٌ إلى **أقرب قيمةٍ خاطئةٍ مشروعة** ⟵ رميةٌ تحمل اسمَ المصدر والجدول", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores)
      handToKhalid(stores, "hnd-op-1")
      handToKhalid(stores, "hnd-op-2")
    })

    const stores = freshBoxStores(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    // سقفٌ **٢**: صفّا التسليم مقبولان والعدّادُ يتجاوز — أقربُ قيمةٍ خاطئةٍ مشروعة.
    uow.enlist({ ...persistentBoxHandovers(stores.box), rowBudget: 2 })
    await expect(uow.hydrate()).rejects.toThrow(LoadBudgetExceededError)
    await expect(uow.hydrate()).rejects.toThrow(/boxHandovers/)
    await expect(uow.hydrate()).rejects.toThrow(/box_handovers=2/)
    driver.close()
  })

  it("**والسقفُ المُعلَن يسع الجلسةَ الواقعية** — قسمٌ كاملٌ لا يبلغه (مرساةُ CR-030)", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores, "rcv-big", 500_000)
      for (let i = 1; i <= 20; i += 1) handToKhalid(stores, `hnd-op-${i}`, 1_000)
    })
    // `box.handovers.view` على عقدة القسم — أوسعُ نطاقٍ يقرؤه سطحٌ مُعلَنٌ فعلاً.
    const seen = await boxSession(
      driver,
      MAIN,
      (stores) => stores.box.handovers().length,
      MEN_PATH,
    )
    expect(seen).toBe(20)
    driver.close()
  })
})

// ═══ ٩) شرطُ قب-٤٩ — **سجلٌّ واحدٌ متّصلُ التسلسل** ═══════════════════════════

describe("الصندوق — شرطُ قب-٤٩: سجلٌّ واحدٌ متّصلُ التسلسل", () => {
  it("`boxStoresFor` تحقن سجلاً **واحداً** — لا سجلَّ ثانياً يُنشئه الدفترُ لنفسه", () => {
    const audit = new AuditJournal(MAIN)
    const injected = boxStoresFor(MAIN, audit)
    expect(injected.ledger.audit).toBe(audit)
    // وبلا حقنٍ: سجلٌّ واحدٌ للحزمة كذلك — لا اثنان.
    const standalone = boxStoresFor(MAIN)
    expect(standalone.ledger.audit).toBeInstanceOf(AuditJournal)
    expect(standalone.ledger.audit).not.toBe(audit)
  })

  it("**التسلسلُ متّصلٌ عبر الجلسات** — لا يبدأ من ١ فيدهس صفَّ الجلسة السابقة", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores)
      handToKhalid(stores, "hnd-op-1")
    })
    await boxSession(driver, MAIN, (stores) => {
      handToKhalid(stores, "hnd-op-2")
    })

    const rows = (await driver.all({
      sql: "SELECT source, seq FROM audit_log WHERE tenant_id = ? ORDER BY seq",
      params: [MAIN],
    })) as Record<string, unknown>[]
    // **مصدرٌ واحد** (لا `box` و`ledger` جنباً إلى جنب) وتسلسلٌ **متّصلٌ بلا فجوةٍ ولا تكرار**.
    expect(new Set(rows.map((r) => String(r["source"])))).toEqual(new Set(["audit"]))
    expect(rows.map((r) => Number(r["seq"]))).toEqual(rows.map((_, i) => i + 1))
    expect(rows.length).toBeGreaterThanOrEqual(2)
    driver.close()
  })

  /**
   * **الكسرُ المُوجَّه للشرط نفسِه** (فخّ ٦-ب: حارسٌ لا يقدر أن يحمرّ ليس حارساً).
   *
   * الحزمةُ تُبنى **كما كانت قبل الشرط**: دفترٌ يُنشئ سجلَّه الافتراضيَّ الخاصّ، ووحدةُ عملٍ
   * تُلحق **سجلاً آخرَ**. فالخدمةُ تكتب قيدَها في سجلِّ الدفتر، والمُسقِطُ يقرأ سجلاً آخر ⟵
   * **قيدُ التدقيق لا يبلغ القاعدة أصلاً**: صمتٌ في الجدول الذي المادةُ ٤/٨ تقول عنه «لا يُمحى».
   */
  it("**سجلّان لدفترٍ واحدٍ ⟵ قيدُ التدقيق يضيع صامتاً** — الكسرُ يُثبت أن الشرط ليس زينة", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)

    const broken = { ledger: new LedgerStore(MAIN), box: new BoxStore(MAIN) }
    const stranger = new AuditJournal(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(persistentLedger(broken.ledger))
    uow.enlist(persistentBoxCatalog(broken.box))
    uow.enlist(persistentBoxHandovers(broken.box))
    uow.enlist(persistentAudit(stranger))
    await uow.hydrate()
    fillSquare(broken)
    handToKhalid(broken, "hnd-op-broken")
    await uow.flush()

    const handovers = await rowsOf(driver, "box_handovers")
    const audited = await driver.all({
      sql: "SELECT seq FROM audit_log WHERE action = ?",
      params: ["box.handover"],
    })
    // **سجلُّ تسليمٍ بلا قيدِ تدقيقه** — وهذا بعينه ما يمنعه الشرط.
    expect(`تسليم=${handovers.length} · تدقيق=${audited.length}`).toBe("تسليم=1 · تدقيق=0")
    driver.close()
  })

  it("**وبالحزمة الصحيحة يظهر القيد** — نفسُ الخطوات، والفرقُ سجلٌّ واحدٌ مُحقَن", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores)
      handToKhalid(stores, "hnd-op-1")
    })
    const handovers = await rowsOf(driver, "box_handovers")
    const audited = await driver.all({
      sql: "SELECT seq FROM audit_log WHERE action = ?",
      params: ["box.handover"],
    })
    expect(`تسليم=${handovers.length} · تدقيق=${audited.length}`).toBe("تسليم=1 · تدقيق=1")
    driver.close()
  })
})

// ═══ ١٠) حوافُّ التغطية + السلبُ أكثرُ من الإيجاب ════════════════════════════

describe("الصندوق — حوافُّ التغطية والسلب", () => {
  it("`load(new Map())` — قاعدةٌ فارغةٌ تُنتج مستودعاً فارغاً وعدّاداً من الصفر", () => {
    const store = new BoxStore(MAIN)
    persistentBoxCatalog(store).load(new Map())
    persistentBoxHandovers(store).load(new Map())
    expect(store.categories()).toEqual([])
    expect(store.handovers()).toEqual([])
    expect(store.nextId("hnd")).toBe("hnd-1")
  })

  it("**والمُطالبةُ بالعدّاد تفصل صفَّ الصندوق عن صفوف غيره** (`owns`)", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores)
      handToKhalid(stores, "hnd-op-1")
    })
    const names = ((await rowsOf(driver, "sequences")) as Record<string, unknown>[])
      .map((r) => String(r["name"]))
      .sort()
    // عدّادُ الصندوق **إلى جانب** عدّادات الدفتر والتدقيق — ولا يمحو أحدُها الآخر.
    expect(names).toContain("box.seq")
    expect(names).toContain("ledger.seq")
    expect(names).toContain("audit.seq")
    driver.close()
  })

  it("**والمحوُ ممنوع**: اختفاءُ فئةٍ من الإسقاط يُرمى ولا يُترجم `DELETE` (المادة ٧/٤)", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    const stores = freshBoxStores(MAIN)
    const uow = boxUnitOfWork(driver, stores, { tenantId: MAIN, scopePath: "/" })
    await uow.hydrate()
    const source = persistentBoxCatalog(stores.box)
    // إسقاطٌ ينقصه صفٌّ محفوظ — أقربُ قيمةٍ خاطئةٍ مشروعة (لا إسقاطٌ فارغٌ فجّ).
    const projected = source.project()
    const categories = new Map(projected.get("box_categories")!)
    categories.delete([...categories.keys()][0]!)
    expect(() =>
      uow.statementsFor("boxCatalog", new Map([["box_categories", categories]])),
    ).toThrow(/محوٌ ممنوع/)
    driver.close()
  })

  /**
   * **الوجهُ الثاني لثابت «لا محو»** (وصفة فخّ ٧). قلبُ `appendOnly` وحدَه على
   * `box_handovers` **أسقط صفراً**: في التشغيل الطبيعيّ لا يختفي صفٌّ أصلاً، فالحارسُ
   * القائمُ يمرّ سواءٌ أرُفع العلمُ أم خُفض — *وهو يحرس المستودعَ لا يحرس العلم*.
   * فهذا الحارسُ يقيس **الوجهَ الآخر**: انتقالُ حالة الإقرار **لو نُمذج حذفاً وإدراجاً**
   * لأسقط «مَن سلّم» — وهو نصفُ ما وُجد السجلُّ له (ق-٦١: البصمتان).
   */
  it("**ولا محوَ لسجلِّ تسليم**: صفٌّ يختفي من الإسقاط يُرمى ولا يُترجم `DELETE` (المادة ٧/٤)", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores)
      handToKhalid(stores, "hnd-op-1")
      handToKhalid(stores, "hnd-op-2")
    })

    const stores = freshBoxStores(MAIN)
    const uow = boxUnitOfWork(driver, stores, { tenantId: MAIN, scopePath: "/" })
    await uow.hydrate()
    const projected = persistentBoxHandovers(stores.box).project()
    // **نمذجةُ الإقرار حذفاً وإدراجاً**: الصفُّ القديم يختفي وصفٌّ جديد يحلّ محلَّه —
    // أقربُ قيمةٍ خاطئةٍ مشروعة، وهي بعينها النمذجةُ التي يمنعها العلم.
    const handovers = new Map(projected.get("box_handovers")!)
    const [victimKey, victim] = [...handovers.entries()][0]!
    handovers.delete(victimKey)
    handovers.set(`${victimKey}-معاد`, { ...victim, id: `${String(victim["id"])}-معاد` })
    expect(() =>
      uow.statementsFor("boxHandovers", new Map([["box_handovers", handovers]])),
    ).toThrow(/محوٌ ممنوع: صفٌّ اختفى من box_handovers/)
    driver.close()
  })

  it("**وتسليمٌ لم يُقرَّ يبقى في «ما ينتظر إقراري»** بعد العبور — والمُقَرُّ يخرج منها", async () => {
    const driver = await freshDb()
    await seedBoxSession(driver, MAIN)
    const [first, second] = await boxSession(driver, MAIN, (stores) => {
      fillSquare(stores)
      return [handToKhalid(stores, "hnd-op-1"), handToKhalid(stores, "hnd-op-2")]
    })
    await boxSession(driver, MAIN, (stores) => {
      const done = acknowledgeHandover(stores, boxContext("u-amir"), {
        handoverId: first!,
        personId: "u-amir",
      })
      if (!done.ok) throw new Error(done.error.code)
    })
    await boxSession(driver, MAIN, (stores) => {
      const pending = pendingHandoversFor(stores.box, "u-amir").map((h) => h.id)
      expect(pending).toEqual([second])
      // **والسلبُ مقيس**: مَن ليس أمينَ الوجهة لا ينتظره شيء.
      expect(pendingHandoversFor(stores.box, "u-square")).toEqual([])
    })
    driver.close()
  })
})
