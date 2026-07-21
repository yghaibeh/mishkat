/**
 * ق-٨٢ — **لا تُطوى صفحةُ كادرٍ وبيده عهدة** (الاختبارُ الإلزاميّ الخامس).
 *
 * التحقّقُ **قيمةٌ تُصدَّر** لتستهلكها دورةُ حياة الحساب — ولم يُعدَّل في وحدة `org` سطرٌ
 * واحد (قب-٣١ §٢: كلٌّ في مجلده، ومن احتاج غيرَه صدّر له ولم يكتب فيه).
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { acknowledgeReceipt, recordCustodyMove } from "../../../src/features/custody/services/chain.js"
import { custodyClearance } from "../../../src/features/custody/services/handoff.js"
import { openCustodyOf } from "../../../src/features/custody/services/derive.js"
import { custodyContext, seedAsset, seedCustodyStore } from "./_seed.js"

function handTo(store: ReturnType<typeof seedCustodyStore>, assetId: string, toPersonId: string) {
  const done = recordCustodyMove(store, custodyContext("u-amir"), {
    assetId,
    action: "hand",
    toPersonId,
    conditionAr: "سليم",
  })
  if (!done.ok) throw new Error(done.error.code)
  return done.value
}

describe("ق-٨٢ — التحقّقُ يكشف مَن بيده عهدة قبل طيّ صفحته", () => {
  it("كادرٌ حائزٌ ⇒ **غيرُ مُبرَّأٍ** وقائمتُه تسمّي أصلَه", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store, "khalid", "حاسوبٌ محمول")
    handTo(store, assetId, "u-teacher")

    const clearance = custodyClearance(store, "u-teacher")
    expect(clearance.clear).toBe(false)
    expect(clearance.open).toHaveLength(1)
    expect(clearance.open[0]?.assetId).toBe(assetId)
    expect(clearance.open[0]?.labelAr).toBe("حاسوبٌ محمول")
    expect(clearance.open[0]?.status).toBe("pendingAck")
  })

  it("**وبانتظار الإقرار عهدةٌ بيده كذلك** — التأخّرُ في الإقرار ليس مخرجاً", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    handTo(store, assetId, "u-teacher")
    expect(openCustodyOf(store, "u-teacher")).toHaveLength(1)

    const move = store.moves().find((m) => m.assetId === assetId)
    if (move === undefined) throw new Error("لا حركة")
    acknowledgeReceipt(store, custodyContext("u-teacher"), {
      moveId: move.id,
      personId: "u-teacher",
    })
    const after = openCustodyOf(store, "u-teacher")
    expect(after).toHaveLength(1)
    expect(after[0]?.status).toBe("held")
  })

  it("وبعد الإعادة يُبرَّأ — والحالةُ الخاتمةُ تُبرِّئ كذلك", () => {
    const store = seedCustodyStore()
    const returned = seedAsset(store, "khalid", "كاميرا")
    const lost = seedAsset(store, "khalid", "حقيبة")
    handTo(store, returned, "u-teacher")
    handTo(store, lost, "u-teacher")
    expect(custodyClearance(store, "u-teacher").open).toHaveLength(2)

    recordCustodyMove(store, custodyContext("u-amir"), {
      assetId: returned,
      action: "return",
      conditionAr: "أُعيد",
    })
    recordCustodyMove(store, custodyContext("u-amir"), {
      assetId: lost,
      action: "loss",
      conditionAr: "فُقدت",
    })

    const clearance = custodyClearance(store, "u-teacher")
    expect(clearance.clear).toBe(true)
    expect(clearance.open).toEqual([])
  })

  it("ومَن لا عهدةَ بيده مُبرَّأٌ من أول لحظة", () => {
    const store = seedCustodyStore()
    seedAsset(store)
    expect(custodyClearance(store, "u-admin")).toEqual({ clear: true, open: [] })
  })
})

describe("ق-٨٢ — **يُصدَّر ولا يُكتب في وحدة غيره** (قب-٣١)", () => {
  it("الدالةُ مُصدَّرةٌ من سطح الوحدة، ووحدةُ `org` **لم تُمسّ**", () => {
    const source = readFileSync(
      new URL("../../../src/features/custody/services/handoff.ts", import.meta.url),
      "utf8",
    )
    expect(source).toMatch(/export function custodyClearance/)
    // لا استيرادَ من وحدةٍ أخرى ولا كتابةَ فيها — التصديرُ اتجاهٌ واحد.
    expect(source).not.toMatch(/features\/org\//)
  })
})
