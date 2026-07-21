/**
 * قشرةُ القدرات المحسوبة على الخادم — `SPEC_authorization` §٤.٥ (الواجهةُ تعرض ولا تقرر).
 *
 * الخادمُ يحسب القدراتِ على **نطاق الشاشة** ويرسلها قائمةً مسطّحة؛ والواجهةُ تُظهر وتُخفي
 * بها فقط — لا فحصَ دورٍ في المتصفح (المادة ٤/٦، G6). **وإخفاءُ الزر ليس حماية**: الحمايةُ
 * إعلانُ القدرة على دالة الخادم، وهذه **اتساقُ تجربةٍ** مع الفرض لا بديلٌ عنه.
 *
 * **والقدرةُ الشخصية لا تُحسب بنطاق**: `media.post` نوعُها «ش»، ومسارُ قرارها في المحرّك
 * ملكيةُ الكيان. فلا تُسأل هنا بنطاقٍ مصطنع — وإلا ظهر بابٌ شخصيٌّ للجميع (وهو عينُ العيب
 * الذي اصطاده سياجُ الواجهة في T5). حضورُها يُحسب من **إحصاء مسؤولي الإعلام على نطاق
 * الصفحة** (واجهةُ الإسناد المعلنة — عقدُ الوحدة §٥)، وفرضُها في الخادم بنطاقٍ شخصيّ.
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"

/** القدراتُ التي تحكم عناصرَ شاشتَي هذه الوحدة — اثنتان لا ثالثةَ لهما (عقدُ الوحدة §٦). */
export const SCREEN_SURFACE_CAPS: readonly CapId[] = Object.freeze(["media.hub", "media.post"])

/** القدرةُ الشخصية: تُستثنى من الحساب بالنطاق وتُسأل بإحصاء المسؤولين. */
const PERSONAL_CAPS: readonly CapId[] = Object.freeze(["media.post"])

export function computeMediaCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
  officersIn: (unitPath: string) => readonly string[],
): ReadonlySet<CapId> {
  const granted = new Set<CapId>()
  for (const cap of SCREEN_SURFACE_CAPS) {
    if (PERSONAL_CAPS.includes(cap)) continue
    if (can(actor, cap, unitScope(scopePath), ctx).allowed) granted.add(cap)
  }
  if (officersIn(scopePath).includes(actor.personId)) granted.add("media.post")
  return granted
}
