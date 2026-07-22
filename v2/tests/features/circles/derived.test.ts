/**
 * **الاختباراتُ الإلزاميّة الرابع والخامس والثامن** (T16) — **كلُّ رقمٍ اشتقاق**:
 *  - **ع-٢٩**: تُسنَد ثلاثُ حلقاتٍ لمعلّم ⇒ العددُ **ثلاثةٌ فوراً** (لا صفر).
 *  - **ع-١٩**: الإحصاءُ **يشمل الأنواع كلَّها** لا نوعاً واحداً.
 *  - **ع-٢**: الحلقةُ الواحدة تظهر **مرةً واحدة** في كل قائمةٍ تعرضها.
 *  - **ع-٣**: السعةُ والمتبقّي **يُعرضان عند الإضافة**.
 *
 * والشقُّ البنيويّ لـ«صفر عدّادٍ مخزَّن» في `single-entity.test.ts`؛ وهذا شقُّه السلوكيّ.
 */
import { describe, it, expect } from "vitest"
import {
  assignTeacher,
  archiveCircle,
  createCircle,
} from "../../../src/features/circles/services/circles.js"
import { enroll, endEnrollment } from "../../../src/features/circles/services/enrollment.js"
import {
  circleStats,
  circleView,
  circlesInScope,
  circlesOfTeacher,
  enrollmentsOf,
} from "../../../src/features/circles/services/derive.js"
import {
  circlesContext,
  HOMS_PATH,
  KHALID_PATH,
  seedCircle,
  seedCirclesStore,
  SEEDED_TYPES,
  SQ2_PATH,
} from "./_seed.js"

describe("ع-٢٩ — **أُسنِدت ثلاثُ حلقاتٍ والعددُ ثلاثةٌ فوراً**", () => {
  it("إسنادُ ثلاثِ حلقاتٍ لمعلّمٍ ⇒ `circlesOfTeacher` ثلاثةٌ في اللحظة نفسِها", () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    expect(circlesOfTeacher(store, "u-teacher")).toHaveLength(0)

    for (const nameAr of ["الأولى", "الثانية", "الثالثة"]) {
      const id = seedCircle(store, { nameAr })
      const done = assignTeacher(store, ctx, { circleId: id, teacherPersonId: "u-teacher" })
      expect(done.ok).toBe(true)
    }

    // **لا تحديثَ عدّادٍ ولا مزامنة**: الرقمُ استعلامٌ على المصدر الواحد.
    expect(circlesOfTeacher(store, "u-teacher")).toHaveLength(3)
  })

  it("**ولا يُحسب له ما ليس له**: حلقةُ مسجدٍ آخرَ بمعلّمٍ آخرَ لا تدخل عدَّه", () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    const mine = seedCircle(store, { nameAr: "لي" })
    assignTeacher(store, ctx, { circleId: mine, teacherPersonId: "u-teacher" })
    const other = seedCircle(store, { unitId: "bilal", nameAr: "لغيري", actorPersonId: "u-amir-bilal" })
    assignTeacher(store, circlesContext("u-amir-bilal"), {
      circleId: other,
      teacherPersonId: "u-amir-bilal",
    })
    expect(circlesOfTeacher(store, "u-teacher").map((c) => c.id)).toEqual([mine])
  })

  it("والمؤرشفةُ تخرج من عدّه — الأرشفةُ وسمٌ يُقرأ لا صفٌّ يُمحى", () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    const id = seedCircle(store)
    assignTeacher(store, ctx, { circleId: id, teacherPersonId: "u-teacher" })
    expect(circlesOfTeacher(store, "u-teacher")).toHaveLength(1)
    expect(archiveCircle(store, ctx, { circleId: id }).ok).toBe(true)
    expect(circlesOfTeacher(store, "u-teacher")).toHaveLength(0)
    // والصفُّ باقٍ: الأرشفةُ تعطيلٌ منطقيّ (المادة ٧/٤).
    expect(store.getCircle(id)).not.toBeNull()
  })
})

describe("ع-١٩ — **الإحصاءُ يشمل الأنواعَ كلَّها** لا نوعاً واحداً", () => {
  it("لكل نوعٍ في الكتالوج صفٌّ في الإحصاء **ولو كان صفراً**", () => {
    const store = seedCirclesStore()
    seedCircle(store, { typeId: "baseera" })
    const stats = circleStats(store, KHALID_PATH)
    expect(stats.byType.map((r) => r.typeId).sort()).toEqual(SEEDED_TYPES.map((t) => t.id).sort())
    expect(stats.byType.find((r) => r.typeId === "baseera")?.count).toBe(1)
    expect(stats.byType.find((r) => r.typeId === "rashidi")?.count).toBe(0)
  })

  it("**والإجماليُّ مجموعُ التفصيل** — لا رقمان يتنازعان (ق-١١١)", () => {
    const store = seedCirclesStore()
    for (const type of SEEDED_TYPES) seedCircle(store, { typeId: type.id, nameAr: type.ar })
    const stats = circleStats(store, KHALID_PATH)
    expect(stats.total).toBe(SEEDED_TYPES.length)
    expect(stats.byType.reduce((sum, r) => sum + r.count, 0)).toBe(stats.total)
  })

  it("**والتجميعُ هابطٌ منطوقٌ على نطاقه** (ق-١١٠): المربعُ يجمع مسجدَيه، والمسجدُ نفسَه", () => {
    const store = seedCirclesStore()
    seedCircle(store, { unitId: "khalid" })
    seedCircle(store, { unitId: "bilal", actorPersonId: "u-amir-bilal" })
    expect(circleStats(store, KHALID_PATH).total).toBe(1)
    expect(circleStats(store, SQ2_PATH).total).toBe(2)
    expect(circleStats(store, HOMS_PATH).total).toBe(2)
  })

  it("والمؤرشفةُ لا تُحتسب في الإحصاء", () => {
    const store = seedCirclesStore()
    const id = seedCircle(store)
    expect(circleStats(store, KHALID_PATH).total).toBe(1)
    archiveCircle(store, circlesContext("u-amir"), { circleId: id })
    expect(circleStats(store, KHALID_PATH).total).toBe(0)
  })
})

describe("ع-٢ — **لا تكرار**: الحلقةُ الواحدة مرةً واحدةً في كل قائمة", () => {
  it("قائمةُ النطاق: كلُّ معرّفٍ مرةً واحدةً ولو أُسنِد لها معلّمٌ وطلاب", () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    const id = seedCircle(store)
    assignTeacher(store, ctx, { circleId: id, teacherPersonId: "u-teacher" })
    enroll(store, ctx, { circleId: id, nameAr: "طالبٌ أول" })
    enroll(store, ctx, { circleId: id, nameAr: "طالبٌ ثانٍ" })

    const ids = circlesInScope(store, KHALID_PATH).map((c) => c.id)
    expect(ids).toEqual([id])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("**ولا يُضاعفها التجميعُ الهابط**: تظهر مرةً في المسجد ومرةً في المربع لا مرتين في أحدهما", () => {
    const store = seedCirclesStore()
    seedCircle(store)
    seedCircle(store, { unitId: "bilal", actorPersonId: "u-amir-bilal" })
    const sq2 = circlesInScope(store, SQ2_PATH).map((c) => c.id)
    expect(new Set(sq2).size).toBe(sq2.length)
    expect(sq2).toHaveLength(2)
  })

  it("**ولا يُضاعفها المرشّح**: نوعٌ واحدٌ مرشّحٌ يعطي القائمةَ نفسَها منقّاةً لا مضاعفة", () => {
    const store = seedCirclesStore()
    const tahfeez = seedCircle(store, { typeId: "tahfeez", nameAr: "تحفيظ" })
    seedCircle(store, { typeId: "scientific", nameAr: "علمية" })
    const filtered = circlesInScope(store, KHALID_PATH, "tahfeez").map((c) => c.id)
    expect(filtered).toEqual([tahfeez])
  })

  it("و«حلقاتي» بلا تكرارٍ كذلك", () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    const id = seedCircle(store)
    assignTeacher(store, ctx, { circleId: id, teacherPersonId: "u-teacher" })
    // إسنادٌ ثانٍ للشخص نفسِه **يبقيها واحدة** — لا صفَّ إسنادٍ ثانٍ (الحقلُ على الكيان).
    assignTeacher(store, ctx, { circleId: id, teacherPersonId: "u-teacher" })
    expect(circlesOfTeacher(store, "u-teacher").map((c) => c.id)).toEqual([id])
  })

  it("والملتحقون بلا تكرار، والمنتهيةُ عضويتُه يخرج من القائمة الحاليّة", () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    const id = seedCircle(store)
    const first = enroll(store, ctx, { circleId: id, nameAr: "الأول" })
    enroll(store, ctx, { circleId: id, nameAr: "الثاني" })
    if (!first.ok) throw new Error(first.error.code)
    expect(enrollmentsOf(store, id)).toHaveLength(2)
    expect(endEnrollment(store, ctx, { enrollmentId: first.value.id }).ok).toBe(true)
    expect(enrollmentsOf(store, id).map((e) => e.nameAr)).toEqual(["الثاني"])
  })
})

describe("ع-٣ — **السعةُ تظهر عند الإضافة**: سعةٌ ومُلتحقون ومتبقٍّ من مصدرٍ واحد", () => {
  it("`circleView` تعطي السعةَ وعددَ الملتحقين والمتبقّي — والرقمُ يتحرّك مع الإضافة", () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    const id = seedCircle(store, { capacity: 3 })

    const before = circleView(store, id)
    expect(before?.capacity).toBe(3)
    expect(before?.enrolled).toBe(0)
    expect(before?.remaining).toBe(3)
    expect(before?.full).toBe(false)

    enroll(store, ctx, { circleId: id, nameAr: "الأول" })
    enroll(store, ctx, { circleId: id, nameAr: "الثاني" })
    enroll(store, ctx, { circleId: id, nameAr: "الثالث" })

    const after = circleView(store, id)
    expect(after?.enrolled).toBe(3)
    expect(after?.remaining).toBe(0)
    expect(after?.full).toBe(true)
  })

  it("**والسعةُ تُعرض ولا تُفرض** (عقدُ الوحدة §٦): الالتحاقُ فوق السعة يمرّ ويُعلَن `remaining` سالباً", () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    const id = seedCircle(store, { capacity: 1 })
    expect(enroll(store, ctx, { circleId: id, nameAr: "الأول" }).ok).toBe(true)
    const over = enroll(store, ctx, { circleId: id, nameAr: "الثاني" })
    expect(over.ok).toBe(true)
    expect(circleView(store, id)?.remaining).toBe(-1)
    expect(circleView(store, id)?.full).toBe(true)
  })

  it("وسعةٌ سالبةٌ مرفوضةٌ عند الحدّ (`INVALID_CAPACITY`) — التحقّقُ قبل المنطق", () => {
    const store = seedCirclesStore()
    const rejected = seedCircleRaw(store, -1)
    expect(rejected).toBe("INVALID_CAPACITY")
  })

  it("واسمٌ فارغٌ مرفوضٌ كذلك (`EMPTY_NAME`)", () => {
    const store = seedCirclesStore()
    expect(seedCircleRaw(store, 10, "   ")).toBe("EMPTY_NAME")
  })

  it("و`circleView` لحلقةٍ مجهولةٍ ⇒ `null` لا استثناء", () => {
    expect(circleView(seedCirclesStore(), "لا-وجود-لها")).toBeNull()
  })
})

/** مُعينٌ يعيد رمزَ الخطأ بدل الرمي — فتُقرأ التوكيداتُ على القيمة المعلنة (المادة ٣/٤). */
function seedCircleRaw(
  store: ReturnType<typeof seedCirclesStore>,
  capacity: number,
  nameAr = "حلقة",
): string {
  const done = createCircle(store, circlesContext("u-amir"), {
    unitId: "khalid",
    typeId: "tahfeez",
    nameAr,
    capacity,
  })
  return done.ok ? "OK" : done.error.code
}
