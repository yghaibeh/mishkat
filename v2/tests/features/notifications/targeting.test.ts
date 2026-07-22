/**
 * ق-١١ وق-٢٥ — **المستهدَفون جوابُ المحرّك** (عقدُ الوحدة §٢).
 *
 * هذا هو الاختبارُ الذي يحرس ما أنتج **د-٢/د-٣** في v1: فلاترُ تكليفٍ كُتبت يدوياً بجانب
 * منطق الصلاحيات فتباعدت عنه. فالتوكيدُ هنا **مزدوج** دائماً:
 *  ١. مَن وصلَه الإشعار.
 *  ٢. **ولماذا لم يصل غيرَه** — أهو لأن المحرّك ردّه، أم لأنه ليس مرشَّحاً أصلاً؟
 * والثاني هو ما يجعل «للأقرب فقط» **مقيسةً لا موعودة**.
 */
import { describe, it, expect } from "vitest"
import { can } from "../../../src/authorization/can.js"
import { unitScope } from "../../../src/authorization/scope.js"
import { resolveTargets } from "../../../src/features/notifications/services/targeting.js"
import { makeIntake } from "../../../src/features/notifications/services/intake.js"
import { myNotifications } from "../../../src/features/notifications/services/inbox.js"
import {
  BILAL_PATH,
  DECISION,
  SQUARE_PATH,
  canonicalActor,
  notificationContext,
  notificationPorts,
  payload,
  seedNotificationStore,
  submissionEvent,
  SQUARE_LAYER_TARGETS,
} from "./_seed.js"

/** القدرةُ التي يحملها الحدثُ في هذه الاختبارات — قدرةُ اطّلاعٍ لا بتّ (G22). */
const AUDIENCE_CAP = "report.view" as const

describe("ق-١١ — المستهدَفون سؤالٌ للمحرّك: للأقرب فقط لا لمن فوقه", () => {
  it("تقديمٌ على طبقةٍ ⇒ يُشعَر المكلَّفُ عندها وحده — **والأعلى لا يُشعَر ولو أجاب المحرّكُ له بنعم**", () => {
    const ctx = notificationContext("u-amir")
    const targets = resolveTargets(ctx, {
      mode: "capabilityOnScope",
      scopePath: SQUARE_PATH,
      capability: AUDIENCE_CAP,
    })

    // مكلَّفا المربع الثاني كلاهما — والتوزيعُ يشملهما معاً (لا «أوّلُ من يُوجَد»).
    expect(targets).toEqual([...SQUARE_LAYER_TARGETS])

    // **الشاهدُ الحاسم**: مسؤولُ المنطقة يملك القدرةَ على نطاق الطبقة فعلاً (نوعُ نطاقها «و»)،
    // ومع ذلك لم يصله شيء — لأنه **ليس مكلَّفاً عند المسار بعينه** فليس مرشَّحاً أصلاً.
    const above = can(canonicalActor("u-rabita"), AUDIENCE_CAP, unitScope(SQUARE_PATH), DECISION)
    expect(above.allowed).toBe(true)
    expect(targets).not.toContain("u-rabita")
    expect(targets).not.toContain("u-section-head")
    expect(targets).not.toContain("u-admin")
  })

  it("ومَن لا يملك القدرةَ لا يُشعَر ولو كان مكلَّفاً عند المسار — **المحرّكُ هو الذي يردّه**", () => {
    const ctx = notificationContext("u-amir", {
      ports: { assignedAt: () => [canonicalActor("u-teacher"), canonicalActor("u-square")] },
    })
    const targets = resolveTargets(ctx, {
      mode: "capabilityOnScope",
      scopePath: SQUARE_PATH,
      capability: AUDIENCE_CAP,
    })

    expect(targets).toEqual(["u-square"])
    expect(can(canonicalActor("u-teacher"), AUDIENCE_CAP, unitScope(SQUARE_PATH), DECISION).allowed).toBe(
      false,
    )
  })

  it("**إدخالٌ بلا تقديمٍ ⇒ لا إشعار**: الكتالوجُ مغلقٌ ولا نوعَ فيه للإدخال اليوميّ", () => {
    const store = seedNotificationStore()
    const ctx = notificationContext("u-amir")
    const intake = makeIntake(store, ctx)

    // وحدةٌ ميدانيةٌ تُدخل خمسةَ أنشطةٍ ثم تُقدّم: الإدخالُ لا يجد نوعاً يُشعِر به.
    for (let i = 0; i < 5; i += 1) {
      const attempted = intake({
        ...submissionEvent({ kindId: "dailyLog.entry.recorded", refId: `entry-${i}`, windowKey: "d1" }),
      })
      expect(attempted.ok).toBe(false)
      if (!attempted.ok) expect(attempted.error.code).toBe("UNKNOWN_NOTIFICATION_KIND")
    }
    expect(store.notifications().length).toBe(0)

    // ثم التقديمُ — **حدثٌ واحدٌ يُنتج إشعارَ الطبقة الأقرب وحدها**، ولمن فوقها لا شيء.
    const submitted = intake(submissionEvent())
    expect(submitted.ok).toBe(true)
    if (submitted.ok) expect(submitted.value.targets).toEqual([...SQUARE_LAYER_TARGETS])
    expect(store.notifications().length).toBe(SQUARE_LAYER_TARGETS.length)
    expect(myNotifications(store, notificationContext("u-square")).items.length).toBe(1)
    expect(myNotifications(store, notificationContext("u-rabita")).items.length).toBe(0)
  })

  it("والنوعُ المُعطَّلُ يُردّ بسببٍ مختلف — فيعرف الأدمنُ أيُعيد تفعيله أم يضيفه", () => {
    const store = seedNotificationStore()
    const intake = makeIntake(store, notificationContext("u-amir"))
    const r = intake(submissionEvent({ kindId: "retired.kind" }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("KIND_INACTIVE")
  })

  it("ونوعٌ جديدٌ يُضاف **صفّاً في البيانات** فيعمل بلا تغيير سطرِ كود (قب-٢٢)", () => {
    const store = seedNotificationStore()
    store.saveKind({
      tenantId: "t-main",
      id: "circle.milestone",
      ar: "إنجازٌ في حلقةٍ",
      trigger: "outcome",
      active: true,
    })
    const intake = makeIntake(store, notificationContext("u-amir"))
    const r = intake(
      submissionEvent({
        kindId: "circle.milestone",
        audience: { mode: "person", personId: "u-teacher" },
      }),
    )
    expect(r.ok).toBe(true)
  })
})

describe("ق-٢٥ — التذكيراتُ لصاحب التكليف الحالي حصراً (فلترُ الفعالية الزمنية في المحرّك)", () => {
  it("منتهي التكليف **مرشَّحٌ يردّه المحرّك**، والحاليُّ يُذكَّر — بلا شرطٍ زمنيٍّ ثانٍ هنا", () => {
    const ctx = notificationContext("u-square")
    const candidates = notificationPorts().assignedAt(BILAL_PATH).map((p) => p.personId)

    // المنفذُ ساذجٌ عمداً: الاثنان مرشَّحان — الحاليُّ والمنتهي.
    expect(candidates).toContain("u-amir-bilal")
    expect(candidates).toContain("u-ended")

    const targets = resolveTargets(ctx, {
      mode: "capabilityOnScope",
      scopePath: BILAL_PATH,
      capability: AUDIENCE_CAP,
    })
    expect(targets).toEqual(["u-amir-bilal"])

    // والسببُ **مُشخَّصٌ من المحرّك نفسِه** لا من فلترٍ محليّ.
    const denied = can(canonicalActor("u-ended"), AUDIENCE_CAP, unitScope(BILAL_PATH), DECISION)
    expect(denied.allowed).toBe(false)
    expect(denied.reason).toBe("DENIED_NO_ACTIVE_ASSIGNMENT")
  })

  it("والتذكيرُ الفعليُّ لا يصل منتهيَ التكليف: «إشعاراتي» عنده فارغةٌ والحاليُّ عنده واحد", () => {
    const store = seedNotificationStore()
    const intake = makeIntake(store, notificationContext("u-square"))
    const r = intake({
      kindId: "visit.due",
      refId: "bilal",
      windowKey: "2026-w29",
      audience: { mode: "capabilityOnScope", scopePath: BILAL_PATH, capability: AUDIENCE_CAP },
      payload: payload({ summaryAr: "مسجد بلال يستحقّ زيارةً ميدانية" }),
    })
    expect(r.ok).toBe(true)

    expect(myNotifications(store, notificationContext("u-amir-bilal")).items.length).toBe(1)
    expect(myNotifications(store, notificationContext("u-ended")).items.length).toBe(0)
  })

  it("والتكليفُ المعلَّقُ لا يُشعَر كذلك (ق-١٤/ق-٢٥) — والمحرّكُ هو من يردّه", () => {
    const ctx = notificationContext("u-square")
    const targets = resolveTargets(ctx, {
      mode: "capabilityOnScope",
      scopePath: "/men/homs/sq7/omar/",
      capability: AUDIENCE_CAP,
    })
    expect(targets).not.toContain("u-pending")
  })
})

describe("الجمهورُ شكلان لا ثالثَ لهما (§٢.٢)", () => {
  it("«شخصٌ» يُشعَر مباشرةً — ردُّ الفعل على صاحبه لا يمرّ بسؤال نطاق", () => {
    const ctx = notificationContext("u-square")
    expect(resolveTargets(ctx, { mode: "person", personId: "u-amir" })).toEqual(["u-amir"])
  })

  it("وجمهورٌ بلا مستهدَفٍ واحدٍ يُردّ `NO_TARGETS` — لا إشعارَ في الفراغ", () => {
    const store = seedNotificationStore()
    const intake = makeIntake(store, notificationContext("u-amir", { ports: { assignedAt: () => [] } }))
    const r = intake(submissionEvent())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe("NO_TARGETS")
    expect(store.notifications().length).toBe(0)
  })

  it("والترتيبُ حتميّ: المستهدَفون مرتَّبون بالمعرّف فلا يختلف ناتجُ تشغيلين", () => {
    const ctx = notificationContext("u-amir", {
      ports: {
        assignedAt: () => [
          canonicalActor("u-square"),
          canonicalActor("u-granted"),
        ],
      },
    })
    const targets = resolveTargets(ctx, {
      mode: "capabilityOnScope",
      scopePath: SQUARE_PATH,
      capability: AUDIENCE_CAP,
    })
    expect(targets).toEqual([...targets].sort())
  })

  it("والسؤالُ للمحرّك **بنيّة قراءةٍ دائماً**: جمهورٌ يُحسب أثناء فعلٍ كاتبٍ لا يُفرَّغ", () => {
    // سؤالُ الجمهور سؤالٌ عن **مدى شخصٍ** لا فعلٌ باسمه (نظيرُ سؤال الأمانة في الصندوق).
    // ولولا تثبيتُ النيّة قراءةً لسقط كلُّ مستهدَفٍ في جلسةِ انتحالٍ قرائيّ — وهذا شاهدُه:
    const watched = { ...canonicalActor("u-square"), impersonatedBy: "u-admin" }
    const writing = { ...DECISION, intent: "write" as const }
    expect(can(watched, AUDIENCE_CAP, unitScope(SQUARE_PATH), writing).reason).toBe(
      "DENIED_IMPERSONATION_READONLY",
    )

    const ctx = notificationContext("u-admin", {
      decision: writing,
      ports: { assignedAt: () => [watched] },
    })
    expect(
      resolveTargets(ctx, {
        mode: "capabilityOnScope",
        scopePath: SQUARE_PATH,
        capability: AUDIENCE_CAP,
      }),
    ).toEqual(["u-square"])
  })
})
