/**
 * استمرارُ الرواتب على D1 — **الاختباراتُ تستهلك طبقةَ الاستمرار كما تُشحن ولا تحاكيها**.
 *
 * وأخصُّ ما هنا **ثابتان ينتقلان من الذاكرة إلى القاعدة**:
 *  ١. *لا قيدَ صرفٍ بلا سجلِّه ولا سجلٌّ بلا قيده* — تحمله **الدفعةُ الواحدة**.
 *  ٢. *لا يُدفع استحقاقٌ مرتين* (ق-٦٥) — **وتفرُّدُه في القاعدة لا في الذاكرة**: حارسُ
 *     الذاكرة يعمى عمّا لم يُحمَّل، والفهرسُ الفريدُ لا يعمى.
 *
 * **حتميّ** (TESTING_POLICY §٥): لا عشوائيّة ولا ساعةَ زمن-تشغيل.
 */

import { describe, expect, it } from "vitest"
import { AuditJournal } from "../../src/audit/journal.js"
import { persistentAudit } from "../../src/db/repositories/auditRepository.js"
import { persistentLedger } from "../../src/db/repositories/ledgerRepository.js"
import { persistentPayroll } from "../../src/db/repositories/payrollRepository.js"
import { LoadBudgetExceededError, UnitOfWork } from "../../src/db/unitOfWork.js"
import { PayrollStore, payrollStoresFor } from "../../src/features/payroll/data/store.js"
import { grantAdvance, outstandingOf } from "../../src/features/payroll/services/advances.js"
import { grantIncentive } from "../../src/features/payroll/services/incentives.js"
import { disburse } from "../../src/features/payroll/services/payout.js"
import { monthlyPlan } from "../../src/features/payroll/services/plan.js"
import type { PayrollStores } from "../../src/features/payroll/data/store.js"
import type { Cents } from "../../src/features/ledger/types.js"
import {
  BILAL,
  BILAL_PATH,
  KHALID,
  KHALID_PATH,
  MAIN,
  MEN_PATH,
  OTHER,
  PERIOD,
  freshDb,
  freshPayrollStores,
  payrollContext,
  payrollSession,
  payrollUnitOfWork,
  rowsOf,
  sealedPlan,
  seedPayrollSession,
  seedWorld,
} from "./_payroll.js"

const c = (value: number): Cents => value as Cents

/** سياقٌ بختمٍ معلَّق — عالمُ الرواتب يُبنى مرّةً ويُعاد استعمالُه بلا حالةٍ عابرة. */
function ctxWith(seal: ReturnType<typeof sealedPlan> | undefined, actorPersonId = "u-finance") {
  const world = seedWorld(MAIN)
  return payrollContext({
    world,
    actorPersonId,
    ...(seal === undefined ? {} : { seal }),
    payingUnit: () => KHALID_PATH,
  })
}

/** يمنح سلفةً بالطريق المُعلَن — لا حقنَ في المستودع. */
function grant(stores: PayrollStores, operationId: string, personId = "u-teacher"): string {
  const done = grantAdvance(stores, ctxWith(undefined), {
    personId,
    unitId: KHALID,
    operationId,
    principalCents: c(30_000),
    instalmentCents: c(10_000),
    memoAr: "سلفةٌ للمعلّم",
  })
  if (!done.ok) throw new Error(`تعذّر المنح: ${done.error.code}`)
  return done.value.id
}

/** يصرف لشخصٍ من خطةٍ مختومة — الطريقُ المُعلَن كاملاً (`disburse`). */
function pay(
  stores: PayrollStores,
  personIds: readonly string[],
  net = 20_000,
  unitPath = KHALID_PATH,
  /**
   * **الإجماليُّ يُقال ولا يُفترض**: القيدُ يتوازن بـ`gross = net + القسط` (ق-٦٩/ق-٧١)،
   * فمَن عليه سلفةٌ يحتاج إجمالياً أكبرَ من صافيه بمقدار قسطها — وإلا رُدَّ `UNBALANCED`
   * **من النواة** لا من هذه الوحدة. وهذا بعينه ما يجعل الخصمَ تسويةً محاسبيةً لا اقتطاعاً.
   */
  gross = net,
): string {
  const seal = sealedPlan(
    unitPath,
    PERIOD.id,
    personIds.map((personId) => ({ personId, netCents: net, grossCents: gross })),
  )
  const done = disburse(stores, ctxWith(seal), {
    unitPath,
    periodId: PERIOD.id,
    payingUnitId: KHALID,
    personIds,
    memoAr: "صرفُ رواتب الشهر",
  })
  if (!done.ok) throw new Error(`تعذّر الصرف: ${done.error.code}`)
  return done.value.id
}

// ═══ ١) ثوابتُ الوحدة على المستودع الحقيقيّ ═══════════════════════════════════

describe("الرواتب على القاعدة — وقائعُها تعبر بلا مستحقٍّ مخزَّن", () => {
  it("السلفةُ تعبر الجلسة **بوحدة خروج النقد**، ومعها قيدُها (ق-٦٩)", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    const id = await payrollSession(driver, MAIN, (stores) => grant(stores, "adv-op-1"))

    const rows = (await rowsOf(driver, "payroll_advances")) as Record<string, unknown>[]
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!["id"])).toBe(id)
    expect(String(rows[0]!["unit_path"])).toBe(KHALID_PATH)
    expect(rows[0]!["closed_at"]).toBeNull()
    const entries = await driver.all({
      sql: "SELECT id FROM journal_entries WHERE id = ?",
      params: [String(rows[0]!["entry_id"])],
    })
    expect(entries).toHaveLength(1)
    driver.close()
  })

  it("**والصرفُ يعبر بمَن صُرف له صفّاً صفّاً** — لا قائمةٌ مسلسلةٌ في عمود (ق-٦٥)", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => pay(stores, ["u-teacher", "u-amir"]))

    const payouts = (await rowsOf(driver, "payroll_payouts")) as Record<string, unknown>[]
    expect(payouts).toHaveLength(1)
    expect(String(payouts[0]!["unit_path"])).toBe(KHALID_PATH)
    const persons = (await rowsOf(driver, "payroll_payout_persons")) as Record<string, unknown>[]
    expect(persons.map((r) => String(r["person_id"])).sort()).toEqual(["u-amir", "u-teacher"])
    expect(new Set(persons.map((r) => String(r["period_id"])))).toEqual(new Set([PERIOD.id]))
    driver.close()
  })

  it("**و«مدفوعٌ» يُشتقّ من السجلّ بعد العبور** — لا حقلَ يُحدَّث (ق-٦٥)", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => pay(stores, ["u-teacher"]))
    await payrollSession(driver, MAIN, (stores) => {
      expect([...stores.payroll.paidPersonIdsIn(PERIOD.id)]).toEqual(["u-teacher"])
      // **والسلبُ مقيس**: فترةٌ أخرى لا مدفوعَ فيها.
      expect([...stores.payroll.paidPersonIdsIn("2026-06")]).toEqual([])
    })
    driver.close()
  })

  it("**والقسطُ يرث مسارَ سلفته، والإقفالُ حالةٌ لا حذف** (ق-٦٩/المادة ٧/٤)", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => grant(stores, "adv-op-1"))
    // ثلاثةُ صرفٍ متتالية ⟵ ثلاثةُ أقساطٍ (١٠٬٠٠٠ × ٣) تُقفل سلفةَ ٣٠٬٠٠٠.
    for (const period of ["2026-07", "2026-08", "2026-09"]) {
      await payrollSession(driver, MAIN, (stores) => {
        // **التوازنُ يوجبه**: إجماليٌّ ٢٥٬٠٠٠ = قسطٌ ١٠٬٠٠٠ + صافٍ ١٥٬٠٠٠ (ق-٦٩ + ق-٧١).
        const seal = sealedPlan(KHALID_PATH, period, [
          { personId: "u-teacher", netCents: 15_000, grossCents: 25_000 },
        ])
        const done = disburse(stores, ctxWith(seal), {
          unitPath: KHALID_PATH,
          periodId: period,
          payingUnitId: KHALID,
          personIds: ["u-teacher"],
          memoAr: `صرفُ ${period}`,
        })
        if (!done.ok) throw new Error(done.error.code)
      })
    }

    const instalments = (await rowsOf(driver, "payroll_instalments")) as Record<string, unknown>[]
    expect(instalments).toHaveLength(3)
    expect(new Set(instalments.map((r) => String(r["unit_path"])))).toEqual(new Set([KHALID_PATH]))
    const advances = (await rowsOf(driver, "payroll_advances")) as Record<string, unknown>[]
    // **الصفُّ باقٍ ومختومٌ بتاريخه** — لا يختفي (المادة ٧/٤).
    expect(advances).toHaveLength(1)
    expect(typeof advances[0]!["closed_at"]).toBe("number")
    // **ومفتاحُ التوجيه لم يتحرّك** — وهو سؤالُ فخّ ٤ مقيساً لا مفترَضاً.
    expect(String(advances[0]!["unit_path"])).toBe(KHALID_PATH)

    await payrollSession(driver, MAIN, (stores) => {
      const id = stores.payroll.advances()[0]!.id
      expect(outstandingOf(stores, id)).toBe(0)
      expect(stores.payroll.openAdvancesOf("u-teacher")).toEqual([])
    })
    driver.close()
  })

  it("**والحافزُ كيانٌ آخرُ وقيدٌ آخر** — خارجَ أجر المعلّم بالبناء (ق-٧٧)", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => {
      const done = grantIncentive(stores, ctxWith(undefined), {
        personId: "u-teacher",
        unitId: KHALID,
        operationId: "inc-op-1",
        amountCents: c(5_000),
        memoAr: "حافزٌ تشغيليّ",
      })
      if (!done.ok) throw new Error(done.error.code)
    })
    const rows = (await rowsOf(driver, "payroll_incentives")) as Record<string, unknown>[]
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!["unit_path"])).toBe(KHALID_PATH)
    // **ولا مبلغَ في صفّه**: القيدُ مصدرُ كلِّ رقم (ق-٦٠).
    expect(Object.keys(rows[0]!)).not.toContain("amount_cents")
    driver.close()
  })
})

// ═══ ٢) ق-٦٥ — **تفرُّدُ الصرف في القاعدة لا في الذاكرة** ═════════════════════

describe("الرواتب — ق-٦٥: لا يُدفع استحقاقٌ مرتين، **والقاعدةُ تحرسه حين تعمى الذاكرة**", () => {
  it("حارسُ الذاكرة يردّ الازدواجَ في الجلسة الواحدة ⟵ `ALREADY_PAID`", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => {
      pay(stores, ["u-teacher"])
      const seal = sealedPlan(KHALID_PATH, PERIOD.id, [{ personId: "u-teacher", netCents: 20_000 }])
      const again = disburse(stores, ctxWith(seal), {
        unitPath: KHALID_PATH,
        periodId: PERIOD.id,
        payingUnitId: KHALID,
        personIds: ["u-teacher"],
        memoAr: "صرفٌ ثانٍ",
      })
      expect(again.ok).toBe(false)
      if (!again.ok) expect(again.error.code).toBe("ALREADY_PAID")
    })
    driver.close()
  })

  /**
   * **وهذا هو العطبُ الذي جاء الفهرسُ الفريدُ له** (فخّ ٦-ب: الحارسُ يقدر أن يحمرّ).
   * جلسةٌ بنطاقٍ **لا يحمّل الصرفَ الأول** ⟵ `paidPersonIdsIn` فارغةٌ ⟵ حارسُ الذاكرة
   * **يمرّ**. ولولا القاعدةُ لصار الشخصُ مصروفاً له مرّتين في فترةٍ واحدة **بلا صوت**.
   */
  it("**وجلسةٌ عمياءُ بنطاقها تمرّ من حارس الذاكرة — فترميها القاعدة** (ق-٦٥)", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => pay(stores, ["u-teacher"]))

    // نطاقُ بلال لا يُحمّل صرفَ خالد — والذاكرةُ لا ترى ما لم تُحمَّل.
    const stores = freshPayrollStores(MAIN)
    const uow = payrollUnitOfWork(driver, stores, { tenantId: MAIN, scopePath: BILAL_PATH })
    await uow.hydrate()
    expect([...stores.payroll.paidPersonIdsIn(PERIOD.id)]).toEqual([])

    const seal = sealedPlan(BILAL_PATH, PERIOD.id, [{ personId: "u-teacher", netCents: 20_000 }])
    const world = seedWorld(MAIN)
    const done = disburse(
      stores,
      payrollContext({ world, actorPersonId: "u-finance", seal, payingUnit: () => BILAL_PATH }),
      {
        unitPath: BILAL_PATH,
        periodId: PERIOD.id,
        payingUnitId: BILAL,
        personIds: ["u-teacher"],
        memoAr: "صرفٌ من وحدةٍ أخرى في الفترة نفسِها",
      },
    )
    // **حارسُ الذاكرة مرّ** — وهذا هو بيتُ القصيد، لا عيبٌ في الخدمة بل حدُّ ما تراه.
    expect(done.ok).toBe(true)

    // **والقاعدةُ ترمي**: الفهرسُ الفريدُ `(tenant_id, period_id, person_id)` والدفعةُ معاملة.
    await expect(uow.flush()).rejects.toThrow(/UNIQUE|constraint/i)

    // **ولا نصفَ أثرٍ يبقى**: الصرفُ الأول وحدَه، ولا قيدَ للثاني.
    const payouts = await rowsOf(driver, "payroll_payouts")
    const persons = await rowsOf(driver, "payroll_payout_persons")
    expect(`صرف=${payouts.length} · أشخاص=${persons.length}`).toBe("صرف=1 · أشخاص=1")
    driver.close()
  })

  it("**وق-٦٦ كذلك**: (فترة × منطقة) لا تتكرر — قيدٌ في القاعدة لا ترشيحٌ في الذاكرة", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => {
      stores.payroll.appendDistribution({
        tenantId: MAIN,
        id: stores.payroll.nextId("dist"),
        periodId: PERIOD.id,
        toUnitPath: KHALID_PATH,
        at: new Date("2026-07-25T00:00:00.000Z"),
      })
    })

    const stores = freshPayrollStores(MAIN)
    const uow = payrollUnitOfWork(driver, stores, { tenantId: MAIN, scopePath: BILAL_PATH })
    await uow.hydrate()
    // نطاقُ بلال لا يرى توزيعَ خالد ⟵ `hasDistribution` تقول «لم يُوزَّع».
    expect(stores.payroll.hasDistribution(PERIOD.id, KHALID_PATH)).toBe(false)
    stores.payroll.appendDistribution({
      tenantId: MAIN,
      id: stores.payroll.nextId("dist"),
      periodId: PERIOD.id,
      toUnitPath: KHALID_PATH,
      at: new Date("2026-07-26T00:00:00.000Z"),
    })
    await expect(uow.flush()).rejects.toThrow(/UNIQUE|constraint/i)
    expect(await rowsOf(driver, "payroll_distributions")).toHaveLength(1)
    driver.close()
  })
})

// ═══ ٣) الذرّية العابرةُ للمستودعين ══════════════════════════════════════════

describe("الرواتب — الذرّية: لا قيدُ صرفٍ بلا سجلِّه ولا سجلٌّ بلا قيده", () => {
  it("رميةٌ داخل `atomically` ⟵ **صفرُ عبارةٍ للمستودعين معاً**", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    const stores = freshPayrollStores(MAIN)
    // **المصادرُ هي هي** لا نسخٌ منها: مصنعٌ ثانٍ لم يُحمَّل يُسقط حالةً لم يرها فيكذب الفارق.
    const ledgerSource = persistentLedger(stores.ledger)
    const payrollSource = persistentPayroll(stores.payroll)
    const auditSource = persistentAudit(stores.ledger.audit)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(ledgerSource)
    uow.enlist(payrollSource)
    uow.enlist(auditSource)
    await uow.hydrate()
    grant(stores, "adv-op-1")
    await uow.flush()

    expect(() =>
      stores.payroll.transaction(() =>
        stores.ledger.transaction(() => {
          grant(stores, "adv-doomed")
          throw new Error("إجهاضٌ متعمَّد بعد كتابة الطرفين")
        }),
      ),
    ).toThrow("إجهاضٌ متعمَّد")

    const payrollStatements = uow.statementsFor("payroll", payrollSource.project())
    const ledgerStatements = uow.statementsFor("ledger", ledgerSource.project())
    const auditStatements = uow.statementsFor("audit", auditSource.project())
    expect(
      `رواتب=${payrollStatements.length} · دفتر=${ledgerStatements.length} · تدقيق=${auditStatements.length}`,
    ).toBe("رواتب=0 · دفتر=0 · تدقيق=0")

    await uow.flush()
    expect(await rowsOf(driver, "payroll_advances")).toHaveLength(1)
    driver.close()
  })
})

// ═══ ٤) الختمُ الماليّ (T23) — **المختومُ لا يتغيّر بعد العبور** ═══════════════

describe("الرواتب — الختمُ لا يتغيّر بعد العبور (T23 · §٢-٣)", () => {
  it("**المعروضُ بعد الختم هو المختومُ وحدَه** على القاعدة الحقيقية، والفارقُ يُعلَن ولا يُطبَّق", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => pay(stores, ["u-teacher"], 20_000))

    await payrollSession(driver, MAIN, (stores) => {
      // خطةٌ مختومةٌ بـ٢٠٬٠٠٠، والاشتقاقُ الحيُّ صفرٌ (لا دروسَ معتمدة في هذه الجلسة).
      const seal = sealedPlan(KHALID_PATH, PERIOD.id, [{ personId: "u-teacher", netCents: 20_000 }])
      const view = monthlyPlan(stores, ctxWith(seal), {
        unitPath: KHALID_PATH,
        periodId: PERIOD.id,
        personIds: ["u-teacher"],
        from: new Date("2026-07-01T00:00:00.000Z"),
        to: new Date("2026-08-01T00:00:00.000Z"),
      })
      expect(view.stage).toBe("sealed")
      // **المختومُ هو المعروض** — لا الاشتقاقُ الحيّ.
      expect(view.totalNetCents).toBe(20_000)
      expect(view.lines.map((l) => l.netCents)).toEqual([20_000])
      // **والفارقُ يُعلَن ولا يُطبَّق**: يظهر ولا يغيّر قرشاً من المعروض.
      expect(view.drift.map((d) => `${d.personId}:${d.sealedNetCents}`)).toEqual([
        "u-teacher:20000",
      ])
      // **و«مدفوعٌ» مشتقٌّ من السجلّ الذي عبر** — لا حقلٌ في اللقطة المختومة.
      expect(view.paidPersonIds).toEqual(["u-teacher"])
    })
    driver.close()
  })
})

// ═══ ٥) عزلُ الشبكة والنطاق ══════════════════════════════════════════════════

describe("الرواتب — عزلُ الشبكة والنطاق", () => {
  it("سلفةُ شبكةٍ **لا تُقرأ** من الأخرى ولو تطابق المسارُ النسبيُّ حرفاً (قب-١٨)", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await seedPayrollSession(driver, OTHER)
    await payrollSession(driver, OTHER, (stores) => grant(stores, "adv-other"))

    await payrollSession(driver, MAIN, (stores) => {
      expect(stores.payroll.advances()).toEqual([])
    })
    const mine = await driver.all({
      sql: "SELECT id FROM payroll_advances WHERE tenant_id = ?",
      params: [MAIN],
    })
    expect(mine).toEqual([])
    driver.close()
  })

  it("**والتضييقُ بالمسار يُنقص المحمول فعلاً** (النمط أ): رقمان لا رأي", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => grant(stores, "adv-op-1"))

    const atSection = await payrollSession(
      driver,
      MAIN,
      (stores) => stores.payroll.advances().length,
      MEN_PATH,
    )
    const atBilal = await payrollSession(
      driver,
      MAIN,
      (stores) => stores.payroll.advances().length,
      BILAL_PATH,
    )
    expect(`قسم=${atSection} · بلال=${atBilal}`).toBe("قسم=1 · بلال=0")
    driver.close()
  })
})

// ═══ ٦) نطاقُ التدقيق ════════════════════════════════════════════════════════

describe("الرواتب — قيدُ التدقيق يقول نطاقَه ويظهر فيه (CR-027)", () => {
  it("`payroll.payout.record` نطاقُه **وحدةُ الصرف**، ويُقرأ من نطاقها وممّا يحويه", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => pay(stores, ["u-teacher"]))

    const rows = (await driver.all({
      sql: "SELECT unit_path, scope_exact, before, after FROM audit_log WHERE action = ?",
      params: ["payroll.payout.record"],
    })) as Record<string, unknown>[]
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!["unit_path"])).toBe(KHALID_PATH)
    expect(rows[0]!["scope_exact"]).toBe(1)
    expect(rows[0]!["before"]).toBeNull()
    expect(String(rows[0]!["after"])).toContain(PERIOD.id)

    await payrollSession(driver, MAIN, (stores) => {
      const count = (path: string): number =>
        stores.ledger.audit.listInScope(path, 50).filter((e) => e.action === "payroll.payout.record")
          .length
      expect(`خالد=${count(KHALID_PATH)} · قسم=${count(MEN_PATH)} · بلال=${count(BILAL_PATH)}`).toBe(
        "خالد=1 · قسم=1 · بلال=0",
      )
    })
    driver.close()
  })
})

// ═══ ٧) الحتميّةُ عبر الجلسات وتحت نطاقٍ جزئيّ ═══════════════════════════════

describe("الرواتب — الحتميّة: عدّادٌ واحدٌ لخمس بادئات يُستأنف ولا يدهس", () => {
  it("جلسةٌ بنطاقٍ **جزئيّ** لا تُعيد استعمال معرّفٍ محفوظ — ولو لبادئةٍ أخرى", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => {
      grant(stores, "adv-op-1")
      pay(stores, ["u-teacher"], 20_000, KHALID_PATH, 30_000)
    })
    // `adv-1` ثم `pay-2` ثم `ins-3` (قسطُ السلفة داخل الصرف) ⟵ العدّادُ بلغ ٣.
    const stored = (await driver.all({
      sql: "SELECT value FROM sequences WHERE tenant_id = ? AND name = ?",
      params: [MAIN, "payroll.seq"],
    })) as Record<string, unknown>[]
    expect(Number(stored[0]!["value"])).toBe(3)

    await payrollSession(
      driver,
      MAIN,
      (stores) => {
        expect(stores.payroll.advances()).toEqual([])
        expect(stores.payroll.nextId("dist")).toBe("dist-4")
      },
      BILAL_PATH,
    )
    driver.close()
  })

  /**
   * **كلُّ بادئةٍ تُقاس وحدَها** — لا مجتمعةً. قِستُهنّ أوّلاً في جلسةٍ واحدةٍ فيها بادئتان،
   * فوجدتُ أن نسيانَ إحداهما **لا يُحمّر الاختبار**: الأخرى تبلغ الرقمَ نفسَه فتستره
   * (فخّ ٦-ب: حارسٌ يمرّ في الحالتين ليس حارساً). فصار لكلِّ بادئةٍ **جلستُها الخالصة**.
   */
  it("**والعدّادُ يمسح البادئاتِ الخمس** — كلُّ بادئةٍ وحدَها، فلا تستر إحداهما نسيانَ أختها", async () => {
    for (const prefix of ["adv", "ins", "pay", "dist", "inc"] as const) {
      const driver = await freshDb()
      await seedPayrollSession(driver, MAIN)
      await payrollSession(driver, MAIN, (stores) => {
        switch (prefix) {
          case "adv":
            grant(stores, "adv-solo")
            break
          case "ins":
            // القسطُ يُولَد **داخل الصرف** — فتُبذَر سلفةٌ ثم يُصرف بإجماليٍّ يسع قسطَها.
            grant(stores, "adv-for-ins")
            pay(stores, ["u-teacher"], 20_000, KHALID_PATH, 30_000)
            break
          case "pay":
            pay(stores, ["u-teacher"])
            break
          case "dist":
            stores.payroll.appendDistribution({
              tenantId: MAIN,
              id: stores.payroll.nextId("dist"),
              periodId: PERIOD.id,
              toUnitPath: KHALID_PATH,
              at: new Date("2026-07-25T00:00:00.000Z"),
            })
            break
          case "inc": {
            const done = grantIncentive(stores, ctxWith(undefined), {
              personId: "u-teacher",
              unitId: KHALID,
              operationId: "inc-solo",
              amountCents: c(5_000),
              memoAr: "حافز",
            })
            if (!done.ok) throw new Error(done.error.code)
            break
          }
        }
      })

      const stored = (await driver.all({
        sql: "SELECT value FROM sequences WHERE tenant_id = ? AND name = ?",
        params: [MAIN, "payroll.seq"],
      })) as Record<string, unknown>[]
      const value = Number(stored[0]?.["value"] ?? 0)
      // **العدّادُ المحفوظ يبلغ ما بلغته البادئةُ** — وإن نُسيت في الاشتقاق بقي دونه.
      expect(`${prefix}:${value >= 1}`).toBe(`${prefix}:true`)
      // **والجلسةُ التالية لا تُعيد رقماً مستهلَكاً** — وهو الضررُ الحقيقيّ للنسيان.
      await payrollSession(driver, MAIN, (stores) => {
        expect(`${prefix}:${stores.payroll.nextId("adv")}`).toBe(`${prefix}:adv-${value + 1}`)
      })
      driver.close()
    }
  })
})

// ═══ ٨) G23 ═════════════════════════════════════════════════════════════════

describe("الرواتب — G23: السقفُ يرمي مُسمِّياً مصدرَه وجدولَه", () => {
  it("سقفٌ مكسورٌ إلى **أقرب قيمةٍ خاطئةٍ مشروعة** ⟵ رميةٌ تحمل اسمَ المصدر والجدول", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => {
      pay(stores, ["u-teacher", "u-amir"], 20_000)
    })

    const stores = freshPayrollStores(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist({ ...persistentPayroll(stores.payroll), rowBudget: 3 })
    await expect(uow.hydrate()).rejects.toThrow(LoadBudgetExceededError)
    await expect(uow.hydrate()).rejects.toThrow(/«payroll»/)
    await expect(uow.hydrate()).rejects.toThrow(/payroll_payout_persons=2/)
    driver.close()
  })
})

// ═══ ٩) شرطُ قب-٤٩ + حوافُّ التغطية + السلب ══════════════════════════════════

describe("الرواتب — شرطُ قب-٤٩ وحوافُّ التغطية", () => {
  it("`payrollStoresFor` تحقن سجلاً **واحداً** — لا سجلَّ ثانياً يُنشئه الدفترُ لنفسه", () => {
    const audit = new AuditJournal(MAIN)
    expect(payrollStoresFor(MAIN, audit).ledger.audit).toBe(audit)
    expect(payrollStoresFor(MAIN).ledger.audit).toBeInstanceOf(AuditJournal)
  })

  it("**والتسلسلُ متّصلٌ عبر الجلسات** بمصدرٍ واحد — لا يبدأ من ١ فيدهس سابقَه", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => grant(stores, "adv-op-1"))
    await payrollSession(driver, MAIN, (stores) => grant(stores, "adv-op-2"))

    const rows = (await driver.all({
      sql: "SELECT source, seq FROM audit_log WHERE tenant_id = ? ORDER BY seq",
      params: [MAIN],
    })) as Record<string, unknown>[]
    expect(new Set(rows.map((r) => String(r["source"])))).toEqual(new Set(["audit"]))
    expect(rows.map((r) => Number(r["seq"]))).toEqual(rows.map((_, i) => i + 1))
    expect(rows.length).toBeGreaterThanOrEqual(2)
    driver.close()
  })

  /**
   * **حافةُ التغطية الأولى** (وصفة §٦): فرعُ `throw` في اشتقاق المسار. وهو **قابلٌ للبلوغ
   * لأن الإسقاط يعدّ الأقساط مباشرةً** (`instalments()`) لا عبر سلفها: لو عدّها عبر سلفها
   * لاختفى اليتيمُ من الإسقاط **صامتاً** — محوٌ في جدولٍ ملحقٍ فقط بدل رميةٍ تُسمّيه.
   */
  it("**مفتاحُ توجيهٍ لا يُشتقّ ⟵ رميةٌ** — قسطٌ يشير إلى سلفةٍ مجهولة، لا توجيهٌ صامت", () => {
    const store = new PayrollStore(MAIN)
    store.appendInstalment({
      tenantId: MAIN,
      id: "ins-1",
      advanceId: "adv-مجهولة",
      periodId: PERIOD.id,
      entryId: "je-1",
      amountCents: c(100),
    })
    expect(() => persistentPayroll(store).project()).toThrow(/مفتاحُ توجيهٍ لا يُشتقّ/)
    expect(() => persistentPayroll(store).project()).toThrow(/adv-مجهولة/)
  })

  /**
   * **حافةُ التغطية الثانية بوجهها الحقيقيّ**: كان هنا `?? []` **لا يُبلَغ أبداً** (صفوفُ
   * الأشخاص ترث مسارَ صرفها فتُحمَّل معه في كلِّ نطاق). و«فرعٌ لا يُبلَغ» **دفاعٌ يشتري
   * طمأنينةً بلا ثمن**: لو وقع فعلاً لأنتج **دفعةً فارغةً تمرّ صامتة** فتُسقط «مَن صُرف له»
   * وتُبطل حارسَ «لا صرفَ مرتين» معها. فصار **رميةً تُسمّي الصرف** — والفرعُ صار مقيساً.
   */
  it("**صرفٌ بلا مَن صُرف له ⟵ رميةٌ** — لا دفعةٌ فارغةٌ تمرّ صامتة (ق-٦٥)", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => pay(stores, ["u-teacher"]))
    // **أقربُ قيمةٍ خاطئةٍ مشروعة**: صفُّ الصرف باقٍ وصفوفُ أشخاصه ذهبت (فسادُ بيانات).
    await driver.batch([
      { sql: "DELETE FROM payroll_payout_persons WHERE tenant_id = ?", params: [MAIN] },
    ])
    const stores = freshPayrollStores(MAIN)
    const uow = payrollUnitOfWork(driver, stores, { tenantId: MAIN, scopePath: "/" })
    await expect(uow.hydrate()).rejects.toThrow(/صرفٌ بلا مَن صُرف له/)
    driver.close()
  })

  it("`load(new Map())` — قاعدةٌ فارغةٌ تُنتج مستودعاً فارغاً وعدّاداً من الصفر", () => {
    const store = new PayrollStore(MAIN)
    persistentPayroll(store).load(new Map())
    expect(store.advances()).toEqual([])
    expect(store.payouts()).toEqual([])
    expect(store.distributions()).toEqual([])
    expect(store.incentives()).toEqual([])
    expect(store.nextId("adv")).toBe("adv-1")
  })

  it("**والمُطالبةُ بالعدّاد تفصل صفَّ الرواتب عن صفوف غيره** (`owns`)", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => grant(stores, "adv-op-1"))
    const names = ((await rowsOf(driver, "sequences")) as Record<string, unknown>[])
      .map((r) => String(r["name"]))
      .sort()
    expect(names).toContain("payroll.seq")
    expect(names).toContain("ledger.seq")
    expect(names).toContain("audit.seq")
    driver.close()
  })

  it("**ولا محوَ لواقعةٍ مالية**: صفٌّ يختفي من الإسقاط يُرمى ولا يُترجم `DELETE` (المادة ٧/٤)", async () => {
    const driver = await freshDb()
    await seedPayrollSession(driver, MAIN)
    await payrollSession(driver, MAIN, (stores) => {
      grant(stores, "adv-op-1")
      grant(stores, "adv-op-2", "u-amir")
    })
    const stores = freshPayrollStores(MAIN)
    const uow = payrollUnitOfWork(driver, stores, { tenantId: MAIN, scopePath: "/" })
    await uow.hydrate()
    const projected = persistentPayroll(stores.payroll).project()
    const advances = new Map(projected.get("payroll_advances")!)
    advances.delete([...advances.keys()][0]!)
    expect(() =>
      uow.statementsFor("payroll", new Map([["payroll_advances", advances]])),
    ).toThrow(/محوٌ ممنوع: صفٌّ اختفى من payroll_advances/)
    driver.close()
  })

})
