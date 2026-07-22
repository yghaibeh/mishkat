/**
 * **الاختبارُ الإلزاميُّ السادس (أ)** — **قب-٣٨/CR-012**: القدرةُ الشخصية تسأل **الدورَ
 * والملكيةَ معاً** (عقدُ الوحدة §٦).
 *
 * `library.own` يحملها كلُّ دورٍ **حيّ** في الملف الذهبيّ — فالمسبارُ الصحيح هو **الدورُ
 * الذي لا يُسقط قدراته**: الموقوفُ (قب-٧) والمنتهي تكليفُه (ق-٢٤) والمعلَّق (ق-٢٥).
 * وهؤلاء **يُردّون بالسبب المميِّز `DENIED_PERSONAL_NOT_IN_ROLE`** لا بـ«لست صاحبها».
 */
import { describe, it, expect } from "vitest"
import { makeLibraryEndpoints } from "../../../src/features/library/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { createMaterial } from "../../../src/features/library/services/materials.js"
import { CAPS } from "../../../src/authorization/generated/capabilities.generated.js"
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

function material(store: LibraryStore): string {
  const made = createMaterial(store, libraryContext("u-admin"), materialInput({ unitId: "khalid" }))
  if (!made.ok) throw new Error(made.error.code)
  return made.value.id
}

describe("قب-٣٨ — `library.own` شخصيةٌ: دورُك يمنحها **وأنت** صاحبُها", () => {
  it("القدرةُ شخصيةٌ في الكتالوج نفسِه — لا في اجتهاد هذه الوحدة", () => {
    expect(CAPS["library.own"].type).toBe("personal")
    expect(CAPS["library.own"].scopeKind).toBe("personal")
    expect(CAPS["library.manage"].type).toBe("scoped")
    expect(CAPS["library.manage"].scopeKind).toBe("subtree")
  })

  it("صاحبُ الدور الحيّ يرى مكتبتَه", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)
    material(store)

    const r = await ep.mine.invoke({ personId: "u-amir" }, canonicalActor("u-amir"), WRITE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.personId).toBe("u-amir")
  })

  it("**ومَن دورُه موقوفٌ يُردّ بـ`DENIED_PERSONAL_NOT_IN_ROLE` ولو كان صاحبَ الطلب**", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)

    const r = await ep.mine.invoke(
      { personId: "u-suspended-role" },
      canonicalActor("u-suspended-role"),
      WRITE,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_PERSONAL_NOT_IN_ROLE")
  })

  it("وكذلك مَن انتهى تكليفُه ومَن تكليفُه معلَّق — الحزمةُ تُسأل لا الاسم", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)

    for (const personId of ["u-ended", "u-pending"]) {
      const r = await ep.mine.invoke({ personId }, canonicalActor(personId), WRITE)
      expect(r.ok, personId).toBe(false)
      if (!r.ok) expect(r.decision.reason, personId).toBe("DENIED_PERSONAL_NOT_IN_ROLE")
    }
  })

  it("**ومكتبةُ غيري مرفوضةٌ ولو كنتُ مديراً** ⇒ `DENIED_PERSONAL_NOT_OWNER` (ق-٢٧)", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)

    const r = await ep.mine.invoke({ personId: "u-amir" }, canonicalActor("u-admin"), WRITE)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
  })

  it("**ولا خَتمَ بالنيابة**: فتحُ مادةٍ باسم غيري مرفوضٌ **قبل جسم الدالة**", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)
    const id = material(store)
    await ep.mine.invoke({ personId: "u-amir" }, canonicalActor("u-amir"), WRITE)

    const r = await ep.open.invoke(
      { personId: "u-amir", materialId: id },
      canonicalActor("u-teacher"),
      WRITE,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
    expect(store.getProgress(id, "u-amir")?.openedAt).toBeNull()
  })

  it("**والانتحالُ القرائيّ لا يختم باسم أحد** (ب-٤٠أ): العرضُ فعلٌ كاتبٌ مُعلَنٌ كاتباً", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)
    material(store)
    const watcher = { ...canonicalActor("u-amir"), impersonatedBy: "u-admin" }

    const r = await ep.mine.invoke({ personId: "u-amir" }, watcher, DECISION)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_IMPERSONATION_READONLY")
  })
})
