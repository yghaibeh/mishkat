/**
 * مصفوفة التمكين المفوَّض — SPEC_authorization §١.٦.
 *
 * القاعدة الرياضية المانعة لتصعيد الامتياز: الشروط الخمسة كلها، لا بعضها.
 * برهانها: بموجب ش٢ كل حسابٍ مُوفَّر رتبتُه أكبر قطعاً من رتبة موفِّره، وبموجب ش٤
 * نطاقُه محتوىً في نطاق موفِّره ⇒ سلسلة التوفير متناقصة السلطة والنطاق حتماً،
 * فلا تعود سلسلةٌ مهما طالت إلى رتبةٍ أدنى أو نطاقٍ أوسع من نقطة انطلاقها. ∎
 */

import { can, type Actor, type DecisionContext } from "./can.js"
import { unitScope, contains } from "./scope.js"
import { ROLES, type RoleId, type UnitTypeId } from "./generated/roles.generated.js"
import {
  PROVISION_CAPABILITY,
  ELEVATED_ROLES,
  ELEVATED_GRANT_CAPABILITY,
  UNIT_TYPE_ALLOWED_ROLES,
} from "./generated/provision.generated.js"

export type ProvisionCondition = "ش١" | "ش٢" | "ش٣" | "ش٤" | "ش٥" | "موقوف"

export type ProvisionDecision = {
  readonly allowed: boolean
  /** أيّ شرطٍ سقط — فيظهر للمستخدم سببٌ مفهوم لا «تعذرت الإضافة». */
  readonly failedCondition?: ProvisionCondition
}

/** الإسنادات الفعّالة زمنياً وبدورٍ فعّال — نفس معيار خطوتَي ٤ و٥ في `can()`. */
function activeAssignments(actor: Actor, now: Date) {
  return actor.assignments.filter(
    (a) =>
      a.approvalStatus === "approved" &&
      !a.unitArchived &&
      a.startDate.getTime() <= now.getTime() &&
      (a.endDate === null || a.endDate.getTime() > now.getTime()) &&
      ROLES[a.roleId].state === "active",
  )
}

function fail(condition: ProvisionCondition): ProvisionDecision {
  return { allowed: false, failedCondition: condition }
}

export function canProvision(
  provisioner: Actor,
  targetRole: RoleId,
  targetUnitPath: string,
  targetUnitType: UnitTypeId,
  ctx: DecisionContext,
): ProvisionDecision {
  // الدور الموقوف لا يظهر في أي منتقي دور (قب-٧، §١.٢).
  if (ROLES[targetRole].state !== "active") return fail("موقوف")

  // ش١ — القدرة: هل يحمل `users.provision` على أيّ نطاق أصلاً؟
  // (نصّ §١.٦ يكتب ش١ على نطاق الهدف، فيبتلع ش٤ ويجعلها ميتة. فصلناهما بمقصدَيهما
  //  المعلنين — «من لا يملكها لا يوفّر» × «التوفير خارج النطاق» — ليبقى لكلٍّ تشخيصُه.)
  // ملاحظة أمنية: يُرشَّح من **الإسنادات الفعّالة** حصراً، وإلا وسّع إسنادٌ منتهٍ
  // مدى التوفير لأن `can()` كان يمرّ عبر إسنادٍ آخر حيّ.
  const active = activeAssignments(provisioner, ctx.now)
  const scopesHoldingProvision = active.filter(
    (a) => can(provisioner, PROVISION_CAPABILITY, unitScope(a.scopePath), ctx).allowed,
  )
  if (scopesHoldingProvision.length === 0) return fail("ش١")

  // ش٢ — الرتبة الأدنى قطعاً: لا أحد يوفّر دوراً في رتبته أو أعلى.
  // `active` غير فارغة قطعاً هنا (ش١ مرّت) — فلا حارس ميت على المجموعة الفارغة.
  const minRank = Math.min(...active.map((a) => ROLES[a.roleId].rank))
  if (!(ROLES[targetRole].rank > minRank)) return fail("ش٢")

  // ش٣ — نوع الوحدة.
  if (!UNIT_TYPE_ALLOWED_ROLES[targetUnitType].has(targetRole)) return fail("ش٣")

  // ش٤ — الاحتواء: النطاق محتوىً في أحد نطاقات الموفِّر الحاملة للقدرة.
  if (!scopesHoldingProvision.some((a) => contains(a.scopePath, targetUnitPath))) return fail("ش٤")

  // ش٥ — الأدوار العليا محجوزة: منحها يلزمه القدرة الجذرية.
  if (ELEVATED_ROLES.has(targetRole)) {
    const elevated = can(provisioner, ELEVATED_GRANT_CAPABILITY, unitScope("/"), ctx)
    if (!elevated.allowed) return fail("ش٥")
  }

  return { allowed: true }
}
