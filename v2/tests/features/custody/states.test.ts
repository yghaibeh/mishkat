/**
 * ق-٨٠ — **حالاتٌ صريحةٌ لا حذفٌ صامت، والحالةُ مصدرُ الحقيقة** (الاختبارُ الإلزاميّ الثالث).
 *
 * العطبُ المدفوعُ ثمنُه في v1: صفوفٌ عرضت «بعهدة فلان» و«في الوحدة» **في السطر نفسه** —
 * لأنّ الحائزَ حقلٌ باقٍ والحالةَ حقلٌ آخر، فتناقضا. وفي v2 **لا حقلَ لأيٍّ منهما**: كلاهما
 * اشتقاقٌ من الحركة الأخيرة، فيستحيل التناقض بنيوياً لا انضباطاً.
 */
import { describe, it, expect } from "vitest"
import { recordCustodyMove } from "../../../src/features/custody/services/chain.js"
import {
  assetStateOf,
  assetsInScope,
  chainOf,
  openCustodyOf,
} from "../../../src/features/custody/services/derive.js"
import { custodyContext, KHALID_PATH, NOW, seedAsset, seedCustodyStore } from "./_seed.js"

function handed(): { store: ReturnType<typeof seedCustodyStore>; assetId: string } {
  const store = seedCustodyStore()
  const assetId = seedAsset(store)
  const done = recordCustodyMove(store, custodyContext("u-amir"), {
    assetId,
    action: "hand",
    toPersonId: "u-teacher",
    conditionAr: "سليم",
  })
  if (!done.ok) throw new Error(done.error.code)
  return { store, assetId }
}

describe("ق-٨٠ — الإعادةُ تفرّغ اليدَ وتُبقي الأصلَ في وحدته", () => {
  it("بعد الإعادة: الحالةُ «في الوحدة» **ولا حائزَ يُعرض** — والسلسلةُ تحفظ من كان", () => {
    const { store, assetId } = handed()
    const returned = recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "return",
      conditionAr: "أُعيد سليماً",
    })
    if (!returned.ok) throw new Error(returned.error.code)

    const state = assetStateOf(store, assetId)
    expect(state?.status).toBe("inUnit")
    expect(state?.holderPersonId).toBeNull()
    // «من كان يحوزها» لا يضيع: السلسلةُ تحمله، والعرضُ لا يُظهره حائزاً.
    expect(returned.value.fromPersonId).toBe("u-teacher")
    expect(chainOf(store, assetId)).toHaveLength(2)
    // وموطنُ الأصل التنظيميّ لم يتحرّك.
    expect(store.getAsset(assetId)?.unitPath).toBe(KHALID_PATH)
  })

  it("وإعادةٌ بلا حائزٍ حاليّ مرفوضة — لا تُفرَّغ يدٌ فارغة", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    const rejected = recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "return",
      conditionAr: "لا شيء",
    })
    if (rejected.ok) throw new Error("إعادةٌ بلا حائزٍ مرّت")
    expect(rejected.error.code).toBe("NO_CURRENT_HOLDER")
  })
})

describe("ق-٨٠ — التلفُ والفقدُ والإخراجُ من الخدمة **حالاتٌ صريحةٌ لا حذفٌ صامت**", () => {
  const CASES = [
    { action: "damage", status: "damaged", ar: "تلفٌ بالماء" },
    { action: "loss", status: "lost", ar: "فُقد في النقل" },
    { action: "decommission", status: "retired", ar: "انتهى عمرُه" },
  ] as const

  for (const c of CASES) {
    it(`«${c.action}» يُنتج حالةً صريحةً «${c.status}» بحركةٍ مسجَّلةٍ لا بحذف`, () => {
      const { store, assetId } = handed()
      const done = recordCustodyMove(store, custodyContext("u-amir"), {
        assetId,
        action: c.action,
        conditionAr: c.ar,
      })
      if (!done.ok) throw new Error(done.error.code)

      const state = assetStateOf(store, assetId)
      expect(state?.status).toBe(c.status)
      // اليدُ تُفرَّغ، والأصلُ **يبقى موجوداً** بسلسلته كاملة — لا سطرَ يختفي.
      expect(state?.holderPersonId).toBeNull()
      expect(store.getAsset(assetId)).not.toBeNull()
      expect(chainOf(store, assetId)).toHaveLength(2)
    })

    it(`وبعد «${c.status}» تُقفل السلسلة: أيُّ حركةٍ بعدها ⇒ ASSET_CLOSED`, () => {
      const { store, assetId } = handed()
      recordCustodyMove(store, custodyContext("u-amir"), {
        assetId,
        action: c.action,
        conditionAr: c.ar,
      })
      const after = recordCustodyMove(store, custodyContext("u-amir"), {
        assetId,
        action: "hand",
        toPersonId: "u-committee-head",
        conditionAr: "سليم",
      })
      if (after.ok) throw new Error("حركةٌ بعد حالةٍ خاتمةٍ مرّت")
      expect(after.error.code).toBe("ASSET_CLOSED")
    })
  }
})

describe("ق-٨٠ — **الحالةُ تحكم لا بقايا الحقول**", () => {
  it("لا يُعرض حائزٌ مع حالةٍ غيرِ حائزة في أيّ أصلٍ من عرض النطاق", () => {
    const store = seedCustodyStore()
    const held = seedAsset(store, "khalid", "كاميرا")
    const returned = seedAsset(store, "khalid", "مكبّرُ صوت")
    const lost = seedAsset(store, "khalid", "حقيبة")

    for (const assetId of [held, returned, lost]) {
      recordCustodyMove(store, custodyContext("u-amir"), {
        assetId,
        action: "hand",
        toPersonId: "u-teacher",
        conditionAr: "سليم",
      })
    }
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

    const rows = assetsInScope(store, KHALID_PATH)
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      const holding = row.status === "pendingAck" || row.status === "held"
      expect(
        holding ? row.holderPersonId !== null : row.holderPersonId === null,
        `«${row.status}» مع حائزٍ ${String(row.holderPersonId)} — تناقضُ v1 عاد`,
      ).toBe(true)
    }
  })

  it("**وبقيةُ حائزٍ على حركةٍ خاتمة لا تُعرض حائزاً** — هذا نصُّ العطب المدفوع ثمنُه", () => {
    // مصدرُ ق-٨٠ حرفياً: «صفوفٌ قديمة عرضت *بعهدة فلان* و*في الوحدة* في السطر نفسه».
    // هنا نُحاكي تلك الصفَّ الفاسدة (بيانات v1 منقولة أو مسارٌ برمجيٌّ خاطئ) بحركةِ **إعادةٍ**
    // تحمل مستلِماً — فيثبت أنّ **الحالةَ تحكم**، ولا يُقرأ الحقلُ الباقي أصلاً.
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    store.appendMove({
      tenantId: "t-main",
      id: "mv-صفٌّ-فاسد",
      assetId,
      seq: 1,
      kind: "return",
      fromPersonId: "u-teacher",
      toPersonId: "u-teacher",
      conditionAr: "أُعيد",
      noteAr: null,
      at: NOW,
      byPersonId: "u-amir",
      acknowledgedBy: null,
      acknowledgedAt: null,
    })
    const state = assetStateOf(store, assetId)
    expect(state?.status).toBe("inUnit")
    expect(state?.holderPersonId, "بقيّةُ الحقل عُرضت حائزاً — تناقضُ v1 عاد").toBeNull()
    expect(openCustodyOf(store, "u-teacher")).toEqual([])
  })

  it("وأصلٌ مجهولٌ لا حالةَ له — `null` لا حالةٌ مُختلَقة", () => {
    const store = seedCustodyStore()
    expect(assetStateOf(store, "asset-وهميّ")).toBeNull()
    expect(chainOf(store, "asset-وهميّ")).toEqual([])
  })
})
