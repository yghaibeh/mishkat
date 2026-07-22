/**
 * §٢ — **الجمهورُ قدرةٌ يُسأل عنها المحرّك، لا اسمُ دورٍ يُقارَن** (G6، ق-٩٦).
 *
 * في v1 كان الجمهورُ يُشتقّ من **قائمةِ أدوارٍ مُصلَّبةٍ في الكود**:
 * `const SUPERVISOR_ROLES = ["square","rabita","section_head"]` ثم `roles.has(r)`
 * (`materials.server.ts:26-36`). وهذا السطرُ **تُفشله G6 اليوم** — ولا يُلتفّ عليه، بل
 * **يُعاد صوغُ السؤال**: الجمهورُ **حزمةُ عملٍ**، وحزمةُ العمل في v2 اسمُها **قدرة**.
 *
 * فالانتماءُ سؤالٌ واحدٌ للمحرّك، **بنيّة قراءةٍ دائماً** (هو سؤالٌ عن مدى شخصٍ لا فعلٌ باسمه):
 *  - **القدرةُ الشخصية** تُسأل بنطاق **ملكية الشخص نفسِه** ⇒ الجوابُ «أفي حزمةِ دورِك هذه
 *    القدرة؟» — وهو **نصُّ قب-٣٨** حرفاً بحرف.
 *  - **القدرةُ المنطاقة** تُسأل على **مساراتِ تكليفه** ⇒ «أيمارس هذا العملَ في مكانٍ ما؟».
 *
 * ثلاثةُ مكاسبَ تُسجَّل: **صفر اسمِ دورٍ في الوحدة** · **دورٌ جديدٌ يدخل جمهورَه يومَ تُمنح
 * له القدرةُ في الملف الذهبيّ** بلا سطرِ كود · و**الجمهورُ يُضاف بياناً** (قب-٢٢).
 *
 * > **ولا تعرف هذه الدالةُ أيَّ قدرةٍ يحمل جمهورٌ**: تستقبلها معاملاً من **البيانات المرجعية**.
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { CAPS, type CapId } from "../../../authorization/generated/capabilities.generated.js"
import { selfScope, unitScope } from "../../../authorization/scope.js"

/** دليلُ الفاعلين: يُحقن من طبقة الخادم (لقطةُ الجلسة) — لا استعلامَ داخل الخدمة. */
export type ActorDirectory = (personId: string) => Actor | null

/** سؤالُ الانتماء: (شخص، قدرةُ الجمهور) ⟵ نعم/لا. */
export type AudienceMembership = (personId: string, capabilityId: CapId) => boolean

/** كيانُ الملكية في سؤال الانتماء — **سؤالٌ لا فعل**، فالكيانُ هو الشخصُ نفسُه. */
const MEMBERSHIP_ENTITY = "libraryAudience"

export function makeAudienceMembership(
  directory: ActorDirectory,
  ctx: DecisionContext,
): AudienceMembership {
  const asking: DecisionContext = { ...ctx, intent: "read" }
  return (personId, capabilityId) => {
    const actor = directory(personId)
    if (actor === null) return false

    if (CAPS[capabilityId].type === "personal") {
      const owned = selfScope(actor.personId, MEMBERSHIP_ENTITY, actor.personId)
      return can(actor, capabilityId, owned, asking).allowed
    }

    // **المسارُ لا المسمّى**: يُسأل المحرّكُ على كل موضعِ تكليفٍ، وهو يفصل في الفعّال منها.
    return actor.assignments.some(
      (a) => can(actor, capabilityId, unitScope(a.scopePath), asking).allowed,
    )
  }
}
