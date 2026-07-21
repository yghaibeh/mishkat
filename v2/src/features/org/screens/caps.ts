/**
 * قشرةُ القدرات المحسوبة على الخادم — SPEC_authorization §٤.٥ (الواجهة تعرض ولا تقرر).
 *
 * الخادم يحسب ويُرسل قائمةً مسطّحةً من القدرات الممنوحة على نطاق الشاشة؛ الواجهة تُظهر
 * وتُخفي بها فقط — لا فحصَ دورٍ في المتصفح (المادة ٤/٦). **إخفاء الزر ليس حمايةً**:
 * الحماية إعلانُ القدرة على دالة الخادم؛ وهذه القشرة تجربةُ استخدامٍ متسقةٌ مع الفرض.
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { canProvision } from "../../../authorization/provision.js"
import { unitScope } from "../../../authorization/scope.js"
import { ROLE_IDS, type RoleId, type UnitTypeId } from "../../../authorization/generated/roles.generated.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"

/** القدرات التي تحكم عناصرَ شاشات هذه الوحدة (منطاقةٌ كلُّها). */
export const SCREEN_SURFACE_CAPS: readonly CapId[] = Object.freeze([
  "network.view",
  "orgUnit.manage",
  "users.provision",
  "user.manage",
  "account.status.manage",
  "registration.approve",
  "account.password.reset",
])

/** يحسب القدرات المُتاحة للفاعل على نطاق الشاشة — تُرسل للواجهة كما هي. */
export function computeScreenCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
): ReadonlySet<CapId> {
  const granted = new Set<CapId>()
  for (const cap of SCREEN_SURFACE_CAPS) {
    if (can(actor, cap, unitScope(scopePath), ctx).allowed) granted.add(cap)
  }
  return granted
}

/**
 * الأدوار التي يجوز للفاعل توفيرُها على وحدةٍ — مصفوفة §١.٦ عبر `canProvision` وحدها.
 * تُقصي الأدوار الموقوفة والأعلى رتبةً بنيوياً ⇒ «الموقوف يظهر معطّلاً، والأعلى لا يُعرَض».
 */
export function computeProvisionableRoles(
  actor: Actor,
  unitPath: string,
  unitType: UnitTypeId,
  ctx: DecisionContext,
): readonly RoleId[] {
  return ROLE_IDS.filter((r) => canProvision(actor, r, unitPath, unitType, ctx).allowed)
}
