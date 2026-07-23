/**
 * **استمرارُ الإعلام على D1** — T26-ب-٢ (الموجةُ الأولى · وحدة `media` · الهجرة `0006`).
 *
 * ثوابتُ الوحدة تُقاس هنا **على المستودع الحقيقيّ** لا على الذاكرة:
 *  · **ق-١٠٣** — التغطيةُ سجلُّ حدثٍ بأجوبته الأربعة، ولا صورةَ بلا تغطيتها القائمة.
 *  · **ق-١٠٥** — النشرُ والحذفُ لناشرها، و«سحبُ المنشور» **حالةٌ لا محو** (تحديثٌ على الصفّ).
 *  · **ق-١٠٤/ق-١٧** — العرضُ مرشَّحٌ هبوطاً وبألبومٍ وغيرَ محذوف.
 *  · **قب-١٨** — عزلُ الشبكة والنطاق، والشبكتان بنفس المسارات النسبيّة عمداً.
 *
 * **ولا تدقيقَ في هذه الوحدة**: طبقةُ بياناتها لا تكتب قيدَ تدقيقٍ (لا `AuditJournal`) —
 * فلا اختبارَ «نطاقُ التدقيق» هنا (بند من التسعة سقط بانتفاء موضوعه، لا بإغفال).
 */

import { describe, expect, it } from "vitest"
import { persistentMedia } from "../../src/db/repositories/mediaRepository.js"
import { UnitOfWork } from "../../src/db/unitOfWork.js"
import { MediaStore } from "../../src/features/media/data/store.js"
import {
  addPhoto,
  albumOf,
  createCoverage,
  deleteCoverage,
  displayableCoveragesIn,
  myCoverages,
} from "../../src/features/media/services/coverages.js"
import type { SqlStatement } from "../../src/db/sql/driver.js"
import {
  KHALID_PATH,
  MAIN,
  MEDIA_OF_MEN,
  NOW,
  OMAR_PATH,
  OTHER,
  coverageInput,
  freshDb,
  freshMediaStore,
  mediaContext,
  mediaSession,
  rowsOf,
  seedMediaData,
  seedMediaSession,
} from "./_media.js"

// ── سكرتاريا: أفعالُ الوحدة عبر خدماتها المعلنة، لا بحقنٍ في المستودع ────────────
function createCov(
  store: MediaStore,
  over: Record<string, unknown> = {},
  actor = "u-media",
): string {
  const done = createCoverage(store, mediaContext(actor), coverageInput(over))
  if (!done.ok) throw new Error(`تعذّر الإنشاء: ${done.error.code}`)
  return done.value.id
}

function addPic(store: MediaStore, coverageId: string, actor = "u-media", sizeBytes = 1_000): string {
  const done = addPhoto(store, mediaContext(actor), { coverageId, contentType: "image/jpeg", sizeBytes })
  if (!done.ok) throw new Error(`تعذّر الرفع: ${done.error.code}`)
  return done.value.id
}

function remove(store: MediaStore, coverageId: string, actor = "u-media"): void {
  const done = deleteCoverage(store, mediaContext(actor), { coverageId })
  if (!done.ok) throw new Error(`تعذّر الحذف: ${done.error.code}`)
}

/** عباراتُ الإعلام مقابل أساسه — بها يُقاس **ما يُكتب** لا ما يُقرأ. */
async function statementsAfter(
  driver: Awaited<ReturnType<typeof freshDb>>,
  tenantId: string,
  fn: (store: MediaStore) => void,
): Promise<readonly SqlStatement[]> {
  const store = freshMediaStore(tenantId)
  const source = persistentMedia(store)
  const uow = new UnitOfWork(driver, { tenantId, scopePath: "/" })
  uow.enlist(source)
  await uow.hydrate()
  fn(store)
  return uow.statementsFor(source.name, source.project())
}

// ═══ الإلزاميّ ١ — ق-١٠٣: التغطيةُ سجلُّ حدثٍ، والصورةُ لا تُقبل بلا سياقها ══════

describe("ق-١٠٣ — أربعةُ أجوبةٍ شرطُ الوجود، ولا صورةَ بلا تغطيتها **بعد عبور القاعدة**", () => {
  it("التغطيةُ تعبر القاعدةَ بأجوبتها الأربعة، و**تاريخُ الوقوع غيرُ تاريخِ الرفع**", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    await mediaSession(driver, MAIN, (store) => createCov(store))

    const rows = (await rowsOf(driver, "media_coverages")) as readonly Record<string, unknown>[]
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(String(row["title_ar"])).toBe("افتتاحُ دورةِ الحفظ")
    expect(String(row["kind_id"])).toBe("event")
    expect(String(row["unit_id"])).toBe("khalid")
    expect(String(row["unit_path"])).toBe(KHALID_PATH)
    expect(String(row["publisher_person_id"])).toBe("u-media")
    // الوقوعُ ١٨ تموز، والرفعُ (لحظةُ العالم) ٢٠ تموز — عمودان منفصلان لا يلتبسان.
    expect(Number(row["occurred_on"])).toBe(new Date("2026-07-18T00:00:00.000Z").getTime())
    expect(Number(row["created_at"])).toBe(NOW.getTime())
    expect(row["deleted_at"]).toBeNull()
    expect(row["deleted_by"]).toBeNull()
    driver.close()
  })

  it("الصورةُ لا تُقبل إلا إلى تغطيةٍ قائمةٍ — والمحذوفةُ ترفض بعد التحميل (`COVERAGE_DELETED`)", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    const coverageId = await mediaSession(driver, MAIN, (store) => createCov(store))
    // صورةٌ إلى تغطيةٍ محمَّلةٍ من القاعدة تنجح — الحالةُ المحمَّلة تُقبل كالمكتوبة.
    await mediaSession(driver, MAIN, (store) => {
      expect(addPic(store, coverageId)).toBe("mp-2")
    })
    // تُحذف ثم تُحمَّل محذوفةً — فترفض الصورةَ من الحالة لا من زوال الصفّ.
    await mediaSession(driver, MAIN, (store) => remove(store, coverageId))
    await mediaSession(driver, MAIN, (store) => {
      const denied = addPhoto(store, mediaContext("u-media"), {
        coverageId,
        contentType: "image/jpeg",
        sizeBytes: 1_000,
      })
      if (denied.ok) throw new Error("قُبلت صورةٌ لمحذوفة")
      expect(denied.error.code).toBe("COVERAGE_DELETED")
    })
    driver.close()
  })

  it("و«تغطيةٌ خارج نطاق النشر» ترفض قبل أن تكتب صفّاً — دفاعٌ في العمق لا في الشاشة", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    await mediaSession(driver, MAIN, (store) => {
      const denied = createCoverage(store, mediaContext(MEDIA_OF_MEN), {
        ...coverageInput({ publisherPersonId: MEDIA_OF_MEN }),
        unitId: "women",
      })
      if (denied.ok) throw new Error("غُطّيت وحدةٌ خارج النطاق")
      expect(denied.error.code).toBe("OUT_OF_PUBLISHING_SCOPE")
    })
    expect(await rowsOf(driver, "media_coverages")).toHaveLength(0)
    driver.close()
  })
})

// ═══ الإلزاميّ ٢ — لا محو (ق-١٠٥/المادة ٧/٤): وجهان ═══════════════════════════

describe("ق-١٠٥ — «سحبُ المنشور» حالةٌ لا محو: الاختفاءُ يُرمى، والحالةُ **تحديثٌ**", () => {
  it("محوُ تغطيةٍ من الإسقاط **يُرمى**، ولا `DELETE` يُولَّد (ملحقٌ فقط)", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    await mediaSession(driver, MAIN, (store) => createCov(store))

    const store = freshMediaStore(MAIN)
    const source = persistentMedia(store)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(source)
    await uow.hydrate()

    const forged = new Map(source.project())
    forged.set("media_coverages", new Map())
    expect(() => uow.statementsFor(source.name, forged)).toThrow(/media_coverages/)
    driver.close()
  })

  it("ومحوُ **صورةٍ** كذلك يُرمى — الألبومُ لا يُمحى، يُخفى بالحالة", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    await mediaSession(driver, MAIN, (store) => addPic(store, createCov(store)))

    const store = freshMediaStore(MAIN)
    const source = persistentMedia(store)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(source)
    await uow.hydrate()

    const forged = new Map(source.project())
    forged.set("media_photos", new Map())
    expect(() => uow.statementsFor(source.name, forged)).toThrow(/media_photos/)
    driver.close()
  })

  it("انتقالُ الحالة **تحديثٌ**: الحذفُ يُبقي الصفَّ نفسَه، عبارةٌ واحدةٌ `DO UPDATE` لا حذفٌ وإدراج", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    const coverageId = await mediaSession(driver, MAIN, (store) => {
      const id = createCov(store)
      addPic(store, id)
      return id
    })
    const before = await rowsOf(driver, "media_coverages")
    expect(before).toHaveLength(1)

    const statements = await statementsAfter(driver, MAIN, (store) => remove(store, coverageId))
    const onCoverages = statements.filter((s) => s.sql.includes("media_coverages"))
    expect(onCoverages).toHaveLength(1)
    expect(onCoverages[0]!.sql).toContain("ON CONFLICT (tenant_id, id) DO UPDATE")
    expect(statements.filter((s) => /^DELETE/.test(s.sql))).toEqual([])

    // ثم يُطبَّق الحذفُ فعلاً (لم يُطبَّق أعلاه — `statementsFor` تقيس ولا تقذف).
    await mediaSession(driver, MAIN, (store) => remove(store, coverageId))
    const after = (await rowsOf(driver, "media_coverages")) as readonly Record<string, unknown>[]
    // **الصفُّ نفسُه بقي**: عددُه واحدٌ ومعرّفُه لم يتبدّل — والحالةُ تحرّكت بختمٍ لا بصفٍّ جديد.
    expect(after).toHaveLength(1)
    expect(String(after[0]!["id"])).toBe(coverageId)
    expect(String(after[0]!["deleted_by"])).toBe("u-media")
    expect(after[0]!["deleted_at"]).not.toBeNull()
    // والألبومُ باقٍ في القاعدة (لم يُمحَ)، لكنه يُقرأ فارغاً من الحالة.
    expect(await rowsOf(driver, "media_photos")).toHaveLength(1)
    await mediaSession(driver, MAIN, (store) => {
      expect(albumOf(store, coverageId)).toEqual([])
    })
    driver.close()
  })

  it("**والحذفُ لناشرها وحده** بعد عبور القاعدة — غيرُه مرفوضٌ ولا يترك أثراً", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    const coverageId = await mediaSession(driver, MAIN, (store) => createCov(store))
    await mediaSession(driver, MAIN, (store) => {
      const denied = deleteCoverage(store, mediaContext("u-amir"), { coverageId })
      if (denied.ok) throw new Error("حذف غيرُ الناشر")
      expect(denied.error.code).toBe("NOT_COVERAGE_PUBLISHER")
    })
    const row = ((await rowsOf(driver, "media_coverages")) as readonly Record<string, unknown>[])[0]!
    expect(row["deleted_at"]).toBeNull()
    driver.close()
  })
})

// ═══ الإلزاميّ ٣ — قب-١٨/ق-١٧: عزلُ الشبكة والنطاق على المستودع الحقيقيّ ═══════

describe("عزلُ الشبكة والنطاق **على المستودع الحقيقيّ** لا على الذاكرة", () => {
  it("عزلُ الشبكة: تغطيةُ شبكةٍ **لا تُقرأ** من أخرى ولو تطابق المسارُ حرفياً", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    await seedMediaSession(driver, OTHER)
    await mediaSession(driver, OTHER, (store) => addPic(store, createCov(store, { titleAr: "تغطيةُ حلب" })))

    await mediaSession(driver, MAIN, (store) => {
      expect(store.coverages()).toEqual([])
      expect(store.photos()).toEqual([])
      expect(displayableCoveragesIn(store, KHALID_PATH)).toEqual([])
    })
    driver.close()
  })

  it("عزلُ الشبكة: كتابةُ شبكةٍ **لا تمسّ** صفَّ الأخرى ولو حمل المعرّفَ نفسَه", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    await seedMediaSession(driver, OTHER)
    await mediaSession(driver, OTHER, (store) => createCov(store, { titleAr: "تغطيةُ حلب" }))
    await mediaSession(driver, MAIN, (store) => createCov(store, { titleAr: "تغطيةُ حمص" }))

    const rows = (await rowsOf(driver, "media_coverages")) as readonly Record<string, unknown>[]
    expect(rows.map((r) => `${String(r["tenant_id"])}|${String(r["id"])}|${String(r["title_ar"])}`).sort()).toEqual([
      "t-aleppo|mc-1|تغطيةُ حلب",
      "t-main|mc-1|تغطيةُ حمص",
    ])
    driver.close()
  })

  it("عزلُ النطاق: جلسةُ مسجدٍ **لا تحمّل** تغطيةَ جاره — والمسارُ بادئةٌ بشرطةٍ ختامية", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    await mediaSession(driver, MAIN, (store) => {
      createCov(store, { titleAr: "تغطيةُ خالد", unitId: "khalid" })
      createCov(store, { titleAr: "تغطيةُ عمر", unitId: "omar" })
    })

    await mediaSession(
      driver,
      MAIN,
      (store) => {
        expect(store.coverages().map((c) => c.titleAr)).toEqual(["تغطيةُ عمر"])
      },
      OMAR_PATH,
    )
    driver.close()
  })

  it("والصورةُ ترث نطاقَ تغطيتها فتُعزل معها — لا صورةُ مسجدٍ في جلسة جاره", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    await mediaSession(driver, MAIN, (store) => {
      addPic(store, createCov(store, { titleAr: "خالد", unitId: "khalid" }))
      addPic(store, createCov(store, { titleAr: "عمر", unitId: "omar" }))
    })
    // صفوفُ الصور تحمل مسارَ تغطيتها — كلٌّ في مسجده.
    const photos = (await rowsOf(driver, "media_photos")) as readonly Record<string, unknown>[]
    expect(photos.map((p) => String(p["unit_path"])).sort()).toEqual([KHALID_PATH, OMAR_PATH])
    // وجلسةُ خالد لا ترى صورةَ عمر.
    await mediaSession(
      driver,
      MAIN,
      (store) => expect(store.photos().map((p) => p.coverageId)).toEqual(["mc-1"]),
      KHALID_PATH,
    )
    driver.close()
  })
})

// ═══ الإلزاميّ ٤ — الذرّية: لا نصفَ أثر ═══════════════════════════════════════

describe("الذرّية — فشلٌ في منتصف عمليةٍ لا يترك نصفَ أثر", () => {
  it("رميةٌ داخل المعاملة ⟵ لا تغطيةَ ولا صورةَ **في القاعدة**", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    const boom = new Error("انفجارٌ مصطنعٌ بعد كتابة التغطية والصورة وقبل تمام العملية")

    await expect(
      mediaSession(driver, MAIN, (store) => {
        store.transaction(() => {
          const coverageId = createCov(store)
          addPic(store, coverageId)
          throw boom
        })
      }),
    ).rejects.toThrow(boom)

    // **الفارقُ يُحسب لا يُلتقط**: الذاكرةُ ارتدّت ⟵ صفرُ عبارةٍ ⟵ صفرُ أثرٍ دائم.
    expect(await rowsOf(driver, "media_coverages")).toHaveLength(0)
    expect(await rowsOf(driver, "media_photos")).toHaveLength(0)
    driver.close()
  })

  it("وتغطيةٌ مرفوضةٌ دلالياً لا تحرق معرّفاً عبر القاعدة — الرفضُ قبل نبضة العدّاد", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    await mediaSession(driver, MAIN, (store) => {
      const denied = createCoverage(store, mediaContext(MEDIA_OF_MEN), {
        ...coverageInput({ publisherPersonId: MEDIA_OF_MEN }),
        unitId: "women",
      })
      expect(denied.ok).toBe(false)
    })
    // المعرّفُ التالي `mc-1` — الرفضُ لم يستهلك نبضةَ عدّاد.
    const id = await mediaSession(driver, MAIN, (store) => createCov(store))
    expect(id).toBe("mc-1")
    driver.close()
  })

  it("وحدةُ عملٍ خليطةٌ تُرمى — لا يُقذف إعلامٌ ومستودعٌ بلا مخطط", async () => {
    const driver = await freshDb()
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(persistentMedia(new MediaStore(MAIN)))
    uow.enlist({
      name: "مستودعٌ بلا مخطط",
      rowBudget: 10,
      tables: ["media_reactions"],
      project: () => new Map(),
      load: () => undefined,
    })
    await expect(uow.hydrate()).rejects.toThrow(/media_reactions/)
    driver.close()
  })
})

// ═══ الإلزاميّ ٥ — تطابقُ البديلين ════════════════════════════════════════════

/** لقطةُ ما يراه المستودعُ — البديلان يجيبان الجوابَ نفسَه أو لا. */
type Observation = {
  readonly coverages: readonly string[]
  readonly photos: readonly string[]
  readonly albums: readonly string[]
}

function observe(store: MediaStore): Observation {
  return {
    coverages: store
      .coverages()
      .map((c) => `${c.id}|${c.titleAr}|${c.unitPath}|${c.deletedAt === null ? "live" : "del"}|${c.deletedBy ?? "—"}`),
    photos: store.photos().map((p) => `${p.id}|${p.coverageId}|${p.storageKey}|${p.contentType}|${p.sizeBytes}`),
    albums: store.coverages().map((c) => `${c.id}:${albumOf(store, c.id).length}`),
  }
}

/** خطواتُ السيناريو — متزامنةٌ بحتة، تُشغَّل **حرفياً** على البديلين. */
const STEPS: readonly ((store: MediaStore) => void)[] = [
  (store) => {
    expect(createCov(store)).toBe("mc-1")
  },
  (store) => {
    // الصورةُ تستهلك نبضتين: المعرّف `mp-2` ومفتاحُ التخزين `media/mc-1-3`.
    expect(addPic(store, "mc-1")).toBe("mp-2")
  },
  (store) => {
    expect(addPic(store, "mc-1")).toBe("mp-4")
  },
  (store) => {
    expect(createCov(store, { titleAr: "تغطيةٌ ثانية" })).toBe("mc-6")
  },
  (store) => {
    // مرفوضةٌ خارج النطاق — لا تترك أثراً على أيّ من البديلين ولا تحرق نبضة.
    const denied = createCoverage(store, mediaContext(MEDIA_OF_MEN), {
      ...coverageInput({ publisherPersonId: MEDIA_OF_MEN }),
      unitId: "women",
    })
    expect(denied.ok).toBe(false)
  },
  (store) => {
    // «سحبُ المنشور»: حالةٌ على `mc-1`، وألبومُها يُخفى.
    remove(store, "mc-1")
  },
]

describe("تطابقُ البديلين — الإعلامُ في الذاكرة وعلى D1", () => {
  it("السيناريو نفسُه يعطي النتائج نفسَها على البديلين **خطوةً خطوة**", async () => {
    const memory = freshMediaStore(MAIN)
    seedMediaData(memory)
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)

    for (const [index, step] of STEPS.entries()) {
      step(memory)
      const inMemory = observe(memory)
      const onD1 = await mediaSession(driver, MAIN, (store) => {
        step(store)
        return observe(store)
      })
      expect(`الخطوة ${index + 1}: ${JSON.stringify(onD1)}`).toBe(
        `الخطوة ${index + 1}: ${JSON.stringify(inMemory)}`,
      )
    }
    driver.close()
  })

  it("الحالةُ الدائمة تُقرأ بعد الجلسة كما تُركت — التحميلُ والإسقاطُ متعاكسان", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    for (const step of STEPS) await mediaSession(driver, MAIN, step)
    const first = await mediaSession(driver, MAIN, observe)
    const second = await mediaSession(driver, MAIN, observe)
    expect(second).toEqual(first)
    driver.close()
  })

  it("قراءةٌ بلا كتابة **لا تُنتج عبارةً واحدة** — فالتحميلُ لا يُلوّث جدولاً ملحقاً فقط", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    await mediaSession(driver, MAIN, (store) => addPic(store, createCov(store)))
    const before = await rowsOf(driver, "media_photos")
    const statements = await statementsAfter(driver, MAIN, (store) => {
      void myCoverages(store, mediaContext("u-media"))
      void displayableCoveragesIn(store, KHALID_PATH)
    })
    expect(statements).toEqual([])
    expect(await rowsOf(driver, "media_photos")).toEqual(before)
    driver.close()
  })
})

// ═══ الإلزاميّ ٦ — الحتميّة والعدّاد عبر الجلسات (والنبضةُ المزدوجة للصورة) ══════

describe("الحتميّة تنجو عبور القاعدة — العدّادُ يُستأنف ولا يعود صفراً", () => {
  it("المعرّفُ متتابعٌ عبر ثلاث جلسات — فلا تُدهس تغطيةٌ بتغطية", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    const ids: string[] = []
    for (const titleAr of ["أوّل", "ثانٍ", "ثالث"]) {
      ids.push(await mediaSession(driver, MAIN, (store) => createCov(store, { titleAr })))
    }
    expect(ids).toEqual(["mc-1", "mc-2", "mc-3"])
    driver.close()
  })

  it("**ونبضةُ مفتاح التخزين تُستأنف**: صورةٌ ثم تغطيةٌ في جلسةٍ أخرى ⟵ `mc-4` لا `mc-3`", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    // جلسةٌ في خالد: تغطيةٌ (mc-1) + صورة (mp-2 + مفتاحُ تخزينٍ media/mc-1-3) ⟵ العدّادُ ٣.
    await mediaSession(
      driver,
      MAIN,
      (store) => addPic(store, createCov(store, { unitId: "khalid" })),
      KHALID_PATH,
    )
    // جلسةٌ في عمر لا ترى مادةَ خالد، ومع ذلك يُستأنف العدّادُ من ٣ (لا من ١) ⟵ التغطيةُ `mc-4`.
    // ولو أُغفلت نبضةُ مفتاح التخزين لكان المحفوظُ ٢ فصارت `mc-3` — دهسٌ صامت.
    const next = await mediaSession(
      driver,
      MAIN,
      (store) => createCov(store, { titleAr: "تغطيةُ عمر", unitId: "omar" }),
      OMAR_PATH,
    )
    expect(next).toBe("mc-4")
    driver.close()
  })

  it("ولا ساعةَ في المستودع: قاعدتان مستقلتان تُنتجان الصفوفَ نفسَها حرفياً", async () => {
    const runs: string[] = []
    for (let i = 0; i < 2; i += 1) {
      const driver = await freshDb()
      await seedMediaSession(driver, MAIN)
      await mediaSession(driver, MAIN, (store) => addPic(store, createCov(store)))
      runs.push(JSON.stringify(await rowsOf(driver, "media_photos")))
      driver.close()
    }
    expect(runs[1]).toBe(runs[0])
  })
})

// ═══ الإلزاميّ ٧ — ميزانيةُ التحميل (G23) ═════════════════════════════════════

describe("ميزانيةُ التحميل — الإعلامُ يُعلن سقفَه ويُقاس عليه (G23)", () => {
  it("سقفُ الإعلام موجبٌ ومُعلَنٌ في المصنع — لا مستودعَ بلا سقف", () => {
    const source = persistentMedia(new MediaStore(MAIN))
    expect(`${source.name}:${source.rowBudget > 0}`).toBe("media:true")
  })

  it("**وتجاوزُه رميةٌ تُسمّي الوحدةَ والجدولَ الأكبر** — لا «تجاوزٌ» مبهمة", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    await mediaSession(driver, MAIN, (store) => addPic(store, createCov(store)))
    const store = freshMediaStore(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist({ ...persistentMedia(store), rowBudget: 3 })
    await expect(uow.hydrate()).rejects.toThrow(/وحدةُ عمل «media»/)
    await expect(uow.hydrate()).rejects.toThrow(/media_units=/)
    driver.close()
  })
})

// ═══ حوافُّ الطبقة — دفاعاتٌ تُختبر لا تُفترض، والسلبُ أكثرُ من الإيجاب ══════════

describe("حوافُّ مستودع الإعلام — والسلبُ أكثرُ من الإيجاب", () => {
  it("**مفتاحُ توجيهٍ لا يُشتقّ يُرمى**: صورةٌ إلى تغطيةٍ مجهولة لا تُوجَّه إلى الجذر صامتاً", () => {
    const store = new MediaStore(MAIN)
    store.savePhoto({
      tenantId: MAIN,
      id: "mp-1",
      coverageId: "mc-لا-وجود-له",
      storageKey: "media/mc-لا-وجود-له-2",
      contentType: "image/jpeg",
      sizeBytes: 10,
      uploadedBy: "u-media",
      uploadedAt: NOW,
    })
    expect(() => persistentMedia(store).project()).toThrow(/مفتاحُ توجيهٍ لا يُشتقّ/)
  })

  it("تحميلٌ من لا شيء لا يرمي ولا يخترع — قاعدةٌ فارغةٌ مستودعٌ فارغٌ وعدّادٌ من الصفر", () => {
    const store = new MediaStore(MAIN)
    persistentMedia(store).load(new Map())
    expect(store.coverages()).toEqual([])
    expect(store.photos()).toEqual([])
    expect(store.nextId("mc")).toBe("mc-1")
  })

  it("**ومفتاحُ تخزينٍ لا يحمل نبضةً في ذيله** (كمنقول v1) لا يرفع العدّادَ ولا يرمي", () => {
    const store = new MediaStore(MAIN)
    seedMediaData(store)
    const coverageId = createCov(store)
    // صورةٌ بمفتاحِ تخزينٍ غيرِ متتابعٍ (مسارُ R2 قديمٌ) — `trailingSeq` تعيد صفراً بأمان.
    store.savePhoto({
      tenantId: MAIN,
      id: "mp-legacy",
      coverageId,
      storageKey: "r2/legacy/opaque-key",
      contentType: "image/jpeg",
      sizeBytes: 20,
      uploadedBy: "u-media",
      uploadedAt: NOW,
    })
    const rows = persistentMedia(store).project().get("sequences")!
    const seq = [...rows.values()][0]!
    // العدّادُ من التغطية (`mc-1`) لا من المفتاح المبهم — لا رميةَ ولا رقمٌ مخترع.
    expect(Number(seq["value"])).toBe(1)
  })

  it("ق-١٠٤ — «تغطياتي» ترتّب المتعادلَين بالمعرّف بعد عبور القاعدة (فرعُ الفارز الثاني)", async () => {
    const driver = await freshDb()
    await seedMediaSession(driver, MAIN)
    // تغطيتان بنفس تاريخ الوقوع ⟵ الفرزُ يقع على الشقّ الثاني `a.id.localeCompare(b.id)`.
    await mediaSession(driver, MAIN, (store) => {
      createCov(store, { titleAr: "أ" })
      createCov(store, { titleAr: "ب" })
    })
    await mediaSession(driver, MAIN, (store) => {
      expect(myCoverages(store, mediaContext("u-media")).map((c) => c.id)).toEqual(["mc-1", "mc-2"])
    })
    driver.close()
  })
})
