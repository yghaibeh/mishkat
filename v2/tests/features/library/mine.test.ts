/**
 * **الاختبارُ الإلزاميُّ الثاني** — «مكتبتي» **ما وُجِّه إليّ أنا** (عقدُ الوحدة §٦):
 * مادةٌ لغيري **لا تظهر ولا تُفتح**، والاستدعاءُ المباشر (تجاوزاً للواجهة) **مرفوض**.
 *
 * والشرطان لا ثالثَ لهما: **انتماءُ جمهورٍ** (§٢) و**بلوغُ نطاقٍ** (ق-١٧) — وكسرُ أيٍّ
 * منهما وحدَه يكفي للمنع، وهو ما تُثبته الحالاتُ السالبة هنا.
 */
import { describe, it, expect } from "vitest"
import {
  archiveMaterial,
  createMaterial,
} from "../../../src/features/library/services/materials.js"
import { myLibrary } from "../../../src/features/library/services/mine.js"
import { openMaterial } from "../../../src/features/library/services/timeline.js"
import { materialsReaching } from "../../../src/features/library/services/reach.js"
import {
  libraryContext,
  materialInput,
  seedLibraryStore,
  KHALID_PATH,
  MEN_PATH,
} from "./_seed.js"
import type { LibraryStore } from "../../../src/features/library/data/store.js"
import type { CreateMaterialInput } from "../../../src/features/library/services/materials.js"

/** مادةٌ تُنشأ بخدمتها لا بحقنٍ في المستودع — فالبذرةُ تمرّ بالحرّاس نفسِها. */
function material(store: LibraryStore, over: Partial<CreateMaterialInput> = {}): string {
  const made = createMaterial(store, libraryContext("u-admin"), materialInput(over))
  if (!made.ok) throw new Error(made.error.code)
  return made.value.id
}

describe("«مكتبتي» — الجمهورُ والنطاقُ شرطان مجتمعان", () => {
  it("مادةُ «الجميع» على الجذر تصل كلَّ صاحب تكليف", () => {
    const store = seedLibraryStore()
    const id = material(store)
    for (const personId of ["u-amir", "u-teacher", "u-student", "u-square"]) {
      const view = myLibrary(store, libraryContext(personId))
      expect(view.items.map((i) => i.materialId), personId).toContain(id)
    }
  })

  it("**ومادةُ «المعلّمين» لا تظهر لأمير المسجد** — جمهورٌ ليس جمهورَه", () => {
    const store = seedLibraryStore()
    const id = material(store, { audienceId: "teachers" })

    expect(myLibrary(store, libraryContext("u-teacher")).items.map((i) => i.materialId)).toContain(id)
    expect(myLibrary(store, libraryContext("u-amir")).items.map((i) => i.materialId)).not.toContain(id)
  })

  it("**ومادةُ مسجدٍ لا تبلغ أميرَ مسجدٍ آخر** — نطاقٌ ليس نطاقَه (ق-١٧)", () => {
    const store = seedLibraryStore()
    const id = material(store, { unitId: "khalid" })

    expect(myLibrary(store, libraryContext("u-amir")).items.map((i) => i.materialId)).toContain(id)
    expect(
      myLibrary(store, libraryContext("u-amir-omar")).items.map((i) => i.materialId),
    ).not.toContain(id)
  })

  it("ومادةُ قسمٍ تبلغ مَن تحته ولا تبلغ القسمَ الآخر (نطاقُ الاحتواء)", () => {
    const store = seedLibraryStore()
    const id = material(store, { unitId: "men" })
    const reaching = materialsReaching(store, libraryContext("u-amir"), "u-amir").map((m) => m.id)
    expect(reaching).toContain(id)
    expect(MEN_PATH.startsWith("/men")).toBe(true)

    // لا شخصَ في القسم الآخر في العالم القانونيّ ⇒ لا أحدَ تبلغه مادةُ `/women/`.
    const womenOnly = material(store, { unitId: "women" })
    for (const personId of ["u-admin", "u-amir", "u-teacher", "u-section-head"]) {
      expect(
        myLibrary(store, libraryContext(personId)).items.map((i) => i.materialId),
        personId,
      ).not.toContain(womenOnly)
    }
  })

  it("**والمادةُ التي لا تبلغني لا تُفتح باستدعاءٍ مباشر**: جمهورٌ غيرُ جمهوري ⇒ `NOT_IN_AUDIENCE`", () => {
    const store = seedLibraryStore()
    const id = material(store, { audienceId: "teachers" })

    const opened = openMaterial(store, libraryContext("u-amir"), { materialId: id })
    expect(opened.ok).toBe(false)
    if (opened.ok) return
    expect(opened.error.code).toBe("NOT_IN_AUDIENCE")
  })

  it("**ونطاقٌ غيرُ نطاقي ⇒ `OUT_OF_MATERIAL_SCOPE`** — سببان مميِّزان لا رفضٌ مبهم", () => {
    const store = seedLibraryStore()
    const id = material(store, { unitId: "khalid" })

    const opened = openMaterial(store, libraryContext("u-amir-omar"), { materialId: id })
    expect(opened.ok).toBe(false)
    if (opened.ok) return
    expect(opened.error.code).toBe("OUT_OF_MATERIAL_SCOPE")
  })

  it("والمؤرشفةُ تخرج من «مكتبتي» ولا تُفتح — الأرشفةُ وسمٌ لا محو", () => {
    const store = seedLibraryStore()
    const id = material(store)
    const archived = archiveMaterial(store, libraryContext("u-admin"), { materialId: id })
    expect(archived.ok).toBe(true)

    expect(myLibrary(store, libraryContext("u-amir")).items.map((i) => i.materialId)).not.toContain(id)
    const opened = openMaterial(store, libraryContext("u-amir"), { materialId: id })
    expect(opened.ok).toBe(false)
    if (opened.ok) return
    expect(opened.error.code).toBe("MATERIAL_ARCHIVED")

    // والمادةُ نفسُها باقيةٌ في المستودع بوسمها — التاريخُ لا يُمحى (المادة ٧/٤).
    expect(store.getMaterial(id)?.archivedAt).not.toBeNull()
  })

  it("والترتيبُ حتميّ: الإلزاميُّ أولاً ثم الأقدمُ فالأقدم (ق-٩٦ «الإلزاميّ أولاً بعدّاد»)", () => {
    const store = seedLibraryStore()
    const first = material(store, { titleAr: "مادةٌ اختيارية أولى" })
    const mandatory = material(store, { titleAr: "مادةٌ إلزامية", mandatory: true })
    const last = material(store, { titleAr: "مادةٌ اختيارية ثانية" })

    const order = myLibrary(store, libraryContext("u-amir")).items.map((i) => i.materialId)
    expect(order).toEqual([mandatory, first, last])
  })

  it("**والعدّادان مشتقّان لا مخزَّنان**: إجماليُّ الإلزاميّ والمُنجَزُ منه على صاحبهما", () => {
    const store = seedLibraryStore()
    material(store, { mandatory: true })
    material(store, { mandatory: true })
    material(store)

    const view = myLibrary(store, libraryContext("u-amir"))
    expect(view.mandatoryTotal).toBe(2)
    expect(view.mandatoryCompleted).toBe(0)
    expect(view.personId).toBe("u-amir")
    expect(KHALID_PATH.length).toBeGreaterThan(0)
  })
})
