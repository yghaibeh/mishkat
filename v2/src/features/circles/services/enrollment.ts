/**
 * عضويةُ الحلقة — **الكاتبُ الوحيد** لسجل الطلاب (عقدُ الوحدة §٥، ق-٣١، ق-٨٤).
 *
 * كان في v1 سجلّان لا يلتقيان («أضفتُ ٢٠ طالباً وسجلُّ اليوم يقول لا طلاب»)، فبُني الجسرُ
 * ليخيطهما (ق-٨٨). وفي v2 **سجلٌّ واحد**: الطالبُ ابنُ الحلقة، يُكتب هنا ويُقرأ من هنا —
 * فما يُدخَل يظهر، وهو علاجُ ج٥ البنيويّ (انفصامُ الكتابة عن القراءة).
 *
 * و**الاسمُ نصٌّ حرٌّ بلا هوية** (ق-٣١): ليس كلُّ مذكورٍ مستخدماً، والحسابُ يُنشأ عند الحاجة
 * فقط بالتمكين المفوَّض في `org`. ولذلك **لا معرّفَ شخصٍ في هذا الكيان أصلاً**.
 */

import type { CirclesStore } from "../data/store.js"
import type { CirclesContext } from "./context.js"
import { liveCircle } from "./circles.js"
import { circlesErr, circlesOk, type CirclesResult, type Enrollment } from "../types.js"

export type EnrollInput = {
  readonly circleId: string
  readonly nameAr: string
}

/**
 * **إدخالُ الطالب** — قدرتُه `circle.manage` (ق-٨٤: الإدخالُ لمالكه؛ المشرفُ والمديرُ يريان
 * ولا يُدخلان). والسعةُ **تُعرض ولا تُفرض** (عقدُ الوحدة §٦): لا نصَّ يفرض ردَّ الالتحاق عند
 * الامتلاء، وفرضُها اختراعُ قاعدةٍ يمرّ ببروتوكول التغيير.
 */
export function enroll(
  store: CirclesStore,
  ctx: CirclesContext,
  input: EnrollInput,
): CirclesResult<Enrollment> {
  const found = liveCircle(store, input.circleId)
  if (!found.ok) return found
  if (input.nameAr.trim().length === 0) return circlesErr("EMPTY_NAME")

  const enrollment: Enrollment = {
    tenantId: store.tenantId,
    id: store.nextId("enrollment"),
    circleId: found.value.id,
    nameAr: input.nameAr.trim(),
    joinedAt: ctx.now,
    leftAt: null,
  }
  store.appendEnrollment(enrollment)
  return circlesOk(enrollment)
}

/** **الخروجُ وسمٌ لا محو** (المادة ٧/٤) — والوسمُ الثاني مرفوضٌ فلا يُكتب فوق الأول. */
export function endEnrollment(
  store: CirclesStore,
  ctx: CirclesContext,
  input: { readonly enrollmentId: string },
): CirclesResult<Enrollment> {
  const current = store.getEnrollment(input.enrollmentId)
  if (current === null) return circlesErr("UNKNOWN_ENROLLMENT", input.enrollmentId)
  if (current.leftAt !== null) return circlesErr("ALREADY_LEFT", input.enrollmentId)

  return circlesOk(store.stampLeft(current.id, ctx.now))
}
