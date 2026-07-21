/**
 * ق-١٠٤ — **ثلاثةُ روافدَ ونسبةٌ ظاهرة**، و«غير منسوبة» آخرُ الحلول لا أوّلها
 * (عقدُ الوحدة §٣).
 *
 * السُّلَّمُ ملزمُ الترتيب: ناشرٌ ← رافعٌ له حساب ← مسؤولُ الوحدة ← «غير منسوبة».
 * وبلوغُ الرابعة يعني أن الرافعَ بلا حسابٍ **وأن الوحدةَ بلا مسؤول** معاً — فهي حالةٌ
 * تُقاس لا افتراضٌ سهل.
 */
import { describe, it, expect } from "vitest"
import { mediaHubView } from "../../../src/features/media/services/gallery.js"
import { addPhoto, createCoverage } from "../../../src/features/media/services/coverages.js"
import {
  coverageInput,
  feedPhoto,
  mediaContext,
  seedMediaStore,
  KHALID_PATH,
  NOW,
} from "./_seed.js"
import type { MediaStore } from "../../../src/features/media/data/store.js"

function publishAt(store: MediaStore, over: Record<string, unknown> = {}): string {
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

describe("ق-١٠٤ — المعرضُ ثلاثةُ روافدَ ورافدُ كلِّ صورةٍ ظاهر", () => {
  it("الروافدُ الثلاثةُ تجتمع في معرضٍ واحد، وكلُّ عنصرٍ يعلن رافدَه", () => {
    const store = seedMediaStore()
    publishAt(store)
    const ctx = mediaContext("u-media", {
      ports: {
        dailyLogPhotos: () => [feedPhoto({ id: "dl-1", unitPath: KHALID_PATH, uploaderPersonId: "u-amir" })],
        lessonPhotos: () => [feedPhoto({ id: "ls-1", unitPath: KHALID_PATH, uploaderPersonId: "u-teacher" })],
      },
    })

    const view = mediaHubView(store, ctx, KHALID_PATH)

    expect(view.items).toHaveLength(3)
    expect(view.streamCounts).toEqual({ coverage: 1, dailyLog: 1, lesson: 1 })
    expect(new Set(view.items.map((i) => i.stream))).toEqual(
      new Set(["coverage", "dailyLog", "lesson"]),
    )
  })

  it("**صورةُ التغطية منسوبةٌ لناشرها** دائماً (موجودٌ بحكم ق-١٠٣)", () => {
    const store = seedMediaStore()
    publishAt(store)
    const view = mediaHubView(store, mediaContext("u-media"), KHALID_PATH)

    const item = view.items.find((i) => i.stream === "coverage")
    expect(item?.attributedTo).toBe("u-media")
    expect(item?.attributedVia).toBe("publisher")
  })

  it("**وصورةُ الدرس لمعلّمه** وصورةُ سجل اليوم لرافعها — إن كان له حساب", () => {
    const store = seedMediaStore()
    const ctx = mediaContext("u-media", {
      ports: {
        dailyLogPhotos: () => [feedPhoto({ id: "dl-1", unitPath: KHALID_PATH, uploaderPersonId: "u-amir" })],
        lessonPhotos: () => [feedPhoto({ id: "ls-1", unitPath: KHALID_PATH, uploaderPersonId: "u-teacher" })],
      },
    })

    const view = mediaHubView(store, ctx, KHALID_PATH)
    const daily = view.items.find((i) => i.stream === "dailyLog")
    const lesson = view.items.find((i) => i.stream === "lesson")

    expect(daily?.attributedTo).toBe("u-amir")
    expect(daily?.attributedVia).toBe("uploader")
    expect(lesson?.attributedTo).toBe("u-teacher")
    expect(lesson?.attributedVia).toBe("uploader")
  })

  it("**وإن لم يكن للرافع حسابٌ فتُنسب لمسؤول وحدتها** — لا «غير منسوبة» عند أول عثرة", () => {
    const store = seedMediaStore()
    const ctx = mediaContext("u-media", {
      ports: {
        responsibleFor: () => "u-amir",
        dailyLogPhotos: () => [
          feedPhoto({ id: "dl-1", unitPath: KHALID_PATH, uploaderPersonId: "u-ghost" }),
        ],
      },
    })

    const view = mediaHubView(store, ctx, KHALID_PATH)
    const daily = view.items.find((i) => i.stream === "dailyLog")
    expect(daily?.attributedTo).toBe("u-amir")
    expect(daily?.attributedVia).toBe("unitResponsible")
  })

  it("ورافعٌ بلا معرّفٍ أصلاً يهبط الدرجةَ نفسَها — لا يقفز إلى «غير منسوبة»", () => {
    const store = seedMediaStore()
    const ctx = mediaContext("u-media", {
      ports: {
        responsibleFor: () => "u-amir",
        lessonPhotos: () => [feedPhoto({ id: "ls-1", unitPath: KHALID_PATH })],
      },
    })

    const view = mediaHubView(store, ctx, KHALID_PATH)
    expect(view.items[0]?.attributedVia).toBe("unitResponsible")
  })

  it("**«غير منسوبة» آخرُ الحلول**: رافعٌ بلا حساب **ووحدةٌ بلا مسؤول** معاً", () => {
    const store = seedMediaStore()
    const ctx = mediaContext("u-media", {
      ports: {
        responsibleFor: () => null,
        dailyLogPhotos: () => [
          feedPhoto({ id: "dl-1", unitPath: KHALID_PATH, uploaderPersonId: "u-ghost" }),
        ],
      },
    })

    const view = mediaHubView(store, ctx, KHALID_PATH)
    expect(view.items[0]?.attributedTo).toBeNull()
    expect(view.items[0]?.attributedVia).toBe("unattributed")
  })
})

describe("ق-١٠٣/ق-١٠٤ — ما لا يُعرض في المعرض", () => {
  it("**تغطيةٌ بلا صورةٍ لا تُعرض** — سجلُّ الحدث مسوّدةُ صاحبها حتى يصلَه ألبومُه", () => {
    const store = seedMediaStore()
    const made = createCoverage(store, mediaContext("u-media"), coverageInput())
    if (!made.ok) throw new Error(made.error.code)

    const view = mediaHubView(store, mediaContext("u-media"), KHALID_PATH)
    expect(view.items).toHaveLength(0)
    expect(view.streamCounts.coverage).toBe(0)
  })

  it("والتغطيةُ المحذوفةُ تخرج من المعرض بصورها", () => {
    const store = seedMediaStore()
    const id = publishAt(store)
    expect(mediaHubView(store, mediaContext("u-media"), KHALID_PATH).items).toHaveLength(1)

    store.saveCoverage({ ...store.getCoverage(id)!, deletedAt: NOW, deletedBy: "u-media" })
    expect(mediaHubView(store, mediaContext("u-media"), KHALID_PATH).items).toHaveLength(0)
  })

  it("والترتيبُ بتاريخ الوقوع نزولاً بفاصلٍ حتميٍّ بالمعرّف — لا عشوائيةَ عرض", () => {
    const store = seedMediaStore()
    publishAt(store, { occurredOn: new Date("2026-07-10T00:00:00.000Z") })
    publishAt(store, { occurredOn: new Date("2026-07-19T00:00:00.000Z") })
    const ctx = mediaContext("u-media", {
      ports: {
        dailyLogPhotos: () => [
          feedPhoto({ id: "dl-b", unitPath: KHALID_PATH, occurredOn: new Date("2026-07-15T00:00:00.000Z") }),
          feedPhoto({ id: "dl-a", unitPath: KHALID_PATH, occurredOn: new Date("2026-07-15T00:00:00.000Z") }),
        ],
      },
    })

    const dates = mediaHubView(store, ctx, KHALID_PATH).items.map((i) => i.occurredOn.getTime())
    expect(dates).toEqual([...dates].sort((a, b) => b - a))
    const tie = mediaHubView(store, ctx, KHALID_PATH)
      .items.filter((i) => i.stream === "dailyLog")
      .map((i) => i.id)
    expect(tie).toEqual(["dl-a", "dl-b"])
  })

  it("**وحجمُ الصفحة إعدادٌ حيّ** (`platform.page_size.media`) لا رقمٌ صلب (قب-٦)", () => {
    const store = seedMediaStore()
    for (const day of ["01", "02", "03"]) {
      publishAt(store, { occurredOn: new Date(`2026-07-${day}T00:00:00.000Z`) })
    }
    const ctx = mediaContext("u-media", {
      settings: [
        {
          settingId: "platform.page_size.media",
          scopePath: "/",
          value: 2,
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    })

    expect(mediaHubView(store, ctx, KHALID_PATH).items).toHaveLength(2)
  })
})
