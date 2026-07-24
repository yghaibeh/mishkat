/**
 * **قب-١٣ — المسارُ العامّ يكتب واحداً ولا يقرأ شبكةً** (عقدُ الوحدة §٤).
 *
 * هذا الملفُّ حارسُ **أخطر** ثوابت الوحدة: نقطةٌ **بلا هوية** على الإنترنت، وخلفها جائزةٌ
 * قدّرتها وثيقةُ العميل بمئة ألف دولار — **فحافزُ الإساءة هنا أعلى منه في أيّ مسارٍ آخر**.
 * والصنفُ الذي يحرسه هو بعينه ما أنتج ثغرات v1 (أ-١…أ-٨: نقاطُ RPC مكشوفةٌ لمجهولٍ بلا أن
 * يقصد أحد) — **الاستثناءُ المعلن آمن، والصامتُ قاتل**.
 *
 * **وحارسان لا واحد** (وصفةُ فخّ ٦-ب): **بنيويٌّ** يُثبت الإعلان (المنفذُ مِقبضٌ واحد،
 * والإيصالُ ثلاثةُ حقول)، و**سلوكيٌّ** يُثبت الأثر (صفرُ قراءةٍ قائميّة · صفٌّ واحدٌ يُكتب).
 */
import { describe, it, expect, beforeEach } from "vitest"
import { makeCompetitionEndpoints } from "../../../src/features/competition/server/endpoints.js"
import { clearRegistryForTests, registeredServerFns } from "../../../src/server/defineServerFn.js"
import { PUBLIC_DECLARED_ROUTES } from "../../../src/server/publicRoutes.js"
import { makePublicEnrollPort } from "../../../src/features/competition/services/publicPort.js"
import type { CompetitionStore } from "../../../src/features/competition/data/store.js"
import {
  canonicalActor,
  competitionContext,
  DECISION,
  decisionContext,
  KHALID_PATH,
  OMAR_PATH,
  seedCompetition,
  seedCompetitionStore,
  WRITE,
} from "./_seed.js"

beforeEach(() => clearRegistryForTests())

/** المِقبضاتُ القائميّة — **ما لا يجوز للمسار العامّ أن يلمسه** (قيدُ قب-١٣ الثالث). */
const LISTING_HANDLES = [
  "competitions",
  "categories",
  "stages",
  "scoringTypes",
  "contestants",
  "enrollments",
  "invites",
  "scoreEvents",
  "awards",
  "units",
] as const

type Touch = { readonly reads: string[]; readonly store: CompetitionStore }

/**
 * مستودعٌ ملفوفٌ يُحصي كلَّ مِقبضٍ قائميٍّ يُنادى — **أدواتُ قياسٍ في الاختبار لا في الإنتاج**.
 */
function watched(store: CompetitionStore): Touch {
  const reads: string[] = []
  const proxy = new Proxy(store, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof prop === "string" && (LISTING_HANDLES as readonly string[]).includes(prop)) {
        reads.push(prop)
      }
      return typeof value === "function" ? value.bind(target) : value
    },
  })
  return { reads, store: proxy as CompetitionStore }
}

function requestFor(competitionId: string) {
  return {
    competitionId,
    mosquePath: KHALID_PATH,
    nameAr: "سعدُ بنُ محمّد",
    phone: "0911111111",
    birthDate: new Date("2005-03-01T00:00:00.000Z"),
  }
}

describe("قب-١٣/١ — المسارُ العامّ **عضوٌ قائمٌ** في القائمة البيضاء، ولا ثالثَ يُضاف", () => {
  it("`competition.publicEnroll` معلَنٌ `PUBLIC_DECLARED` وهو في القائمة المعتمدة", () => {
    const store = seedCompetitionStore()
    makeCompetitionEndpoints(store)
    const declared = registeredServerFns()
      .map((fn) => fn.declaration)
      .filter((d) => d.capability === "PUBLIC_DECLARED")
    expect(declared.map((d) => d.name)).toEqual(["competition.publicEnroll"])
    expect(PUBLIC_DECLARED_ROUTES).toContain("competition.publicEnroll")
  })

  it("**ولا تُعلن الوحدةُ مساراً عامّاً ثانياً** — G16 تبقى ٢/٢ (سقفُها لا يُرفع)", () => {
    const store = seedCompetitionStore()
    makeCompetitionEndpoints(store)
    const mine = registeredServerFns()
      .map((fn) => fn.declaration)
      .filter((d) => d.name.startsWith("competition."))
    expect(mine.filter((d) => d.capability === "PUBLIC_DECLARED")).toHaveLength(1)
    expect(PUBLIC_DECLARED_ROUTES).toHaveLength(2)
  })

  it("**وكلُّ سطحٍ آخر يعلن قدرةً من الخمس** — لا سادسةَ ولا سطحَ بلا إعلان (G7)", () => {
    const store = seedCompetitionStore()
    makeCompetitionEndpoints(store)
    const mine = registeredServerFns()
      .map((fn) => fn.declaration)
      .filter((d) => d.name.startsWith("competition."))
    const caps = new Set(mine.map((d) => d.capability))
    caps.delete("PUBLIC_DECLARED")
    expect([...caps].sort()).toEqual([
      "competition.enroll.approve",
      "competition.manage",
      "competition.result.declare",
      "competition.score.record",
      "competition.view",
    ])
    for (const d of mine) {
      if (d.capability === "PUBLIC_DECLARED") continue
      expect(d.scope, `${d.name} بلا مُحلِّل نطاق`).not.toBeUndefined()
    }
  })
})

describe("قب-١٣/٢ — الحارسُ **البنيويّ**: المنفذُ مِقبضٌ واحد، والإيصالُ ثلاثةُ حقول", () => {
  it("منفذُ المسار العامّ يُصدِّر `submit` **وحدَه** — فلا قائمةَ ولا بحثَ يمكن استدعاؤه أصلاً", () => {
    const port = makePublicEnrollPort(seedCompetitionStore())
    expect(Object.keys(port)).toEqual(["submit"])
    for (const handle of LISTING_HANDLES) {
      expect(
        (port as unknown as Record<string, unknown>)[handle],
        `المنفذُ يكشف مِقبضاً قائمياً «${handle}» — قيدُ قب-١٣ الثالث مخروق`,
      ).toBeUndefined()
    }
  })

  it("**وصفرُ صفٍّ شبكيٍّ يخرج**: الإيصالُ `accepted` و`followUpCode` و`reason` لا رابعَ لها", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const ep = makeCompetitionEndpoints(store)
    const done = await ep.publicEnroll.invoke(
      requestFor(competition.id),
      canonicalActor("u-amir"),
      WRITE,
    )
    if (!done.ok) throw new Error(done.decision.reason)
    expect(Object.keys(done.value).sort()).toEqual(["accepted", "followUpCode", "reason"])
    expect(done.value.accepted).toBe(true)
    expect(typeof done.value.followUpCode).toBe("string")
    // لا اسمَ مسجدٍ ولا عنوانَ مسابقةٍ ولا معرّفَ كيانٍ ولا عدد — لا شيءَ من الشبكة يخرج.
    const serialized = JSON.stringify(done.value)
    for (const leaked of [competition.id, competition.titleAr, KHALID_PATH, "homs", "khalid"]) {
      expect(serialized, `تسرّبَ «${leaked}» من المسار العامّ`).not.toContain(leaked)
    }
  })
})

describe("قب-١٣/٣ — الحارسُ **السلوكيّ**: صفرُ قراءةٍ قائميّة، وصفٌّ واحدٌ معلَّق", () => {
  it("**قب-١٣: المسارُ العامُّ يكتب واحداً ولا يقرأ شبكةً** — صفرُ مِقبضٍ قائميٍّ يُنادى", async () => {
    const base = seedCompetitionStore()
    const competition = seedCompetition(base)
    const { reads, store } = watched(base)
    const ep = makeCompetitionEndpoints(store)

    const before = base.enrollments().length
    const done = await ep.publicEnroll.invoke(
      requestFor(competition.id),
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(done.ok).toBe(true)

    expect(reads, `المسارُ العامُّ نادى مِقبضاً قائمياً: ${reads.join("، ")}`).toEqual([])
    // …و**صفٌّ واحدٌ لا صفّان**، وحالتُه **معلَّقة** لا مشاركاً.
    const written = base.enrollments()
    expect(written).toHaveLength(before + 1)
    expect(written[written.length - 1]?.state).toBe("requested")
    expect(written[written.length - 1]?.channel).toBe("public_link")
    expect(written[written.length - 1]?.contestantId).toBeNull()
    // والمقدَّمُ **لا يُحتسب له شيء** (ق-٢٥): لا متبارِيَ يُنشأ قبل بتّ الأمير.
    expect(base.contestants()).toHaveLength(0)
  })

  it("**والمقدَّمُ لا يظهر في لوحة الترتيب** (ق-٢٥) — كالإسناد المعلّق تماماً", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const ep = makeCompetitionEndpoints(store)
    await ep.publicEnroll.invoke(requestFor(competition.id), canonicalActor("u-amir"), WRITE)
    const board = await ep.leaderboardView.invoke(
      { unitId: "homs", competitionId: competition.id },
      canonicalActor("u-rabita"),
      DECISION,
    )
    if (!board.ok) throw new Error(board.decision.reason)
    if (!board.value.ok) throw new Error(board.value.error.code)
    expect(board.value.value.rows).toHaveLength(0)
  })
})

describe("قب-١٣/٤ — ضوابطُ ق-٣٢ إلزاميّة، والفخُّ **صامت**", () => {
  it("**الفخُّ يبتلع الطلبَ الآليَّ صامتاً**: إيصالٌ مقبولٌ ظاهراً و**صفرُ صفٍّ يُكتب**", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const ep = makeCompetitionEndpoints(store)
    const done = await ep.publicEnroll.invoke(
      { ...requestFor(competition.id), trapField: "أنا آلة" },
      canonicalActor("u-amir"),
      WRITE,
    )
    if (!done.ok) throw new Error(done.decision.reason)
    // الصمتُ شرطُ فاعليته — الرفضُ المعلن يعلّم الآلة.
    expect(done.value.accepted).toBe(true)
    expect(done.value.reason).toBeNull()
    expect(store.enrollments()).toHaveLength(0)
  })

  it("**وسقفُ الهاتف من ق-٣٢ نفسِه** (`identity.registration.max_pending_per_phone` = ٣)", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const ep = makeCompetitionEndpoints(store)
    const actor = canonicalActor("u-amir")
    const results = []
    for (const nameAr of ["الأول", "الثاني", "الثالث", "الرابع"]) {
      const done = await ep.publicEnroll.invoke(
        { ...requestFor(competition.id), nameAr, phone: "0922222222" },
        actor,
        WRITE,
      )
      if (!done.ok) throw new Error(done.decision.reason)
      results.push(done.value)
    }
    expect(results.slice(0, 3).every((r) => r.accepted)).toBe(true)
    expect(results[3]?.accepted).toBe(false)
    expect(results[3]?.reason).toBe("PHONE_QUOTA_EXCEEDED")
    expect(store.enrollments()).toHaveLength(3)
  })

  it("**ومفتاحٌ مطفأٌ يُغلق الرابط** (ب-٤٤): `feature.competition_public_registration`", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const ep = makeCompetitionEndpoints(store)
    const off = decisionContext((flag) => flag !== "feature.competition_public_registration")
    const done = await ep.publicEnroll.invoke(requestFor(competition.id), canonicalActor("u-amir"), {
      ...off,
      intent: "write",
    })
    if (!done.ok) throw new Error(done.decision.reason)
    expect(done.value.accepted).toBe(false)
    expect(done.value.reason).toBe("PUBLIC_REGISTRATION_DISABLED")
    expect(store.enrollments()).toHaveLength(0)
  })

  it("**ومسابقةٌ أطفأت رابطَها بعينها** تُغلق ولو كان المفتاحُ العامُّ مفتوحاً", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store, { publicRegistration: false })
    const ep = makeCompetitionEndpoints(store)
    const done = await ep.publicEnroll.invoke(
      requestFor(competition.id),
      canonicalActor("u-amir"),
      WRITE,
    )
    if (!done.ok) throw new Error(done.decision.reason)
    expect(done.value.accepted).toBe(false)
    expect(done.value.reason).toBe("PUBLIC_REGISTRATION_DISABLED")
  })

  it("**والنافذةُ المغلقةُ تُغلق**: مسابقةٌ في `draft` أو خارج مدّتها لا تقبل طلباً", async () => {
    const store = seedCompetitionStore()
    const draft = seedCompetition(store, { advanceTo: [] })
    const ep = makeCompetitionEndpoints(store)
    const done = await ep.publicEnroll.invoke(requestFor(draft.id), canonicalActor("u-amir"), WRITE)
    if (!done.ok) throw new Error(done.decision.reason)
    expect(done.value.accepted).toBe(false)
    expect(done.value.reason).toBe("ENROLLMENT_WINDOW_CLOSED")
    expect(store.enrollments()).toHaveLength(0)
  })

  it("**ومسجدٌ خارج نطاق المسابقة مرفوض** — والنطاقُ من الوحدة المخزَّنة لا من مدخل العميل", async () => {
    const store = seedCompetitionStore()
    // مسابقةُ المربع الثاني: مسجدُ عمر تحت المربع السابع ⇒ لا احتواء.
    const competition = seedCompetition(store, { unitId: "sq2" })
    const ep = makeCompetitionEndpoints(store)
    const done = await ep.publicEnroll.invoke(
      { ...requestFor(competition.id), mosquePath: OMAR_PATH },
      canonicalActor("u-amir"),
      WRITE,
    )
    if (!done.ok) throw new Error(done.decision.reason)
    expect(done.value.accepted).toBe(false)
    expect(done.value.reason).toBe("MOSQUE_OUT_OF_COMPETITION_SCOPE")
  })

  it("**ومسابقةٌ مجهولةٌ تُردّ بلا كشفِ وجودٍ من عدمه** — ولا صفَّ يُكتب", async () => {
    const store = seedCompetitionStore()
    const ep = makeCompetitionEndpoints(store)
    const done = await ep.publicEnroll.invoke(
      requestFor("لا-وجود-لها"),
      canonicalActor("u-amir"),
      WRITE,
    )
    if (!done.ok) throw new Error(done.decision.reason)
    expect(done.value.accepted).toBe(false)
    expect(done.value.reason).toBe("UNKNOWN_COMPETITION")
    expect(store.enrollments()).toHaveLength(0)
  })

  it("**والتكرارُ يُمنع من الحدّ**: نفسُ (الاسم + الهاتف) في المسابقة نفسِها مرّتين", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const ep = makeCompetitionEndpoints(store)
    const actor = canonicalActor("u-amir")
    const first = await ep.publicEnroll.invoke(requestFor(competition.id), actor, WRITE)
    const second = await ep.publicEnroll.invoke(requestFor(competition.id), actor, WRITE)
    if (!first.ok || !second.ok) throw new Error("رُفض الاستدعاءُ العامُّ")
    expect(first.value.accepted).toBe(true)
    expect(second.value.accepted).toBe(false)
    expect(second.value.reason).toBe("DUPLICATE_ENROLLMENT")
    expect(store.enrollments()).toHaveLength(1)
  })

  it("**وسنٌّ خارج فئات المسابقة يُرفض عند الحدّ** — لا طلبَ لا يمكن قبولُه أصلاً", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const ep = makeCompetitionEndpoints(store)
    const done = await ep.publicEnroll.invoke(
      { ...requestFor(competition.id), birthDate: new Date("2020-01-01T00:00:00.000Z") },
      canonicalActor("u-amir"),
      WRITE,
    )
    if (!done.ok) throw new Error(done.decision.reason)
    expect(done.value.accepted).toBe(false)
    expect(done.value.reason).toBe("AGE_OUT_OF_CATEGORIES")
  })
})

describe("قب-١٣/٥ — المسارُ العامُّ **بلا هوية**: يقبل مجهولاً ولا يُسائله عن قدرة", () => {
  it("فاعلٌ بلا أيّ تكليفٍ يمرّ (لا قدرةَ تُفحص)، **والحسابُ الموقوفُ كذلك** — الحارسُ في الضوابط", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const ep = makeCompetitionEndpoints(store)
    const stranger = { ...canonicalActor("u-student"), assignments: [], accountStatus: "suspended" as const }
    const done = await ep.publicEnroll.invoke(requestFor(competition.id), stranger, WRITE)
    expect(done.ok).toBe(true)
    if (done.ok) expect(done.value.accepted).toBe(true)
  })

  it("**ونيّتُه كتابةٌ لا قراءة** — فهو بابُ إدخالٍ لا نافذةُ اطّلاع", () => {
    const store = seedCompetitionStore()
    const ep = makeCompetitionEndpoints(store)
    expect(ep.publicEnroll.declaration.intent).toBe("write")
    expect(ep.publicEnroll.declaration.audit).toBe("competition.publicEnroll")
  })
})

describe("قب-٤٥ — «يُنشَر ولا يُكشَف»: لا منفذَ قراءةٍ عامٍّ إطلاقاً", () => {
  it("**كلُّ مسارٍ عامٍّ في النظام كاتبٌ** — فلا طريقَ من الخارج إلى الداخل أصلاً", () => {
    const store = seedCompetitionStore()
    makeCompetitionEndpoints(store)
    const publicFns = registeredServerFns()
      .map((fn) => fn.declaration)
      .filter((d) => d.capability === "PUBLIC_DECLARED")
    expect(publicFns.length).toBeGreaterThan(0)
    for (const d of publicFns) {
      expect(d.intent, `${d.name} مسارٌ عامٌّ قارئ — نقضٌ لقب-٤٥`).toBe("write")
    }
  })

  it("**ولا سطحَ قراءةٍ للمقتطف المُعلَن** بلا قدرة — الإعلانُ دفعٌ باتجاهٍ واحد", () => {
    const store = seedCompetitionStore()
    const ep = makeCompetitionEndpoints(store)
    const readers = Object.values(ep)
      .map((fn) => fn.declaration)
      .filter((d) => d.intent === "read")
    expect(readers.length).toBeGreaterThan(0)
    for (const d of readers) {
      expect(d.capability, `${d.name} يقرأ بلا قدرة`).not.toBe("PUBLIC_DECLARED")
    }
  })
})

describe("قب-١٣ — المنفذُ نفسُه يعمل بلا خادم (دفاعٌ في العمق)", () => {
  it("`submit` يعيد الإيصالَ نفسَه ويكتب صفّاً واحداً — فالحارسُ في المنفذ لا في الغلاف", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const port = makePublicEnrollPort(store)
    const receipt = port.submit(competitionContext("public"), requestFor(competition.id))
    expect(receipt.accepted).toBe(true)
    expect(store.enrollments()).toHaveLength(1)
  })
})
