/**
 * ق-٨٣ — **كلُّ تبديلِ حائزٍ أو تعديلِ أصلٍ يُدوَّن بقبل/بعد** (الاختبارُ الإلزاميّ السادس).
 *
 * جولةُ v1 الرابعة كشفت «تبديلَ حائزِ العهدة بلا تدقيق». هنا التدوينُ **داخل المعاملة نفسِها**:
 * حركةٌ بلا قيدِ تدقيقٍ مستحيلةٌ لأنّ الاثنين يُكتبان معاً ويرتدّان معاً.
 */
import { describe, it, expect } from "vitest"
import { amendAsset, registerAsset } from "../../../src/features/custody/services/assets.js"
import { acknowledgeReceipt, recordCustodyMove } from "../../../src/features/custody/services/chain.js"
import { custodyContext, seedAsset, seedCustodyStore } from "./_seed.js"

describe("ق-٨٣ — التدقيقُ يلازم كلَّ حركةِ حيازة", () => {
  it("كلُّ حركةٍ تكتب قيداً بـ**قبل/بعد** يسمّي الحائزَين والحالتين", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "hand",
      toPersonId: "u-teacher",
      conditionAr: "سليم",
    })
    recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "hand",
      toPersonId: "u-committee-head",
      conditionAr: "سليم",
    })

    const moves = store.audit.all().filter((a) => a.action === "custody.move.record")
    expect(moves).toHaveLength(2)
    expect(moves[0]?.before).toContain("inUnit")
    expect(moves[0]?.after).toContain("u-teacher")
    // «من كان يحوزها» محفوظٌ في قيد التدقيق نفسِه لا في السلسلة وحدها.
    expect(moves[1]?.before).toContain("u-teacher")
    expect(moves[1]?.after).toContain("u-committee-head")
    for (const entry of moves) {
      expect(entry.actorPersonId).toBe("u-amir")
      expect(entry.targetId).toBe(assetId)
      expect(entry.unitPath).toBe("/men/homs/sq2/khalid/")
    }
  })

  it("**وحركةٌ بلا تدقيقٍ مستحيلة**: عددُ القيود = عددُ الحركات دائماً", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    for (const action of ["hand", "return", "damage"] as const) {
      recordCustodyMove(store, custodyContext("u-amir"), {
        assetId,
        action,
        ...(action === "hand" ? { toPersonId: "u-teacher" } : {}),
        conditionAr: "حال",
      })
    }
    expect(store.audit.all().filter((a) => a.action === "custody.move.record")).toHaveLength(
      store.moves().length,
    )
  })

  it("والحركةُ المرفوضةُ لا تترك قيداً — الارتدادُ يشمل التدقيق", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    const before = store.audit.all().length
    const rejected = recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "hand",
      toPersonId: "u-amir-bilal",
      conditionAr: "سليم",
    })
    expect(rejected.ok).toBe(false)
    expect(store.audit.all()).toHaveLength(before)
    expect(store.moves()).toHaveLength(0)
  })

  it("والإقرارُ يُدوَّن باسم المقرِّ هو (ق-٧٩ + ق-٨٣ معاً)", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    const handed = recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "hand",
      toPersonId: "u-teacher",
      conditionAr: "سليم",
    })
    if (!handed.ok) throw new Error(handed.error.code)
    acknowledgeReceipt(store, custodyContext("u-teacher"), {
      moveId: handed.value.id,
      personId: "u-teacher",
    })
    const entry = store.audit.all().find((a) => a.action === "custody.receipt.acknowledge")
    expect(entry?.actorPersonId).toBe("u-teacher")
    expect(entry?.after).toContain("held")
  })
})

describe("ق-٨٣ — والتدقيقُ يلازم تعديلَ الأصل كذلك", () => {
  it("تسجيلُ أصلٍ وتعديلُه يكتبان قيدَين بقبل/بعد", () => {
    const store = seedCustodyStore()
    const registered = registerAsset(store, custodyContext("u-finance"), {
      unitId: "khalid",
      labelAr: "كاميرا",
    })
    if (!registered.ok) throw new Error(registered.error.code)
    amendAsset(store, custodyContext("u-finance"), {
      assetId: registered.value.id,
      fields: { labelAr: "كاميرا احترافية" },
    })

    const actions = store.audit.all().map((a) => a.action)
    expect(actions).toContain("custody.asset.register")
    expect(actions).toContain("custody.asset.amend")
    const amend = store.audit.all().find((a) => a.action === "custody.asset.amend")
    expect(amend?.before).toContain("كاميرا")
    expect(amend?.after).toContain("كاميرا احترافية")
  })

  it("**والتعديلُ المرفوض لا يُدوَّن ولا يُغيّر** — لا أثرَ لمحاولةٍ مردودة", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    const before = store.audit.all().length
    amendAsset(store, custodyContext("u-finance"), {
      assetId,
      fields: { holderPersonId: "u-teacher" },
    })
    expect(store.audit.all()).toHaveLength(before)
  })
})
