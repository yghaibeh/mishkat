/**
 * قب-١٨ — **عزلُ الشبكة على كل مسارات العُهد** (الاختبارُ الإلزاميّ السابع).
 *
 * العزلُ **بنيويٌّ في طبقة البيانات**: مستودعٌ لكل شبكة، فلا مِقبضَ عابرٌ أصلاً. والشبكةُ
 * الثانية تحمل **نفسَ المسارات النسبيّة عمداً** — فيثبت أنّ التطابق لا يسرّب.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { CustodyStore } from "../../../src/features/custody/data/store.js"
import { CustodyTenantRegistry } from "../../../src/features/custody/data/tenant.js"
import { recordCustodyMove } from "../../../src/features/custody/services/chain.js"
import { assetsInScope } from "../../../src/features/custody/services/derive.js"
import { makeCustodyEndpoints } from "../../../src/features/custody/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import {
  canonicalActor,
  canonicalDirectory,
  custodyContext,
  DECISION,
  KHALID_PATH,
  MAIN_TENANT_ID,
  NOW,
  SECOND_TENANT_ID,
  seedAsset,
  seedCustodyStore,
  WRITE,
} from "./_seed.js"

beforeEach(() => clearRegistryForTests())

describe("المستودعُ يختم شبكتَه — و`tenantId` لا يأتي من مدخل العميل", () => {
  it("أصلٌ وافدٌ بشبكةٍ ملفَّقة ⇒ يُطمس بشبكة المستودع", () => {
    const store = new CustodyStore(MAIN_TENANT_ID)
    store.saveUnit({ tenantId: SECOND_TENANT_ID, id: "khalid", path: KHALID_PATH })
    store.saveAsset({
      tenantId: SECOND_TENANT_ID,
      id: "as-1",
      unitPath: KHALID_PATH,
      labelAr: "كاميرا",
      serialAr: null,
      noteAr: null,
      registeredBy: "u-finance",
      registeredAt: NOW,
    })
    expect(store.getAsset("as-1")?.tenantId).toBe(MAIN_TENANT_ID)
    expect(store.getUnit("khalid")?.tenantId).toBe(MAIN_TENANT_ID)
  })

  it("وحركةُ السلسلة تحمل شبكةَ مستودعها لا شبكةَ المدخل", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    const done = recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "hand",
      toPersonId: "u-teacher",
      conditionAr: "سليم",
    })
    if (!done.ok) throw new Error(done.error.code)
    expect(done.value.tenantId).toBe(MAIN_TENANT_ID)
  })
})

describe("سجلُّ الشبكات يوجّه إلى مستودع شبكته ولا يخلطها", () => {
  it("شبكتان بنفس المسار النسبيّ ⇒ سلسلتان مستقلّتان تماماً", () => {
    const registry = new CustodyTenantRegistry()
    const main = registry.storeFor(MAIN_TENANT_ID)
    const second = registry.storeFor(SECOND_TENANT_ID)
    expect(main).not.toBe(second)
    expect(registry.storeFor(MAIN_TENANT_ID)).toBe(main)
    expect(registry.has(SECOND_TENANT_ID)).toBe(true)
    expect(registry.tenantIds().sort()).toEqual([SECOND_TENANT_ID, MAIN_TENANT_ID].sort())
  })

  it("**وعُهدُ شبكةٍ لا تظهر في عرض الأخرى ولو تطابقت المسارات**", () => {
    const first = seedCustodyStore(MAIN_TENANT_ID)
    const second = seedCustodyStore(SECOND_TENANT_ID)
    seedAsset(second, "khalid", "كاميرا الشبكة الأخرى")

    expect(assetsInScope(second, KHALID_PATH)).toHaveLength(1)
    expect(assetsInScope(first, KHALID_PATH)).toHaveLength(0)
  })
})

describe("والحدُّ **قبل المحرّك**: فاعلٌ في شبكةٍ لا يبلغ أصلَ أخرى", () => {
  it("مستودعُ شبكةٍ لم تُبذَر فيها الوحدة ⇒ `NO_SCOPE` ⇒ رفض", async () => {
    const barren = new CustodyStore(SECOND_TENANT_ID)
    const ep = makeCustodyEndpoints(barren, canonicalDirectory)

    const viewed = await ep.scopeView.invoke(
      { unitId: "khalid" },
      canonicalActor("u-admin"),
      DECISION,
    )
    const registered = await ep.register.invoke(
      { unitId: "khalid", labelAr: "كاميرا" },
      canonicalActor("u-finance"),
      WRITE,
    )
    const moved = await ep.move.invoke(
      { assetId: "as-1", action: "hand", toPersonId: "u-teacher", conditionAr: "سليم" },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(viewed.ok).toBe(false)
    expect(registered.ok).toBe(false)
    expect(moved.ok).toBe(false)
  })
})
