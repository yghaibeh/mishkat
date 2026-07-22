/**
 * محرك الصلاحيات — نقطة الفرض الوحيدة في مِشكاة v2.
 * العقد: SPEC_authorization §٤ (الخطوات العشر بترتيبها الملزم).
 *
 * ثوابت هذا الملف:
 *  - **دالة نقية**: صفر استعلام قاعدة بيانات لكل قرار (§٤.٥). كل ما يلزم في `Actor` و`ctx`.
 *  - **لا مفهوم «مدير» هنا إطلاقاً**: لا دالة ولا ثابت ولا مقارنة دور. السؤال الوحيد
 *    المشروع هو «هل يملك القدرة X على النطاق Y؟» (ت-٥، ت-٦).
 *  - **النطاق معامل إلزامي**: التوقيع نفسه يمنع `can(user, cap)` (المادة ٤/٣).
 */

import { CAPS, type CapId } from "./generated/capabilities.generated.js"
import { ROLES, ROLE_CAPABILITIES, type RoleId } from "./generated/roles.generated.js"
import { contains, type Scope } from "./scope.js"
import type { ReasonCode } from "./reasons.js"

export type { ReasonCode } from "./reasons.js"

export type Assignment = {
  readonly roleId: RoleId
  readonly scopePath: string
  readonly startDate: Date
  readonly endDate: Date | null
  readonly approvalStatus: "pending" | "approved" | "rejected"
  /** مؤرشفةٌ وحدتُه؟ يُحسب عند الدخول — لا استعلام داخل المحرك. */
  readonly unitArchived: boolean
}

export type Override = {
  readonly capId: CapId
  readonly scopePath: string
  readonly effect: "grant" | "deny"
  readonly startDate: Date
  readonly endDate: Date | null
  /** إلزامي — نصٌّ يشرح لماذا (§١.٤). */
  readonly reason: string
}

export type Actor = {
  readonly personId: string
  readonly accountStatus: "active" | "suspended" | "cancelled"
  /** حِقبة الجلسة المحمولة في الرمز. */
  readonly sessionEpoch: number
  /** الحِقبة الحيّة للمستخدم — تُقرأ مع لقطة الجلسة (ق-٢٣). */
  readonly currentSessionEpoch: number
  readonly assignments: readonly Assignment[]
  readonly overrides: readonly Override[]
  /** إن كانت جلسة انتحال قرائي: مَن ينظر فعلاً (ب-٤٠أ). */
  readonly impersonatedBy?: string
}

/**
 * السياق المحقون. الساعة ومفاتيح التفعيل **تُحقن ولا تُستورد**:
 * دالةٌ تقرأ `Date.now()` من داخلها ليست حتمية ولا تُختبر (TESTING_POLICY §٥).
 */
export type DecisionContext = {
  readonly now: Date
  /** هل الفعل كاتب؟ يقرره إعلان دالة الخادم لا المحرك. */
  readonly intent: "read" | "write"
  readonly isFeatureEnabled: (flagId: string) => boolean
}

export type Decision = {
  readonly allowed: boolean
  readonly reason: ReasonCode
  readonly grantedVia?: { roleId: RoleId; assignmentScope: string } | { override: "grant" }
  readonly deniedBy?: { override: "deny"; scope: string } | { requiredCapability: CapId }
}

/**
 * ارتباط القدرة بمفتاح تفعيل — مشتقٌّ نصاً من `SPEC_settings` §٢ مجال `feature`
 * («القيد المحاسبي اليدوي بواجهة… التعطيل يمنع قيوداً جديدة»).
 * لا يُضاف هنا ارتباطٌ بلا نصٍّ في مواصفة (وإلا صار اختراع سياسة).
 */
const CAPABILITY_FEATURE_FLAGS: Partial<Record<CapId, string>> = Object.freeze({
  "ledger.journal.entry": "feature.manual_journal_entry",
})

function isTemporallyActive(startDate: Date, endDate: Date | null, now: Date): boolean {
  if (startDate.getTime() > now.getTime()) return false
  if (endDate !== null && endDate.getTime() <= now.getTime()) return false
  return true
}

function activeOverrides(actor: Actor, cap: CapId, now: Date, effect: "grant" | "deny"): Override[] {
  return actor.overrides.filter(
    (o) => o.capId === cap && o.effect === effect && isTemporallyActive(o.startDate, o.endDate, now),
  )
}

/**
 * الإسنادات الفعّالة زمنياً (ق-٢٤، ق-٢٥) — **تعريفٌ واحد** يخدم مسار القدرة الشخصية
 * (الخطوة ٢) ومسار الأدوار (الخطوة ٤) معاً: تعريفان لـ«الإسناد الفعّال» يتباعدان حتماً.
 */
function activeAssignments(actor: Actor, now: Date): Assignment[] {
  return actor.assignments.filter(
    (a) =>
      a.approvalStatus === "approved" &&
      !a.unitArchived &&
      isTemporallyActive(a.startDate, a.endDate, now),
  )
}

function deny(reason: ReasonCode, deniedBy?: Decision["deniedBy"]): Decision {
  return deniedBy === undefined ? { allowed: false, reason } : { allowed: false, reason, deniedBy }
}

function allow(reason: ReasonCode, grantedVia?: Decision["grantedVia"]): Decision {
  return grantedVia === undefined ? { allowed: true, reason } : { allowed: true, reason, grantedVia }
}

export function can(actor: Actor, cap: CapId, scope: Scope, ctx: DecisionContext): Decision {
  // ── خطوة ٠: تحقّق الكتالوج ──────────────────────────────────────────────
  const meta = CAPS[cap] as (typeof CAPS)[CapId] | undefined
  if (meta === undefined) return deny("DENIED_UNKNOWN_CAPABILITY")

  // ── خطوة ١: بوابات الهوية (تسبق كل شيء) ─────────────────────────────────
  if (actor.accountStatus !== "active") return deny("DENIED_ACCOUNT_SUSPENDED")
  if (actor.sessionEpoch !== actor.currentSessionEpoch) return deny("DENIED_SESSION_STALE")

  // ── خطوة ١ب: الانتحال القرائي — كل فعل كاتب يُرفض (ب-٤٠أ) ───────────────
  if (actor.impersonatedBy !== undefined && ctx.intent === "write") {
    return deny("DENIED_IMPERSONATION_READONLY")
  }

  // ── خطوة ١ج: مفتاح التفعيل ──────────────────────────────────────────────
  const flag = CAPABILITY_FEATURE_FLAGS[cap]
  if (flag !== undefined && !ctx.isFeatureEnabled(flag)) return deny("DENIED_FEATURE_DISABLED")

  const denies = activeOverrides(actor, cap, ctx.now, "deny")
  const grants = activeOverrides(actor, cap, ctx.now, "grant")

  // ── خطوة ٢: مسار القدرة الشخصية — شرطان مجتمعان: دورُك يمنحها **وأنت** صاحبُها ──
  // لا فرع هنا يقول «إن كان مديراً»: الشمول اطّلاع لا عمل (ق-٢٧). ولا يمرّ بالنطاق:
  // القدرة الشخصية تتبع الشخصَ لا الشجرة — يُسأل عن الحزمة لا عن موضع التكليف (§١.١).
  if (meta.type === "personal") {
    // الحجب أداة أمان تسبق كل شيء، حتى على الصاحب نفسه (§١.٤).
    const blocking = denies[0]
    if (blocking !== undefined) {
      return deny("DENIED_EXPLICIT_BLOCK", { override: "deny", scope: blocking.scopePath })
    }
    // **CR-012/قب-٣٨ — الشرط الأول: أفي حزمة دورِك هذه القدرة؟** بدونه تكون الملكيةُ وحدَها
    // باباً، فيصير مَن يملك **دعوى الإنشاء** صاحباً فيمارس ما لا تخوّله المصفوفة — وتُعطَّل
    // عشرُ خلايا شخصية (`admin × media.post = ·` مكتوبةٌ غيرُ نافذة). والسببُ **مميِّزٌ جديد**:
    // «دورك لا يمنحها» غيرُ «لست صاحبها» — والتشخيص جزءٌ من العقد (§٤.١).
    const bundleHolds = activeAssignments(actor, ctx.now).some(
      (a) => ROLES[a.roleId].state === "active" && ROLE_CAPABILITIES[a.roleId].has(cap),
    )
    // المخرجُ نفسُه المعلن: منحٌ فرديّ صريح مؤقت عند شغور الدور (§١.٤) — لا مخرجَ سواه.
    if (!bundleHolds && grants.length === 0) {
      return deny("DENIED_PERSONAL_NOT_IN_ROLE", { requiredCapability: cap })
    }
    if (scope.kind !== "self") return deny("DENIED_PERSONAL_NOT_OWNER")
    if (scope.ownerPersonId !== actor.personId) {
      // المخرج الوحيد: منحٌ فرديّ صريح مؤقت عند شغور الدور.
      if (grants.length > 0) return allow("ALLOWED_BY_GRANT", { override: "grant" })
      return deny("DENIED_PERSONAL_NOT_OWNER")
    }
    return allow("ALLOWED_PERSONAL_OWNER")
  }

  // ── خطوة ٣: القدرة الجذرية نطاقها الجذر حصراً ───────────────────────────
  // بترتيب §٤.٢ الحرفي: يسبق فحصَ نوع النطاق، فأيّ نطاقٍ غير الجذر (ولو شخصياً)
  // يعيد السبب المُشخِّص «صلاحية شبكية على الجذر حصراً» لا «خارج النطاق» المبهم.
  if (meta.type === "root" && (scope.kind !== "unit" || scope.path !== "/")) {
    return deny("DENIED_ROOT_SCOPE_REQUIRED")
  }

  // ما بعد هذه النقطة قدرةٌ منطاقة: تحتاج نطاق وحدة.
  if (scope.kind !== "unit") return deny("DENIED_OUT_OF_SCOPE")

  // ── خطوة ٤: الإسنادات الفعّالة زمنياً (ق-٢٤، ق-٢٥) ──────────────────────
  const temporallyActive = activeAssignments(actor, ctx.now)
  const hasOverrides = denies.length > 0 || grants.length > 0
  if (temporallyActive.length === 0 && !hasOverrides) return deny("DENIED_NO_ACTIVE_ASSIGNMENT")

  // ── خطوة ٥: تفعيل الدور (قب-٧) — لا صمت ولا سقوط إلى «صفر قدرات» ───────
  const withActiveRole = temporallyActive.filter((a) => ROLES[a.roleId].state === "active")
  if (temporallyActive.length > 0 && withActiveRole.length === 0 && !hasOverrides) {
    return deny("DENIED_ROLE_SUSPENDED")
  }

  // ── خطوة ٦: اتحاد القدرات المنطاقة ──────────────────────────────────────
  const roleScopes = withActiveRole.filter((a) => ROLE_CAPABILITIES[a.roleId].has(cap))

  // ── خطوة ٨: الحجب يغلب — قبل أي فحص منح ─────────────────────────────────
  const blocking = denies.find((o) => contains(o.scopePath, scope.path))
  if (blocking !== undefined) {
    return deny("DENIED_EXPLICIT_BLOCK", { override: "deny", scope: blocking.scopePath })
  }

  // ── خطوة ٩: فحص النطاق بالاحتواء ────────────────────────────────────────
  if (roleScopes.length === 0 && grants.length === 0) {
    return deny("DENIED_NO_CAPABILITY", { requiredCapability: cap })
  }

  // نطاق «ذ» يسري على وحدة التكليف بذاتها حصراً — لا ما تحتها (§٣.٢).
  const matchingRole = roleScopes.find((a) =>
    meta.scopeKind === "exact" ? a.scopePath === scope.path : contains(a.scopePath, scope.path),
  )
  if (matchingRole !== undefined) {
    return allow("ALLOWED_BY_ROLE", {
      roleId: matchingRole.roleId,
      assignmentScope: matchingRole.scopePath,
    })
  }

  // المنح الفردي منطاقٌ بالاحتواء دائماً: «ينجح على نطاق المنح وما تحته حصراً» (§١.٤).
  const matchingGrant = grants.find((o) => contains(o.scopePath, scope.path))
  if (matchingGrant !== undefined) return allow("ALLOWED_BY_GRANT", { override: "grant" })

  return deny("DENIED_OUT_OF_SCOPE")
}
