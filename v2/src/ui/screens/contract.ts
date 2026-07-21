/**
 * عقدُ الشاشة — SPEC_information_architecture §الحوكمة (وريثُ `ui-registry` في v1، ق-١١٣).
 *
 * **ما لا مواصفةَ له لا يُبنى**: كل شاشةٍ تعلن مسارَها وسطحَها وعدستَها ومواطنَها القانونية
 * وقدراتِ عناصرها ومصدرَ بياناتها **الواحد** وفراغَيها المُشخِّصين. أربعةُ ثوابتٍ يفرضها العقد،
 * كلٌّ يقتل عيباً موثّقاً في v1:
 *  ١. `canonicalHome` يطابق §١ — كيانٌ في موطنين يُفشل البناء (ز-١…ز-١٣).
 *  ٢. كل عنصرٍ يعلن قدرتَه من الكتالوج — لا زرٌّ بلا سند (ع-٥).
 *  ٣. `dataSource` واحدٌ — الحقيقةُ الواحدة في الصفحة (ق-١١١): لا كتابةٌ هنا وقراءةٌ هناك.
 *  ٤. `emptyStates` مُشخِّصة (ق-١١٢): دعوةُ فعلٍ لصاحبه وتشخيصٌ للمطّلع.
 */

import type { CapId } from "../../authorization/generated/capabilities.generated.js"
import type { RoleId } from "../../authorization/generated/roles.generated.js"
import { CAPS } from "../../authorization/generated/capabilities.generated.js"
import { ROLES } from "../../authorization/generated/roles.generated.js"
import { TEXT, type TextKey } from "../text/dictionary.js"
import { SURFACE_IDS, type SurfaceId } from "../shell/surfaces.js"
import { ENTITY_IDS, type EntityId } from "./entities.js"

export type ScreenState = "active" | "suspended"

export type ScreenContract = {
  /** المسارُ الوحيد للشاشة (يبدأ بـ`/`). */
  readonly route: string
  readonly surface: SurfaceId
  /** العدسة/العدسات التي تخدمها الشاشة (`SPEC_role_lenses`). */
  readonly lenses: readonly RoleId[]
  /** الكياناتُ التي هذه **موطنُها القانونيّ**؛ فارغةٌ = عرضٌ منسوبٌ (رابطٌ لا نسخة). */
  readonly canonicalHome: readonly EntityId[]
  /** القدرةُ الحارسة لكل عنصرٍ في الشاشة. */
  readonly capabilities: readonly CapId[]
  /** مصدرُ البيانات الواحد (ق-١١١). */
  readonly dataSource: string
  readonly emptyStates: { readonly owner: TextKey; readonly viewer: TextKey }
  /** الأدوارُ الموقوفة: شاشاتُها لا تُحاكَم حتى التفعيل (§٢.١٢/٢). */
  readonly state?: ScreenState
}

/** يعيد قائمةَ المخالفات — فارغةٌ = عقدٌ صالح. */
export function validateContract(c: ScreenContract): readonly string[] {
  const v: string[] = []

  if (!c.route.startsWith("/")) v.push(`المسار يجب أن يبدأ بـ«/»: ${c.route}`)
  if (!SURFACE_IDS.includes(c.surface)) v.push(`سطحٌ مجهول: ${c.surface}`)
  if (c.lenses.length === 0) v.push("لا عدسة معلنة — لكل شاشةٍ دورٌ تخدمه (SPEC_role_lenses)")
  for (const role of c.lenses) {
    if (ROLES[role] === undefined) v.push(`عدسةٌ لدورٍ مجهول: ${role}`)
  }
  for (const entity of c.canonicalHome) {
    if (!ENTITY_IDS.includes(entity)) v.push(`كيانٌ خارج تصنيف IA §١: ${entity}`)
  }
  for (const cap of c.capabilities) {
    if (CAPS[cap] === undefined) v.push(`قدرةٌ خارج الكتالوج: ${cap}`)
  }
  if (c.dataSource.trim().length === 0) {
    v.push("لا مصدر بياناتٍ واحد معلن (ق-١١١: الحقيقةُ الواحدة في الصفحة)")
  }
  if (TEXT[c.emptyStates.owner] === undefined) v.push("فراغُ صاحب العمل بمفتاحٍ مجهول")
  if (TEXT[c.emptyStates.viewer] === undefined) v.push("فراغُ المطّلع بمفتاحٍ مجهول")

  return v
}
