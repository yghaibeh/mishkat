/**
 * ق-١١ + ق-٢٥ — **المستهدَفون سؤالٌ للمحرّك** (عقدُ الوحدة §٢).
 *
 * هذا هو **الموضعُ الوحيد** في الوحدة الذي يُقرَّر فيه «مَن يُشعَر»، وفيه خطوتان لا ثالثة:
 *  ١. **المرشَّحون** من منفذ الإسناد المعلن — عند المسار **بعينه** (فالأقربيّةُ بنيةٌ لا شرط).
 *  ٢. **الحكمُ للمحرّك**: `can(مرشَّح، قدرةُ الحدث، نطاقُ الحدث)`.
 *
 * ومنهما تنبثق القاعدتان بلا سطرٍ إضافيّ:
 *  - **ق-١١**: مَن كُلِّف **فوق** الطبقة ليس مرشَّحاً — **ولو أجاب المحرّكُ له بنعم** (نوعُ
 *    نطاق قدرته «و»). فـ«للأقرب فقط» تُقاس بالمرشَّحين لا بفرعٍ يُنسى.
 *  - **ق-٢٥**: منتهي التكليف مرشَّحٌ **يردّه المحرّك** (`DENIED_NO_ACTIVE_ASSIGNMENT`) —
 *    فالفلترُ الزمنيُّ **تعريفٌ واحدٌ في `can()`**، ولا نسخةَ ثانيةً هنا تتباعد عنه (د-٢/د-٣).
 *
 * **وصفر قائمةِ أدوارٍ وصفر استعلامٍ موازٍ** (G6): لا اسمَ دورٍ ولا حزمةَ أدوارٍ ولا مِقبضَ
 * أشخاصٍ في مستودع الوحدة — يحرسه فحصٌ محتوائيّ في `tests/features/notifications/guards.test.ts`.
 *
 * **والسؤالُ بنيّة قراءةٍ دائماً**: هو سؤالٌ عن **مدى شخصٍ** لا فعلٌ باسمه — فلا تُحسب عليه
 * قيودُ الكتابة (نظيرُ سؤال الأمانة في الصندوق ومدى النشر في الإعلام).
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import type { NotificationAudience } from "../types.js"
import type { NotificationContext } from "./context.js"

/** سؤالُ المحرّك: (فاعلٌ، قدرةٌ، مسارُ وحدة) ⟵ نعم/لا. */
export type CapabilityAnswer = (actor: Actor, capability: CapId, scopePath: string) => boolean

export function makeCapabilityAnswer(ctx: DecisionContext): CapabilityAnswer {
  const asking: DecisionContext = { ...ctx, intent: "read" }
  return (actor, capability, scopePath) =>
    can(actor, capability, unitScope(scopePath), asking).allowed
}

/**
 * جمهورُ الحدث ⟵ معرّفاتُ المستهدَفين **مرتَّبةً حتمياً** (TESTING_POLICY §٥)
 * وبلا تكرار (شخصٌ بإسنادين عند المسار نفسِه لا يُشعَر مرتين).
 */
export function resolveTargets(
  ctx: NotificationContext,
  audience: NotificationAudience,
): readonly string[] {
  if (audience.mode === "person") return Object.freeze([audience.personId])

  const holders = ctx.ports
    .assignedAt(audience.scopePath)
    .filter((candidate) => ctx.holdsCapability(candidate, audience.capability, audience.scopePath))
    .map((candidate) => candidate.personId)

  return Object.freeze([...new Set(holders)].sort())
}
