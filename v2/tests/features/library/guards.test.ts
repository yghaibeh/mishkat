/**
 * حرّاسُ الحواف — أسبابُ الرفض المُشخِّصة وقياسُ التكليف الفعّال (عقدُ الوحدة §٣ و§٦ و§١٢).
 *
 * **الرفضُ يُسمّي سببَه** (المادة ٣/٤): «مجهولة» غيرُ «مؤرشفة» غيرُ «ليست جمهورك» غيرُ
 * «خارج نطاقك». والتشخيصُ جزءٌ من العقد لا زينة — فبه يعرف المستخدمُ ما يفعل، وبه يعرف
 * المشرفُ أين الخلل.
 */
import { describe, it, expect } from "vitest"
import {
  archiveMaterial,
  createMaterial,
  updateMaterial,
} from "../../../src/features/library/services/materials.js"
import { makeScopeReach } from "../../../src/features/library/services/directory.js"
import { settingNumber, settingText } from "../../../src/features/library/services/context.js"
import { inMaterialAudience, materialsInScope } from "../../../src/features/library/services/reach.js"
import { completeMaterial } from "../../../src/features/library/services/timeline.js"
import { myLibrary } from "../../../src/features/library/services/mine.js"
import { validateUpload } from "../../../src/features/library/services/uploads.js"
import {
  KHALID_PATH,
  NOW,
  ROOT_PATH,
  canonicalActor,
  libraryContext,
  materialInput,
  seedLibraryStore,
} from "./_seed.js"
import type { Actor } from "../../../src/authorization/can.js"
import type { LibraryStore } from "../../../src/features/library/data/store.js"
import type { CreateMaterialInput } from "../../../src/features/library/services/materials.js"

function material(store: LibraryStore, over: Partial<CreateMaterialInput> = {}): string {
  const made = createMaterial(store, libraryContext("u-admin"), materialInput(over))
  if (!made.ok) throw new Error(made.error.code)
  return made.value.id
}

describe("§١٢ — أخطاءُ العمل قيمٌ معلنةٌ مصنَّفة", () => {
  it("الوحدةُ المجهولة في الإنشاء ⇒ `UNKNOWN_LIBRARY_UNIT` (والنطاقُ يُقفلها قبل ذلك في الخادم)", () => {
    const store = seedLibraryStore()
    const r = createMaterial(store, libraryContext("u-admin"), materialInput({ unitId: "ghost" }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("UNKNOWN_LIBRARY_UNIT")
  })

  it("والتعديلُ يمرّ بحرّاسه: مجهولةٌ · مؤرشفةٌ · عنوانٌ فارغ · معجمٌ مجهول", () => {
    const store = seedLibraryStore()
    const id = material(store)

    const unknown = updateMaterial(store, { materialId: "mat-404" })
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.error.code).toBe("UNKNOWN_MATERIAL")

    const blank = updateMaterial(store, { materialId: id, titleAr: "   " })
    expect(blank.ok).toBe(false)
    if (!blank.ok) expect(blank.error.code).toBe("EMPTY_TITLE")

    const badCategory = updateMaterial(store, { materialId: id, categoryId: "ghost" })
    expect(badCategory.ok).toBe(false)
    if (!badCategory.ok) expect(badCategory.error.code).toBe("UNKNOWN_CATEGORY")

    const badAudience = updateMaterial(store, { materialId: id, audienceId: "ghost" })
    expect(badAudience.ok).toBe(false)
    if (!badAudience.ok) expect(badAudience.error.code).toBe("UNKNOWN_AUDIENCE")

    // **والتعديلُ الصحيح يمرّ**: العنوانُ والجمهورُ والإلزامُ — والموطنُ لا يُمسّ.
    const ok = updateMaterial(store, {
      materialId: id,
      titleAr: "دليلٌ محدَّث",
      audienceId: "teachers",
      mandatory: true,
    })
    expect(ok.ok).toBe(true)
    if (!ok.ok) return
    expect(ok.value.mandatory).toBe(true)
    expect(ok.value.unitPath).toBe(ROOT_PATH)

    archiveMaterial(store, libraryContext("u-admin"), { materialId: id })
    const afterArchive = updateMaterial(store, { materialId: id, titleAr: "بعد الأرشفة" })
    expect(afterArchive.ok).toBe(false)
    if (!afterArchive.ok) expect(afterArchive.error.code).toBe("MATERIAL_ARCHIVED")
  })

  it("والأرشفةُ لا تتكرر ولا تقع على مجهولة", () => {
    const store = seedLibraryStore()
    const id = material(store)
    const ctx = libraryContext("u-admin")

    expect(archiveMaterial(store, ctx, { materialId: "mat-404" }).ok).toBe(false)
    expect(archiveMaterial(store, ctx, { materialId: id }).ok).toBe(true)
    const twice = archiveMaterial(store, ctx, { materialId: id })
    expect(twice.ok).toBe(false)
    if (!twice.ok) expect(twice.error.code).toBe("MATERIAL_ARCHIVED")
  })

  it("**والإنجازُ على مادةٍ لم تُستلَم ⇒ `NOT_DELIVERED`**، وتكرارُه لا يعيد كتابة التاريخ", () => {
    const store = seedLibraryStore()
    const id = material(store)
    const amir = libraryContext("u-amir")

    const early = completeMaterial(store, amir, { materialId: id })
    expect(early.ok).toBe(false)
    if (!early.ok) expect(early.error.code).toBe("NOT_DELIVERED")

    myLibrary(store, amir)
    const opened = completeMaterial(store, amir, { materialId: id })
    expect(opened.ok).toBe(false)
    if (!opened.ok) expect(opened.error.code).toBe("NOT_OPENED_YET")
  })

  it("وجمهورٌ مجهولٌ في مادةٍ لا يبلغ أحداً — البياناتُ الفاسدة تُقفل ولا تُفتح", () => {
    const store = seedLibraryStore()
    const id = material(store)
    const stored = store.getMaterial(id)!
    store.saveMaterial({ ...stored, audienceId: "ghost" })

    expect(inMaterialAudience(store, libraryContext("u-amir"), store.getMaterial(id)!, "u-amir")).toBe(
      false,
    )
  })

  it("وكتالوجُ النطاق يُظهر المؤرشفةَ عند الطلب ويُخفيها عند غيره (المادة ٧/٤)", () => {
    const store = seedLibraryStore()
    const id = material(store, { unitId: "khalid" })
    archiveMaterial(store, libraryContext("u-admin"), { materialId: id })

    expect(materialsInScope(store, KHALID_PATH, true)).toHaveLength(1)
    expect(materialsInScope(store, KHALID_PATH, false)).toHaveLength(0)
  })

  it("**ومرشّحُ الفئة يمرّر الموافقَ ويُسقط المخالف** — والإلزاميُّ فوق المرشّح", () => {
    const store = seedLibraryStore()
    const matching = material(store, { categoryId: "aqeedah" })
    const other = material(store, { categoryId: "admin_training" })

    const view = myLibrary(store, libraryContext("u-amir"), { categoryId: "aqeedah" })
    const ids = view.items.map((i) => i.materialId)
    expect(ids).toContain(matching)
    expect(ids).not.toContain(other)
  })
})

describe("§٦ — قياسُ التكليف الفعّال: **مسارٌ لا مسمّى** (G6)", () => {
  const reaches = makeScopeReach((personId) => actors[personId] ?? null, NOW)

  const base = canonicalActor("u-amir")
  const withAssignment = (over: Partial<Actor["assignments"][number]>): Actor => ({
    ...base,
    assignments: base.assignments.map((a) => ({ ...a, ...over })),
  })

  const actors: Record<string, Actor> = {
    "u-amir": base,
    "u-pending-amir": withAssignment({ approvalStatus: "pending" }),
    "u-archived-amir": withAssignment({ unitArchived: true }),
    "u-future-amir": withAssignment({ startDate: new Date("2027-01-01T00:00:00.000Z") }),
    "u-ended-amir": withAssignment({ endDate: new Date("2026-05-01T00:00:00.000Z") }),
  }

  it("التكليفُ الفعّالُ داخل المسار يبلغ، والمجهولُ لا يبلغ", () => {
    expect(reaches("u-amir", KHALID_PATH)).toBe(true)
    expect(reaches("u-amir", ROOT_PATH)).toBe(true)
    expect(reaches("u-amir", "/men/homs/sq7/omar/")).toBe(false)
    expect(reaches("u-ghost", ROOT_PATH)).toBe(false)
  })

  it("**والمعلَّقُ والمؤرشفةُ وحدتُه والذي لم يبدأ والذي انتهى: لا يبلغ أحدُهم** (ق-٢٤/ق-٢٥)", () => {
    for (const personId of [
      "u-pending-amir",
      "u-archived-amir",
      "u-future-amir",
      "u-ended-amir",
    ]) {
      expect(reaches(personId, KHALID_PATH), personId).toBe(false)
    }
  })
})

describe("قراءةُ الإعدادات — النوعُ الخاطئ حالةٌ برمجيةٌ تُلقى لا خطأُ عمل (المادة ٣/٤)", () => {
  it("الرقمُ يُقرأ رقماً والنصُّ نصاً، وما خالف يرمي", () => {
    const ctx = libraryContext("u-admin")
    expect(settingNumber(ctx, "materials.mandatory_overdue_days", ROOT_PATH)).toBeGreaterThan(0)
    expect(settingText(ctx, "time.zone", ROOT_PATH).length).toBeGreaterThan(0)

    expect(() => settingNumber(ctx, "time.zone", ROOT_PATH)).toThrow(TypeError)
    expect(() => settingText(ctx, "materials.mandatory_overdue_days", ROOT_PATH)).toThrow(TypeError)
  })

  it("**وسقفُ الرفع بقيمةٍ ليست رقماً يعني لا رفع** — لا تخمينَ ولا سقوطٌ إلى مفتوح", () => {
    const store = seedLibraryStore()
    const ctx = libraryContext("u-admin", {
      settings: [
        {
          settingId: "platform.upload.max_bytes",
          scopePath: ROOT_PATH,
          value: "كبير",
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    })
    const r = validateUpload(store, ctx, ROOT_PATH, {
      contentType: "application/pdf",
      sizeBytes: 10,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("UPLOAD_LIMIT_UNSET")
  })
})
