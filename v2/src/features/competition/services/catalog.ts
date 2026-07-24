/**
 * **كتالوجُ أنواع أحداث التنقيط — قلبُ التوسّع** (عقدُ الوحدة §٧-٢).
 *
 * في v1 كانت الأنواعُ **مثبَّتةً في الكود**: «برنامجٌ شهريّ» و«اختبارٌ مركزيّ» لا ثالثَ لهما
 * إلا بمبرمجٍ وهجرة. وهنا **بياناتٌ**: صفٌّ يُضاف فيعمل فوراً بلا سطر كود (قب-٢٢) — وبرهانُه
 * التسلسلُ المُختبَر «مرفوضٌ ⟵ يُضاف صفّاً ⟵ مقبولٌ فوراً».
 *
 * **والأوزانُ نسخٌ مؤرَّخة** (ق-٣٦): تغييرُ وزنٍ **لا يعيد حساب الماضي أبداً** — يُختم النوعُ
 * الحاليّ بـ`activeTo` وتُفتح نسخةٌ بـ`activeFrom`، وكلُّ حدثٍ يحمل نسختَه. وهذا **يمنع
 * أشهرَ نزاعٍ مع المتسابقين** حين تُرفع الأوزان في منتصف السنة.
 */

import type { CompetitionStore } from "../data/store.js"
import type { CompetitionContext } from "./context.js"
import { trimmed } from "./shared.js"
import { writableCompetition } from "./competitions.js"
import {
  competitionErr,
  competitionOk,
  type CompetitionResult,
  type ScoringEventType,
  type ScoringPeriod,
  type ScoringValueKind,
} from "../types.js"

/** نسخُ نوعٍ بمفتاحه، مرتَّبةً حتمياً — التاريخُ سلسلةٌ تُقرأ لا صفٌّ يُكتب فوقه. */
export function versionsOf(
  store: CompetitionStore,
  competitionId: string,
  key: string,
): readonly ScoringEventType[] {
  return store
    .scoringTypes()
    .filter((t) => t.competitionId === competitionId && t.key === key)
    .sort((a, b) => a.activeFrom.getTime() - b.activeFrom.getTime() || a.id.localeCompare(b.id))
}

/**
 * **النسخةُ الفعّالةُ لحظةَ الرصد** — لا «النسخةُ الحالية»: فحدثٌ يُرصد بأثرٍ رجعيٍّ مشروع
 * يُحسب بوزن **زمنه** لا بوزن اليوم. وهذا هو مقصدُ ق-٣٦ حرفياً.
 */
export function activeVersionAt(
  store: CompetitionStore,
  competitionId: string,
  key: string,
  at: Date,
): ScoringEventType | null {
  const applicable = versionsOf(store, competitionId, key).filter(
    (t) =>
      t.activeFrom.getTime() <= at.getTime() &&
      (t.activeTo === null || t.activeTo.getTime() > at.getTime()),
  )
  return applicable[applicable.length - 1] ?? null
}

/** النسخةُ المفتوحةُ اليوم (غيرُ المختومة) — مدخلُ إعادة التوزين. */
export function openVersion(
  store: CompetitionStore,
  competitionId: string,
  key: string,
): ScoringEventType | null {
  return versionsOf(store, competitionId, key).find((t) => t.activeTo === null) ?? null
}

export type DefineScoringTypeInput = {
  readonly competitionId: string
  readonly key: string
  readonly titleAr: string
  readonly track: string
  readonly valueKind: ScoringValueKind
  readonly weight: number
  readonly period: ScoringPeriod
  readonly excusable: boolean
  readonly maxPerPeriod?: number
}

function validWeight(weight: number): boolean {
  return Number.isFinite(weight) && weight >= 0
}

/**
 * **صفٌّ في الكتالوج** — والسؤالُ عنه سؤالٌ واحدٌ عند الرصد: «أهو موجود؟». ولا حقلَ تفعيلٍ
 * يُسأل عنه ثانيةً، فلا يتكرر هنا عَرَضُ «قسمٌ غير مفعّل» الذي عولج في الحلقات (ع-٨).
 */
export function defineScoringType(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: DefineScoringTypeInput,
): CompetitionResult<ScoringEventType> {
  const found = writableCompetition(store, input.competitionId)
  if (!found.ok) return found

  const key = trimmed(input.key)
  const titleAr = trimmed(input.titleAr)
  if (key === null || titleAr === null) return competitionErr("EMPTY_TITLE")
  if (!validWeight(input.weight)) return competitionErr("INVALID_WEIGHT", String(input.weight))
  if (input.maxPerPeriod !== undefined && input.maxPerPeriod < 0) {
    return competitionErr("INVALID_VALUE", String(input.maxPerPeriod))
  }
  // **مفتاحٌ واحدٌ لنوعٍ واحد**: التكرارُ يُنشئ معجمين للشيء نفسِه (المادة ١/٢).
  if (versionsOf(store, found.value.id, key).length > 0) {
    return competitionErr("INVALID_VALUE", `مفتاحٌ مكرَّر: ${key}`)
  }

  const type: ScoringEventType = {
    tenantId: store.tenantId,
    id: store.nextId("stype"),
    competitionId: found.value.id,
    key,
    titleAr,
    track: input.track,
    valueKind: input.valueKind,
    weight: input.weight,
    maxPerPeriod: input.maxPerPeriod ?? null,
    period: input.period,
    excusable: input.excusable,
    activeFrom: ctx.now,
    activeTo: null,
    supersedes: null,
  }
  store.saveScoringType(type)
  return competitionOk(type)
}

/**
 * **إعادةُ التوزين بأثرٍ قادمٍ حصراً** (ق-٣٦): النسخةُ القائمة **تُختم ولا تُعدَّل**، وتُفتح
 * نسخةٌ جديدةٌ تحمل مرجعَ سابقتها. فالأحداثُ المرصودةُ قبلَها تبقى مربوطةً بنسختها
 * ⇒ **إعادةُ الجمع من الأحداث المخزَّنة تعطي الرقمَ نفسَه بعد سنة** (ق-٤١).
 */
export function reweighScoringType(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: { readonly typeVersionId: string; readonly weight: number },
): CompetitionResult<ScoringEventType> {
  const current = store.getScoringType(input.typeVersionId)
  if (current === null) return competitionErr("UNKNOWN_SCORING_TYPE", input.typeVersionId)
  const found = writableCompetition(store, current.competitionId)
  if (!found.ok) return found
  if (current.activeTo !== null) {
    return competitionErr("UNKNOWN_SCORING_TYPE", "نسخةٌ مختومةٌ لا تُوزَّن")
  }
  if (!validWeight(input.weight)) return competitionErr("INVALID_WEIGHT", String(input.weight))

  store.saveScoringType({ ...current, activeTo: ctx.now })
  const next: ScoringEventType = {
    ...current,
    id: store.nextId("stype"),
    weight: input.weight,
    activeFrom: ctx.now,
    activeTo: null,
    supersedes: current.id,
  }
  store.saveScoringType(next)
  return competitionOk(next)
}
