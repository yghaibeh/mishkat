/**
 * ق-١٧/ق-١٠٥ — **الاطّلاعُ هابطٌ بالنطاق لا بالدور** (عقدُ الوحدة §٣).
 *
 * الاختبارُ الإلزاميُّ الرابع في T13: الطبقةُ الأعلى ترى تغطياتِ ما تحتها، **ولا ترى
 * الجانبية**. والطبقتان معاً: ترشيحُ الخدمة **و**رفضُ الخادم للاستدعاء المباشر.
 */
import { describe, it, expect } from "vitest"
import { mediaHubView } from "../../../src/features/media/services/gallery.js"
import { addPhoto, createCoverage } from "../../../src/features/media/services/coverages.js"
import { makeMediaEndpoints } from "../../../src/features/media/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import {
  canonicalActor,
  coverageInput,
  mediaContext,
  mediaDirectory,
  mediaPorts,
  seedMediaStore,
  DECISION,
  UPLOAD_LIMIT,
  KHALID_PATH,
  OMAR_PATH,
} from "./_seed.js"
import type { MediaStore } from "../../../src/features/media/data/store.js"

function publishInto(store: MediaStore, unitId: string): void {
  const made = createCoverage(store, mediaContext("u-media"), coverageInput({ unitId }))
  if (!made.ok) throw new Error(made.error.code)
  const photo = addPhoto(store, mediaContext("u-media"), {
    coverageId: made.value.id,
    contentType: "image/jpeg",
    sizeBytes: 1_000,
  })
  if (!photo.ok) throw new Error(photo.error.code)
}

/** عالمٌ فيه تغطيتان: واحدةٌ تحت المربع الثاني، وأخرى تحت المربع السابع (الجانبيّ عنه). */
function twoBranches(): MediaStore {
  const store = seedMediaStore()
  publishInto(store, "khalid")
  publishInto(store, "omar")
  return store
}

describe("ق-١٧ — الاطّلاعُ هابطٌ: الأعلى يرى ما تحته", () => {
  it("مسارُ المنطقة يجمع تغطياتِ مربعيها معاً (تجميعٌ هابط)", () => {
    const view = mediaHubView(twoBranches(), mediaContext("u-media"), "/men/homs/")
    expect(view.items).toHaveLength(2)
  })

  it("ومسارُ المسجد يرى تغطيتَه وحدها — لا ما فوقه ولا ما بجانبه", () => {
    const view = mediaHubView(twoBranches(), mediaContext("u-media"), KHALID_PATH)
    expect(view.items).toHaveLength(1)
    expect(view.items[0]?.unitPath).toBe(KHALID_PATH)
  })

  it("**ولا يرى الجانبية**: نطاقُ المربع الثاني لا يبلغ تغطيةَ المربع السابع", () => {
    const view = mediaHubView(twoBranches(), mediaContext("u-media"), "/men/homs/sq2/")
    expect(view.items.map((i) => i.unitPath)).toEqual([KHALID_PATH])
    expect(view.items.some((i) => i.unitPath === OMAR_PATH)).toBe(false)
  })

  it("والرافدان الآخران يُرشَّحان بالنطاق نفسِه — لا رافدَ يفلت من العزل", () => {
    const store = seedMediaStore()
    const ctx = mediaContext("u-media", {
      ports: {
        dailyLogPhotos: () => [
          { id: "dl-in", unitPath: KHALID_PATH, titleAr: "داخل", occurredOn: DECISION.now, uploaderPersonId: null },
          { id: "dl-out", unitPath: OMAR_PATH, titleAr: "خارج", occurredOn: DECISION.now, uploaderPersonId: null },
        ],
      },
    })

    const view = mediaHubView(store, ctx, "/men/homs/sq2/")
    expect(view.items.map((i) => i.id)).toEqual(["dl-in"])
  })
})

describe("ق-١٧ — والغيابُ مقرونٌ برفضِ الخادم لا بإخفاءِ الواجهة", () => {
  it("مسؤولُ المربع الثاني يفتح معرضَ مسجده، **ويُرفض** على مسجد المربع السابع", async () => {
    const store = twoBranches()
    clearRegistryForTests()
    const ep = makeMediaEndpoints(
      store,
      createSettingsResolver([UPLOAD_LIMIT]),
      mediaDirectory,
      mediaPorts(),
    )

    const inside = await ep.hubView.invoke({ unitId: "khalid" }, canonicalActor("u-square"), DECISION)
    expect(inside.ok).toBe(true)

    const lateral = await ep.hubView.invoke({ unitId: "omar" }, canonicalActor("u-square"), DECISION)
    expect(lateral.ok).toBe(false)
    if (!lateral.ok) expect(lateral.decision.reason).toMatch(/^DENIED_/)
  })

  it("**والطالبُ لا يبلغ المعرضَ أصلاً** — `media.hub` ليست له (جدولُ الغياب §٣)", async () => {
    const store = twoBranches()
    clearRegistryForTests()
    const ep = makeMediaEndpoints(
      store,
      createSettingsResolver([UPLOAD_LIMIT]),
      mediaDirectory,
      mediaPorts(),
    )

    const r = await ep.hubView.invoke({ unitId: "khalid" }, canonicalActor("u-student"), DECISION)
    expect(r.ok).toBe(false)
  })

  it("ووحدةٌ مجهولةٌ ⇒ لا نطاق ⇒ **رفضٌ يُقفل ولا يُفتح** (§٥.٢ ثابت ٣)", async () => {
    const store = twoBranches()
    clearRegistryForTests()
    const ep = makeMediaEndpoints(
      store,
      createSettingsResolver([UPLOAD_LIMIT]),
      mediaDirectory,
      mediaPorts(),
    )

    const r = await ep.hubView.invoke({ unitId: "ghost" }, canonicalActor("u-admin"), DECISION)
    expect(r.ok).toBe(false)
  })
})
