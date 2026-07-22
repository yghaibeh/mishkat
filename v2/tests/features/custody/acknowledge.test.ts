/**
 * ق-٧٩ — **الإقرارُ بيد المستلِم وحده: حتى المدير لا يقرّ عنه** (الاختبارُ الإلزاميّ الثاني).
 *
 * الحارسُ الأول نطاقٌ **شخصيّ** على دالة الخادم (`selfScope` من الحركة المخزَّنة)، وهذا
 * حارسٌ ثانٍ **في العمق** داخل الخدمة — فلا يمرّ إقرارٌ بالنيابة من أيّ مسارٍ ولو داخليّ.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { acknowledgeReceipt, recordCustodyMove } from "../../../src/features/custody/services/chain.js"
import { assetStateOf, pendingReceiptsFor } from "../../../src/features/custody/services/derive.js"
import { makeCustodyEndpoints } from "../../../src/features/custody/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import {
  canonicalActor,
  canonicalDirectory,
  custodyContext,
  seedAsset,
  seedCustodyStore,
  WRITE,
} from "./_seed.js"

beforeEach(() => clearRegistryForTests())

function handedToTeacher() {
  const store = seedCustodyStore()
  const assetId = seedAsset(store)
  const done = recordCustodyMove(store, custodyContext("u-amir"), {
    assetId,
    action: "hand",
    toPersonId: "u-teacher",
    conditionAr: "سليم",
  })
  if (!done.ok) throw new Error(done.error.code)
  return { store, assetId, moveId: done.value.id }
}

describe("ق-٧٩ — «بانتظار إقراره» ظاهرةٌ للطرفين حتى يقرّ هو", () => {
  it("قبل الإقرار: الحالةُ «بانتظار الإقرار» والحائزُ معلَنٌ للطرفين", () => {
    const { store, assetId } = handedToTeacher()
    const state = assetStateOf(store, assetId)
    expect(state?.status).toBe("pendingAck")
    expect(state?.holderPersonId).toBe("u-teacher")
    expect(state?.acknowledged).toBe(false)
    expect(pendingReceiptsFor(store, "u-teacher").map((m) => m.assetId)).toEqual([assetId])
  })

  it("وبعد إقراره هو: الحالةُ «بيده» والإقرارُ مختومٌ باسمه", () => {
    const { store, assetId, moveId } = handedToTeacher()
    const done = acknowledgeReceipt(store, custodyContext("u-teacher"), {
      moveId,
      personId: "u-teacher",
    })
    if (!done.ok) throw new Error(done.error.code)
    expect(done.value.acknowledgedBy).toBe("u-teacher")
    expect(assetStateOf(store, assetId)?.status).toBe("held")
    expect(pendingReceiptsFor(store, "u-teacher")).toEqual([])
  })

  it("**والمسلِّمُ لا يقرّ عن مستلِمه** — دفاعٌ في العمق داخل الخدمة", () => {
    const { store, moveId } = handedToTeacher()
    const rejected = acknowledgeReceipt(store, custodyContext("u-amir"), {
      moveId,
      personId: "u-amir",
    })
    if (rejected.ok) throw new Error("المسلِّم أقرّ عن مستلِمه")
    expect(rejected.error.code).toBe("NOT_RECEIVING_HOLDER")
  })

  it("والإقرارُ مرّتين مرفوض، وحركةٌ مجهولة مرفوضة", () => {
    const { store, moveId } = handedToTeacher()
    acknowledgeReceipt(store, custodyContext("u-teacher"), { moveId, personId: "u-teacher" })
    const again = acknowledgeReceipt(store, custodyContext("u-teacher"), {
      moveId,
      personId: "u-teacher",
    })
    if (again.ok) throw new Error("إقرارٌ مكرَّرٌ مرّ")
    expect(again.error.code).toBe("ALREADY_ACKNOWLEDGED")

    const missing = acknowledgeReceipt(store, custodyContext("u-teacher"), {
      moveId: "mv-وهميّة",
      personId: "u-teacher",
    })
    if (missing.ok) throw new Error("إقرارُ حركةٍ مجهولةٍ مرّ")
    expect(missing.error.code).toBe("MOVE_NOT_FOUND")
  })

  it("والحركةُ غيرُ القابلة للإقرار (إعادةٌ/تلفٌ/فقد) لا تُقرّ — الإقرارُ للاستلام وحده", () => {
    const { store, assetId } = handedToTeacher()
    const returned = recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "return",
      conditionAr: "أُعيد سليماً",
    })
    if (!returned.ok) throw new Error(returned.error.code)
    const rejected = acknowledgeReceipt(store, custodyContext("u-teacher"), {
      moveId: returned.value.id,
      personId: "u-teacher",
    })
    if (rejected.ok) throw new Error("إقرارُ إعادةٍ مرّ")
    expect(rejected.error.code).toBe("NOT_ACKNOWLEDGEABLE")
  })

  it("**والحركةُ المنسوخةُ بحركةٍ بعدها لا تُقرّ** — الإقرارُ لِما هو قائمٌ الآن", () => {
    const { store, assetId, moveId } = handedToTeacher()
    recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "hand",
      toPersonId: "u-committee-head",
      conditionAr: "سليم",
    })
    const stale = acknowledgeReceipt(store, custodyContext("u-teacher"), {
      moveId,
      personId: "u-teacher",
    })
    if (stale.ok) throw new Error("إقرارُ حركةٍ منسوخةٍ مرّ")
    expect(stale.error.code).toBe("MOVE_SUPERSEDED")
  })
})

describe("ق-٧٩ على الخادم — **المدير لا يقرّ عن غيره ولو ملك كلَّ شيءٍ آخر**", () => {
  it("المديرُ وغيرُه من غير المستلِم: كلُّهم مرفوضون، والمستلِمُ وحده ينجح", async () => {
    const { store, moveId } = handedToTeacher()
    const ep = makeCustodyEndpoints(store, canonicalDirectory)

    // **CR-012/قب-٣٨ — لكلٍّ سببُه المميِّز**: مَن لا تحمل حزمتُه `custody.own` (المديرُ
    // والطالب في المصفوفة) يُردّ عند **الشرط الأول**، ومَن يحملها يُردّ عند **الثاني**.
    // والقرارُ في الحالتين واحد: **لا يقرّ أحدٌ استلامَ غيره** (ق-٧٩).
    const expected: Readonly<Record<string, string>> = {
      "u-admin": "DENIED_PERSONAL_NOT_IN_ROLE",
      "u-student": "DENIED_PERSONAL_NOT_IN_ROLE",
      "u-amir": "DENIED_PERSONAL_NOT_OWNER",
      "u-square": "DENIED_PERSONAL_NOT_OWNER",
      "u-finance": "DENIED_PERSONAL_NOT_OWNER",
      "u-section-head": "DENIED_PERSONAL_NOT_OWNER",
      "u-committee-head": "DENIED_PERSONAL_NOT_OWNER",
    }
    for (const [personId, reason] of Object.entries(expected)) {
      const r = await ep.acknowledge.invoke({ moveId }, canonicalActor(personId), WRITE)
      expect(r.ok, `«${personId}» أقرّ استلامَ غيره`).toBe(false)
      if (!r.ok) expect(r.decision.reason, personId).toBe(reason)
    }

    const owner = await ep.acknowledge.invoke({ moveId }, canonicalActor("u-teacher"), WRITE)
    expect(owner.ok).toBe(true)
  })

  it("**والمقرُّ من الجلسة لا من المدخل**: لا يُزوَّر إقرارٌ باسم غيره", async () => {
    const { store, moveId } = handedToTeacher()
    const ep = makeCustodyEndpoints(store, canonicalDirectory)
    // المدخلُ لا يحمل «مَن يقرّ» أصلاً — التوقيعُ نفسُه يمنع الانتحال.
    const done = await ep.acknowledge.invoke({ moveId }, canonicalActor("u-teacher"), WRITE)
    if (!done.ok) throw new Error(done.decision.reason)
    expect(done.value.ok).toBe(true)
  })
})
