/**
 * سطوحُ الوحدة المُعلَنة — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٦.
 *
 * خمسُ دوالَّ، كلٌّ تُعلن **قدرةً من الكتالوج** و**مُحلِّلَ نطاقٍ** و**اسمَ فعلٍ للتدقيق**
 * (G7). والنطاقُ مشتقٌّ: وحدةٌ من مستودع الشبكة، أو ملكيةٌ من **التغطية المخزَّنة**، أو
 * دعوى ملكيةٍ يقارنها المحرّكُ بالجلسة (عقدُ الوحدة §٢.١).
 */
import { describe, it, expect } from "vitest"
import { makeMediaEndpoints } from "../../../src/features/media/server/endpoints.js"
import { clearRegistryForTests, registeredServerFns } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { CAPS } from "../../../src/authorization/generated/capabilities.generated.js"
import {
  canonicalActor,
  coverageInput,
  mediaDirectory,
  mediaPorts,
  seedMediaStore,
  DECISION,
  UPLOAD_LIMIT,
  WRITE,
} from "./_seed.js"
import type { MediaStore } from "../../../src/features/media/data/store.js"

function endpoints(store: MediaStore) {
  clearRegistryForTests()
  return makeMediaEndpoints(
    store,
    createSettingsResolver([UPLOAD_LIMIT]),
    mediaDirectory,
    mediaPorts(),
  )
}

describe("الإعلانُ الإلزاميّ — لا نقطةَ خادمٍ بلا قدرةٍ ونطاقٍ وتدقيق", () => {
  it("الدوالُّ الخمسُ مسجَّلةٌ بأسمائها في جدول المسارات", () => {
    const store = seedMediaStore()
    endpoints(store)
    const names = registeredServerFns().map((f) => f.declaration.name)

    expect(names).toEqual([
      "media.hub.view",
      "media.coverage.create",
      "media.coverage.photo.add",
      "media.coverage.delete",
      "media.coverages.mine",
    ])
  })

  it("وكلُّ قدرةٍ معلنةٍ **من الكتالوج**، والوحدةُ لا تستهلك إلا `media.hub` و`media.post`", () => {
    const store = seedMediaStore()
    endpoints(store)
    const caps = new Set(registeredServerFns().map((f) => String(f.declaration.capability)))

    for (const cap of caps) expect(Object.keys(CAPS)).toContain(cap)
    expect([...caps].sort()).toEqual(["media.hub", "media.post"])
  })

  it("وكلُّ دالةٍ تُعلن نيّتها ومُحلِّلَ نطاقها واسمَ فعلها في التدقيق", () => {
    const store = seedMediaStore()
    endpoints(store)
    for (const fn of registeredServerFns()) {
      expect(fn.declaration.scope, fn.declaration.name).toBeDefined()
      expect(fn.declaration.audit.length, fn.declaration.name).toBeGreaterThan(0)
      expect(["read", "write"]).toContain(fn.declaration.intent)
    }
  })

  it("**والقدرةُ الشخصية شخصيةٌ في الكتالوج نفسِه** — لا في اجتهاد هذه الوحدة", () => {
    expect(CAPS["media.post"].type).toBe("personal")
    expect(CAPS["media.hub"].type).toBe("scoped")
    expect(CAPS["media.hub"].scopeKind).toBe("subtree")
  })
})

describe("«تغطياتي» — قراءةٌ شخصيةٌ لصاحبها وحده", () => {
  it("الناشرُ يرى تغطياتِه بحال ألبومها", async () => {
    const store = seedMediaStore()
    const ep = endpoints(store)
    const made = await ep.createCoverage.invoke(coverageInput(), canonicalActor("u-media"), WRITE)
    expect(made.ok).toBe(true)

    const mine = await ep.myCoverages.invoke(
      { publisherPersonId: "u-media" },
      canonicalActor("u-media"),
      DECISION,
    )
    expect(mine.ok).toBe(true)
    if (!mine.ok) return
    expect(mine.value).toHaveLength(1)
    expect(mine.value[0]?.photoCount).toBe(0)
    expect(mine.value[0]?.published).toBe(false)
  })

  it("**وغيرُه لا يقرأ تغطياتِه** — ولو كان مديراً (اطّلاعُه على المعرض لا على ألبوم غيره)", async () => {
    const store = seedMediaStore()
    const ep = endpoints(store)

    const r = await ep.myCoverages.invoke(
      { publisherPersonId: "u-media" },
      canonicalActor("u-admin"),
      DECISION,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
  })

  it("وتصير «منشورةً» حين يصلها ألبومُها (ق-١٠٣: لا تغطيةَ بلا صورةٍ تُعرض)", async () => {
    const store = seedMediaStore()
    const ep = endpoints(store)
    const made = await ep.createCoverage.invoke(coverageInput(), canonicalActor("u-media"), WRITE)
    if (!made.ok) throw new Error(made.decision.reason)
    if (!made.value.ok) throw new Error(made.value.error.code)

    await ep.addPhoto.invoke(
      { coverageId: made.value.value.id, contentType: "image/jpeg", sizeBytes: 1_000 },
      canonicalActor("u-media"),
      WRITE,
    )

    const mine = await ep.myCoverages.invoke(
      { publisherPersonId: "u-media" },
      canonicalActor("u-media"),
      DECISION,
    )
    if (!mine.ok) throw new Error(mine.decision.reason)
    expect(mine.value[0]?.photoCount).toBe(1)
    expect(mine.value[0]?.published).toBe(true)
  })
})

describe("الفاعلُ من الجلسة لا من المدخل", () => {
  it("مَن ينشئ التغطيةَ هو صاحبُ الجلسة — ولو حمل المدخلُ معرّفاً آخرَ يمرّ من المحرّك", async () => {
    const store = seedMediaStore()
    const ep = endpoints(store)

    // الملكيةُ المُدّعاة تطابق الجلسة (وإلا لرفضها المحرّك)، والجسمُ يكتب الجلسة على أي حال.
    const r = await ep.createCoverage.invoke(
      coverageInput({ publisherPersonId: "u-media" }),
      canonicalActor("u-media"),
      WRITE,
    )
    expect(r.ok).toBe(true)
    expect(store.coverages()[0]?.publisherPersonId).toBe("u-media")
  })

  it("**والانتحالُ القرائيُّ لا يكتب**: كلُّ فعلٍ كاتبٍ يُرفض في جلسة انتحال (ب-٤٠أ)", async () => {
    const store = seedMediaStore()
    const ep = endpoints(store)
    const impersonated = { ...canonicalActor("u-media"), impersonatedBy: "u-admin" }

    const r = await ep.createCoverage.invoke(coverageInput(), impersonated, WRITE)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_IMPERSONATION_READONLY")
  })
})
