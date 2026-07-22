/**
 * **الاختباران الإلزاميّان الثالث والسابع** (T16):
 *  - **ع-٥/ع-٧**: الأميرُ **يُنشئ ويدير حلقات مسجده بكل الأنواع**، وخارج مسجده **مرفوض** —
 *    فالحلقةُ **تابعةٌ له** لا بإزائه.
 *  - **ق-٨٤**: **الإدخالُ لمالكه حصراً** — المديرُ والمشرفُ يريان ولا يُدخلان.
 *
 * والفرضُ **في الخادم لا في الواجهة**: النطاقُ يُشتقّ من **الحلقة المخزَّنة** (§٥.٢ ثابت ٢)،
 * والغائبةُ ⇒ `NO_SCOPE` ⇒ **رفضٌ يُقفل ولا يُفتح**.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { makeCirclesEndpoints } from "../../../src/features/circles/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import {
  canonicalActor,
  canonicalDirectory,
  DECISION,
  seedCircle,
  seedCirclesStore,
  SEEDED_TYPES,
  WRITE,
} from "./_seed.js"

beforeEach(() => clearRegistryForTests())

describe("ع-٥ — **الأميرُ يُنشئ حلقةً من كل نوع** (وأهمُّها العلمية التي تعذّرت عليه)", () => {
  it("أميرُ خالد يُنشئ الأنواعَ الأربعة في مسجده — ولا «تعذّرت الإضافة» بعد اليوم", async () => {
    const store = seedCirclesStore()
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    for (const type of SEEDED_TYPES) {
      const done = await ep.create.invoke(
        { unitId: "khalid", typeId: type.id, nameAr: `حلقةُ ${type.ar}`, capacity: 12 },
        canonicalActor("u-amir"),
        WRITE,
      )
      expect(done.ok, `نوعٌ مُنع على الأمير: ${type.id}`).toBe(true)
    }
  })

  it("**والعلميةُ خاصةً** — «من أهم خصائصه» بنصّ البلاغ", async () => {
    const store = seedCirclesStore()
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const done = await ep.create.invoke(
      { unitId: "khalid", typeId: "scientific", nameAr: "الحلقةُ العلمية", capacity: 12 },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(done.ok).toBe(true)
  })
})

describe("ع-٧ — **الحلقةُ تابعةٌ لقائد وحدتها**: نطاقُ «ذ» مطابقةٌ تامّة", () => {
  it("أميرُ بلال لا يُنشئ في مسجد خالد — رفضٌ في الخادم لا إخفاءٌ في الواجهة", async () => {
    const store = seedCirclesStore()
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const rejected = await ep.create.invoke(
      { unitId: "khalid", typeId: "tahfeez", nameAr: "حلقة", capacity: 10 },
      canonicalActor("u-amir-bilal"),
      WRITE,
    )
    expect(rejected.ok).toBe(false)
  })

  it("ولا يدير حلقةً في مسجد خالد — النطاقُ من **الحلقة المخزَّنة**", async () => {
    const store = seedCirclesStore()
    const circleId = seedCircle(store)
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const rejected = await ep.update.invoke(
      { circleId, nameAr: "اسمٌ مسروق" },
      canonicalActor("u-amir-bilal"),
      WRITE,
    )
    expect(rejected.ok).toBe(false)
  })

  it("**والحلقةُ المجهولة ⇒ `NO_SCOPE` ⇒ رفض** — لا «الحارسُ داخل if» (§٥.٢ ثابت ٣)", async () => {
    const store = seedCirclesStore()
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const rejected = await ep.update.invoke(
      { circleId: "circle-لا-وجود-له", nameAr: "اسم" },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("ووحدةٌ مجهولةٌ في الإنشاء ⇒ رفضٌ كذلك (لا إنشاءَ في الفراغ)", async () => {
    const store = seedCirclesStore()
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const rejected = await ep.create.invoke(
      { unitId: "مسجدٌ-لا-وجود-له", typeId: "tahfeez", nameAr: "حلقة", capacity: 10 },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(rejected.ok).toBe(false)
  })
})

describe("ق-٨٤ — **الإدخالُ لمالكه**: المديرُ والمشرفُ يريان ولا يُدخلان", () => {
  const supervisors = ["u-admin", "u-section-head", "u-rabita", "u-square"] as const

  it("لا أحدَ منهم يُنشئ حلقةً في مسجد خالد", async () => {
    for (const personId of supervisors) {
      clearRegistryForTests()
      const store = seedCirclesStore()
      const ep = makeCirclesEndpoints(store, canonicalDirectory)
      const rejected = await ep.create.invoke(
        { unitId: "khalid", typeId: "tahfeez", nameAr: "حلقة", capacity: 10 },
        canonicalActor(personId),
        WRITE,
      )
      expect(rejected.ok, `${personId} أنشأ حلقةً وليس مالكَها`).toBe(false)
    }
  })

  it("**ولا أحدَ منهم يُدخل طالباً** — الإدخالُ عن غيره هو بابُ الغش الذي وُلدت له القاعدة", async () => {
    for (const personId of supervisors) {
      clearRegistryForTests()
      const store = seedCirclesStore()
      const circleId = seedCircle(store)
      const ep = makeCirclesEndpoints(store, canonicalDirectory)
      const rejected = await ep.enroll.invoke(
        { circleId, nameAr: "طالبٌ جديد" },
        canonicalActor(personId),
        WRITE,
      )
      expect(rejected.ok, `${personId} أدخل طالباً في حلقةٍ ليست له`).toBe(false)
    }
  })

  it("**لكنّهم يرون**: المشرفون الثلاثة والمديرُ يقرؤون حلقات نطاقهم (`circle.view` هابطة)", async () => {
    for (const personId of supervisors) {
      clearRegistryForTests()
      const store = seedCirclesStore()
      seedCircle(store)
      const ep = makeCirclesEndpoints(store, canonicalDirectory)
      const seen = await ep.scopeView.invoke({ unitId: "khalid" }, canonicalActor(personId), DECISION)
      expect(seen.ok, `${personId} لم يرَ حلقات نطاقه`).toBe(true)
    }
  })

  it("**والأميرُ وحده يُدخل** — فالفرقُ قدرةٌ لا مسمّى دور", async () => {
    const store = seedCirclesStore()
    const circleId = seedCircle(store)
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const done = await ep.enroll.invoke(
      { circleId, nameAr: "عبد الله" },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(done.ok).toBe(true)
  })

  it("**والطالبُ لا يرى الحلقاتِ أصلاً** (جدولُ الغياب §٣)", async () => {
    const store = seedCirclesStore()
    seedCircle(store)
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const rejected = await ep.scopeView.invoke(
      { unitId: "khalid" },
      canonicalActor("u-student"),
      DECISION,
    )
    expect(rejected.ok).toBe(false)
  })
})
