/**
 * سياقُ خدمات الإشراف — «حقنٌ لا استيرادٌ مبعثر» (`SPEC_settings` §١-٨).
 *
 * وفيه **المنفذان** اللذان يحفظان حدَّ الوحدة:
 *  - **منفذُ الحُكم** (`verdictOf`): «أمعتمَدةٌ هذه الزيارة، ومَن اعتمدها؟» — سؤالٌ عن **حالٍ**
 *    لا عن **سلسلة**. فلا مفردةَ اعتمادٍ في هذه الوحدة (G22)، والمُنفِّذُ الحقيقيّ يعيش
 *    **داخل مجلد المحرّك** (`approval/registered/supervisionVisit.ts`) — وهو ما يجعل ق-١٠٢
 *    (اسمُ المعتمِد) مضموناً بالبناء لا بحقلٍ يُملأ يدوياً.
 *  - **منفذُ المسؤول** (`responsibleOf`): «مَن مسؤولُ هذه الوحدة؟» — فلا تعرف الوحدةُ إسناداً
 *    ولا دوراً (G6)، وتبقى ق-١٠١ («المسؤول فلان») بلا فحصِ دورٍ واحد.
 *
 * و`actorScopePaths` **مساراتٌ لا أدوار**: منها تُشتقّ مرساةُ السلسلة (ق-١٦) بمقارنةِ
 * احتواءٍ صرفة.
 */

import type { SettingsResolver } from "../../../settings/resolver.js"
import type { VisitVerdict } from "../types.js"

/** «أمعتمَدةٌ هذه الزيارة ومَن اعتمدها؟» — جوابٌ عن حالٍ، لا اطّلاعٌ على سلسلة. */
export type VisitVerdictLookup = (visitId: string) => VisitVerdict

/** «مَن المكلَّفُ عند هذا المسار؟» — اسمٌ واحدٌ أو لا أحد (الشغورُ حالةٌ معلنة). */
export type UnitResponsibleLookup = (unitPath: string) => string | null

export type SupervisionContext = {
  readonly now: Date
  /** الفاعلُ من الجلسة لا من المدخل. */
  readonly actorPersonId: string
  readonly settings: SettingsResolver
  readonly verdictOf: VisitVerdictLookup
  readonly responsibleOf: UnitResponsibleLookup
  /** مساراتُ إسناد الفاعل الفعّالة — **مساراتٌ لا أدوار** (G6). */
  readonly actorScopePaths: readonly string[]
}

/** قراءةُ إعدادٍ رقميّ — والنوعُ الخاطئ حالةٌ برمجيةٌ تُلقى لا خطأُ عمل (المادة ٣/٤). */
export function settingNumber(ctx: SupervisionContext, id: string, scopePath: string): number {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "number") throw new TypeError(`الإعداد ${id} ليس رقماً`)
  return value
}

/** قراءةُ إعدادٍ نصّيّ (المنطقة الزمنية) — بالحارس نفسِه. */
export function settingText(ctx: SupervisionContext, id: string, scopePath: string): string {
  const value = ctx.settings(id, scopePath, ctx.now)
  if (typeof value !== "string") throw new TypeError(`الإعداد ${id} ليس نصاً`)
  return value
}
