/**
 * **الاختبارُ الإلزاميُّ الثالث** — ق-٩٦: **خطُّ الزمن أحاديّ**، «أنجز» قبل «فتح» ⇒ مرفوض،
 * **والحالةُ صريحةٌ لا مشتقّةٌ من صمت** (عقدُ الوحدة §٤).
 *
 * وهذا موضعُ **الفرق المُعلَن عن v1**: كان `stamp()` يختم «فتح» صامتاً عند الإنجاز
 * (`if (field === "completedAt" && !p.openedAt) patch.openedAt = now`) — فتقول مصفوفةُ
 * المتابعة «فُتحت» لمن لم يفتح. وهنا **يُردّ الطلبُ ويُسمّى الناقص**.
 */
import { describe, it, expect } from "vitest"
import { createMaterial } from "../../../src/features/library/services/materials.js"
import { myLibrary } from "../../../src/features/library/services/mine.js"
import {
  completeMaterial,
  openMaterial,
  stateOf,
} from "../../../src/features/library/services/timeline.js"
import { libraryContext, materialInput, seedLibraryStore, NOW } from "./_seed.js"
import type { LibraryStore } from "../../../src/features/library/data/store.js"
import type { CreateMaterialInput } from "../../../src/features/library/services/materials.js"

function material(store: LibraryStore, over: Partial<CreateMaterialInput> = {}): string {
  const made = createMaterial(store, libraryContext("u-admin"), materialInput(over))
  if (!made.ok) throw new Error(made.error.code)
  return made.value.id
}

describe("§٤ — «استلم ← فتح ← أنجز» ثلاثُ خَتماتٍ صريحة", () => {
  it("**الحالةُ لا تُشتقّ من صمت**: بلا سجلٍّ ⇒ «لم تُستلَم» لا «مستلمة»", () => {
    expect(stateOf(null)).toBe("notDelivered")
  })

  it("والاستلامُ يُختم آلياً عند **أول عرضٍ لمكتبتي** — لا قبله (ق-٩٦)", () => {
    const store = seedLibraryStore()
    const id = material(store)
    expect(store.getProgress(id, "u-amir")).toBeNull()

    const view = myLibrary(store, libraryContext("u-amir"))
    expect(view.items.find((i) => i.materialId === id)?.state).toBe("delivered")
    expect(store.getProgress(id, "u-amir")?.deliveredAt).toEqual(NOW)
  })

  it("**والفتحُ بلا استلامٍ سابق مرفوض** ⇒ `NOT_DELIVERED` (لا ختمَ يُخترع لسابقه)", () => {
    const store = seedLibraryStore()
    const id = material(store)

    const opened = openMaterial(store, libraryContext("u-amir"), { materialId: id })
    expect(opened.ok).toBe(false)
    if (opened.ok) return
    expect(opened.error.code).toBe("NOT_DELIVERED")
    expect(store.getProgress(id, "u-amir")).toBeNull()
  })

  it("**والإنجازُ قبل الفتح مرفوض** ⇒ `NOT_OPENED_YET` — وهو نصُّ «يستلزم الفتح»", () => {
    const store = seedLibraryStore()
    const id = material(store)
    myLibrary(store, libraryContext("u-amir"))

    const done = completeMaterial(store, libraryContext("u-amir"), { materialId: id })
    expect(done.ok).toBe(false)
    if (done.ok) return
    expect(done.error.code).toBe("NOT_OPENED_YET")
    // **ولا خَتمَ صامتاً**: لم يُكتب فتحٌ ولا إنجاز — الرفضُ رفضٌ كاملٌ لا نصفُ كتابة.
    const progress = store.getProgress(id, "u-amir")
    expect(progress?.openedAt).toBeNull()
    expect(progress?.completedAt).toBeNull()
  })

  it("والخطُّ كاملاً يمرّ بترتيبه: استلم ⟵ فتح ⟵ أنجز", () => {
    const store = seedLibraryStore()
    const id = material(store)
    const ctx = libraryContext("u-amir")

    myLibrary(store, ctx)
    expect(stateOf(store.getProgress(id, "u-amir"))).toBe("delivered")

    const opened = openMaterial(store, ctx, { materialId: id })
    expect(opened.ok).toBe(true)
    expect(stateOf(store.getProgress(id, "u-amir"))).toBe("opened")

    const done = completeMaterial(store, ctx, { materialId: id })
    expect(done.ok).toBe(true)
    expect(stateOf(store.getProgress(id, "u-amir"))).toBe("completed")
  })

  it("**وإعادةُ الخَتم لا تُحرّك التاريخ**: أولُ فتحٍ هو الحقيقة لا آخرُ نقرة", () => {
    const store = seedLibraryStore()
    const id = material(store)
    const ctx = libraryContext("u-amir")
    myLibrary(store, ctx)
    openMaterial(store, ctx, { materialId: id })

    const later = libraryContext("u-amir", { now: new Date("2026-08-01T00:00:00.000Z") })
    const again = openMaterial(store, later, { materialId: id })
    expect(again.ok).toBe(true)
    expect(store.getProgress(id, "u-amir")?.openedAt).toEqual(NOW)
  })

  it("**ولا خَتمَ بالنيابة**: الفاعلُ من الجلسة، فخَتمُ فلانٍ لا يقع على سجلّ غيره", () => {
    const store = seedLibraryStore()
    const id = material(store)
    myLibrary(store, libraryContext("u-amir"))
    myLibrary(store, libraryContext("u-teacher"))

    openMaterial(store, libraryContext("u-amir"), { materialId: id })
    expect(store.getProgress(id, "u-amir")?.openedAt).toEqual(NOW)
    expect(store.getProgress(id, "u-teacher")?.openedAt).toBeNull()
  })

  it("والمجهولةُ ⇒ `UNKNOWN_MATERIAL` — لا فتحَ لما لا وجودَ له", () => {
    const store = seedLibraryStore()
    const opened = openMaterial(store, libraryContext("u-amir"), { materialId: "mat-404" })
    expect(opened.ok).toBe(false)
    if (opened.ok) return
    expect(opened.error.code).toBe("UNKNOWN_MATERIAL")
  })

  it("**وإقرارُ الإنجاز مرتين لا يعيد كتابة تاريخه** — الإقرارُ حدثٌ لا زرٌّ يُضغط", () => {
    const store = seedLibraryStore()
    const id = material(store)
    const ctx = libraryContext("u-amir")
    myLibrary(store, ctx)
    openMaterial(store, ctx, { materialId: id })
    completeMaterial(store, ctx, { materialId: id })

    const later = libraryContext("u-amir", { now: new Date("2026-08-01T00:00:00.000Z") })
    const again = completeMaterial(store, later, { materialId: id })
    expect(again.ok).toBe(true)
    expect(store.getProgress(id, "u-amir")?.completedAt).toEqual(NOW)
  })
})
