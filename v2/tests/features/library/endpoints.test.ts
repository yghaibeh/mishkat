/**
 * سطوحُ الوحدة المُعلَنة — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٩.
 *
 * ثمانِ دوالَّ، كلٌّ تُعلن **قدرةً من الكتالوج** و**مُحلِّلَ نطاقٍ** و**اسمَ فعلٍ للتدقيق**
 * (G7). والنطاقُ مشتقّ: وحدةٌ من مستودع الشبكة، أو ملكيةٌ **من هوية الجلسة**.
 *
 * **و«مكتبتي» تُعلن نيّتَها كتابةً ولا تكذب**: الاستلامُ يُختم عند أول عرض (ق-٩٦)،
 * فالعرضُ فعلٌ كاتب — وإعلانُه كذلك هو ما يجعل الانتحالَ القرائيّ لا يختم باسم أحد.
 */
import { describe, it, expect } from "vitest"
import { makeLibraryEndpoints } from "../../../src/features/library/server/endpoints.js"
import { clearRegistryForTests, registeredServerFns } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { CAPS } from "../../../src/authorization/generated/capabilities.generated.js"
import {
  DECISION,
  UPLOAD_LIMIT,
  WRITE,
  canonicalActor,
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

describe("الإعلانُ الإلزاميّ — لا نقطةَ خادمٍ بلا قدرةٍ ونطاقٍ وتدقيق", () => {
  it("الدوالُّ الثمانُ مسجَّلةٌ بأسمائها في جدول المسارات", () => {
    endpoints(seedLibraryStore())
    expect(registeredServerFns().map((f) => f.declaration.name)).toEqual([
      "library.mine.view",
      "library.material.open",
      "library.material.complete",
      "library.manage.view",
      "library.material.create",
      "library.material.update",
      "library.material.archive",
      "library.overdue.view",
    ])
  })

  it("وكلُّ قدرةٍ معلنةٍ **من الكتالوج**، والوحدةُ لا تستهلك إلا `library.own` و`library.manage`", () => {
    endpoints(seedLibraryStore())
    const caps = new Set(registeredServerFns().map((f) => String(f.declaration.capability)))
    for (const cap of caps) expect(Object.keys(CAPS)).toContain(cap)
    expect([...caps].sort()).toEqual(["library.manage", "library.own"])
  })

  it("وكلُّ دالةٍ تُعلن نيّتها ومُحلِّلَ نطاقها واسمَ فعلها في التدقيق", () => {
    endpoints(seedLibraryStore())
    for (const fn of registeredServerFns()) {
      expect(fn.declaration.scope, fn.declaration.name).toBeDefined()
      expect(fn.declaration.audit.length, fn.declaration.name).toBeGreaterThan(0)
      expect(["read", "write"]).toContain(fn.declaration.intent)
    }
  })

  it("**و«مكتبتي» مُعلَنةٌ كاتبةً** — لأنها تختم الاستلام، فالإعلانُ يصف الفعل لا الشاشة", () => {
    endpoints(seedLibraryStore())
    const intents = new Map(
      registeredServerFns().map((f) => [f.declaration.name, f.declaration.intent]),
    )
    expect(intents.get("library.mine.view")).toBe("write")
    expect(intents.get("library.manage.view")).toBe("read")
    expect(intents.get("library.overdue.view")).toBe("read")
  })

  it("والإنشاءُ يعيد **قيمةَ عملٍ مصنَّفة** لا استثناءً عند مدخلٍ فاسد (المادة ٣/٤)", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)

    for (const [over, code] of [
      [{ titleAr: "   " }, "EMPTY_TITLE"],
      [{ categoryId: "ghost" }, "UNKNOWN_CATEGORY"],
      [{ audienceId: "ghost" }, "UNKNOWN_AUDIENCE"],
    ] as const) {
      const r = await ep.createMaterial.invoke(
        materialInput(over),
        canonicalActor("u-admin"),
        WRITE,
      )
      expect(r.ok, code).toBe(true)
      if (!r.ok) continue
      expect(r.value.ok, code).toBe(false)
      if (r.value.ok) continue
      expect(r.value.error.code).toBe(code)
    }
  })

  it("والوحدةُ المجهولة في الإنشاء ⇒ `NO_SCOPE` ⇒ رفضُ صلاحيةٍ لا خطأُ عمل", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)
    const r = await ep.createMaterial.invoke(
      materialInput({ unitId: "ghost-unit" }),
      canonicalActor("u-admin"),
      WRITE,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("**ونموذجُ صفحة الإدارة واحدٌ** (ق-١١١): كتالوجٌ ومصفوفةٌ وحدودُ رفعٍ من مصدرٍ واحد", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)
    await ep.createMaterial.invoke(
      materialInput({ unitId: "khalid", mandatory: true }),
      canonicalActor("u-admin"),
      WRITE,
    )

    const view = await ep.manageView.invoke({ unitId: "khalid" }, canonicalActor("u-admin"), DECISION)
    expect(view.ok).toBe(true)
    if (!view.ok) return
    expect(view.value.unitPath).toBe("/men/homs/sq2/khalid/")
    expect(view.value.catalog).toHaveLength(1)
    expect(view.value.tracking.length).toBeGreaterThan(0)
    expect(view.value.limits.maxBytes).toBeGreaterThan(0)
  })

  it("**وخطُّ الزمن يمرّ كاملاً عبر الحدّ**: عرضٌ يختم الاستلام ⟵ فتحٌ ⟵ إقرارُ إنجاز", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)
    const made = await ep.createMaterial.invoke(
      materialInput({ unitId: "khalid", mandatory: true }),
      canonicalActor("u-admin"),
      WRITE,
    )
    if (!made.ok || !made.value.ok) throw new Error("تعذّر إنشاءُ المادة")
    const materialId = made.value.value.id
    const amir = canonicalActor("u-amir")

    const mine = await ep.mine.invoke({ personId: "u-amir" }, amir, WRITE)
    expect(mine.ok).toBe(true)
    if (!mine.ok) return
    expect(mine.value.mandatoryTotal).toBe(1)

    const opened = await ep.open.invoke({ personId: "u-amir", materialId }, amir, WRITE)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.value.ok).toBe(true)

    const done = await ep.complete.invoke({ personId: "u-amir", materialId }, amir, WRITE)
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.value.ok).toBe(true)

    const after = await ep.mine.invoke({ personId: "u-amir", filter: { categoryId: "aqeedah" } }, amir, WRITE)
    expect(after.ok).toBe(true)
    if (!after.ok) return
    expect(after.value.mandatoryCompleted).toBe(1)
  })

  it("**والواجهةُ المعلنة للتذكير تصل عبر الحدّ بقدرة الإدارة** (§٨)", async () => {
    const store = seedLibraryStore()
    const ep = endpoints(store)
    await ep.createMaterial.invoke(
      materialInput({ unitId: "khalid", mandatory: true }),
      canonicalActor("u-admin"),
      WRITE,
    )
    await ep.mine.invoke({ personId: "u-amir" }, canonicalActor("u-amir"), WRITE)

    const rows = await ep.overdue.invoke({ unitId: "khalid" }, canonicalActor("u-admin"), DECISION)
    expect(rows.ok).toBe(true)
    if (!rows.ok) return
    // لم تنقضِ العتبةُ بعد (الاستلامُ اليومَ نفسَه) — والواجهةُ تعمل وتعيد قائمةً فارغة.
    expect(rows.value).toEqual([])
  })

})
