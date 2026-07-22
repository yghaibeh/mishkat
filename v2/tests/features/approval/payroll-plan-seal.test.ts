/**
 * **الاختبارُ الإلزاميُّ الثاني** — المبدأُ الحاكم (عقدُ الوحدة §٢):
 * **المستحقُّ يُشتقّ حتى يُعتمد، ثم يُختَم.**
 *
 * وهو **الحدُّ الذي يجب أن يُصاب بدقّة**: قاعدةُ «صفر عدّادٍ مخزَّن» تحكم المشروع كلَّه،
 * ولها هنا استثناءٌ واحدٌ مُعلَّل — **المال المدفوع واقعةٌ لا اشتقاق**. فلو بقي المستحقُّ
 * مشتقّاً بعد الصرف لَغيَّر **تعديلٌ في درسٍ قديم راتبَ شهرٍ صُرف**، وذاك **تزويرٌ بالإهمال**.
 *
 * **والاختبارُ يجري على التركيب الحقيقيّ**: دروسٌ حقيقيةٌ من وحدة التعليم، وختمٌ من محرّك
 * الاعتماد نفسِه (تقديمٌ ⟵ اعتماد) — لا علمٌ يُرفع في الاختبار.
 */
import { describe, it, expect } from "vitest"
import {
  approveRequest,
  rejectRequest,
  submitForApproval,
  type ApprovalContext,
} from "../../../src/features/approval/services/engine.js"
import { makeCapabilityCheck } from "../../../src/features/approval/services/authority.js"
import {
  PAYROLL_PLAN,
  payingUnitFrom,
  payrollPlanPayloadSource,
  payrollSealFrom,
} from "../../../src/features/approval/registered/payroll.js"
import { monthlyPlan } from "../../../src/features/payroll/services/plan.js"
import type { PayrollContext } from "../../../src/features/payroll/services/context.js"
import { candidatesAt } from "../../../src/features/approval/services/routing.js"
import {
  DECISION,
  FROM,
  HOMS_PATH,
  HOURLY_RATE,
  KHALID_PATH,
  NEXT_DAY,
  NOW,
  OMAR_PATH,
  PERIOD,
  TO,
  VACANT_SQUARE_PATH,
  canonicalPeople,
  payrollContext,
  recordRealLesson,
  routingContext,
  seedWorld,
  type PayrollWorld,
} from "../payroll/_seed.js"

const PERSON_IDS = ["u-teacher"] as const

/** سياقُ المحرّك — **الحمولةُ مشتقّةٌ من مصدرها** لا من مدخل المقدِّم (ق-٦٧ معمَّمة). */
function approvalContextOf(
  world: PayrollWorld,
  actorPersonId: string,
  payrollCtx: PayrollContext,
): ApprovalContext {
  const people = canonicalPeople()
  return {
    now: NOW,
    actorPersonId,
    settings: payrollCtx.settings,
    people,
    holds: makeCapabilityCheck(people, DECISION),
    payloadFor: payrollPlanPayloadSource(world.stores, payrollCtx, {
      from: FROM,
      to: TO,
      personIds: PERSON_IDS,
    }),
  }
}

/** يبني عالماً بدرسٍ معتمَدٍ واحد، ويعيد سياقاً حيّاً يقرأ **مجموعةَ الاعتماد الحيّة**. */
function worldWithApprovedLesson(): {
  world: PayrollWorld
  approved: Set<string>
  ctx: () => PayrollContext
} {
  const world = seedWorld()
  const lessonId = recordRealLesson(world, { sessionId: "ses-1", minutes: 60 })
  const approved = new Set([lessonId])
  const ctx = (): PayrollContext =>
    payrollContext({
      world,
      approvedLessonIds: approved,
      seal: payrollSealFrom(world.approval),
      payingUnit: payingUnitFrom(routingContext()),
    })
  return { world, approved, ctx }
}

function plan(world: PayrollWorld, ctx: PayrollContext) {
  return monthlyPlan(world.stores, ctx, {
    unitPath: KHALID_PATH,
    periodId: PERIOD.id,
    from: FROM,
    to: TO,
    personIds: PERSON_IDS,
  })
}

describe("**المبدأُ الحاكم — يُشتقّ حتى يُعتمد ثم يُختَم**", () => {
  it("**قبل الاعتماد**: تعديلُ العمل **يُغيّر** المستحق فوراً — فالاشتقاقُ مصدرُ الحقيقة", () => {
    const { world, approved, ctx } = worldWithApprovedLesson()
    expect(plan(world, ctx()).totalNetCents).toBe(HOURLY_RATE)

    // درسٌ ثانٍ يُسجَّل ويُعتمد **قبل** إقرار الخطة ⇒ ينعكس فوراً.
    const second = recordRealLesson(world, { sessionId: "ses-2", minutes: 60, heldAt: NEXT_DAY })
    approved.add(second)

    expect(plan(world, ctx()).totalNetCents, "الاشتقاقُ حيٌّ قبل الختم").toBe(2 * HOURLY_RATE)
  })

  it("**وبعد الاعتماد**: تعديلُ العمل **لا يُغيّر** المدفوع — «المالُ المدفوع واقعةٌ لا اشتقاق»", () => {
    const { world, approved, ctx } = worldWithApprovedLesson()

    const submitted = submitForApproval(world.approval, approvalContextOf(world, "u-finance", ctx()), {
      typeId: PAYROLL_PLAN.id,
      unitPath: KHALID_PATH,
      period: PERIOD,
    })
    expect(submitted.ok).toBe(true)
    if (!submitted.ok) return

    const approvedPlan = approveRequest(world.approval, approvalContextOf(world, "u-admin", ctx()), {
      requestId: submitted.value.id,
    })
    expect(approvedPlan.ok, "الإدارةُ تقرّ آخرَ الشهر (ق-٥١)").toBe(true)

    const sealed = plan(world, ctx())
    expect(sealed.stage).toBe("sealed")
    expect(sealed.totalNetCents).toBe(HOURLY_RATE)

    // **درسٌ قديمٌ يُعتمد بعد الختم** — وهو السيناريو الذي يقتله المبدأ.
    const late = recordRealLesson(world, { sessionId: "ses-2", minutes: 600, heldAt: NEXT_DAY })
    approved.add(late)

    const after = plan(world, ctx())
    expect(after.totalNetCents, "**الختمُ صمد**: عملٌ لاحقٌ لا يُغيّر شهراً أُقرّ").toBe(HOURLY_RATE)
    expect(after.lines[0]?.netCents).toBe(HOURLY_RATE)
  })

  it("**ويظهر فارقاً معلَناً لا صمتاً**: الفرقُ يُعرَض للتحقيق ولا يُطبَّق على المدفوع", () => {
    const { world, approved, ctx } = worldWithApprovedLesson()

    const submitted = submitForApproval(world.approval, approvalContextOf(world, "u-finance", ctx()), {
      typeId: PAYROLL_PLAN.id,
      unitPath: KHALID_PATH,
      period: PERIOD,
    })
    if (!submitted.ok) throw new Error(submitted.error.code)
    approveRequest(world.approval, approvalContextOf(world, "u-admin", ctx()), {
      requestId: submitted.value.id,
    })

    expect(plan(world, ctx()).drift, "لا فارقَ ما دام العملُ لم يتغيّر").toEqual([])

    const late = recordRealLesson(world, { sessionId: "ses-2", minutes: 120, heldAt: NEXT_DAY })
    approved.add(late)

    const drift = plan(world, ctx()).drift
    expect(drift, "**الصمتُ عيبٌ**: الفارقُ يُعلَن").toHaveLength(1)
    expect(drift[0]).toMatchObject({
      personId: "u-teacher",
      sealedNetCents: HOURLY_RATE,
      liveNetCents: 3 * HOURLY_RATE,
      deltaCents: 2 * HOURLY_RATE,
    })
  })

  it("**والختمُ يحمل مدخلاتِ اشتقاقه**: تُقرأ من المختوم بعد سنةٍ بلا سؤالِ أحد", () => {
    const { world, ctx } = worldWithApprovedLesson()

    const submitted = submitForApproval(world.approval, approvalContextOf(world, "u-finance", ctx()), {
      typeId: PAYROLL_PLAN.id,
      unitPath: KHALID_PATH,
      period: PERIOD,
    })
    if (!submitted.ok) throw new Error(submitted.error.code)
    approveRequest(world.approval, approvalContextOf(world, "u-admin", ctx()), {
      requestId: submitted.value.id,
    })

    const basis = plan(world, ctx()).lines[0]?.tracks[0]?.basis
    expect(basis).toMatchObject({ kind: "hours", lessonCount: 1, minutes: 60 })
    expect(basis?.kind === "hours" ? basis.lessonIds.length : 0, "معرّفاتُ الدروس برهانُ الرقم").toBe(1)
    expect(basis?.kind === "hours" ? basis.hourlyRateCents : 0, "والمعدّلُ المطبَّق معه").toBe(HOURLY_RATE)
  })

  it("**والمرحلةُ في النموذج لا في الشاشة** (ع-٢١): مشتقّةٌ ⟵ معلَّقةٌ ⟵ مختومة", () => {
    const { world, ctx } = worldWithApprovedLesson()
    expect(plan(world, ctx()).stage).toBe("derived")

    const submitted = submitForApproval(world.approval, approvalContextOf(world, "u-finance", ctx()), {
      typeId: PAYROLL_PLAN.id,
      unitPath: KHALID_PATH,
      period: PERIOD,
    })
    if (!submitted.ok) throw new Error(submitted.error.code)
    expect(plan(world, ctx()).stage, "قُدِّمت وتنتظر إقرارَ الإدارة").toBe("pending")

    approveRequest(world.approval, approvalContextOf(world, "u-admin", ctx()), {
      requestId: submitted.value.id,
    })
    expect(plan(world, ctx()).stage).toBe("sealed")
  })

  it("**والرفضُ يعيدها اشتقاقاً حيّاً** (ق-٧): لا ختمَ لمردودة، والعملُ يعود ينعكس", () => {
    const { world, approved, ctx } = worldWithApprovedLesson()

    const submitted = submitForApproval(world.approval, approvalContextOf(world, "u-finance", ctx()), {
      typeId: PAYROLL_PLAN.id,
      unitPath: KHALID_PATH,
      period: PERIOD,
    })
    if (!submitted.ok) throw new Error(submitted.error.code)

    const rejected = rejectRequest(world.approval, approvalContextOf(world, "u-admin", ctx()), {
      requestId: submitted.value.id,
      reasonAr: "ساعاتٌ تحتاج مراجعة",
    })
    expect(rejected.ok).toBe(true)

    const back = plan(world, ctx())
    expect(back.stage, "المردودةُ ليست مختومة").toBe("pending")

    const second = recordRealLesson(world, { sessionId: "ses-2", minutes: 60, heldAt: NEXT_DAY })
    approved.add(second)
    expect(plan(world, ctx()).totalNetCents, "وتُشتقّ حيّةً من جديد").toBe(2 * HOURLY_RATE)
  })

  it("**ولا يقرّ المقدِّمُ خطتَه** (ق-٩): مَن قدّم لا يبتّ", () => {
    const { world, ctx } = worldWithApprovedLesson()
    const submitted = submitForApproval(world.approval, approvalContextOf(world, "u-finance", ctx()), {
      typeId: PAYROLL_PLAN.id,
      unitPath: KHALID_PATH,
      period: PERIOD,
    })
    if (!submitted.ok) throw new Error(submitted.error.code)

    const selfApproved = approveRequest(world.approval, approvalContextOf(world, "u-finance", ctx()), {
      requestId: submitted.value.id,
    })
    expect(selfApproved.ok).toBe(false)
  })

  it("**ولا خطتان لشهرٍ واحد** (ق-٦٧ معمَّمة): المختومةُ لا يُعاد تقديمُها", () => {
    const { world, ctx } = worldWithApprovedLesson()
    const submitted = submitForApproval(world.approval, approvalContextOf(world, "u-finance", ctx()), {
      typeId: PAYROLL_PLAN.id,
      unitPath: KHALID_PATH,
      period: PERIOD,
    })
    if (!submitted.ok) throw new Error(submitted.error.code)
    approveRequest(world.approval, approvalContextOf(world, "u-admin", ctx()), {
      requestId: submitted.value.id,
    })

    const again = submitForApproval(world.approval, approvalContextOf(world, "u-finance", ctx()), {
      typeId: PAYROLL_PLAN.id,
      unitPath: KHALID_PATH,
      period: PERIOD,
    })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.code).toBe("DUPLICATE_PERIOD")
  })
})

// ═══ ق-٦٥ — **مَن لا مسجدَ له يصرف له أمينُ أقرب وحدةٍ مالكة** (NESSA مستهلَكة) ═══

describe("ق-٦٥ — وحدةُ الصرف من **محرّك التوجيه القائم** لا من منطقٍ ثانٍ", () => {
  it("من له أمينٌ في وحدته ⇒ **وحدتُه هي وحدةُ الصرف** (الطريقُ العاديّ)", () => {
    const payingUnit = payingUnitFrom(routingContext())
    expect(payingUnit(KHALID_PATH)).toBe(KHALID_PATH)
  })

  it("**ومَن وحدتُه بلا أمين ⇒ يصعد إلى أقرب سلَفٍ فيه أمين** — لا «الإدارة» ضمناً", () => {
    // **المربعُ السابع شاغرٌ عمداً** في العالم القانونيّ: لا مكلَّفَ عليه إطلاقاً.
    const payingUnit = payingUnitFrom(routingContext())
    const resolved = payingUnit(VACANT_SQUARE_PATH)
    expect(resolved, "لا يصرف من صندوقٍ بلا أمين").not.toBe(VACANT_SQUARE_PATH)
    expect(resolved, "أقربُ سلَفٍ فيه أمينٌ **لصندوقه هو**").toBe(HOMS_PATH)
  })

  /**
   * **ق-٥٩ يُقرأ بدقّة**: نوعُ نطاق `box.receive` «ذ» (مطابقةٌ تامّة) — فالأمانةُ **لا تُورَث
   * هبوطاً**. ولذلك الصعودُ يسأل كلَّ سلَفٍ **عن صندوقه هو** لا عن صندوق المستحق: من لا وحدةَ
   * له يصرف له أمينُ أقرب وحدةٍ مالكة **من صندوقها** — وهو نصُّ ق-٦٥.
   */
  it("**ولا تُورَث الأمانةُ هبوطاً**: أمينُ المنطقة ليس أميناً لصندوق مسجدٍ تحتها (ق-٥٩)", () => {
    const routing = routingContext()
    expect(candidatesAt(routing, "box.receive", HOMS_PATH, OMAR_PATH)).toEqual([])
    expect(candidatesAt(routing, "box.receive", HOMS_PATH, HOMS_PATH)).toContain("u-rabita")
  })

  it("**وخلوُّ السلسلة كلِّها ⇒ رفضٌ يُقفل**: لا أمينَ ⇒ `null` لا «الإدارة» ضمناً", () => {
    const empty = payingUnitFrom({ now: NOW, people: [], holds: () => false })
    expect(empty(KHALID_PATH)).toBeNull()
  })
})
