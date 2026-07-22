/**
 * ثوابتُ طبقة البيانات — عقدُ الوحدة §١ و§١١ (`data/store.ts` و`data/tenant.ts`).
 *
 * الطبقةُ التي **تعيش فيها** الثوابتُ تُختبر كما تُختبر الخدمة: ختمُ الشبكة · حتميّةُ
 * المعرّفات · مفتاحُ التخزين من المستودع · **ذرّيةُ المعاملة** (الفشلُ يُرجع العدّادَ معه —
 * درسُ «الفشل لا يحرق رقم سند» في نواة الدفتر) · وسجلُّ الشبكات.
 */
import { describe, it, expect } from "vitest"
import { LibraryStore } from "../../../src/features/library/data/store.js"
import { LibraryTenantRegistry } from "../../../src/features/library/data/tenant.js"
import { AUDIENCES, CATEGORIES, MAIN_TENANT_ID, SECOND_TENANT_ID, NOW } from "./_seed.js"

function store(): LibraryStore {
  const s = new LibraryStore(MAIN_TENANT_ID)
  for (const c of CATEGORIES) s.saveCategory({ tenantId: MAIN_TENANT_ID, ...c })
  for (const a of AUDIENCES) s.saveAudience({ tenantId: MAIN_TENANT_ID, ...a })
  return s
}

describe("المستودع — البياناتُ المرجعية وحتميّةُ المعرّفات", () => {
  it("المعاجمُ تُقرأ كاملةً وتُختم بشبكة المستودع (قب-٢٢: بياناتٌ تُضاف فتعمل)", () => {
    const s = store()
    expect(s.categories().map((c) => c.id)).toEqual(CATEGORIES.map((c) => c.id))
    expect(s.audiences().map((a) => a.id)).toEqual(AUDIENCES.map((a) => a.id))
    for (const row of [...s.categories(), ...s.audiences()]) {
      expect(row.tenantId).toBe(MAIN_TENANT_ID)
    }
    expect(s.getCategory("ghost")).toBeNull()
    expect(s.getAudience("ghost")).toBeNull()
    expect(s.getUnit("ghost")).toBeNull()
    expect(s.formatByContentType("application/pdf")).toBeNull()
  })

  it("والمعرّفاتُ متتابعةٌ حتميّة، ومفتاحُ التخزين **من المستودع** لا من المدخل", () => {
    const s = store()
    expect(s.nextId("mat")).toBe("mat-1")
    expect(s.nextId("mat")).toBe("mat-2")
    expect(s.nextStorageKey()).toBe(`${MAIN_TENANT_ID}/library-3`)
  })

  it("**والفشلُ يُرجع العدّادَ معه** — لا معرّفَ يُحرق بمعاملةٍ ساقطة (ذرّية)", () => {
    const s = store()
    expect(() =>
      s.transaction(() => {
        s.nextId("mat")
        throw new Error("سقطت المعاملة")
      }),
    ).toThrow("سقطت المعاملة")
    expect(s.nextId("mat")).toBe("mat-1")
  })

  it("**وخطُّ الزمن سجلٌّ واحدٌ لكلّ (مادة، شخص)** — لا سجلّان يتباعدان", () => {
    const s = store()
    s.saveProgress({
      tenantId: "t-forged",
      materialId: "mat-1",
      personId: "u-amir",
      deliveredAt: NOW,
      openedAt: null,
      completedAt: null,
    })
    s.saveProgress({
      tenantId: MAIN_TENANT_ID,
      materialId: "mat-1",
      personId: "u-amir",
      deliveredAt: NOW,
      openedAt: NOW,
      completedAt: null,
    })
    const progress = s.getProgress("mat-1", "u-amir")
    expect(progress?.openedAt).toEqual(NOW)
    // والشبكةُ من المستودع ولو زُوّرت في المدخل (قب-١٨).
    expect(progress?.tenantId).toBe(MAIN_TENANT_ID)
    expect(s.getProgress("mat-1", "u-teacher")).toBeNull()
  })
})

describe("سجلُّ الشبكات — مستودعٌ لكل شبكة (قب-١٨)", () => {
  it("المستودعُ يُنشأ مرةً ثم يُعاد هو نفسُه، والسجلُّ يُسأل عن شبكته", () => {
    const registry = new LibraryTenantRegistry()
    expect(registry.has(MAIN_TENANT_ID)).toBe(false)

    const first = registry.storeFor(MAIN_TENANT_ID)
    const again = registry.storeFor(MAIN_TENANT_ID)
    expect(again).toBe(first)
    expect(registry.has(MAIN_TENANT_ID)).toBe(true)
    expect(registry.has(SECOND_TENANT_ID)).toBe(false)

    registry.storeFor(SECOND_TENANT_ID)
    expect(registry.tenantIds().sort()).toEqual([SECOND_TENANT_ID, MAIN_TENANT_ID].sort())
  })
})
