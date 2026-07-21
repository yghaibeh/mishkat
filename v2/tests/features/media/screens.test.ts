/**
 * إسقاطُ نماذج الصفحة إلى لقطةِ عرضٍ — عقدُ الوحدة §٩ (ق-١١١: حقيقةٌ واحدةٌ في الصفحة).
 *
 * **الشاشةُ لا تحسب**: كلُّ قيمةٍ فيها مُسقَطةٌ من نموذج الخدمة، والإسقاطُ **تنسيقٌ لا حكم**
 * — فالنسبةُ التي قرّرها `gallery.ts` تصل كما هي، و«غير منسوبة» **تُكتب نصاً** ولا تُترك
 * فراغاً صامتاً (ق-١٠٤). وحدودُ الرفع المعروضةُ هي **حدودُ الخادم نفسِها** لا نسخةٌ ثانية.
 */
import { describe, it, expect } from "vitest"
import { mediaHubView } from "../../../src/features/media/services/gallery.js"
import { uploadLimits } from "../../../src/features/media/services/uploads.js"
import {
  addPhoto,
  createCoverage,
  myCoverages,
} from "../../../src/features/media/services/coverages.js"
import {
  projectCoveragesSnapshot,
  projectHubSnapshot,
  mediaHubScreenNodes,
  mediaCoveragesScreenNodes,
  EMPTY_MEDIA_SNAPSHOT,
} from "../../../src/features/media/screens/screens.js"
import { walkNodes, type UiNode } from "../../../src/ui/components/kernel.js"
import type { CapId } from "../../../src/authorization/generated/capabilities.generated.js"
import {
  coverageInput,
  feedPhoto,
  mediaContext,
  seedMediaStore,
  KHALID_PATH,
  MAX_BYTES,
} from "./_seed.js"
import type { MediaStore } from "../../../src/features/media/data/store.js"

const NAMES = {
  nameOf: (personId: string) => `فلانٌ ${personId}`,
  unattributedAr: "غيرُ منسوبة",
}

function publish(store: MediaStore, over: Record<string, unknown> = {}): string {
  const made = createCoverage(store, mediaContext("u-media"), coverageInput(over))
  if (!made.ok) throw new Error(made.error.code)
  const photo = addPhoto(store, mediaContext("u-media"), {
    coverageId: made.value.id,
    contentType: "image/jpeg",
    sizeBytes: 1_000,
  })
  if (!photo.ok) throw new Error(photo.error.code)
  return made.value.id
}

describe("إسقاطُ المعرض — الرافدُ والنسبةُ يصلان الشاشةَ قيمتين", () => {
  it("كلُّ صفٍّ يحمل رافدَه ونسبتَه وتاريخَ وقوعه — ثلاثةُ أعمدةٍ لا تُشتقّ في الشاشة", () => {
    const store = seedMediaStore()
    publish(store)
    const view = mediaHubView(store, mediaContext("u-media"), KHALID_PATH)

    const snapshot = projectHubSnapshot(view, { unitLabelAr: "مسجد خالد", names: NAMES })

    expect(snapshot.galleryRows).toHaveLength(1)
    expect(snapshot.galleryRows[0]?.stream).toBe("coverage")
    expect(snapshot.galleryRows[0]?.attribution).toBe("فلانٌ u-media")
    expect(snapshot.galleryRows[0]?.occurredOn).toMatch(/هـ/)
  })

  it("**و«غير منسوبة» تُكتب نصاً** — لا خانةٌ فارغةٌ يظنّها القارئ عطلاً (ق-١٠٤)", () => {
    const store = seedMediaStore()
    const view = mediaHubView(
      store,
      mediaContext("u-media", {
        ports: {
          responsibleFor: () => null,
          dailyLogPhotos: () => [feedPhoto({ id: "dl-1", unitPath: KHALID_PATH })],
        },
      }),
      KHALID_PATH,
    )

    const snapshot = projectHubSnapshot(view, { unitLabelAr: "مسجد خالد", names: NAMES })
    expect(snapshot.galleryRows[0]?.attribution).toBe("غيرُ منسوبة")
  })

  it("وسببُ الفراغ والعدّاداتُ تصل الشاشةَ بأرقامٍ عربية-هندية (قب-٢٠)", () => {
    const store = seedMediaStore()
    const view = mediaHubView(
      store,
      mediaContext("u-media", { ports: { officersIn: () => [] } }),
      KHALID_PATH,
    )

    const snapshot = projectHubSnapshot(view, { unitLabelAr: "مسجد خالد", names: NAMES })
    expect(snapshot.emptiness).toBe("vacant")
    expect(snapshot.officerCountAr).toBe("٠")
    expect(snapshot.galleryCountAr).toBe("٠")
    expect(snapshot.scopePath).toBe(KHALID_PATH)
  })
})

describe("إسقاطُ «تغطياتي» — حدودُ الرفع المعروضةُ هي حدودُ الخادم", () => {
  it("الصفوفُ تحمل العنوانَ وعددَ الصور وتاريخَ الوقوع", () => {
    const store = seedMediaStore()
    publish(store)
    const ctx = mediaContext("u-media")

    const snapshot = projectCoveragesSnapshot(myCoverages(store, ctx), {
      unitLabelAr: "مسجد خالد",
      scopePath: KHALID_PATH,
      limits: uploadLimits(store, ctx, KHALID_PATH),
    })

    expect(snapshot.coverageRows).toHaveLength(1)
    expect(snapshot.coverageRows[0]?.photoCount).toBe("١")
    expect(snapshot.coverageRows[0]?.title).toBe("افتتاحُ دورةِ الحفظ")
  })

  it("**والصيغُ المعروضةُ هي المُفعَّلةُ في القاموس وحدها** — والمعطَّلةُ لا تُعرض", () => {
    const store = seedMediaStore()
    const limits = uploadLimits(store, mediaContext("u-media"), KHALID_PATH)

    expect([...limits.acceptedTypes].sort()).toEqual(["image/jpeg", "image/png"])
    expect(limits.maxBytes).toBe(MAX_BYTES)
  })

  it("**ولا تُعرض صيغةٌ قابلةٌ للتنفيذ ولو أُدخلت القاموسَ مُفعَّلة** (ت-٥)", () => {
    const store = seedMediaStore()
    store.saveFormat({ tenantId: "t-main", id: "svg", contentType: "image/svg+xml", active: true })

    const limits = uploadLimits(store, mediaContext("u-media"), KHALID_PATH)
    expect(limits.acceptedTypes).not.toContain("image/svg+xml")
  })

  it("**والحدُّ غيرُ المضبوط يصل الشاشةَ صفراً** — فلا تدعو لوحةُ الرفع إلى ما يرفضه الخادم", () => {
    const store = seedMediaStore()
    const limits = uploadLimits(store, mediaContext("u-media", { settings: [] }), KHALID_PATH)
    expect(limits.maxBytes).toBe(0)
  })
})

describe("الحالةُ الفارغةُ لا تُعلَن إلا على فراغٍ حقيقيّ (§٣-١)", () => {
  const CAPS = new Set<CapId>(["media.hub", "media.post"])
  const tableStatesOf = (root: UiNode) =>
    walkNodes(root)
      .filter((n) => n.component === "DataTable")
      .map((n) => n.meta.state)

  it("جدولا الشاشتين يصيران «بيانات» حين تصل الصفوف، و«فارغ» حين لا تصل", () => {
    const store = seedMediaStore()
    publish(store)
    const ctx = mediaContext("u-media")
    const hub = projectHubSnapshot(mediaHubView(store, ctx, KHALID_PATH), {
      unitLabelAr: "مسجد خالد",
      names: NAMES,
    })
    const mine = projectCoveragesSnapshot(myCoverages(store, ctx), {
      unitLabelAr: "مسجد خالد",
      scopePath: KHALID_PATH,
      limits: uploadLimits(store, ctx, KHALID_PATH),
    })

    expect(tableStatesOf(mediaHubScreenNodes(CAPS, hub))).toEqual(["data"])
    expect(tableStatesOf(mediaCoveragesScreenNodes(CAPS, mine))).toEqual(["data"])
    expect(tableStatesOf(mediaHubScreenNodes(CAPS, EMPTY_MEDIA_SNAPSHOT))).toEqual(["empty"])
    expect(tableStatesOf(mediaCoveragesScreenNodes(CAPS, EMPTY_MEDIA_SNAPSHOT))).toEqual(["empty"])
  })
})
