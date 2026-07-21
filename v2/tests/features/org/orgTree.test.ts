/**
 * الشجرة التنظيمية — SPEC_org_and_accounts §١.
 * وراثة القسم (ق-٢٠)، منع الخلط، الطبقة الموقوفة معطّلة (قب-٧)، التحريك والأرشفة الذرّية.
 */
import { describe, it, expect } from "vitest"
import { seedWorld, NOW } from "./_seed.js"
import { createUnit, moveUnit, archiveUnit } from "../../../src/features/org/services/orgTree.js"

const CTX = { now: NOW }

describe("إنشاء الوحدة: المعرّف هو المقطع ووراثة القسم (ت-٢، ق-٢٠)", () => {
  it("إنشاء مسجد تحت مربع يشتقّ مساره من الأب والمعرّف وينتهي بشرطة", () => {
    const { store } = seedWorld()
    const r = createUnit(store, CTX, {
      parentId: "sq2",
      id: "saad",
      type: "mosque",
      labelAr: "مسجد سعد",
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.path).toBe("/men/homs/sq2/saad/")
      expect(r.value.section).toBe("men")
    }
  })

  it("يرث القسم من الأب حتماً — مسجد تحت قسم النساء قسمُه «women»", () => {
    const { store } = seedWorld()
    createUnit(store, CTX, { parentId: "women", id: "wr", type: "region", labelAr: "منطقة" })
    createUnit(store, CTX, { parentId: "wr", id: "wsq", type: "square", labelAr: "مربع" })
    const r = createUnit(store, CTX, { parentId: "wsq", id: "wm", type: "mosque", labelAr: "مسجد" })
    expect(r.ok && r.value.section).toBe("women")
  })

  it("يرفض معرّفاً مكرراً", () => {
    const { store } = seedWorld()
    const r = createUnit(store, CTX, { parentId: "sq2", id: "khalid", type: "mosque", labelAr: "x" })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("DUPLICATE_ID")
  })

  it("يرفض أباً غير موجود", () => {
    const { store } = seedWorld()
    const r = createUnit(store, CTX, { parentId: "ghost", id: "m", type: "mosque", labelAr: "x" })
    expect(!r.ok && r.error.code).toBe("PARENT_NOT_FOUND")
  })

  it("قسمٌ جديد تحت الجذر يشتقّ قسمَه من مقطعه (وراثةٌ من الأب null ⇒ من المقطع)", () => {
    const { store } = seedWorld()
    const r = createUnit(store, CTX, { parentId: "root", id: "kids", type: "section", labelAr: "قسم" })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.path).toBe("/kids/")
      expect(r.value.section).toBeNull() // مقطعٌ غير men/women ⇒ بلا قسم مثبَّت
    }
  })
})

describe("منع الخلط البنيوي (ق-٢٠/ق-٢١)", () => {
  it("يرفض مسجداً ابناً مباشراً لمنطقة (تخطّي المربع في السلّم)", () => {
    const { store } = seedWorld()
    const r = createUnit(store, CTX, { parentId: "homs", id: "m", type: "mosque", labelAr: "x" })
    expect(!r.ok && r.error.code).toBe("UNIT_TYPE_MISMATCH")
  })

  it("يرفض حلقةً ابنةً لمربع", () => {
    const { store } = seedWorld()
    const r = createUnit(store, CTX, { parentId: "sq2", id: "c", type: "circle", labelAr: "x" })
    expect(!r.ok && r.error.code).toBe("UNIT_TYPE_MISMATCH")
  })
})

describe("الطبقة الموقوفة «bloc» معطّلة (قب-٧، §١.٥)", () => {
  it("يرفض إنشاء وحدة من نوع الكتلة المعطَّل — غيابُ صفوفٍ لا if خاص", () => {
    const { store } = seedWorld()
    const r = createUnit(store, CTX, { parentId: "men", id: "b1", type: "bloc", labelAr: "كتلة" })
    expect(!r.ok && r.error.code).toBe("DISABLED_UNIT_TYPE")
  })
})

describe("التحريك: إعادة اشتقاق المسار للنسل ذرّياً (§١.٣)", () => {
  it("نقل مسجد بلال من المربع الثاني إلى المربع السابع يعيد اشتقاق مساره ومسار حلقته", () => {
    const { store } = seedWorld()
    createUnit(store, CTX, { parentId: "bilal", id: "cb", type: "circle", labelAr: "حلقة بلال" })
    const r = moveUnit(store, CTX, { unitId: "bilal", newParentId: "sq7" })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.path).toBe("/men/homs/sq7/bilal/")
    expect(store.getUnit("cb")?.path).toBe("/men/homs/sq7/bilal/cb/")
  })

  it("يرفض نقلاً يغيّر القسم إن كان تحت الوحدة تكليفٌ حيّ (حماية ق-٢٠ رجعياً)", () => {
    const { store } = seedWorld()
    // خالد فيه تكليف أمير حيّ؛ نقلُه إلى قسم النساء يغيّر قسمه ⇒ يُرفض.
    createUnit(store, CTX, { parentId: "women", id: "wr2", type: "region", labelAr: "م" })
    createUnit(store, CTX, { parentId: "wr2", id: "wsq2", type: "square", labelAr: "مربع" })
    const r = moveUnit(store, CTX, { unitId: "khalid", newParentId: "wsq2" })
    expect(!r.ok && r.error.code).toBe("SECTION_MIX_REJECTED")
  })

  it("يرفض تحريك وحدة غير موجودة", () => {
    const { store } = seedWorld()
    const r = moveUnit(store, CTX, { unitId: "ghost", newParentId: "sq2" })
    expect(!r.ok && r.error.code).toBe("ENTITY_NOT_FOUND")
  })
})

describe("الأرشفة: تعطيلٌ منطقيّ يُسقط الإسناد ويرفع الحِقبة (§١.٤)", () => {
  it("أرشفة مسجد خالد تجعله مؤرشفاً وترفع حِقبة المكلَّف عليه", () => {
    const { store } = seedWorld()
    const before = store.getAccount("u-amir")!.sessionEpoch
    const r = archiveUnit(store, CTX, "khalid")
    expect(r.ok && r.value.archived).toBe(true)
    expect(store.getAccount("u-amir")!.sessionEpoch).toBeGreaterThan(before)
  })

  it("يرفض أرشفة وحدة غير موجودة", () => {
    const { store } = seedWorld()
    expect(archiveUnit(store, CTX, "ghost").ok).toBe(false)
  })
})
