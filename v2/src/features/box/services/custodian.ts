/**
 * ق-٥٩ — **أمينُ الصندوق قدرةٌ لا قائمةُ أدوار** (عقدُ الوحدة §١).
 *
 * في v1 كانت الأمانةُ قائمةَ أدوارٍ مُصلَّبةً في الكود (`CUSTODIAN_ROLES`) فتسلّل إليها كلُّ
 * ذي تكليفٍ على الوحدة — حتى المعلّم. وفي v2 **تسقط القائمةُ كلُّها** (ث-٣): أمينُ صندوق
 * وحدةٍ هو **مَن يُجيب له المحرّكُ بنعم على `box.receive` بنطاق تلك الوحدة بعينها**.
 *
 * ونوعُ نطاق القدرة **«ذ» (مطابقةٌ تامّة)** هو ما يجعل هذا صحيحاً بالبناء: مشرفُ القسم يملك
 * `box.receive` على `/men/` فهو أمينُ صندوق قسمه **ولا يهبط** أميناً لصندوق مسجدٍ تحته
 * (§١.٥ من مواصفة الصلاحيات) — وهو عينُ ما يمنع «أمانةً بالوراثة».
 *
 * **صفر اسمِ دورٍ في هذا الملفّ** (G6): السؤالُ الوحيد المشروع «هل يملك القدرة على النطاق؟».
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { unitScope } from "../../../authorization/scope.js"

/** دليلُ الفاعلين: يُحقن من طبقة الخادم (لقطةُ الجلسة) — لا استعلامَ داخل الخدمة. */
export type ActorDirectory = (personId: string) => Actor | null

/** سؤالُ الأمانة: (شخص، مسارُ وحدة) ⟵ نعم/لا. */
export type CustodyCheck = (personId: string, unitPath: string) => boolean

/**
 * القدرةُ التي تُعرِّف الأمانة: **مَن يقبض لصندوق الوحدة هو أمينُه** (ق-٥٩).
 * قدرةٌ واحدةٌ معلنةٌ هنا، لا قائمة — وتغييرُها تغييرُ معنى «الأمين» ويمرّ بالمواصفة.
 */
const CUSTODY_CAPABILITY = "box.receive" as const

export function makeCustodyCheck(directory: ActorDirectory, ctx: DecisionContext): CustodyCheck {
  return (personId, unitPath) => {
    const actor = directory(personId)
    if (actor === null) return false
    return can(actor, CUSTODY_CAPABILITY, unitScope(unitPath), ctx).allowed
  }
}
