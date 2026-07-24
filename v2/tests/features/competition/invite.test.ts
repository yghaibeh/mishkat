/**
 * **قناةُ الدعوة** — زيادةُ المالك على ت-٣ (قب-١٣ §٨): قناتا التحاقٍ لا واحدة، الرابطُ العامّ
 * **للتغطية** ورمزُ الدعوة **للانضباط** (عقدُ الوحدة §٥).
 *
 * والاختبارُ الإلزاميّ: **الدعوةُ لا تتكرر ولا تُستعمل مرتين** — فأربعةُ ثوابتٍ تُقاس هنا:
 * منسوبةٌ لمُصدِرها · منتهيةُ الصلاحية · قابلةٌ للإبطال · **أحاديّةُ الاستعمال**.
 * ومعها **الفهرسُ الواحد** الذي تلتقي عنده القنواتُ الثلاث فلا يصير الشخصُ متباريَين.
 */
import { describe, it, expect } from "vitest"
import { issueInvite, revokeInvite } from "../../../src/features/competition/services/invites.js"
import {
  addByInvite,
  addByLeader,
  approveEnrollment,
  submitPublicEnrollment,
} from "../../../src/features/competition/services/enrollment.js"
import {
  BILAL_PATH,
  competitionContext,
  DAY_MS,
  KHALID_PATH,
  NOW,
  OMAR_PATH,
  seedCompetition,
  seedCompetitionStore,
} from "./_seed.js"

const EXPIRES = new Date(NOW.getTime() + 7 * DAY_MS)

function applicant(over: { readonly nameAr?: string; readonly phone?: string } = {}) {
  return {
    nameAr: over.nameAr ?? "خالدُ بنُ سعيد",
    phone: over.phone ?? "0977777777",
    birthDate: new Date("2003-06-01T00:00:00.000Z"),
  }
}

function issued(store = seedCompetitionStore()) {
  const competition = seedCompetition(store)
  const done = issueInvite(store, competitionContext("u-amir"), {
    competitionId: competition.id,
    mosquePath: KHALID_PATH,
    expiresAt: EXPIRES,
  })
  if (!done.ok) throw new Error(done.error.code)
  return { store, competition, invite: done.value }
}

describe("§٥-٢ — الرمزُ **هويةٌ** منسوبةٌ لمُصدِره ومسجدِه", () => {
  it("الرمزُ يحمل مُصدِرَه ومسجدَه ومسابقتَه — فالطلبُ الواردُ منه **موسومٌ «مدعو»**", () => {
    const { store, invite } = issued()
    expect(invite.issuedBy).toBe("u-amir")
    expect(invite.mosquePath).toBe(KHALID_PATH)
    expect(invite.usedAt).toBeNull()
    expect(invite.revokedAt).toBeNull()
    void store
  })

  it("**والمسجدُ من الرمز المخزَّن لا من مدخل العميل** (يقتل صنف خ)", () => {
    const { store, invite } = issued()
    const done = addByInvite(store, competitionContext("u-amir"), {
      inviteId: invite.id,
      ...applicant(),
    })
    if (!done.ok) throw new Error(done.error.code)
    expect(done.value.mosquePath).toBe(KHALID_PATH)
    const enrollment = store.enrollments()[0]
    expect(enrollment?.channel).toBe("invite")
    expect(enrollment?.invited).toBe(true)
    expect(enrollment?.state).toBe("active")
  })

  it("**والإصدارُ هو الموافقة**: الملتحقُ بالدعوة **مشاركٌ فوراً** لا مقدَّماً", () => {
    const { store, invite } = issued()
    const done = addByInvite(store, competitionContext("u-amir"), {
      inviteId: invite.id,
      ...applicant(),
    })
    expect(done.ok).toBe(true)
    expect(store.contestants()).toHaveLength(1)
    expect(store.enrollments().filter((e) => e.state === "requested")).toHaveLength(0)
  })

  it("**ويبقى مدقَّقاً**: مَن دعا ومَن قبِل ومتى — أثرٌ لا يُمحى", () => {
    const { store, invite } = issued()
    addByInvite(store, competitionContext("u-amir"), { inviteId: invite.id, ...applicant() })
    const used = store.getInvite(invite.id)
    const enrollment = store.enrollments()[0]
    expect(used?.issuedBy).toBe("u-amir")
    expect(used?.usedAt).not.toBeNull()
    expect(used?.usedByEnrollmentId).toBe(enrollment?.id)
    expect(enrollment?.decidedBy).toBe("u-amir")
    expect(enrollment?.decidedAt).not.toBeNull()
  })
})

describe("§٥-٢ — **الرمزُ يُستعمل مرّةً واحدة** (الثابتُ الإلزاميّ)", () => {
  it("**الدعوةُ لا تُستعمل مرتين**: الاستعمالُ الثاني ⇒ `INVITE_ALREADY_USED` وصفرُ متبارٍ ثانٍ", () => {
    const { store, invite } = issued()
    const first = addByInvite(store, competitionContext("u-amir"), {
      inviteId: invite.id,
      ...applicant({ nameAr: "الأول", phone: "0910000011" }),
    })
    expect(first.ok).toBe(true)

    const second = addByInvite(store, competitionContext("u-amir"), {
      inviteId: invite.id,
      ...applicant({ nameAr: "الثاني", phone: "0910000012" }),
    })
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.error.code).toBe("INVITE_ALREADY_USED")
    expect(store.contestants()).toHaveLength(1)
  })

  it("**ورمزٌ منتهي الصلاحية مرفوض** — التوقيتُ شرطُ الرمز لا زينتُه", () => {
    const { store, invite } = issued()
    const late = competitionContext("u-amir", { now: new Date(EXPIRES.getTime() + DAY_MS) })
    const done = addByInvite(store, late, { inviteId: invite.id, ...applicant() })
    expect(done.ok).toBe(false)
    if (!done.ok) expect(done.error.code).toBe("INVITE_EXPIRED")
    expect(store.contestants()).toHaveLength(0)
  })

  it("**ورمزٌ مُبطَلٌ مرفوض** — قابليةُ الإبطال شرطُ الرمز (كرمز وليّ الأمر)", () => {
    const { store, invite } = issued()
    const revoked = revokeInvite(store, competitionContext("u-amir"), { inviteId: invite.id })
    expect(revoked.ok).toBe(true)
    const done = addByInvite(store, competitionContext("u-amir"), {
      inviteId: invite.id,
      ...applicant(),
    })
    expect(done.ok).toBe(false)
    if (!done.ok) expect(done.error.code).toBe("INVITE_REVOKED")
  })

  it("**وإبطالُ رمزٍ مستعمَلٍ لا يُحيي استعمالَه** — الأثرُ لا يُعكَس بالإبطال", () => {
    const { store, invite } = issued()
    addByInvite(store, competitionContext("u-amir"), { inviteId: invite.id, ...applicant() })
    revokeInvite(store, competitionContext("u-amir"), { inviteId: invite.id })
    expect(store.contestants()).toHaveLength(1)
  })

  it("**ورمزٌ مجهولٌ** ⇒ `UNKNOWN_INVITE`، **وصلاحيةٌ في الماضي** ترفض الإصدارَ من الأصل", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const unknown = addByInvite(store, competitionContext("u-amir"), {
      inviteId: "لا-وجود-له",
      ...applicant(),
    })
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.error.code).toBe("UNKNOWN_INVITE")

    const stale = issueInvite(store, competitionContext("u-amir"), {
      competitionId: competition.id,
      mosquePath: KHALID_PATH,
      expiresAt: new Date(NOW.getTime() - DAY_MS),
    })
    expect(stale.ok).toBe(false)
    if (!stale.ok) expect(stale.error.code).toBe("INVITE_EXPIRED")
  })

  it("**ولا يُصدَر رمزٌ لمسجدٍ خارج نطاق المسابقة** — النطاقُ من الوحدة المخزَّنة", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store, { unitId: "sq2" })
    const done = issueInvite(store, competitionContext("u-amir-omar"), {
      competitionId: competition.id,
      mosquePath: OMAR_PATH,
      expiresAt: EXPIRES,
    })
    expect(done.ok).toBe(false)
    if (!done.ok) expect(done.error.code).toBe("MOSQUE_OUT_OF_COMPETITION_SCOPE")
  })
})

describe("§٥-٣ — **الدعوةُ لا تتكرر**: فهرسٌ واحدٌ تلتقي عنده القنواتُ الثلاث", () => {
  it("**دعوتان لشخصٍ واحدٍ لا تُنتجان متباريَين** — الفهرسُ `(المسابقة، الشخص)` يمنعه", () => {
    const { store, competition } = issued()
    const second = issueInvite(store, competitionContext("u-amir"), {
      competitionId: competition.id,
      mosquePath: KHALID_PATH,
      expiresAt: EXPIRES,
    })
    if (!second.ok) throw new Error(second.error.code)

    const person = applicant({ nameAr: "معاذُ بنُ جبل", phone: "0988888888" })
    const first = addByInvite(store, competitionContext("u-amir"), {
      inviteId: store.invites()[0]!.id,
      ...person,
    })
    expect(first.ok).toBe(true)

    const again = addByInvite(store, competitionContext("u-amir"), {
      inviteId: second.value.id,
      ...person,
    })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.code).toBe("DUPLICATE_ENROLLMENT")
    expect(store.contestants()).toHaveLength(1)
  })

  it("**والقناتان تلتقيان عند الفهرس نفسِه**: طلبٌ عامٌّ مقبول ثم دعوةٌ للشخص نفسِه ⇒ مرفوضة", () => {
    const { store, competition, invite } = issued()
    const person = applicant({ nameAr: "أنسُ بنُ مالك", phone: "0999999999" })
    const submitted = submitPublicEnrollment(store, competitionContext("public"), {
      competitionId: competition.id,
      mosquePath: KHALID_PATH,
      ...person,
    })
    if (!submitted.ok) throw new Error(submitted.error.code)
    const approved = approveEnrollment(store, competitionContext("u-amir"), {
      enrollmentId: submitted.value.id,
    })
    expect(approved.ok).toBe(true)

    const invited = addByInvite(store, competitionContext("u-amir"), {
      inviteId: invite.id,
      ...person,
    })
    expect(invited.ok).toBe(false)
    if (!invited.ok) expect(invited.error.code).toBe("DUPLICATE_ENROLLMENT")
  })

  it("**ومسارُ القائد المباشر يلتقي عنده كذلك** — الشخصُ متبارٍ واحدٌ أياً كانت قناتُه", () => {
    const { store, competition, invite } = issued()
    const person = applicant({ nameAr: "زيدُ بنُ ثابت", phone: "0966666666" })
    const direct = addByLeader(store, competitionContext("u-amir"), {
      competitionId: competition.id,
      mosquePath: KHALID_PATH,
      ...person,
    })
    expect(direct.ok).toBe(true)
    const invited = addByInvite(store, competitionContext("u-amir"), {
      inviteId: invite.id,
      ...person,
    })
    expect(invited.ok).toBe(false)
    if (!invited.ok) expect(invited.error.code).toBe("DUPLICATE_ENROLLMENT")
  })

  it("**والمرفوضُ لا يقفل الباب**: مَن رُفض يعيد التقديمَ (الفهرسُ على غير المرفوضة)", async () => {
    const { store, competition } = issued()
    const person = applicant({ nameAr: "سهلُ بنُ حنيف", phone: "0955555555" })
    const submitted = submitPublicEnrollment(store, competitionContext("public"), {
      competitionId: competition.id,
      mosquePath: KHALID_PATH,
      ...person,
    })
    if (!submitted.ok) throw new Error(submitted.error.code)
    const { rejectEnrollment } = await import(
      "../../../src/features/competition/services/enrollment.js"
    )
    const rejected = rejectEnrollment(store, competitionContext("u-amir"), {
      enrollmentId: submitted.value.id,
      reason: "السنُّ خارج الفئة المعلنة",
    })
    expect(rejected.ok).toBe(true)

    const again = submitPublicEnrollment(store, competitionContext("public"), {
      competitionId: competition.id,
      mosquePath: KHALID_PATH,
      ...person,
    })
    expect(again.ok).toBe(true)
  })

  it("**وشخصان مختلفان بمسجدين يمرّان** — الفهرسُ يمنع التكرارَ لا المشاركة", () => {
    const { store, competition } = issued()
    for (const [i, mosquePath] of [KHALID_PATH, BILAL_PATH].entries()) {
      const done = addByLeader(store, competitionContext("u-amir"), {
        competitionId: competition.id,
        mosquePath,
        ...applicant({ nameAr: `مشاركٌ ${i}`, phone: `093300000${i}` }),
      })
      expect(done.ok, mosquePath).toBe(true)
    }
    expect(store.contestants()).toHaveLength(2)
  })
})

describe("§٥-١ — **ولا مسارَ رابع**: بابُ «المشترِك اليتيم» مغلقٌ بنيوياً", () => {
  it("قنواتُ الالتحاق **ثلاثٌ معلنةٌ** لا رابعَ لها في النوع نفسِه", () => {
    const { store, competition, invite } = issued()
    addByInvite(store, competitionContext("u-amir"), {
      inviteId: invite.id,
      ...applicant({ nameAr: "مدعوّ", phone: "0900000101" }),
    })
    addByLeader(store, competitionContext("u-amir"), {
      competitionId: competition.id,
      mosquePath: KHALID_PATH,
      ...applicant({ nameAr: "مضافٌ", phone: "0900000102" }),
    })
    submitPublicEnrollment(store, competitionContext("public"), {
      competitionId: competition.id,
      mosquePath: KHALID_PATH,
      ...applicant({ nameAr: "متقدّمٌ", phone: "0900000103" }),
    })
    const channels = new Set(store.enrollments().map((e) => e.channel))
    expect([...channels].sort()).toEqual(["amir_added", "invite", "public_link"])
  })

  it("**وكلُّ متبارٍ له مسجدُ انتسابٍ** — فلا مشاركَ بلا مسؤولِ رصدٍ يعتمده", () => {
    const { store, competition, invite } = issued()
    addByInvite(store, competitionContext("u-amir"), { inviteId: invite.id, ...applicant() })
    addByLeader(store, competitionContext("u-amir"), {
      competitionId: competition.id,
      mosquePath: BILAL_PATH,
      ...applicant({ nameAr: "آخرُ", phone: "0900000104" }),
    })
    for (const contestant of store.contestants()) {
      expect(contestant.mosquePath.length).toBeGreaterThan(0)
      expect(contestant.competitionId).toBe(competition.id)
    }
  })
})
