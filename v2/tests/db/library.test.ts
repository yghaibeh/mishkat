/**
 * **استمرارُ المكتبة على D1** — T26-ب-٢ (الاختبارات الإلزامية ١…٩ + حوافُّ التغطية).
 *
 * ثوابتُ الوحدة تُقاس هنا **على المستودع الحقيقيّ** لا على الذاكرة:
 *  · **ق-٩٦ خطُّ الزمن أحاديّ لا يُمحى** — الخَتماتُ الثلاث **تحديثٌ على الصفّ نفسِه**،
 *    واختفاءُ صفٍّ يُرمى ولا يُترجم `DELETE`؛ و«الخَتَماتُ» **بلا عدّادٍ مخزَّن** (اشتقاقٌ عند القراءة).
 *  · **§٣/ح-٦ النطاقُ من الكيان المخزَّن** — عزلٌ شبكةً ونطاقاً، والشبكتان بنفس المسارات عمداً.
 *  · **مفتاحُ توجيه خطِّ الزمن من مادته** — مشتقٌّ لا مخترعٌ ولا جذرٌ صامت (نظيرُ حركة العُهد).
 *
 * > **وثلاثةُ خلافاتٍ عن الوصفة مُعلَنةٌ في تقرير التسليم**، وأثرُها هنا:
 * >  ١. **لا سجلَّ تدقيقٍ يُقذف** (المكتبةُ تدقّق على `defineServerFn` لا في المستودع) ⟵
 * >     لا اختبارَ «قيدُ التدقيق يظهر في تدقيق نطاقه»؛ بديلُه «خطُّ الزمن يظهر في نطاق مادته».
 * >  ٢. **حافةُ التغطية الثالثة** (تعادلُ فرزٍ `a-b||c-d`) **غيرُ ذات موضوع**: التحميلُ خريطةٌ
 * >     بالمفتاح لا فرزٌ مرتَّب؛ فبديلُها تغطيةُ فروع الأعمدة الفارغة (رابطٌ/ملفٌّ/مؤرشفة/نصفُ خط).
 */

import { describe, expect, it } from "vitest"
import { persistentLibrary } from "../../src/db/repositories/libraryRepository.js"
import { UnitOfWork } from "../../src/db/unitOfWork.js"
import { LibraryStore } from "../../src/features/library/data/store.js"
import { createMaterial, archiveMaterial, updateMaterial } from "../../src/features/library/services/materials.js"
import { myLibrary } from "../../src/features/library/services/mine.js"
import { completeMaterial, openMaterial, stampDelivery, stateOf } from "../../src/features/library/services/timeline.js"
import { materialsInScope } from "../../src/features/library/services/reach.js"
import type { SqlStatement } from "../../src/db/sql/driver.js"
import type { CreateMaterialInput } from "../../src/features/library/services/materials.js"
import {
  AUDIENCES,
  CATEGORIES,
  FORMATS,
  KHALID_PATH,
  MAIN,
  NOW,
  OTHER,
  freshDb,
  libraryContext,
  librarySession,
  linkMaterialInput,
  materialInput,
  rowsOf,
  seedLibraryReferences,
  seedLibrarySession,
} from "./_library.js"

const BILAL_PATH = "/men/homs/sq2/bilal/"

/** مادةُ **رابط** في وحدةٍ — معرّفٌ متتابعٌ نظيف (`mat-1`…) لأن الرابطَ لا يستهلك مفتاحَ تخزين. */
function makeLink(store: LibraryStore, over: Partial<CreateMaterialInput> = {}, actor = "u-admin"): string {
  const made = createMaterial(store, libraryContext(actor), linkMaterialInput({ unitId: "khalid", ...over }))
  if (!made.ok) throw new Error(`تعذّر إنشاءُ المادة: ${made.error.code}`)
  return made.value.id
}

/** خطُّ زمنٍ كامل لشخصٍ على مادة: استلامٌ ⟵ فتح ⟵ إنجاز — بالطريق المُعلَن لا بحقنٍ. */
function completeFlow(store: LibraryStore, materialId: string, personId: string): void {
  stampDelivery(store, libraryContext(personId))
  const opened = openMaterial(store, libraryContext(personId), { materialId })
  if (!opened.ok) throw new Error(`تعذّر الفتح: ${opened.error.code}`)
  const done = completeMaterial(store, libraryContext(personId), { materialId })
  if (!done.ok) throw new Error(`تعذّر الإنجاز: ${done.error.code}`)
}

/** قراءةُ عبارات المستودع مقابل أساسه — بها يُقاس **ما يُكتب** لا ما يُقرأ. */
async function statementsAfter(
  driver: Awaited<ReturnType<typeof freshDb>>,
  tenantId: string,
  fn: (store: LibraryStore) => void,
): Promise<readonly SqlStatement[]> {
  const store = new LibraryStore(tenantId)
  const source = persistentLibrary(store)
  const uow = new UnitOfWork(driver, { tenantId, scopePath: "/" })
  uow.enlist(source)
  await uow.hydrate()
  fn(store)
  return uow.statementsFor(source.name, source.project())
}

// ═══ الإلزاميّ ١ — ق-٩٦: خطُّ الزمن لا يُمحى، والحالةُ تحديثٌ لا صفٌّ جديد ═══════════

describe("ق-٩٦ — خطُّ الزمن لا يُمحى: الاختفاءُ يُرمى، والانتقالُ تحديثٌ", () => {
  it("محوُ خطِّ زمنٍ من الإسقاط **يُرمى**، ولا `DELETE` يُولَّد (ملحقٌ فقط)", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    await librarySession(driver, MAIN, (store) => {
      const id = makeLink(store, { mandatory: true })
      completeFlow(store, id, "u-amir")
    })

    const store = new LibraryStore(MAIN)
    const source = persistentLibrary(store)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(source)
    await uow.hydrate()
    const forged = new Map(source.project())
    forged.set("library_progress", new Map())
    expect(() => uow.statementsFor(source.name, forged)).toThrow(/library_progress/)
    driver.close()
  })

  it("ومحوُ **مادةٍ** كذلك يُرمى: الأرشفةُ وسمٌ لا حذفٌ صامت (المادة ٧/٤)", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    await librarySession(driver, MAIN, (store) => makeLink(store))

    const store = new LibraryStore(MAIN)
    const source = persistentLibrary(store)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(source)
    await uow.hydrate()
    const forged = new Map(source.project())
    forged.set("library_materials", new Map())
    expect(() => uow.statementsFor(source.name, forged)).toThrow(/library_materials/)
    driver.close()
  })

  it("**ولا عبارةَ حذفٍ واحدة** تُولَّد مهما تعاقبت الخَتماتُ والأرشفة", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    const statements = await statementsAfter(driver, MAIN, (store) => {
      const id = makeLink(store, { mandatory: true })
      completeFlow(store, id, "u-amir") // استلم ⟵ فتح ⟵ أنجز: أشدُّ ما يُغري بنمذجة الحالة حذفاً وإدراجاً
      completeFlow(store, id, "u-teacher")
      const second = makeLink(store, { titleAr: "الثانية" })
      const archived = archiveMaterial(store, libraryContext("u-admin"), { materialId: second })
      expect(archived.ok).toBe(true)
    })
    expect(statements.filter((s) => /^DELETE/.test(s.sql))).toEqual([])
    driver.close()
  })

  it("انتقالُ الحالة **تحديثٌ**: الفتحُ والإنجازُ يُبقيان الصفَّ نفسَه ولا يُنشئان صفاً جديداً", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    const id = await librarySession(driver, MAIN, (store) => {
      const m = makeLink(store, { mandatory: true })
      stampDelivery(store, libraryContext("u-amir"))
      return m
    })
    expect(await rowsOf(driver, "library_progress")).toHaveLength(1)

    // الانتقالُ (استُلم ⟵ فُتح) **عبارةٌ واحدةٌ تحديثٌ بالمفتاح الطبيعيّ** — لا حذفٌ ولا إدراجٌ ثانٍ.
    const statements = await statementsAfter(driver, MAIN, (store) => {
      expect(openMaterial(store, libraryContext("u-amir"), { materialId: id }).ok).toBe(true)
    })
    const onProgress = statements.filter((s) => s.sql.includes("library_progress"))
    expect(onProgress).toHaveLength(1)
    expect(onProgress[0]!.sql).toContain("ON CONFLICT (tenant_id, material_id, person_id) DO UPDATE")

    // ثم يُنفَّذ الفتحُ فالإنجازُ فعلاً عبر جلستين — والصفُّ يبقى واحداً بمفتاحه.
    await librarySession(driver, MAIN, (store) => {
      expect(openMaterial(store, libraryContext("u-amir"), { materialId: id }).ok).toBe(true)
    })
    await librarySession(driver, MAIN, (store) => {
      expect(completeMaterial(store, libraryContext("u-amir"), { materialId: id }).ok).toBe(true)
    })
    const rows = (await rowsOf(driver, "library_progress")) as readonly Record<string, unknown>[]
    // **الصفُّ نفسُه بقي**: عددُه واحدٌ، ومفتاحُه لم يتبدّل، والحالةُ تحرّكت بختمٍ لا بصفٍّ جديد.
    expect(rows).toHaveLength(1)
    expect(`${String(rows[0]!["material_id"])}|${String(rows[0]!["person_id"])}`).toBe(`${id}|u-amir`)
    expect(rows[0]!["opened_at"]).not.toBeNull()
    expect(rows[0]!["completed_at"]).not.toBeNull()
    driver.close()
  })
})

// ═══ الإلزاميّ ٢ — «الخَتَماتُ الثلاث» بلا عدّادٍ مخزَّن (الفخُّ المتوقَّع) ═══════════

describe("الخَتَماتُ الثلاث اشتقاقٌ لا عدّادٌ مخزَّن — README §٤", () => {
  it("**لا عمودَ يحفظ عدداً** في أيّ صفٍّ يعبر القاعدة — العددُ استعلامٌ على المصدر", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    await librarySession(driver, MAIN, (store) => {
      const id = makeLink(store, { mandatory: true })
      completeFlow(store, id, "u-amir")
    })
    // أعمدةُ المادة وخطِّ الزمن كما تعبر القاعدة — لا `completed_count` ولا `delivered_total`.
    for (const table of ["library_materials", "library_progress"]) {
      const cols = (await driver.all({ sql: `PRAGMA table_info(${table})`, params: [] })).map((c) =>
        String(c["name"]),
      )
      expect(cols.filter((c) => /(count|_total|_num|tally)$/.test(c))).toEqual([])
    }
    driver.close()
  })

  it("والعددُ المشتقُّ يصدق بعد عبور القاعدة — «المُنجَز» يُحسب من الخَتمات لا من رقمٍ مخزَّن", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    const id = await librarySession(driver, MAIN, (store) => {
      const m = makeLink(store, { mandatory: true })
      completeFlow(store, m, "u-amir")
      return m
    })
    // جلسةٌ جديدة: العددُ يُشتقّ من الصفوف المحمَّلة لا من حقلٍ — ولو لم يُخزَّن رقمٌ واحد.
    await librarySession(driver, MAIN, (store) => {
      const view = myLibrary(store, libraryContext("u-amir"))
      expect(`${view.mandatoryCompleted}/${view.mandatoryTotal}`).toBe("1/1")
      expect(stateOf(store.getProgress(id, "u-amir"))).toBe("completed")
    })
    driver.close()
  })
})

// ═══ الإلزاميّ ٣ — عزلُ النطاق على المستودع الحقيقيّ (§٣/ح-٦) ═════════════════════

describe("عزلُ النطاق **على المستودع الحقيقيّ** لا على الذاكرة", () => {
  it("عزلُ الشبكة: مكتبةُ شبكةٍ **لا تُقرأ** من أخرى ولو تطابق المسارُ حرفياً", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    await seedLibrarySession(driver, OTHER)
    const alien = await librarySession(driver, OTHER, (store) => {
      const id = makeLink(store, { titleAr: "مادةُ حلب", mandatory: true })
      completeFlow(store, id, "u-amir")
      return id
    })

    await librarySession(driver, MAIN, (store) => {
      expect(store.materials()).toEqual([])
      expect(store.progress()).toEqual([])
      expect(store.getMaterial(alien)).toBeNull()
      expect(materialsInScope(store, KHALID_PATH, true)).toEqual([])
    })
    driver.close()
  })

  it("عزلُ الشبكة: كتابةُ شبكةٍ **لا تمسّ** صفَّ الأخرى ولو حمل المعرّفَ نفسَه", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    await seedLibrarySession(driver, OTHER)
    await librarySession(driver, OTHER, (store) => makeLink(store, { titleAr: "مادةُ حلب" }))
    await librarySession(driver, MAIN, (store) => makeLink(store, { titleAr: "مادةُ حمص" }))

    const rows = (await rowsOf(driver, "library_materials")) as readonly Record<string, unknown>[]
    expect(rows.map((r) => `${String(r["tenant_id"])}|${String(r["id"])}|${String(r["title_ar"])}`).sort()).toEqual([
      "t-aleppo|mat-1|مادةُ حلب",
      "t-main|mat-1|مادةُ حمص",
    ])
    driver.close()
  })

  it("عزلُ النطاق: جلسةُ مسجدٍ **لا تحمّل** مكتبةَ جاره — والمسارُ بادئةٌ بشرطةٍ ختامية", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    await librarySession(driver, MAIN, (store) => {
      makeLink(store, { unitId: "khalid", titleAr: "مادةُ خالد" })
      makeLink(store, { unitId: "bilal", titleAr: "مادةُ بلال" })
    })

    await librarySession(
      driver,
      MAIN,
      (store) => {
        expect(store.materials().map((m) => m.titleAr)).toEqual(["مادةُ بلال"])
        expect(materialsInScope(store, KHALID_PATH, true)).toEqual([])
      },
      BILAL_PATH,
    )
    driver.close()
  })

  it("**وخطُّ الزمن يُحمَّل مع نطاق مادته** لا نطاقِ الشخص — فجلسةُ خالد ترى إنجازَ معلّمها", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    const id = await librarySession(driver, MAIN, (store) => {
      const m = makeLink(store, { unitId: "khalid", mandatory: true })
      completeFlow(store, m, "u-teacher") // المعلّمُ تحت خالد، فخطُّ زمنه يحمل مسارَ خالد
      return m
    })
    // جلسةٌ نطاقُها خالد تحمّل خطَّ زمنٍ مسارُه خالد — ولو كان صاحبُه معلّمَ حلقةٍ تحته.
    await librarySession(
      driver,
      MAIN,
      (store) => {
        expect(stateOf(store.getProgress(id, "u-teacher"))).toBe("completed")
      },
      KHALID_PATH,
    )
    // وجلسةُ جارٍ (بلال) لا تراه.
    await librarySession(
      driver,
      MAIN,
      (store) => expect(store.getProgress(id, "u-teacher")).toBeNull(),
      BILAL_PATH,
    )
    driver.close()
  })
})

// ═══ الإلزاميّ ٤ — مفتاحُ توجيه خطِّ الزمن من مادته (§٣) ═════════════════════════

describe("مفتاحُ توجيه خطِّ الزمن **من مادته** — مشتقٌّ لا مخترعٌ ولا جذرٌ صامت", () => {
  it("خطُّ الزمن يعبر القاعدةَ بمسار مادته لا بمسار الجذر ولا بمسار الشخص", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    await librarySession(driver, MAIN, (store) => {
      const m = makeLink(store, { unitId: "khalid", mandatory: true })
      stampDelivery(store, libraryContext("u-amir"))
      void m
    })
    const rows = (await rowsOf(driver, "library_progress")) as readonly Record<string, unknown>[]
    expect(rows.map((r) => `${String(r["person_id"])}|${String(r["unit_path"])}`)).toEqual([
      "u-amir|/men/homs/sq2/khalid/",
    ])
    driver.close()
  })

  it("**والمعاجمُ نطاقُها الجذرُ صراحةً** — بياناتٌ مرجعيةٌ للشبكة لا لشظيةِ وحدة", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    for (const table of ["library_categories", "library_audiences", "library_formats"]) {
      const rows = (await rowsOf(driver, table)) as readonly Record<string, unknown>[]
      expect(rows.length).toBeGreaterThan(0)
      expect(new Set(rows.map((r) => String(r["unit_path"])))).toEqual(new Set(["/"]))
    }
    // والوحداتُ نطاقُها مسارُها نفسُه (نظيرُ `ledger_units`) لا الجذر.
    const units = (await rowsOf(driver, "library_units")) as readonly Record<string, unknown>[]
    const khalid = units.find((u) => u["id"] === "khalid")!
    expect(String(khalid["unit_path"])).toBe("/men/homs/sq2/khalid/")
    driver.close()
  })
})

// ═══ الإلزاميّ ٥ — الذرّية: لا نصفَ أثر ══════════════════════════════════════════

describe("الذرّية — فشلٌ في منتصف عمليةٍ لا يترك نصفَ أثر", () => {
  it("رميةٌ داخل المعاملة ⟵ لا مادةَ ولا خطَّ زمنٍ **في القاعدة**", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    const boom = new Error("انفجارٌ مصطنعٌ بعد الكتابة وقبل تمام العملية")

    await expect(
      librarySession(driver, MAIN, (store) => {
        store.transaction(() => {
          store.saveMaterial({
            tenantId: MAIN,
            id: store.nextId("mat"),
            titleAr: "مادةٌ لن تبقى",
            categoryId: "admin_training",
            audienceId: "all",
            kind: "link",
            unitId: "khalid",
            unitPath: KHALID_PATH,
            mandatory: true,
            storageKey: null,
            contentType: null,
            sizeBytes: null,
            externalUrl: "https://x",
            createdBy: "u-admin",
            createdAt: NOW,
            archivedAt: null,
            archivedBy: null,
          })
          throw boom
        })
      }),
    ).rejects.toThrow(boom)

    // **الفارقُ يُحسب لا يُلتقط**: الذاكرةُ ارتدّت ⟵ صفرُ عبارةٍ ⟵ صفرُ أثرٍ دائم.
    expect(await rowsOf(driver, "library_materials")).toHaveLength(0)
    driver.close()
  })

  it("ومحاولةٌ مرفوضةٌ دلالياً لا تحرق معرّفاً عبر القاعدة", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    await librarySession(driver, MAIN, (store) => {
      // فتحٌ بلا استلامٍ سابق ⟵ رفضٌ لا يستهلك عدّاداً ولا يكتب صفاً.
      const denied = openMaterial(store, libraryContext("u-amir"), { materialId: "mat-404" })
      expect(denied.ok).toBe(false)
    })
    const first = await librarySession(driver, MAIN, (store) => makeLink(store))
    // أوّلُ معرّفٍ لا يزال `mat-1` — الرفضُ لم يحرق نبضةَ عدّاد.
    expect(first).toBe("mat-1")
    driver.close()
  })

  it("وحدةُ عملٍ خليطةٌ تُرمى — لا تُقذف مكتبةٌ ومستودعٌ بلا مخطط", async () => {
    const driver = await freshDb()
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(persistentLibrary(new LibraryStore(MAIN)))
    uow.enlist({
      name: "مستودعٌ بلا مخطط",
      rowBudget: 10,
      tables: ["library_bookmarks"],
      project: () => new Map(),
      load: () => undefined,
    })
    await expect(uow.hydrate()).rejects.toThrow(/library_bookmarks/)
    driver.close()
  })
})

// ═══ الإلزاميّ ٦ — تطابقُ البديلين خطوةً خطوة ════════════════════════════════════

type Observation = {
  readonly materials: readonly string[]
  readonly progress: readonly string[]
  readonly amir: string
}

/** لقطةٌ **قرائيةٌ بحتة** — لا تختم استلاماً ولا تحرّك عدّاداً (الوصفة §٦: لا `nextId` في المراقبة). */
function observe(store: LibraryStore): Observation {
  const amir = materialsInScope(store, KHALID_PATH, true).reduce(
    (n, m) => n + (stateOf(store.getProgress(m.id, "u-amir")) === "completed" ? 1 : 0),
    0,
  )
  return {
    materials: store
      .materials()
      .map((m) => `${m.id}|${m.titleAr}|${m.unitPath}|${m.archivedAt === null ? "live" : "arch"}`)
      .sort(),
    progress: store
      .progress()
      .map((p) => `${p.materialId}|${p.personId}|${stateOf(p)}`)
      .sort(),
    amir: `أنجزَ خالدُ: ${amir}`,
  }
}

const STEPS: readonly ((store: LibraryStore) => void)[] = [
  (store) => {
    expect(makeLink(store, { unitId: "khalid", titleAr: "الأولى", mandatory: true })).toBe("mat-1")
  },
  (store) => stampDelivery(store, libraryContext("u-amir")),
  (store) => {
    expect(openMaterial(store, libraryContext("u-amir"), { materialId: "mat-1" }).ok).toBe(true)
  },
  (store) => {
    expect(completeMaterial(store, libraryContext("u-amir"), { materialId: "mat-1" }).ok).toBe(true)
  },
  (store) => {
    // إنجازٌ قبل الفتح مرفوض — لا أثرَ على أيّ بديل.
    expect(completeMaterial(store, libraryContext("u-teacher"), { materialId: "mat-1" }).ok).toBe(false)
  },
  (store) => {
    expect(makeLink(store, { unitId: "khalid", titleAr: "الثانية" })).toBe("mat-2")
  },
  (store) => {
    expect(archiveMaterial(store, libraryContext("u-admin"), { materialId: "mat-2" }).ok).toBe(true)
  },
]

describe("تطابقُ البديلين — المكتبةُ في الذاكرة وعلى D1", () => {
  it("السيناريو نفسُه يعطي النتائج نفسَها على البديلين **خطوةً خطوة**", async () => {
    const memory = new LibraryStore(MAIN)
    seedLibraryReferences(memory)
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)

    for (const [index, step] of STEPS.entries()) {
      step(memory)
      const inMemory = observe(memory)
      const onD1 = await librarySession(driver, MAIN, (store) => {
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
    await seedLibrarySession(driver, MAIN)
    for (const step of STEPS) await librarySession(driver, MAIN, step)
    const first = await librarySession(driver, MAIN, observe)
    const second = await librarySession(driver, MAIN, observe)
    expect(second).toEqual(first)
    driver.close()
  })

  it("قراءةٌ بلا كتابة **لا تُنتج عبارةً واحدة** — فالتحميلُ لا يُلوّث خطّاً ملحقاً فقط", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    await librarySession(driver, MAIN, (store) => {
      const id = makeLink(store, { mandatory: true })
      completeFlow(store, id, "u-amir")
    })
    const before = await rowsOf(driver, "library_progress")
    const statements = await statementsAfter(driver, MAIN, (store) => {
      void materialsInScope(store, KHALID_PATH, true)
      void myLibrary(store, libraryContext("u-square")) // شخصٌ لا تبلغه المادةُ ⟵ لا خَتم
    })
    expect(statements).toEqual([])
    expect(await rowsOf(driver, "library_progress")).toEqual(before)
    driver.close()
  })
})

// ═══ الإلزاميّ ٧ — الحتميّة والعدّاد عبر الجلسات وتحت نطاقٍ جزئيّ ════════════════

describe("الحتميّة تنجو عبور القاعدة — العدّادُ يُستأنف ولا يعود صفراً", () => {
  it("المعرّفُ متتابعٌ عبر ثلاث جلسات — فلا تُدهس مادةٌ بمادة", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    const ids: string[] = []
    for (const label of ["أولى", "ثانية", "ثالثة"]) {
      ids.push(await librarySession(driver, MAIN, (store) => makeLink(store, { titleAr: label })))
    }
    expect(ids).toEqual(["mat-1", "mat-2", "mat-3"])
    expect(await rowsOf(driver, "library_materials")).toHaveLength(3)
    driver.close()
  })

  it("**والنطاقُ الجزئيُّ لا يُنقص العدّاد**: جلسةُ مسجدٍ لا تدهس معرّفَ جاره", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    await librarySession(driver, MAIN, (store) => makeLink(store, { unitId: "khalid", titleAr: "مادةُ خالد" }))
    // جلسةٌ لا ترى إلا مسجد بلال، ومع ذلك يُستأنف العدّادُ من المحفوظ (سلسلةُ العدّاد في الجذر).
    const second = await librarySession(
      driver,
      MAIN,
      (store) => makeLink(store, { unitId: "bilal", titleAr: "مادةُ بلال" }),
      BILAL_PATH,
    )
    expect(second).toBe("mat-2")
    const rows = (await rowsOf(driver, "library_materials")) as readonly Record<string, unknown>[]
    expect(rows.map((r) => String(r["id"])).sort()).toEqual(["mat-1", "mat-2"])
    driver.close()
  })

  it("**ومفتاحُ التخزين من المستودع يعبر القاعدة**: ملفٌّ مرفوعٌ يستهلك نبضةً قبل معرّف المادة", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    const id = await librarySession(driver, MAIN, (store) => {
      const made = createMaterial(store, libraryContext("u-admin"), materialInput({ unitId: "khalid" }))
      if (!made.ok) throw new Error(made.error.code)
      return made.value
    })
    // مفتاحُ التخزين استهلك `-1`، ومعرّفُ المادة `-2` — كلاهما من عدّاد المستودع لا من المدخل.
    expect(id.id).toBe("mat-2")
    expect(id.storageKey).toBe(`${MAIN}/library-1`)
    const rows = (await rowsOf(driver, "library_materials")) as readonly Record<string, unknown>[]
    expect(String(rows[0]!["storage_key"])).toBe(`${MAIN}/library-1`)
    driver.close()
  })

  it("ولا ساعةَ في المستودع: قاعدتان مستقلتان تُنتجان الصفوفَ نفسَها حرفياً", async () => {
    const runs: string[] = []
    for (let i = 0; i < 2; i += 1) {
      const driver = await freshDb()
      await seedLibrarySession(driver, MAIN)
      await librarySession(driver, MAIN, (store) => {
        const id = makeLink(store, { mandatory: true })
        completeFlow(store, id, "u-amir")
      })
      runs.push(JSON.stringify(await rowsOf(driver, "library_progress")))
      driver.close()
    }
    expect(runs[1]).toBe(runs[0])
  })
})

// ═══ الإلزاميّ ٨ — ميزانيةُ التحميل (G23) ═══════════════════════════════════════

describe("ميزانيةُ التحميل — المكتبةُ تُعلن سقفَها وتُقاس عليه (G23)", () => {
  it("سقفُ المكتبة موجبٌ ومُعلَنٌ في المصنع — لا مستودعَ بلا سقف", () => {
    const source = persistentLibrary(new LibraryStore(MAIN))
    expect(`${source.name}:${source.rowBudget > 0}`).toBe("library:true")
  })

  it("**وتجاوزُه رميةٌ تُسمّي الوحدةَ والجدولَ الأكبر** — لا «تجاوزٌ» مبهمة", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist({ ...persistentLibrary(new LibraryStore(MAIN)), rowBudget: 2 })
    await expect(uow.hydrate()).rejects.toThrow(/وحدةُ عمل «library»/)
    await expect(uow.hydrate()).rejects.toThrow(/library_units=/)
    driver.close()
  })
})

// ═══ الإلزاميّ ٩ + حوافُّ التغطية — والسلبُ أكثرُ من الإيجاب ═════════════════════

describe("حوافُّ مستودع المكتبة — والسلبُ أكثرُ من الإيجاب", () => {
  it("**مفتاحُ توجيهٍ لا يُشتقّ يُرمى**: خطُّ زمنٍ إلى مادةٍ مجهولة لا يُوجَّه إلى الجذر صامتاً", () => {
    const store = new LibraryStore(MAIN)
    store.saveProgress({
      tenantId: MAIN,
      materialId: "mat-لا-وجود-لها",
      personId: "u-amir",
      deliveredAt: NOW,
      openedAt: null,
      completedAt: null,
    })
    expect(() => persistentLibrary(store).project()).toThrow(/مفتاحُ توجيهٍ لا يُشتقّ/)
  })

  it("تحميلٌ من لا شيء لا يرمي ولا يخترع — قاعدةٌ فارغةٌ مستودعٌ فارغٌ وعدّادٌ من الصفر", () => {
    const store = new LibraryStore(MAIN)
    persistentLibrary(store).load(new Map())
    expect(store.materials()).toEqual([])
    expect(store.progress()).toEqual([])
    expect(store.nextId("mat")).toBe("mat-1")
  })

  it("**فروعُ الأعمدة الفارغة تعبر القاعدة صريحةً**: رابطٌ (بلا ملف) · ملفٌّ · مؤرشفةٌ · نصفُ خط", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    const archivedId = await librarySession(driver, MAIN, (store) => {
      makeLink(store, { unitId: "khalid", titleAr: "رابطٌ حيّ" }) // storage_key/content_type/size = null
      const withFile = createMaterial(store, libraryContext("u-admin"), materialInput({ unitId: "khalid" }))
      if (!withFile.ok) throw new Error(withFile.error.code) // storage_key/content_type/size ≠ null
      const toArchive = makeLink(store, { unitId: "khalid", titleAr: "ستُؤرشَف" })
      expect(archiveMaterial(store, libraryContext("u-admin"), { materialId: toArchive }).ok).toBe(true)
      stampDelivery(store, libraryContext("u-amir")) // خطُّ زمنٍ **نصفيّ**: opened_at/completed_at = null
      return toArchive
    })
    // إعادةُ التحميل تعكس كلَّ فرعٍ: المؤرشفةُ مؤرشفةٌ، والرابطُ بلا مفتاح، والملفُّ بمفتاح.
    await librarySession(driver, MAIN, (store) => {
      expect(store.getMaterial(archivedId)?.archivedAt).toEqual(NOW)
      expect(store.getMaterial(archivedId)?.archivedBy).toBe("u-admin")
      const link = store.materials().find((m) => m.titleAr === "رابطٌ حيّ")!
      expect(`${link.storageKey}|${link.contentType}|${link.sizeBytes}`).toBe("null|null|null")
      const file = store.materials().find((m) => m.kind === "pdf")!
      expect(file.storageKey).not.toBeNull()
      expect(file.sizeBytes).toBe(1_000)
      const half = store.getProgress(store.materials().find((m) => m.titleAr === "رابطٌ حيّ")!.id, "u-amir")!
      expect(`${half.openedAt}|${half.completedAt}`).toBe("null|null")
    })
    driver.close()
  })

  it("والبياناتُ المرجعيةُ تعبر كاملةً وتُختم بالشبكة — فتُضاف صفّاً فتعمل (قب-٢٢)", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    await librarySession(driver, MAIN, (store) => {
      expect(store.categories().map((c) => c.id)).toEqual(CATEGORIES.map((c) => c.id))
      expect(store.audiences().map((a) => a.id)).toEqual(AUDIENCES.map((a) => a.id))
      expect(store.formats().map((f) => `${f.id}:${f.active}`)).toEqual(
        FORMATS.map((f) => `${f.id}:${f.active}`),
      )
      // والصيغةُ المُوقَفةُ تبقى **بيانَ إيقافٍ لا حذفاً** (المادة ٨/٤): `epub` موجودةٌ `active=false`.
      expect(store.formats().find((f) => f.id === "epub")?.active).toBe(false)
    })
    driver.close()
  })

  it("وتعديلُ مادةٍ لا يمسّ موطنَها ولا محتواها بعد عبور القاعدة (التعديلُ لا نقلَ فيه)", async () => {
    const driver = await freshDb()
    await seedLibrarySession(driver, MAIN)
    const id = await librarySession(driver, MAIN, (store) => makeLink(store, { unitId: "khalid" }))
    await librarySession(driver, MAIN, (store) => {
      const done = updateMaterial(store, { materialId: id, titleAr: "عنوانٌ جديد" })
      expect(done.ok).toBe(true)
    })
    const rows = (await rowsOf(driver, "library_materials")) as readonly Record<string, unknown>[]
    expect(`${String(rows[0]!["title_ar"])}|${String(rows[0]!["unit_path"])}`).toBe(
      "عنوانٌ جديد|/men/homs/sq2/khalid/",
    )
    driver.close()
  })
})
