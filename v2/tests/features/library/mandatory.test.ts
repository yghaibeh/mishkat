/**
 * **الاختبارُ الإلزاميُّ الرابع** — الإلزاميّ: **لا يُخفى ولا يُعتبر منجزاً بلا فعلٍ صريح**
 * (عقدُ الوحدة §٥).
 *
 * وفيه **حارسان محتوائيّان** (قب-٤٠: الدعوى البنيوية تُقاس بالمحتوى لا بالسلوك وحده):
 *  - **صفر مسارٍ ثانٍ يكتب الإنجاز**: `completedAt` لا يُكتب إلا في `completeMaterial`.
 *  - **صفر عدّادٍ مخزَّن**: لا حقلَ في كيانٍ ولا مستودعٍ يحفظ عدداً — كلُّ رقمٍ اشتقاق.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import {
  archiveMaterial,
  createMaterial,
} from "../../../src/features/library/services/materials.js"
import { myLibrary } from "../../../src/features/library/services/mine.js"
import { completeMaterial, openMaterial } from "../../../src/features/library/services/timeline.js"
import { libraryContext, materialInput, seedLibraryStore } from "./_seed.js"
import type { LibraryStore } from "../../../src/features/library/data/store.js"
import type { CreateMaterialInput } from "../../../src/features/library/services/materials.js"

const MODULE_DIR = new URL("../../../src/features/library/", import.meta.url).pathname

function sourceFiles(dir: string): readonly string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (entry.endsWith(".ts")) out.push(path)
  }
  return out
}

function material(store: LibraryStore, over: Partial<CreateMaterialInput> = {}): string {
  const made = createMaterial(store, libraryContext("u-admin"), materialInput(over))
  if (!made.ok) throw new Error(made.error.code)
  return made.value.id
}

describe("§٥ — الإلزاميُّ لا يُخفى", () => {
  it("مادةٌ إلزاميةٌ تتصدّر «مكتبتي» ولا يُسقطها مرشّحُ الفئة", () => {
    const store = seedLibraryStore()
    const must = material(store, { mandatory: true, categoryId: "aqeedah" })
    material(store, { categoryId: "admin_training" })

    const filtered = myLibrary(store, libraryContext("u-amir"), { categoryId: "admin_training" })
    expect(filtered.items[0]?.materialId).toBe(must)
    expect(filtered.items.filter((i) => i.mandatory)).toHaveLength(1)
  })

  it("**ولا مرشّحَ يُخفي إلزامياً مهما ضاق**: فئةٌ لا مادةَ إلزاميةَ فيها تُبقيه ظاهراً", () => {
    const store = seedLibraryStore()
    const must = material(store, { mandatory: true, categoryId: "aqeedah" })

    const filtered = myLibrary(store, libraryContext("u-amir"), { categoryId: "other" })
    expect(filtered.items.map((i) => i.materialId)).toContain(must)
  })

  it("**ولا يُعتبر منجزاً بلا فعلٍ صريح**: العرضُ والفتحُ لا يُنجزان", () => {
    const store = seedLibraryStore()
    const id = material(store, { mandatory: true })
    const ctx = libraryContext("u-amir")

    myLibrary(store, ctx)
    openMaterial(store, ctx, { materialId: id })
    expect(myLibrary(store, ctx).mandatoryCompleted).toBe(0)

    completeMaterial(store, ctx, { materialId: id })
    expect(myLibrary(store, ctx).mandatoryCompleted).toBe(1)
  })

  it("والأرشفةُ لا تُنجز مادةً لم تُنجَز — تُخرجها من العرض والعدّاد معاً", () => {
    const store = seedLibraryStore()
    const id = material(store, { mandatory: true })
    const ctx = libraryContext("u-amir")
    myLibrary(store, ctx)

    archiveMaterial(store, libraryContext("u-admin"), { materialId: id })

    const view = myLibrary(store, ctx)
    expect(view.mandatoryTotal).toBe(0)
    expect(view.mandatoryCompleted).toBe(0)
    expect(store.getProgress(id, "u-amir")?.completedAt).toBeNull()
  })
})

describe("§٥/§١ — حارسان محتوائيّان على سطح الوحدة (قب-٤٠)", () => {
  it("**صفر مسارٍ ثانٍ يكتب الإنجاز**: `completedAt` لا يُسنَد إلا في `timeline.ts`", () => {
    const writers = sourceFiles(MODULE_DIR).filter((file) => {
      if (file.endsWith("types.ts")) return false
      const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
      return /completedAt\s*:/.test(code) || /completedAt\s*=/.test(code)
    })
    expect(writers.map((f) => f.slice(MODULE_DIR.length))).toEqual(["services/timeline.ts"])
  })

  it("**وصفر عدّادٍ مخزَّن**: لا حقلَ يحفظ عدداً في الأنواع ولا في طبقة البيانات", () => {
    const offenders: string[] = []
    for (const file of sourceFiles(MODULE_DIR)) {
      const rel = file.slice(MODULE_DIR.length)
      if (!rel.startsWith("data/") && rel !== "types.ts") continue
      const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
      for (const m of code.matchAll(/^\s*(?:readonly\s+)?(\w*(?:[Cc]ount|[Tt]otal|[Tt]ally)\w*)\s*:/gm)) {
        offenders.push(`${rel} — ${m[1]}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
