/**
 * قشرةُ القدرات المحسوبة لرئيسية الدور — SPEC_authorization §٤.٥ (الواجهة تعرض ولا تقرر).
 *
 * الخادمُ يحسب ويُرسل: (١) مجموعةَ القدرات المتاحة على نطاق الصفحة، (٢) **أولويةَ الشريط**
 * مشتقّةً من رتبة الدور (ق-١١٥). فلا تصل الواجهةَ كلمةُ «دور» أصلاً — لا `if role` ولا رتبة.
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { selfScope, unitScope } from "../../../authorization/scope.js"
import { CAPS, type CapId } from "../../../authorization/generated/capabilities.generated.js"
import { ROLE_CAPABILITIES } from "../../../authorization/generated/roles.generated.js"
import { navPriorityForRoles, SURFACE_GATE_CAPS, type SurfaceId } from "../../../ui/shell/surfaces.js"
import { AMIR_HOME_CONTRACT } from "./screens.js"

/** القدرات التي تحكم عناصر الرئيسية وسطوحَ القشرة معاً. */
export const HOME_SCREEN_CAPS: readonly CapId[] = Object.freeze([
  ...new Set<CapId>([...AMIR_HOME_CONTRACT.capabilities, ...SURFACE_GATE_CAPS]),
])

/**
 * **مِجسّ الملكية** للقدرات الشخصية. المحرّك يمنح القدرةَ الشخصية لمالك الكيان بلا مرورٍ
 * بالأدوار (§٤.٢) — والملكيةُ تُثبَت من **كيانٍ مخزَّن** لا من ادّعاء العميل. فلو سأله العرضُ
 * بنطاقِ ملكيةٍ مُصطنع لأجاب «نعم» دائماً، فظهر للطالب بابُ «حلقاتي»! لذلك يُحقن المِجسّ
 * صراحةً: مَن يبني الشاشةَ يقول **أيَّ الكيانات يملكها هذا الشخص فعلاً**.
 */
export type OwnershipProbe = (cap: CapId) => boolean

/**
 * مِجسٌّ انتقاليّ حتى تُبنى كياناتُ الحلقة واللجنة والعُهدة: يُسقط القدرات الشخصية من
 * **حزم أدواره المعتمدة** (المصفوفة الذهبية). ليس فحصَ دورٍ للتصريح — التصريحُ في `can()`
 * وحده؛ هذا إسقاطُ عرضٍ (المادة ٤/٦). يُستبدَل باستعلام ملكيةٍ حقيقيّ مع أول كيانٍ مملوك.
 */
export function roleBundleOwnership(actor: Actor, now: Date): OwnershipProbe {
  const bundles = actor.assignments
    .filter(
      (a) =>
        a.approvalStatus === "approved" &&
        !a.unitArchived &&
        a.startDate.getTime() <= now.getTime() &&
        (a.endDate === null || a.endDate.getTime() > now.getTime()),
    )
    .map((a) => ROLE_CAPABILITIES[a.roleId])
  return (cap) => bundles.some((b) => b.has(cap))
}

export function computeHomeCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
  owns: OwnershipProbe,
): ReadonlySet<CapId> {
  const granted = new Set<CapId>()
  for (const cap of HOME_SCREEN_CAPS) {
    // القدرةُ الشخصية نطاقُها صاحبُها لا الوحدة (§٤.٢ مسارٌ منفصل تماماً) — ولا تُعرَض
    // إلا لمن يملك كياناً من نوعها فعلاً.
    if (CAPS[cap].type === "personal") {
      if (!owns(cap)) continue
      if (can(actor, cap, selfScope(actor.personId, "surface", cap), ctx).allowed) granted.add(cap)
      continue
    }
    if (can(actor, cap, unitScope(scopePath), ctx).allowed) granted.add(cap)
  }
  return granted
}

/**
 * أولويةُ الشريط للفاعل: من إسناداته **المعتمدة الفعّالة** وحدها (لا من دورٍ مُدَّعى).
 * تُحسب هنا على الخادم وتُمرَّر قيمةً واحدة للقشرة.
 */
export function computeNavPriority(actor: Actor, now: Date): SurfaceId | null {
  const active = actor.assignments.filter(
    (a) =>
      a.approvalStatus === "approved" &&
      !a.unitArchived &&
      a.startDate.getTime() <= now.getTime() &&
      (a.endDate === null || a.endDate.getTime() > now.getTime()),
  )
  return navPriorityForRoles(active.map((a) => a.roleId))
}
