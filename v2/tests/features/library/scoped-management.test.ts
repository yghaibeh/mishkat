/**
 * **الاختبارُ الإلزاميُّ الأول** — **ح-٦ مقفول**: رأسُ قسمٍ يعدّل مادةً في قسمٍ آخر ⇒
 * **مرفوض** بتنطيق `library.manage` (عقدُ الوحدة §٣، ق-م٨/قب-١١).
 *
 * وفي v1 كان `canManage(u) = isGlobalAdmin(u) || u.assignments.some(a => a.role === "section_head")`
 * — **بلا بُعدٍ نطاقيٍّ إطلاقاً** (`materials.server.ts:118-153`)، فرأسُ قسمٍ واحدٍ يعدّل
 * موادَّ القسم النسائيّ الآخر. وهنا **النطاقُ يُشتقّ من المادة المخزَّنة**، فالمنعُ بنيويّ.
 */
import { describe, it, expect } from "vitest"
import { makeLibraryEndpoints } from "../../../src/features/library/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { createMaterial } from "../../../src/features/library/services/materials.js"
import {
  DECISION,
  UPLOAD_LIMIT,
  WRITE,
  canonicalActor,
  libraryContext,
  libraryDirectory,
  libraryPorts,
  materialInput,
  seedLibraryStore,
} from "./_seed.js"
import type { LibraryStore } from "../../../src/features/library/data/store.js"

function endpoints(store: LibraryStore) {
  clearRegistryForTests()
  return makeLibraryEndpoints(store, createSettingsResolver([UPLOAD_LIMIT]), libraryDirectory, libraryPorts())
}

function material(store: LibraryStore, unitId: string): string {
  const made = createMaterial(store, libraryContext("u-admin"), materialInput({ unitId }))
  if (!made.ok) throw new Error(made.error.code)
  return made.value.id
}

describe("ح-٦ — `library.manage` منطاقةٌ: رأسُ قسمٍ لا يبلغ قسماً آخر", () => {
  it("**رأسُ قسم الشباب يعدّل مادةَ القسم النسائيّ ⇒ مرفوض** (وهو نصُّ ح-٦)", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)
    const womenMaterial = material(store, "women")

    const r = await ep.updateMaterial.invoke(
      { materialId: womenMaterial, titleAr: "عنوانٌ مسروق" },
      canonicalActor("u-section-head"),
      WRITE,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
    expect(store.getMaterial(womenMaterial)?.titleAr).not.toBe("عنوانٌ مسروق")
  })

  it("ويديرُ موادَّ قسمه وما تحته — النطاقُ «و» احتواءٌ لا مطابقة", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)

    for (const unitId of ["men", "homs", "khalid"]) {
      const id = material(store, unitId)
      const r = await ep.updateMaterial.invoke(
        { materialId: id, titleAr: `عنوانٌ محدَّثٌ في ${unitId}` },
        canonicalActor("u-section-head"),
        WRITE,
      )
      expect(r.ok, unitId).toBe(true)
    }
  })

  it("**ولا يُنشئ في قسمٍ ليس نطاقَه** — المنعُ عند الإنشاء كما هو عند التعديل", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)

    const r = await ep.createMaterial.invoke(
      materialInput({ unitId: "women" }),
      canonicalActor("u-section-head"),
      WRITE,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("**ولا يؤرشف مادةَ غيره** — الأرشفةُ فعلٌ على المادة فنطاقُها نطاقُها", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)
    const womenMaterial = material(store, "women")

    const r = await ep.archiveMaterial.invoke(
      { materialId: womenMaterial },
      canonicalActor("u-section-head"),
      WRITE,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
    expect(store.getMaterial(womenMaterial)?.archivedAt).toBeNull()
  })

  it("والإدارةُ على الجذر تبلغ القسمين — **لأنّ نطاقَ تكليفها الجذر**، لا لأنها «مدير»", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)
    const womenMaterial = material(store, "women")

    const r = await ep.archiveMaterial.invoke(
      { materialId: womenMaterial },
      canonicalActor("u-admin"),
      WRITE,
    )
    expect(r.ok).toBe(true)
  })

  it("**ومَن لا يملك `library.manage` مرفوضٌ ولو كان في النطاق**: الأميرُ والمنطقةُ والمعلّم", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)
    const id = material(store, "khalid")

    for (const personId of ["u-amir", "u-rabita", "u-square", "u-teacher", "u-student"]) {
      const r = await ep.updateMaterial.invoke(
        { materialId: id, titleAr: "عنوانٌ من غير مالك" },
        canonicalActor(personId),
        WRITE,
      )
      expect(r.ok, personId).toBe(false)
      if (!r.ok) expect(["DENIED_NO_CAPABILITY", "DENIED_OUT_OF_SCOPE"]).toContain(r.decision.reason)
    }
  })

  it("**والمادةُ المجهولة ⇒ `NO_SCOPE` ⇒ رفضٌ يُقفل ولا يُفتح** (§٥.٢ ثابت ٣)", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)

    const r = await ep.updateMaterial.invoke(
      { materialId: "mat-404", titleAr: "لا شيء" },
      canonicalActor("u-admin"),
      WRITE,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("**ومصفوفةُ المتابعة معزولةٌ بالنطاق كذلك** — لا يرى رأسُ القسم أحداً خارج قسمه", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)

    const denied = await ep.manageView.invoke(
      { unitId: "women" },
      canonicalActor("u-section-head"),
      DECISION,
    )
    expect(denied.ok).toBe(false)

    const allowed = await ep.manageView.invoke(
      { unitId: "khalid" },
      canonicalActor("u-section-head"),
      DECISION,
    )
    expect(allowed.ok).toBe(true)
    if (!allowed.ok) return
    for (const row of allowed.value.tracking) {
      expect(row.personId).not.toBe("u-admin")
    }
  })
})
