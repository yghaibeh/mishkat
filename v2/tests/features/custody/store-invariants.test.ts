/**
 * ثوابتُ المستودع — **حراسةٌ في طبقة البيانات لا في الخدمة** (المادة ١/٢، ق-٧٨/ق-٨٠).
 *
 * الخدمةُ تحرس الدلالةَ (مَن يقرّ، ومتى تُقفل السلسلة). وهذه الاختباراتُ تحرس ما هو **أعمق
 * منها**: أنّ الخرقَ يستحيل حتى لو استُدعي المستودعُ مباشرةً من مسارٍ برمجيٍّ خاطئ. فالخطأُ
 * البرمجيّ يرمي (المادة ٣/٤: الاستثناءُ للحالات البرمجية)، ولا يمرّ صامتاً فيفسد سلسلة.
 */
import { describe, it, expect } from "vitest"
import { CustodyStore } from "../../../src/features/custody/data/store.js"
import { amendAsset } from "../../../src/features/custody/services/assets.js"
import { recordCustodyMove } from "../../../src/features/custody/services/chain.js"
import {
  makeScopeReach,
  type ActorDirectory,
} from "../../../src/features/custody/services/directory.js"
import { assetStateOf } from "../../../src/features/custody/services/derive.js"
import type { Assignment } from "../../../src/authorization/can.js"
import {
  BILAL_PATH,
  canonicalActor,
  canonicalDirectory,
  custodyContext,
  KHALID_PATH,
  MAIN_TENANT_ID,
  NOW,
  seedAsset,
  seedCustodyStore,
} from "./_seed.js"

function move(id: string) {
  return {
    tenantId: MAIN_TENANT_ID,
    id,
    assetId: "as-1",
    seq: 1,
    kind: "handover" as const,
    fromPersonId: null,
    toPersonId: "u-teacher",
    conditionAr: "سليم",
    noteAr: null,
    at: NOW,
    byPersonId: "u-amir",
    acknowledgedBy: null,
    acknowledgedAt: null,
  }
}

describe("السلسلةُ **إلحاقٌ لا استبدال** — والمستودعُ يمنع لا يُصحّح", () => {
  it("حركةٌ بمعرّفٍ مكرَّر ⇒ رميةٌ برمجية — فلا تُكتب حركةٌ فوق سابقتها (ق-٧٨)", () => {
    const store = new CustodyStore(MAIN_TENANT_ID)
    store.appendMove(move("mv-1"))
    expect(() => store.appendMove(move("mv-1"))).toThrow(/مكرَّرة/)
    expect(store.moves()).toHaveLength(1)
  })

  it("وختمُ إقرارٍ لحركةٍ غير موجودة ⇒ رمية", () => {
    const store = new CustodyStore(MAIN_TENANT_ID)
    expect(() => store.stampReceipt("mv-لا-وجود", "u-teacher", NOW)).toThrow(/غير موجودة/)
  })

  it("**وختمٌ ثانٍ على مختومةٍ ⇒ رمية** — البصمةُ تُوضع مرةً واحدة (ق-٧٩)", () => {
    const store = new CustodyStore(MAIN_TENANT_ID)
    store.appendMove(move("mv-1"))
    store.stampReceipt("mv-1", "u-teacher", NOW)
    expect(() => store.stampReceipt("mv-1", "u-teacher", NOW)).toThrow(/مختومة/)
    expect(store.getMove("mv-1")?.acknowledgedBy).toBe("u-teacher")
  })

  it("وحركةٌ ووحدةٌ مجهولتان تُعيدان `null` لا كياناً مُختلَقاً", () => {
    const store = new CustodyStore(MAIN_TENANT_ID)
    expect(store.getMove("mv-وهميّة")).toBeNull()
    expect(store.getUnit("وحدةٌ-وهميّة")).toBeNull()
    expect(store.getAsset("as-وهميّ")).toBeNull()
    expect(store.assets()).toEqual([])
  })
})

describe("الذرّية — الرميةُ في المعاملة تُرجع **كلَّ** ما كُتب فيها", () => {
  it("رميةٌ داخل المعاملة ⇒ لا أصلَ ولا حركةَ ولا قيدَ تدقيقٍ ولا عدّادَ محروق", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    const auditBefore = store.audit().length
    const boom = new Error("انفجارٌ مصطنع داخل المعاملة")

    expect(() =>
      store.transaction(() => {
        store.appendMove(move(store.nextId("mv")))
        store.appendAudit({
          at: NOW,
          actorPersonId: "u-amir",
          action: "custody.move.record",
          scopePath: KHALID_PATH,
          targetId: assetId,
          beforeAr: "—",
          afterAr: "u-teacher",
        })
        throw boom
      }),
    ).toThrow(boom)

    expect(store.moves()).toHaveLength(0)
    expect(store.audit()).toHaveLength(auditBefore)
    // **والعدّادُ يرتدّ مع المعاملة**: الفشلُ لا يحرق معرّفاً (درسُ ق-٥٦ في الدفتر).
    const next = recordCustodyMove(store, custodyContext("u-amir"), {
      assetId,
      action: "hand",
      toPersonId: "u-teacher",
      conditionAr: "سليم",
    })
    if (!next.ok) throw new Error(next.error.code)
    expect(next.value.id).toBe("mv-2")
  })
})

describe("بلوغُ النطاق — التكاليفُ غيرُ الفعّالة لا تُبلِّغ (ق-٢٤/ق-٢٥)", () => {
  /** دليلٌ بتكليفٍ واحدٍ معدَّلٍ — من العالم القانونيّ نفسِه لا من فاعلٍ مُختلَق. */
  function directoryWith(overrides: Partial<Assignment>): ActorDirectory {
    const base = canonicalActor("u-amir-bilal")
    const first = base.assignments[0]!
    return () => ({ ...base, assignments: [{ ...first, ...overrides }] })
  }

  it("تكليفٌ على وحدةٍ **مؤرشفة** لا يُبلِّغ", () => {
    expect(makeScopeReach(directoryWith({ unitArchived: true }), NOW)("u-amir-bilal", BILAL_PATH)).toBe(
      false,
    )
  })

  it("**وتكليفٌ يبدأ في المستقبل** لا يُبلِّغ اليوم", () => {
    const future = new Date("2027-01-01T00:00:00.000Z")
    expect(makeScopeReach(directoryWith({ startDate: future }), NOW)("u-amir-bilal", BILAL_PATH)).toBe(
      false,
    )
  })

  it("وتكليفٌ **بلا نهاية** فعّالٌ ما دام قد بدأ", () => {
    expect(makeScopeReach(canonicalDirectory, NOW)("u-amir-bilal", BILAL_PATH)).toBe(true)
  })
})

describe("الأصلُ الوصفيُّ — التسميةُ ركنٌ، والاختياريُّ `null` لا سلسلةٌ فارغة", () => {
  it("رقمٌ تسلسليٌّ وملاحظةٌ غائبان يُحفظان `null`", () => {
    const store = seedCustodyStore()
    const bare = store.getAsset(seedAsset(store))!
    expect(bare.serialAr).toBeNull()
    expect(bare.noteAr).toBeNull()
    expect(assetStateOf(store, bare.id)?.status).toBe("inUnit")
  })

  it("**وتفريغُ التسمية بالتحرير مرفوض** — فراغاً كان أو `null` (لا أصلَ بلا اسم)", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    for (const labelAr of ["   ", null]) {
      const rejected = amendAsset(store, custodyContext("u-finance"), {
        assetId,
        fields: { labelAr },
      })
      if (rejected.ok) throw new Error("تفريغُ التسمية مرّ")
      expect(rejected.error.code).toBe("EMPTY_ASSET_LABEL")
    }
    expect(store.getAsset(assetId)?.labelAr).toBe("حاسوبٌ محمول")
  })

  it("والقيمُ الاختيارية تُفرَّغ إلى `null` صراحةً — التفريغُ تحريرٌ مشروعٌ لِما ليس ركناً", () => {
    const store = seedCustodyStore()
    const assetId = seedAsset(store)
    amendAsset(store, custodyContext("u-finance"), { assetId, fields: { serialAr: "س-١" } })
    expect(store.getAsset(assetId)?.serialAr).toBe("س-١")
    amendAsset(store, custodyContext("u-finance"), { assetId, fields: { serialAr: null } })
    expect(store.getAsset(assetId)?.serialAr).toBeNull()
  })
})
