/**
 * **الطرفُ الثاني من عزل النطاق**: مَن يُسنَد معلّماً لحلقةٍ لا بدّ أن يكون **من أهل وحدتها**
 * (عقدُ الوحدة §٤).
 *
 * حراسةُ **الفاعل** تقع على دالة الخادم بالقدرة والنطاق. أمّا **المُسنَدُ إليه** فسؤالٌ آخر:
 * أهذا الشخصُ يعمل في هذه الوحدة؟ وجوابُه يُقاس **بمسار تكليفه لا بمسمّاه** — فصفر اسمِ
 * دورٍ في هذا الملفّ (G6)، والقياسُ نفسُه الذي يستعمله المحرّك لـ«التكليف الفعّال»
 * (معتمَدٌ · وحدتُه غيرُ مؤرشفة · فعّالٌ زمنياً — ق-٢٤/ق-٢٥).
 *
 * ولماذا **الاحتواءُ إلى الأسفل حصراً**؟ لأنّ حلقةَ مسجدٍ يُعلّمها مَن يعمل فيه، لا مَن يشرف
 * عليه من فوق (ق-٨٤: الإشرافُ ليس إدخالاً). فمسؤولُ المربع **ليس داخلَ** وحدة مسجدٍ تحته.
 *
 * > **وهذا ليس فحصَ دورٍ ولا بديلاً عنه**: قب-٣٨ يجعل `circle.teach` تسأل **حزمةَ الدور**
 * > في المحرّك؛ وهذا يسأل **موضعَ التكليف** في الشجرة. سؤالان مختلفان، وكلاهما لازم.
 */

import { contains } from "../../../authorization/scope.js"
import type { Actor } from "../../../authorization/can.js"

/** دليلُ الفاعلين: يُحقن من طبقة الخادم (لقطةُ الجلسة) — لا استعلامَ داخل الخدمة. */
export type ActorDirectory = (personId: string) => Actor | null

/** سؤالُ بلوغ النطاق: (شخص، مسارُ وحدة) ⟵ نعم/لا. */
export type ScopeReach = (personId: string, unitPath: string) => boolean

export function makeScopeReach(directory: ActorDirectory, now: Date): ScopeReach {
  return (personId, unitPath) => {
    const actor = directory(personId)
    if (actor === null) return false
    return actor.assignments.some((a) => {
      if (a.approvalStatus !== "approved") return false
      if (a.unitArchived) return false
      if (a.startDate.getTime() > now.getTime()) return false
      if (a.endDate !== null && a.endDate.getTime() <= now.getTime()) return false
      return contains(unitPath, a.scopePath)
    })
  }
}
