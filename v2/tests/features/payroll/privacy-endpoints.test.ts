/**
 * **الاختباران الإلزاميّان الثامن والتاسع** (عقدُ الوحدة §٨/§١٢):
 * **ق-٣٠ — الأميرُ لا يرى الرواتب المركزية: يمتنع بالنموذج** · **عزلُ الشبكة والنطاق** ·
 * **مصفوفةُ الأدوار** على سطوح الوحدة.
 *
 * **والبرهانُ بالطبقتين معاً** (TESTING_POLICY §٤/٣): **غيابٌ في الشاشة مقروناً برفض
 * الخادم** — إخفاءُ الزر وحده ليس نجاحاً، ورفضُ الخادم وحده يترك واجهةً تكذب.
 *
 * وحالاتُ السلب هنا **أضعافُ الإيجاب** عمداً: النظامُ الآمن يُعرَّف بما يمنعه.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { makePayrollEndpoints } from "../../../src/features/payroll/server/endpoints.js"
import { computePayrollCaps } from "../../../src/features/payroll/screens/caps.js"
import {
  EMPTY_PAYROLL_SNAPSHOT,
  payrollScreenNodes,
  payslipScreenNodes,
} from "../../../src/features/payroll/screens/screens.js"
import { PayrollTenantRegistry } from "../../../src/features/payroll/data/tenant.js"
import { PayrollStore } from "../../../src/features/payroll/data/store.js"
import { grantAdvance } from "../../../src/features/payroll/services/advances.js"
import { balanceProof } from "../../../src/features/ledger/services/journal.js"
import type { UiNode } from "../../../src/ui/components/kernel.js"
import type { Cents } from "../../../src/features/ledger/types.js"
import {
  ACCOUNTS,
  DECISION,
  FROM,
  KHALID_PATH,
  PERIOD,
  SECOND_TENANT_ID,
  TO,
  WRITE,
  canonicalActor,
  payrollContext,
  seedLedger,
  seedWorld,
  type PayrollWorld,
} from "./_seed.js"

beforeEach(() => clearRegistryForTests())

function endpoints(world: PayrollWorld = seedWorld()) {
  const ep = makePayrollEndpoints(
    world.stores,
    (actor, request) => ({
      ...payrollContext({ world }),
      now: request.now,
      actorPersonId: actor.personId,
    }),
    () => ({ from: FROM, to: TO, personIds: ["u-teacher"] }),
  )
  return { world, ep }
}

/** يجمع كلَّ قدرةٍ مُعلَنةٍ في شجرة العرض — **فحصُ غيابٍ صريح** لا انطباعٌ بصريّ. */
function declaredCaps(node: UiNode, out: Set<string> = new Set()): ReadonlySet<string> {
  if (node.capability !== undefined) out.add(String(node.capability))
  for (const child of node.children ?? []) declaredCaps(child, out)
  return out
}

// ═══ الاختبار الإلزاميّ الثامن — ق-٣٠ ═════════════════════════════════════════

describe("**ق-٣٠ — الأميرُ يُمنع من الرواتب المركزية: بالغياب في الشاشة ورفضِ الخادم معاً**", () => {
  it("**١) في المصفوفة الذهبية**: الأميرُ يملك `payroll.own` **وحدَها** — المنعُ خليّةٌ لا `if`", () => {
    const caps = computePayrollCaps(canonicalActor("u-amir"), KHALID_PATH, DECISION)
    expect([...caps], "لا عرضٌ ولا احتسابٌ ولا صرف").toEqual([])
  })

  it("**٢) وفي الشاشة**: شاشةُ الرواتب المركزية تُظهر له **فراغَ المطّلع بلا رقمٍ واحد**", () => {
    const caps = computePayrollCaps(canonicalActor("u-amir"), KHALID_PATH, DECISION)
    const screen = payrollScreenNodes(caps, {
      ...EMPTY_PAYROLL_SNAPSHOT,
      totalAr: "٩٩٩٩",
      rows: [{ person: "u-teacher", gross: "٩٩٩٩", net: "٩٩٩٩", why: "", deduction: "", paid: "" }],
    })
    expect(screen.component, "فراغُ المطّلع لا صفحةُ رواتب").toBe("EmptyState")
    expect(JSON.stringify(screen), "**ولا رقمَ يتسرّب في شجرة العرض**").not.toContain("٩٩٩٩")
  })

  it("**٣) وفي الخادم**: استدعاؤه المباشرَ لِـ`payroll.plan.view` **مرفوضٌ بـ`can()`**", async () => {
    const { ep } = endpoints()
    const outcome = await ep.planView.invoke(
      { unitId: "khalid", periodId: PERIOD.id },
      canonicalActor("u-amir"),
      DECISION,
    )
    expect(outcome.ok, "تجاوزُ الواجهة لا ينفع — الحمايةُ في الخادم").toBe(false)
  })

  it("**٤) ولا يصرف ولا يمنح سلفةً ولا حافزاً** — ثلاثةُ أبوابٍ مغلقةٌ في وجهه", async () => {
    const { ep } = endpoints()
    const amir = canonicalActor("u-amir")

    const payout = await ep.payout.invoke(
      { unitPath: KHALID_PATH, periodId: PERIOD.id, payingUnitId: "khalid", personIds: ["u-teacher"], memoAr: "م" },
      amir,
      WRITE,
    )
    expect(payout.ok).toBe(false)

    const advance = await ep.advance.invoke(
      { personId: "u-teacher", unitId: "khalid", operationId: "a1", principalCents: 100 as Cents, instalmentCents: 10 as Cents, memoAr: "م" },
      amir,
      WRITE,
    )
    expect(advance.ok).toBe(false)

    const incentive = await ep.incentive.invoke(
      { personId: "u-teacher", unitId: "khalid", operationId: "i1", amountCents: 100 as Cents, memoAr: "م" },
      amir,
      WRITE,
    )
    expect(incentive.ok).toBe(false)
  })

  it("**٥) لكنه يرى كشفَ راتبه هو** — الخصوصيةُ ليست حرماناً من حقّه (ق-٢٩)", async () => {
    const { ep } = endpoints()
    const outcome = await ep.payslip.invoke(
      { personId: "u-amir", periodId: PERIOD.id, unitPath: KHALID_PATH },
      canonicalActor("u-amir"),
      DECISION,
    )
    expect(outcome.ok).toBe(true)
  })

  it("**٦) ولا يرى كشفَ غيره** — والقدرةُ الشخصية لا يفتحها الشمولُ حتى للمدير (ق-٢٧/ق-٢٩)", async () => {
    const { ep } = endpoints()
    for (const personId of ["u-amir", "u-teacher"]) {
      const outcome = await ep.payslip.invoke(
        { personId, periodId: PERIOD.id, unitPath: KHALID_PATH },
        canonicalActor("u-admin"),
        DECISION,
      )
      expect(outcome.ok, `المديرُ يطلب كشفَ ${personId}`).toBe(false)
    }
  })
})

// ═══ مصفوفةُ الأدوار على سطوح الوحدة — **السلبُ أكثرُ من الإيجاب** ═══════════

describe("مصفوفةُ الأدوار على السطوح الستّ — والفصلُ بين مَن يقترح ومَن يصرف (ب-٣٣)", () => {
  it("السطوحُ الستُّ تعلن قدرتَها ونطاقَها ونيّتَها واسمَ فعلها (G7)", () => {
    const { ep } = endpoints()
    const declared = Object.values(ep).map((fn) => fn.declaration)
    expect(declared).toHaveLength(6)
    for (const d of declared) {
      expect(d.capability).not.toBe("PUBLIC_DECLARED")
      expect(d.scope).toBeTypeOf("function")
      expect(d.audit.length).toBeGreaterThan(0)
    }
    expect(declared.map((d) => d.name).sort()).toEqual([
      "payroll.advance.grant",
      "payroll.distribution.view",
      "payroll.incentive.grant",
      "payroll.payout.record",
      "payroll.payslip.own",
      "payroll.plan.view",
    ])
  })

  it("**المسؤولُ الماليّ يرى الخطة ويصرف** (ب-٣٣ب) — وهو الطريقُ العاديّ", async () => {
    const { ep } = endpoints()
    const outcome = await ep.planView.invoke(
      { unitId: "khalid", periodId: PERIOD.id },
      canonicalActor("u-finance"),
      DECISION,
    )
    expect(outcome.ok).toBe(true)
  })

  it("**والمديرُ يرى ولا يصرف**: `finance.payout` ليست له — فمن يقرّ لا يصرف", async () => {
    const { ep } = endpoints()
    const admin = canonicalActor("u-admin")

    expect((await ep.planView.invoke({ unitId: "khalid", periodId: PERIOD.id }, admin, DECISION)).ok).toBe(true)
    expect(
      (
        await ep.payout.invoke(
          { unitPath: KHALID_PATH, periodId: PERIOD.id, payingUnitId: "khalid", personIds: ["u-teacher"], memoAr: "م" },
          admin,
          WRITE,
        )
      ).ok,
      "**فصلُ المهام مرسومٌ في المصفوفة قبل سطر الكود**",
    ).toBe(false)
  })

  it("**والمعلّمُ والطالبُ ومسؤولُ اللجنة: لا شيءَ لهم على سطح الرواتب المركزية**", async () => {
    const { ep } = endpoints()
    for (const personId of ["u-teacher", "u-student", "u-committee-head"]) {
      const outcome = await ep.planView.invoke(
        { unitId: "khalid", periodId: PERIOD.id },
        canonicalActor(personId),
        DECISION,
      )
      expect(outcome.ok, personId).toBe(false)
    }
  })

  it("**والوحدةُ المجهولة ⇒ `NO_SCOPE` ⇒ رفضٌ يُقفل ولا يُفتح** ولو كان الفاعلُ مديراً", async () => {
    const { ep } = endpoints()
    const outcome = await ep.planView.invoke(
      { unitId: "وحدةٌ-لا-وجودَ-لها", periodId: PERIOD.id },
      canonicalActor("u-admin"),
      DECISION,
    )
    expect(outcome.ok).toBe(false)
  })

  it("**وخريطةُ التوزيع بقدرة العرض** — لا يراها مَن لا يرى الرواتب", async () => {
    const { ep } = endpoints()
    expect(
      (await ep.distribution.invoke({ unitId: "khalid", periodId: PERIOD.id, unitPaths: [] }, canonicalActor("u-amir"), DECISION)).ok,
    ).toBe(false)
    expect(
      (await ep.distribution.invoke({ unitId: "khalid", periodId: PERIOD.id, unitPaths: [] }, canonicalActor("u-admin"), DECISION)).ok,
    ).toBe(true)
  })

  it("**وشاشةُ «كشفُ راتبي» تُبنى لصاحبها وتغيب عمّن لا يملكها**", () => {
    const withOwn = payslipScreenNodes(new Set(["payroll.own"]), EMPTY_PAYROLL_SNAPSHOT)
    expect(declaredCaps(withOwn)).toContain("payroll.own")

    const without = payslipScreenNodes(new Set(), EMPTY_PAYROLL_SNAPSHOT)
    expect(without.component).toBe("EmptyState")
  })

  it("**ولا يظهر زرُّ التسليم قبل الختم** — النموذجُ لا يتيحه، لا الشاشةُ تُخفيه (ع-٢١)", () => {
    const caps = new Set(["payroll.view", "finance.payout", "payroll.run"] as const)
    const before = JSON.stringify(payrollScreenNodes(caps, EMPTY_PAYROLL_SNAPSHOT))
    const after = JSON.stringify(
      payrollScreenNodes(caps, { ...EMPTY_PAYROLL_SNAPSHOT, stage: "sealed" }),
    )
    expect(before).toContain("payroll.submit")
    expect(before, "لا تسليمَ على غير مختوم").not.toContain("payroll.payout")
    expect(after).toContain("payroll.payout")
  })
})

// ═══ الاختبار الإلزاميّ التاسع — عزلُ الشبكة (قب-١٨) ══════════════════════════

describe("**قب-١٨ — عزلُ الشبكة بنيويّ**: التطابقُ النسبيُّ للمسار لا يسرّب", () => {
  it("مستودعا الشبكة **مقترنان**، وكلُّ شبكةٍ تُعطى حزمتَها هي", () => {
    const registry = new PayrollTenantRegistry()
    const main = registry.storesFor("t-main")
    const second = registry.storesFor(SECOND_TENANT_ID)

    expect(main.ledger.tenantId).toBe("t-main")
    expect(main.payroll.tenantId).toBe("t-main")
    expect(second.ledger.tenantId).toBe(SECOND_TENANT_ID)
    expect(second.payroll).not.toBe(main.payroll)
    expect(registry.storesFor("t-main"), "ونفسُها تُعاد لا نسخةٌ جديدة").toBe(main)
    expect(registry.tenantIds().sort()).toEqual(["t-main", SECOND_TENANT_ID].sort())
    expect(registry.has("t-main")).toBe(true)
    expect(registry.has("t-none")).toBe(false)
  })

  it("**سلفةٌ في شبكةٍ لا تُرى في أخرى** ولو تطابق المسارُ النسبيّ حرفياً", () => {
    const world = seedWorld()
    const other = { ledger: seedLedger(SECOND_TENANT_ID), payroll: new PayrollStore(SECOND_TENANT_ID) }

    const granted = grantAdvance(world.stores, payrollContext({ world }), {
      personId: "u-teacher",
      unitId: "khalid",
      operationId: "adv-iso",
      principalCents: 1000 as Cents,
      instalmentCents: 100 as Cents,
      memoAr: "سلفة",
    })
    expect(granted.ok).toBe(true)

    expect(world.stores.payroll.advances()).toHaveLength(1)
    expect(other.payroll.advances(), "**الشبكةُ الأخرى لا ترى شيئاً**").toHaveLength(0)
    expect(other.ledger.entries()).toHaveLength(0)
    expect(world.stores.payroll.advances()[0]?.tenantId, "والشبكةُ مختومةٌ من المستودع").toBe("t-main")
  })

  it("**وبرهانُ التوازن يصمد في كلتا الشبكتين** (ق-٧٢)", () => {
    const world = seedWorld()
    grantAdvance(world.stores, payrollContext({ world }), {
      personId: "u-teacher",
      unitId: "khalid",
      operationId: "adv-b",
      principalCents: 700 as Cents,
      instalmentCents: 100 as Cents,
      memoAr: "سلفة",
    })
    expect(balanceProof(world.stores.ledger).balanced).toBe(true)
    expect(balanceProof(seedLedger(SECOND_TENANT_ID)).balanced).toBe(true)
  })

  it("**ومراجعُ الحسابات بياناتٌ محقونة** لا ثوابتُ كودٍ في الوحدة (§٤)", () => {
    const world = seedWorld()
    const ctx = payrollContext({ world })
    expect(ctx.accounts).toEqual(ACCOUNTS)
    for (const id of Object.values(ACCOUNTS)) {
      expect(world.stores.ledger.getAccount(id), `${id} حسابٌ في شجرة النواة`).not.toBeNull()
    }
  })
})
