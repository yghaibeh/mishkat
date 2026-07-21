/**
 * **ق-١٣ — سلسلةُ اللجان عبر المحرّك، بلا منطقٍ خاصّ** (الاختباران الإلزاميان الأول والثاني في T12).
 *
 * نصُّ القاعدة: «مسؤولُ اللجنة يُدخل أنشطة لجنته (في نطاق لجنته حصراً) فتدخل سجلَّ المسجد
 * **مسودةً بانتظار إقرار الأمير**؛ **لا تُحتسب نقاطُها إلا بعد إقراره**». وخطأُ v1 المكلف
 * الذي تحرسه: نقاطُ اللجان **ما كانت ستُحتسب أبداً** (`shuraConfirmed=false` للأبد).
 *
 * **وموطنُ هذا المِلفّ مقصود**: السلسلةُ مفرداتُها مفرداتُ المحرّك (`ApprovalRequest`،
 * `submitForApproval`، `report.approve`)، وG22 تحصرها في مجلد المحرّك واختباراته — فوحدةُ
 * اللجان تبقى **صفرَ منطقِ اعتماد**، وهذا الملفُّ هو الجسر.
 */
import { describe, it, expect } from "vitest"
import { CommitteeStore } from "../../../src/features/committees/data/store.js"
import { formCommittee } from "../../../src/features/committees/services/committees.js"
import { recordActivity, mosqueRecordContribution } from "../../../src/features/committees/services/activities.js"
import type { CommitteeContext } from "../../../src/features/committees/services/context.js"
import {
  COMMITTEE_ACTIVITY,
  committeeActivityPayloadSource,
  confirmedCommitteeIds,
} from "../../../src/features/approval/registered/committeeActivity.js"
import { makeCommitteeApprovalEndpoints } from "../../../src/features/approval/server/committeeActivity.js"
import { ApprovalStore } from "../../../src/features/approval/data/store.js"
import {
  approveRequest,
  rejectRequest,
  submitForApproval,
  retractSubmission,
  type ApprovalContext,
} from "../../../src/features/approval/services/engine.js"
import { pendingForApprover } from "../../../src/features/approval/services/inbox.js"
import { makeCapabilityCheck } from "../../../src/features/approval/services/authority.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver, type SettingOverride } from "../../../src/settings/resolver.js"
import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import type { Actor } from "../../../src/authorization/can.js"
import { NOW, PERIOD, READ, WRITE, canonicalPeople, withEndedAssignments } from "./_seed.js"

const KHALID = "khalid"
const KHALID_PATH = "/men/homs/sq2/khalid/"
const RELIEF_ID = "cm-relief"
const RELIEF_PATH = `${KHALID_PATH}${RELIEF_ID}/`
const HEAD = "u-committee-head"
const PERIOD_KEY = { id: PERIOD.id, endsAt: PERIOD.endsAt }

function actor(personId: string): Actor {
  const person = buildCanonicalWorld().people.find((p) => p.personId === personId)
  if (person === undefined) throw new Error(`لا شخص بهذا المعرّف: ${personId}`)
  return person
}

function committeeCtx(actorPersonId: string, overrides: readonly SettingOverride[] = []): CommitteeContext {
  return { now: NOW, actorPersonId, settings: createSettingsResolver(overrides) }
}

/** عالمُ الاختبار: لجنةٌ في مسجد خالد مسؤولُها صاحبُ حساب، ونشاطان مسجَّلان في الفترة. */
function world(options: { readonly people?: readonly Actor[] } = {}) {
  const committees = new CommitteeStore("t-main")
  for (const u of buildCanonicalWorld().units) {
    committees.saveUnit({ tenantId: "t-main", id: u.id, path: u.path })
  }
  const formed = formCommittee(committees, committeeCtx("u-amir"), {
    id: RELIEF_ID,
    mosqueUnitId: KHALID,
    labelAr: "لجنة الإغاثة",
    headPersonId: HEAD,
    headNameAr: "مسؤول لجنة الإغاثة",
  })
  if (!formed.ok) throw new Error(formed.error.code)

  for (const [titleAr, count] of [
    ["توزيعُ سلالٍ غذائية", 3],
    ["كفالةُ أيتام", 2],
  ] as const) {
    const r = recordActivity(committees, committeeCtx(HEAD), {
      committeeId: RELIEF_ID,
      periodId: PERIOD.id,
      titleAr,
      participantCount: count,
      participantNamesAr: [],
      completedAt: new Date("2026-07-19T00:00:00.000Z"),
    })
    if (!r.ok) throw new Error(r.error.code)
  }

  const approval = new ApprovalStore("t-main")
  const people = options.people ?? canonicalPeople()
  const ctx = (actorPersonId: string): ApprovalContext => ({
    now: NOW,
    actorPersonId,
    people,
    settings: createSettingsResolver([]),
    holds: makeCapabilityCheck(people, { now: NOW, intent: "read", isFeatureEnabled: () => true }),
    payloadFor: committeeActivityPayloadSource(committees),
  })

  return { committees, approval, ctx, people }
}

function contributionOf(w: ReturnType<typeof world>) {
  return mosqueRecordContribution(w.committees, {
    mosquePath: KHALID_PATH,
    periodId: PERIOD.id,
    confirmedCommitteeIds: confirmedCommitteeIds(w.approval, PERIOD.id),
  })
}

describe("**ق-١٣/١** — إدخالُ اللجنة يدخل **مسودةً**، ولا يُحتسب لسجل المسجد قبل إقرار الأمير", () => {
  it("قبل التقديم: الأنشطةُ مسجَّلةٌ في اللجنة و**مساهمتُها في سجل المسجد صفر**", () => {
    const w = world()
    expect(w.committees.activities()).toHaveLength(2)
    expect(contributionOf(w).activityCount).toBe(0)
    expect(contributionOf(w).participantCount).toBe(0)
  })

  it("**وبعد التقديم تبقى صفراً** — «مقدَّمٌ» ليس «مُقرّاً» (ب-٣٠أ: لا اعتمادَ لمسودة)", () => {
    const w = world()
    const submitted = submitForApproval(w.approval, w.ctx(HEAD), {
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: RELIEF_PATH,
      period: PERIOD_KEY,
    })
    if (!submitted.ok) throw new Error(submitted.error.code)
    expect(submitted.value.state).toBe("submitted")
    expect(contributionOf(w).activityCount).toBe(0)
  })

  it("**وبإقرار الأمير تُحتسب** — وهو عينُ ما لم يقع في v1 فما احتُسبت نقاطُ اللجان أبداً", () => {
    const w = world()
    submitForApproval(w.approval, w.ctx(HEAD), {
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: RELIEF_PATH,
      period: PERIOD_KEY,
    })
    const request = w.approval.requests()[0]!
    const approved = approveRequest(w.approval, w.ctx("u-amir"), { requestId: request.id })
    if (!approved.ok) throw new Error(approved.error.code)

    expect(approved.value.state).toBe("approved")
    expect(approved.value.route).toBe("nearest")
    const after = contributionOf(w)
    expect(after.activityCount).toBe(2)
    expect(after.participantCount).toBe(5)
    expect(after.committeeIds).toEqual([RELIEF_ID])
  })

  it("**والرفضُ يعيدها مسودةً فلا تُحتسب** (ق-٧) — بسببٍ إلزاميّ يصل المقدِّم", () => {
    const w = world()
    submitForApproval(w.approval, w.ctx(HEAD), {
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: RELIEF_PATH,
      period: PERIOD_KEY,
    })
    const request = w.approval.requests()[0]!
    const blank = rejectRequest(w.approval, w.ctx("u-amir"), { requestId: request.id, reasonAr: "  " })
    expect(blank.ok).toBe(false)
    if (!blank.ok) expect(blank.error.code).toBe("REASON_REQUIRED")

    const rejected = rejectRequest(w.approval, w.ctx("u-amir"), {
      requestId: request.id,
      reasonAr: "الأسماءُ ناقصةٌ وتاريخُ الإنجاز غيرُ صحيح",
    })
    if (!rejected.ok) throw new Error(rejected.error.code)
    expect(rejected.value.state).toBe("draft")
    expect(contributionOf(w).activityCount).toBe(0)
    expect(w.approval.notices().at(-1)?.recipients).toEqual([HEAD])
  })

  it("**والسحبُ للمقدِّم قبل البتّ** (ب-٣٠ج): يعود مسودةً ولا يُحتسب", () => {
    const w = world()
    submitForApproval(w.approval, w.ctx(HEAD), {
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: RELIEF_PATH,
      period: PERIOD_KEY,
    })
    const request = w.approval.requests()[0]!
    const byOther = retractSubmission(w.approval, w.ctx("u-amir"), { requestId: request.id })
    expect(byOther.ok).toBe(false)
    if (!byOther.ok) expect(byOther.error.code).toBe("NOT_SUBMITTER")

    const withdrawn = retractSubmission(w.approval, w.ctx(HEAD), { requestId: request.id })
    if (!withdrawn.ok) throw new Error(withdrawn.error.code)
    expect(withdrawn.value.state).toBe("draft")
    expect(contributionOf(w).activityCount).toBe(0)
  })

  it("**والحمولةُ تُشتقّ من اللجنة ولا يُدخلها المقدِّم** — نظيرُ ق-٦٧ في الإقفال", () => {
    const w = world()
    const submitted = submitForApproval(w.approval, w.ctx(HEAD), {
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: RELIEF_PATH,
      period: PERIOD_KEY,
    })
    if (!submitted.ok) throw new Error(submitted.error.code)
    expect(submitted.value.payload.committeeId).toBe(RELIEF_ID)
    expect(submitted.value.payload.activityCount).toBe(2)
    expect(submitted.value.payload.participantCount).toBe(5)
  })

  it("**ولجنةٌ بلا نشاطٍ في الفترة لا تُقدَّم أصلاً** (ق-١٠: لا تقديمَ على فراغ)", () => {
    const w = world()
    const empty = submitForApproval(w.approval, w.ctx(HEAD), {
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: RELIEF_PATH,
      period: { id: "1447-01", endsAt: NOW },
    })
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.error.code).toBe("EMPTY_PAYLOAD")
  })
})

describe("**ق-١٣/٢** — الأميرُ هو **الأقربُ حصراً**، والبنيةُ هي التي تجعله كذلك", () => {
  it("مسارُ اللجنة **تحت مسجدها** ⇒ أميرُ المسجد أقربُ سلَفٍ ⇒ إليه وحده يصل الإشعار (ق-١١)", () => {
    const w = world()
    submitForApproval(w.approval, w.ctx(HEAD), {
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: RELIEF_PATH,
      period: PERIOD_KEY,
    })
    const recipients = w.approval.notices()[0]!.recipients
    expect(recipients).toContain("u-amir")
    expect(recipients).not.toContain("u-square")
    expect(recipients).not.toContain("u-rabita")
    expect(recipients).not.toContain("u-admin")
  })

  it("**ومَن فوق الأمير مردودٌ ولو ملك القدرة** — «الأقربُ حصراً» (ق-١)", () => {
    const w = world()
    submitForApproval(w.approval, w.ctx(HEAD), {
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: RELIEF_PATH,
      period: PERIOD_KEY,
    })
    const request = w.approval.requests()[0]!
    for (const personId of ["u-square", "u-rabita", "u-section-head", "u-admin"]) {
      const r = approveRequest(w.approval, w.ctx(personId), { requestId: request.id })
      expect(r.ok, personId).toBe(false)
      if (!r.ok) expect(r.error.code).toBe("NOT_NEAREST_LAYER")
    }
    expect(contributionOf(w).activityCount).toBe(0)
  })

  it("**ومسؤولُ اللجنة لا يُقرّ عملَ نفسه**: لا يملك القدرةَ أصلاً فليس مرشَّحاً (#٤ محظورُه)", () => {
    const w = world()
    submitForApproval(w.approval, w.ctx(HEAD), {
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: RELIEF_PATH,
      period: PERIOD_KEY,
    })
    const request = w.approval.requests()[0]!
    const r = approveRequest(w.approval, w.ctx(HEAD), { requestId: request.id })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("NOT_NEAREST_LAYER")
  })

  it("**وشغورُ الأمير يصعد بالتوجيه للمربع تلقائياً** (ق-٢) — بلا إعدادٍ ولا سطرِ تصعيد", () => {
    const w = world({ people: withEndedAssignments("u-amir", "u-dual") })
    submitForApproval(w.approval, w.ctx(HEAD), {
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: RELIEF_PATH,
      period: PERIOD_KEY,
    })
    const request = w.approval.requests()[0]!
    expect(w.approval.notices()[0]!.recipients).toContain("u-square")

    const bySquare = approveRequest(w.approval, w.ctx("u-square"), { requestId: request.id })
    expect(bySquare.ok).toBe(true)
    expect(contributionOf(w).activityCount).toBe(2)
  })

  it("**وصندوقُ «بانتظار إقراري»** يعرض للأمير بيانات لجنته وحدها (ق-١/ق-١٧)", () => {
    const w = world()
    submitForApproval(w.approval, w.ctx(HEAD), {
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: RELIEF_PATH,
      period: PERIOD_KEY,
    })
    const forAmir = pendingForApprover(w.approval, w.ctx("u-amir"), {
      typeId: COMMITTEE_ACTIVITY.id,
      scopePath: KHALID_PATH,
    })
    expect(forAmir).toHaveLength(1)

    for (const personId of ["u-square", "u-admin", "u-amir-bilal"]) {
      const box = pendingForApprover(w.approval, w.ctx(personId), {
        typeId: COMMITTEE_ACTIVITY.id,
        scopePath: KHALID_PATH,
      })
      expect(box, personId).toHaveLength(0)
    }
  })

  it("**والاعتمادُ يقفل** (ق-٨): لا إقرارَ ثانٍ ولا إعادةَ تقديمٍ لفترةٍ مقفلة (ق-٦٧)", () => {
    const w = world()
    submitForApproval(w.approval, w.ctx(HEAD), {
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: RELIEF_PATH,
      period: PERIOD_KEY,
    })
    const request = w.approval.requests()[0]!
    approveRequest(w.approval, w.ctx("u-amir"), { requestId: request.id })

    const again = approveRequest(w.approval, w.ctx("u-amir"), { requestId: request.id })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.code).toBe("LOCKED")

    const resubmit = submitForApproval(w.approval, w.ctx(HEAD), {
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: RELIEF_PATH,
      period: PERIOD_KEY,
    })
    expect(resubmit.ok).toBe(false)
    if (!resubmit.ok) expect(resubmit.error.code).toBe("DUPLICATE_PERIOD")
  })
})

describe("سطوحُ الخادم للسلسلة — القدرةُ عند الباب والأقربيّةُ في المحرّك", () => {
  function endpoints(options: { readonly people?: readonly Actor[] } = {}) {
    clearRegistryForTests()
    const w = world(options)
    const ep = makeCommitteeApprovalEndpoints(
      { committees: w.committees, approval: w.approval },
      createSettingsResolver([]),
      w.people,
    )
    return { w, ep }
  }

  it("مسؤولُ اللجنة يقدّم، والأميرُ يُقرّ — والمساهمةُ تدخل السجل بعدها", async () => {
    const { w, ep } = endpoints()
    const submitted = await ep.submit.invoke({ committeeId: RELIEF_ID, period: PERIOD_KEY }, actor(HEAD), WRITE)
    expect(submitted.ok).toBe(true)
    const request = w.approval.requests()[0]!
    const approved = await ep.approve.invoke({ requestId: request.id }, actor("u-amir"), WRITE)
    expect(approved.ok).toBe(true)
    expect(contributionOf(w).activityCount).toBe(2)
  })

  it("**ولا يقدّم غيرُ مسؤول اللجنة** — النطاقُ شخصيٌّ مشتقٌّ من اللجنة المخزَّنة", async () => {
    const { ep } = endpoints()
    for (const personId of ["u-amir", "u-admin", "u-square", "u-teacher"]) {
      const r = await ep.submit.invoke({ committeeId: RELIEF_ID, period: PERIOD_KEY }, actor(personId), WRITE)
      expect(r.ok, personId).toBe(false)
    }
  })

  it("**ولا يُقرّ مَن لا يملك `report.approve`** — يُردّ عند الباب قبل المحرّك", async () => {
    const { w, ep } = endpoints()
    await ep.submit.invoke({ committeeId: RELIEF_ID, period: PERIOD_KEY }, actor(HEAD), WRITE)
    const request = w.approval.requests()[0]!
    for (const personId of [HEAD, "u-teacher", "u-student", "u-media", "u-finance", "u-admin"]) {
      const r = await ep.approve.invoke({ requestId: request.id }, actor(personId), WRITE)
      expect(r.ok, personId).toBe(false)
    }
    expect(contributionOf(w).activityCount).toBe(0)
  })

  it("**والرفضُ بابُه قدرةُ الإقرار نفسُها**، والسحبُ بابُه ملكيةُ اللجنة", async () => {
    const { w, ep } = endpoints()
    await ep.submit.invoke({ committeeId: RELIEF_ID, period: PERIOD_KEY }, actor(HEAD), WRITE)
    const request = w.approval.requests()[0]!

    const badReject = await ep.reject.invoke(
      { requestId: request.id, reasonAr: "لا يجوز" },
      actor("u-teacher"),
      WRITE,
    )
    expect(badReject.ok).toBe(false)

    const badRetract = await ep.retract.invoke({ requestId: request.id }, actor("u-amir"), WRITE)
    expect(badRetract.ok).toBe(false)

    const retracted = await ep.retract.invoke({ requestId: request.id }, actor(HEAD), WRITE)
    expect(retracted.ok).toBe(true)
    expect(w.approval.getRequest(request.id)?.state).toBe("draft")
  })

  it("**وصندوقُ الانتظار بابُه `report.approve` على نطاقه** — ومسؤولُ اللجنة لا يبلغه", async () => {
    const { ep } = endpoints()
    await ep.submit.invoke({ committeeId: RELIEF_ID, period: PERIOD_KEY }, actor(HEAD), WRITE)
    const forAmir = await ep.pending.invoke({ unitId: KHALID }, actor("u-amir"), READ)
    expect(forAmir.ok).toBe(true)
    if (forAmir.ok) expect(forAmir.value).toHaveLength(1)

    for (const personId of [HEAD, "u-student", "u-teacher"]) {
      const r = await ep.pending.invoke({ unitId: KHALID }, actor(personId), READ)
      expect(r.ok, personId).toBe(false)
    }
  })

  it("ولجنةٌ مجهولةٌ أو طلبٌ مجهول ⇒ `NO_SCOPE` ⇒ رفضٌ قبل جسم الدالة", async () => {
    const { ep } = endpoints()
    const ghostSubmit = await ep.submit.invoke(
      { committeeId: "لا-لجنة", period: PERIOD_KEY },
      actor(HEAD),
      WRITE,
    )
    const ghostApprove = await ep.approve.invoke({ requestId: "apr-999" }, actor("u-amir"), WRITE)
    expect(ghostSubmit.ok).toBe(false)
    expect(ghostApprove.ok).toBe(false)
  })

  it("**ومدخلٌ ناقصُ الحقل ⇒ `NO_SCOPE` ⇒ رفض** على السطوح الخمسة كلِّها", async () => {
    const { ep } = endpoints()
    const blank = {} as { committeeId: string; requestId: string; unitId: string }
    const results = [
      await ep.submit.invoke({ ...blank, period: PERIOD_KEY }, actor(HEAD), WRITE),
      await ep.approve.invoke(blank, actor("u-amir"), WRITE),
      await ep.reject.invoke({ ...blank, reasonAr: "سبب" }, actor("u-amir"), WRITE),
      await ep.retract.invoke(blank, actor(HEAD), WRITE),
      await ep.pending.invoke(blank, actor("u-amir"), READ),
    ]
    for (const r of results) expect(r.ok).toBe(false)
  })
})

describe("عقدُ النوع المسجَّل — **بيانٌ يُعلن، ولا يُعطِّل حارساً** (CR-008 في نظام الأنواع)", () => {
  it("النوعُ مسجَّلٌ بمعرّفه وكيانه وقدراته، وحرّاسُه الثلاثةُ نوعُها الحرفيّ `true`", () => {
    expect(COMMITTEE_ACTIVITY.id).toBe("committee.activity")
    expect(COMMITTEE_ACTIVITY.scopeKind).toBe("unit")
    expect(COMMITTEE_ACTIVITY.submitCapability).toBe("committee.own")
    expect(COMMITTEE_ACTIVITY.approveCapability).toBe("report.approve")
    expect(COMMITTEE_ACTIVITY.approvalLocks).toBe(true)
    expect(COMMITTEE_ACTIVITY.rejectionReturnsToDraft).toBe(true)
    expect(COMMITTEE_ACTIVITY.rejectionRequiresReason).toBe(true)
    expect(COMMITTEE_ACTIVITY.uniquePerPeriod).toBe(true)
    expect(COMMITTEE_ACTIVITY.payloadRequired).toBe(true)
  })

  it("**ومسارٌ ليس لجنةً لا حمولةَ له** ⇒ `EMPTY_PAYLOAD` — المسارُ وحدَه لا يصنع لجنة", () => {
    const w = world()
    const bogus = submitForApproval(w.approval, w.ctx(HEAD), {
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: KHALID_PATH,
      period: PERIOD_KEY,
    })
    expect(bogus.ok).toBe(false)
    if (!bogus.ok) expect(bogus.error.code).toBe("EMPTY_PAYLOAD")
  })

  it("**وطلبٌ معتمَدٌ بحمولةٍ بلا معرّفِ لجنةٍ لا يُقرّ لجنةً وهماً** (لا استنتاجَ صامت)", () => {
    const w = world()
    w.approval.saveRequest({
      tenantId: "t-main",
      id: "apr-forged",
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: RELIEF_PATH,
      period: PERIOD_KEY,
      state: "approved",
      payload: { activityCount: 9 },
      submittedBy: HEAD,
      submittedAt: NOW,
      approvedBy: "u-amir",
      approvedAt: NOW,
      route: "nearest",
      lockedAt: NOW,
      lastRejection: null,
    })
    expect(confirmedCommitteeIds(w.approval, PERIOD.id).size).toBe(0)
    expect(contributionOf(w).activityCount).toBe(0)
  })

  it("**وسحبُ طلبٍ مسارُه ليس لجنةً مردودٌ عند الباب** ⇒ `NO_SCOPE` (لا ملكيةَ بلا لجنة)", async () => {
    clearRegistryForTests()
    const w = world()
    w.approval.saveRequest({
      tenantId: "t-main",
      id: "apr-orphan",
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: KHALID_PATH,
      period: PERIOD_KEY,
      state: "submitted",
      payload: { committeeId: RELIEF_ID },
      submittedBy: HEAD,
      submittedAt: NOW,
      approvedBy: null,
      approvedAt: null,
      route: null,
      lockedAt: null,
      lastRejection: null,
    })
    const ep = makeCommitteeApprovalEndpoints(
      { committees: w.committees, approval: w.approval },
      createSettingsResolver([]),
      w.people,
    )
    const r = await ep.retract.invoke({ requestId: "apr-orphan" }, actor(HEAD), WRITE)
    expect(r.ok).toBe(false)
  })

  it("و«المُقرّ» يُقرأ من حالة الطلب لا من حقلٍ في اللجنة — صفر حالةِ اعتمادٍ في وحدة اللجان", () => {
    const w = world()
    expect(confirmedCommitteeIds(w.approval, PERIOD.id).size).toBe(0)
    submitForApproval(w.approval, w.ctx(HEAD), {
      typeId: COMMITTEE_ACTIVITY.id,
      unitPath: RELIEF_PATH,
      period: PERIOD_KEY,
    })
    expect(confirmedCommitteeIds(w.approval, PERIOD.id).size).toBe(0)
    approveRequest(w.approval, w.ctx("u-amir"), { requestId: w.approval.requests()[0]!.id })
    expect([...confirmedCommitteeIds(w.approval, PERIOD.id)]).toEqual([RELIEF_ID])
    // ولا يتسرّب المُقرُّ إلى فترةٍ أخرى.
    expect(confirmedCommitteeIds(w.approval, "1447-01").size).toBe(0)
  })
})
