/**
 * أدواتٌ داخلية صغيرة — **موضعٌ واحدٌ لكل قاعدةٍ تتكرر** (المادة ١/٢: تعريفان لشيءٍ واحد
 * يتباعدان حتماً). ولا رقمَ تشغيليٍّ هنا: كلُّ عتبةٍ تُقرأ من سجل الإعدادات المحقون (قب-٦).
 */

import { contains } from "../../../authorization/scope.js"
import type { CompetitionContext } from "./context.js"

/**
 * **السنُّ عند الالتحاق** — يُحتسب بالتقويم لا بقسمةِ مللي ثانية: القسمةُ تحتاج ثوابتَ
 * زمنيةً صلبة، والتقويمُ يُجيب بلا رقمٍ واحد (وهو أدقُّ في الكبائس كذلك).
 */
export function ageAt(birthDate: Date, at: Date): number {
  let age = at.getUTCFullYear() - birthDate.getUTCFullYear()
  const monthGap = at.getUTCMonth() - birthDate.getUTCMonth()
  if (monthGap < 0 || (monthGap === 0 && at.getUTCDate() < birthDate.getUTCDate())) age -= 1
  return age
}

/** لحظةٌ بعد عددٍ من الأيام — **بالتقويم لا بحسابٍ بثوابتَ صلبة** (G14). */
export function daysAfter(from: Date, days: number): Date {
  const moved = new Date(from.getTime())
  moved.setUTCDate(moved.getUTCDate() + days)
  return moved
}

/** إعدادٌ عدديٌّ من السجل — **يُقرأ ولا يُخترع**، والنطاقُ معاملٌ إلزاميٌّ كما في `can()`. */
export function numberSetting(ctx: CompetitionContext, id: string, scopePath: string): number {
  return Number(ctx.settings(id, scopePath, ctx.now))
}

export function booleanSetting(ctx: CompetitionContext, id: string, scopePath: string): boolean {
  return ctx.settings(id, scopePath, ctx.now) === true
}

/** نصٌّ غيرُ فارغ — والفراغُ **يُردّ بسببٍ مميِّز** لا يُقبل صامتاً. */
export function trimmed(value: string): string | null {
  const clean = value.trim()
  return clean.length === 0 ? null : clean
}

/**
 * **الاسمُ المعياريّ** لمطابقة «مَن هو نفسُ الشخص بلا حساب؟» (ق-٣٢): تُطوى المسافاتُ
 * المتكرّرة وتُزال أطرافُها — فلا يصير «محمّد  علي» شخصاً ثانياً غيرَ «محمّد علي».
 */
export function personRefOf(nameAr: string, phone: string): string {
  return `${nameAr.trim().replace(/\s+/g, " ")}|${phone.trim()}`
}

/**
 * **قاعدةُ التقاطع** (العقدُ الأمّ §٣-٤): تُعرض مسابقةُ النطاق `P` للفاعل ذي النطاق `S`
 * ⟺ `contains(P,S) ∨ contains(S,P)` — **تشملني أو تحتي، وإلا فلا**.
 *
 * وليست منطقاً خاصاً: تستعمل **بدائيةَ `contains()` نفسَها**، وهي **ترشيحُ قائمةٍ لا قرارُ
 * إذن** — والمحرّكُ يُسأل أولاً دائماً. والفصلُ التامّ بين القسمين يسري بها تلقائياً (ق-٢٠).
 */
export function scopesIntersect(competitionPath: string, actorPath: string): boolean {
  return contains(competitionPath, actorPath) || contains(actorPath, competitionPath)
}
