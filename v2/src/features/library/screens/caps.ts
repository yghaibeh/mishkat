/**
 * قشرةُ القدرات المحسوبة على الخادم — `SPEC_authorization` §٤.٥ (الواجهةُ تعرض ولا تقرر).
 *
 * الخادمُ يحسب القدراتِ على **نطاق الشاشة** ويرسلها قائمةً مسطّحة؛ والواجهةُ تُظهر وتُخفي
 * بها فقط — لا فحصَ دورٍ في المتصفح (المادة ٤/٦، G6). **وإخفاءُ الزر ليس حماية**: الحمايةُ
 * إعلانُ القدرة على دالة الخادم، وهذه **اتساقُ تجربةٍ** مع الفرض لا بديلٌ عنه.
 *
 * **والقدرةُ الشخصية لا تُحسب بنطاقٍ مصطنع**: `library.own` نوعُها «ش»، فتُسأل بنطاق
 * **ملكية الفاعل نفسِه** — وهو سؤالُ قب-٣٨ بعينه: «أفي حزمةِ دورِك هذه القدرة؟». ولذلك
 * **لا يحتاج هذا الملفُّ منفذَ إسنادٍ** كما احتاجه الإعلام: صاحبُ «مكتبتي» هو السائلُ نفسُه.
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { selfScope, unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"

/** القدراتُ التي تحكم عناصرَ شاشتَي هذه الوحدة — اثنتان لا ثالثةَ لهما (عقدُ الوحدة §٩). */
export const SCREEN_SURFACE_CAPS: readonly CapId[] = Object.freeze([
  "library.own",
  "library.manage",
])

/** كيانُ الملكية في سؤال القشرة — الشخصُ نفسُه، فالسؤالُ عن حزمته لا عن كيانٍ بعينه. */
const PERSONAL_ENTITY = "libraryProgress"

export function computeLibraryCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
): ReadonlySet<CapId> {
  const asking: DecisionContext = { ...ctx, intent: "read" }
  const granted = new Set<CapId>()

  const owned = selfScope(actor.personId, PERSONAL_ENTITY, actor.personId)
  if (can(actor, "library.own", owned, asking).allowed) granted.add("library.own")
  if (can(actor, "library.manage", unitScope(scopePath), asking).allowed) {
    granted.add("library.manage")
  }
  return granted
}
