/**
 * **استمرارُ نموذج الحلقات على D1** — التسعةُ الإلزامية (الوصفة §٦) وحوافُّ التغطية الثلاثة.
 *
 * **الاختباراتُ تستهلك طبقةَ الاستمرار كما تُشحن**: مستودعُ الوحدة نفسُه، ووحدةُ عملٍ حقيقية،
 * وسائقُ SQLite — **لا محاكاة**. وثابتُ الوحدة الحاكمُ يُقاس **بعد عبور القاعدة** لا قبله:
 * *سجلٌّ واحدٌ للحلقة وسجلٌّ واحدٌ للعضوية* (ب-٢٨/ق-٨٨ متقاعد) — فلا جسرَ يُبنى لأنّ لا
 * انفصالَ يُخاط، **وصفرُ عدّادٍ مخزَّن** فلا رقمَ يتباعد (ع-٢/ع-١٩/ع-٢٩).
 */

import { describe, expect, it } from "vitest"
import {
  persistentCirclesCatalog,
  persistentCirclesRegistry,
} from "../../src/db/repositories/circlesRepository.js"
import { UnitOfWork } from "../../src/db/unitOfWork.js"
import { CirclesStore } from "../../src/features/circles/data/store.js"
import {
  archiveCircle,
  assignTeacher,
  createCircle,
  updateCircle,
} from "../../src/features/circles/services/circles.js"
import { endEnrollment, enroll } from "../../src/features/circles/services/enrollment.js"
import { circleStats, circlesInScope, enrollmentsOf } from "../../src/features/circles/services/derive.js"
import { allTypes } from "../../src/features/circles/services/catalog.js"
import {
  BILAL_PATH,
  KHALID_PATH,
  MAIN,
  NOW,
  OTHER,
  ROOT_SCOPE_PATH,
  SEEDED_TYPES,
  SQ2_PATH,
  circlesContext,
  circlesSession,
  circlesUnitOfWork,
  freshDb,
  rowsOf,
  seedCirclesReferences,
  seedCirclesSession,
} from "./_circles.js"

/** حلقةٌ **بمسارها المُعلَن** لا بحقنٍ في المستودع — فلا يُختبر طريقٌ لا يُشحن. */
function makeCircle(
  store: CirclesStore,
  input: { readonly unitId?: string; readonly typeId?: string; readonly nameAr?: string } = {},
): string {
  const made = createCircle(store, circlesContext("u-amir"), {
    unitId: input.unitId ?? "khalid",
    typeId: input.typeId ?? "tahfeez",
    nameAr: input.nameAr ?? "حلقةُ الفجر",
    capacity: 20,
  })
  if (!made.ok) throw new Error(made.error.code)
  return made.value.id
}

function enrolled(store: CirclesStore, circleId: string, nameAr: string): string {
  const done = enroll(store, circlesContext("u-amir"), { circleId, nameAr })
  if (!done.ok) throw new Error(done.error.code)
  return done.value.id
}

// ═══ الإلزاميّ ١ — ثوابتُ الوحدة على المستودع الحقيقيّ ═══════════════════════════

describe("ب-٢٨ بعد عبور القاعدة — **سجلٌّ واحدٌ للحلقة وسجلٌّ واحدٌ للعضوية**", () => {
  it("حلقتان من نوعين تسكنان **جدولاً واحداً**، والنوعُ عمودٌ لا جدولٌ ثانٍ", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    await circlesSession(driver, MAIN, (store) => {
      makeCircle(store, { typeId: "tahfeez", nameAr: "حلقةُ الحفظ" })
      makeCircle(store, { typeId: "baseera", nameAr: "حلقةُ البصيرة" })
    })

    const rows = await rowsOf(driver, "circles_circles")
    expect(rows).toHaveLength(2)
    // **الفرقُ عمودٌ لا موطن**: نفسُ الجدول ونفسُ المسار، والنوعُ قيمةٌ.
    const types = rows.map((r) => String((r as Record<string, unknown>)["type_id"])).sort()
    expect(types).toEqual(["baseera", "tahfeez"])
    driver.close()
  })

  it("**وطالبٌ يُضاف مرّةً يُقرأ مرّةً** — لا سجلَّي طلابٍ يتباعدان (ع-٢/ق-٨٨ متقاعد)", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    const circleId = await circlesSession(driver, MAIN, (store) => {
      const id = makeCircle(store)
      enrolled(store, id, "عبد الله")
      enrolled(store, id, "معاذ")
      return id
    })

    expect(await rowsOf(driver, "circles_enrollments")).toHaveLength(2)
    // **الاستعلامُ بعد جلسةٍ جديدة**: ما كُتب هو ما يُقرأ — وهو علاجُ «أضفتُ ٢٠ طالباً
    // وسجلُّ اليوم يقول لا طلاب» بنيوياً لا بجسر.
    const names = await circlesSession(driver, MAIN, (store) =>
      enrollmentsOf(store, circleId).map((e) => e.nameAr),
    )
    expect(names).toEqual(["عبد الله", "معاذ"])
    driver.close()
  })

  it("**والأرشفةُ والخروجُ وسمان يعبران القاعدة** — لا صفَّ يُمحى (المادة ٧/٤)", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    const { circleId, enrollmentId } = await circlesSession(driver, MAIN, (store) => {
      const id = makeCircle(store)
      return { circleId: id, enrollmentId: enrolled(store, id, "عبد الله") }
    })
    await circlesSession(driver, MAIN, (store) => {
      endEnrollment(store, circlesContext("u-amir"), { enrollmentId })
      archiveCircle(store, circlesContext("u-amir"), { circleId })
    })

    const circles = await rowsOf(driver, "circles_circles")
    const enrollments = await rowsOf(driver, "circles_enrollments")
    expect(circles).toHaveLength(1)
    expect(enrollments).toHaveLength(1)
    expect((circles[0] as Record<string, unknown>)["archived_at"]).not.toBeNull()
    expect((enrollments[0] as Record<string, unknown>)["left_at"]).not.toBeNull()
    driver.close()
  })

  it("**وصفرُ عمودٍ يحفظ عدداً** في أيّ صفٍّ يعبر القاعدة — العددُ استعلامٌ (ع-١٩/ع-٢٩)", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    await circlesSession(driver, MAIN, (store) => {
      const id = makeCircle(store)
      enrolled(store, id, "عبد الله")
    })
    for (const table of ["circles_circles", "circles_enrollments", "circles_types"]) {
      for (const row of await rowsOf(driver, table)) {
        for (const column of Object.keys(row as Record<string, unknown>)) {
          expect(`${table}.${column}:${/(count|_total|_num|tally)$/.test(column)}`).toBe(
            `${table}.${column}:false`,
          )
        }
      }
    }
    driver.close()
  })
})

// ═══ الإلزاميّ ٢ — عزلُ الشبكة والنطاق على المستودع الحقيقيّ ════════════════════

describe("عزلُ الشبكة والنطاق **على المستودع الحقيقيّ** لا على الذاكرة", () => {
  it("عزلُ الشبكة: حلقاتُ شبكةٍ **لا تُقرأ** من أخرى ولو تطابق المسارُ حرفياً", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    await seedCirclesSession(driver, OTHER)
    await circlesSession(driver, MAIN, (store) => makeCircle(store, { nameAr: "حلقةُ الأولى" }))

    const seen = await circlesSession(driver, OTHER, (store) => store.circles().length)
    expect(seen).toBe(0)
    driver.close()
  })

  it("عزلُ الشبكة: كتابةُ شبكةٍ **لا تمسّ** صفَّ الأخرى ولو حمل المعرّفَ نفسَه", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    await seedCirclesSession(driver, OTHER)
    await circlesSession(driver, MAIN, (store) => makeCircle(store, { nameAr: "الأولى" }))
    await circlesSession(driver, OTHER, (store) => makeCircle(store, { nameAr: "الثانية" }))

    const rows = (await rowsOf(driver, "circles_circles")).map((r) => r as Record<string, unknown>)
    expect(rows).toHaveLength(2)
    // المعرّفان متطابقان (عدّادان مستقلّان)، **والشبكةُ هي ما يفصل**.
    expect(new Set(rows.map((r) => String(r["id"]))).size).toBe(1)
    expect(new Set(rows.map((r) => String(r["tenant_id"]))).size).toBe(2)
    driver.close()
  })

  it("عزلُ النطاق: جلسةُ مسجدٍ **لا تحمّل** حلقاتِ جاره — والمسارُ بادئةٌ بشرطةٍ ختامية", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    await circlesSession(driver, MAIN, (store) => {
      makeCircle(store, { unitId: "khalid", nameAr: "حلقةُ خالد" })
      makeCircle(store, { unitId: "bilal", nameAr: "حلقةُ بلال" })
    })

    const inKhalid = await circlesSession(
      driver,
      MAIN,
      (store) => store.circles().map((c) => c.unitPath),
      KHALID_PATH,
    )
    expect(inKhalid).toEqual([KHALID_PATH])
    const inSq2 = await circlesSession(driver, MAIN, (store) => store.circles().length, SQ2_PATH)
    expect(inSq2).toBe(2)
    driver.close()
  })

  it("**والالتحاقُ يُحمَّل مع نطاق حلقته** — فجلسةُ خالدٍ ترى طلابَها ولا ترى طلابَ بلال", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    await circlesSession(driver, MAIN, (store) => {
      const khalid = makeCircle(store, { unitId: "khalid" })
      const bilal = makeCircle(store, { unitId: "bilal" })
      enrolled(store, khalid, "عبد الله")
      enrolled(store, bilal, "معاذ")
    })

    const names = await circlesSession(
      driver,
      MAIN,
      (store) => store.enrollments().map((e) => e.nameAr),
      KHALID_PATH,
    )
    expect(names).toEqual(["عبد الله"])
    driver.close()
  })
})

// ═══ الإلزاميّ ٣ — مفتاحُ التوجيه: مشتقٌّ لا مخترعٌ ولا جذرٌ صامت ════════════════

describe("مفتاحُ توجيه الالتحاق **من حلقته** — والكتالوجُ بالجذر صراحةً", () => {
  it("الالتحاقُ يعبر القاعدةَ بمسار حلقته لا بمسار الجذر", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    await circlesSession(driver, MAIN, (store) => {
      const id = makeCircle(store, { unitId: "bilal" })
      enrolled(store, id, "معاذ")
    })
    const rows = (await rowsOf(driver, "circles_enrollments")).map((r) => r as Record<string, unknown>)
    expect(rows).toHaveLength(1)
    expect(String(rows[0]!["unit_path"])).toBe(BILAL_PATH)
    driver.close()
  })

  it("**وكتالوجُ الأنواع نطاقُه الجذرُ صراحةً** — معجمٌ للشبكة لا لشظيةِ وحدة", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    const rows = (await rowsOf(driver, "circles_types")).map((r) => r as Record<string, unknown>)
    expect(rows).toHaveLength(SEEDED_TYPES.length)
    expect(new Set(rows.map((r) => String(r["unit_path"])))).toEqual(new Set([ROOT_SCOPE_PATH]))
    driver.close()
  })

  it("**والمعجمُ يُقرأ من كلِّ نطاق** — جلسةُ مسجدٍ ترى الأنواعَ كلَّها (CR-014: معجمٌ واحد)", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    const types = await circlesSession(
      driver,
      MAIN,
      (store) => allTypes(store).map((t) => t.id),
      KHALID_PATH,
    )
    expect(types.sort()).toEqual([...SEEDED_TYPES].map((t) => t.id).sort())
    driver.close()
  })
})

// ═══ الإلزاميّ ٤ — الذرّية: رميةٌ ⟵ صفرُ عبارة ═════════════════════════════════

describe("الذرّية — فشلٌ في منتصف عمليةٍ لا يترك نصفَ أثر", () => {
  it("رميةٌ داخل المقطع المتزامن ⟵ **لا حلقةَ ولا التحاقَ** في القاعدة", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    const store = new CirclesStore(MAIN)
    const uow = circlesUnitOfWork(driver, store, { tenantId: MAIN, scopePath: ROOT_SCOPE_PATH })
    await uow.hydrate()
    const before = store.circles().length
    try {
      const id = makeCircle(store)
      enrolled(store, id, "عبد الله")
      throw new Error("انقطاعٌ مصطنعٌ بعد الإنشاء وقبل القذف")
    } catch {
      // **الفارقُ يُحسب لا يُلتقط**: نُعيد الحالةَ فيصير الفارقُ صفراً ⟵ لا عبارةَ تُكتب.
      const rolled = new CirclesStore(MAIN)
      const check = circlesUnitOfWork(driver, rolled, { tenantId: MAIN, scopePath: ROOT_SCOPE_PATH })
      await check.hydrate()
      expect(rolled.circles().length).toBe(before)
    }
    expect(await rowsOf(driver, "circles_circles")).toHaveLength(0)
    expect(await rowsOf(driver, "circles_enrollments")).toHaveLength(0)
    driver.close()
  })

  it("**وقراءةٌ بلا كتابة لا تُنتج عبارةً واحدة** — فالتحميلُ لا يُلوّث جدولاً ملحقاً فقط", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    await circlesSession(driver, MAIN, (store) => makeCircle(store))

    const store = new CirclesStore(MAIN)
    const uow = circlesUnitOfWork(driver, store, { tenantId: MAIN, scopePath: ROOT_SCOPE_PATH })
    await uow.hydrate()
    circlesInScope(store, ROOT_SCOPE_PATH)
    circleStats(store, ROOT_SCOPE_PATH)
    for (const source of ["circles.catalog", "circles.registry"]) {
      const projected =
        source === "circles.catalog"
          ? persistentCirclesCatalog(store).project()
          : persistentCirclesRegistry(store).project()
      expect(`${source}:${uow.statementsFor(source, projected).length}`).toBe(`${source}:0`)
    }
    driver.close()
  })

  it("**ومحوُ حلقةٍ من الإسقاط يُرمى** ولا يُترجَم `DELETE` (ملحقٌ فقط)", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    await circlesSession(driver, MAIN, (store) => makeCircle(store))

    const store = new CirclesStore(MAIN)
    const uow = circlesUnitOfWork(driver, store, { tenantId: MAIN, scopePath: ROOT_SCOPE_PATH })
    await uow.hydrate()
    const projected = persistentCirclesRegistry(store).project()
    // **محوٌ مصطنعٌ في الإسقاط**: الجدولُ الملحقُ فقط يعود فارغاً ⟵ يجب أن تُرمى لا أن
    // تُترجَم `DELETE` (المادة ٧/٤).
    const shrunk = new Map([...projected].map(([name, table]) =>
      name === "circles_circles" ? [name, new Map()] : [name, table],
    ))
    expect(() => uow.statementsFor("circles.registry", shrunk)).toThrow(/circles_circles/)
    driver.close()
  })
})

// ═══ الإلزاميّ ٥ — تطابقُ البديلين خطوةً خطوة ══════════════════════════════════

describe("تطابقُ البديلين — الحلقاتُ في الذاكرة وعلى D1", () => {
  it("السيناريو نفسُه يعطي النتائجَ نفسَها على البديلين **خطوةً خطوة**", async () => {
    const steps: string[] = []
    const watch = (store: CirclesStore, label: string): void => {
      steps.push(
        `${label}:${JSON.stringify({
          circles: circlesInScope(store, ROOT_SCOPE_PATH).map((c) => [c.id, c.typeId, c.unitPath]),
          stats: circleStats(store, ROOT_SCOPE_PATH),
        })}`,
      )
    }

    // (أ) في الذاكرة وحدها
    const memory = new CirclesStore(MAIN)
    seedCirclesReferences(memory)
    const memoryId = makeCircle(memory)
    watch(memory, "أ/١")
    enrolled(memory, memoryId, "عبد الله")
    watch(memory, "أ/٢")
    updateCircle(memory, circlesContext("u-amir"), { circleId: memoryId, typeId: "baseera" })
    watch(memory, "أ/٣")
    const inMemory = [...steps]

    // (ب) على D1 بجلساتٍ متتابعة
    steps.length = 0
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    const dbId = await circlesSession(driver, MAIN, (store) => {
      const id = makeCircle(store)
      watch(store, "أ/١")
      return id
    })
    await circlesSession(driver, MAIN, (store) => {
      enrolled(store, dbId, "عبد الله")
      watch(store, "أ/٢")
    })
    await circlesSession(driver, MAIN, (store) => {
      updateCircle(store, circlesContext("u-amir"), { circleId: dbId, typeId: "baseera" })
      watch(store, "أ/٣")
    })
    expect(steps).toEqual(inMemory)
    driver.close()
  })

  it("الحالةُ الدائمة تُقرأ بعد الجلسة كما تُركت — التحميلُ والإسقاطُ متعاكسان", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    await circlesSession(driver, MAIN, (store) => {
      const id = makeCircle(store)
      assignTeacher(store, circlesContext("u-amir"), { circleId: id, teacherPersonId: "u-teacher" })
      enrolled(store, id, "عبد الله")
    })
    const first = await circlesSession(driver, MAIN, (store) => JSON.stringify(store.circles()))
    const second = await circlesSession(driver, MAIN, (store) => JSON.stringify(store.circles()))
    expect(second).toBe(first)
    driver.close()
  })
})

// ═══ الإلزاميّ ٦ — الحتميّة عبر الجلسات وتحت نطاقٍ جزئيّ ═══════════════════════

describe("الحتميّة تنجو عبور القاعدة — العدّادُ يُستأنف ولا يعود صفراً", () => {
  it("المعرّفُ متتابعٌ عبر ثلاث جلسات — فلا تُدهس حلقةٌ بحلقة", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    const ids: string[] = []
    for (let i = 0; i < 3; i += 1) {
      ids.push(await circlesSession(driver, MAIN, (store) => makeCircle(store, { nameAr: `حلقة ${i}` })))
    }
    expect(new Set(ids).size).toBe(3)
    expect(await rowsOf(driver, "circles_circles")).toHaveLength(3)
    driver.close()
  })

  it("**والنطاقُ الجزئيُّ لا يُنقص العدّاد**: جلسةُ مسجدٍ لا تدهس معرّفَ جاره", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    await circlesSession(driver, MAIN, (store) => makeCircle(store, { unitId: "bilal" }))
    // جلسةٌ **بنطاق خالد وحده**: لا ترى حلقةَ بلال، ومع ذلك لا تُعيد العدّادَ إلى الصفر.
    await circlesSession(driver, MAIN, (store) => makeCircle(store, { unitId: "khalid" }), KHALID_PATH)

    const ids = (await rowsOf(driver, "circles_circles")).map((r) =>
      String((r as Record<string, unknown>)["id"]),
    )
    expect(new Set(ids).size).toBe(2)
    driver.close()
  })

  it("ولا ساعةَ في المستودع: قاعدتان مستقلتان تُنتجان الصفوفَ نفسَها حرفياً", async () => {
    const runs: string[] = []
    for (let i = 0; i < 2; i += 1) {
      const driver = await freshDb()
      await seedCirclesSession(driver, MAIN)
      await circlesSession(driver, MAIN, (store) => {
        const id = makeCircle(store)
        enrolled(store, id, "عبد الله")
      })
      runs.push(JSON.stringify(await rowsOf(driver, "circles_enrollments")))
      driver.close()
    }
    expect(runs[1]).toBe(runs[0])
  })
})

// ═══ الإلزاميّ ٧ — ميزانيةُ التحميل (G23) ═══════════════════════════════════════

describe("ميزانيةُ التحميل — لكلِّ مصدرٍ سقفُه المُسنَد إلى حمولته (G23 · §٤-٠)", () => {
  it("**مصدران لا واحد**، ولكلٍّ سقفٌ موجبٌ مُعلَنٌ في مصنعه — والكتالوجُ أضيقُ من التشغيليّ", () => {
    const store = new CirclesStore(MAIN)
    const catalog = persistentCirclesCatalog(store)
    const registry = persistentCirclesRegistry(store)
    expect(`${catalog.name}:${catalog.rowBudget > 0}`).toBe("circles.catalog:true")
    expect(`${registry.name}:${registry.rowBudget > 0}`).toBe("circles.registry:true")
    expect(catalog.rowBudget < registry.rowBudget).toBe(true)
    // ولا جدولَ مشترَكٌ بين المصدرين — شكلُ التوجيه هو الفاصل، لا الذوق.
    const names = (s: typeof catalog): string[] =>
      s.tables.map((t) => (typeof t === "string" ? t : t.table))
    expect(names(catalog).filter((t) => names(registry).includes(t))).toEqual([])
  })

  it("**وتجاوزُه رميةٌ تُسمّي المصدرَ والجدولَ الأكبر** — لا «تجاوزٌ» مبهمة", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: ROOT_SCOPE_PATH })
    uow.enlist({ ...persistentCirclesRegistry(new CirclesStore(MAIN)), rowBudget: 2 })
    await expect(uow.hydrate()).rejects.toThrow(/وحدةُ عمل «circles\.registry»/)
    await expect(uow.hydrate()).rejects.toThrow(/circles_units=/)
    driver.close()
  })

  /**
   * **الغرضُ المقيسُ من الفصل** (§٤-٠ · CR-029): قبله كانت قراءةُ كتالوج الأنواع بالجذر تجرّ
   * `LIKE '/%'` ⟵ حلقاتِ الشبكة والتحاقاتِها. وبعده **لا تلمسها أصلاً**.
   */
  it("**جلسةُ الكتالوج بالجذر لا تُحمّل صفَّ حلقةٍ ولا التحاقٍ واحداً** — وهذا هو الفصل", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    // حمولةٌ تشغيليةٌ **أكبرُ من سقف الكتالوج المُصطنَع أدناه** — وإلا كان الحارسُ لا يقدر أن يحمرّ.
    await circlesSession(driver, MAIN, (store) => {
      for (let i = 0; i < 60; i += 1) {
        const id = makeCircle(store, { nameAr: `حلقة ${i}` })
        enrolled(store, id, `طالب ${i}`)
      }
    })
    expect((await rowsOf(driver, "circles_circles")).length).toBe(60)
    expect((await rowsOf(driver, "circles_enrollments")).length).toBe(60)

    // كتالوجٌ وحدَه بالجذر — **وبسقفٍ ٥٠ عمداً**: يسع الأنواعَ (٤) ولا يسع الستّين حلقة.
    // فلو عاد الكتالوجُ يملك جدولاً تشغيلياً (حالُ ما قبل الفصل) **لرمت الميزانيةُ هنا**.
    const store = new CirclesStore(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: ROOT_SCOPE_PATH })
    uow.enlist({ ...persistentCirclesCatalog(store), rowBudget: 50 })
    await uow.hydrate() // لا يرمي: لم يُحمَّل إلا الكتالوج
    expect(store.types().length).toBe(SEEDED_TYPES.length)
    // **ولا صفَّ تشغيليٍّ واحد** عبر إلى الذاكرة.
    expect(store.circles()).toEqual([])
    expect(store.enrollments()).toEqual([])
    expect(store.units()).toEqual([])
    driver.close()
  })
})

// ═══ الإلزاميّ ٨ + حوافُّ التغطية — والسلبُ أكثرُ من الإيجاب ════════════════════

describe("حوافُّ مستودع الحلقات — والسلبُ أكثرُ من الإيجاب", () => {
  it("**مفتاحُ توجيهٍ لا يُشتقّ يُرمى**: التحاقٌ إلى حلقةٍ مجهولة لا يُوجَّه إلى الجذر صامتاً", () => {
    const store = new CirclesStore(MAIN)
    store.appendEnrollment({
      tenantId: MAIN,
      id: "enr-1",
      circleId: "cir-لا-وجود-لها",
      nameAr: "يتيمُ المسار",
      joinedAt: NOW,
      leftAt: null,
    })
    expect(() => persistentCirclesRegistry(store).project()).toThrow(/مفتاحُ توجيهٍ لا يُشتقّ/)
  })

  it("تحميلٌ من لا شيء لا يرمي ولا يخترع — قاعدةٌ فارغةٌ مستودعٌ فارغٌ وعدّادٌ من الصفر", () => {
    const store = new CirclesStore(MAIN)
    persistentCirclesCatalog(store).load(new Map())
    persistentCirclesRegistry(store).load(new Map())
    expect(store.circles()).toEqual([])
    expect(store.enrollments()).toEqual([])
    expect(store.types()).toEqual([])
    expect(store.nextId("cir")).toBe("cir-1")
  })

  it("**وحلقتان تتقاسمان مساراً واحداً تُرتَّبان حتمياً** بالمعرّف — لا بترتيب الإدخال", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    await circlesSession(driver, MAIN, (store) => {
      makeCircle(store, { unitId: "khalid", nameAr: "ب" })
      makeCircle(store, { unitId: "khalid", nameAr: "أ" })
    })
    const first = await circlesSession(driver, MAIN, (store) =>
      circlesInScope(store, ROOT_SCOPE_PATH).map((c) => c.id),
    )
    const second = await circlesSession(driver, MAIN, (store) =>
      circlesInScope(store, ROOT_SCOPE_PATH).map((c) => c.id),
    )
    expect(second).toEqual(first)
    expect(first).toHaveLength(2)
  })

  it("**وفروعُ الأعمدة الفارغة تعبر القاعدة صريحةً**: بلا معلّمٍ · بمعلّمٍ · مؤرشفةٌ · خارجٌ", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    await circlesSession(driver, MAIN, (store) => {
      makeCircle(store, { nameAr: "بلا معلّم" })
      const assigned = makeCircle(store, { nameAr: "بمعلّم" })
      assignTeacher(store, circlesContext("u-amir"), {
        circleId: assigned,
        teacherPersonId: "u-teacher",
      })
      const archived = makeCircle(store, { nameAr: "مؤرشفة" })
      archiveCircle(store, circlesContext("u-amir"), { circleId: archived })
      const left = enrolled(store, assigned, "خارجٌ")
      endEnrollment(store, circlesContext("u-amir"), { enrollmentId: left })
      enrolled(store, assigned, "باقٍ")
    })

    const circles = (await rowsOf(driver, "circles_circles")).map((r) => r as Record<string, unknown>)
    expect(circles.filter((c) => c["teacher_person_id"] === null)).toHaveLength(2)
    expect(circles.filter((c) => c["archived_at"] === null)).toHaveLength(2)
    const enrollments = (await rowsOf(driver, "circles_enrollments")).map(
      (r) => r as Record<string, unknown>,
    )
    expect(enrollments.filter((e) => e["left_at"] === null)).toHaveLength(1)
    driver.close()
  })

  it("**والكتالوجُ يعبر كاملاً ويُختم بالشبكة** — فيُضاف نوعٌ صفّاً فيعمل (قب-٢٢)", async () => {
    const driver = await freshDb()
    await seedCirclesSession(driver, MAIN)
    await circlesSession(driver, MAIN, (store) => {
      store.saveType({ tenantId: MAIN, id: "خامس", ar: "نوعٌ خامس" })
    })
    // **يعمل بلا سطر كود**: حلقةٌ على النوع الجديد تُنشأ في الجلسة التالية.
    const made = await circlesSession(driver, MAIN, (store) =>
      makeCircle(store, { typeId: "خامس", nameAr: "حلقةُ الخامس" }),
    )
    expect(made).not.toBe("")
    const rows = (await rowsOf(driver, "circles_types")).map((r) => r as Record<string, unknown>)
    expect(rows).toHaveLength(SEEDED_TYPES.length + 1)
    expect(new Set(rows.map((r) => String(r["tenant_id"])))).toEqual(new Set([MAIN]))
    driver.close()
  })
})
