/**
 * ق-١٠٣ — «لا محتوى بلا سياق»: التغطيةُ **كيانُ حدث** لا صورةٌ عائمة (عقدُ الوحدة §١).
 *
 * الاختبارُ الإلزاميُّ الثالث في T13: **تغطيةٌ بلا سياقٍ كامل ⇒ مرفوضة**. وكلُّ جوابٍ من
 * الأربعة (ماذا/أين/متى/مَن) يُكسَر وحده فيُظهر حارسَه بسببه المصنَّف — لا رفضاً مبهماً.
 */
import { describe, it, expect } from "vitest"
import {
  addPhoto,
  createCoverage,
  albumOf,
} from "../../../src/features/media/services/coverages.js"
import {
  coverageInput,
  mediaContext,
  seedMediaStore,
  NOW,
  KHALID_PATH,
} from "./_seed.js"

describe("ق-١٠٣ — التغطيةُ تُنشأ بأجوبتها الأربعة أو لا تُنشأ", () => {
  it("التغطيةُ الكاملةُ السياق تُنشأ بعنوانها ونوعها ووحدتها وتاريخِ وقوعها وناشرِها", () => {
    const store = seedMediaStore()
    const r = createCoverage(store, mediaContext("u-media"), coverageInput())

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.titleAr).toBe("افتتاحُ دورةِ الحفظ")
    expect(r.value.kindId).toBe("event")
    expect(r.value.unitPath).toBe(KHALID_PATH)
    expect(r.value.occurredOn.toISOString()).toBe("2026-07-18T00:00:00.000Z")
    expect(r.value.publisherPersonId).toBe("u-media")
  })

  it("**تاريخُ الوقوع ليس تاريخَ الرفع** — الكيانُ يحمل الاثنين منفصلَين (ق-١٠٣ «متى»)", () => {
    const store = seedMediaStore()
    const r = createCoverage(store, mediaContext("u-media"), coverageInput())
    if (!r.ok) throw new Error(r.error.code)

    expect(r.value.createdAt.toISOString()).toBe(NOW.toISOString())
    expect(r.value.occurredOn.getTime()).toBeLessThan(r.value.createdAt.getTime())
  })

  it("«ماذا»: عنوانٌ فارغٌ (أو فراغاتٌ) ⇒ مرفوضة بـ`EMPTY_TITLE`", () => {
    const store = seedMediaStore()
    for (const titleAr of ["", "   "]) {
      const r = createCoverage(store, mediaContext("u-media"), coverageInput({ titleAr }))
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.error.code).toBe("EMPTY_TITLE")
    }
  })

  it("«أين»: وحدةٌ مجهولةٌ في مستودع الشبكة ⇒ `UNKNOWN_MEDIA_UNIT`", () => {
    const store = seedMediaStore()
    const r = createCoverage(store, mediaContext("u-media"), coverageInput({ unitId: "ghost" }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("UNKNOWN_MEDIA_UNIT")
  })

  it("النوعُ من **معجمٍ مغلق**: المجهولُ يُرفض، والمُعطَّلُ يُرفض بسببٍ مختلف", () => {
    const store = seedMediaStore()
    const unknown = createCoverage(store, mediaContext("u-media"), coverageInput({ kindId: "zzz" }))
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.error.code).toBe("UNKNOWN_COVERAGE_KIND")

    const retired = createCoverage(
      store,
      mediaContext("u-media"),
      coverageInput({ kindId: "retired" }),
    )
    expect(retired.ok).toBe(false)
    if (!retired.ok) expect(retired.error.code).toBe("KIND_INACTIVE")
  })

  it("**والمعجمُ بياناتٌ**: نوعٌ جديدٌ يُضاف للمرجع فيُقبل — بلا تغيير سطرِ كود (قب-٦/G14)", () => {
    const store = seedMediaStore()
    store.saveKind({ tenantId: "t-main", id: "iftar", ar: "تغطيةُ إفطار", active: true })

    const r = createCoverage(store, mediaContext("u-media"), coverageInput({ kindId: "iftar" }))
    expect(r.ok).toBe(true)
  })

  it("«متى»: تاريخُ وقوعٍ في المستقبل ⇒ `FUTURE_OCCURRENCE_DATE` (ق-٤٥ بإعدادٍ حيّ)", () => {
    const store = seedMediaStore()
    const later = new Date(NOW.getTime() + 86_400_000)
    const r = createCoverage(store, mediaContext("u-media"), coverageInput({ occurredOn: later }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("FUTURE_OCCURRENCE_DATE")
  })

  it("**ويُقبل إن فُتح الإعدادُ الحيّ** `records.allow_future_dating` — قاعدةٌ تُضبط لا تُصلَّب", () => {
    const store = seedMediaStore()
    const later = new Date(NOW.getTime() + 86_400_000)
    const ctx = mediaContext("u-media", {
      settings: [
        {
          settingId: "records.allow_future_dating",
          scopePath: "/",
          value: true,
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          settingId: "platform.upload.max_bytes",
          scopePath: "/",
          value: 5_000_000,
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    })
    const r = createCoverage(store, ctx, coverageInput({ occurredOn: later }))
    expect(r.ok).toBe(true)
  })
})

describe("ق-١٠٣ — لا صورةَ بلا تغطيةٍ قائمةٍ لناشرها", () => {
  it("صورةٌ إلى تغطيةٍ لا وجودَ لها ⇒ `COVERAGE_NOT_FOUND` (لا صورةَ عائمة — ز-٥)", () => {
    const store = seedMediaStore()
    const r = addPhoto(store, mediaContext("u-media"), {
      coverageId: "mc-404",
      contentType: "image/jpeg",
      sizeBytes: 1_000,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("COVERAGE_NOT_FOUND")
  })

  it("صورةٌ إلى تغطيةِ **غيرِه** ⇒ `NOT_COVERAGE_PUBLISHER` — دفاعٌ في العمق خلف نطاق الخادم", () => {
    const store = seedMediaStore()
    const made = createCoverage(store, mediaContext("u-media"), coverageInput())
    if (!made.ok) throw new Error(made.error.code)

    const r = addPhoto(store, mediaContext("u-admin"), {
      coverageId: made.value.id,
      contentType: "image/jpeg",
      sizeBytes: 1_000,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("NOT_COVERAGE_PUBLISHER")
  })

  it("والصورةُ المقبولةُ تدخل ألبومَ تغطيتها بمفتاحِ تخزينٍ **من المستودع لا من المدخل**", () => {
    const store = seedMediaStore()
    const made = createCoverage(store, mediaContext("u-media"), coverageInput())
    if (!made.ok) throw new Error(made.error.code)

    const r = addPhoto(store, mediaContext("u-media"), {
      coverageId: made.value.id,
      contentType: "image/jpeg",
      sizeBytes: 1_000,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.coverageId).toBe(made.value.id)
    expect(r.value.uploadedBy).toBe("u-media")
    expect(r.value.storageKey.length).toBeGreaterThan(0)
    expect(albumOf(store, made.value.id)).toHaveLength(1)
  })
})
