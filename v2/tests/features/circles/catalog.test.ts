/**
 * **الاختبارُ الإلزاميّ الثاني** (T16) — **النوعُ صفةٌ لا نظام**، والكتالوجُ **بياناتٌ** (قب-٢٢).
 *
 * ع-٨ نصّاً: «لم أقدر على إدارة حلقة الرشيدي **لأن قسمها غير مفعّل**». وجذرُه أنّ النوعَ كان
 * **قسماً يُفعَّل** — أي **باباً ثانياً للمنع** فوق الصلاحية. وفي v2 البابُ الثاني **غيرُ موجود**:
 * لا حقلَ تفعيلٍ في النوع، فلا سؤالَ يُسأل عنه.
 */
import { describe, it, expect } from "vitest"
import { createCircle } from "../../../src/features/circles/services/circles.js"
import { allTypes, typeById } from "../../../src/features/circles/services/catalog.js"
import { circleStats } from "../../../src/features/circles/services/derive.js"
import {
  circlesContext,
  seedCirclesStore,
  SEEDED_TYPES,
} from "./_seed.js"

describe("ع-٨ — **لا نوعَ قائمٌ يُمنع**: كلُّ نوعٍ في الكتالوج يعمل فوراً", () => {
  it("الأنواعُ الأربعة المعتمدة (تحفيظ · على بصيرة · علمية · الرشيدي) كلُّها تُنشئ حلقة", () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    for (const type of allTypes(store)) {
      const done = createCircle(store, ctx, {
        unitId: "khalid",
        typeId: type.id,
        nameAr: `حلقةُ ${type.ar}`,
        capacity: 10,
      })
      expect(done.ok, `نوعٌ قائمٌ مُنع: ${type.id}`).toBe(true)
    }
  })

  it("**والنوعُ حقلٌ على الكيان لا نظامٌ له**: الحلقاتُ الأربع كيانٌ واحدٌ يختلف حقلُه", () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    const made = allTypes(store).map((t) => {
      const done = createCircle(store, ctx, {
        unitId: "khalid",
        typeId: t.id,
        nameAr: `حلقةُ ${t.ar}`,
        capacity: 10,
      })
      if (!done.ok) throw new Error(done.error.code)
      return done.value
    })
    // كلُّها في مستودعٍ واحدٍ وبنيةٍ واحدة — والفرقُ `typeId` وحده.
    expect(new Set(made.map((c) => c.typeId)).size).toBe(SEEDED_TYPES.length)
    for (const circle of made) expect(Object.keys(circle).sort()).toEqual(Object.keys(made[0]!).sort())
  })

  it("**ولا حقلَ تفعيلٍ في النوع أصلاً**: ثلاثةُ حقولٍ لا رابعَ لها", () => {
    const store = seedCirclesStore()
    const type = typeById(store, "rashidi")
    expect(type).not.toBeNull()
    expect(Object.keys(type!).sort()).toEqual(["ar", "id", "tenantId"])
    for (const key of Object.keys(type!)) {
      expect(/active|enabled|activated/i.test(key), `حقلُ تفعيلٍ في النوع: ${key}`).toBe(false)
    }
  })
})

describe("قب-٢٢ — **نوعٌ يُضاف بياناً فيعمل بلا سطر كود** (نظيرُ كتالوج الأنشطة في T10)", () => {
  it("مرفوضٌ ⟵ يُضاف صفّاً ⟵ مقبولٌ فوراً بلا تغيير سطرٍ واحد", () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    const input = { unitId: "khalid", typeId: "quranic_sciences", nameAr: "حلقةُ علوم القرآن", capacity: 15 }

    // ١) قبل الإضافة: مجهولٌ — **رفضٌ بسببٍ مصنَّف** لا صمت.
    const before = createCircle(store, ctx, input)
    expect(before.ok).toBe(false)
    if (!before.ok) expect(before.error.code).toBe("UNKNOWN_CIRCLE_TYPE")

    // ٢) الإضافةُ **صفٌّ في البيانات** — لا نشرَ كودٍ ولا تفعيلَ قسم.
    store.saveType({ tenantId: store.tenantId, id: "quranic_sciences", ar: "علوم القرآن" })

    // ٣) بعدها: يعمل **فوراً**.
    const after = createCircle(store, ctx, input)
    expect(after.ok).toBe(true)
    if (after.ok) expect(after.value.typeId).toBe("quranic_sciences")
  })

  it("**والنوعُ الجديد يدخل الإحصاءَ فوراً** ولو كان صفراً (ع-١٩ لا يعود)", () => {
    const store = seedCirclesStore()
    store.saveType({ tenantId: store.tenantId, id: "quranic_sciences", ar: "علوم القرآن" })
    const stats = circleStats(store, "/men/homs/sq2/khalid/")
    expect(stats.byType.map((r) => r.typeId)).toContain("quranic_sciences")
    expect(stats.byType.find((r) => r.typeId === "quranic_sciences")?.count).toBe(0)
  })
})

describe("ق-٨٩ — قائمةٌ محصورةٌ ⇒ **قائمةٌ لا كتابةٌ حرّة**", () => {
  it("نوعٌ خارج الكتالوج مرفوضٌ — لا يُقبل نصٌّ حرٌّ مكانَ المعرّف", () => {
    const store = seedCirclesStore()
    const rejected = createCircle(store, circlesContext("u-amir"), {
      unitId: "khalid",
      typeId: "أيُّ شيءٍ يكتبه المستخدم",
      nameAr: "حلقة",
      capacity: 10,
    })
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.error.code).toBe("UNKNOWN_CIRCLE_TYPE")
  })

  it("والكتالوجُ يُقرأ مرتّباً حتمياً — لا ترتيبَ يتغيّر بين تشغيلين", () => {
    const store = seedCirclesStore()
    const first = allTypes(store).map((t) => t.id)
    const second = allTypes(seedCirclesStore()).map((t) => t.id)
    expect(first).toEqual(second)
    expect(first).toEqual([...first].sort())
  })

  it("ونوعٌ مجهولٌ في `typeById` ⇒ `null` لا استثناء (قيمةٌ معلنةٌ لا انهيار)", () => {
    expect(typeById(seedCirclesStore(), "لا-وجود-له")).toBeNull()
  })
})
