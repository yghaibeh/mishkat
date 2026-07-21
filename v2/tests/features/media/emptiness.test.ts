/**
 * ق-١٠٦/ق-١١٢ — **فراغُ الإعلام يقول سببه**: شاغرٌ أم خامل (عقدُ الوحدة §٤).
 *
 * الاختبارُ الإلزاميُّ الخامس في T13: الحالتان **متمايزتان في نموذج العرض** — لا شاشةٌ
 * بيضاء ولا «لا بيانات» خام. والخطأُ الذي وُلدت منه القاعدة: فراغٌ بدا عطلاً وهو **شغورُ دور**.
 */
import { describe, it, expect } from "vitest"
import { mediaHubView } from "../../../src/features/media/services/gallery.js"
import { addPhoto, createCoverage } from "../../../src/features/media/services/coverages.js"
import { coverageInput, mediaContext, seedMediaStore, KHALID_PATH } from "./_seed.js"

describe("ق-١٠٦ — الفراغُ حالتان لا حالةٌ واحدة", () => {
  it("**«شاغر»**: لا مسؤولَ إعلامٍ على النطاق ⇒ الفراغُ يقول «عيِّن مسؤولاً»", () => {
    const store = seedMediaStore()
    const view = mediaHubView(store, mediaContext("u-media", { ports: { officersIn: () => [] } }), KHALID_PATH)

    expect(view.items).toHaveLength(0)
    expect(view.emptiness).toBe("vacant")
    expect(view.officerCount).toBe(0)
  })

  it("**«خامل»**: مسؤولٌ معيَّنٌ ولم يرفع بعد ⇒ الفراغُ يقول «معيَّنٌ ولم يُنتج»", () => {
    const store = seedMediaStore()
    const view = mediaHubView(store, mediaContext("u-media"), KHALID_PATH)

    expect(view.items).toHaveLength(0)
    expect(view.emptiness).toBe("idle")
    expect(view.officerCount).toBe(1)
  })

  it("**والحالتان متمايزتان**: نفسُ الفراغِ ونفسُ النطاق، والسببُ مختلفٌ باختلاف الشغور وحده", () => {
    const store = seedMediaStore()
    const vacant = mediaHubView(
      store,
      mediaContext("u-media", { ports: { officersIn: () => [] } }),
      KHALID_PATH,
    )
    const idle = mediaHubView(
      store,
      mediaContext("u-media", { ports: { officersIn: () => ["u-media", "u-media-men"] } }),
      KHALID_PATH,
    )

    expect(vacant.items).toEqual(idle.items)
    expect(vacant.emptiness).not.toBe(idle.emptiness)
    expect(idle.officerCount).toBe(2)
  })

  it("وحين يوجد محتوىً فلا فراغَ يُشخَّص أصلاً (`none`)", () => {
    const store = seedMediaStore()
    const made = createCoverage(store, mediaContext("u-media"), coverageInput())
    if (!made.ok) throw new Error(made.error.code)
    const photo = addPhoto(store, mediaContext("u-media"), {
      coverageId: made.value.id,
      contentType: "image/jpeg",
      sizeBytes: 1_000,
    })
    if (!photo.ok) throw new Error(photo.error.code)

    const view = mediaHubView(store, mediaContext("u-media"), KHALID_PATH)
    expect(view.items).toHaveLength(1)
    expect(view.emptiness).toBe("none")
  })

  it("**والعدد يُسأل عن نطاق الصفحة بعينه** — لا عن الشبكة كلها (ق-١١٠)", () => {
    const store = seedMediaStore()
    const asked: string[] = []
    const view = mediaHubView(
      store,
      mediaContext("u-media", {
        ports: {
          officersIn: (unitPath) => {
            asked.push(unitPath)
            return []
          },
        },
      }),
      "/men/homs/",
    )

    expect(asked).toEqual(["/men/homs/"])
    expect(view.emptiness).toBe("vacant")
  })
})
