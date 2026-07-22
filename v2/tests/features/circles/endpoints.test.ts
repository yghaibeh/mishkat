/**
 * سطوحُ الخادم التسعة — عقدُ الوحدة §٧: **قدرةٌ معلنة · نطاقٌ من الكيان المخزَّن · فاعلٌ من
 * الجلسة**. وهذا الملفّ يفحص السطوحَ نفسَها: الحدودَ والأخطاءَ المصنَّفة وحالاتِ الحواف.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { makeCirclesEndpoints } from "../../../src/features/circles/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { registeredServerFns } from "../../../src/server/defineServerFn.js"
import { endEnrollment, enroll } from "../../../src/features/circles/services/enrollment.js"
import { createCircle, updateCircle } from "../../../src/features/circles/services/circles.js"
import {
  canonicalActor,
  canonicalDirectory,
  circlesContext,
  DECISION,
  seedCircle,
  seedCirclesStore,
  SEEDED_TYPES,
  WRITE,
} from "./_seed.js"

beforeEach(() => clearRegistryForTests())

describe("§٧ — **كلُّ سطحٍ يعلن قدرتَه ونيّتَه ونطاقَه** (G7)", () => {
  it("تسعةُ سطوحٍ مسجَّلةٌ بأسمائها وقدراتها — لا سطحَ عاشرٌ ولا قدرةٌ رابعة", () => {
    const store = seedCirclesStore()
    makeCirclesEndpoints(store, canonicalDirectory)
    const mine = registeredServerFns()
      .map((fn) => fn.declaration)
      .filter((d) => d.name.startsWith("circle."))
    expect(mine).toHaveLength(9)
    expect(new Set(mine.map((d) => d.capability))).toEqual(
      new Set(["circle.view", "circle.manage", "circle.teach"]),
    )
    for (const d of mine) expect(d.scope, d.name).not.toBeUndefined()
  })

  it("والقراءةُ نيّتُها قراءةٌ والكتابةُ كتابة — فجلسةُ الانتحال القرائي تُوقف الكاتبات", () => {
    const store = seedCirclesStore()
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    expect(ep.scopeView.declaration.intent).toBe("read")
    expect(ep.statsView.declaration.intent).toBe("read")
    expect(ep.mine.declaration.intent).toBe("read")
    for (const name of ["create", "update", "archive", "assignTeacher", "enroll", "endEnrollment"] as const) {
      expect(ep[name].declaration.intent, name).toBe("write")
    }
  })

  it("**والانتحالُ القرائيُّ لا يكتب** (ب-٤٠أ): أميرٌ منتحَلٌ يُمنع من الإنشاء ويُسمح له بالقراءة", async () => {
    const store = seedCirclesStore()
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const impersonated = { ...canonicalActor("u-amir"), impersonatedBy: "u-admin" }
    const write = await ep.create.invoke(
      { unitId: "khalid", typeId: "tahfeez", nameAr: "حلقة", capacity: 10 },
      impersonated,
      WRITE,
    )
    expect(write.ok).toBe(false)
    if (!write.ok) expect(write.decision.reason).toBe("DENIED_IMPERSONATION_READONLY")
    const read = await ep.scopeView.invoke({ unitId: "khalid" }, impersonated, DECISION)
    expect(read.ok).toBe(true)
  })
})

describe("§٧ — **المدخلُ الناقصُ يُقفل ولا يُفتح** (§٥.٢ ثابت ٣)", () => {
  it("مُحلِّلُ النطاق بلا معرّفٍ أصلاً ⇒ `NO_SCOPE` ⇒ رفضٌ على كل الأنماط الثلاثة", async () => {
    const store = seedCirclesStore()
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const amir = canonicalActor("u-amir")
    const missing = undefined as unknown as string

    const noUnit = await ep.scopeView.invoke({ unitId: missing }, amir, DECISION)
    expect(noUnit.ok).toBe(false)

    const noCircle = await ep.archive.invoke({ circleId: missing }, amir, WRITE)
    expect(noCircle.ok).toBe(false)

    const noEnrollment = await ep.endEnrollment.invoke({ enrollmentId: missing }, amir, WRITE)
    expect(noEnrollment.ok).toBe(false)
  })
})

describe("§٧ — نموذجُ العرض: **مصدرُ بياناتٍ واحدٌ للصفحة** (ق-١١١)", () => {
  it("`circle.scope.view` تعطي حلقاتِ النطاق وكتالوجَ الأنواع وإحصاءَها من نداءٍ واحد", async () => {
    const store = seedCirclesStore()
    seedCircle(store, { typeId: "tahfeez", nameAr: "الأولى" })
    seedCircle(store, { typeId: "scientific", nameAr: "الثانية" })
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const seen = await ep.scopeView.invoke({ unitId: "khalid" }, canonicalActor("u-amir"), DECISION)
    if (!seen.ok) throw new Error(seen.decision.reason)
    expect(seen.value.unitPath).toBe("/men/homs/sq2/khalid/")
    expect(seen.value.circles).toHaveLength(2)
    expect(seen.value.types.map((t) => t.id).sort()).toEqual(SEEDED_TYPES.map((t) => t.id).sort())
    // السعةُ والملتحقون والمتبقّي **في الصفّ نفسِه** — فلا يُطلب رقمٌ من مصدرٍ ثانٍ (ع-٣).
    for (const row of seen.value.circles) {
      expect(row.capacity).toBeGreaterThan(0)
      expect(row.remaining).toBe(row.capacity - row.enrolled)
    }
  })

  it("**والأميرُ يعدّل حلقتَه ويؤرشفها ويُنهي عضويةً** عبر السطوح لا بالحقن في المستودع", async () => {
    const store = seedCirclesStore()
    const circleId = seedCircle(store, { nameAr: "قبلَ التعديل" })
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const amir = canonicalActor("u-amir")

    const renamed = await ep.update.invoke(
      { circleId, nameAr: "بعدَ التعديل", typeId: "scientific", capacity: 25 },
      amir,
      WRITE,
    )
    if (!renamed.ok) throw new Error(renamed.decision.reason)
    expect(renamed.value.ok).toBe(true)
    expect(store.getCircle(circleId)?.nameAr).toBe("بعدَ التعديل")
    expect(store.getCircle(circleId)?.typeId).toBe("scientific")

    const archived = await ep.archive.invoke({ circleId }, amir, WRITE)
    if (!archived.ok) throw new Error(archived.decision.reason)
    expect(archived.value.ok).toBe(true)
    expect(store.getCircle(circleId)?.archivedAt).not.toBeNull()
  })

  it("**والمرشّحُ واحدٌ بالنوع** — لا تبويباتٌ متفرّقة (ب-٢٨/ع-٦)", async () => {
    const store = seedCirclesStore()
    seedCircle(store, { typeId: "tahfeez", nameAr: "الأولى" })
    seedCircle(store, { typeId: "scientific", nameAr: "الثانية" })
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const seen = await ep.scopeView.invoke(
      { unitId: "khalid", typeId: "scientific" },
      canonicalActor("u-amir"),
      DECISION,
    )
    if (!seen.ok) throw new Error(seen.decision.reason)
    expect(seen.value.circles.map((c) => c.nameAr)).toEqual(["الثانية"])
    expect(seen.value.selectedTypeId).toBe("scientific")
  })

  it("ومرشّحٌ بنوعٍ مجهولٍ يعطي قائمةً فارغةً لا انهياراً (المدخلُ لا يُسقط الصفحة)", async () => {
    const store = seedCirclesStore()
    seedCircle(store)
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const seen = await ep.scopeView.invoke(
      { unitId: "khalid", typeId: "لا-وجود-له" },
      canonicalActor("u-amir"),
      DECISION,
    )
    if (!seen.ok) throw new Error(seen.decision.reason)
    expect(seen.value.circles).toHaveLength(0)
  })

  it("و«حلقاتي» تحمل سعةَ كلِّ حلقةٍ وعددَ ملتحقيها — نفسُ المصدر لا نسخةٌ ثانية", async () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    const id = seedCircle(store, { capacity: 5 })
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    await ep.assignTeacher.invoke(
      { circleId: id, teacherPersonId: "u-teacher" },
      canonicalActor("u-amir"),
      WRITE,
    )
    enroll(store, ctx, { circleId: id, nameAr: "طالب" })
    const seen = await ep.mine.invoke({ personId: "u-teacher" }, canonicalActor("u-teacher"), DECISION)
    if (!seen.ok) throw new Error(seen.decision.reason)
    expect(seen.value.circles[0]?.capacity).toBe(5)
    expect(seen.value.circles[0]?.enrolled).toBe(1)
    expect(seen.value.circles[0]?.remaining).toBe(4)
  })
})

describe("§١١ — أخطاءُ العمل قيمٌ معلنةٌ مصنَّفة (المادة ٣/٤)", () => {
  it("إنهاءُ عضويةٍ مجهولةٍ ⇒ `UNKNOWN_ENROLLMENT`، وإنهاؤها مرتين ⇒ `ALREADY_LEFT`", async () => {
    const store = seedCirclesStore()
    const circleId = seedCircle(store)
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const amir = canonicalActor("u-amir")

    // عضويةٌ مجهولةٌ ⇒ `NO_SCOPE` **قبل جسم الدالة** (§٥.٢ ثابت ٣: يُقفل ولا يُفتح)…
    const unknown = await ep.endEnrollment.invoke({ enrollmentId: "لا-وجود-لها" }, amir, WRITE)
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
    // …ودفاعاً في العمق تحته: الخدمةُ نفسُها تعيد الرمزَ المصنَّف.
    const direct = endEnrollment(store, circlesContext("u-amir"), { enrollmentId: "لا-وجود-لها" })
    expect(direct.ok).toBe(false)
    if (!direct.ok) expect(direct.error.code).toBe("UNKNOWN_ENROLLMENT")

    const added = await ep.enroll.invoke({ circleId, nameAr: "طالب" }, amir, WRITE)
    if (!added.ok) throw new Error(added.decision.reason)
    if (!added.value.ok) throw new Error(added.value.error.code)
    const enrollmentId = added.value.value.id

    const first = await ep.endEnrollment.invoke({ enrollmentId }, amir, WRITE)
    if (!first.ok) throw new Error(first.decision.reason)
    expect(first.value.ok).toBe(true)

    const second = await ep.endEnrollment.invoke({ enrollmentId }, amir, WRITE)
    if (!second.ok) throw new Error(second.decision.reason)
    expect(second.value.ok).toBe(false)
    if (!second.value.ok) expect(second.value.error.code).toBe("ALREADY_LEFT")
  })

  it("**واسمُ الطالب حرٌّ بلا هوية** (ق-٣١) — لكنّه ليس فارغاً", async () => {
    const store = seedCirclesStore()
    const circleId = seedCircle(store)
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const empty = await ep.enroll.invoke({ circleId, nameAr: "  " }, canonicalActor("u-amir"), WRITE)
    if (!empty.ok) throw new Error(empty.decision.reason)
    expect(empty.value.ok).toBe(false)
    if (!empty.value.ok) expect(empty.value.error.code).toBe("EMPTY_NAME")
  })

  it("والالتحاقُ بحلقةٍ مؤرشفةٍ مرفوضٌ (`CIRCLE_ARCHIVED`)", async () => {
    const store = seedCirclesStore()
    const circleId = seedCircle(store)
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    await ep.archive.invoke({ circleId }, canonicalActor("u-amir"), WRITE)
    const rejected = await ep.enroll.invoke(
      { circleId, nameAr: "طالب" },
      canonicalActor("u-amir"),
      WRITE,
    )
    if (!rejected.ok) throw new Error(rejected.decision.reason)
    expect(rejected.value.ok).toBe(false)
    if (!rejected.value.ok) expect(rejected.value.error.code).toBe("CIRCLE_ARCHIVED")
  })

  it("وأرشفةٌ ثانيةٌ على مؤرشفةٍ ⇒ `CIRCLE_ARCHIVED` (لا ختمٌ ثانٍ يمحو الأول)", async () => {
    const store = seedCirclesStore()
    const circleId = seedCircle(store)
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    await ep.archive.invoke({ circleId }, canonicalActor("u-amir"), WRITE)
    const second = await ep.archive.invoke({ circleId }, canonicalActor("u-amir"), WRITE)
    if (!second.ok) throw new Error(second.decision.reason)
    expect(second.value.ok).toBe(false)
  })

  it("والتعديلُ يقبل الحقولَ الثلاثةَ وحدها، ونوعاً من الكتالوج حصراً", () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    const circleId = seedCircle(store)

    const renamed = updateCircle(store, ctx, { circleId, nameAr: "الاسمُ الجديد" })
    expect(renamed.ok).toBe(true)
    if (renamed.ok) expect(renamed.value.nameAr).toBe("الاسمُ الجديد")

    const retyped = updateCircle(store, ctx, { circleId, typeId: "scientific" })
    expect(retyped.ok).toBe(true)
    if (retyped.ok) expect(retyped.value.typeId).toBe("scientific")

    const resized = updateCircle(store, ctx, { circleId, capacity: 30 })
    expect(resized.ok).toBe(true)
    if (resized.ok) expect(resized.value.capacity).toBe(30)

    const bogus = updateCircle(store, ctx, { circleId, typeId: "لا-وجود-له" })
    expect(bogus.ok).toBe(false)
    if (!bogus.ok) expect(bogus.error.code).toBe("UNKNOWN_CIRCLE_TYPE")

    const negative = updateCircle(store, ctx, { circleId, capacity: -1 })
    expect(negative.ok).toBe(false)
    if (!negative.ok) expect(negative.error.code).toBe("INVALID_CAPACITY")

    const unknown = updateCircle(store, ctx, { circleId: "لا-وجود-لها", nameAr: "x" })
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.error.code).toBe("UNKNOWN_CIRCLE")
  })

  it("**والتعديلُ بلا تغييرٍ يُبقي الحلقةَ كما هي** — لا حقلَ يُصفَّر بالسهو", () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    const circleId = seedCircle(store, { capacity: 7, nameAr: "كما هي" })
    const before = store.getCircle(circleId)!
    const after = updateCircle(store, ctx, { circleId })
    expect(after.ok).toBe(true)
    if (after.ok) {
      expect(after.value.nameAr).toBe(before.nameAr)
      expect(after.value.capacity).toBe(before.capacity)
      expect(after.value.typeId).toBe(before.typeId)
    }
  })

  it("وإنشاءٌ بوحدةٍ مجهولةٍ في الخدمة ⇒ `UNKNOWN_UNIT` (دفاعٌ في العمق تحت النطاق)", () => {
    const store = seedCirclesStore()
    const rejected = createCircle(store, circlesContext("u-amir"), {
      unitId: "مسجدٌ-لا-وجود-له",
      typeId: "tahfeez",
      nameAr: "حلقة",
      capacity: 10,
    })
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.error.code).toBe("UNKNOWN_UNIT")
  })
})
