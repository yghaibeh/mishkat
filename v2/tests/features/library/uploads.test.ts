/**
 * **الاختبارُ الإلزاميُّ الخامس** — المادة ٨/٤: **رفعٌ بنوعٍ أو حجمٍ مخالف ⇒ مرفوضٌ من
 * الخادم** (عقدُ الوحدة §٧) — **لا اعتماد على الواجهة**: الحرّاسُ في الخدمة، ولوحةُ الرفع
 * تُرشد بحدودِ الخادم نفسِها فلا تدعو إلى مرفوض.
 */
import { describe, it, expect } from "vitest"
import { uploadLimits, validateUpload } from "../../../src/features/library/services/uploads.js"
import { createMaterial } from "../../../src/features/library/services/materials.js"
import {
  MAX_BYTES,
  ROOT_PATH,
  UPLOAD_LIMIT,
  libraryContext,
  filelessMaterialInput,
  linkMaterialInput,
  materialInput,
  seedLibraryStore,
} from "./_seed.js"

describe("§٧ — تحقّقُ الرفع في الخادم", () => {
  it("الصيغةُ المسجَّلةُ الفعّالة والحجمُ دون السقف ⇒ قبول", () => {
    const store = seedLibraryStore()
    const r = validateUpload(store, libraryContext("u-admin"), ROOT_PATH, {
      contentType: "application/pdf",
      sizeBytes: 1_000,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.id).toBe("pdf")
  })

  it("**والصيغةُ القابلةُ للتنفيذ مرفوضةٌ قبل سؤال القاموس** — البياناتُ توسّع المسموح ولا تفتح المحظور (ت-٥)", () => {
    const store = seedLibraryStore()
    // تُدخَل في المرجع سهواً **فعّالةً**، ومع ذلك تبقى مرفوضة.
    store.saveFormat({ tenantId: store.tenantId, id: "svg", contentType: "image/svg+xml", active: true })

    const r = validateUpload(store, libraryContext("u-admin"), ROOT_PATH, {
      contentType: "image/svg+xml",
      sizeBytes: 10,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("EXECUTABLE_MEDIA_REJECTED")
  })

  it("وغيرُ المسجَّل ⇒ `UNSUPPORTED_CONTENT_TYPE`، والمُعطَّل ⇒ `FORMAT_INACTIVE` — **سببان مختلفان**", () => {
    const store = seedLibraryStore()
    const ctx = libraryContext("u-admin")

    const unknown = validateUpload(store, ctx, ROOT_PATH, {
      contentType: "application/x-msdownload",
      sizeBytes: 10,
    })
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.error.code).toBe("UNSUPPORTED_CONTENT_TYPE")

    const inactive = validateUpload(store, ctx, ROOT_PATH, {
      contentType: "application/epub+zip",
      sizeBytes: 10,
    })
    expect(inactive.ok).toBe(false)
    if (!inactive.ok) expect(inactive.error.code).toBe("FORMAT_INACTIVE")
  })

  it("**والحجمُ فوق السقف مرفوض** — والسقفُ إعدادٌ حيّ لا رقمٌ في الكود (G14/قب-٦)", () => {
    const store = seedLibraryStore()
    const r = validateUpload(store, libraryContext("u-admin"), ROOT_PATH, {
      contentType: "application/pdf",
      sizeBytes: MAX_BYTES + 1,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("FILE_TOO_LARGE")
  })

  it("والفارغُ مرفوضٌ بسببه ⇒ `EMPTY_FILE`", () => {
    const store = seedLibraryStore()
    const r = validateUpload(store, libraryContext("u-admin"), ROOT_PATH, {
      contentType: "application/pdf",
      sizeBytes: 0,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("EMPTY_FILE")
  })

  it("**والسقفُ غيرُ المضبوط يعني لا رفع** ⇒ `UPLOAD_LIMIT_UNSET` (نظيرُ `NO_SCOPE`: يُقفل ولا يُفتح)", () => {
    const store = seedLibraryStore()
    const ctx = libraryContext("u-admin", { settings: [] })
    const r = validateUpload(store, ctx, ROOT_PATH, {
      contentType: "application/pdf",
      sizeBytes: 10,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("UPLOAD_LIMIT_UNSET")
  })

  it("**والإنشاءُ يمرّ بالحارس نفسِه** — لا بابَ ثانياً للرفع يلتفّ عليه", () => {
    const store = seedLibraryStore()
    const ctx = libraryContext("u-admin")

    const tooBig = createMaterial(store, ctx, materialInput({ sizeBytes: MAX_BYTES + 1 }))
    expect(tooBig.ok).toBe(false)
    if (!tooBig.ok) expect(tooBig.error.code).toBe("FILE_TOO_LARGE")

    const badType = createMaterial(store, ctx, materialInput({ contentType: "image/svg+xml" }))
    expect(badType.ok).toBe(false)
    if (!badType.ok) expect(badType.error.code).toBe("EXECUTABLE_MEDIA_REJECTED")
  })

  it("**ومفتاحُ التخزين من المستودع لا من المدخل** (المادة ٨/٤: غيرُ قابلٍ للتخمين)", () => {
    const store = seedLibraryStore()
    const made = createMaterial(store, libraryContext("u-admin"), materialInput())
    expect(made.ok).toBe(true)
    if (!made.ok) return
    expect(made.value.storageKey).not.toBeNull()
    expect(made.value.externalUrl).toBeNull()
  })

  it("والرابطُ لا يُرفع ولا يحمل مفتاحَ تخزين، والملفُّ لا يُنشأ بلا محتوى", () => {
    const store = seedLibraryStore()
    const ctx = libraryContext("u-admin")

    const link = createMaterial(store, ctx, linkMaterialInput())
    expect(link.ok).toBe(true)
    if (link.ok) {
      expect(link.value.storageKey).toBeNull()
      expect(link.value.externalUrl).toBe("https://example.org/guide")
    }

    const linkless = createMaterial(store, ctx, linkMaterialInput({ externalUrl: "  " }))
    expect(linkless.ok).toBe(false)
    if (!linkless.ok) expect(linkless.error.code).toBe("LINK_REQUIRED")

    const fileless = createMaterial(store, ctx, filelessMaterialInput())
    expect(fileless.ok).toBe(false)
    if (!fileless.ok) expect(fileless.error.code).toBe("FILE_REQUIRED")
  })

  it("**وحدودُ الواجهة هي حدودُ الخادم نفسُها** — نسخةٌ واحدةٌ للحقيقة، والمحظورُ لا يُعرَض", () => {
    const store = seedLibraryStore()
    store.saveFormat({ tenantId: store.tenantId, id: "svg", contentType: "image/svg+xml", active: true })

    const limits = uploadLimits(store, libraryContext("u-admin"), ROOT_PATH)
    expect(limits.acceptedTypes).toEqual(["application/pdf", "audio/mpeg"])
    expect(limits.maxBytes).toBe(UPLOAD_LIMIT.value)
  })

  it("**والحدُّ غيرُ المضبوط يصل الواجهةَ صفراً** — فلا بابُ رفعٍ مفتوحٌ خلفه رفضٌ مؤكّد", () => {
    const store = seedLibraryStore()
    const limits = uploadLimits(store, libraryContext("u-admin", { settings: [] }), ROOT_PATH)
    expect(limits.maxBytes).toBe(0)
  })
})
