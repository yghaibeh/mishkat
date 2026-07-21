/**
 * ق-١٠٥ — **النشرُ شخصيٌّ في هويته، منطاقٌ في مداه** (عقدُ الوحدة §٢.٢).
 *
 * `media.post` **شخصية**، فمسارُ قرارها في المحرّك ملكيةُ الكيان **ولا يفحص نطاقاً**. وق-١٠٥
 * يشترط مع ذلك أن تكون التغطيةُ **معزولةً بالنطاق كسائر الروافد**: «لا تغطّي وحدةً خارج
 * نطاقك». فالمدى يُسأل هنا — **للمحرّك نفسِه** لا لقائمة أدوار:
 *
 *   «هل يُجيب المحرّكُ بنعم على `media.hub` بمسار وحدة التغطية؟»
 *
 * وهو نظيرُ `isBoxCustodian` في ق-٥٩ حرفاً بحرف: **صفر اسمِ دورٍ وصفر قائمةِ أدوار** (G6).
 * ونوعُ نطاق `media.hub` **«و» (احتواء)** هو ما يجعل مسؤولَ إعلامِ القسم يغطّي ما تحته
 * ولا يبلغ قسماً مجاوراً.
 *
 * **والسؤالُ بنيّة قراءة دائماً**: هو سؤالٌ عن مدى شخصٍ لا فعلٌ باسمه — فلا تُحسب عليه
 * قيودُ الكتابة (نظيرُ سؤال الأمانة في الصندوق).
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { unitScope } from "../../../authorization/scope.js"

/** دليلُ الفاعلين: يُحقن من طبقة الخادم (لقطةُ الجلسة) — لا استعلامَ داخل الخدمة. */
export type ActorDirectory = (personId: string) => Actor | null

/** سؤالُ المدى: (شخص، مسارُ وحدة) ⟵ نعم/لا. */
export type PublishingScopeCheck = (personId: string, unitPath: string) => boolean

/**
 * القدرةُ التي تُعرِّف مدى النشر: **مركزُ الإعلام والمعرض على النطاق** (ق-١٠٥).
 * قدرةٌ واحدةٌ معلنةٌ هنا لا قائمة — وتغييرُها تغييرُ معنى «نطاقي» ويمرّ بالمواصفة.
 */
const PUBLISHING_SCOPE_CAPABILITY = "media.hub" as const

export function makePublishingScopeCheck(
  directory: ActorDirectory,
  ctx: DecisionContext,
): PublishingScopeCheck {
  const asking: DecisionContext = { ...ctx, intent: "read" }
  return (personId, unitPath) => {
    const actor = directory(personId)
    if (actor === null) return false
    return can(actor, PUBLISHING_SCOPE_CAPABILITY, unitScope(unitPath), asking).allowed
  }
}
