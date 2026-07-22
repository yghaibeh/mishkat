/**
 * ق-٨٧ + ب-٣٥أ — **ملاحظاتُ الإشراف**: يكتبها المشرف، ويقرؤها المعلّم (عقدُ الوحدة §٦).
 *
 * **الخطأُ المكلف الذي تقتله** (التدقيق ٣٣ أ-٥): كان المعلّمُ في v1 **يحرّر ملاحظات المشرف
 * على نفسه**. وفي v2 الحمايةُ في موضعين لا واحد:
 *  - **الكتابةُ قدرةٌ**: `circle.notes.supervise` ليست في حزمة المعلّم ⇒ رفضٌ في الخادم
 *    (فرضُه على دالة الخادم لا هنا — G6: لا فحصَ دورٍ في الخدمة).
 *  - **والملاحظةُ سجلٌّ يُلحق**: لا دالةَ تحريرٍ ولا محوٍ في هذا الملفّ أصلاً (المادة ٧/٤)
 *    — فلا يوجد **مقبضٌ** يُحرَّر به حتى لو مُنحت القدرةُ خطأً.
 *
 * و**قراءةُ المعلّم سياسةُ عرضٍ بمفتاح** (ب-٣٥أ، قرارُ المالك: تُعرض) — والمفتاحُ **يضبط
 * قيمةً ولا يُلغي حارساً** (`SPEC_settings` §١-٨أ): إطفاؤه يُخفي القراءة، ولا يمنح تحريراً.
 */

import type { TahfeezLogStore } from "../data/store.js"
import { settingBoolean, type TahfeezLogContext } from "./context.js"
import { logErr, logOk, type SupervisionNote, type DayLogResult } from "../types.js"

export type RecordNoteInput = {
  readonly circleId: string
  readonly bodyAr: string
}

/**
 * **كتابةُ ملاحظةٍ** — إلحاقاً لا استبدالاً. والنصُّ **حرٌّ عمداً** (ق-٨٩ نصاً: «المفتوحُ
 * بطبيعته — ملاحظات ونشاطات — يبقى حرّاً»)، والفارغُ مرفوضٌ فلا يُوثَّق فراغ.
 */
export function recordNote(
  store: TahfeezLogStore,
  ctx: TahfeezLogContext,
  input: RecordNoteInput,
): DayLogResult<SupervisionNote> {
  const circle = ctx.circles.circleOf(input.circleId)
  if (circle === null) return logErr("UNKNOWN_CIRCLE", input.circleId)
  if (input.bodyAr.trim().length === 0) return logErr("EMPTY_NOTE", input.circleId)

  const note: SupervisionNote = {
    tenantId: store.tenantId,
    id: store.nextId("note"),
    circleId: circle.id,
    bodyAr: input.bodyAr.trim(),
    authorPersonId: ctx.actorPersonId,
    writtenAt: ctx.now,
  }
  store.appendNote(note)
  return logOk(note)
}

/** ملاحظاتُ حلقةٍ — **ابنةُ حلقتها** (IA ك-٥)، مرتّبةً حتمياً بمعرّفها (وهو تسلسلُ كتابتها). */
export function notesOf(store: TahfeezLogStore, circleId: string): readonly SupervisionNote[] {
  return store
    .notes()
    .filter((n) => n.circleId === circleId)
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * **ما يقرؤه المعلّم** (ب-٣٥أ) — القائمةُ نفسُها **إن سمح المفتاح**، وفارغةٌ إن أُطفئ.
 * ولا مقبضَ تحريرٍ في هذا المسار بحال: **قراءةٌ تعيد نسخاً مجمَّدة**.
 */
export function notesForTeacher(
  store: TahfeezLogStore,
  ctx: TahfeezLogContext,
  circleId: string,
): readonly SupervisionNote[] {
  const circle = ctx.circles.circleOf(circleId)
  if (circle === null) return []
  const visible = settingBoolean(ctx, "edu.supervisor_notes.visible_to_teacher", circle.unitPath)
  return visible ? notesOf(store, circleId) : []
}
