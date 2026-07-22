/**
 * **الاختبارُ الإلزاميّ الخامس** (T19) — **ق-٨٤**: الإدخالُ لمالكه — **المديرُ والمشرفُ
 * يُدخلان درساً ⇒ مرفوض**؛ ومعه **قب-٣٨**: القدرةُ الشخصية تسأل **الدورَ والملكيةَ معاً**.
 *
 * والحرّاسُ هنا **في الخادم لا في الواجهة**: الاستدعاءُ المباشر (تجاوزاً للشاشة) هو ما يُختبر.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { makeEducationEndpoints } from "../../../src/features/education/server/endpoints.js"
import {
  canonicalActor,
  DECISION,
  educationContext,
  educationPorts,
  HELD_AT,
  SESSION_A,
  SESSION_B,
  SETTINGS,
  seedWorld,
  WRITE,
  type EduWorld,
  circleDays,} from "./_seed.js"
import { recordLesson } from "../../../src/features/education/services/lessons.js"

type Ep = ReturnType<typeof makeEducationEndpoints>

function endpointsOf(w: EduWorld, approved: readonly string[] = []): Ep {
  const set = new Set(approved)
  const isLessonApproved = (lessonId: string): boolean => set.has(lessonId)
  return makeEducationEndpoints(
    w.education,
    educationPorts(w),
    SETTINGS,
    isLessonApproved,
    circleDays(w, { isLessonApproved }),
  )
}

function recordInput(w: EduWorld, sessionId: string = SESSION_A) {
  return {
    circleId: w.circleId,
    sessionId,
    heldAt: HELD_AT,
    durationMinutes: 60,
    presentEnrollmentIds: [w.enrollmentIds[0]!],
  }
}

beforeEach(() => {
  clearRegistryForTests()
})

describe("**ق-٨٤ — الإدخالُ لمالكه حصراً**: المعلّمُ المالك وأميرُ المكان، ولا أحدَ سواهما", () => {
  it("المعلّمُ المالك يسجّل درسَ حلقته ⇒ **مقبول**", async () => {
    const w = seedWorld()
    const ep = endpointsOf(w)
    const r = await ep.record.invoke(recordInput(w), canonicalActor("u-teacher"), WRITE)
    expect(r.ok, r.ok ? "" : r.decision.reason).toBe(true)
  })

  it("وأميرُ المكان يسجّل على حلقة مسجده ⇒ **مقبول** (ق-٩٠: المعلّمُ أو الأمير)", async () => {
    const w = seedWorld()
    const ep = endpointsOf(w)
    const r = await ep.recordByOwner.invoke(recordInput(w), canonicalActor("u-amir"), WRITE)
    expect(r.ok, r.ok ? "" : r.decision.reason).toBe(true)
  })

  it("**والمديرُ والمشرفون الثلاثة مرفوضون في الخادم** — إشرافٌ بلا إدخال", async () => {
    const w = seedWorld()
    const ep = endpointsOf(w)
    for (const personId of ["u-admin", "u-section-head", "u-rabita", "u-square"]) {
      const owner = await ep.recordByOwner.invoke(recordInput(w), canonicalActor(personId), WRITE)
      expect(owner.ok, `${personId} أدخل درساً ببابِ الأمير`).toBe(false)
      const personal = await ep.record.invoke(recordInput(w), canonicalActor(personId), WRITE)
      expect(personal.ok, `${personId} أدخل درساً ببابِ المعلّم`).toBe(false)
    }
  })

  it("**وأميرُ مسجدٍ آخر مرفوض** — `circle.manage` نوعُها «ذ» فلا تسري على ما تحت ولا جنباً", async () => {
    const w = seedWorld()
    const ep = endpointsOf(w)
    for (const personId of ["u-amir-bilal", "u-amir-omar"]) {
      const r = await ep.recordByOwner.invoke(recordInput(w), canonicalActor(personId), WRITE)
      expect(r.ok, personId).toBe(false)
    }
  })

  it("وحلقةٌ مجهولة ⇒ `NO_SCOPE` ⇒ رفضٌ يُقفل ولا يُفتح (لا استثناءٌ يعبر)", async () => {
    const w = seedWorld()
    const ep = endpointsOf(w)
    const r = await ep.recordByOwner.invoke(
      { ...recordInput(w), circleId: "لا-وجود-لها" },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })
})

describe("**قب-٣٨/CR-012 — القدرةُ الشخصية: دورُك يمنحها وأنت صاحبُها**", () => {
  it("مَن لا تحمل حزمةُ دورِه `circle.teach` ⇒ `DENIED_PERSONAL_NOT_IN_ROLE` **ولو أُسنِدت له الحلقة**", async () => {
    const w = seedWorld()
    // يُسنَد الأميرُ معلّماً للحلقة — والملكيةُ وحدَها لا تفتح باباً (قب-٣٨).
    const circle = w.circles.getCircle(w.circleId)!
    w.circles.saveCircle({ ...circle, teacherPersonId: "u-amir" })
    const ep = endpointsOf(w)
    const r = await ep.record.invoke(recordInput(w), canonicalActor("u-amir"), WRITE)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.decision.reason).toBe("DENIED_PERSONAL_NOT_IN_ROLE")
  })

  it("ومعلّمٌ ليس صاحبَ الحلقة ⇒ `DENIED_PERSONAL_NOT_OWNER` — سببان مميِّزان لا سببٌ مبهم", async () => {
    const w = seedWorld()
    const circle = w.circles.getCircle(w.circleId)!
    w.circles.saveCircle({ ...circle, teacherPersonId: "u-dual" })
    const ep = endpointsOf(w)
    const r = await ep.record.invoke(recordInput(w), canonicalActor("u-teacher"), WRITE)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
  })

  it("وحلقةٌ بلا معلّمٍ مُسنَد ⇒ البابُ الشخصيُّ مقفلٌ للجميع", async () => {
    const w = seedWorld()
    const circle = w.circles.getCircle(w.circleId)!
    w.circles.saveCircle({ ...circle, teacherPersonId: null })
    const ep = endpointsOf(w)
    for (const personId of ["u-teacher", "u-amir", "u-admin"]) {
      const r = await ep.record.invoke(recordInput(w), canonicalActor(personId), WRITE)
      expect(r.ok, personId).toBe(false)
    }
  })

  it("**و«دروسي» صفحةُ صاحبها وحده**: طلبُها بمعرّف غيرك مرفوض", async () => {
    const w = seedWorld()
    const ep = endpointsOf(w)
    const mine = await ep.mine.invoke({ personId: "u-teacher" }, canonicalActor("u-teacher"), DECISION)
    expect(mine.ok).toBe(true)
    for (const personId of ["u-amir", "u-admin", "u-square"]) {
      const r = await ep.mine.invoke({ personId: "u-teacher" }, canonicalActor(personId), DECISION)
      expect(r.ok, personId).toBe(false)
    }
  })
})

describe("العرضُ والتصحيحُ والمنهاج — كلُّ سطحٍ بقدرته المعلنة (G7)", () => {
  it("`circle.view` تفتح دروسَ الحلقة وتقدّمَها للمشرف والمدير — **اطّلاعٌ بلا إدخال**", async () => {
    const w = seedWorld()
    const ep = endpointsOf(w)
    for (const personId of ["u-admin", "u-square", "u-rabita", "u-amir"]) {
      const r = await ep.circleLessons.invoke({ circleId: w.circleId }, canonicalActor(personId), DECISION)
      expect(r.ok, personId).toBe(true)
    }
    for (const personId of ["u-student", "u-media", "u-finance", "u-committee-head"]) {
      const r = await ep.circleLessons.invoke({ circleId: w.circleId }, canonicalActor(personId), DECISION)
      expect(r.ok, personId).toBe(false)
    }
  })

  it("**والتصحيحُ اليدويّ لمالك الإدخال وحده** (ق-٩٢ ذيلاً): الأميرُ يمرّ والمشرفُ يُردّ", async () => {
    const w = seedWorld()
    const ep = endpointsOf(w)
    const input = {
      circleId: w.circleId,
      enrollmentId: w.enrollmentIds[0]!,
      sessionId: SESSION_A,
      completed: true,
      reasonAr: "حضر ولم يُرصد",
    }
    const amir = await ep.markProgress.invoke(input, canonicalActor("u-amir"), WRITE)
    expect(amir.ok, amir.ok ? "" : amir.decision.reason).toBe(true)
    for (const personId of ["u-admin", "u-square", "u-rabita", "u-teacher"]) {
      const r = await ep.markProgress.invoke(input, canonicalActor(personId), WRITE)
      expect(r.ok, personId).toBe(false)
    }
  })

  it("**والمنهاجُ بابٌ مرجعيٌّ في عدسة المدير** (قب-٢٢): يُضاف بياناً — وغيرُه مرفوض", async () => {
    const w = seedWorld()
    const ep = endpointsOf(w)
    const upsert = {
      kind: "curriculum",
      id: "cur-sci",
      ar: "منهاجُ العلمية",
      circleTypeId: "scientific",
    } as const
    const admin = await ep.manhajUpsert.invoke(upsert, canonicalActor("u-admin"), WRITE)
    expect(admin.ok, admin.ok ? "" : admin.decision.reason).toBe(true)

    for (const personId of ["u-amir", "u-teacher", "u-section-head", "u-square", "u-finance"]) {
      const r = await ep.manhajUpsert.invoke(upsert, canonicalActor(personId), WRITE)
      expect(r.ok, personId).toBe(false)
      const v = await ep.manhajView.invoke({}, canonicalActor(personId), DECISION)
      expect(v.ok, personId).toBe(false)
    }
    const view = await ep.manhajView.invoke({}, canonicalActor("u-admin"), DECISION)
    expect(view.ok).toBe(true)
  })

  it("**وشجرةُ المنهاج تُقرأ فيها الصفوفُ الجديدة فوراً** — لا نشرَ كودٍ بينهما", async () => {
    const w = seedWorld()
    const ep = endpointsOf(w)
    await ep.manhajUpsert.invoke(
      { kind: "curriculum", id: "cur-sci", ar: "منهاجُ العلمية", circleTypeId: "scientific" },
      canonicalActor("u-admin"),
      WRITE,
    )
    const view = await ep.manhajView.invoke({}, canonicalActor("u-admin"), DECISION)
    expect(view.ok).toBe(true)
    if (!view.ok) return
    expect(view.value.map((c) => c.id).sort()).toEqual(["cur-baseera", "cur-sci"])
  })

  it("**و«دروسي» تعرض دروسَ حلقاته هو** — مشتقّةً من معرّف الجلسة لا من المدخل", async () => {
    const w = seedWorld()
    const done = recordLesson(w.education, educationContext(w), recordInput(w))
    expect(done.ok).toBe(true)
    if (!done.ok) return
    const ep = endpointsOf(w, [done.value.id])
    const r = await ep.mine.invoke({ personId: "u-teacher" }, canonicalActor("u-teacher"), DECISION)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.personId).toBe("u-teacher")
    expect(r.value.lessons).toHaveLength(1)
    expect(r.value.lessons[0]?.approved).toBe(true)
  })

  it("**ودروسُ الحلقة تحمل تقدّمَها في المصدر نفسِه** (ق-١١١: حقيقةٌ واحدةٌ في الصفحة)", async () => {
    const w = seedWorld()
    const done = recordLesson(w.education, educationContext(w), recordInput(w, SESSION_B))
    expect(done.ok).toBe(true)
    if (!done.ok) return
    const ep = endpointsOf(w, [done.value.id])
    const r = await ep.circleLessons.invoke({ circleId: w.circleId }, canonicalActor("u-amir"), DECISION)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.lessons).toHaveLength(1)
    expect(r.value.progress.completedCells).toBe(1)
    expect(r.value.progress.totalCells).toBe(6)
  })
})
