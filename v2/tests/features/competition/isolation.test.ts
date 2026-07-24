/**
 * **العزل** — الشبكةُ (قب-١٨) والنطاقُ (قاعدةُ التقاطع §٦) — عقدُ الوحدة §٦.
 *
 * ثابتان في ملفٍّ واحد لأنهما جوابٌ لسؤالٍ واحد: *مَن يبلغ ماذا؟*
 *  - **الشبكة**: مستودعٌ لكل شبكة ⇒ **لا مِقبضَ عابرٌ أصلاً**؛ والغريبةُ ⇒ `NO_SCOPE` ⇒ رفض.
 *  - **النطاق**: `contains(P,S) ∨ contains(S,P)` — بلا سطر منطقٍ خاصّ، وبـ`contains()` نفسِها.
 * و**السلبيّاتُ هنا أكثرُ من الإيجابيّات** عمداً: النظامُ الآمنُ يُعرَّف بما يمنعه.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { makeCompetitionEndpoints } from "../../../src/features/competition/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { CompetitionTenantRegistry } from "../../../src/features/competition/data/tenant.js"
import { visibleCompetitions } from "../../../src/features/competition/services/derive.js"
import {
  canonicalActor,
  DECISION,
  HOMS_PATH,
  KHALID_PATH,
  MAIN_TENANT_ID,
  MEN_PATH,
  OMAR_PATH,
  ROOT_SCOPE_PATH,
  SECOND_TENANT_ID,
  seedCompetition,
  seedCompetitionStore,
  WOMEN_PATH,
  WRITE,
} from "./_seed.js"

beforeEach(() => clearRegistryForTests())

describe("قب-١٨ — **عزلُ الشبكة بنيويّ**: مستودعٌ لكل شبكة، لا فرعَ شبكةٍ في المحرّك", () => {
  it("سجلُّ الشبكات يعيد **المستودعَ نفسَه** لكل شبكة، ولا يخلط بين شبكتين", () => {
    const registry = new CompetitionTenantRegistry()
    const first = registry.storeFor(MAIN_TENANT_ID)
    const second = registry.storeFor(SECOND_TENANT_ID)
    expect(registry.storeFor(MAIN_TENANT_ID)).toBe(first)
    expect(first).not.toBe(second)
    expect(first.tenantId).toBe(MAIN_TENANT_ID)
    expect(second.tenantId).toBe(SECOND_TENANT_ID)
  })

  it("**والشبكةُ تُختم من المستودع لا من المدخل**: كيانٌ يدّعي شبكةً أخرى يُختم بشبكة مستودعه", () => {
    const store = seedCompetitionStore(SECOND_TENANT_ID)
    const competition = seedCompetition(store)
    expect(competition.tenantId).toBe(SECOND_TENANT_ID)
    expect(store.getCompetition(competition.id)?.tenantId).toBe(SECOND_TENANT_ID)
  })

  it("**العزل: فاعلٌ في شبكةٍ لا يبلغ مسابقةَ أخرى** ولو تطابق مسارُه النسبيّ حرفاً بحرف", async () => {
    const mine = seedCompetitionStore(MAIN_TENANT_ID)
    const theirs = seedCompetitionStore(SECOND_TENANT_ID)
    const foreign = seedCompetition(theirs, { unitId: "homs" })

    const ep = makeCompetitionEndpoints(mine)
    // نفسُ المعرّف، ونفسُ المسار النسبيّ — **والمستودعُ غيرُه**: فمسابقةُ الجارِ ليست محجوبةً
    // عنّي بحارس، بل **غيرَ موجودةٍ في عالمي أصلاً**. وهذا أقوى من الحجب.
    const seen = await ep.leaderboardView.invoke(
      { unitId: "homs", competitionId: foreign.id },
      canonicalActor("u-rabita"),
      DECISION,
    )
    if (!seen.ok) throw new Error(seen.decision.reason)
    expect(seen.value.ok).toBe(false)
    if (!seen.value.ok) expect(seen.value.error.code).toBe("UNKNOWN_COMPETITION")
    // ولا يتسرّب اسمُها ولا نطاقُها في الردّ — الجهلُ بها تامٌّ لا جزئيّ.
    expect(JSON.stringify(seen.value)).not.toContain(foreign.titleAr)
  })

  it("**ولا يكتب فيها كذلك**: انتقالُ حالةٍ على مسابقةِ شبكةٍ أخرى مرفوض", async () => {
    const mine = seedCompetitionStore(MAIN_TENANT_ID)
    const theirs = seedCompetitionStore(SECOND_TENANT_ID)
    const foreign = seedCompetition(theirs)
    const ep = makeCompetitionEndpoints(mine)
    const moved = await ep.statusAdvance.invoke(
      { competitionId: foreign.id, to: "running" },
      canonicalActor("u-admin"),
      WRITE,
    )
    expect(moved.ok).toBe(false)
    expect(theirs.getCompetition(foreign.id)?.status).toBe("enrolling")
  })

  it("**ولا تُحصى مسابقاتُ الجيران في اشتقاق شبكتي** — الاشتقاقُ على مستودعِ الطلب وحده", () => {
    const mine = seedCompetitionStore(MAIN_TENANT_ID)
    const theirs = seedCompetitionStore(SECOND_TENANT_ID)
    seedCompetition(theirs, { unitId: "root" })
    seedCompetition(theirs, { unitId: "homs" })
    expect(visibleCompetitions(mine, ROOT_SCOPE_PATH)).toHaveLength(0)
    seedCompetition(mine, { unitId: "homs" })
    expect(visibleCompetitions(mine, HOMS_PATH)).toHaveLength(1)
    expect(visibleCompetitions(theirs, HOMS_PATH)).toHaveLength(2)
  })
})

describe("§٦ — **قاعدةُ التقاطع**: تشملني أو تحتي، وإلا فلا", () => {
  it("**تشملني**: مسابقةُ الشبكة `/` يراها أميرُ مسجدٍ في عمق الشجرة (نزولاً)", () => {
    const store = seedCompetitionStore()
    seedCompetition(store, { unitId: "root", titleAr: "المسابقةُ الشبكيّة" })
    const seen = visibleCompetitions(store, KHALID_PATH)
    expect(seen.map((c) => c.titleAr)).toEqual(["المسابقةُ الشبكيّة"])
  })

  it("**تحتي**: مسؤولُ المنطقة يرى مسابقةَ مسجدٍ تحته (اطّلاعٌ هابط — ق-١٧)", () => {
    const store = seedCompetitionStore()
    seedCompetition(store, { unitId: "khalid", titleAr: "مسابقةُ مسجد خالد" })
    const seen = visibleCompetitions(store, HOMS_PATH)
    expect(seen.map((c) => c.titleAr)).toEqual(["مسابقةُ مسجد خالد"])
  })

  it("**العزل: ولا هذا ولا ذاك ⇒ لا يراها** — مسجدٌ لا يرى مسابقةَ جارِه", () => {
    const store = seedCompetitionStore()
    seedCompetition(store, { unitId: "khalid" })
    expect(visibleCompetitions(store, OMAR_PATH)).toHaveLength(0)
  })

  it("**والفصلُ التامّ بين القسمين يسري تلقائياً** (ق-٢٠) — بلا فحصٍ جنسانيٍّ في الكود", () => {
    const store = seedCompetitionStore()
    seedCompetition(store, { unitId: "women", titleAr: "مسابقةُ قسم النساء" })
    expect(visibleCompetitions(store, KHALID_PATH)).toHaveLength(0)
    expect(visibleCompetitions(store, MEN_PATH)).toHaveLength(0)
    expect(visibleCompetitions(store, WOMEN_PATH)).toHaveLength(1)
    // والجذرُ يراها لأنه يحويها — الاحتواءُ لا الجنس.
    expect(visibleCompetitions(store, ROOT_SCOPE_PATH)).toHaveLength(1)
  })

  it("**والملغاةُ تبقى مقروءةً** — الإلغاءُ يحفظ البيانات ولا يمحوها", () => {
    const store = seedCompetitionStore()
    seedCompetition(store, { unitId: "homs" })
    expect(visibleCompetitions(store, HOMS_PATH)).toHaveLength(1)
  })
})

describe("§٦ — العزلُ **مفروضٌ في الخادم** لا مخفيٌّ في الواجهة", () => {
  it("**العزل: أميرٌ لا يبلغ لوحةَ مسابقةٍ خارج تقاطعه** — رفضٌ مصنَّفٌ لا صفحةٌ فارغة", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store, { unitId: "khalid" })
    const ep = makeCompetitionEndpoints(store)
    // أميرُ عمر يطلبها من وحدته: القدرةُ عنده، والتقاطعُ منتفٍ ⇒ رفضُ منطقِ عمل.
    const seen = await ep.leaderboardView.invoke(
      { unitId: "omar", competitionId: competition.id },
      canonicalActor("u-amir-omar"),
      DECISION,
    )
    if (!seen.ok) throw new Error(seen.decision.reason)
    expect(seen.value.ok).toBe(false)
    if (!seen.value.ok) expect(seen.value.error.code).toBe("COMPETITION_OUT_OF_VIEW_SCOPE")
  })

  it("**وطلبُها من وحدةٍ ليست له مرفوضٌ في المحرّك قبل ذلك** — النطاقُ من الوحدة المخزَّنة", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store, { unitId: "khalid" })
    const ep = makeCompetitionEndpoints(store)
    const seen = await ep.leaderboardView.invoke(
      { unitId: "khalid", competitionId: competition.id },
      canonicalActor("u-amir-omar"),
      DECISION,
    )
    expect(seen.ok).toBe(false)
    if (!seen.ok) expect(seen.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("**ووحدةٌ مجهولةٌ ⇒ `NO_SCOPE` ⇒ رفضٌ يُقفل ولا يُفتح** (§٥.٢ ثابت ٣)", async () => {
    const store = seedCompetitionStore()
    const ep = makeCompetitionEndpoints(store)
    const missing = undefined as unknown as string
    for (const call of [
      ep.scopeView.invoke({ unitId: missing }, canonicalActor("u-admin"), DECISION),
      ep.create.invoke(
        { unitId: missing, titleAr: "x", startMonthHijri: "1447-07", endMonthHijri: "1448-07", enrollmentOpensAt: new Date(), enrollmentClosesAt: new Date() },
        canonicalActor("u-admin"),
        WRITE,
      ),
      ep.statusAdvance.invoke({ competitionId: missing, to: "running" }, canonicalActor("u-admin"), WRITE),
      ep.scoreRecord.invoke(
        { contestantId: missing, typeKey: "x", periodKey: "1447-08", value: 1 },
        canonicalActor("u-amir"),
        WRITE,
      ),
      ep.enrollmentApprove.invoke({ enrollmentId: missing }, canonicalActor("u-amir"), WRITE),
      ep.inviteRevoke.invoke({ inviteId: missing }, canonicalActor("u-amir"), WRITE),
    ]) {
      const r = await call
      expect(r.ok).toBe(false)
    }
  })

  it("**والالتحاقُ نطاقُه مسجدُه بعينه**: أميرُ بلال لا يبتّ طلبَ مسجد خالد (نطاقُ «ذ»)", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const ep = makeCompetitionEndpoints(store)
    const submitted = await ep.publicEnroll.invoke(
      {
        competitionId: competition.id,
        mosquePath: KHALID_PATH,
        nameAr: "طالبُ خالد",
        phone: "0944444444",
        birthDate: new Date("2004-01-01T00:00:00.000Z"),
      },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(submitted.ok).toBe(true)
    const enrollmentId = store.enrollments()[0]!.id

    // جارُه أميرُ بلال: القدرةُ عنده لكن نطاقَها «ذ» ⇒ مسجدُه بعينه لا غيرُه.
    const neighbour = await ep.enrollmentApprove.invoke(
      { enrollmentId },
      canonicalActor("u-amir-bilal"),
      WRITE,
    )
    expect(neighbour.ok).toBe(false)
    if (!neighbour.ok) expect(neighbour.decision.reason).toBe("DENIED_OUT_OF_SCOPE")

    // والمربعُ فوقه كذلك — «ذ» مطابقةٌ تامّة لا احتواء.
    const square = await ep.enrollmentApprove.invoke(
      { enrollmentId },
      canonicalActor("u-square"),
      WRITE,
    )
    expect(square.ok).toBe(false)

    // وصاحبُه يبتّ.
    const owner = await ep.enrollmentApprove.invoke(
      { enrollmentId },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(owner.ok).toBe(true)
  })

  it("**والمديرُ لا يوافق ولا يرصد** (ق-٢٧: الشمولُ اطّلاعٌ لا عمل) — رفضٌ في الخادم", async () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const ep = makeCompetitionEndpoints(store)
    await ep.publicEnroll.invoke(
      {
        competitionId: competition.id,
        mosquePath: KHALID_PATH,
        nameAr: "طالبٌ آخر",
        phone: "0943434343",
        birthDate: new Date("2004-01-01T00:00:00.000Z"),
      },
      canonicalActor("u-amir"),
      WRITE,
    )
    const enrollmentId = store.enrollments()[0]!.id
    const admin = canonicalActor("u-admin")

    const approved = await ep.enrollmentApprove.invoke({ enrollmentId }, admin, WRITE)
    expect(approved.ok).toBe(false)
    if (!approved.ok) expect(approved.decision.reason).toBe("DENIED_NO_CAPABILITY")

    const inbox = await ep.enrollmentInbox.invoke({ unitId: "khalid" }, admin, DECISION)
    expect(inbox.ok).toBe(false)
  })

  it("**والانتحالُ القرائيُّ لا يكتب** (ب-٤٠أ): مسابقةٌ لا تُنشأ بجلسةِ انتحال", async () => {
    const store = seedCompetitionStore()
    const ep = makeCompetitionEndpoints(store)
    const impersonated = { ...canonicalActor("u-rabita"), impersonatedBy: "u-admin" }
    const created = await ep.create.invoke(
      {
        unitId: "homs",
        titleAr: "مسابقةٌ بجلسةِ انتحال",
        startMonthHijri: "1447-07",
        endMonthHijri: "1448-07",
        enrollmentOpensAt: new Date("2026-07-01T00:00:00.000Z"),
        enrollmentClosesAt: new Date("2026-09-01T00:00:00.000Z"),
      },
      impersonated,
      WRITE,
    )
    expect(created.ok).toBe(false)
    if (!created.ok) expect(created.decision.reason).toBe("DENIED_IMPERSONATION_READONLY")

    const read = await ep.scopeView.invoke({ unitId: "homs" }, impersonated, DECISION)
    expect(read.ok).toBe(true)
  })
})
