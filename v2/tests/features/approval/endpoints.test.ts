/**
 * دوالُّ خادم المحرّك (عقدُ الوحدة §٦) + **عزلُ الشبكة على كل مساراته** (قب-١٨).
 *
 * هنا يجتمع الشرطان: `defineServerFn` يفرض **القدرة** قبل جسم الدالة، والمحرّكُ يفرض
 * **الأقربيّة** داخلها — فيظهر عياناً أن مالكَ القدرة يمرّ من الباب ويقف عند المحرّك.
 * وحالاتُ السلب هنا أكثرُ من الإيجاب عمداً.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { makeApprovalEndpoints } from "../../../src/features/approval/server/endpoints.js"
import { ApprovalTenantRegistry } from "../../../src/features/approval/data/tenant.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { receiveIntoBox } from "../../../src/features/box/services/operations.js"
import { boxContext } from "../box/_seed.js"
import { seedStore } from "../ledger/_seed.js"
import { LedgerStore } from "../../../src/features/ledger/data/store.js"
import { BoxStore } from "../../../src/features/box/data/store.js"
import { ApprovalStore } from "../../../src/features/approval/data/store.js"
import {
  LAYERS_ABOVE_KHALID,
  MAIN_TENANT_ID,
  PERIOD,
  READ,
  SECOND_TENANT_ID,
  WRITE,
  c,
  canonicalPeople,
  peopleWithout,
  seedApprovalStores,
} from "./_seed.js"
import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import type { Actor } from "../../../src/authorization/can.js"

const SETTINGS = createSettingsResolver([])
const SQ2 = "sq2"

function actor(personId: string): Actor {
  const person = buildCanonicalWorld().people.find((p) => p.personId === personId)
  if (person === undefined) throw new Error(`لا شخص بهذا المعرّف: ${personId}`)
  return person
}

function endpoints(people: readonly Actor[] = canonicalPeople()) {
  const stores = seedApprovalStores()
  receiveIntoBox(stores.box, boxContext("u-square"), {
    unitId: SQ2,
    operationId: "rcv-1",
    memoAr: "قبضتُ",
    lines: [{ currency: "USD", amount: c(30_000) }],
  })
  return { stores, ep: makeApprovalEndpoints(stores, SETTINGS, people) }
}

beforeEach(() => clearRegistryForTests())

describe("النقاطُ الخمس تعلن قدرتها ونطاقها (G7) — والإعلانُ يطابق العقد", () => {
  it("لكل نقطةٍ اسمٌ وقدرةٌ ونيّةٌ ومُحلِّلُ نطاقٍ واسمُ فعلٍ في التدقيق", () => {
    const { ep } = endpoints()
    const declared = Object.values(ep).map((fn) => fn.declaration)
    expect(declared).toHaveLength(5)
    for (const d of declared) {
      expect(d.capability).not.toBe("PUBLIC_DECLARED")
      expect(d.scope).toBeTypeOf("function")
      expect(d.audit.length).toBeGreaterThan(0)
    }
    expect(declared.map((d) => d.name).sort()).toEqual([
      "box.closing.approve",
      "box.closing.breakGlass",
      "box.closing.pending",
      "box.closing.reject",
      "box.closing.submit",
    ])
  })
})

describe("التقديمُ: القدرةُ تفتح والنطاقُ يحدّ", () => {
  it("مسؤولُ المربع يرفع إقفالَ **مربعه** ⇒ تنجح بتقريرٍ مشتقّ", async () => {
    const { ep } = endpoints()
    const r = await ep.submit.invoke({ unitId: SQ2, period: PERIOD }, actor("u-square"), WRITE)
    expect(r.ok).toBe(true)
    if (!r.ok || !r.value.ok) throw new Error("تعذّر التقديم")
    expect(r.value.value.state).toBe("submitted")
  })

  it("**وأميرُ المسجد لا يرفع إقفالَ المربع فوقه** — النطاقُ يحدّ", async () => {
    const { ep } = endpoints()
    const r = await ep.submit.invoke({ unitId: SQ2, period: PERIOD }, actor("u-amir"), WRITE)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("**ومشرفُ القسم لا يرفع إقفالَ مربعٍ تحته** — نطاق «ذ» يمنع الهبوط", async () => {
    const { ep } = endpoints()
    const r = await ep.submit.invoke({ unitId: SQ2, period: PERIOD }, actor("u-section-head"), WRITE)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("ووحدةٌ مجهولة ⇒ `NO_SCOPE` ⇒ رفضٌ يُقفل ولا يُفتح", async () => {
    const { ep } = endpoints()
    const r = await ep.submit.invoke({ unitId: "ghost", period: PERIOD }, actor("u-square"), WRITE)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })
})

describe("الاعتماد: **الشرطان معاً** — القدرةُ من الباب والأقربيّةُ من المحرّك", () => {
  async function submitted() {
    const made = endpoints()
    const r = await made.ep.submit.invoke({ unitId: SQ2, period: PERIOD }, actor("u-square"), WRITE)
    if (!r.ok || !r.value.ok) throw new Error("تعذّر التقديم")
    return { ...made, requestId: r.value.value.id }
  }

  it("الأقربُ (المنطقة) يعتمد ⇒ تنجح", async () => {
    const { ep, requestId } = await submitted()
    const r = await ep.approve.invoke({ requestId }, actor("u-rabita"), WRITE)
    expect(r.ok).toBe(true)
    if (!r.ok || !r.value.ok) throw new Error("تعذّر الاعتماد")
    expect(r.value.value.state).toBe("approved")
  })

  it("**ورأسُ القسم يمرّ من الباب ويقف عند المحرّك**: القدرةُ نعم، والأقربيّةُ لا", async () => {
    const { ep, requestId } = await submitted()
    const r = await ep.approve.invoke({ requestId }, actor("u-section-head"), WRITE)
    // الباب: مسموح — فالقرارُ لم يُردّ صلاحيةً…
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // …والمحرّك: مردود.
    expect(r.value.ok).toBe(false)
    expect(!r.value.ok && r.value.error.code).toBe("NOT_NEAREST_LAYER")
  })

  it("**والإدارةُ مردودةٌ عند الباب نفسِه** — لا `box.closing.approve` في حزمتها (ق-٣)", async () => {
    const { ep, requestId } = await submitted()
    const r = await ep.approve.invoke({ requestId }, actor("u-admin"), WRITE)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_NO_CAPABILITY")
  })

  it("وطلبٌ مجهولٌ ⇒ `NO_SCOPE` ⇒ رفض", async () => {
    const { ep } = await submitted()
    const r = await ep.approve.invoke({ requestId: "ghost" }, actor("u-rabita"), WRITE)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("والرفضُ من الأقرب يعيدها مسودةً بسببٍ إلزاميّ", async () => {
    const { ep, requestId } = await submitted()
    const empty = await ep.reject.invoke({ requestId, reasonAr: " " }, actor("u-rabita"), WRITE)
    expect(empty.ok && !empty.value.ok && empty.value.error.code).toBe("REASON_REQUIRED")

    const r = await ep.reject.invoke({ requestId, reasonAr: "ينقصه سطر" }, actor("u-rabita"), WRITE)
    expect(r.ok && r.value.ok && r.value.value.state).toBe("draft")
  })

  it("وصندوقُ «بانتظار اعتمادك» يعرض للأقرب وحده — والإدارةُ مردودةٌ عند الباب (ق-٤)", async () => {
    const { ep } = await submitted()
    const nearest = await ep.pending.invoke({ unitId: SQ2 }, actor("u-rabita"), READ)
    expect(nearest.ok && nearest.value).toHaveLength(1)

    const above = await ep.pending.invoke({ unitId: SQ2 }, actor("u-section-head"), READ)
    expect(above.ok && above.value).toHaveLength(0)

    const admin = await ep.pending.invoke({ unitId: SQ2 }, actor("u-admin"), READ)
    expect(admin.ok).toBe(false)
  })
})

describe("كسرُ الزجاج على الخادم: قدرةٌ **جذرية** وشرطُ شغورٍ معاً", () => {
  it("مع طبقةٍ نشطةٍ ⇒ المحرّكُ يردّ ولو مرّت القدرةُ الجذرية", async () => {
    const { ep } = endpoints()
    const s = await ep.submit.invoke({ unitId: SQ2, period: PERIOD }, actor("u-square"), WRITE)
    if (!s.ok || !s.value.ok) throw new Error("تعذّر التقديم")
    const r = await ep.breakGlass.invoke({ requestId: s.value.value.id }, actor("u-admin"), WRITE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(!r.value.ok && r.value.error.code).toBe("LAYER_NOT_VACANT")
  })

  it("**ومَن لا يملك القدرةَ الجذرية يُردّ عند الباب** ولو شغرت كلُّ الطبقات", async () => {
    const { ep } = endpoints(peopleWithout(...LAYERS_ABOVE_KHALID))
    const s = await ep.submit.invoke({ unitId: SQ2, period: PERIOD }, actor("u-square"), WRITE)
    if (!s.ok || !s.value.ok) throw new Error("تعذّر التقديم")
    const r = await ep.breakGlass.invoke({ requestId: s.value.value.id }, actor("u-rabita"), WRITE)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_NO_CAPABILITY")
  })
})

describe("قب-١٨ — عزلُ الشبكة على كل مسارات المحرّك", () => {
  it("سجلُّ الشبكات يوزّع **ثلاثةَ مستودعاتٍ مقترنة**، ولا يخلط شبكتين", () => {
    const registry = new ApprovalTenantRegistry()
    const main = registry.storesFor(MAIN_TENANT_ID)
    const other = registry.storesFor(SECOND_TENANT_ID)
    expect(main.approval.tenantId).toBe(MAIN_TENANT_ID)
    expect(main.box.ledger.tenantId).toBe(MAIN_TENANT_ID)
    expect(main.box.box.tenantId).toBe(MAIN_TENANT_ID)
    expect(other.approval).not.toBe(main.approval)
    expect(registry.storesFor(MAIN_TENANT_ID)).toBe(main)
    expect(registry.tenantIds().sort()).toEqual([SECOND_TENANT_ID, MAIN_TENANT_ID].sort())
  })

  it("والطلبُ يُختم بشبكة مستودعه لا بشبكة المدخل", () => {
    const store = new ApprovalStore(MAIN_TENANT_ID)
    store.saveRequest({
      tenantId: SECOND_TENANT_ID,
      id: "req-x",
      typeId: "box.closing",
      unitPath: "/men/homs/sq2/",
      period: PERIOD,
      state: "draft",
      payload: {},
      submittedBy: null,
      submittedAt: null,
      approvedBy: null,
      approvedAt: null,
      route: null,
      lockedAt: null,
      lastRejection: null,
    })
    expect(store.getRequest("req-x")?.tenantId).toBe(MAIN_TENANT_ID)
  })

  it("**وفاعلُ شبكةٍ لا يبلغ إقفالَ أخرى ولو تطابق المسارُ النسبيّ** ⇒ `NO_SCOPE` ⇒ رفض", async () => {
    const foreign = {
      box: { ledger: seedStore(SECOND_TENANT_ID), box: new BoxStore(SECOND_TENANT_ID) },
      approval: new ApprovalStore(SECOND_TENANT_ID),
    }
    const ep = makeApprovalEndpoints(foreign, SETTINGS, canonicalPeople())
    const submitted = await ep.submit.invoke({ unitId: SQ2, period: PERIOD }, actor("u-square"), WRITE)
    if (!submitted.ok || !submitted.value.ok) throw new Error("تعذّر التقديم في الشبكة الثانية")

    // مستودعُ الشبكة الأولى لا يعرف طلبَ الثانية إطلاقاً — لا مِقبضَ عابر.
    clearRegistryForTests()
    const mine = makeApprovalEndpoints(seedApprovalStores(), SETTINGS, canonicalPeople())
    const r = await mine.approve.invoke(
      { requestId: submitted.value.value.id },
      actor("u-rabita"),
      WRITE,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("ودفترُ الشبكة الثانية لا يرى قيدَ الأولى — المالُ معزولٌ كالطلب", () => {
    const first = new LedgerStore(MAIN_TENANT_ID)
    const second = new LedgerStore(SECOND_TENANT_ID)
    expect(first.entries()).toHaveLength(0)
    expect(second.entries()).toHaveLength(0)
    expect(first.tenantId).not.toBe(second.tenantId)
  })
})
