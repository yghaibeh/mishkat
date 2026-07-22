/**
 * ق-٩١ — **التقييمُ الدوريّ للحلقات** (عقدُ الوحدة §٧): حضورٌ ثم علاماتٌ بنسبتين،
 * **والحلقةُ الخاملةُ صفر**، **وترتيبٌ كلُّه أصفارٌ لا يُعرض** («على ذلك يُكرَم» — لا تشهير).
 *
 * **صفر رقمٍ في هذا الملفّ** (قب-٦/G14): الوزنان والنافذةُ ومفتاحُ الإخفاء وحدُّ العلامة —
 * خمسةُ إعداداتٍ حيّة، فتغييرُ سياسة التقييم **ضبطٌ إداريّ لا نشرُ كود**.
 *
 * و**كلُّ رقمٍ هنا اشتقاقٌ لحظةَ السؤال**: لا حقلَ درجةٍ ولا رتبةٍ مخزَّنٌ في أيّ كيان (§٩).
 */

import type { TahfeezLogStore } from "../data/store.js"
import { settingBoolean, settingNumber, settingText, type TahfeezLogContext } from "./context.js"
import { dayKeyIn, shiftDayKey } from "./day.js"
import type { CircleRef } from "./circleModel.js"
import type { SessionRow } from "../types.js"

export type RankRow = {
  readonly circleId: string
  readonly typeId: string
  readonly attendancePct: number
  readonly gradePct: number
  readonly score: number
  /** **الخاملةُ صفر** (ق-٩١) — والسببُ منطوقٌ لا مستنتَجٌ من صفرٍ صامت (ق-١١٢). */
  readonly inactive: boolean
}

export type RankingView = {
  readonly scopePath: string
  readonly windowDays: number
  /** ترتيبٌ كلُّه أصفارٌ **لا يُعرض** — والقرارُ إعدادٌ لا عادة. */
  readonly hidden: boolean
  readonly rows: readonly RankRow[]
}

const FULL_PCT = 100

/** نسبةٌ آمنةٌ من صفر — الخاملةُ صفرٌ **بلا قسمةٍ على صفر** لا `NaN` يتسرّب إلى الشاشة. */
function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : (part * FULL_PCT) / whole
}

function measure(rows: readonly SessionRow[], gradeMax: number): {
  readonly attendancePct: number
  readonly gradePct: number
} {
  const present = rows.filter((r) => r.attendance === "present").length
  const grades = rows
    .flatMap((r) => [r.memorizationGrade, r.reviewGrade, r.tajweedGrade, r.enrichment?.grade ?? null])
    .filter((g): g is number => g !== null)
  const gradeSum = grades.reduce((sum, g) => sum + g, 0)
  return {
    attendancePct: pct(present, rows.length),
    // **مطبَّعٌ على الحدّ الأعلى**: النسبةُ لا تفترض «من ١٠» بل تسأل الإعدادَ عن مقامها.
    gradePct: pct(gradeSum, grades.length * gradeMax),
  }
}

/**
 * **التقييمُ الدوريّ لنطاقٍ** — يبدأ من **حلقات النطاق كلِّها** (لا من التي سجّلت وحدها)،
 * فالحلقةُ الخاملةُ تظهر بصفرها ولا تختفي (نظيرُ «الإحصاءُ يبدأ من الكتالوج» — ع-١٩).
 */
export function circleRanking(
  store: TahfeezLogStore,
  ctx: TahfeezLogContext,
  input: { readonly unitPath: string },
): RankingView {
  const scopePath = input.unitPath
  const windowDays = settingNumber(ctx, "edu.circle_ranking.window_days", scopePath)
  const attendanceWeight = settingNumber(ctx, "edu.circle_ranking.attendance_weight", scopePath)
  const gradeWeight = settingNumber(ctx, "edu.circle_ranking.grade_weight", scopePath)
  const gradeMax = settingNumber(ctx, "edu.grade.max", scopePath)
  const zone = settingText(ctx, "time.zone", scopePath)

  const fromDayKey = shiftDayKey(dayKeyIn(ctx.now, zone), -windowDays)
  const sessions = store.sessions().filter((s) => s.dayKey >= fromDayKey)

  const rows = ctx.circles.circlesInScope(scopePath).map((circle: CircleRef): RankRow => {
    const rows = sessions.filter((s) => s.circleId === circle.id).flatMap((s) => s.rows)
    if (rows.length === 0) {
      return {
        circleId: circle.id,
        typeId: circle.typeId,
        attendancePct: 0,
        gradePct: 0,
        score: 0,
        inactive: true,
      }
    }
    const { attendancePct, gradePct } = measure(rows, gradeMax)
    return {
      circleId: circle.id,
      typeId: circle.typeId,
      attendancePct,
      gradePct,
      score: (attendancePct * attendanceWeight + gradePct * gradeWeight) / FULL_PCT,
      inactive: false,
    }
  })

  // ترتيبٌ **حتميّ**: بالدرجة نازلاً ثم بالمعرّف — فلا يختلف بين تشغيلين.
  const ordered = [...rows].sort((a, b) => b.score - a.score || a.circleId.localeCompare(b.circleId))
  const allZero = ordered.length > 0 && ordered.every((r) => r.score === 0)
  const hidden = allZero && settingBoolean(ctx, "edu.circle_ranking.hide_all_zero", scopePath)

  return { scopePath, windowDays, hidden, rows: hidden ? [] : ordered }
}
