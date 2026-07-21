/**
 * المادة ٨/٤ — **تحقّقُ النوع والحجم في الخادم** (عقدُ الوحدة §٧).
 *
 * الاختبارُ الإلزاميُّ السادس في T13: **رفعٌ بنوعٍ أو حجمٍ مخالف ⇒ مرفوضٌ من الخادم**
 * — لا اعتمادَ على الواجهة. وكلُّ حالةِ رفضٍ هنا **استدعاءٌ مباشرٌ يتجاوز الشاشة**.
 */
import { describe, it, expect } from "vitest"
import { makeMediaEndpoints } from "../../../src/features/media/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { addPhoto, createCoverage, albumOf } from "../../../src/features/media/services/coverages.js"
import {
  canonicalActor,
  coverageInput,
  mediaContext,
  mediaDirectory,
  mediaPorts,
  seedMediaStore,
  MAX_BYTES,
  UPLOAD_LIMIT,
  WRITE,
} from "./_seed.js"
import type { MediaStore } from "../../../src/features/media/data/store.js"

function coverageId(store: MediaStore): string {
  const made = createCoverage(store, mediaContext("u-media"), coverageInput())
  if (!made.ok) throw new Error(made.error.code)
  return made.value.id
}

describe("النوعُ من قاموسٍ مغلقٍ يُفحص في الخادم", () => {
  it("نوعٌ غيرُ مسجَّلٍ في القاموس ⇒ `UNSUPPORTED_CONTENT_TYPE`", () => {
    const store = seedMediaStore()
    const r = addPhoto(store, mediaContext("u-media"), {
      coverageId: coverageId(store),
      contentType: "application/zip",
      sizeBytes: 1_000,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("UNSUPPORTED_CONTENT_TYPE")
  })

  it("ونوعٌ مسجَّلٌ **مُعطَّل** ⇒ `FORMAT_INACTIVE` — الإيقافُ بيانٌ لا حذف", () => {
    const store = seedMediaStore()
    const r = addPhoto(store, mediaContext("u-media"), {
      coverageId: coverageId(store),
      contentType: "image/heic",
      sizeBytes: 1_000,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("FORMAT_INACTIVE")
  })

  it("**والقاموسُ بياناتٌ**: تفعيلُ الصيغة في المرجع يقبلها بلا تغيير سطرِ كود", () => {
    const store = seedMediaStore()
    store.saveFormat({ tenantId: "t-main", id: "heic", contentType: "image/heic", active: true })

    const r = addPhoto(store, mediaContext("u-media"), {
      coverageId: coverageId(store),
      contentType: "image/heic",
      sizeBytes: 1_000,
    })
    expect(r.ok).toBe(true)
  })

  it("**ولا تفتح البياناتُ المحظور**: الصيغةُ القابلةُ للتنفيذ مرفوضةٌ ولو أُدخلت القاموسَ سهواً (ت-٥)", () => {
    const store = seedMediaStore()
    store.saveFormat({ tenantId: "t-main", id: "svg", contentType: "image/svg+xml", active: true })

    const r = addPhoto(store, mediaContext("u-media"), {
      coverageId: coverageId(store),
      contentType: "image/svg+xml",
      sizeBytes: 1_000,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("EXECUTABLE_MEDIA_REJECTED")
  })
})

describe("الحجمُ **إعدادٌ حيّ** يُفحص في الخادم (قب-٦)", () => {
  it("حجمٌ فوق الحدّ المضبوط ⇒ `FILE_TOO_LARGE`", () => {
    const store = seedMediaStore()
    const r = addPhoto(store, mediaContext("u-media"), {
      coverageId: coverageId(store),
      contentType: "image/jpeg",
      sizeBytes: MAX_BYTES + 1,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("FILE_TOO_LARGE")
  })

  it("وحجمٌ مساوٍ للحدّ يُقبل — الحدُّ حدٌّ لا ما دونه", () => {
    const store = seedMediaStore()
    const r = addPhoto(store, mediaContext("u-media"), {
      coverageId: coverageId(store),
      contentType: "image/jpeg",
      sizeBytes: MAX_BYTES,
    })
    expect(r.ok).toBe(true)
  })

  it("وملفٌّ فارغٌ (أو سالبٌ) ⇒ `EMPTY_FILE`", () => {
    const store = seedMediaStore()
    for (const sizeBytes of [0, -1]) {
      const r = addPhoto(store, mediaContext("u-media"), {
        coverageId: coverageId(store),
        contentType: "image/jpeg",
        sizeBytes,
      })
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.error.code).toBe("EMPTY_FILE")
    }
  })

  it("**والحدُّ غيرُ المضبوط يعني لا رفع** ⇒ `UPLOAD_LIMIT_UNSET` — يُقفل ولا يُفتح (ق-م-٢)", () => {
    const store = seedMediaStore()
    const r = addPhoto(store, mediaContext("u-media", { settings: [] }), {
      coverageId: coverageId(store),
      contentType: "image/jpeg",
      sizeBytes: 1_000,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("UPLOAD_LIMIT_UNSET")
  })

  it("**وضبطُ الحدّ أضيقَ يضيّق فوراً** — الرقمُ إعدادٌ لا ثابتٌ في الكود", () => {
    const store = seedMediaStore()
    const narrow = mediaContext("u-media", {
      settings: [{ ...UPLOAD_LIMIT, value: 1_000 }],
    })
    const ok = addPhoto(store, narrow, {
      coverageId: coverageId(store),
      contentType: "image/jpeg",
      sizeBytes: 1_000,
    })
    expect(ok.ok).toBe(true)

    const tooBig = addPhoto(store, narrow, {
      coverageId: coverageId(store),
      contentType: "image/jpeg",
      sizeBytes: 1_001,
    })
    expect(tooBig.ok).toBe(false)
    if (tooBig.ok) return
    expect(tooBig.error.code).toBe("FILE_TOO_LARGE")
  })
})

describe("والرفضُ من الخادم لا من الواجهة — استدعاءٌ مباشرٌ يتجاوز الشاشة", () => {
  it("مسؤولُ الإعلام نفسُه يُرفض رفعُه بنوعٍ أو حجمٍ مخالف، ولا يبقى أثرٌ في الألبوم", async () => {
    const store = seedMediaStore()
    const id = coverageId(store)
    clearRegistryForTests()
    const ep = makeMediaEndpoints(
      store,
      createSettingsResolver([UPLOAD_LIMIT]),
      mediaDirectory,
      mediaPorts(),
    )

    for (const input of [
      { coverageId: id, contentType: "application/zip", sizeBytes: 1_000 },
      { coverageId: id, contentType: "image/jpeg", sizeBytes: MAX_BYTES + 1 },
    ]) {
      const r = await ep.addPhoto.invoke(input, canonicalActor("u-media"), WRITE)
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.value.ok, `قُبل رفعٌ مخالفٌ: ${input.contentType}`).toBe(false)
    }
    expect(albumOf(store, id)).toHaveLength(0)
  })
})
