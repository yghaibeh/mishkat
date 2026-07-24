/**
 * **آلةُ الحالات والكتالوجُ والفئاتُ والقنواتُ** — عقدُ الوحدة §١ و§٥-١ و§٧-٢.
 *
 * الثابتُ الأول: **الانتقالاتُ أماميّةٌ فقط عدا الإلغاء** — و«العودةُ للخلف **غيرُ موجودة**»:
 * لا دالةَ لها أصلاً، فالمنعُ بغياب المِقبض لا بالفحص.
 * والثاني: **الكتالوجُ بياناتٌ** — نوعُ تنقيطٍ جديد يُضاف **صفّاً فيعمل بلا سطر كود** (قب-٢٢).
 */
import { describe, it, expect } from "vitest"
import {
  advanceStatus,
  cancelCompetition,
  createCompetition,
  declareAward,
  defineCategory,
  defineStage,
} from "../../../src/features/competition/services/competitions.js"
import { defineScoringType } from "../../../src/features/competition/services/catalog.js"
import {
  addByLeader,
  approveEnrollment,
  inboxOf,
  rejectEnrollment,
  submitPublicEnrollment,
} from "../../../src/features/competition/services/enrollment.js"
import { recordScore } from "../../../src/features/competition/services/scoring.js"
import {
  BILAL_PATH,
  competitionContext,
  END_MONTH,
  KHALID_PATH,
  PERIOD,
  seedCompetition,
  seedCompetitionStore,
  seedScoringType,
  START_MONTH,
  WINDOW_CLOSES,
  WINDOW_OPENS,
} from "./_seed.js"

function baseInput(unitId = "homs") {
  return {
    unitId,
    titleAr: "مسابقةُ المسجد المؤثّر",
    startMonthHijri: START_MONTH,
    endMonthHijri: END_MONTH,
    enrollmentOpensAt: WINDOW_OPENS,
    enrollmentClosesAt: WINDOW_CLOSES,
  }
}

describe("§١ — الإنشاء: **نطاقُها الوحدةُ المخزَّنة**، ومعها فئةُ «عام» تلقائياً", () => {
  it("المسابقةُ تُنشأ مسودةً بنطاق وحدتها، **وبفئةٍ واحدةٍ تسع الجميع** (فالبسيطُ يبقى بسيطاً)", () => {
    const store = seedCompetitionStore()
    const done = createCompetition(store, competitionContext("u-rabita"), baseInput())
    if (!done.ok) throw new Error(done.error.code)
    expect(done.value.status).toBe("draft")
    expect(done.value.scopePath).toBe("/men/homs/")
    expect(done.value.subjectType).toBe("person")
    const categories = store.categories().filter((c) => c.competitionId === done.value.id)
    expect(categories).toHaveLength(1)
  })

  it("**وحدَّا سنّ الفئة الافتراضيان من سجل الإعدادات** (`competition.min_age`/`max_age`)", () => {
    const store = seedCompetitionStore()
    const done = createCompetition(store, competitionContext("u-rabita"), baseInput())
    if (!done.ok) throw new Error(done.error.code)
    const general = store.categories().find((c) => c.competitionId === done.value.id)
    expect(general?.ageMin).toBe(15)
    expect(general?.ageMax).toBe(40)
  })

  it("**وعنوانٌ فارغٌ ونافذةٌ مقلوبةٌ ووحدةٌ مجهولةٌ** تُردّ بأسبابٍ مميِّزة", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-rabita")

    const empty = createCompetition(store, ctx, { ...baseInput(), titleAr: "   " })
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.error.code).toBe("EMPTY_TITLE")

    const inverted = createCompetition(store, ctx, {
      ...baseInput(),
      enrollmentOpensAt: WINDOW_CLOSES,
      enrollmentClosesAt: WINDOW_OPENS,
    })
    expect(inverted.ok).toBe(false)
    if (!inverted.ok) expect(inverted.error.code).toBe("ENROLLMENT_WINDOW_CLOSED")

    const unknown = createCompetition(store, ctx, baseInput("لا-وجود-لها"))
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.error.code).toBe("UNKNOWN_UNIT")
  })

  it("**والفرقُ والوحداتُ مرفوضةٌ حتى يُعتمد مفتاحُهما** (قب-٧) — مبنيٌّ معطَّلٌ لا مسكوتٌ عنه", () => {
    const store = seedCompetitionStore()
    for (const subjectType of ["team", "unit"] as const) {
      const done = createCompetition(store, competitionContext("u-rabita"), {
        ...baseInput(),
        subjectType,
      })
      expect(done.ok, subjectType).toBe(false)
      if (!done.ok) expect(done.error.code).toBe("SUBJECT_TYPE_NOT_ENABLED")
    }
  })

  it("**ومسابقاتٌ متعدّدةٌ متزامنةٌ تعمل معاً** — لا مفهومَ «المسابقة النشطة الواحدة» أصلاً", () => {
    const store = seedCompetitionStore()
    const annual = seedCompetition(store, { unitId: "root", titleAr: "السنويّةُ الشبكيّة" })
    const local = seedCompetition(store, { unitId: "khalid", titleAr: "الرمضانيّةُ لمسجد خالد" })
    expect(annual.id).not.toBe(local.id)
    expect(store.competitions()).toHaveLength(2)
  })
})

describe("§١ — آلةُ الحالات: **أماميّةٌ فقط**، والرجوعُ لا دالةَ له", () => {
  it("السلسلةُ المعلنة تمرّ: مسودة ← تسجيل ← جارية ← تصفية ← مغلقة", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-rabita")
    let current = seedCompetition(store, { advanceTo: [] })
    for (const to of ["enrolling", "running", "qualifying", "closed"] as const) {
      const moved = advanceStatus(store, ctx, { competitionId: current.id, to })
      if (!moved.ok) throw new Error(`${to}: ${moved.error.code}`)
      current = moved.value
      expect(current.status).toBe(to)
    }
  })

  it("**والقفزُ والرجوعُ مرفوضان** ⇒ `ILLEGAL_TRANSITION` (نزاهةُ الأثر المدقَّق)", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-rabita")
    const draft = seedCompetition(store, { advanceTo: [] })

    const leap = advanceStatus(store, ctx, { competitionId: draft.id, to: "closed" })
    expect(leap.ok).toBe(false)
    if (!leap.ok) expect(leap.error.code).toBe("ILLEGAL_TRANSITION")

    const running = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const back = advanceStatus(store, ctx, { competitionId: running.id, to: "enrolling" })
    expect(back.ok).toBe(false)
    if (!back.ok) expect(back.error.code).toBe("ILLEGAL_TRANSITION")
  })

  it("**والمغلقةُ لا تُفتح**: كلُّ انتقالٍ بعد الإغلاق مرفوض", () => {
    const store = seedCompetitionStore()
    const closed = seedCompetition(store, {
      advanceTo: ["enrolling", "running", "qualifying", "closed"],
    })
    for (const to of ["enrolling", "running", "qualifying"] as const) {
      const moved = advanceStatus(store, competitionContext("u-rabita"), {
        competitionId: closed.id,
        to,
      })
      expect(moved.ok, to).toBe(false)
    }
  })

  it("**والإلغاءُ يلزمه سببٌ نصّيّ**، ويحفظ البيانات ولا يمحوها", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-rabita")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })

    const bare = cancelCompetition(store, ctx, { competitionId: competition.id, reason: "  " })
    expect(bare.ok).toBe(false)
    if (!bare.ok) expect(bare.error.code).toBe("EMPTY_REASON")

    const done = cancelCompetition(store, ctx, {
      competitionId: competition.id,
      reason: "تأجيلٌ لظرفٍ ميدانيّ",
    })
    if (!done.ok) throw new Error(done.error.code)
    expect(done.value.status).toBe("cancelled")
    expect(done.value.cancelReason).toBe("تأجيلٌ لظرفٍ ميدانيّ")
    expect(store.getCompetition(competition.id)).not.toBeNull()
  })

  it("**والملغاةُ لا تُكتب**: إلغاءٌ ثانٍ وانتقالٌ بعده مرفوضان", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-rabita")
    const competition = seedCompetition(store)
    cancelCompetition(store, ctx, { competitionId: competition.id, reason: "سببٌ معلن" })
    const again = cancelCompetition(store, ctx, {
      competitionId: competition.id,
      reason: "سببٌ ثانٍ",
    })
    expect(again.ok).toBe(false)
    const moved = advanceStatus(store, ctx, { competitionId: competition.id, to: "running" })
    expect(moved.ok).toBe(false)
  })

  it("**ومسابقةٌ مجهولةٌ** في كل مِقبضٍ ⇒ `UNKNOWN_COMPETITION` (دفاعٌ في العمق تحت النطاق)", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-rabita")
    const calls = [
      advanceStatus(store, ctx, { competitionId: "لا-وجود-لها", to: "running" }),
      cancelCompetition(store, ctx, { competitionId: "لا-وجود-لها", reason: "سبب" }),
      defineCategory(store, ctx, { competitionId: "لا-وجود-لها", titleAr: "فئة" }),
      defineStage(store, ctx, {
        competitionId: "لا-وجود-لها",
        order: 1,
        titleAr: "تمهيديّ",
        advancement: { basis: "category", take: { topN: 10 } },
      }),
      declareAward(store, ctx, {
        competitionId: "لا-وجود-لها",
        titleAr: "الجائزةُ الكبرى",
        kind: "honorary",
      }),
    ]
    for (const call of calls) {
      expect(call.ok).toBe(false)
      if (!call.ok) expect(call.error.code).toBe("UNKNOWN_COMPETITION")
    }
  })
})

describe("§١ — الفئاتُ: الترتيبُ داخلها، والسنُّ يُثبَّت عند الالتحاق", () => {
  it("فئتان عمريّتان تُضافان، **والسنُّ يُحتسب عند الالتحاق ويُثبَّت** فلا يقفز أحدٌ فئةً", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const done = defineCategory(store, competitionContext("u-rabita"), {
      competitionId: competition.id,
      titleAr: "١٥–٢٥",
      ageMin: 15,
      ageMax: 25,
    })
    expect(done.ok).toBe(true)

    const contestant = addByLeader(store, competitionContext("u-amir"), {
      competitionId: competition.id,
      mosquePath: KHALID_PATH,
      nameAr: "شابٌّ ابنُ اثنتين وعشرين",
      phone: "0912121212",
      birthDate: new Date("2004-01-01T00:00:00.000Z"),
    })
    if (!contestant.ok) throw new Error(contestant.error.code)
    expect(contestant.value.ageAtEnrollment).toBe(22)
  })

  it("**وحدّا سنٍّ مقلوبان مرفوضان** — الفئةُ حدٌّ لا لغز", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const done = defineCategory(store, competitionContext("u-rabita"), {
      competitionId: competition.id,
      titleAr: "فئةٌ مقلوبة",
      ageMin: 40,
      ageMax: 15,
    })
    expect(done.ok).toBe(false)
    if (!done.ok) expect(done.error.code).toBe("INVALID_AGE_RANGE")
  })

  it("**ومَن لا تسعه فئةٌ لا يلتحق** — يُرفض عند الحدّ لا بعد الإدخال", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const done = addByLeader(store, competitionContext("u-amir"), {
      competitionId: competition.id,
      mosquePath: KHALID_PATH,
      nameAr: "طفلٌ صغير",
      phone: "0913131313",
      birthDate: new Date("2020-01-01T00:00:00.000Z"),
    })
    expect(done.ok).toBe(false)
    if (!done.ok) expect(done.error.code).toBe("AGE_OUT_OF_CATEGORIES")
  })
})

describe("§٧-٢ — الكتالوجُ **بياناتٌ**: نوعٌ يُضاف صفّاً فيعمل بلا سطر كود (قب-٢٢)", () => {
  it("**مرفوضٌ ⟵ يُضاف صفّاً ⟵ مقبولٌ فوراً** بلا تغيير سطرٍ واحد", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const competition = seedCompetition(store, { advanceTo: ["enrolling", "running"] })
    const contestant = addByLeader(store, ctx, {
      competitionId: competition.id,
      mosquePath: KHALID_PATH,
      nameAr: "متبارٍ",
      phone: "0914141414",
      birthDate: new Date("2004-01-01T00:00:00.000Z"),
    })
    if (!contestant.ok) throw new Error(contestant.error.code)

    const before = recordScore(store, ctx, {
      contestantId: contestant.value.id,
      typeKey: "itikaf",
      periodKey: PERIOD,
      value: 1,
    })
    expect(before.ok).toBe(false)

    seedScoringType(store, competition.id, { key: "itikaf", valueKind: "boolean", weight: 30 })

    const after = recordScore(store, ctx, {
      contestantId: contestant.value.id,
      typeKey: "itikaf",
      periodKey: PERIOD,
      value: 1,
    })
    expect(after.ok).toBe(true)
  })

  it("**والأنواعُ الأربعة للقيمة تكفي** — أربعةُ صفوفٍ لا أربعةُ فروعٍ في الكود", () => {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    for (const valueKind of ["count", "score", "boolean", "duration"] as const) {
      const done = defineScoringType(store, competitionContext("u-rabita"), {
        competitionId: competition.id,
        key: `k_${valueKind}`,
        titleAr: `نوعُ ${valueKind}`,
        track: "أنشطة",
        valueKind,
        weight: 5,
        period: "hijri_month",
        excusable: false,
      })
      expect(done.ok, valueKind).toBe(true)
    }
    expect(store.scoringTypes().filter((t) => t.competitionId === competition.id)).toHaveLength(4)
  })

  it("**ووزنٌ سالبٌ ومفتاحٌ مكرَّرٌ مرفوضان** — الكتالوجُ بياناتٌ محكومةٌ لا فوضى", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-rabita")
    const competition = seedCompetition(store)
    const bad = defineScoringType(store, ctx, {
      competitionId: competition.id,
      key: "bad",
      titleAr: "وزنٌ سالب",
      track: "علمي",
      valueKind: "count",
      weight: -5,
      period: "hijri_month",
      excusable: false,
    })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error.code).toBe("INVALID_WEIGHT")

    seedScoringType(store, competition.id, { key: "dup" })
    const twice = defineScoringType(store, ctx, {
      competitionId: competition.id,
      key: "dup",
      titleAr: "مكرَّر",
      track: "علمي",
      valueKind: "count",
      weight: 5,
      period: "hijri_month",
      excusable: false,
    })
    expect(twice.ok).toBe(false)
  })
})

describe("§٥-١ — البتُّ: قبولٌ ورفضٌ **بسببٍ نصّيٍّ إلزاميّ** (ق-٣٢)", () => {
  function pending() {
    const store = seedCompetitionStore()
    const competition = seedCompetition(store)
    const submitted = submitPublicEnrollment(store, competitionContext("public"), {
      competitionId: competition.id,
      mosquePath: KHALID_PATH,
      nameAr: "طالبُ الالتحاق",
      phone: "0915151515",
      birthDate: new Date("2004-01-01T00:00:00.000Z"),
    })
    if (!submitted.ok) throw new Error(submitted.error.code)
    return { store, competition, enrollment: submitted.value }
  }

  it("**القبولُ يُنشئ متبارياً في فئته** ويسم الطلبَ مشاركاً بمن بتّ ومتى", () => {
    const { store, enrollment } = pending()
    const done = approveEnrollment(store, competitionContext("u-amir"), {
      enrollmentId: enrollment.id,
    })
    if (!done.ok) throw new Error(done.error.code)
    expect(done.value.mosquePath).toBe(KHALID_PATH)
    const after = store.getEnrollment(enrollment.id)
    expect(after?.state).toBe("active")
    expect(after?.decidedBy).toBe("u-amir")
    expect(after?.contestantId).toBe(done.value.id)
  })

  it("**والرفضُ بلا سببٍ مرفوض** ⇒ `EMPTY_REASON`؛ وبسببٍ يظهر للمتقدّم برمزه", () => {
    const { store, enrollment } = pending()
    const bare = rejectEnrollment(store, competitionContext("u-amir"), {
      enrollmentId: enrollment.id,
      reason: "   ",
    })
    expect(bare.ok).toBe(false)
    if (!bare.ok) expect(bare.error.code).toBe("EMPTY_REASON")

    const done = rejectEnrollment(store, competitionContext("u-amir"), {
      enrollmentId: enrollment.id,
      reason: "السنُّ خارج الفئة المعلنة",
    })
    if (!done.ok) throw new Error(done.error.code)
    expect(done.value.state).toBe("rejected")
    expect(done.value.rejectionReason).toBe("السنُّ خارج الفئة المعلنة")
    expect(done.value.followUpCode.length).toBeGreaterThan(0)
    expect(store.contestants()).toHaveLength(0)
  })

  it("**وبتٌّ ثانٍ على مبتوتٍ مرفوض** ⇒ `ALREADY_DECIDED` (لا ختمٌ ثانٍ يمحو الأول)", () => {
    const { store, enrollment } = pending()
    approveEnrollment(store, competitionContext("u-amir"), { enrollmentId: enrollment.id })
    const again = approveEnrollment(store, competitionContext("u-amir"), {
      enrollmentId: enrollment.id,
    })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.code).toBe("ALREADY_DECIDED")

    const rejected = rejectEnrollment(store, competitionContext("u-amir"), {
      enrollmentId: enrollment.id,
      reason: "سببٌ متأخّر",
    })
    expect(rejected.ok).toBe(false)
  })

  it("**وإعادةُ فحص التكرار لحظةَ القبول** درءاً للسباق (الدرسُ المدفوع في ق-٣٢)", () => {
    const { store, competition, enrollment } = pending()
    // طلبان متزامنان لشخصٍ واحد: الثاني كُتب قبل أن يُبتّ الأول (سباقٌ ممكن).
    const twin = submitPublicEnrollment(store, competitionContext("public"), {
      competitionId: competition.id,
      mosquePath: BILAL_PATH,
      nameAr: "طالبُ الالتحاق",
      phone: "0915151515",
      birthDate: new Date("2004-01-01T00:00:00.000Z"),
    })
    // الفهرسُ يمنعه من الحدّ أصلاً…
    expect(twin.ok).toBe(false)
    // …والقبولُ يُعيد الفحص كذلك، فلا يمرّ شيءٌ من ثقبٍ زمنيّ.
    const approved = approveEnrollment(store, competitionContext("u-amir"), {
      enrollmentId: enrollment.id,
    })
    expect(approved.ok).toBe(true)
    expect(store.contestants()).toHaveLength(1)
  })

  it("**والتحاقٌ مجهولٌ** ⇒ `UNKNOWN_ENROLLMENT` في القبول والرفض معاً", () => {
    const store = seedCompetitionStore()
    const ctx = competitionContext("u-amir")
    const approved = approveEnrollment(store, ctx, { enrollmentId: "لا-وجود-له" })
    expect(approved.ok).toBe(false)
    if (!approved.ok) expect(approved.error.code).toBe("UNKNOWN_ENROLLMENT")
    const rejected = rejectEnrollment(store, ctx, {
      enrollmentId: "لا-وجود-له",
      reason: "سببٌ معلن",
    })
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.error.code).toBe("UNKNOWN_ENROLLMENT")
  })

  it("**والصندوقُ صندوقُ مسجدِه وحده** (ق-١٤): طلبُ بلال لا يظهر في صندوق خالد", () => {
    const { store, competition } = pending()
    addByLeader(store, competitionContext("u-amir-bilal"), {
      competitionId: competition.id,
      mosquePath: BILAL_PATH,
      nameAr: "طالبُ بلال",
      phone: "0916161616",
      birthDate: new Date("2004-01-01T00:00:00.000Z"),
    })
    const khalidInbox = inboxOf(store, KHALID_PATH)
    expect(khalidInbox).toHaveLength(1)
    expect(khalidInbox[0]?.mosquePath).toBe(KHALID_PATH)
    // والمبتوتُ يخرج من الصندوق — الصندوقُ للمعلَّق وحده.
    approveEnrollment(store, competitionContext("u-amir"), { enrollmentId: khalidInbox[0]!.id })
    expect(inboxOf(store, KHALID_PATH)).toHaveLength(0)
  })
})
