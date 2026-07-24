/**
 * **رصدُ أحداث التنقيط** — عقدُ الوحدة §٧-١ (العقدُ الأمّ §٢-٤-٢).
 *
 * أربعةُ ثوابتٍ مفروضةٌ هنا وفي المستودع معاً:
 *  ١. **المفتاحُ الطبيعيُّ فريدٌ والإدخالُ upsert** — فمزامنتان لا تضاعفان النقاط (ق-٤٥)،
 *     ونفسُ المصدر يُنتج نفسَ `sourceRef` ⇒ صفٌّ واحدٌ لا صفّان (**ق-٤٦ مُقفَلةٌ رياضياً**).
 *     **والرصدُ الثاني بالمفتاح نفسِه تصحيحٌ لا تكرار** — وعليه يقوم الاختبارُ الإلزاميّ.
 *  ٢. **العذرُ لا يخصم**: الحدثُ المعذورُ يُسجَّل بقيمته ولا يُنقص الرصيد؛ **وسببُه نصٌّ
 *     إلزاميّ** لأنّ وثيقةَ العميل تقول «الأعذارُ **المقبولة**» — والقبولُ قرارٌ يُبرَّر.
 *  ٣. **النقطةُ تُفسَّر دائماً**: راصدٌ ووقتٌ ونطاقٌ **ونسخةُ وزن** — فسؤالُ «لماذا فاز فلان؟»
 *     له جوابٌ سطرٌ سطر. (في v1 كان `recordedBy` يُسجَّل ولا يُعرض.)
 *  ٤. **الرصدُ الرجعيُّ مقفولٌ** بعد `records.backdate_lock_days` — **الرقمُ نفسُه لا رقمٌ
 *     ثانٍ للمسابقة** (ب-٣٩د)؛ وفتحُه بمسار `records.correct` المدقَّق **خارج هذه الوحدة**.
 */

import type { CompetitionStore } from "../data/store.js"
import type { CompetitionContext } from "./context.js"
import { daysAfter, numberSetting, trimmed } from "./shared.js"
import { isWritable } from "./competitions.js"
import { activeVersionAt } from "./catalog.js"
import {
  competitionErr,
  competitionOk,
  type CompetitionResult,
  type ExcuseState,
  type ScoreEvent,
} from "../types.js"

export type RecordScoreInput = {
  readonly contestantId: string
  readonly typeKey: string
  readonly periodKey: string
  readonly value: number
  readonly excuse?: ExcuseState
  readonly excuseReason?: string
  readonly sourceRef?: string
  /** لحظةُ وقوع النشاط — والافتراضُ «الآن»؛ وهي ما يُقاس عليها القفلُ الرجعيّ ونسخةُ الوزن. */
  readonly occurredAt?: Date
}

/**
 * **رصدٌ واحد** — والدفعةُ الميدانية تُنادي هذه الدالةَ لكل صفٍّ بنفس الضوابط، فلا يتباعد
 * سلوكُ «الرصد المفرد» عن «رصد الشاشة كلِّها» (وهو صنفُ العطب الذي كسر v1 مراراً).
 */
export function recordScore(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: RecordScoreInput,
): CompetitionResult<ScoreEvent> {
  const contestant = store.getContestant(input.contestantId)
  if (contestant === null) return competitionErr("UNKNOWN_CONTESTANT", input.contestantId)

  const competition = store.getCompetition(contestant.competitionId)
  if (competition === null) return competitionErr("UNKNOWN_COMPETITION", contestant.competitionId)
  // **لا رصدَ على مسابقةٍ مغلقةٍ ولو ملك الراصدُ قدرتَه** (منطقُ عملٍ بعد `can()`).
  if (!isWritable(competition.status)) {
    return competitionErr("COMPETITION_CLOSED", competition.status)
  }

  const occurredAt = input.occurredAt ?? ctx.now
  // **القفلُ الرجعيُّ حارسٌ خارجيٌّ يسبق كلَّ شيء**: يُقاس بالتقويم على الإعداد المسجَّل
  // (`records.backdate_lock_days` — **الرقمُ نفسُه لا رقمٌ ثانٍ للمسابقة**، ب-٣٩د)، ويُفحص
  // **قبل** حلِّ نسخة الوزن كي لا يُشخَّص التأخّرُ بسببٍ آخر مضلِّل.
  const lockDays = numberSetting(ctx, "records.backdate_lock_days", contestant.mosquePath)
  if (daysAfter(occurredAt, lockDays).getTime() < ctx.now.getTime()) {
    return competitionErr("BACKDATE_LOCKED", input.periodKey)
  }

  // **نسخةُ الوزن الفعّالةُ لحظةَ الوقوع** — لا وزنُ اليوم (ق-٣٦).
  const version = activeVersionAt(store, competition.id, input.typeKey, occurredAt)
  if (version === null) return competitionErr("UNKNOWN_SCORING_TYPE", input.typeKey)

  if (!Number.isFinite(input.value) || input.value < 0) {
    return competitionErr("INVALID_VALUE", String(input.value))
  }
  // **سقفُ الفترة يُردّ لا يُبتلع صامتاً** (نظيرُ ق-٤٠): القصُّ الصامتُ يخفي خطأَ إدخال.
  if (version.maxPerPeriod !== null && input.value > version.maxPerPeriod) {
    return competitionErr("INVALID_VALUE", `فوق سقف الفترة: ${input.value}`)
  }

  const excuse = input.excuse ?? "none"
  let excuseReason: string | null = null
  if (excuse === "excused") {
    if (!version.excusable) return competitionErr("INVALID_VALUE", "نوعٌ لا يقبل عذراً")
    excuseReason = trimmed(input.excuseReason ?? "")
    if (excuseReason === null) return competitionErr("EXCUSE_REASON_REQUIRED", input.typeKey)
  }

  const event: ScoreEvent = {
    tenantId: store.tenantId,
    id: store.nextId("evt"),
    competitionId: competition.id,
    contestantId: contestant.id,
    typeKey: version.key,
    typeVersionId: version.id,
    periodKey: input.periodKey,
    value: input.value,
    excuse,
    excuseReason,
    recordedBy: ctx.actorPersonId,
    recordedAt: ctx.now,
    occurredAt,
    // **نطاقُ الرصد من المتبارِي المخزَّن** لا من مدخل العميل (يقتل صنف خ).
    scopePathAtRecord: contestant.mosquePath,
    sourceRef: input.sourceRef ?? null,
  }
  return competitionOk(store.upsertScoreEvent(event))
}
