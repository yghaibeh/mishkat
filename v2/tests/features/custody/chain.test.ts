/**
 * ق-٧٨ — **الحائزُ لا يتبدّل بالتحرير بل بحركةٍ مسجَّلة، وسلسلةُ الحيازة لا تُمحى**
 * (الاختبارُ الإلزاميّ الأول، ب-٢٩).
 *
 * الثابتُ المفحوص هنا: **مسارٌ واحدٌ لا ثانيَ له** يغيّر الحائز — `recordCustodyMove`.
 * وكلُّ ما عداه (تحريرُ الأصل) **يُردّ باسمه** لا يُتجاهل صمتاً.
 */
import { describe, it, expect } from "vitest"
import { amendAsset, registerAsset } from "../../../src/features/custody/services/assets.js"
import { recordCustodyMove } from "../../../src/features/custody/services/chain.js"
import { assetStateOf, chainOf } from "../../../src/features/custody/services/derive.js"
import { custodyContext, seedAsset, seedCustodyStore } from "./_seed.js"

describe("ق-٧٨ — الحائزُ يتبدّل بحركةٍ مسجَّلة وحدها", () => {
  it("الأصلُ يُولد **بلا حائزٍ وبلا حالةٍ مخزَّنة** — الحالةُ الابتدائية اشتقاقٌ «في الوحدة»", () => {
    const store = seedCustodyStore()
    const done = registerAsset(store, custodyContext("u-finance"), {
      unitId: "khalid",
      labelAr: "حاسوبٌ محمول",
    })
    if (!done.ok) throw new Error(done.error.code)

    // لا حقلَ حائزٍ ولا حالةٍ في الكيان المخزَّن أصلاً.
    expect(Object.keys(done.value)).not.toContain("holderPersonId")
    expect(Object.keys(done.value)).not.toContain("status")

    const state = assetStateOf(store, done.value.id)
    expect(state?.status).toBe("inUnit")
    expect(state?.holderPersonId).toBeNull()
  })

  it("**تحريرُ الحائز مباشرةً مرفوضٌ باسمه** — لا بابَ ثانياً للحيازة (ب-٢٩/ز-٣)", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    const rejected = amendAsset(store, custodyContext("u-finance"), {
      assetId,
      fields: { holderPersonId: "u-teacher" },
    })
    expect(rejected.ok).toBe(false)
    if (rejected.ok) throw new Error("تحريرُ الحائز مرّ")
    expect(rejected.error.code).toBe("FIELD_NOT_EDITABLE")
    expect(assetStateOf(store, assetId)?.holderPersonId).toBeNull()
  })

  it("**وتحريرُ الحالة مرفوضٌ كذلك** — الحالةُ تتغيّر بحركةٍ لا بحقل (ق-٨٠)", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    const rejected = amendAsset(store, custodyContext("u-finance"), {
      assetId,
      fields: { status: "lost" },
    })
    if (rejected.ok) throw new Error("تحريرُ الحالة مرّ")
    expect(rejected.error.code).toBe("FIELD_NOT_EDITABLE")
    expect(assetStateOf(store, assetId)?.status).toBe("inUnit")
  })

  it("والحقولُ الوصفيةُ وحدها تُحرَّر — ولا تمسّ الحيازةَ بشيء", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "hand",
      toPersonId: "u-teacher",
      conditionAr: "سليمٌ تماماً",
    })
    const done = amendAsset(store, custodyContext("u-finance"), {
      assetId,
      fields: { labelAr: "حاسوبٌ محمولٌ من طراز جديد", noteAr: "في حقيبته" },
    })
    if (!done.ok) throw new Error(done.error.code)
    expect(done.value.labelAr).toBe("حاسوبٌ محمولٌ من طراز جديد")
    expect(assetStateOf(store, assetId)?.holderPersonId).toBe("u-teacher")
  })
})

describe("ق-٧٨ — أوّلُ تسليمٍ «تسليم» وما بعده «نقلُ عهدة»، **والاسمُ يُشتقّ لا يُملى**", () => {
  it("الحركةُ الأولى `handover` والثانية `transfer` — والسابقُ يبقى في السلسلة", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)

    const first = recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "hand",
      toPersonId: "u-teacher",
      conditionAr: "سليم",
    })
    if (!first.ok) throw new Error(first.error.code)
    expect(first.value.kind).toBe("handover")
    expect(first.value.fromPersonId).toBeNull()

    const second = recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "hand",
      toPersonId: "u-committee-head",
      conditionAr: "سليم",
    })
    if (!second.ok) throw new Error(second.error.code)
    expect(second.value.kind).toBe("transfer")
    expect(second.value.fromPersonId).toBe("u-teacher")

    const chain = chainOf(store, assetId)
    expect(chain.map((m) => m.kind)).toEqual(["handover", "transfer"])
    expect(chain.map((m) => m.seq)).toEqual([1, 2])
    expect(assetStateOf(store, assetId)?.holderPersonId).toBe("u-committee-head")
  })

  it("**وسلسلةُ الحيازة لا تُمحى**: المستودعُ بلا دالةِ حذفٍ، والحركةُ لا تُكتب فوقها", () => {
    const store = seedCustodyStore()
    const surface = [
      ...Object.getOwnPropertyNames(Object.getPrototypeOf(store) as object),
      ...Object.keys(store),
    ]
    const destructive = surface.filter((m) => /delete|remove|drop|clear|purge/i.test(m))
    expect(destructive, `سطحٌ هدّامٌ في مستودع العُهد: ${destructive.join("، ")}`).toEqual([])
  })

  it("وكلُّ حركةٍ تحمل حالَها ومَن نفّذها — **والفاعلُ من الجلسة لا من المدخل**", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    const done = recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "hand",
      toPersonId: "u-teacher",
      conditionAr: "خدشٌ في الغطاء",
      noteAr: "سُلّم مع شاحنه",
    })
    if (!done.ok) throw new Error(done.error.code)
    expect(done.value.byPersonId).toBe("u-amir")
    expect(done.value.conditionAr).toBe("خدشٌ في الغطاء")
    expect(done.value.noteAr).toBe("سُلّم مع شاحنه")
  })

  it("والتسليمُ لحائزه نفسِه مرفوض — حركةٌ لا تنقل شيئاً ليست حركة", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "hand",
      toPersonId: "u-teacher",
      conditionAr: "سليم",
    })
    const again = recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "hand",
      toPersonId: "u-teacher",
      conditionAr: "سليم",
    })
    if (again.ok) throw new Error("تسليمٌ للحائز نفسِه مرّ")
    expect(again.error.code).toBe("SAME_HOLDER")
  })

  it("وأصلٌ مجهول ⇒ `UNKNOWN_ASSET`، ووحدةٌ مجهولة ⇒ `UNKNOWN_CUSTODY_UNIT`", () => {
    const store = seedCustodyStore()
    const move = recordCustodyMove(store, custodyContext("u-amir"), {
      assetId: "asset-لا-وجود-له",
      action: "hand",
      toPersonId: "u-teacher",
      conditionAr: "سليم",
    })
    if (move.ok) throw new Error("حركةٌ على أصلٍ مجهول مرّت")
    expect(move.error.code).toBe("UNKNOWN_ASSET")

    const registered = registerAsset(store, custodyContext("u-finance"), {
      unitId: "وحدةٌ-لا-وجود-لها",
      labelAr: "كاميرا",
    })
    if (registered.ok) throw new Error("تسجيلٌ في وحدةٍ مجهولة مرّ")
    expect(registered.error.code).toBe("UNKNOWN_CUSTODY_UNIT")
  })

  it("وأصلٌ بلا تسميةٍ لا يُسجَّل — التحقّقُ عند الحدّ (المادة ٣/٣)", () => {
    const store = seedCustodyStore()
    const registered = registerAsset(store, custodyContext("u-finance"), {
      unitId: "khalid",
      labelAr: "   ",
    })
    if (registered.ok) throw new Error("أصلٌ بلا تسميةٍ سُجّل")
    expect(registered.error.code).toBe("EMPTY_ASSET_LABEL")
  })

  it("وتحريرُ أصلٍ مجهولٍ مرفوض، وتحريرٌ بلا حقولٍ لا يُنشئ قيداً", () => {
    const store = seedCustodyStore()
    const missing = amendAsset(store, custodyContext("u-finance"), {
      assetId: "asset-وهميّ",
      fields: { labelAr: "شيء" },
    })
    if (missing.ok) throw new Error("تحريرُ أصلٍ مجهولٍ مرّ")
    expect(missing.error.code).toBe("UNKNOWN_ASSET")
  })
})
