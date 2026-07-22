/**
 * ق-١٠٥/ق-٢٧ — **النشرُ قدرةٌ شخصية**، والحذفُ لناشرها وحده (عقدُ الوحدة §٢).
 *
 * الاختباران الإلزاميان الأول والثاني في T13:
 *  ١. **المديرُ ينشر بالنيابة ⇒ مرفوض** — «الشمولُ اطّلاعٌ لا عمل».
 *  ٢. **الحذفُ لناشرها وحده ⇒ غيرُه مرفوض** — ويأخذ صورَها معها.
 * والفرضُ يقع **في الخادم قبل جسم الدالة**، لا في الواجهة: كلُّ حالةِ سلبٍ هنا استدعاءٌ
 * مباشرٌ يتجاوز الشاشة.
 */
import { describe, it, expect } from "vitest"
import { makeMediaEndpoints } from "../../../src/features/media/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import {
  createCoverage,
  deleteCoverage,
  albumOf,
  addPhoto,
} from "../../../src/features/media/services/coverages.js"
import {
  canonicalActor,
  coverageInput,
  mediaContext,
  mediaDirectory,
  mediaPorts,
  seedMediaStore,
  UPLOAD_LIMIT,
  WRITE,
  DECISION,
  MEDIA_OF_MEN,
  scopedMediaOfficer,
} from "./_seed.js"
import type { MediaStore } from "../../../src/features/media/data/store.js"

function endpoints(store: MediaStore) {
  clearRegistryForTests()
  return makeMediaEndpoints(store, createSettingsResolver([UPLOAD_LIMIT]), mediaDirectory, mediaPorts())
}

/** تغطيةٌ منشورةٌ بألبومها — نقطةُ البدء لكل حالات الحذف. */
function published(store: MediaStore): string {
  const made = createCoverage(store, mediaContext("u-media"), coverageInput())
  if (!made.ok) throw new Error(made.error.code)
  const photo = addPhoto(store, mediaContext("u-media"), {
    coverageId: made.value.id,
    contentType: "image/jpeg",
    sizeBytes: 1_000,
  })
  if (!photo.ok) throw new Error(photo.error.code)
  return made.value.id
}

describe("ق-٢٧/ق-١٠٥ — النشرُ بالنيابة مستحيلٌ ولو ملك الطالبُ كلَّ شيءٍ آخر", () => {
  it("**المديرُ ينشر باسم مسؤول الإعلام ⇒ مرفوض** بـ`DENIED_PERSONAL_NOT_IN_ROLE`", async () => {
    const store = seedMediaStore()
    const ep = endpoints(store)

    const r = await ep.createCoverage.invoke(
      coverageInput({ publisherPersonId: "u-media" }),
      canonicalActor("u-admin"),
      WRITE,
    )

    expect(r.ok).toBe(false)
    if (r.ok) return
    // **CR-012/قب-٣٨ — العلاجُ الجذريّ**: لم يعد المنعُ معلَّقاً على «التغطيةُ ليست باسمك»
    // (وهو حارسٌ يسقط إذا أنشأها باسم **نفسِه**)، بل على «`media.post` ليست في حزمتك» —
    // فماتت الثغرةُ التي رفعها وكيلُ T13 **صنفاً** لا حالةً.
    expect(r.decision.reason).toBe("DENIED_PERSONAL_NOT_IN_ROLE")
    expect(store.coverages()).toHaveLength(0)
  })

  it("وكذلك كلُّ قائدِ نطاقٍ فوقه — النيابةُ مرفوضةٌ من الجميع لا من المدير وحده", async () => {
    const store = seedMediaStore()
    const ep = endpoints(store)

    for (const personId of ["u-section-head", "u-rabita", "u-square", "u-amir", "u-teacher", "u-student"]) {
      const r = await ep.createCoverage.invoke(
        coverageInput({ publisherPersonId: "u-media" }),
        canonicalActor(personId),
        WRITE,
      )
      expect(r.ok, `«${personId}» نشر باسم غيره`).toBe(false)
    }
    expect(store.coverages()).toHaveLength(0)
  })

  it("ومسؤولُ الإعلام نفسُه ينشر باسمه فينجح — والجسمُ يكتب **هويةَ الجلسة** لا المدخل", async () => {
    const store = seedMediaStore()
    const ep = endpoints(store)

    const r = await ep.createCoverage.invoke(
      coverageInput({ publisherPersonId: "u-media" }),
      canonicalActor("u-media"),
      WRITE,
    )
    expect(r.ok).toBe(true)
    expect(store.coverages()[0]?.publisherPersonId).toBe("u-media")
  })

  it("**والمديرُ يرفع صورةً إلى ألبوم غيره ⇒ مرفوض** — النيابةُ مقفولةٌ على كل فعلٍ لا الإنشاء وحده", async () => {
    const store = seedMediaStore()
    const id = published(store)
    const ep = endpoints(store)

    const r = await ep.addPhoto.invoke(
      { coverageId: id, contentType: "image/jpeg", sizeBytes: 1_000 },
      canonicalActor("u-admin"),
      WRITE,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_PERSONAL_NOT_IN_ROLE")
  })
})

describe("ق-١٠٥ — الحذفُ لناشرها وحده، ويأخذ صورَها معها", () => {
  it("**غيرُ الناشر مرفوضٌ في الخادم** — ولو كان مديراً أو قائدَ نطاقِ التغطية", async () => {
    const store = seedMediaStore()
    const id = published(store)
    const ep = endpoints(store)

    for (const personId of ["u-admin", "u-section-head", "u-rabita", "u-square", "u-amir"]) {
      const r = await ep.deleteCoverage.invoke({ coverageId: id }, canonicalActor(personId), WRITE)
      expect(r.ok, `«${personId}» حذف تغطيةَ غيره`).toBe(false)
      // **CR-012/قب-٣٨**: لا أحدَ من الخمسة تحمل حزمتُه `media.post` (ق-١٠٥: الإعلامُ وحده)
      // — فكلُّهم يُردّون عند الشرط الأول، وهو أقوى من الردّ بالملكية لا أضعف.
      if (!r.ok) expect(r.decision.reason, personId).toBe("DENIED_PERSONAL_NOT_IN_ROLE")
    }
    expect(store.getCoverage(id)?.deletedAt).toBeNull()
  })

  it("والناشرُ يحذف تغطيتَه — **ويأخذ الحذفُ صورَها**: الألبومُ لا يبقى معلَّقاً بلا سياق", async () => {
    const store = seedMediaStore()
    const id = published(store)
    expect(albumOf(store, id)).toHaveLength(1)
    const ep = endpoints(store)

    const r = await ep.deleteCoverage.invoke({ coverageId: id }, canonicalActor("u-media"), WRITE)
    expect(r.ok).toBe(true)
    expect(albumOf(store, id)).toHaveLength(0)
  })

  it("**والحذفُ بيانٌ لا محو** (المادة ٧/٤): مَن حذف ومتى يبقيان في السجل", () => {
    const store = seedMediaStore()
    const id = published(store)

    const r = deleteCoverage(store, mediaContext("u-media"), { coverageId: id })
    expect(r.ok).toBe(true)
    const after = store.getCoverage(id)
    expect(after?.deletedBy).toBe("u-media")
    expect(after?.deletedAt).not.toBeNull()
  })

  it("وحذفُ المحذوفةِ ثانيةً ⇒ `COVERAGE_DELETED` (لا إعادةَ كتابةٍ لماضٍ)", () => {
    const store = seedMediaStore()
    const id = published(store)
    deleteCoverage(store, mediaContext("u-media"), { coverageId: id })

    const again = deleteCoverage(store, mediaContext("u-media"), { coverageId: id })
    expect(again.ok).toBe(false)
    if (again.ok) return
    expect(again.error.code).toBe("COVERAGE_DELETED")
  })

  it("ولا تُضاف صورةٌ إلى تغطيةٍ محذوفة ⇒ `COVERAGE_DELETED`", () => {
    const store = seedMediaStore()
    const id = published(store)
    deleteCoverage(store, mediaContext("u-media"), { coverageId: id })

    const r = addPhoto(store, mediaContext("u-media"), {
      coverageId: id,
      contentType: "image/jpeg",
      sizeBytes: 1_000,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("COVERAGE_DELETED")
  })
})

describe("ق-١٠٥ — النشرُ شخصيٌّ في هويته، **منطاقٌ في مداه**", () => {
  it("مسؤولُ إعلامِ قسمٍ يغطّي وحدةً تحته — نطاقُه مداه", () => {
    const store = seedMediaStore()
    const ctx = mediaContext(MEDIA_OF_MEN)
    const r = createCoverage(store, ctx, coverageInput({ publisherPersonId: MEDIA_OF_MEN }))
    expect(r.ok).toBe(true)
  })

  it("**ولا يغطّي وحدةً خارج نطاقه** ⇒ `OUT_OF_PUBLISHING_SCOPE` (عزلُ التغطية بالنطاق)", () => {
    const store = seedMediaStore()
    // «قسمُ الأشبال النسائي» جانبيٌّ عن قسمه — لا فوقه ولا تحته.
    const r = createCoverage(store, mediaContext(MEDIA_OF_MEN), {
      ...coverageInput({ publisherPersonId: MEDIA_OF_MEN }),
      unitId: "women",
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("OUT_OF_PUBLISHING_SCOPE")
  })

  it("والفاعلُ المشتقُّ نفسُ فاعل العالم القانونيّ بدوره — لم يتغيّر إلا مسارُ إسناده", () => {
    const officer = scopedMediaOfficer()
    expect(officer.assignments).toHaveLength(1)
    expect(officer.assignments[0]?.scopePath).toBe("/men/")
    expect(officer.assignments[0]?.roleId).toBe(canonicalActor("u-media").assignments[0]?.roleId)
  })

  it("**والمدى يُسأل للمحرّك لا لقائمة أدوار**: مَن لا `media.hub` له لا مدى نشرٍ عنده", () => {
    const store = seedMediaStore()
    const r = createCoverage(store, mediaContext("u-student"), {
      ...coverageInput({ publisherPersonId: "u-student" }),
      unitId: "khalid",
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("OUT_OF_PUBLISHING_SCOPE")
    expect(DECISION.intent).toBe("read")
  })
})
