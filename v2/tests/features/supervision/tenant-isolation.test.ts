/**
 * قب-١٨ — **عزلُ الشبكة بنيويّ** (عقدُ الوحدة §٧) — الاختبارُ السادس الإلزاميّ.
 *
 * الشبكتان هنا **بنفس المسارات النسبيّة عمداً**: فلو كان العزلُ فحصاً زمنياً على المسار
 * لَتسرّبت إحداهما إلى الأخرى. وهو **مستودعٌ لكل شبكة** فلا مِقبضَ عابرٌ أصلاً — والرفضُ
 * يقع **قبل فحص القدرة** لأن النطاق نفسَه لا يُحلّ (`NO_SCOPE` يُقفل ولا يُفتح).
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { SupervisionTenantRegistry } from "../../../src/features/supervision/data/tenant.js"
import { makeSupervisionEndpoints } from "../../../src/features/supervision/server/endpoints.js"
import { recordVisit } from "../../../src/features/supervision/services/visits.js"
import { visitsInScope } from "../../../src/features/supervision/services/views.js"
import {
  C1,
  CORE,
  MAIN_TENANT_ID,
  NOW,
  SECOND_TENANT_ID,
  SQ2_PATH,
  TAHFEEZ_DETAILS,
  WRITE,
  canonicalActor,
  canonicalResponsibleOf,
  PENDING_VERDICT,
  seedSupervisionStore,
  supervisionContext,
} from "./_seed.js"

const SETTINGS = createSettingsResolver([])
const PORTS = { verdictOf: () => PENDING_VERDICT, responsibleOf: canonicalResponsibleOf }

beforeEach(() => clearRegistryForTests())

describe("قب-١٨ — مستودعٌ لكل شبكة، فلا مِقبضَ عابرٌ بين شبكتين", () => {
  it("سجلُّ الشبكة يوزّع مستودعاً واحداً لكل شبكة ولا يخلط بينهما", () => {
    const registry = new SupervisionTenantRegistry()
    const main = registry.storeFor(MAIN_TENANT_ID)
    const second = registry.storeFor(SECOND_TENANT_ID)

    expect(main).not.toBe(second)
    expect(registry.storeFor(MAIN_TENANT_ID)).toBe(main)
    expect(main.tenantId).toBe(MAIN_TENANT_ID)
    expect(registry.tenantIds().sort()).toEqual([MAIN_TENANT_ID, SECOND_TENANT_ID].sort())
  })

  it("**والوسمُ من المستودع لا من المدخل**: كيانٌ يحمل شبكةً أخرى يُختم بشبكة مستودعه", () => {
    const store = seedSupervisionStore(SECOND_TENANT_ID)
    store.saveTarget({
      tenantId: MAIN_TENANT_ID,
      id: "smuggled",
      path: "/men/homs/sq2/khalid/cx/",
      curriculum: "tahfeez",
      active: true,
    })

    expect(store.getTarget("smuggled")?.tenantId).toBe(SECOND_TENANT_ID)
  })

  it("**وزيارةُ شبكةٍ لا تظهر في عرض الأخرى ولو تطابق المسارُ حرفاً بحرف**", () => {
    const main = seedSupervisionStore(MAIN_TENANT_ID)
    const second = seedSupervisionStore(SECOND_TENANT_ID)

    const recorded = recordVisit(main, supervisionContext("u-square"), {
      targetId: C1,
      visitedAt: NOW,
      core: CORE,
      details: TAHFEEZ_DETAILS,
    })
    expect(recorded.ok).toBe(true)

    expect(visitsInScope(main, supervisionContext("u-square"), SQ2_PATH)).toHaveLength(1)
    expect(visitsInScope(second, supervisionContext("u-square"), SQ2_PATH)).toHaveLength(0)
  })

  it("**والهدفُ لا يُبلَغ من شبكةٍ أخرى**: نطاقُه لا يُحلّ فيُرفض قبل فحص القدرة", async () => {
    const second = new SupervisionTenantRegistry().storeFor(SECOND_TENANT_ID)
    // مستودعُ الشبكة الثانية فارغٌ من الأهداف، ومعرّفُ الهدف نفسُه معرّفُ الأولى.
    const ep = makeSupervisionEndpoints(second, SETTINGS, PORTS)
    const r = await ep.record.invoke(
      { targetId: C1, visitedAt: NOW, core: CORE, details: TAHFEEZ_DETAILS },
      canonicalActor("u-square"),
      WRITE,
    )

    expect(r.ok).toBe(false)
  })

  it("**والزيارةُ تُختم بشبكة مستودعها** — لا شبكةَ تأتي من مدخل العميل", () => {
    const second = seedSupervisionStore(SECOND_TENANT_ID)
    const recorded = recordVisit(second, supervisionContext("u-square"), {
      targetId: C1,
      visitedAt: NOW,
      core: CORE,
      details: TAHFEEZ_DETAILS,
    })

    expect(recorded.ok && recorded.value.tenantId).toBe(SECOND_TENANT_ID)
  })
})
