/**
 * ق-٨١ — **الطرفُ الثاني من عزل النطاق: «ولا لشخصٍ خارج نطاقك»** (عقدُ الوحدة §٤).
 *
 * حراسةُ الفاعل تقع على دالة الخادم بالقدرة والنطاق. أمّا **المستلِم** فسؤالٌ آخر: هل هذا
 * الشخصُ **من أهل هذه الوحدة**؟ وجوابُه يُقاس **بمسار تكليفه لا بمسمّاه** — فصفر اسمِ دورٍ
 * في هذا الملفّ (G6)، والقياسُ نفسُه الذي يستعمله المحرّك لـ«التكليف الفعّال»
 * (معتمَدٌ · وحدتُه غيرُ مؤرشفة · فعّالٌ زمنياً — ق-٢٤/ق-٢٥).
 *
 * ولماذا **الاحتواء إلى الأسفل حصراً**؟ لأنّ عهدةَ مسجدٍ تُسلَّم لمن يعمل فيه، لا لمن يشرف
 * عليه من فوق: ومن أراد عهدةً على نطاقه الأعلى **يُسجّل الأصل في وحدته** — فالموطنُ
 * التنظيميّ للأصل هو ما يحدّد دائرةَ مستلِميه.
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
