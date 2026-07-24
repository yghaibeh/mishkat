/**
 * **محورُ التضييق — النمطُ الثالثُ للنطاق يُقاس قبل أن يُبنى له محور** (T26-ج البند ٣ · CR-029).
 *
 * `Scope = { tenantId, scopePath }` — **محورُ تضييقٍ واحدٌ لا غير**. وثلاثةُ أنماطٍ ظهرت في
 * الموجة الأولى، وهذا الملفُّ **يقيسها بالأرقام** ليُجيب سؤالاً واحداً:
 * *أيحتاج `box`/`payroll`/`approval` محوراً ثانياً (بالشخص) اليوم؟*
 *
 *  · **(أ) تشغيليٌّ بالوحدة** ⟵ التضييقُ بالمسار **يُنقص المحمول** (يُقاس هنا برقمين).
 *  · **(ب) مرجعٌ شبكيٌّ صغير** ⟵ يُعالَج بفصل المستودع (CR-029)، لا بمحور.
 *  · **(ج) تشغيليٌّ ينمو ونطاقُه الشبكةُ حقّاً** ⟵ التضييقُ بالمسار **لا يُنقص شيئاً**
 *    (يُقاس هنا برقمين متساويين)، فلا يبقى إلا محورٌ آخر.
 *
 * **والجوابُ المقيس: لا حاجةَ اليوم** — الثلاثُ لا تملك جدولاً واحداً نطاقُه شخص. ولذلك
 * **لا يُبنى المحور** (المادة ٠: *محورٌ لا يُستعمل كبوابةٍ لا تحرس*)، ويُبنى بدلَه **حارسُ
 * الزناد** أدناه: مسحٌ **مشتقٌّ من المصدر** يحمرّ **في اليوم الذي تصير فيه حاجة**.
 *
 * > **والثابتُ الذي لا يُمسّ فوق كلِّ محور**: **عزلُ الشبكة** (قب-١٨) — وصفٌّ من شبكةٍ أخرى
 * > لا يُقرأ ولو سكن الجذرَ وطابق الشخصَ. مقيسٌ في آخر هذا الملفّ.
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { scopePredicate, scopeParams, type Scope } from "../../src/db/unitOfWork.js"
import type { SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { DailyLogStore } from "../../src/features/dailyLog/data/store.js"
import { recordDailyEntry } from "../../src/features/dailyLog/services/entries.js"
import {
  BILAL_PATH,
  KHALID,
  KHALID_PATH,
  dailyLogContext,
  dailyLogSession,
  seedDailyLogSession,
} from "./_dailyLog.js"
import {
  MAIN,
  OTHER,
  freshDb,
  intake,
  notifyCtx,
  notificationsSession,
  seedNotificationsSession,
  submissionEvent,
} from "./_notifications.js"

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../../src")

/**
 * **ما تراه وحدةُ العمل بالضبط** — بمُرشِّح النطاق المُصدَّر نفسِه (`scopePredicate`) لا
 * بنسخةٍ ثانيةٍ منه: مصدرُ حقيقةٍ واحدٌ للتحميل وللقياس (المادة ١/٢)، وإلا قِسنا غيرَ ما يجري.
 */
async function loadedRows(driver: SqliteDriver, scope: Scope, table: string): Promise<number> {
  const rows = await driver.all({
    sql: `SELECT COUNT(*) AS n FROM ${table} WHERE ${scopePredicate()}`,
    params: [...scopeParams(scope)],
  })
  return Number((rows[0] as Record<string, unknown>)["n"])
}

/** قيدُ سجل يومٍ بالطريق المُعلَن لا بحقنٍ في المستودع. */
function record(store: DailyLogStore, clientUuid: string, unitId: string): void {
  const done = recordDailyEntry(store, dailyLogContext("u-amir"), {
    clientUuid,
    unitId,
    count: 1,
    date: new Date("2026-07-20T00:00:00.000Z"),
    activityId: "lesson",
  })
  if (!done.ok) throw new Error(`تعذّر القيد: ${done.error.code}`)
}

// ═══ القياسُ ١ — النمطُ (أ): التضييقُ بالمسار **يُنقص المحمول فعلاً** ══════════════

describe("محورُ المسار — يعمل حيث تسكن البياناتُ مسارَ وحدتها (النمط أ)", () => {
  it("**رقمان لا رأي**: قيودُ مسجدين تُحمَّل ٢ بالجذر و**١** بنطاق أحدهما", async () => {
    const driver = await freshDb()
    await seedDailyLogSession(driver, MAIN)
    await dailyLogSession(driver, MAIN, (store) => {
      record(store, "c-khalid", KHALID)
      record(store, "c-bilal", "bilal")
    })

    const atRoot = await loadedRows(driver, { tenantId: MAIN, scopePath: "/" }, "daily_entries")
    const atUnit = await loadedRows(
      driver,
      { tenantId: MAIN, scopePath: KHALID_PATH },
      "daily_entries",
    )
    expect(`${atRoot}⟵${atUnit}`).toBe("2⟵1")
    // **والتضييقُ علاجٌ لا شعار**: النقصُ حقيقيٌّ ويظهر في الذاكرة كما يظهر في العدّ.
    const inMemory = await dailyLogSession(
      driver,
      MAIN,
      (store) => store.entries().map((e) => e.unitPath),
      KHALID_PATH,
    )
    expect(inMemory).toEqual([KHALID_PATH])
    expect(inMemory).not.toContain(BILAL_PATH)
    driver.close()
  })
})

// ═══ القياسُ ٢ — النمطُ (ج): التضييقُ بالمسار **لا يُنقص صفّاً واحداً** ════════════

describe("محورُ المسار — لا يعمل حيث تسكن البياناتُ جذرَ الشبكة حقّاً (النمط ج)", () => {
  it("**رقمان متساويان**: صندوقُ الشخص يُحمَّل كاملاً بالجذر وبنطاق مسجدٍ سواءً", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await notificationsSession(driver, MAIN, (store) => {
      const done = intake(store, notifyCtx("u-amir"), submissionEvent())
      if (!done.ok) throw new Error(`تعذّر الإدراج: ${done.error.code}`)
    })

    const atRoot = await loadedRows(driver, { tenantId: MAIN, scopePath: "/" }, "notification_queue")
    const atUnit = await loadedRows(
      driver,
      { tenantId: MAIN, scopePath: KHALID_PATH },
      "notification_queue",
    )
    // **المرشِّحُ يضمّ صفوفَ الجذر في كلِّ جلسة** (`unit_path LIKE ? OR unit_path = '/'`)،
    // فأضيقُ نطاقٍ ممكنٍ يُحمِّل ما يُحمِّله أوسعُه — **بنيةً لا مصادفة**.
    expect(atRoot).toBeGreaterThan(0)
    expect(`جذر=${atRoot} · مسجد=${atUnit}`).toBe(`جذر=${atRoot} · مسجد=${atRoot}`)
    driver.close()
  })

  it("**وهذا هو أصلُ السؤال**: لا نطاقَ أضيقُ يُنقص المحمول ⟵ لا يبقى إلا محورٌ آخر", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await notificationsSession(driver, MAIN, (store) => {
      const done = intake(store, notifyCtx("u-amir"), submissionEvent())
      if (!done.ok) throw new Error(`تعذّر الإدراج: ${done.error.code}`)
    })
    const paths = ["/", "/men/", "/men/homs/", "/men/homs/sq2/", KHALID_PATH, BILAL_PATH]
    const counts = new Set<number>()
    for (const scopePath of paths) {
      counts.add(await loadedRows(driver, { tenantId: MAIN, scopePath }, "notification_queue"))
    }
    // ستُّ محاولاتِ تضييقٍ ⟵ **رقمٌ واحد**. والعلاجُ المنصوصُ أولاً («ضيّق النطاق») لا ينطبق.
    expect(`${paths.length} نطاقاً ⟵ ${counts.size} رقماً`).toBe("6 نطاقاً ⟵ 1 رقماً")
    driver.close()
  })
})

// ═══ حارسُ الزناد — «لا حاجةَ اليوم» ادّعاءٌ يحمرّ يومَ يبطل ═════════════════════

/**
 * **الثلاثُ الباقيات لا تملك جدولاً نطاقُه شخص** — وهذا هو مسوّغُ «لا تبنِ المحور».
 * والادّعاءُ **لا يُترك لانضباط قارئ**: يُشتقّ من المصدر ويحمرّ يومَ يُضاف كيانٌ مخزَّنٌ
 * يحمل شخصاً بلا مفتاحِ توجيه — **وهو بعينه اليومُ الذي تصير فيه الحاجةُ حاجة**.
 *
 * **والقائمةُ تُشتقّ لا تُسرد** (CR-011): كياناتُ كلِّ وحدةٍ تُقرأ من **حقول مستودعها**، فكيانٌ
 * جديدٌ يدخل الفحصَ تلقائياً ولا ينتظر أن يتذكّره أحد.
 */
const PERSON_SCOPED_CANDIDATES = ["box", "payroll", "approval"] as const

/** حاملُ التوجيه: أيُّ حقلٍ ينتهي بـ`unitPath`/`scopePath` — فالصفُّ يسكن مساراً. */
const ROUTING_FIELD = /^\s*readonly\s+\w*(?:[Uu]nitPath|[Ss]copePath)\b/m
/** وحاملُ الشخص: `personId`/`personIds` **بعينهما** — لا كلُّ ما فيه «person». */
const PERSON_FIELD = /^\s*readonly\s+personIds?\b/m

function read(file: string): string {
  return readFileSync(file, "utf8")
}

/** أسماءُ الكيانات المخزَّنة كما يُعلنها المستودعُ نفسُه — لا كما يتذكّرها كاتبُ الاختبار. */
function storedEntities(source: string): string[] {
  const names = new Set<string>()
  const field = /private\s+\w+\s*(?::\s*(\w+)\[\]|=\s*new Map<\s*string\s*,\s*(\w+)\s*>)/g
  for (const match of source.matchAll(field)) {
    const name = match[1] ?? match[2]
    if (name !== undefined && name !== "Snapshot") names.add(name)
  }
  return [...names].sort()
}

/** جسمُ نوعٍ مُعلَنٍ — من `types.ts` أو من المستودع نفسِه (بعضُ الأنواع تسكن معه). */
function typeBody(module: string, name: string): string | null {
  for (const file of [`features/${module}/types.ts`, `features/${module}/data/store.ts`]) {
    const source = read(join(SRC, file))
    const at = source.indexOf(`export type ${name} = {`)
    if (at === -1) continue
    const end = source.indexOf("\n}", at)
    return source.slice(at, end === -1 ? source.length : end)
  }
  return null
}

describe("حارسُ الزناد — صفرُ جدولٍ نطاقُه شخصٌ في `box`/`payroll`/`approval`", () => {
  for (const module of PERSON_SCOPED_CANDIDATES) {
    it(`«${module}»: كلُّ كيانٍ مخزَّنٍ يحمل شخصاً **يحمل مفتاحَ توجيهٍ معه**`, () => {
      const entities = storedEntities(read(join(SRC, `features/${module}/data/store.ts`)))
      // **الحارسُ يقدر أن يحمرّ** (فخّ ٦-ب): مسحٌ لا يجد كياناً واحداً حارسٌ فارغ.
      expect(`${module}: ${entities.length >= 2}`).toBe(`${module}: true`)

      const personScoped = entities.filter((name) => {
        const body = typeBody(module, name)
        if (body === null) return false
        return PERSON_FIELD.test(body) && !ROUTING_FIELD.test(body)
      })
      // صفرٌ ⟵ **المحورُ لا يُحتاج**. وواحدٌ ⟵ يحمرّ، وحينها يُقرأ الحسمُ الرابع في `db/README`.
      expect(`${module} ⟵ ${personScoped.join("،")}`).toBe(`${module} ⟵ `)
    })
  }

  /**
   * **أرضيّةٌ لا سقف** (قب-٥١): كيانٌ جديدٌ مشروعٌ لا يُحمّر هذا الحارسَ — يُحمّره **فراغُ
   * المسح** وحدَه، وهو العطبُ الذي جاء له. *وتثبيتُ ما لا أثرَ له يُنشئ قائمةً تُسرد.*
   */
  it("**والمسحُ يرى الكياناتِ فعلاً** — لا حارسَ يمرّ لأنه لم يقرأ شيئاً", () => {
    const floor: Record<string, number> = { box: 2, payroll: 5, approval: 3 }
    const short = PERSON_SCOPED_CANDIDATES.map((module) => ({
      module,
      seen: storedEntities(read(join(SRC, `features/${module}/data/store.ts`))).length,
    })).filter((entry) => entry.seen < floor[entry.module]!)
    expect(short).toEqual([])
  })

  it("ويُميّز الحاملَين: كيانٌ بشخصٍ **ومسارٍ** ليس نطاقُه شخصاً (السلبُ مقيسٌ لا مفترَض)", () => {
    const advance = typeBody("payroll", "Advance")
    expect(advance).not.toBeNull()
    expect(`شخص=${PERSON_FIELD.test(advance!)} · مسار=${ROUTING_FIELD.test(advance!)}`).toBe(
      "شخص=true · مسار=true",
    )
    // وكيانٌ بلا شخصٍ ولا مسار (قاموسٌ شبكيّ) ليس نطاقُه شخصاً كذلك.
    const category = typeBody("box", "SpendCategory")
    expect(`شخص=${PERSON_FIELD.test(category!)} · مسار=${ROUTING_FIELD.test(category!)}`).toBe(
      "شخص=false · مسار=false",
    )
  })
})

// ═══ الثابتُ الذي لا يُمسّ — عزلُ الشبكة **فوق** كلِّ محور (قب-١٨) ═════════════════

describe("عزلُ الشبكة فوق النمط (ج) — صفُّ الجذر لا يعبر الشبكات", () => {
  it("صندوقُ شبكةٍ **لا يُقرأ** من الأخرى ولو سكن الجذرَ وتطابق المسارُ حرفياً", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await seedNotificationsSession(driver, OTHER)
    await notificationsSession(driver, OTHER, (store) => {
      const done = intake(store, notifyCtx("u-amir"), submissionEvent())
      if (!done.ok) throw new Error(`تعذّر الإدراج: ${done.error.code}`)
    })

    // الشبكتان بنفس المسارات النسبيّة عمداً، والصفوفُ كلُّها على `/` — فلا يفصلهما إلا `tenant_id`.
    const mine = await loadedRows(driver, { tenantId: MAIN, scopePath: "/" }, "notification_queue")
    const theirs = await loadedRows(driver, { tenantId: OTHER, scopePath: "/" }, "notification_queue")
    expect(`أنا=${mine} · هم=${theirs > 0}`).toBe("أنا=0 · هم=true")

    await notificationsSession(driver, MAIN, (store) => {
      expect(store.notifications()).toEqual([])
      expect(store.deliveries()).toEqual([])
    })
    driver.close()
  })
})
