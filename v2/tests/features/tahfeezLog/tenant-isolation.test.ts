/**
 * **الاختبارُ الإلزاميّ العاشر (شقُّ عزل الشبكة)** (T18) — قب-١٨.
 *
 * وأخصُّ ما يُحرَس هنا **رمزُ وليّ الأمر**: هو مِقبضٌ يفتح بيانات قاصرٍ بلا جلسةٍ ولا دور،
 * فلو حُلّ في مستودعٍ غير مستودع شبكته لكان تسريباً عابراً للشبكات بلا فحصِ صلاحيةٍ يوقفه.
 */
import { describe, it, expect } from "vitest"
import { TahfeezLogTenantRegistry } from "../../../src/features/tahfeezLog/data/tenant.js"
import { issueLink, resolveGuardianToken } from "../../../src/features/tahfeezLog/services/guardian.js"
import { recordSession } from "../../../src/features/tahfeezLog/services/sessions.js"
import { circleDayView } from "../../../src/features/tahfeezLog/services/derive.js"
import { logContext, MAIN_TENANT_ID, NOW, SECOND_TENANT_ID, seedWorld } from "./_seed.js"

describe("قب-١٨ — **مستودعٌ لكل شبكة**: لا مِقبضَ عابرٌ أصلاً", () => {
  it("السجلُّ يعيد المستودعَ نفسَه لشبكةٍ واحدة، ومستودعين لشبكتين", () => {
    const registry = new TahfeezLogTenantRegistry()
    const a = registry.storeFor(MAIN_TENANT_ID)
    const b = registry.storeFor(MAIN_TENANT_ID)
    const c = registry.storeFor(SECOND_TENANT_ID)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(registry.has(MAIN_TENANT_ID)).toBe(true)
    expect(registry.has("t-ثالثة")).toBe(false)
    expect(registry.tenantIds().sort()).toEqual([MAIN_TENANT_ID, SECOND_TENANT_ID])
  })

  it("**والشبكةُ تُختم من المستودع لا من المدخل**: مدخلٌ يدّعي شبكةً أخرى يُختم بشبكته", () => {
    const world = seedWorld()
    const ctx = logContext(world, "u-amir")
    const done = recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [{ enrollmentId: world.studentA, attendance: "present" }],
    })
    expect(done.ok && done.value.tenantId).toBe(MAIN_TENANT_ID)
  })

  it("**ورمزٌ متطابقٌ في شبكتين لا يفتح بابَ الأخرى** — الحلُّ في مستودع شبكته وحدها", () => {
    const first = seedWorld(MAIN_TENANT_ID)
    const second = seedWorld(SECOND_TENANT_ID)

    const link = issueLink(first.log, logContext(first, "u-amir"), {
      circleId: first.circleId,
      enrollmentId: first.studentA,
    })
    expect(link.ok).toBe(true)
    if (!link.ok) return

    // المستودعُ الثاني **لا يعرف** هذا الرمزَ ولو تطابق نصُّه ومسارُ حلقته النسبيّ.
    const crossed = resolveGuardianToken(second.log, logContext(second, "u-amir"), link.value.token)
    expect(!crossed.ok && crossed.error.code).toBe("UNKNOWN_LINK")

    const own = resolveGuardianToken(first.log, logContext(first, "u-amir"), link.value.token)
    expect(own.ok).toBe(true)
  })

  it("**وجلسةُ شبكةٍ لا تُقرأ من أخرى** ولو تطابق معرّفُ الحلقة", () => {
    const first = seedWorld(MAIN_TENANT_ID)
    const second = seedWorld(SECOND_TENANT_ID)
    expect(first.circleId).toBe(second.circleId) // المعرّفاتُ متتابعةٌ حتميّة — فالتطابقُ مقصود.

    recordSession(first.log, logContext(first, "u-amir"), {
      circleId: first.circleId,
      at: NOW,
      rows: [{ enrollmentId: first.studentA, attendance: "present" }],
    })

    const here = circleDayView(first.log, logContext(first, "u-amir"), {
      circleId: first.circleId,
      at: NOW,
    })
    const there = circleDayView(second.log, logContext(second, "u-amir"), {
      circleId: second.circleId,
      at: NOW,
    })
    expect(here.ok && here.value.recorded).toBe(true)
    expect(there.ok && there.value.recorded).toBe(false)
  })
})
