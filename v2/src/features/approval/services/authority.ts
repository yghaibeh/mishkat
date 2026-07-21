/**
 * **الشرطُ اللازم**: «أيملك القدرةَ على النطاق؟» — ولا شيءَ غيرَه (`SPEC_authorization` §٤.٢).
 *
 * هذا الملفُّ هو **الجسرُ الوحيد** بين المحرّك و`can()`، ووظيفتُه أن يجعل بقيّةَ المحرّك
 * **لا تعرف دوراً ولا تستورد محرّكَ صلاحيات**: تسأل دالةً محقونةً جوابُها نعم/لا (نظيرُ
 * `makeCustodyCheck` في الصندوق — ق-٥٩/G6).
 *
 * **ولا يُدمج الفحصان**: هنا القدرةُ وحدها، وفي `routing.ts` الأقربيّةُ وحدها. دمجُهما هو
 * ما جعل `approvalRouting` في v1 يستورد مفاهيمَ القدرات ويعرف عن «admin» — وهو ما نمنعه.
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"

/** سؤالُ القدرة: (شخص، قدرة، مسارُ نطاق) ⟵ نعم/لا. */
export type CapabilityCheck = (personId: string, capability: CapId, scopePath: string) => boolean

/**
 * يبني السؤالَ على لقطةِ الفاعلين المحقونة — **لا استعلامَ داخل الخدمة** (§٤.٥).
 * والنيّةُ في السياق **قراءةٌ** دائماً: السؤالُ عن سلطةِ شخصٍ ليس فعلاً باسمه.
 */
export function makeCapabilityCheck(
  people: readonly Actor[],
  ctx: DecisionContext,
): CapabilityCheck {
  const byId = new Map(people.map((p) => [p.personId, p]))
  const readCtx: DecisionContext = { ...ctx, intent: "read" }
  return (personId, capability, scopePath) => {
    const actor = byId.get(personId)
    if (actor === undefined) return false
    return can(actor, capability, unitScope(scopePath), readCtx).allowed
  }
}
