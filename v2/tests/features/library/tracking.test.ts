/**
 * ق-٩٦ — **مصفوفةُ المتابعة بعزل النطاق** (عقدُ الوحدة §٩/§١٠).
 *
 * «يتابع البرنامجُ استلامَ كل مسؤولٍ لها والتأكد من إنجاز قراءتها» (المالك نصاً): فالمصفوفةُ
 * **أفرادُ النطاق × الموادُّ الإلزامية التي تبلغهم من كتالوج ذلك النطاق** — لا كلُّ الشبكة،
 * ولا مادةٌ لا تخصّهم، **ولا مادةٌ خارج ما تراه الصفحةُ نفسُها** (ق-١١١: الحقيقةُ الواحدة).
 */
import { describe, it, expect } from "vitest"
import {
  archiveMaterial,
  createMaterial,
} from "../../../src/features/library/services/materials.js"
import { myLibrary } from "../../../src/features/library/services/mine.js"
import { completeMaterial, openMaterial } from "../../../src/features/library/services/timeline.js"
import { manageView, trackingMatrix } from "../../../src/features/library/services/tracking.js"
import { libraryContext, materialInput, seedLibraryStore, KHALID_PATH, ROOT_PATH } from "./_seed.js"
import type { LibraryStore } from "../../../src/features/library/data/store.js"
import type { CreateMaterialInput } from "../../../src/features/library/services/materials.js"

function material(store: LibraryStore, over: Partial<CreateMaterialInput> = {}): string {
  const made = createMaterial(store, libraryContext("u-admin"), materialInput(over))
  if (!made.ok) throw new Error(made.error.code)
  return made.value.id
}

const ADMIN = () => libraryContext("u-admin")

describe("مصفوفةُ المتابعة — أفرادُ النطاق × الإلزاميّ الذي يبلغهم", () => {
  it("**المصفوفةُ للإلزاميّ وحده** — والاختياريُّ عرضٌ لا متابعة", () => {
    const store = seedLibraryStore()
    const must = material(store, { unitId: "khalid", mandatory: true })
    material(store, { unitId: "khalid" })

    for (const row of trackingMatrix(store, ADMIN(), KHALID_PATH)) {
      expect(row.cells.map((c) => c.materialId)).toEqual([must])
    }
  })

  it("**والحالةُ في الخلية هي حالةُ خط الزمن نفسُها** — لا حسابٌ ثانٍ يتباعد", () => {
    const store = seedLibraryStore()
    const id = material(store, { unitId: "khalid", mandatory: true })
    const amir = libraryContext("u-amir")
    const stateOfAmir = () =>
      trackingMatrix(store, ADMIN(), KHALID_PATH).find((r) => r.personId === "u-amir")

    expect(stateOfAmir()?.cells[0]?.state).toBe("notDelivered")
    myLibrary(store, amir)
    expect(stateOfAmir()?.cells[0]?.state).toBe("delivered")
    openMaterial(store, amir, { materialId: id })
    expect(stateOfAmir()?.cells[0]?.state).toBe("opened")
    completeMaterial(store, amir, { materialId: id })

    const done = stateOfAmir()
    expect(done?.cells[0]?.state).toBe("completed")
    expect(done?.completed).toBe(1)
    expect(done?.total).toBe(1)
  })

  it("**ومن لا تبلغه المادةُ لا يدخل صفّاً في مصفوفتها** — الجمهورُ يحكم الصفوفَ لا الأسماء", () => {
    const store = seedLibraryStore()
    material(store, { unitId: "khalid", mandatory: true, audienceId: "teachers" })

    const people = trackingMatrix(store, ADMIN(), KHALID_PATH).map((r) => r.personId)
    expect(people).toContain("u-teacher")
    expect(people).not.toContain("u-amir")
    expect(people).not.toContain("u-student")
  })

  it("**والعزلُ بالنطاق**: مصفوفةُ مسجدٍ لا تحمل أحداً من خارجه", () => {
    const store = seedLibraryStore()
    material(store, { unitId: "khalid", mandatory: true })

    const mosque = trackingMatrix(store, ADMIN(), KHALID_PATH).map((r) => r.personId)
    expect(mosque).toContain("u-amir")
    expect(mosque).not.toContain("u-amir-omar")
    expect(mosque).not.toContain("u-rabita")
  })

  it("ومادةُ الشبكة على صفحة الشبكة تُطالِب أهلَ الشبكة كلَّهم", () => {
    const store = seedLibraryStore()
    material(store, { unitId: "root", mandatory: true })

    const network = trackingMatrix(store, ADMIN(), ROOT_PATH).map((r) => r.personId)
    expect(network).toContain("u-amir")
    expect(network).toContain("u-amir-omar")
  })

  it("**ومَن دورُه موقوفٌ أو تكليفُه منتهٍ أو معلَّقٌ لا يُطالَب** — لا جمهورَ له ولا صفّ", () => {
    const store = seedLibraryStore()
    material(store, { unitId: "root", mandatory: true })

    const people = trackingMatrix(store, ADMIN(), ROOT_PATH).map((r) => r.personId)
    for (const personId of ["u-suspended-role", "u-ended", "u-pending"]) {
      expect(people, personId).not.toContain(personId)
    }
  })

  it("والترتيبُ بالحاجة (ق-١٠٨): الأقلُّ إنجازاً أولاً ثم المعرّفُ حتميّةً", () => {
    const store = seedLibraryStore()
    const id = material(store, { unitId: "khalid", mandatory: true })
    const amir = libraryContext("u-amir")
    myLibrary(store, amir)
    openMaterial(store, amir, { materialId: id })
    completeMaterial(store, amir, { materialId: id })

    const rows = trackingMatrix(store, ADMIN(), KHALID_PATH)
    expect(rows[0]?.completed).toBe(0)
    expect(rows[rows.length - 1]?.personId).toBe("u-amir")
  })

  it("**ونموذجُ صفحة الإدارة يجمع كتالوجَ النطاق ومصفوفتَه وحدودَ رفعه** (ق-١١١)", () => {
    const store = seedLibraryStore()
    material(store, { unitId: "khalid", mandatory: true })
    material(store, { unitId: "omar" })

    const view = manageView(store, ADMIN(), KHALID_PATH)
    expect(view.unitPath).toBe(KHALID_PATH)
    // الكتالوجُ **هابطٌ من نطاق الصفحة** — مادةُ مسجدٍ آخر ليست منه (ق-١٧/ق-١١٠).
    expect(view.catalog).toHaveLength(1)
    expect(view.tracking.length).toBeGreaterThan(0)
    expect(view.limits.acceptedTypes.length).toBeGreaterThan(0)
  })

  it("**والمؤرشفةُ تبقى في كتالوج الإدارة موسومةً وتخرج من المصفوفة** (المادة ٧/٤)", () => {
    const store = seedLibraryStore()
    const id = material(store, { unitId: "khalid", mandatory: true })
    archiveMaterial(store, ADMIN(), { materialId: id })

    const view = manageView(store, ADMIN(), KHALID_PATH)
    expect(view.catalog).toHaveLength(1)
    expect(view.catalog[0]?.archived).toBe(true)
    expect(view.tracking).toHaveLength(0)
  })

  it("**وفراغُ الصفحة يقول سببَه** (ق-١٠٦/ق-١١٢): لا مادةَ بعد ⟵ «خامل»، ولا أحدَ في النطاق ⟵ «شاغر»", () => {
    const store = seedLibraryStore()
    expect(manageView(store, ADMIN(), KHALID_PATH).emptiness).toBe("idle")

    const vacant = libraryContext("u-admin", { ports: { peopleIn: () => [] } })
    material(store, { unitId: "khalid", mandatory: true })
    expect(manageView(store, vacant, KHALID_PATH).emptiness).toBe("vacant")
  })
})
