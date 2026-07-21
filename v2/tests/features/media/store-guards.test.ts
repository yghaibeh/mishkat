/**
 * ثوابتُ طبقة البيانات وحدودُ الحدّ — عقدُ الوحدة §١٠ و§٧ (المادة ٧/٤ + المادة ٨/٤).
 *
 * ثلاثةُ حرّاسٍ لا يظهرون في المسار السعيد ويقرّرون سلامةَ النظام يوم يخطئ أحدٌ ما:
 *  ١. **الذرّية**: فشلٌ في المنتصف لا يترك نصفَ كيان، **ولا يحرق معرّفاً** (نظيرُ عدّاد
 *     السندات في النواة).
 *  ٢. **المدخلُ الناقصُ يُقفل ولا يُفتح**: طلبٌ بلا معرّفٍ ⇒ لا نطاق ⇒ رفضٌ في الخادم.
 *  ٣. **الإعدادُ بقيمةٍ من نوعٍ خاطئ لا يُفسَّر رقماً**: يُقفل ولا يُفتح — فإعدادٌ فاسدٌ
 *     لا يصير باباً مفتوحاً (وهو نمطُ «fail-open» الذي أنتج ثغرات v1).
 */
import { describe, it, expect } from "vitest"
import { MediaStore } from "../../../src/features/media/data/store.js"
import { makeMediaEndpoints } from "../../../src/features/media/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { mediaHubView } from "../../../src/features/media/services/gallery.js"
import { addPhoto, albumOf, createCoverage, myCoverages } from "../../../src/features/media/services/coverages.js"
import {
  canonicalActor,
  coverageInput,
  mediaContext,
  mediaDirectory,
  mediaPorts,
  seedMediaStore,
  DECISION,
  UPLOAD_LIMIT,
  WRITE,
  KHALID_PATH,
} from "./_seed.js"

const VALID_FROM = new Date("2026-01-01T00:00:00.000Z")

describe("الذرّية — الفشلُ لا يترك أثراً ولا يحرق معرّفاً", () => {
  it("رميةٌ داخل المعاملة تُرجع التغطياتِ والصورَ والعدّادَ معاً", () => {
    const store = seedMediaStore()
    const first = createCoverage(store, mediaContext("u-media"), coverageInput())
    if (!first.ok) throw new Error(first.error.code)

    expect(() =>
      store.transaction(() => {
        store.saveCoverage({ ...first.value, id: "mc-doomed", titleAr: "لن تبقى" })
        throw new Error("فشلٌ في منتصف العملية")
      }),
    ).toThrow()

    expect(store.getCoverage("mc-doomed")).toBeNull()
    expect(store.coverages()).toHaveLength(1)

    // والعدّادُ ارتدّ: التغطيةُ التالية تأخذ الرقمَ الذي كان بانتظارها لا الذي بعده.
    const next = createCoverage(store, mediaContext("u-media"), coverageInput())
    if (!next.ok) throw new Error(next.error.code)
    expect(next.value.id).toBe("mc-2")
  })

  it("وألبومُ تغطيةٍ لا وجودَ لها فارغٌ — لا رميةَ ولا صورةٌ يتيمة", () => {
    const store = new MediaStore("t-main")
    expect(albumOf(store, "mc-404")).toEqual([])
  })

  it("و«تغطياتي» ترتّب المتعادلَين بالمعرّف — حتميّةٌ لا عشوائيةُ عرض", () => {
    const store = seedMediaStore()
    for (const titleAr of ["أ", "ب"]) {
      const made = createCoverage(store, mediaContext("u-media"), coverageInput({ titleAr }))
      if (!made.ok) throw new Error(made.error.code)
    }
    const mine = myCoverages(store, mediaContext("u-media"))
    expect(mine.map((c) => c.id)).toEqual(["mc-1", "mc-2"])
  })
})

describe("المدخلُ الناقصُ يُقفل ولا يُفتح (§٥.٢ ثابت ٣)", () => {
  it("طلبُ معرضٍ بلا معرّفِ وحدةٍ ⇒ لا نطاق ⇒ رفض", async () => {
    const store = seedMediaStore()
    clearRegistryForTests()
    const ep = makeMediaEndpoints(store, createSettingsResolver([UPLOAD_LIMIT]), mediaDirectory, mediaPorts())

    const r = await ep.hubView.invoke(
      { unitId: undefined as unknown as string },
      canonicalActor("u-admin"),
      DECISION,
    )
    expect(r.ok).toBe(false)
  })

  it("وفعلٌ على تغطيةٍ بلا معرّفها ⇒ لا نطاق ⇒ رفض (ولا يُفتح للناشر نفسه)", async () => {
    const store = seedMediaStore()
    clearRegistryForTests()
    const ep = makeMediaEndpoints(store, createSettingsResolver([UPLOAD_LIMIT]), mediaDirectory, mediaPorts())

    const r = await ep.deleteCoverage.invoke(
      { coverageId: undefined as unknown as string },
      canonicalActor("u-media"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })
})

describe("الإعدادُ الفاسدُ لا يفتح باباً", () => {
  it("حجمُ صفحةِ المعرض بقيمةٍ ليست رقماً ⇒ **لا يُعرض شيء** لا «كلُّ شيء»", () => {
    const store = seedMediaStore()
    const made = createCoverage(store, mediaContext("u-media"), coverageInput())
    if (!made.ok) throw new Error(made.error.code)
    const photo = addPhoto(store, mediaContext("u-media"), {
      coverageId: made.value.id,
      contentType: "image/jpeg",
      sizeBytes: 1_000,
    })
    if (!photo.ok) throw new Error(photo.error.code)

    const ctx = mediaContext("u-media", {
      settings: [
        { settingId: "platform.page_size.media", scopePath: "/", value: "كثير", validFrom: VALID_FROM },
      ],
    })
    expect(mediaHubView(store, ctx, KHALID_PATH).items).toHaveLength(0)
  })

  it("وسقفُ الحجم بقيمةٍ ليست رقماً ⇒ `UPLOAD_LIMIT_UNSET` — لا رفعَ ببابٍ مكسور", () => {
    const store = seedMediaStore()
    const made = createCoverage(store, mediaContext("u-media"), coverageInput())
    if (!made.ok) throw new Error(made.error.code)

    const ctx = mediaContext("u-media", {
      settings: [
        { settingId: "platform.upload.max_bytes", scopePath: "/", value: "كبير", validFrom: VALID_FROM },
      ],
    })
    const r = addPhoto(store, ctx, {
      coverageId: made.value.id,
      contentType: "image/jpeg",
      sizeBytes: 1_000,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("UPLOAD_LIMIT_UNSET")
  })

  it("**ومَن لا يعرفه الدليلُ لا مدى نشرٍ له** — الغريبُ لا يغطّي (`OUT_OF_PUBLISHING_SCOPE`)", () => {
    const store = seedMediaStore()
    const r = createCoverage(store, mediaContext("u-ghost"), coverageInput({ publisherPersonId: "u-ghost" }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("OUT_OF_PUBLISHING_SCOPE")
  })
})
