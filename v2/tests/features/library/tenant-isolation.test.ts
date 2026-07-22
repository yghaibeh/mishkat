/**
 * **الاختبارُ الإلزاميُّ السادس (ب)** — **قب-١٨: عزلُ الشبكة بنيويّ** (عقدُ الوحدة §١١).
 *
 * الشبكتان بنفس المسارات النسبيّة **عمداً**: فلو كان العزلُ بمقارنةِ مسارٍ لَتسرّب.
 * والعزلُ هنا **بغياب المِقبض**: لكل شبكةٍ مستودعُها، و`tenantId` **مشتقٌّ من المستودع**
 * لا من مدخل العميل، والمادةُ الغريبة **لا تُحلّ أصلاً** ⇒ `NO_SCOPE` ⇒ رفض.
 */
import { describe, it, expect } from "vitest"
import { makeLibraryEndpoints } from "../../../src/features/library/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { LibraryTenantRegistry } from "../../../src/features/library/data/tenant.js"
import { createMaterial } from "../../../src/features/library/services/materials.js"
import { myLibrary } from "../../../src/features/library/services/mine.js"
import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import {
  AUDIENCES,
  CATEGORIES,
  FORMATS,
  MAIN_TENANT_ID,
  SECOND_TENANT_ID,
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

/** المستودعُ الثاني يُبذَر **بنفس المسارات** — فالتطابقُ لا يسرّب لأنّ المِقبض غائب. */
function seedSecondTenant(registry: LibraryTenantRegistry): LibraryStore {
  const store = registry.storeFor(SECOND_TENANT_ID)
  for (const u of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId: SECOND_TENANT_ID, id: u.id, ar: u.ar, path: u.path })
  }
  for (const c of CATEGORIES) store.saveCategory({ tenantId: SECOND_TENANT_ID, ...c })
  for (const a of AUDIENCES) store.saveAudience({ tenantId: SECOND_TENANT_ID, ...a })
  for (const f of FORMATS) store.saveFormat({ tenantId: SECOND_TENANT_ID, ...f })
  return store
}

describe("قب-١٨ — شبكةٌ لا تبلغ مادةَ أخرى ولو تطابق المسار", () => {
  it("المستودعُ يختم شبكتَه على كل كيان — و`tenantId` لا يأتي من المدخل", () => {
    const store = seedLibraryStore()
    // شبكةٌ مزوّرةٌ في المدخل تُداس بشبكة المستودع — الختمُ من المستودع لا من الداعي.
    store.saveCategory({ tenantId: "t-forged", id: "forged", ar: "فئةٌ مزوّرة" })
    expect(store.getCategory("forged")?.tenantId).toBe(MAIN_TENANT_ID)

    const made = createMaterial(store, libraryContext("u-admin"), materialInput())
    expect(made.ok).toBe(true)
    if (!made.ok) return
    expect(made.value.tenantId).toBe(MAIN_TENANT_ID)
  })

  it("والمستودعان مستقلّان: مادةُ الأولى ليست في الثانية ولو تطابق المسار", () => {
    const registry = new LibraryTenantRegistry()
    const main = registry.storeFor(MAIN_TENANT_ID)
    for (const u of buildCanonicalWorld().units) {
      main.saveUnit({ tenantId: MAIN_TENANT_ID, id: u.id, ar: u.ar, path: u.path })
    }
    for (const c of CATEGORIES) main.saveCategory({ tenantId: MAIN_TENANT_ID, ...c })
    for (const a of AUDIENCES) main.saveAudience({ tenantId: MAIN_TENANT_ID, ...a })
    for (const f of FORMATS) main.saveFormat({ tenantId: MAIN_TENANT_ID, ...f })
    const second = seedSecondTenant(registry)

    const made = createMaterial(main, libraryContext("u-admin"), materialInput({ unitId: "khalid" }))
    expect(made.ok).toBe(true)
    if (!made.ok) return

    expect(second.getMaterial(made.value.id)).toBeNull()
    expect(second.materials()).toHaveLength(0)
    expect(registry.tenantIds().sort()).toEqual([SECOND_TENANT_ID, MAIN_TENANT_ID].sort())
  })

  it("**وفاعلٌ في الشبكة الثانية لا يرى مادةَ الأولى**: «مكتبتي» على مستودع شبكته وحدها", () => {
    const registry = new LibraryTenantRegistry()
    const main = seedLibraryStore()
    const second = seedSecondTenant(registry)

    const made = createMaterial(main, libraryContext("u-admin"), materialInput({ unitId: "khalid" }))
    if (!made.ok) throw new Error(made.error.code)

    expect(myLibrary(main, libraryContext("u-amir")).items.map((i) => i.materialId)).toContain(
      made.value.id,
    )
    expect(myLibrary(second, libraryContext("u-amir")).items).toHaveLength(0)
  })

  it("**والاستدعاءُ المباشر بمعرّفٍ من شبكةٍ أخرى ⇒ رفضٌ** (`NO_SCOPE` لا تسريب)", async () => {
    const registry = new LibraryTenantRegistry()
    const main = seedLibraryStore()
    const second = seedSecondTenant(registry)

    const made = createMaterial(main, libraryContext("u-admin"), materialInput({ unitId: "khalid" }))
    if (!made.ok) throw new Error(made.error.code)

    clearRegistryForTests()
    const ep = makeLibraryEndpoints(
      second,
      createSettingsResolver([UPLOAD_LIMIT]),
      libraryDirectory,
      libraryPorts(),
    )
    const r = await ep.updateMaterial.invoke(
      { materialId: made.value.id, titleAr: "عبورٌ بين شبكتين" },
      canonicalActor("u-admin"),
      WRITE,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
    expect(main.getMaterial(made.value.id)?.titleAr).not.toBe("عبورٌ بين شبكتين")
  })
})
