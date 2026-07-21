/**
 * أهليةُ النقاط — ق-٤٠ (سقفٌ يوميّ وعتبةُ مشاركة) · ب-٣٢ (fail-closed) · ب-٤٢ (النشاطُ الحرّ)
 * · ق-٤٦ (لا ازدواجَ عبر جهتين).
 *
 * **الخادمُ قاطع**: لا يستقبل مدخلُ الإدخال «نقاطاً» أصلاً — يستقبل عدداً وحضوراً وطلاباً،
 * والنقاطُ تُحسب هنا وحدها. فالالتفافُ على الواجهة لا يشتري نقطةً واحدة (ق-٤٠ نصاً).
 *
 * و**«نقطةٌ بلا تحقّقٍ نقطةٌ زائفة»** (ب-٣٢، قرارُ مالكٍ مصادَق): حين لا يُضبط عددُ طلاب
 * الأسرة، النشاطُ المشروط **لا نقاطَ له** — والسجلُّ يبقى توثيقاً بسببٍ معلن، لا يُمحى ولا
 * يُحتسب. والبديلُ (احتسابٌ بلا تحقّق) هو عينُ «نقاطٍ بلا حدود» التي شكاها الميدان.
 *
 * **صفر رقمٍ تشغيليٍّ هنا** (G14): العتبةُ والسقفُ والمفتاحُ كلُّها من سجل الإعدادات.
 */

import { settingBoolean, settingNumber, type DailyLogContext } from "./context.js"
import type { ActivityDefinition, FamilyRoster, PointsBlock } from "../types.js"

/** حصيلةُ الأهلية — العددُ المحتسَب والنقاطُ **وسببُ المنع معلَناً** (ق-١١٢). */
export type Award = {
  readonly creditedCount: number
  readonly points: number
  readonly block: PointsBlock
}

export type AwardInput = {
  readonly definition: ActivityDefinition
  readonly unitPath: string
  /** العددُ بعد إسقاط المكرَّر عبر الجهات (ق-٤٦). */
  readonly requestedCount: number
  /** هل أُسقط أحدٌ لكونه محتسَباً في جهةٍ أخرى اليوم؟ */
  readonly deduplicated: boolean
  readonly attendees: number | null
  readonly roster: FamilyRoster | null
}

/** ب-٤٢ — النشاطُ الحرّ: **توثيقٌ بلا نقاطٍ آلية**، يقرّره معتمِدُ السجل أو تضيفه الإدارة. */
export function freeActivityAward(count: number): Award {
  return { creditedCount: count, points: 0, block: "freeActivity" }
}

/**
 * ق-٤٠ — ترتيبُ الحرّاس ملزمٌ ويُختبر بترتيبه:
 *  ١. **التحقّق أولاً** (ب-٣٢): بلا عددِ أسرةٍ لا نقاطَ لنشاطٍ مشروط.
 *  ٢. ثم **عتبةُ المشاركة**: نسبةُ الحاضرين من الأسرة دون العتبة ⇒ لا نقاط.
 *  ٣. ثم **الازدواج** (ق-٤٦): ما احتُسب في جهةٍ أخرى اليوم لا يُحتسب ثانيةً.
 *  ٤. ثم **السقفُ اليوميّ**: ما زاد عليه يُقصّ ويُعلَن سببُه.
 */
export function awardFor(ctx: DailyLogContext, input: AwardInput): Award {
  const { definition, unitPath } = input

  if (definition.requiresParticipation) {
    const total = input.roster?.studentCount ?? null
    if (total === null) {
      // ب-٣٢: **fail-closed** — والمفتاحُ يضبط سياسةً معلنة، ولا يُلغي قاعدةً (§١-٨أ).
      if (settingBoolean(ctx, "points.participation_fail_closed", unitPath)) {
        return { creditedCount: 0, points: 0, block: "familyRosterUnset" }
      }
    } else {
      const minPct = settingNumber(ctx, "points.participation_min_pct", unitPath)
      const present = input.attendees ?? 0
      const pct = total === 0 ? 0 : (present * 100) / total
      if (pct < minPct) {
        return { creditedCount: 0, points: 0, block: "belowParticipation" }
      }
    }
  }

  if (input.requestedCount <= 0) {
    // كلُّ ما أُدخل محتسَبٌ في جهةٍ أخرى اليوم — يُوثَّق بصفرٍ وسببٍ معلن (ق-٤٦).
    return { creditedCount: 0, points: 0, block: input.deduplicated ? "alreadyCredited" : "none" }
  }

  const cap = definition.maxPerDay
  const credited = cap === null ? input.requestedCount : Math.min(input.requestedCount, cap)
  const clipped = credited < input.requestedCount
  const block: PointsBlock = clipped ? "dailyCap" : input.deduplicated ? "alreadyCredited" : "none"
  return { creditedCount: credited, points: credited * definition.weight, block }
}
