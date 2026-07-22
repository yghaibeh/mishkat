/**
 * ق-١٧ — **الطرفُ الثاني من بلوغ المادة: أهذا الشخصُ من أهل وحدتها؟** (عقدُ الوحدة §٦).
 *
 * حراسةُ **الفاعل** تقع على دالة الخادم بالقدرة والنطاق. أمّا **المُوجَّهُ إليه** فسؤالٌ آخر:
 * أيقع تكليفُه داخل مسار وحدة المادة؟ وجوابُه يُقاس **بمسار التكليف لا بمسمّاه** — فصفر اسمِ
 * دورٍ في هذا الملفّ (G6)، والقياسُ نفسُه الذي يستعمله المحرّك لـ«التكليف الفعّال»
 * (معتمَدٌ · وحدتُه غيرُ مؤرشفة · فعّالٌ زمنياً — ق-٢٤/ق-٢٥).
 *
 * ولماذا **الاحتواءُ إلى الأسفل حصراً**؟ لأنّ مادةَ القسم تُوجَّه لمن **فيه**: فمادةُ
 * `/men/` تبلغ أميرَ مسجدٍ تحته، ولا تبلغ مَن تكليفُه على الجذر — لأنه ليس **من أهله**.
 * ومن أراد أن تبلغ الشبكةَ كلَّها **يُنشئها على الجذر** — فموطنُ المادة هو ما يحدّد جمهورَها
 * مكاناً، كما يحدّد جمهورَها عملاً حقلُ الجمهور.
 *
 * > **وهذا ليس فحصَ دورٍ ولا بديلاً عنه**: قب-٣٨ يجعل `library.own` تسأل **حزمةَ الدور**
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
