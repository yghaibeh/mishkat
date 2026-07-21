import { describe, it, expect, beforeEach } from "vitest"
import {
  defineServerFn,
  registeredServerFns,
  clearRegistryForTests,
  PUBLIC_DECLARED,
} from "../../src/server/defineServerFn.js"
import { unitScope, selfScope, NO_SCOPE } from "../../src/authorization/scope.js"
import type { Actor, DecisionContext } from "../../src/authorization/can.js"

const CTX: DecisionContext = {
  now: new Date("2026-07-20T00:00:00.000Z"),
  intent: "read",
  isFeatureEnabled: () => true,
}

const amir: Actor = {
  personId: "u-amir",
  accountStatus: "active",
  sessionEpoch: 1,
  currentSessionEpoch: 1,
  assignments: [
    {
      roleId: "amir",
      scopePath: "/men/homs/sq2/khalid/",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: null,
      approvalStatus: "approved",
      unitArchived: false,
    },
  ],
  overrides: [],
}

beforeEach(() => clearRegistryForTests())

describe("المنع افتراضاً: الدالة بلا إعلان لا تُسجَّل (المادة ٤/٥)", () => {
  it("دالة بلا قدرة ترمي عند التعريف — فلا تصير نقطة RPC مكشوفة", () => {
    expect(() =>
      defineServerFn({
        name: "leaky",
        // @ts-expect-error — الإعلان إلزامي؛ هذا ما يقتل صنف أ-١…أ-٨
        capability: undefined,
        intent: "read",
        audit: "leaky",
        handler: async () => null,
      }),
    ).toThrow(/بلا إعلان قدرة/)
  })

  it("ودالة تعلن قدرةً بلا مُحلِّل نطاق ترمي — النطاق معامل إلزامي", () => {
    expect(() =>
      defineServerFn({
        name: "scopeless",
        capability: "circle.manage",
        intent: "write",
        audit: "circle.manage",
        handler: async () => null,
      }),
    ).toThrow(/بلا مُحلِّل نطاق/)
  })

  it("ولا تُقبل دالتان بنفس الاسم", () => {
    const decl = {
      capability: "circle.manage" as const,
      scope: () => unitScope("/men/homs/sq2/khalid/"),
      intent: "write" as const,
      audit: "circle.manage",
      handler: async () => null,
    }
    defineServerFn({ name: "dup", ...decl })
    expect(() => defineServerFn({ name: "dup", ...decl })).toThrow(/مكررة/)
  })

  it("والمسجَّل وحده هو الموجود — جدول المسارات مغلق", () => {
    expect(registeredServerFns()).toHaveLength(0)
    defineServerFn({
      name: "listed",
      capability: "circle.manage",
      scope: () => unitScope("/men/homs/sq2/khalid/"),
      intent: "write",
      audit: "circle.manage",
      handler: async () => "ok",
    })
    expect(registeredServerFns()).toHaveLength(1)
  })
})

describe("الفرض يقع قبل جسم الدالة لا داخله", () => {
  function makeFn(scopePath: string | null) {
    let ran = false
    const fn = defineServerFn({
      name: `guarded-${scopePath ?? "none"}`,
      capability: "circle.manage",
      // مُحلِّل النطاق يشتق النطاق من الكيان المخزَّن لا من مدخل العميل (يقتل صنف خ).
      scope: () => unitScope(scopePath),
      intent: "write",
      audit: "circle.manage.set",
      handler: async () => {
        ran = true
        return "نُفِّذ"
      },
    })
    return { fn, didRun: () => ran }
  }

  it("الأمير ينفّذ على مسجده", async () => {
    const { fn, didRun } = makeFn("/men/homs/sq2/khalid/")
    const r = await fn.invoke({}, amir, CTX)
    expect(r.ok).toBe(true)
    expect(didRun()).toBe(true)
  })

  it("ويُرفض على المسجد المجاور — والجسم لا يعمل إطلاقاً", async () => {
    const { fn, didRun } = makeFn("/men/homs/sq2/bilal/")
    const r = await fn.invoke({}, amir, CTX)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
    expect(didRun(), "الجسم عمل رغم الرفض — الحارس داخل الدالة لا قبلها").toBe(false)
  })

  it("والكيان غير الموجود يُقفل ولا يُفتح (NO_SCOPE ⇒ رفض)", async () => {
    const { fn, didRun } = makeFn(null)
    const r = await fn.invoke({}, amir, CTX)
    expect(r.ok).toBe(false)
    expect(didRun()).toBe(false)
  })

  it("والنية الكاتبة تُؤخذ من الإعلان لا من المستدعي — جلسة الانتحال تُرفض", async () => {
    const { fn } = makeFn("/men/homs/sq2/khalid/")
    const r = await fn.invoke({}, { ...amir, impersonatedBy: "u-admin" }, CTX)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.decision.reason).toBe("DENIED_IMPERSONATION_READONLY")
  })
})

describe("المسار العام المعلن (CR-001 §ج)", () => {
  it("يعمل بلا هوية — لكنه معلَنٌ معدودٌ لا صامت", async () => {
    const fn = defineServerFn({
      name: "registration.publicRequest",
      capability: PUBLIC_DECLARED,
      intent: "write",
      audit: "registration.request.public",
      handler: async () => ({ status: "pending" }),
    })
    const anonymous: Actor = {
      personId: "anonymous",
      accountStatus: "active",
      sessionEpoch: 0,
      currentSessionEpoch: 0,
      assignments: [],
      overrides: [],
    }
    const r = await fn.invoke({}, anonymous, CTX)
    expect(r.ok).toBe(true)
    expect(fn.declaration.capability).toBe(PUBLIC_DECLARED)
  })
})

describe("القائمة البيضاء تُفرض زمن التشغيل أيضاً — لا بالبوابة وحدها", () => {
  it("مسارٌ عامٌّ خارج القائمة لا يُسجَّل أصلاً", () => {
    expect(() =>
      defineServerFn({
        name: "search.publicEverything",
        capability: PUBLIC_DECLARED,
        intent: "read",
        audit: "search.public",
        handler: async () => [],
      }),
    ).toThrow(/القائمة البيضاء/)
  })
})

describe("مُحلِّل النطاق الشخصي", () => {
  it("القدرة الشخصية تُفحص بالملكية", async () => {
    const fn = defineServerFn({
      name: "media.post",
      capability: "media.post",
      scope: (input: { ownerId: string }) => selfScope(input.ownerId, "coverage", "cv1"),
      intent: "write",
      audit: "media.post",
      handler: async () => "نُشر",
    })
    const media: Actor = { ...amir, personId: "u-media", assignments: [
      { roleId: "media", scopePath: "/", startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: null, approvalStatus: "approved", unitArchived: false },
    ] }
    expect((await fn.invoke({ ownerId: "u-media" }, media, CTX)).ok).toBe(true)
    expect((await fn.invoke({ ownerId: "someone-else" }, media, CTX)).ok).toBe(false)
  })

  it("و NO_SCOPE صريحاً يُرفض", async () => {
    const fn = defineServerFn({
      name: "vanished",
      capability: "circle.manage",
      scope: () => NO_SCOPE,
      intent: "write",
      audit: "circle.manage",
      handler: async () => "لا ينبغي",
    })
    expect((await fn.invoke({}, amir, CTX)).ok).toBe(false)
  })
})
