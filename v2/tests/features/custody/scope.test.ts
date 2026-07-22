/**
 * ق-٨١ + قب-١١/ق-م٦ — **عزلُ النطاق بطرفَيه** (الاختبارُ الإلزاميّ الرابع).
 *
 * طرفٌ على الخادم: النطاقُ مشتقٌّ من **الأصل المخزَّن**، فالأميرُ على مسجده والماليُّ على
 * نطاقه **كلاهما يسلّم** (ق-م٦/قب-٤)، وأميرُ مسجدٍ آخر **مرفوضٌ في الخادم** لا مخفيٌّ في
 * الواجهة. وطرفٌ في الخدمة: **المستلِمُ داخل وحدة الأصل** وإلا `RECIPIENT_OUT_OF_SCOPE`.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { recordCustodyMove } from "../../../src/features/custody/services/chain.js"
import { assetStateOf } from "../../../src/features/custody/services/derive.js"
import { makeScopeReach } from "../../../src/features/custody/services/directory.js"
import { makeCustodyEndpoints } from "../../../src/features/custody/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import {
  BILAL_PATH,
  canonicalActor,
  canonicalDirectory,
  custodyContext,
  DECISION,
  KHALID_PATH,
  NOW,
  seedAsset,
  seedCustodyStore,
  WRITE,
} from "./_seed.js"

beforeEach(() => clearRegistryForTests())

describe("ق-م٦ — **الأميرُ والماليُّ كلاهما يسلّم على نطاقه**", () => {
  it("أميرُ خالد يسلّم أصلَ مسجده", async () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store, "khalid")
    const ep = makeCustodyEndpoints(store, canonicalDirectory)
    const done = await ep.move.invoke(
      { assetId, action: "hand", toPersonId: "u-teacher", conditionAr: "سليم" },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(done.ok).toBe(true)
    expect(assetStateOf(store, assetId)?.holderPersonId).toBe("u-teacher")
  })

  it("والمسؤولُ الماليُّ يسلّم على نطاقه هو كذلك (لا أحدَهما دون الآخر)", async () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store, "khalid")
    const ep = makeCustodyEndpoints(store, canonicalDirectory)
    const done = await ep.move.invoke(
      { assetId, action: "hand", toPersonId: "u-committee-head", conditionAr: "سليم" },
      canonicalActor("u-finance"),
      WRITE,
    )
    expect(done.ok).toBe(true)
  })

  it("**وتسجيلُ الأصل ومحاسبتُه للماليّ وحده**: الأميرُ يسلّم ولا يسجّل (`asset.manage`)", async () => {
    const store = seedCustodyStore()
    const ep = makeCustodyEndpoints(store, canonicalDirectory)
    const byAmir = await ep.register.invoke(
      { unitId: "khalid", labelAr: "كاميرا" },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(byAmir.ok).toBe(false)
    const byFinance = await ep.register.invoke(
      { unitId: "khalid", labelAr: "كاميرا" },
      canonicalActor("u-finance"),
      WRITE,
    )
    expect(byFinance.ok).toBe(true)
  })
})

describe("ق-٨١ — **خارجَ نطاقك: لا تسلّم ولا ترى**", () => {
  it("أميرُ بلال لا يسلّم أصلَ مسجد خالد — رفضٌ في الخادم", async () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store, "khalid")
    const ep = makeCustodyEndpoints(store, canonicalDirectory)
    const rejected = await ep.move.invoke(
      { assetId, action: "hand", toPersonId: "u-teacher", conditionAr: "سليم" },
      canonicalActor("u-amir-bilal"),
      WRITE,
    )
    expect(rejected.ok).toBe(false)
    expect(assetStateOf(store, assetId)?.holderPersonId).toBeNull()
  })

  it("ولا يرى عُهدَ نطاقٍ ليس نطاقَه", async () => {
    const store = seedCustodyStore()
    seedAsset(store, "khalid")
    const ep = makeCustodyEndpoints(store, canonicalDirectory)
    const rejected = await ep.scopeView.invoke(
      { unitId: "khalid" },
      canonicalActor("u-amir-bilal"),
      DECISION,
    )
    expect(rejected.ok).toBe(false)
    const allowed = await ep.scopeView.invoke(
      { unitId: "bilal" },
      canonicalActor("u-amir-bilal"),
      DECISION,
    )
    expect(allowed.ok).toBe(true)
  })

  it("**والمعلّمُ لا يسلّم إطلاقاً** — لكنّه يرى «عُهدتي» (ق-٨١ نصّاً)", async () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store, "khalid")
    const ep = makeCustodyEndpoints(store, canonicalDirectory)

    const move = await ep.move.invoke(
      { assetId, action: "hand", toPersonId: "u-committee-head", conditionAr: "سليم" },
      canonicalActor("u-teacher"),
      WRITE,
    )
    expect(move.ok).toBe(false)
    const register = await ep.register.invoke(
      { unitId: "khalid", labelAr: "لوح" },
      canonicalActor("u-teacher"),
      WRITE,
    )
    expect(register.ok).toBe(false)

    const mine = await ep.mine.invoke(
      { personId: "u-teacher" },
      canonicalActor("u-teacher"),
      DECISION,
    )
    expect(mine.ok).toBe(true)
  })

  it("**و«عُهدتي» صفحةُ صاحبها وحده**: طلبُها بمعرّفِ غيره مرفوض", async () => {
    const store = seedCustodyStore()
    const ep = makeCustodyEndpoints(store, canonicalDirectory)
    const rejected = await ep.mine.invoke(
      { personId: "u-teacher" },
      canonicalActor("u-admin"),
      DECISION,
    )
    expect(rejected.ok).toBe(false)
    // **CR-012/قب-٣٨**: `custody.own` ليست في حزمة المدير — فيُردّ عند الشرط الأول.
    if (!rejected.ok) expect(rejected.decision.reason).toBe("DENIED_PERSONAL_NOT_IN_ROLE")
  })
})

describe("ق-٨١ — **ولا لشخصٍ خارج نطاقك**: المستلِمُ يُفحص في الخدمة", () => {
  it("مستلِمٌ لا تكليفَ له داخل وحدة الأصل ⇒ `RECIPIENT_OUT_OF_SCOPE`", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store, "khalid")
    const rejected = recordCustodyMove(store, custodyContext("u-finance"), {
      assetId,
      action: "hand",
      toPersonId: "u-amir-bilal",
      conditionAr: "سليم",
    })
    if (rejected.ok) throw new Error("تسليمٌ لشخصٍ خارج النطاق مرّ")
    expect(rejected.error.code).toBe("RECIPIENT_OUT_OF_SCOPE")
  })

  it("**ولا يكفي أن يكون فوقك في الشجرة**: مسؤولُ المربع ليس داخلَ وحدة مسجدٍ تحته", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store, "khalid")
    const rejected = recordCustodyMove(store, custodyContext("u-finance"), {
      assetId,
      action: "hand",
      toPersonId: "u-square",
      conditionAr: "سليم",
    })
    if (rejected.ok) throw new Error("تسليمٌ لمن هو فوق الوحدة مرّ")
    expect(rejected.error.code).toBe("RECIPIENT_OUT_OF_SCOPE")
  })

  it("وحاملُ التكليف داخل الوحدة يُقبل — والمقياسُ مسارُ التكليف لا مسمّاه (G6)", () => {
    const reaches = makeScopeReach(canonicalDirectory, NOW)
    expect(reaches("u-teacher", KHALID_PATH)).toBe(true)
    expect(reaches("u-amir", KHALID_PATH)).toBe(true)
    expect(reaches("u-committee-head", KHALID_PATH)).toBe(true)
    expect(reaches("u-amir-bilal", KHALID_PATH)).toBe(false)
    expect(reaches("u-amir-bilal", BILAL_PATH)).toBe(true)
  })

  it("والتكليفُ غيرُ الفعّال لا يُبلِّغ: منتهٍ · معلَّقٌ · شخصٌ مجهول", () => {
    const reaches = makeScopeReach(canonicalDirectory, NOW)
    expect(reaches("u-ended", BILAL_PATH)).toBe(false)
    expect(reaches("u-pending", "/men/homs/sq7/omar/")).toBe(false)
    expect(reaches("u-لا-أحد", KHALID_PATH)).toBe(false)
  })

  it("ومستلِمٌ غيرُ مُسمّى في حركةِ تسليمٍ مرفوض — «إلى مَن» ليست اختيارية", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store, "khalid")
    const rejected = recordCustodyMove(store, custodyContext("u-finance"), {
      assetId,
      action: "hand",
      conditionAr: "سليم",
    })
    if (rejected.ok) throw new Error("تسليمٌ بلا مستلِمٍ مرّ")
    expect(rejected.error.code).toBe("RECIPIENT_OUT_OF_SCOPE")
  })
})
