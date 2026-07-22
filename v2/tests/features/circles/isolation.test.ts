/**
 * **الاختبارُ الإلزاميّ التاسع** (T16) — **عزلُ الشبكة (قب-١٨) وعزلُ النطاق على كل المسارات**.
 *
 * عزلُ الشبكة **بنيويّ**: مستودعٌ لكل شبكة، فلا مِقبضَ عابرٌ بين شبكتين أصلاً؛ و`tenantId`
 * **مشتقٌّ من المستودع لا من مدخل العميل**. فاعلٌ في شبكةٍ لا يبلغ حلقةَ أخرى **ولو تطابق
 * مسارُه النسبيّ** — مُحلِّلُ النطاق يبحث في مستودع شبكته وحدها ⇒ `NO_SCOPE` ⇒ رفض.
 * **صفر قدرةٍ جديدة وصفر فرعِ شبكةٍ في المحرّك.**
 */
import { describe, it, expect, beforeEach } from "vitest"
import { CirclesTenantRegistry } from "../../../src/features/circles/data/tenant.js"
import { makeCirclesEndpoints } from "../../../src/features/circles/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { circlesInScope, circleStats } from "../../../src/features/circles/services/derive.js"
import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import {
  canonicalActor,
  canonicalDirectory,
  DECISION,
  KHALID_PATH,
  MAIN_TENANT_ID,
  SECOND_TENANT_ID,
  seedCircle,
  seedCirclesStore,
  SEEDED_TYPES,
  WRITE,
} from "./_seed.js"

beforeEach(() => clearRegistryForTests())

describe("قب-١٨ — **عزلُ الشبكة بنيويّ**: لا مِقبضَ عابرٌ أصلاً", () => {
  it("المستودعُ لكل شبكة، والمعاد لنفس الشبكة **هو هو** لا نسخةٌ ثانية", () => {
    const registry = new CirclesTenantRegistry()
    const main = registry.storeFor(MAIN_TENANT_ID)
    expect(registry.storeFor(MAIN_TENANT_ID)).toBe(main)
    expect(registry.storeFor(SECOND_TENANT_ID)).not.toBe(main)
    expect(registry.has(MAIN_TENANT_ID)).toBe(true)
    expect(registry.has("t-لا-وجود-لها")).toBe(false)
    expect(registry.tenantIds().sort()).toEqual([MAIN_TENANT_ID, SECOND_TENANT_ID].sort())
  })

  it("**و`tenantId` مشتقٌّ من المستودع لا من المدخل**: حقنُ شبكةٍ أخرى في الكيان لا يُغيّر شيئاً", () => {
    const store = seedCirclesStore()
    store.saveType({ tenantId: SECOND_TENANT_ID, id: "دخيل", ar: "دخيل" })
    expect(store.getType("دخيل")?.tenantId).toBe(MAIN_TENANT_ID)
    const id = seedCircle(store)
    expect(store.getCircle(id)?.tenantId).toBe(MAIN_TENANT_ID)
  })

  it("**وفاعلُ شبكةٍ لا يبلغ حلقةَ أخرى ولو تطابق مسارُه النسبيّ** ⇒ `NO_SCOPE` ⇒ رفض", async () => {
    // الشبكةُ الثانية: **الوحداتُ نفسُها بالمسارات نفسِها** — والفرقُ المستودعُ وحده.
    const second = seedCirclesStore(SECOND_TENANT_ID)
    const foreign = seedCircle(second)

    // مستودعُ الشبكة الأولى **لا يعرف** حلقةَ الثانية.
    const main = seedCirclesStore(MAIN_TENANT_ID)
    const ep = makeCirclesEndpoints(main, canonicalDirectory)
    const rejected = await ep.update.invoke(
      { circleId: foreign, nameAr: "اسمٌ من شبكةٍ أخرى" },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.decision.reason).toBe("DENIED_OUT_OF_SCOPE")

    // ولم تُمسّ الشبكةُ الثانية.
    expect(second.getCircle(foreign)?.nameAr).not.toBe("اسمٌ من شبكةٍ أخرى")
  })

  it("**والإحصاءُ لا يعبر الشبكات**: كلُّ مستودعٍ يحصي ما فيه هو", () => {
    const main = seedCirclesStore(MAIN_TENANT_ID)
    const second = seedCirclesStore(SECOND_TENANT_ID)
    seedCircle(main)
    seedCircle(second)
    seedCircle(second, { nameAr: "ثانيةٌ في الشبكة الثانية" })
    expect(circleStats(main, KHALID_PATH).total).toBe(1)
    expect(circleStats(second, KHALID_PATH).total).toBe(2)
  })
})

describe("عزلُ النطاق على **كل** مسارات الوحدة (لا مسارَ يفلت)", () => {
  const surfaces = [
    "scopeView",
    "statsView",
    "create",
    "update",
    "archive",
    "assignTeacher",
    "enroll",
    "endEnrollment",
    "mine",
  ] as const

  it("سطوحُ الوحدة التسعةُ كلُّها معلنةٌ ومسجَّلة (G7) — لا سطحَ بلا إعلان", () => {
    const store = seedCirclesStore()
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    for (const name of surfaces) {
      expect(ep[name].declaration.capability, name).not.toBeUndefined()
      expect(ep[name].declaration.audit.length, name).toBeGreaterThan(0)
    }
  })

  it("**وكلُّ سطحٍ كاتبٍ يُرفض على أميرِ مسجدٍ آخر** — الطبقتان: لا واجهةَ ولا خادم", async () => {
    const store = seedCirclesStore()
    const circleId = seedCircle(store)
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const intruder = canonicalActor("u-amir-bilal")

    const attempts: readonly { readonly label: string; readonly run: () => Promise<{ ok: boolean }> }[] = [
      {
        label: "إنشاء",
        run: () =>
          ep.create.invoke(
            { unitId: "khalid", typeId: "tahfeez", nameAr: "حلقة", capacity: 10 },
            intruder,
            WRITE,
          ),
      },
      { label: "تعديل", run: () => ep.update.invoke({ circleId, nameAr: "اسم" }, intruder, WRITE) },
      { label: "أرشفة", run: () => ep.archive.invoke({ circleId }, intruder, WRITE) },
      {
        label: "إسناد معلّم",
        run: () =>
          ep.assignTeacher.invoke({ circleId, teacherPersonId: "u-teacher" }, intruder, WRITE),
      },
      {
        label: "إدخال طالب",
        run: () => ep.enroll.invoke({ circleId, nameAr: "طالب" }, intruder, WRITE),
      },
    ]

    for (const attempt of attempts) {
      const r = await attempt.run()
      expect(r.ok, `«${attempt.label}» مرّ لأميرِ مسجدٍ آخر`).toBe(false)
    }
  })

  it("**والقراءةُ معزولةٌ كذلك**: أميرُ بلال يرى مسجدَه ولا يرى مسجدَ خالد", async () => {
    const store = seedCirclesStore()
    seedCircle(store)
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const denied = await ep.scopeView.invoke(
      { unitId: "khalid" },
      canonicalActor("u-amir-bilal"),
      DECISION,
    )
    expect(denied.ok).toBe(false)
    const allowed = await ep.scopeView.invoke(
      { unitId: "bilal" },
      canonicalActor("u-amir-bilal"),
      DECISION,
    )
    expect(allowed.ok).toBe(true)
  })

  it("**والإحصاءُ منطوقٌ على نطاق صفحته** (ق-١١٠): أميرٌ يُمنع من إحصاء مربعٍ فوقه", async () => {
    const store = seedCirclesStore()
    seedCircle(store)
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const denied = await ep.statsView.invoke({ unitId: "sq2" }, canonicalActor("u-amir"), DECISION)
    expect(denied.ok).toBe(false)
    const allowed = await ep.statsView.invoke({ unitId: "khalid" }, canonicalActor("u-amir"), DECISION)
    expect(allowed.ok).toBe(true)
  })

  it("**والنطاقُ يحترم ثابتَ التمثيل**: كلُّ مسارٍ مخزَّنٍ يبدأ وينتهي بشرطة (§١.٥)", () => {
    const store = seedCirclesStore()
    seedCircle(store)
    for (const circle of circlesInScope(store, "/")) {
      expect(circle.unitPath.startsWith("/")).toBe(true)
      expect(circle.unitPath.endsWith("/")).toBe(true)
    }
    // والعالمُ القانونيُّ نفسُه محترمٌ فيه الثابت (فلا بذرةَ تكسره).
    for (const unit of buildCanonicalWorld().units) {
      expect(unit.path.endsWith("/"), unit.id).toBe(true)
    }
  })

  it("وكتالوجُ الأنواع معزولٌ بالشبكة كذلك — لا نوعَ يتسرّب بين مستودعين", () => {
    const main = seedCirclesStore(MAIN_TENANT_ID)
    const second = seedCirclesStore(SECOND_TENANT_ID)
    second.saveType({ tenantId: SECOND_TENANT_ID, id: "خاصٌّ بالثانية", ar: "خاص" })
    expect(main.getType("خاصٌّ بالثانية")).toBeNull()
    expect(main.types()).toHaveLength(SEEDED_TYPES.length)
  })
})
