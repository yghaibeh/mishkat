/**
 * **استمرارُ الزيارات الإشرافية على D1** — T26-ب-٢ (الاختبارات الإلزامية).
 *
 * وحدةُ الإشراف من الموجة الأولى، وثوابتُها تُقاس هنا **على المستودع الحقيقيّ** لا الذاكرة:
 *  · **ق-٩٩/ق-١٠٠ الزيارةُ سجلٌّ ميدانيٌّ لا يُمحى** — واختفاءُ صفٍّ يُرمى ولا يُترجم `DELETE`.
 *  · **ق-١٦ المرساةُ غيرُ الهدف** — والمخزَّنُ مسارانِ يعبران القاعدةَ ولا يختلطان.
 *  · **مفتاحُ التوجيه مسارُ الهدف** — العزلُ شبكةً ونطاقاً على مساره، بادئةً بشرطةٍ ختامية.
 *  · **الإيقافُ حالةٌ لا حذف** — إيقافُ هدفٍ تحديثٌ على الصفّ نفسِه، لا محوٌ ولا صفٌّ جديد.
 *
 * > **ولا سجلَّ تدقيقٍ في هذه الوحدة** (G22): القيدُ يُعلَن في `defineServerFn` ويكتبه الإطارُ
 * > عبر السجلّ الموحَّد؛ فاختبارُ «ظهورُ الحدث في تدقيق نطاقه» **غيرُ ذي موضوعٍ للمستودع** —
 * > مُصرَّحٌ به في التقرير. وحلَّ محلَّه تشديدُ عزل النطاق (الاختبار ٣).
 */

import { describe, expect, it } from "vitest"
import { persistentSupervision } from "../../src/db/repositories/supervisionRepository.js"
import { UnitOfWork } from "../../src/db/unitOfWork.js"
import { SupervisionStore } from "../../src/features/supervision/data/store.js"
import { recordVisit } from "../../src/features/supervision/services/visits.js"
import { targetStatuses } from "../../src/features/supervision/services/cadence.js"
import { visitsInScope } from "../../src/features/supervision/services/views.js"
import type { SqlStatement } from "../../src/db/sql/driver.js"
import type { VisitDetails } from "../../src/features/supervision/types.js"
import {
  BASEERA_DETAILS,
  BILAL_PATH,
  C1,
  C1_PATH,
  C1B,
  C2,
  C3,
  CORE,
  C_RETIRED,
  KHALID_PATH,
  MAIN,
  NOW,
  OTHER,
  SQ2_PATH,
  TAHFEEZ_DETAILS,
  freshDb,
  rowsOf,
  seedSupervisionProjections,
  seedSupervisionSession,
  supervisionContext,
  supervisionSession,
} from "./_supervision.js"

/** يسجّل زيارةً بالطريق المُعلَن — لا حقنٌ في المستودع، فلا يُختبر مسارٌ لا يُشحن. */
function visit(
  store: SupervisionStore,
  personId: string,
  targetId: string,
  details: VisitDetails,
  visitedAt: Date = NOW,
): string {
  const done = recordVisit(store, supervisionContext(personId), {
    targetId,
    visitedAt,
    core: CORE,
    details,
  })
  if (!done.ok) throw new Error(`تعذّرت الزيارة: ${done.error.code}`)
  return done.value.id
}

/** قراءةُ عبارات المصدر مقابل أساسه — بها يُقاس **ما يُكتب** لا ما يُقرأ. */
async function statementsAfter(
  driver: Awaited<ReturnType<typeof freshDb>>,
  tenantId: string,
  fn: (store: SupervisionStore) => void,
): Promise<readonly SqlStatement[]> {
  const store = new SupervisionStore(tenantId)
  const source = persistentSupervision(store)
  const uow = new UnitOfWork(driver, { tenantId, scopePath: "/" })
  uow.enlist(source)
  await uow.hydrate()
  fn(store)
  return uow.statementsFor(source.name, source.project())
}

// ═══ الاختبار الإلزاميّ ١ — ثوابتُ الوحدة على المستودع الحقيقيّ ══════════════════

describe("ق-٩٩/ق-١٦/ق-١٠٠ — الزيارةُ تعبر القاعدةَ بمسارَيها وحقول نوعها", () => {
  it("**مفتاحُ التوجيه مسارُ الهدف، والمرساةُ عمودُ بياناتٍ** — لا يختلطان في الصفّ", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    // زائرُ المربع الثاني (`u-square`) يزور حلقةً تحته: مرساتُه المربع، وهدفُه الحلقة.
    await supervisionSession(driver, MAIN, (store) => visit(store, "u-square", C1, TAHFEEZ_DETAILS))

    const rows = (await rowsOf(driver, "supervision_visits")) as readonly Record<string, unknown>[]
    expect(rows).toHaveLength(1)
    // `unit_path` = مسارُ الهدف (الحلقة)، و`supervisor_path` = المربع (المرساة) — لا العكس.
    expect(String(rows[0]!["unit_path"])).toBe(C1_PATH)
    expect(String(rows[0]!["supervisor_path"])).toBe(SQ2_PATH)
    expect(String(rows[0]!["target_id"])).toBe(C1)
    driver.close()
  })

  it("**حقولُ النوع نصُّ JSON تعبر القاعدةَ ذهاباً وإياباً** — لا نصفَ نموذجٍ يُقرأ فارغاً", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    await supervisionSession(driver, MAIN, (store) => {
      visit(store, "u-square", C1, TAHFEEZ_DETAILS) // تحفيظ
      visit(store, "u-square", C1B, BASEERA_DETAILS) // على بصيرة — حقولٌ أخرى اسماً وعدداً
    })

    const loaded = await supervisionSession(driver, MAIN, (store) =>
      store.visits().map((v) => ({ curriculum: v.curriculum, details: v.details })),
    )
    const byCurric = new Map(loaded.map((v) => [v.curriculum, v.details]))
    expect(byCurric.get("tahfeez")).toEqual(TAHFEEZ_DETAILS)
    expect(byCurric.get("baseera")).toEqual(BASEERA_DETAILS)
    driver.close()
  })

  it("والنواةُ (الحاضرون · التقييم · الملاحظة) تُقرأ كما كُتبت", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    await supervisionSession(driver, MAIN, (store) => visit(store, "u-square", C1, TAHFEEZ_DETAILS))
    await supervisionSession(driver, MAIN, (store) => {
      const v = store.visits()[0]!
      expect(`${v.core.attendees}|${v.core.ratingPct}|${v.core.noteAr}`).toBe(
        `${CORE.attendees}|${CORE.ratingPct}|${CORE.noteAr}`,
      )
      expect(v.visitedAt.toISOString()).toBe(NOW.toISOString())
      expect(v.byPersonId).toBe("u-square")
    })
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٢ — لا محو: الزيارةُ ملحقٌ فقط، والإيقافُ تحديثٌ ═══════════

describe("لا محو — الزيارةُ ملحقٌ فقط، والإيقافُ حالةٌ لا حذف", () => {
  it("محوُ زيارةٍ من الإسقاط **يُرمى**، ولا `DELETE` يُولَّد (المادة ٧/٤)", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    await supervisionSession(driver, MAIN, (store) => visit(store, "u-square", C1, TAHFEEZ_DETAILS))

    const store = new SupervisionStore(MAIN)
    const source = persistentSupervision(store)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(source)
    await uow.hydrate()

    const forged = new Map(source.project())
    forged.set("supervision_visits", new Map())
    expect(() => uow.statementsFor(source.name, forged)).toThrow(/supervision_visits/)
    driver.close()
  })

  it("**ولا عبارةَ حذفٍ واحدة** تُولَّد مهما تعاقبت الزيارات على أهدافٍ شتّى", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    const statements = await statementsAfter(driver, MAIN, (store) => {
      visit(store, "u-square", C1, TAHFEEZ_DETAILS)
      visit(store, "u-square", C1B, BASEERA_DETAILS)
      visit(store, "u-square", C3, TAHFEEZ_DETAILS)
    })
    expect(statements.filter((s) => /^DELETE/.test(s.sql))).toEqual([])
    driver.close()
  })

  it("**إيقافُ هدفٍ تحديثٌ على الصفّ نفسِه** — لا محوٌ ولا صفٌّ جديد (الإيقافُ حالة)", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    const before = (await rowsOf(driver, "supervision_targets")) as readonly Record<string, unknown>[]
    const activeC1 = before.find((r) => r["id"] === C1)!
    expect(Number(activeC1["active"])).toBe(1)

    // إيقافُ الهدف عبر إعادة إسقاطه موقوفاً — وهو ما يفعله مُزامنُ الحلقات (نسخةُ قراءة).
    const statements = await statementsAfter(driver, MAIN, (store) => {
      store.saveTarget({ tenantId: MAIN, id: C1, path: C1_PATH, curriculum: "tahfeez", active: false })
    })
    const onTargets = statements.filter((s) => s.sql.includes("supervision_targets"))
    expect(onTargets).toHaveLength(1)
    expect(onTargets[0]!.sql).toContain("ON CONFLICT (tenant_id, id) DO UPDATE")
    expect(onTargets.filter((s) => /^DELETE/.test(s.sql))).toEqual([])

    await supervisionSession(driver, MAIN, (store) => {
      store.saveTarget({ tenantId: MAIN, id: C1, path: C1_PATH, curriculum: "tahfeez", active: false })
    })
    const after = (await rowsOf(driver, "supervision_targets")) as readonly Record<string, unknown>[]
    // العددُ نفسُه، والصفُّ نفسُه بمعرّفه، والحالةُ تحرّكت ٠ بدل حذف.
    expect(after).toHaveLength(before.length)
    expect(Number(after.find((r) => r["id"] === C1)!["active"])).toBe(0)
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٣ — عزلُ الشبكة والنطاق على المستودع الحقيقيّ ════════════

describe("عزلُ الشبكة والنطاق **على المستودع الحقيقيّ** لا على الذاكرة", () => {
  it("عزلُ الشبكة: زيارةُ شبكةٍ **لا تُقرأ** من أخرى ولو تطابق المسارُ حرفياً", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    await seedSupervisionSession(driver, OTHER)
    await supervisionSession(driver, OTHER, (store) => visit(store, "u-square", C1, TAHFEEZ_DETAILS))

    await supervisionSession(driver, MAIN, (store) => {
      expect(store.visits()).toEqual([])
      expect(visitsInScope(store, supervisionContext("u-square"), SQ2_PATH)).toEqual([])
    })
    driver.close()
  })

  it("عزلُ الشبكة: كتابةُ شبكةٍ **لا تمسّ** صفَّ الأخرى ولو حمل المعرّفَ نفسَه", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    await seedSupervisionSession(driver, OTHER)
    await supervisionSession(driver, OTHER, (store) => visit(store, "u-square", C1, TAHFEEZ_DETAILS))
    await supervisionSession(driver, MAIN, (store) => visit(store, "u-square", C1, TAHFEEZ_DETAILS))

    const rows = (await rowsOf(driver, "supervision_visits")) as readonly Record<string, unknown>[]
    // معرّفٌ واحدٌ (`vst-1`) في شبكتين — والمفتاحُ الطبيعيّ يفصلهما بالشبكة لا بالمسار.
    expect(
      rows.map((r) => `${String(r["tenant_id"])}|${String(r["id"])}|${String(r["target_id"])}`).sort(),
    ).toEqual(["t-aleppo|vst-1|c1", "t-main|vst-1|c1"])
    driver.close()
  })

  it("عزلُ النطاق: جلسةُ مسجدٍ **لا تحمّل** زيارةَ جاره — والمفتاحُ مسارُ الهدف بادئةً بشرطة", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    // زيارةٌ لهدفٍ تحت مسجد خالد (`c1`)، وأخرى لهدفٍ تحت مسجد بلال (`c3`).
    await supervisionSession(driver, MAIN, (store) => {
      visit(store, "u-square", C1, TAHFEEZ_DETAILS) // /men/homs/sq2/khalid/c1/
      visit(store, "u-square", C3, TAHFEEZ_DETAILS) // /men/homs/sq2/bilal/c3/
    })

    // جلسةٌ نطاقُها مسجدُ خالد ترى زيارةَ خالد وحدَها — والمفتاحُ مسارُ الهدف لا المرساة.
    await supervisionSession(
      driver,
      MAIN,
      (store) => {
        expect(store.visits().map((v) => v.targetId)).toEqual([C1])
      },
      KHALID_PATH,
    )
    // وجلسةٌ نطاقُها مسجدُ بلال لا ترى زيارةَ خالد.
    await supervisionSession(
      driver,
      MAIN,
      (store) => {
        expect(store.visits().map((v) => v.targetId)).toEqual([C3])
      },
      BILAL_PATH,
    )
    driver.close()
  })

  it("**والاطّلاعُ الهابط بالاحتواء** (ق-١٧): جلسةُ المربع ترى زياراتِ مسجدَيه معاً", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    await supervisionSession(driver, MAIN, (store) => {
      visit(store, "u-square", C1, TAHFEEZ_DETAILS)
      visit(store, "u-square", C3, TAHFEEZ_DETAILS)
    })
    await supervisionSession(
      driver,
      MAIN,
      (store) => {
        expect(store.visits().map((v) => v.targetId).sort()).toEqual([C1, C3])
      },
      SQ2_PATH,
    )
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٤ — الذرّية: لا نصفَ أثر ══════════════════════════════════

describe("الذرّية — فشلٌ في منتصف عمليةٍ لا يترك نصفَ أثر", () => {
  it("رميةٌ داخل المعاملة ⟵ لا زيارةَ **في القاعدة** (الفارقُ يُحسب لا يُلتقط)", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    const boom = new Error("انفجارٌ مصطنعٌ بعد كتابة الزيارة وقبل تمام العملية")

    await expect(
      supervisionSession(driver, MAIN, (store) => {
        store.transaction(() => {
          store.saveVisit({
            tenantId: MAIN,
            id: store.nextId("vst"),
            targetId: C1,
            targetPath: C1_PATH,
            supervisorPath: SQ2_PATH,
            curriculum: "tahfeez",
            dayKey: "2026-07-20",
            visitedAt: NOW,
            core: CORE,
            details: TAHFEEZ_DETAILS,
            byPersonId: "u-square",
          })
          throw boom
        })
      }),
    ).rejects.toThrow(boom)

    expect(await rowsOf(driver, "supervision_visits")).toHaveLength(0)
    driver.close()
  })

  it("وزيارةٌ مرفوضةٌ دلالياً لا تترك صفّاً ولا تحرق معرّفاً عبر القاعدة", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    // `c2` تحت المربع السابع خارج نطاق `u-square` ⟵ مرفوضة، ولا تستهلك نبضةَ عدّاد.
    await supervisionSession(driver, MAIN, (store) => {
      expect(recordVisit(store, supervisionContext("u-square"), {
        targetId: C2,
        visitedAt: NOW,
        core: CORE,
        details: BASEERA_DETAILS,
      }).ok).toBe(false)
    })
    const id = await supervisionSession(driver, MAIN, (store) => visit(store, "u-square", C1, TAHFEEZ_DETAILS))
    // المعرّفُ الأوّل — الرفضُ لم يحرق `vst-1`.
    expect(id).toBe("vst-1")
    expect(await rowsOf(driver, "supervision_visits")).toHaveLength(1)
    driver.close()
  })

  it("وحدةُ عملٍ خليطةٌ تُرمى — لا يُقذف مستودعٌ بلا مخطط", async () => {
    const driver = await freshDb()
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(persistentSupervision(new SupervisionStore(MAIN)))
    uow.enlist({
      name: "مستودعٌ بلا مخطط",
      rowBudget: 10,
      tables: ["supervision_reminders"],
      project: () => new Map(),
      load: () => undefined,
    })
    await expect(uow.hydrate()).rejects.toThrow(/supervision_reminders/)
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٥ — تطابقُ البديلين ═════════════════════════════════════

/** لقطةُ ما تراه **الخدمة** — لا ما يدخل القاعدة: البديلان يجيبان الجوابَ نفسَه أو لا. */
function observe(store: SupervisionStore): Record<string, unknown> {
  return {
    visits: store
      .visits()
      .map(
        (v) =>
          `${v.id}|${v.targetId}|${v.targetPath}|${v.supervisorPath}|${v.curriculum}|${v.dayKey}|${JSON.stringify(v.details)}`,
      ),
    statuses: targetStatuses(store, supervisionContext("u-square"), SQ2_PATH).map(
      (s) => `${s.targetId}|${s.status}|${s.daysSinceLastVisit ?? "—"}`,
    ),
  }
}

const STEPS: readonly ((store: SupervisionStore) => void)[] = [
  (store) => {
    expect(visit(store, "u-square", C1, TAHFEEZ_DETAILS)).toBe("vst-1")
  },
  (store) => {
    expect(visit(store, "u-square", C1B, BASEERA_DETAILS)).toBe("vst-2")
  },
  (store) => {
    // محاولةٌ مرفوضة (هدفٌ خارج النطاق) — لا تترك أثراً على أيٍّ من البديلين.
    expect(
      recordVisit(store, supervisionContext("u-square"), {
        targetId: C2,
        visitedAt: NOW,
        core: CORE,
        details: BASEERA_DETAILS,
      }).ok,
    ).toBe(false)
  },
  (store) => {
    expect(visit(store, "u-square", C3, TAHFEEZ_DETAILS)).toBe("vst-3")
  },
]

describe("تطابقُ البديلين — الإشرافُ في الذاكرة وعلى D1", () => {
  it("السيناريو نفسُه يعطي النتائج نفسَها على البديلين **خطوةً خطوة**", async () => {
    const memory = new SupervisionStore(MAIN)
    seedSupervisionProjections(memory)
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)

    for (const [index, step] of STEPS.entries()) {
      step(memory)
      const inMemory = observe(memory)
      const onD1 = await supervisionSession(driver, MAIN, (store) => {
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
    await seedSupervisionSession(driver, MAIN)
    for (const step of STEPS) await supervisionSession(driver, MAIN, step)
    const first = await supervisionSession(driver, MAIN, observe)
    const second = await supervisionSession(driver, MAIN, observe)
    expect(second).toEqual(first)
    driver.close()
  })

  it("قراءةٌ بلا كتابة **لا تُنتج عبارةً واحدة** — فالتحميلُ لا يُلوّث سجلاً ملحقاً فقط", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    await supervisionSession(driver, MAIN, (store) => visit(store, "u-square", C1, TAHFEEZ_DETAILS))
    const before = await rowsOf(driver, "supervision_visits")
    const statements = await statementsAfter(driver, MAIN, (store) => {
      void targetStatuses(store, supervisionContext("u-square"), SQ2_PATH)
      void store.visits()
    })
    expect(statements).toEqual([])
    expect(await rowsOf(driver, "supervision_visits")).toEqual(before)
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٦ — (الهجرةُ مرتين وعلى بيانات v1) في `tests/migrations` ══

// ═══ الاختبار الإلزاميّ ٧ — الحتميّة والعدّاد عبر الجلسات ════════════════════════

describe("الحتميّة تنجو عبور القاعدة — العدّادُ يُستأنف ولا يعود صفراً", () => {
  it("المعرّفُ متتابعٌ عبر ثلاث جلسات — فلا تُدهس زيارةٌ بزيارة", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    const ids: string[] = []
    for (const target of [C1, C1B, C3]) {
      ids.push(await supervisionSession(driver, MAIN, (store) =>
        visit(store, "u-square", target, target === C1B ? BASEERA_DETAILS : TAHFEEZ_DETAILS),
      ))
    }
    expect(ids).toEqual(["vst-1", "vst-2", "vst-3"])
    expect(await rowsOf(driver, "supervision_visits")).toHaveLength(3)
    driver.close()
  })

  it("**والنطاقُ الجزئيُّ لا يُنقص العدّاد**: جلسةُ مسجدٍ لا تدهس معرّفَ جاره", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    // زيارةٌ في مسجد خالد ثم زيارةٌ في جلسةٍ **لا ترى إلا مسجد بلال** — يُستأنف العدّاد.
    await supervisionSession(driver, MAIN, (store) => visit(store, "u-square", C1, TAHFEEZ_DETAILS))
    const second = await supervisionSession(
      driver,
      MAIN,
      (store) => visit(store, "u-square", C3, TAHFEEZ_DETAILS),
      BILAL_PATH,
    )
    expect(second).toBe("vst-2")
    const rows = (await rowsOf(driver, "supervision_visits")) as readonly Record<string, unknown>[]
    expect(rows.map((r) => String(r["id"])).sort()).toEqual(["vst-1", "vst-2"])
    driver.close()
  })

  it("ولا ساعةَ في المستودع: قاعدتان مستقلتان تُنتجان الصفوفَ نفسَها حرفياً", async () => {
    const runs: string[] = []
    for (let i = 0; i < 2; i += 1) {
      const driver = await freshDb()
      await seedSupervisionSession(driver, MAIN)
      await supervisionSession(driver, MAIN, (store) => visit(store, "u-square", C1, TAHFEEZ_DETAILS))
      runs.push(JSON.stringify(await rowsOf(driver, "supervision_visits")))
      driver.close()
    }
    expect(runs[1]).toBe(runs[0])
  })
})

// ═══ الاختبار الإلزاميّ ٨ — ميزانيةُ التحميل (G23) ═══════════════════════════════

describe("ميزانيةُ التحميل — الإشرافُ يُعلن سقفَه ويُقاس عليه (G23)", () => {
  it("سقفُ الإشراف موجبٌ ومُعلَنٌ في المصنع — لا مستودعَ بلا سقف", () => {
    const source = persistentSupervision(new SupervisionStore(MAIN))
    expect(`${source.name}:${source.rowBudget > 0}`).toBe("supervision:true")
  })

  it("**وتجاوزُه رميةٌ تُسمّي الوحدةَ والجدولَ الأكبر** — لا «تجاوزٌ» مبهمة", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    await supervisionSession(driver, MAIN, (store) => visit(store, "u-square", C1, TAHFEEZ_DETAILS))
    const store = new SupervisionStore(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist({ ...persistentSupervision(store), rowBudget: 2 })
    await expect(uow.hydrate()).rejects.toThrow(/وحدةُ عمل «supervision»/)
    await expect(uow.hydrate()).rejects.toThrow(/supervision_units=/)
    driver.close()
  })
})

// ═══ حوافُّ الطبقة — دفاعاتٌ تُختبر لا تُفترض (والسلبُ أكثرُ من الإيجاب) ═══════════

describe("حوافُّ مستودع الإشراف", () => {
  it("تحميلٌ من لا شيء لا يرمي ولا يخترع — قاعدةٌ فارغةٌ مستودعٌ فارغٌ وعدّادٌ من الصفر", () => {
    const store = new SupervisionStore(MAIN)
    persistentSupervision(store).load(new Map())
    expect(store.visits()).toEqual([])
    expect(store.targets()).toEqual([])
    expect(store.units()).toEqual([])
    expect(store.nextId("vst")).toBe("vst-1")
  })

  it("**زيارتان تحملان مفتاحَ اليوم نفسَه** ⟵ ترتيبٌ حتميٌّ عبر جلستين (الشقُّ الثاني من الفرز)", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    // زيارتان في اليوم نفسِه لهدفٍ واحد — يفصل بينهما المعرّفُ لا مفتاحُ اليوم.
    await supervisionSession(driver, MAIN, (store) => {
      visit(store, "u-square", C1, TAHFEEZ_DETAILS)
      visit(store, "u-square", C1, TAHFEEZ_DETAILS)
    })
    const first = await supervisionSession(driver, MAIN, (store) =>
      store.visitsOfTarget(C1).map((v) => v.id),
    )
    const second = await supervisionSession(driver, MAIN, (store) =>
      store.visitsOfTarget(C1).map((v) => v.id),
    )
    // الأحدثُ أوّلاً وبالمعرّف عند تساوي اليوم — `vst-2` قبل `vst-1` حتميّاً.
    expect(first).toEqual(["vst-2", "vst-1"])
    expect(second).toEqual(first)
    driver.close()
  })

  it("هدفٌ موقوفٌ لا يدخل لوحةَ التصنيف بعد عبور القاعدة — الإيقافُ يُحترم على المحمَّل", async () => {
    const driver = await freshDb()
    await seedSupervisionSession(driver, MAIN)
    await supervisionSession(driver, MAIN, (store) => {
      const statuses = targetStatuses(store, supervisionContext("u-square"), SQ2_PATH)
      // `c-retired` موقوفٌ فلا يظهر، والأهدافُ الفعّالةُ تحت المربع تظهر.
      expect(statuses.map((s) => s.targetId)).not.toContain(C_RETIRED)
      expect(statuses.map((s) => s.targetId).sort()).toEqual([C1, C1B, C3])
    })
    driver.close()
  })
})
