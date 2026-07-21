/**
 * سطوحُ الوحدة السبعة — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٧.
 *
 * أربعةُ ثوابتٍ على كل نقطة: **قدرةٌ معلنة** (G7) · **نطاقٌ مشتقٌّ من الكيان المخزَّن**
 * (`NO_SCOPE` يُقفل ولا يُفتح) · **نيّةٌ معلنة** · **اسمُ فعلٍ في التدقيق**.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { makeCustodyEndpoints } from "../../../src/features/custody/server/endpoints.js"
import { clearRegistryForTests, registeredServerFns } from "../../../src/server/defineServerFn.js"
import { recordCustodyMove } from "../../../src/features/custody/services/chain.js"
import {
  canonicalActor,
  canonicalDirectory,
  custodyContext,
  DECISION,
  seedAsset,
  seedCustodyStore,
  WRITE,
} from "./_seed.js"

beforeEach(() => clearRegistryForTests())

const EXPECTED: readonly (readonly [string, string, "read" | "write"])[] = [
  ["custody.scope.view", "custody.view", "read"],
  ["custody.chain.view", "custody.view", "read"],
  ["custody.asset.register", "asset.manage", "write"],
  ["custody.asset.amend", "asset.manage", "write"],
  ["custody.move.record", "custody.grant", "write"],
  ["custody.mine.view", "custody.own", "read"],
  ["custody.receipt.acknowledge", "custody.own", "write"],
]

describe("إعلانُ السطوح — سبعٌ لا ثامنةَ لها، كلٌّ بقدرتها ونيّتها وتدقيقها", () => {
  it("الأسماءُ والقدراتُ والنيّاتُ مطابقةٌ للعقد §٧", () => {
    const store = seedCustodyStore()
    makeCustodyEndpoints(store, canonicalDirectory)
    const declared = registeredServerFns().map((f) => f.declaration)
    const mine = declared.filter((d) => d.name.startsWith("custody."))

    expect(mine).toHaveLength(EXPECTED.length)
    for (const [name, capability, intent] of EXPECTED) {
      const found = mine.find((d) => d.name === name)
      expect(found, `سطحٌ غائبٌ: ${name}`).toBeDefined()
      expect(found?.capability).toBe(capability)
      expect(found?.intent).toBe(intent)
      expect(found?.audit).toBe(name)
      expect(typeof found?.scope).toBe("function")
    }
  })

  it("ولا قدرةَ خارج الأربع التي يعلنها العقد", () => {
    const store = seedCustodyStore()
    makeCustodyEndpoints(store, canonicalDirectory)
    const caps = new Set(
      registeredServerFns()
        .map((f) => f.declaration)
        .filter((d) => d.name.startsWith("custody."))
        .map((d) => d.capability),
    )
    expect([...caps].sort()).toEqual(
      ["asset.manage", "custody.grant", "custody.own", "custody.view"].sort(),
    )
  })
})

describe("النطاقُ يُشتقّ من الكيان المخزَّن — والغائبُ يُقفل", () => {
  it("أصلٌ مجهولٌ في التحرير والحركة وعرضِ السلسلة ⇒ رفضٌ قبل جسم الدالة", async () => {
    const store = seedCustodyStore()
    const ep = makeCustodyEndpoints(store, canonicalDirectory)
    const actor = canonicalActor("u-finance")

    const amend = await ep.amend.invoke(
      { assetId: "as-وهميّ", fields: { labelAr: "شيء" } },
      actor,
      WRITE,
    )
    const chain = await ep.chainView.invoke({ assetId: "as-وهميّ" }, actor, DECISION)
    const move = await ep.move.invoke(
      { assetId: "as-وهميّ", action: "hand", toPersonId: "u-teacher", conditionAr: "س" },
      actor,
      WRITE,
    )
    for (const r of [amend, chain, move]) {
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
    }
  })

  it("وحركةٌ مجهولةٌ في الإقرار ⇒ رفضٌ بلا نطاق", async () => {
    const store = seedCustodyStore()
    const ep = makeCustodyEndpoints(store, canonicalDirectory)
    const r = await ep.acknowledge.invoke({ moveId: "mv-وهميّة" }, canonicalActor("u-teacher"), WRITE)
    expect(r.ok).toBe(false)
  })

  it("والمساراتُ السعيدة تمرّ وتعيد نماذجَ الصفحة", async () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    const handed = recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "hand",
      toPersonId: "u-teacher",
      conditionAr: "سليم",
    })
    if (!handed.ok) throw new Error(handed.error.code)
    const ep = makeCustodyEndpoints(store, canonicalDirectory)

    const scope = await ep.scopeView.invoke({ unitId: "khalid" }, canonicalActor("u-amir"), DECISION)
    if (!scope.ok) throw new Error(scope.decision.reason)
    expect(scope.value.unitPath).toBe("/men/homs/sq2/khalid/")
    expect(scope.value.assets).toHaveLength(1)
    expect(scope.value.assets[0]?.holderPersonId).toBe("u-teacher")

    const chain = await ep.chainView.invoke({ assetId }, canonicalActor("u-amir"), DECISION)
    if (!chain.ok) throw new Error(chain.decision.reason)
    expect(chain.value).toHaveLength(1)

    const mine = await ep.mine.invoke(
      { personId: "u-teacher" },
      canonicalActor("u-teacher"),
      DECISION,
    )
    if (!mine.ok) throw new Error(mine.decision.reason)
    expect(mine.value.open).toHaveLength(1)
    expect(mine.value.pending).toHaveLength(1)

    const amended = await ep.amend.invoke(
      { assetId, fields: { serialAr: "س-١٢٣" } },
      canonicalActor("u-finance"),
      WRITE,
    )
    if (!amended.ok) throw new Error(amended.decision.reason)
    expect(amended.value.ok).toBe(true)
  })

  it("**والانتحالُ القرائيُّ لا يكتب**: كلُّ كاتبٍ يُرفض لجلسة الانتحال (ب-٤٠أ)", async () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    const ep = makeCustodyEndpoints(store, canonicalDirectory)
    const impersonated = { ...canonicalActor("u-finance"), impersonatedBy: "u-admin" }

    const registered = await ep.register.invoke({ unitId: "khalid", labelAr: "لوح" }, impersonated, WRITE)
    const amended = await ep.amend.invoke({ assetId, fields: { noteAr: "شيء" } }, impersonated, WRITE)
    for (const r of [registered, amended]) {
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.decision.reason).toBe("DENIED_IMPERSONATION_READONLY")
    }
  })
})
