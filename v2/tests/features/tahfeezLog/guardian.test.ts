/**
 * **الاختبارُ الإلزاميّ الخامس** (T18) — ق-٩٣ + ب-٣٦أ: رمزُ وليّ الأمر
 * **لا يكشف إلا طالبَه** · **يموت بالأرشفة** · **ومنتهي الصلاحية مرفوض** ·
 * وله **عمرٌ وزرُّ تجديد** من الإعدادات لا من رقمٍ صلب.
 *
 * وم-١٢ («رمزٌ بلا انتهاءٍ ولا تدوير») يُقفل هنا نصاً: العمرُ إعدادٌ حيّ، والتجديدُ بابٌ معلن.
 */
import { describe, it, expect } from "vitest"
import {
  issueLink,
  linksOfCircle,
  renewLink,
  resolveGuardianToken,
  revokeLink,
} from "../../../src/features/tahfeezLog/services/guardian.js"
import { recordSession } from "../../../src/features/tahfeezLog/services/sessions.js"
import { globalOverride, logContext, NOW, seedWorld, sequentialTokens } from "./_seed.js"

function issued() {
  const world = seedWorld()
  const ctx = logContext(world, "u-amir", { newToken: sequentialTokens() })
  const link = issueLink(world.log, ctx, {
    circleId: world.circleId,
    enrollmentId: world.studentA,
  })
  if (!link.ok) throw new Error(link.error.code)
  return { world, ctx, link: link.value }
}

describe("ق-٩٣ — إصدارُ رمز وليّ الأمر: **رابطٌ حيٌّ واحدٌ لكل تسجيل**", () => {
  it("يُصدَر رمزٌ لتسجيلٍ في حلقته بعمرٍ من الإعداد (سنةٌ دراسية — ب-٣٦أ)", () => {
    const { link } = issued()
    expect(link.token).toBe("tok-1")
    expect(link.revokedAt).toBeNull()
    // ٣٦٥ يوماً هو **افتراضُ السجل** لا رقمٌ في الكود: الفارقُ يُقاس ولا يُكتب.
    const days = Math.round((link.expiresAt.getTime() - link.issuedAt.getTime()) / 86_400_000)
    expect(days).toBe(365)
  })

  it("**والعمرُ من الإعداد**: يُقصَّر `edu.guardian_token.ttl_days` فيقصر عمرُ الرمز بلا سطر كود", () => {
    const world = seedWorld()
    const ctx = logContext(world, "u-amir", {
      overrides: [globalOverride("edu.guardian_token.ttl_days", 30)],
    })
    const link = issueLink(world.log, ctx, {
      circleId: world.circleId,
      enrollmentId: world.studentA,
    })
    expect(link.ok).toBe(true)
    if (!link.ok) return
    const days = Math.round((link.value.expiresAt.getTime() - link.value.issuedAt.getTime()) / 86_400_000)
    expect(days).toBe(30)
  })

  it("وإصدارٌ ثانٍ فوق رابطٍ حيٍّ مرفوض — رابطٌ واحدٌ حيٌّ لكل طالب", () => {
    const { world, ctx } = issued()
    const again = issueLink(world.log, ctx, {
      circleId: world.circleId,
      enrollmentId: world.studentA,
    })
    expect(!again.ok && again.error.code).toBe("LINK_ALREADY_ACTIVE")
  })

  it("وتسجيلٌ من حلقةٍ أخرى مرفوض — الرابطُ ابنُ التسجيل داخل حلقته", () => {
    const world = seedWorld()
    const ctx = logContext(world, "u-amir-bilal")
    const done = issueLink(world.log, ctx, {
      circleId: world.otherCircleId,
      enrollmentId: world.studentA,
    })
    expect(!done.ok && done.error.code).toBe("ENROLLMENT_NOT_IN_CIRCLE")
  })

  it("وحلقةٌ مجهولةٌ مرفوضة", () => {
    const world = seedWorld()
    const done = issueLink(world.log, logContext(world, "u-amir"), {
      circleId: "لا-حلقة",
      enrollmentId: world.studentA,
    })
    expect(!done.ok && done.error.code).toBe("UNKNOWN_CIRCLE")
  })
})

describe("**ق-٩٣ — الرمزُ لا يكشف إلا طالبَه**", () => {
  it("حلُّ الرمز يعيد سجلَّ صاحبه وحده — **ولا يذكر زميلَه بحرفٍ واحد**", () => {
    const { world, ctx, link } = issued()
    recordSession(world.log, ctx, {
      circleId: world.circleId,
      at: NOW,
      rows: [
        { enrollmentId: world.studentA, attendance: "present", memorizationGrade: 9 },
        { enrollmentId: world.studentB, attendance: "absent" },
      ],
    })

    const seen = resolveGuardianToken(world.log, ctx, link.token)
    expect(seen.ok).toBe(true)
    if (!seen.ok) return
    expect(seen.value.enrollmentId).toBe(world.studentA)
    expect(seen.value.nameAr).toBe("عبد الله")
    // **قياسٌ محتوائيّ**: تُفتَّش الحصيلةُ كلُّها عن اسم الزميل ومعرّفه فلا يوجدان.
    const dump = JSON.stringify(seen.value)
    expect(dump).not.toContain("معاذ")
    expect(dump).not.toContain(world.studentB)
  })

  it("ورمزٌ مجهولٌ ⇒ مرفوض — ولا يُفرَّق في الجواب بين مجهولٍ ومحذوف", () => {
    const { world, ctx } = issued()
    const seen = resolveGuardianToken(world.log, ctx, "رمزٌ لا وجود له")
    expect(!seen.ok && seen.error.code).toBe("UNKNOWN_LINK")
  })
})

describe("**ق-٩٣ — يموت بالأرشفة، وينتهي بعمره، ويُلغى وسماً**", () => {
  it("**أرشفةُ الحلقة تقتل الرابط** — موتٌ بالبنية لا بمهمّةٍ مجدوَلة", () => {
    const { world, ctx, link } = issued()
    const circle = world.circles.getCircle(world.circleId)!
    world.circles.saveCircle({ ...circle, archivedAt: NOW })

    const seen = resolveGuardianToken(world.log, ctx, link.token)
    expect(!seen.ok && seen.error.code).toBe("LINK_DEAD")
  })

  it("**والمنتهي مرفوض**: بعد انقضاء العمر لا يفتح الرمزُ شيئاً (يقفل م-١٢)", () => {
    const { world, link } = issued()
    const later = logContext(world, "u-amir", { now: new Date("2027-09-01T09:00:00.000Z") })
    const seen = resolveGuardianToken(world.log, later, link.token)
    expect(!seen.ok && seen.error.code).toBe("LINK_EXPIRED")
  })

  it("والملغى مرفوضٌ بسببٍ مميِّز — والإلغاءُ **وسمٌ لا محو** (المادة ٧/٤)", () => {
    const { world, ctx, link } = issued()
    const done = revokeLink(world.log, ctx, { linkId: link.id })
    expect(done.ok && done.value.revokedAt).not.toBeNull()
    expect(world.log.links()).toHaveLength(1)

    const seen = resolveGuardianToken(world.log, ctx, link.token)
    expect(!seen.ok && seen.error.code).toBe("LINK_REVOKED")
  })

  it("وإلغاءُ رابطٍ مجهولٍ أو ملغىً مسبقاً مرفوض", () => {
    const { world, ctx, link } = issued()
    expect(revokeLink(world.log, ctx, { linkId: "لا-رابط" }).ok).toBe(false)
    revokeLink(world.log, ctx, { linkId: link.id })
    const again = revokeLink(world.log, ctx, { linkId: link.id })
    expect(!again.ok && again.error.code).toBe("LINK_REVOKED")
  })
})

describe("**ب-٣٦أ — زرُّ التجديد**، وإتاحتُه إعدادٌ لا عادة", () => {
  it("التجديدُ يمدّ العمرَ من لحظته ويُحيي رمزاً منتهياً", () => {
    const { world, link } = issued()
    const later = logContext(world, "u-amir", { now: new Date("2027-09-01T09:00:00.000Z") })
    const renewed = renewLink(world.log, later, { linkId: link.id })
    expect(renewed.ok).toBe(true)
    if (!renewed.ok) return
    expect(renewed.value.expiresAt.getTime()).toBeGreaterThan(link.expiresAt.getTime())
    expect(resolveGuardianToken(world.log, later, link.token).ok).toBe(true)
  })

  it("**وإطفاءُ `edu.guardian_token.renewable` يُقفل التجديد** ⇒ سببٌ مميِّزٌ لا صمت", () => {
    const { world, link } = issued()
    const off = logContext(world, "u-amir", {
      overrides: [globalOverride("edu.guardian_token.renewable", false)],
    })
    const done = renewLink(world.log, off, { linkId: link.id })
    expect(!done.ok && done.error.code).toBe("RENEWAL_DISABLED")
  })

  it("ولا يُجدَّد ملغىً ولا مجهول — التجديدُ إحياءُ عمرٍ لا نقضُ قرار", () => {
    const { world, ctx, link } = issued()
    expect(renewLink(world.log, ctx, { linkId: "لا-رابط" }).ok).toBe(false)
    revokeLink(world.log, ctx, { linkId: link.id })
    const done = renewLink(world.log, ctx, { linkId: link.id })
    expect(!done.ok && done.error.code).toBe("LINK_REVOKED")
  })
})

describe("قائمةُ روابط الحلقة — **حالةٌ بلا كشفِ الرمز**", () => {
  it("تُعرض الحالةُ (حيّ/منتهٍ/ملغى) ولا يظهر الرمزُ نفسُه بعد إصداره", () => {
    const { world, ctx, link } = issued()
    const rows = linksOfCircle(world.log, ctx, world.circleId)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.active).toBe(true)
    expect(JSON.stringify(rows)).not.toContain(link.token)
  })

  it("وبعد الإلغاء تُوسم القائمةُ بالإلغاء لا بالحذف", () => {
    const { world, ctx, link } = issued()
    revokeLink(world.log, ctx, { linkId: link.id })
    const rows = linksOfCircle(world.log, ctx, world.circleId)
    expect(rows[0]?.revoked).toBe(true)
    expect(rows[0]?.active).toBe(false)
  })

  it("وبعد انقضاء العمر تُوسم بالانتهاء — والحالةُ مشتقّةٌ لا حقلٌ مخزَّن", () => {
    const { world } = issued()
    const later = logContext(world, "u-amir", { now: new Date("2027-09-01T09:00:00.000Z") })
    const rows = linksOfCircle(world.log, later, world.circleId)
    expect(rows[0]?.expired).toBe(true)
    expect(rows[0]?.active).toBe(false)
  })
})
