/**
 * **الاختبارُ الإلزاميّ الأول** (T19، الشقُّ السلوكيّ) — **ق-٨٥/ق-د١**: اعتمادُ الدرس المفرد
 * **للأقرب**، عبر المحرّك وحده.
 *
 * ويعيش هنا — **داخل مجلد اختبارات المحرّك** — لأنّ مفرداتِ السلسلة (`report.approve`،
 * كسرُ الزجاج، أفعالُ البتّ) **لا يجوز أن تُكتب خارجه** (G22)؛ وهو نفسُه سببُ عيش
 * `weekly-record.test.ts` و`committee-chain.test.ts` هنا.
 *
 * والسلسلةُ المُختبَرة نصُّ القاعدة حرفياً: **أميرُ المكان أولاً** ⟵ فالطبقةُ الأقرب النشطة
 * (NESSA) ⟵ **والإدارةُ كسرَ زجاجٍ عند شغور الكل** — **والمعلّمُ لا يعتمد درسَ نفسه**.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { makeEducationLessonEndpoints } from "../../../src/features/approval/server/education.js"
import {
  EDUCATION_LESSON_TYPE,
  educationLessonApprovalCheck,
} from "../../../src/features/approval/registered/education.js"
import { ApprovalStore } from "../../../src/features/approval/data/store.js"
import { recordLesson } from "../../../src/features/education/services/lessons.js"
import { curriculumProgress } from "../../../src/features/education/services/progress.js"
import { approvedTeachingLoad } from "../../../src/features/education/services/teacherHours.js"
import { createCircle } from "../../../src/features/circles/services/circles.js"
import { canonicalPeople, peopleWithout } from "./_seed.js"
import {
  canonicalActor,
  circlesContext,
  DECISION,
  educationContext,
  educationPorts,
  HELD_AT,
  MAIN_TENANT_ID,
  SESSION_A,
  SETTINGS,
  seedWorld,
  WRITE,
  type EduWorld,
  circleDays,
  NOW,} from "../education/_seed.js"
import type { Actor } from "../../../src/authorization/can.js"

type Chain = {
  readonly world: EduWorld
  readonly approval: ApprovalStore
  readonly ep: ReturnType<typeof makeEducationLessonEndpoints>
  readonly lessonId: string
}

/** يبني السلسلةَ على حلقةٍ حقيقية: درسٌ مسجَّلٌ بانتظار البتّ. */
function chain(input: { readonly people?: readonly Actor[]; readonly circleId?: string } = {}): Chain {
  const world = seedWorld(MAIN_TENANT_ID)
  const approval = new ApprovalStore(MAIN_TENANT_ID)
  const ports = educationPorts(world)
  const circleId = input.circleId ?? world.circleId
  const roster = world.circles.enrollments().filter((e) => e.circleId === circleId)
  const done = recordLesson(
    world.education,
    { ...educationContext(world), isLessonApproved: educationLessonApprovalCheck(approval) },
    {
      circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 90,
      presentEnrollmentIds: roster.map((e) => e.id),
    },
  )
  if (!done.ok) throw new Error(done.error.code)
  return {
    world,
    approval,
    ep: makeEducationLessonEndpoints(
      { approval, days: circleDays(world)("u-teacher", NOW) },
      ports,
      SETTINGS,
      input.people ?? canonicalPeople(),
    ),
    lessonId: done.value.id,
  }
}

beforeEach(() => {
  clearRegistryForTests()
})

describe("**ق-٨٥ — اعتمادُ الدرس المفرد: أميرُ المكان أقربُ سلَفٍ بالبنية**", () => {
  it("المعلّمُ يقدّم درسَه ⟵ **أميرُ المسجد يعتمده** ⟵ فيُقفل الدرس", async () => {
    const c = chain()
    const submitted = await c.ep.submit.invoke({ lessonId: c.lessonId }, canonicalActor("u-teacher"), WRITE)
    expect(submitted.ok, submitted.ok ? "" : submitted.decision.reason).toBe(true)
    if (!submitted.ok || !submitted.value.ok) throw new Error("التقديمُ لم ينجح")
    const requestId = submitted.value.value.id
    expect(submitted.value.value.typeId).toBe(EDUCATION_LESSON_TYPE)
    // **الفترةُ هي الدرسُ نفسُه** — فصار «اعتمادُ الدرس المفرد» طلباً واحداً بلا حقلٍ جديد.
    expect(submitted.value.value.period.id).toBe(c.lessonId)

    const approved = await c.ep.approve.invoke({ requestId }, canonicalActor("u-amir"), WRITE)
    expect(approved.ok, approved.ok ? "" : approved.decision.reason).toBe(true)
    if (!approved.ok || !approved.value.ok) throw new Error("الاعتمادُ لم ينجح")
    expect(approved.value.value.state).toBe("approved")
    expect(approved.value.value.route).toBe("nearest")
    expect(approved.value.value.lockedAt).not.toBeNull()
  })

  it("**والمعلّمُ لا يعتمد درسَ نفسه** — لا يملك قدرةَ البتّ أصلاً، ومسارُه ليس سلَفاً لحلقته", async () => {
    const c = chain()
    const submitted = await c.ep.submit.invoke({ lessonId: c.lessonId }, canonicalActor("u-teacher"), WRITE)
    if (!submitted.ok || !submitted.value.ok) throw new Error("التقديمُ لم ينجح")
    const r = await c.ep.approve.invoke(
      { requestId: submitted.value.value.id },
      canonicalActor("u-teacher"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })

  it("**والطبقةُ الأعلى ليست الأقرب**: مشرفُ المربع يملك القدرةَ ويُردّ بـ`NOT_NEAREST_LAYER`", async () => {
    const c = chain()
    const submitted = await c.ep.submit.invoke({ lessonId: c.lessonId }, canonicalActor("u-teacher"), WRITE)
    if (!submitted.ok || !submitted.value.ok) throw new Error("التقديمُ لم ينجح")
    const r = await c.ep.approve.invoke(
      { requestId: submitted.value.value.id },
      canonicalActor("u-square"),
      WRITE,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.ok).toBe(false)
    expect(r.value.ok === false && r.value.error.code).toBe("NOT_NEAREST_LAYER")
  })

  it("**وشغورُ الأمير يصعد بالتوجيه تلقائياً** (ق-٢) — بلا سطرِ تصعيدٍ واحد", async () => {
    // **يُفرَّغ المسجدُ من كل مكلَّفٍ فيه**: `u-dual` أميرٌ على المسجد نفسِه بدورٍ ثانٍ —
    // فإسقاطُ الأول وحده لا يُفرِّغ الطبقة، وهذا بعينه ما يجب أن يقوله التوجيه.
    const c = chain({ people: peopleWithout("u-amir", "u-dual") })
    const submitted = await c.ep.submit.invoke({ lessonId: c.lessonId }, canonicalActor("u-teacher"), WRITE)
    if (!submitted.ok || !submitted.value.ok) throw new Error("التقديمُ لم ينجح")
    const r = await c.ep.approve.invoke(
      { requestId: submitted.value.value.id },
      canonicalActor("u-square"),
      WRITE,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.ok, r.value.ok === false ? r.value.error.code : "").toBe(true)
  })

  it("**والرفضُ بسببٍ إلزاميّ يعيده مسودةً**، والمعلّمُ يسحب تقديمَه قبل البتّ (ب-٣٠ج)", async () => {
    const c = chain()
    const submitted = await c.ep.submit.invoke({ lessonId: c.lessonId }, canonicalActor("u-teacher"), WRITE)
    if (!submitted.ok || !submitted.value.ok) throw new Error("التقديمُ لم ينجح")
    const requestId = submitted.value.value.id

    const noReason = await c.ep.reject.invoke({ requestId, reasonAr: "  " }, canonicalActor("u-amir"), WRITE)
    expect(noReason.ok && noReason.value.ok === false && noReason.value.error.code).toBe("REASON_REQUIRED")

    const rejected = await c.ep.reject.invoke(
      { requestId, reasonAr: "الصورُ غيرُ واضحة" },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(rejected.ok && rejected.value.ok).toBe(true)
    if (!rejected.ok || !rejected.value.ok) return
    expect(rejected.value.value.state).toBe("draft")
    expect(rejected.value.value.lastRejection?.reasonAr).toBe("الصورُ غيرُ واضحة")

    const again = await c.ep.submit.invoke({ lessonId: c.lessonId }, canonicalActor("u-teacher"), WRITE)
    expect(again.ok && again.value.ok).toBe(true)
    const retracted = await c.ep.retract.invoke(
      { lessonId: c.lessonId, requestId },
      canonicalActor("u-teacher"),
      WRITE,
    )
    expect(retracted.ok && retracted.value.ok).toBe(true)
    if (!retracted.ok || !retracted.value.ok) return
    expect(retracted.value.value.state).toBe("draft")
  })

  it("**وسحبُ غيرِ المقدِّم مرفوض** ولو ملك البابَ نفسَه", async () => {
    const c = chain()
    const submitted = await c.ep.submit.invoke({ lessonId: c.lessonId }, canonicalActor("u-teacher"), WRITE)
    if (!submitted.ok || !submitted.value.ok) throw new Error("التقديمُ لم ينجح")
    const r = await c.ep.retract.invoke(
      { lessonId: c.lessonId, requestId: submitted.value.value.id },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })
})

describe("**ق-٨٤/ق-٩ — بابا التقديم**: المعلّمُ المالك وأميرُ المكان، ولا أحدَ سواهما", () => {
  it("أميرُ المكان يقدّم درساً سجّله ⟵ **فلا يعتمده بنفسه** (ق-٩)، ومخرجُه التدخّلُ الفوقيّ (ق-١٢)", async () => {
    const c = chain()
    const submitted = await c.ep.submitByOwner.invoke(
      { lessonId: c.lessonId },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(submitted.ok, submitted.ok ? "" : submitted.decision.reason).toBe(true)
    if (!submitted.ok || !submitted.value.ok) throw new Error("التقديمُ لم ينجح")
    const requestId = submitted.value.value.id

    const selfApprove = await c.ep.approve.invoke({ requestId }, canonicalActor("u-amir"), WRITE)
    expect(selfApprove.ok && selfApprove.value.ok === false && selfApprove.value.error.code).toBe(
      "SELF_APPROVAL_REJECTED",
    )

    const overridden = await c.ep.override.invoke(
      { requestId, reasonAr: "الأميرُ سجّل بنفسه لغياب المعلّم" },
      canonicalActor("u-rabita"),
      WRITE,
    )
    expect(overridden.ok && overridden.value.ok).toBe(true)
    if (!overridden.ok || !overridden.value.ok) return
    expect(overridden.value.value.route).toBe("override")
  })

  it("**والمشرفون والمديرُ لا يقدّمون** — لا ببابِ المعلّم ولا ببابِ الأمير", async () => {
    const c = chain()
    for (const personId of ["u-admin", "u-section-head", "u-rabita", "u-square"]) {
      const teacherDoor = await c.ep.submit.invoke({ lessonId: c.lessonId }, canonicalActor(personId), WRITE)
      expect(teacherDoor.ok, `${personId} قدّم ببابِ المعلّم`).toBe(false)
      const ownerDoor = await c.ep.submitByOwner.invoke(
        { lessonId: c.lessonId },
        canonicalActor(personId),
        WRITE,
      )
      expect(ownerDoor.ok, `${personId} قدّم ببابِ الأمير`).toBe(false)
    }
  })
})

describe("**ق-٣/ق-٨٥ ذيلاً — كسرُ الزجاج عند شغور الطبقات كلِّها وحده**", () => {
  /** حلقةٌ في قسمٍ لا مكلَّفَ فيه ولا فوقه بقدرة البتّ — **شغورٌ كليٌّ حقيقيّ**. */
  function vacantChain(): Chain {
    const world = seedWorld(MAIN_TENANT_ID)
    const created = createCircle(world.circles, circlesContext("u-amir"), {
      unitId: "women",
      typeId: "baseera",
      nameAr: "حلقةٌ في قسمٍ بلا طبقةٍ نشطة",
      capacity: 10,
    })
    if (!created.ok) throw new Error(created.error.code)
    // الإسنادُ **مباشرةً في المستودع**: `assignTeacher` تشترط أن يكون المعلّمُ من أهل الوحدة،
    // وهذه حالةُ حافةٍ مقصودة (حلقةٌ خارج سلّم التكليف) — والمقصودُ اختبارُ التوجيه لا الإسناد.
    world.circles.saveCircle({ ...created.value, teacherPersonId: "u-teacher" })
    const done = world.circles.appendEnrollment({
      tenantId: MAIN_TENANT_ID,
      id: "enr-vacant",
      circleId: created.value.id,
      nameAr: "طالبة",
      joinedAt: HELD_AT,
      leftAt: null,
    })
    void done
    return chainOn(world, created.value.id)
  }

  function chainOn(world: EduWorld, circleId: string): Chain {
    const approval = new ApprovalStore(MAIN_TENANT_ID)
    const ports = educationPorts(world)
    const roster = world.circles.enrollments().filter((e) => e.circleId === circleId)
    const recorded = recordLesson(
      world.education,
      { ...educationContext(world), isLessonApproved: educationLessonApprovalCheck(approval) },
      {
        circleId,
        sessionId: SESSION_A,
        heldAt: HELD_AT,
        durationMinutes: 60,
        presentEnrollmentIds: roster.map((e) => e.id),
      },
    )
    if (!recorded.ok) throw new Error(recorded.error.code)
    return {
      world,
      approval,
      ep: makeEducationLessonEndpoints(
        { approval, days: circleDays(world)("u-teacher", NOW) },
        ports,
        SETTINGS,
        canonicalPeople(),
      ),
      lessonId: recorded.value.id,
    }
  }

  it("الطبقاتُ كلُّها شاغرة ⇒ **الإدارةُ تكسر الزجاج** بأثرٍ مدقَّقٍ متميّز", async () => {
    const c = vacantChain()
    const submitted = await c.ep.submit.invoke({ lessonId: c.lessonId }, canonicalActor("u-teacher"), WRITE)
    if (!submitted.ok || !submitted.value.ok) throw new Error("التقديمُ لم ينجح")
    const r = await c.ep.breakGlass.invoke(
      { requestId: submitted.value.value.id, reasonAr: "لا طبقةَ نشطةً فوق الحلقة" },
      canonicalActor("u-admin"),
      WRITE,
    )
    expect(r.ok, r.ok ? "" : r.decision.reason).toBe(true)
    if (!r.ok || !r.value.ok) throw new Error("كسرُ الزجاج لم ينجح")
    expect(r.value.value.route).toBe("breakGlass")
  })

  it("**ولا يُقبل مع طبقةٍ نشطة** (ق-٣): حلقةُ المسجد ⇒ `LAYER_NOT_VACANT`", async () => {
    const c = chain()
    const submitted = await c.ep.submit.invoke({ lessonId: c.lessonId }, canonicalActor("u-teacher"), WRITE)
    if (!submitted.ok || !submitted.value.ok) throw new Error("التقديمُ لم ينجح")
    const r = await c.ep.breakGlass.invoke(
      { requestId: submitted.value.value.id, reasonAr: "محاولة" },
      canonicalActor("u-admin"),
      WRITE,
    )
    expect(r.ok && r.value.ok === false && r.value.error.code).toBe("LAYER_NOT_VACANT")
  })
})

describe("**أثرُ الاعتماد يصل وحدةَ التعليم منفذاً** — لا حالةً مخزَّنةً فيها (G22)", () => {
  it("قبل الاعتماد: صفرُ تقدّمٍ وصفرُ دقيقةٍ مأجورة — وبعده: تقدّمٌ وحصيلة", async () => {
    const c = chain()
    const ctx = {
      ...educationContext(c.world),
      isLessonApproved: educationLessonApprovalCheck(c.approval),
    }
    const before = curriculumProgress(c.world.education, ctx, c.world.circleId)
    expect(before.ok && before.value.completedCells).toBe(0)
    const beforePay = approvedTeachingLoad(c.world.education, ctx, {
      teacherPersonId: "u-teacher",
      from: new Date("2026-07-01T00:00:00.000Z"),
      to: new Date("2026-08-01T00:00:00.000Z"),
    })
    expect(beforePay.ok && beforePay.value.totalMinutes).toBe(0)

    const submitted = await c.ep.submit.invoke({ lessonId: c.lessonId }, canonicalActor("u-teacher"), WRITE)
    if (!submitted.ok || !submitted.value.ok) throw new Error("التقديمُ لم ينجح")
    const approved = await c.ep.approve.invoke(
      { requestId: submitted.value.value.id },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(approved.ok && approved.value.ok).toBe(true)

    const after = curriculumProgress(c.world.education, ctx, c.world.circleId)
    expect(after.ok && after.value.completedCells).toBe(3)
    const afterPay = approvedTeachingLoad(c.world.education, ctx, {
      teacherPersonId: "u-teacher",
      from: new Date("2026-07-01T00:00:00.000Z"),
      to: new Date("2026-08-01T00:00:00.000Z"),
    })
    expect(afterPay.ok && afterPay.value.totalMinutes).toBe(90)
  })

  it("**وصندوقُ «بانتظار اعتمادك» يشتقّ وجهتَه من التوجيه نفسِه** — للأمير لا لغيره", async () => {
    const c = chain()
    await c.ep.submit.invoke({ lessonId: c.lessonId }, canonicalActor("u-teacher"), WRITE)
    const amirBox = await c.ep.pending.invoke(
      { circleId: c.world.circleId },
      canonicalActor("u-amir"),
      DECISION,
    )
    expect(amirBox.ok).toBe(true)
    if (!amirBox.ok) return
    expect(amirBox.value).toHaveLength(1)

    const squareBox = await c.ep.pending.invoke(
      { circleId: c.world.circleId },
      canonicalActor("u-square"),
      DECISION,
    )
    expect(squareBox.ok).toBe(true)
    if (!squareBox.ok) return
    expect(squareBox.value, "ظهر عملٌ في صندوق مَن لا يعتمده (ع-٢٢)").toEqual([])
  })
})
