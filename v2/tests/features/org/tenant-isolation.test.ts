/**
 * عزلُ الشبكة (Tenant) — SPEC_org_and_accounts §١.٠ (قب-١٨/CR-006).
 *
 * لبُّ التعدّد: كيانٌ في الشبكة (أ) **لا يُرى ولا يُخدَم** من فاعلٍ في الشبكة (ب) — حتى لو
 * تطابق مسارُ النطاق النسبيّ حرفاً بحرف. العزلُ بنيويٌّ في طبقة البيانات (مستودعٌ لكل شبكة)،
 * فمُحلِّلُ النطاق في مستودع (ب) لا يجد كيانَ (أ) ⇒ `NO_SCOPE` ⇒ رفضٌ قبل المحرّك.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { seedWorld, seedSecondTenant, NOW } from "./_seed.js"
import { makeOrgEndpoints } from "../../../src/features/org/server/endpoints.js"
import { buildActor } from "../../../src/features/org/services/session.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { DEFAULT_TENANT_ID, TenantRegistry, globalPath } from "../../../src/features/org/data/tenant.js"
import { can, type Actor, type DecisionContext } from "../../../src/authorization/can.js"
import { unitScope } from "../../../src/authorization/scope.js"

const CTX: DecisionContext = { now: NOW, intent: "write", isFeatureEnabled: () => true }

beforeEach(() => clearRegistryForTests())

describe("جذر الشبكة: كلُّ كيانٍ يحمل tenantId مشتقاً من سياق المستودع (§١.٠)", () => {
  it("العالمُ القائم شبكةٌ واحدة مبذورة، وكلُّ كياناتها تحمل معرّفها", () => {
    const { store } = seedWorld()
    expect(store.tenantId).toBe(DEFAULT_TENANT_ID)
    for (const u of store.units.values()) expect(u.tenantId).toBe(DEFAULT_TENANT_ID)
    for (const a of store.accounts.values()) expect(a.tenantId).toBe(DEFAULT_TENANT_ID)
    for (const a of store.assignments) expect(a.tenantId).toBe(DEFAULT_TENANT_ID)
  })

  it("الشبكةُ الثانية تحمل معرّفَها هي، لا معرّفَ الأولى (اشتقاقٌ من المستودع لا من مدخل)", () => {
    const b = seedSecondTenant()
    expect(b.store.tenantId).not.toBe(DEFAULT_TENANT_ID)
    for (const u of b.store.units.values()) expect(u.tenantId).toBe(b.store.tenantId)
  })

  it("العنوانُ المادّي تبدأ بادئتُه بمعرّف الشبكة (§١.٠)", () => {
    expect(globalPath("t-main", "/men/homs/")).toBe("/t-main/men/homs/")
    expect(globalPath("t-aleppo", "/")).toBe("/t-aleppo/")
  })
})

describe("بلا تقسيم الشبكة: تطابُقُ المسار النسبيّ يسرّب الاحتواء — لزومُ الجذر (دليلٌ أحمر)", () => {
  it("في فضاءٍ واحدٍ بلا شبكة، فاعلٌ نطاقُه /men/homs/ يُخدَم كيانَ /men/homs/sq2/bilal/ لأيٍّ كان", () => {
    // محاكاةُ «النسخة بلا الجذر»: لا tenantId ولا تقسيم — النطاقان في فضاءٍ واحد.
    const leakyActor: Actor = {
      personId: "leaky-rabita",
      accountStatus: "active",
      sessionEpoch: 1,
      currentSessionEpoch: 1,
      assignments: [
        {
          roleId: "rabita",
          scopePath: "/men/homs/",
          startDate: NOW,
          endDate: null,
          approvalStatus: "approved",
          unitArchived: false,
        },
      ],
      overrides: [],
    }
    // كيانٌ يقع تحت النطاق نفسِه بالضبط ⇒ الاحتواء يمرّ ⇒ يُخدَم. هذا هو التسريب المُثبَت.
    const decision = can(leakyActor, "orgUnit.manage", unitScope("/men/homs/sq2/bilal/"), CTX)
    expect(decision.allowed).toBe(true)
  })
})

describe("مع جذر الشبكة: فاعلُ الشبكة (ب) لا يُخدَم كيانَ الشبكة (أ) رغم تطابق المسار", () => {
  it("مسؤولُ منطقةٍ في (ب) لا يؤرشف مسجدَ (أ) «bilal» — غيرُ موجودٍ في مستودع (ب) ⇒ رفض", async () => {
    // الشبكة (أ): فيها مسجد «bilal» تحت /men/homs/sq2/.
    const a = seedWorld()
    expect(a.store.getUnit("bilal")).not.toBeNull()

    // الشبكة (ب): شجرةٌ صغيرة بنفس المسارات النسبيّة + مسؤولُ منطقةٍ على /men/homs/.
    const b = seedSecondTenant()
    const bRabita = buildActor(b.store, "b-rabita")
    const ep = makeOrgEndpoints(b.store)

    // نطاقُ b-rabita «/men/homs/» يحتوي مسارَ bilal النسبيّ «/men/homs/sq2/bilal/» —
    // فلولا العزل لَخُدِم. لكن bilal ليس في مستودع (ب) ⇒ NO_SCOPE ⇒ رفض.
    const cross = await ep.archiveUnit.invoke({ unitId: "bilal" }, bRabita, CTX)
    expect(cross.ok).toBe(false)
    if (!cross.ok) expect(cross.decision.reason).toBe("DENIED_OUT_OF_SCOPE")

    // وأنّ (أ) لم تُمَسّ: مسجدُها باقٍ غيرَ مؤرشف.
    expect(a.store.getUnit("bilal")!.archived).toBe(false)
  })

  it("مسؤولُ منطقة (ب) يخدم مسجدَ شبكتِه هو — العزلُ لا يشلّ العمل داخل الشبكة", async () => {
    const b = seedSecondTenant()
    const bRabita = buildActor(b.store, "b-rabita")
    const ep = makeOrgEndpoints(b.store)
    const own = await ep.archiveUnit.invoke({ unitId: "b-salah" }, bRabita, CTX)
    expect(own.ok).toBe(true)
    if (own.ok && own.value.ok) expect(own.value.value.archived).toBe(true)
  })

  it("العزلُ يشمل الحسابات: تحديثُ حالةِ حسابٍ في (أ) من (ب) مرفوض", async () => {
    const b = seedSecondTenant()
    const ep = makeOrgEndpoints(b.store)
    const bRabita = buildActor(b.store, "b-rabita")
    // «u-amir» حسابٌ في الشبكة (أ) وحدها — لا يُحلَّل له نطاقٌ في مستودع (ب).
    const r = await ep.setStatus.invoke({ personId: "u-amir", status: "suspended" }, bRabita, CTX)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })
})

describe("سجلُّ الشبكات يوجّه كلَّ استعلامٍ إلى مستودع شبكته (§١.٠)", () => {
  it("storeFor يعيد مستودعاً موسوماً بالشبكة، ومستودعان مختلفان لشبكتين", () => {
    const registry = new TenantRegistry()
    const sa = registry.storeFor("t-main")
    const sb = registry.storeFor("t-aleppo")
    expect(sa.tenantId).toBe("t-main")
    expect(sb.tenantId).toBe("t-aleppo")
    expect(sa).not.toBe(sb)
    // النداءُ الثاني لنفس الشبكة يعيد المستودعَ نفسه (لا ازدواج).
    expect(registry.storeFor("t-main")).toBe(sa)
    expect(registry.tenantIds().sort()).toEqual(["t-aleppo", "t-main"])
    expect(registry.has("t-main")).toBe(true)
    expect(registry.has("t-nonexistent")).toBe(false)
  })
})
