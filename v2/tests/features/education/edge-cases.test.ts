/**
 * حالاتُ الحافة — **الفروعُ التي لا يبلغها المسارُ السعيد**، وهي حيث تختبئ أعطابُ الميدان.
 *
 * والقاعدةُ المتبعة (TESTING_POLICY §٣): التغطيةُ شرطٌ لازمٌ غيرُ كافٍ — فكلُّ حالةٍ هنا
 * **توكيدٌ ذو معنى** على سلوكٍ معلنٍ في العقد، لا تشغيلُ سطرٍ لرفع نسبة.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { makeEducationEndpoints } from "../../../src/features/education/server/endpoints.js"
import { settingList } from "../../../src/features/education/services/context.js"
import {
  upsertBook,
  upsertLevel,
  upsertSession,
} from "../../../src/features/education/services/curriculum.js"
import {
  lessonsOfTeacher,
  recordLesson,
} from "../../../src/features/education/services/lessons.js"
import { curriculumProgress, markProgress } from "../../../src/features/education/services/progress.js"
import { approvedTeachingLoad } from "../../../src/features/education/services/teacherHours.js"
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
  settingsWith,
  circleDays,
  NEXT_DAY,} from "./_seed.js"

const FROM = new Date("2026-07-01T00:00:00.000Z")
const TO = new Date("2026-08-01T00:00:00.000Z")

beforeEach(() => {
  clearRegistryForTests()
})

describe("قراءةُ الإعداد — **النوعُ الخاطئ حالةٌ برمجيةٌ تُلقى لا خطأُ عمل** (المادة ٣/٤)", () => {
  it("طلبُ قائمةٍ من إعدادٍ رقميّ يرمي — فلا يمرّ مدخلٌ فاسدٌ صامتاً إلى منطق العمل", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    expect(() => settingList(ctx, "edu.grade.max", "/")).toThrow()
    expect(settingList(ctx, "edu.paid_hours.curricula", "/").length).toBeGreaterThan(0)
  })
})

describe("صفوفُ المنهاج — **رتبةٌ غيرُ صحيحة تُردّ بسببها المميِّز** (التحقّق عند الحدّ)", () => {
  it("رتبةٌ سالبة أو كسريّة ⇒ `INVALID_ORDINAL` في المستوى والكتاب والمجلس معاً", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    const level = upsertLevel(w.education, ctx, {
      id: "lvl-x",
      curriculumId: "cur-baseera",
      ar: "مستوى",
      ordinal: -1,
    })
    expect(level.ok === false && level.error.code).toBe("INVALID_ORDINAL")

    const book = upsertBook(w.education, ctx, {
      id: "book-x",
      levelId: "lvl-1",
      ar: "كتاب",
      ordinal: 1.5,
    })
    expect(book.ok === false && book.error.code).toBe("INVALID_ORDINAL")

    const session = upsertSession(w.education, ctx, {
      id: "ses-x",
      bookId: "book-1",
      ar: "مجلس",
      ordinal: -1,
    })
    expect(session.ok === false && session.error.code).toBe("INVALID_ORDINAL")
  })
})

describe("الترتيبُ حتميّ — **درسان وصورتان يُقرآن بترتيبٍ ثابت** لا بترتيب الإدخال", () => {
  // **ويومان لا يومٌ واحد** (CR-016): الكيانُ «الجلسةُ **اليومية**» ومفتاحُه (حلقة × يوم)
  // — فدرسان لحلقةٍ واحدةٍ يقعان في يومين، وإعادةُ اليوم نفسِه **استبدالٌ** لا إضافة (ق-٩٠).
  it("دروسُ المعلّم وصورُ الدرس مرتّبةٌ حتمياً، والصورُ تُستبدَل كتلةً عند إعادة التسجيل", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    const first = recordLesson(w.education, ctx, {
      circleId: w.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 60,
      presentEnrollmentIds: [w.enrollmentIds[0]!],
      photoKeys: ["b.jpg", "a.jpg"],
    })
    const second = recordLesson(w.education, ctx, {
      circleId: w.circleId,
      sessionId: SESSION_B,
      heldAt: NEXT_DAY,
      durationMinutes: 45,
      presentEnrollmentIds: [w.enrollmentIds[1]!],
    })
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return

    expect(lessonsOfTeacher(ctx, "u-teacher").map((l) => l.id)).toEqual([
      first.value.id,
      second.value.id,
    ])
    expect(first.value.photoKeys).toHaveLength(2)

    // **إعادةُ التسجيل تستبدل الصورَ كتلةً** — فلا تبقى صورةٌ يتيمةٌ من تسجيلٍ سابق.
    const again = recordLesson(w.education, ctx, {
      circleId: w.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 60,
      presentEnrollmentIds: [w.enrollmentIds[0]!],
      photoKeys: ["c.jpg"],
    })
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(again.value.photoKeys).toEqual(["c.jpg"])
  })
})

describe("التصحيحُ اليدويّ — **سجلٌّ يُلحق ولا يُمحى، وآخرُ بصمةٍ تغلب**", () => {
  it("بصمتان متتاليتان على الخليّة نفسِها ⇒ الأحدثُ هو الحاكم، والسجلُّ يحفظ الاثنتين", () => {
    const w = seedWorld()
    const early = educationContext(w, { actorPersonId: "u-amir", now: new Date("2026-07-22T09:00:00.000Z") })
    const late = educationContext(w, { actorPersonId: "u-amir", now: new Date("2026-07-23T09:00:00.000Z") })

    expect(
      markProgress(w.education, early, {
        circleId: w.circleId,
        enrollmentId: w.enrollmentIds[0]!,
        sessionId: SESSION_A,
        completed: true,
        reasonAr: "رُصد سهواً",
      }).ok,
    ).toBe(true)
    expect(
      markProgress(w.education, late, {
        circleId: w.circleId,
        enrollmentId: w.enrollmentIds[0]!,
        sessionId: SESSION_A,
        completed: false,
        reasonAr: "تبيّن أنه لم يحضر",
      }).ok,
    ).toBe(true)

    expect(w.education.corrections()).toHaveLength(2)
    const matrix = curriculumProgress(w.education, late, w.circleId)
    expect(matrix.ok).toBe(true)
    if (!matrix.ok) return
    const cell = matrix.value.rows
      .find((r) => r.enrollmentId === w.enrollmentIds[0])
      ?.cells.find((c) => c.sessionId === SESSION_A)
    expect(cell?.completed).toBe(false)
    expect(cell?.source).toBe("correction")
  })

  it("**وتصحيحٌ على حلقةٍ بلا منهاجٍ مرفوض** — لا مجلسَ يُصحَّح حيث لا منهاج", () => {
    const w = seedWorld()
    const done = markProgress(w.education, educationContext(w, { actorPersonId: "u-amir" }), {
      circleId: w.tahfeezCircleId,
      enrollmentId: "enr-1",
      sessionId: SESSION_A,
      completed: true,
      reasonAr: "سبب",
    })
    expect(done.ok === false && done.error.code).toBe("NO_CURRICULUM_FOR_TYPE")
  })

  it("**وحلقةٌ مجهولةٌ في التصحيح ⇒ `UNKNOWN_CIRCLE`**", () => {
    const w = seedWorld()
    const done = markProgress(w.education, educationContext(w, { actorPersonId: "u-amir" }), {
      circleId: "لا-وجود-لها",
      enrollmentId: "enr-1",
      sessionId: SESSION_A,
      completed: true,
      reasonAr: "سبب",
    })
    expect(done.ok === false && done.error.code).toBe("UNKNOWN_CIRCLE")
  })
})

describe("اشتقاقُ ق-٨٦ — **ما لا يُقابله منهاجٌ أو حلقةٌ لا يُحتسب، ولا يرمي**", () => {
  it("نوعُ الحلقة تغيّر بعد الدرس إلى نوعٍ مأجورٍ **بلا منهاج** ⇒ لا يُحتسب ولا يُعطب الاشتقاق", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    const done = recordLesson(w.education, ctx, {
      circleId: w.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 60,
      presentEnrollmentIds: [w.enrollmentIds[0]!],
    })
    expect(done.ok).toBe(true)
    if (!done.ok) return

    // النوعُ صفةٌ على الحلقة (ب-٢٨) — فتغييرُها تغييرُ صفةٍ لا نقلٌ بين أنظمة.
    const circle = w.circles.getCircle(w.circleId)!
    w.circles.saveCircle({ ...circle, typeId: "scientific" })

    const settings = settingsWith([
      {
        settingId: "edu.paid_hours.curricula",
        scopePath: "/",
        value: ["baseera", "scientific"],
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    ])
    const load = approvedTeachingLoad(
      w.education,
      educationContext(w, { approvedLessonIds: [done.value.id], settings }),
      { teacherPersonId: "u-teacher", from: FROM, to: TO },
    )
    expect(load.ok).toBe(true)
    if (!load.ok) return
    expect(load.value.totalMinutes).toBe(0)
  })

  it("**ودرسٌ لحلقةٍ لم تعد تُقرأ من المنفذ لا يُحتسب** — ولا يرمي استثناءً يعبر الحدّ", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    const done = recordLesson(w.education, ctx, {
      circleId: w.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 60,
      presentEnrollmentIds: [w.enrollmentIds[0]!],
    })
    expect(done.ok).toBe(true)
    if (!done.ok) return

    const blind = {
      ...educationContext(w, { approvedLessonIds: [done.value.id] }),
      circleOf: () => null,
    }
    const load = approvedTeachingLoad(w.education, blind, {
      teacherPersonId: "u-teacher",
      from: FROM,
      to: TO,
    })
    expect(load.ok && load.value.totalMinutes).toBe(0)
  })

  // **ويومان لا يومٌ واحد** (CR-016): جلسةٌ واحدةٌ لكل (حلقة × يوم) — فالجمعُ يُقاس على يومين.
  it("**ودرسان في الحلقة نفسِها يُجمعان في سطرٍ واحد** — لا سطرٌ لكل درس", () => {
    const w = seedWorld()
    const ctx = educationContext(w)
    const a = recordLesson(w.education, ctx, {
      circleId: w.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 60,
      presentEnrollmentIds: [w.enrollmentIds[0]!],
    })
    const b = recordLesson(w.education, ctx, {
      circleId: w.circleId,
      sessionId: SESSION_B,
      heldAt: NEXT_DAY,
      durationMinutes: 30,
      presentEnrollmentIds: [w.enrollmentIds[0]!],
    })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    const load = approvedTeachingLoad(
      w.education,
      educationContext(w, { approvedLessonIds: [a.value.id, b.value.id] }),
      { teacherPersonId: "u-teacher", from: FROM, to: TO },
    )
    expect(load.ok).toBe(true)
    if (!load.ok) return
    expect(load.value.lines).toHaveLength(1)
    expect(load.value.lines[0]?.lessonIds).toEqual([a.value.id, b.value.id])
    expect(load.value.totalMinutes).toBe(90)
  })
})

describe("سطحُ العرض — **حلقةٌ بلا منهاجٍ تُعرض بجدولٍ فارغٍ لا برميةٍ ولا بشاشةٍ بيضاء**", () => {
  it("`education.circle.lessons.view` على حلقةٍ نوعُها بلا منهاج ⇒ مصفوفةٌ فارغةٌ مُعلنة", async () => {
    const w = seedWorld()
    const ep = makeEducationEndpoints(w.education, educationPorts(w), SETTINGS, () => false, circleDays(w))
    const r = await ep.circleLessons.invoke(
      { circleId: w.tahfeezCircleId },
      canonicalActor("u-amir"),
      DECISION,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.curriculumAr).toBe("")
    expect(r.value.progress.sessions).toEqual([])
    expect(r.value.progress.totalCells).toBe(0)
    expect(r.value.lessons).toEqual([])
  })

  it("**وسطرُ الدرس يحمل مجلسَه ومكانَه وحالَه** — كلُّها من المصدر الواحد (ق-١١١)", async () => {
    const w = seedWorld()
    const done = recordLesson(w.education, educationContext(w), {
      circleId: w.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 60,
      venueAr: "المعهد",
      presentEnrollmentIds: [w.enrollmentIds[0]!],
      photoKeys: ["a.jpg"],
    })
    expect(done.ok).toBe(true)
    if (!done.ok) return
    const ep = makeEducationEndpoints(w.education, educationPorts(w), SETTINGS, () => true, circleDays(w, { isLessonApproved: () => true }))
    const r = await ep.circleLessons.invoke(
      { circleId: w.circleId },
      canonicalActor("u-amir"),
      DECISION,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const row = r.value.lessons[0]!
    expect(row.sessionAr).toBe("المجلسُ الأول")
    expect(row.venueAr).toBe("المعهد")
    expect(row.presentCount).toBe(1)
    expect(row.rosterCount).toBe(3)
    expect(row.photoCount).toBe(1)
    expect(row.approved).toBe(true)
  })
})
