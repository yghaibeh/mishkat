/**
 * ق-٩٠ — **الجلسةُ اليومية**: الكاتبُ الوحيد للسجل (عقدُ الوحدة §٢/§٣/§٤/§٥).
 *
 * ثلاثةُ ثوابتٍ تعيش في هذا الملفّ وحده:
 *  ١. **المفتاحُ طبيعيٌّ (حلقة × يوم)** ⇒ إعادةُ الإرسال آمنةٌ **بالبنية** لا بالانضباط.
 *  ٢. **الطالبُ من سجلّ العضوية الواحد** (المنفذ) — فما يُدخَل في الحلقة يظهر في السجل،
 *     وهو علاجُ ج٥ البنيويّ («أضفتُ ٢٠ طالباً وسجلُّ اليوم يقول لا طلاب»).
 *  ٣. **كلُّ حدٍّ يُقرأ من سجل الإعدادات** (قب-٦/G14): حدُّ العلامة · قبولُ التأريخ المستقبليّ
 *     · المنطقةُ الزمنية — **صفر رقمٍ تشغيليٍّ في هذا الملفّ**.
 *
 * و**ق-٨٤ ليست هنا**: «مَن يُدخل؟» سؤالُ قدرةٍ ونطاقٍ يُجيبه المحرّكُ على دالة الخادم
 * (§٥ من العقد) — ولا فحصَ دورٍ في الخدمة (G6).
 */

import type { TahfeezLogStore } from "../data/store.js"
import { settingBoolean, settingNumber, settingText, type TahfeezLogContext } from "./context.js"
import { dayKeyIn } from "./day.js"
import { validateRecitation } from "./mushaf.js"
import {
  logErr,
  logOk,
  type AttendanceMark,
  type DaySession,
  type Enrichment,
  type Recitation,
  type SessionRow,
  type DayLogResult,
} from "../types.js"

export type SessionRowInput = {
  readonly enrollmentId: string
  readonly attendance: AttendanceMark
  readonly memorization?: Recitation | null
  readonly memorizationGrade?: number | null
  readonly review?: Recitation | null
  readonly reviewGrade?: number | null
  readonly tajweedGrade?: number | null
  readonly enrichment?: Enrichment | null
}

export type RecordSessionInput = {
  readonly circleId: string
  /** لحظةُ الجلسة — ومنها يُشتقّ مفتاحُ اليوم بالمنطقة المضبوطة (لا نصٌّ من العميل). */
  readonly at: Date
  readonly rows: readonly SessionRowInput[]
}

/** الغيابُ لا علامةَ له: حضورٌ فعليٌّ = حاضرٌ أو مستأذنٌ أو تاركٌ حضر ثم انصرف. */
function attended(mark: AttendanceMark): boolean {
  return mark !== "absent"
}

/**
 * **ع-٩ — العلامةُ من الحدّ إلزاماً**، والحدُّ إعدادٌ حيّ: عددٌ صحيحٌ في `[٠ … الحدّ]`.
 * والقيمةُ الغائبة (`null`) مقبولةٌ — التسجيلُ حضوراً بلا تقييمٍ حالةٌ مشروعة.
 */
function validateGrade(grade: number | null | undefined, max: number): DayLogResult<null> {
  if (grade === null || grade === undefined) return logOk(null)
  if (!Number.isInteger(grade) || grade < 0 || grade > max) {
    return logErr("GRADE_OUT_OF_RANGE", String(grade))
  }
  return logOk(null)
}

/** كلُّ علامات السطر في موضعٍ واحد — فلا يُنسى بابٌ خلفيٌّ لعلامةٍ حرّة. */
function gradesOf(row: SessionRowInput): readonly (number | null | undefined)[] {
  return [row.memorizationGrade, row.reviewGrade, row.tajweedGrade, row.enrichment?.grade]
}

function validateRow(
  store: TahfeezLogStore,
  ctx: TahfeezLogContext,
  row: SessionRowInput,
  gradeMax: number,
): DayLogResult<SessionRow> {
  const grades = gradesOf(row)
  for (const grade of grades) {
    const checked = validateGrade(grade, gradeMax)
    if (!checked.ok) return checked
  }
  // **لا علامةَ لغائب** — فلا يتلوّث متوسّطُ ق-٩١ بتقييمِ من لم يحضر.
  if (!attended(row.attendance) && grades.some((g) => g !== null && g !== undefined)) {
    return logErr("GRADE_WITHOUT_ATTENDANCE", row.enrollmentId)
  }

  for (const recitation of [row.memorization, row.review]) {
    if (recitation === null || recitation === undefined) continue
    const checked = validateRecitation(store, recitation)
    if (!checked.ok) return checked
  }

  // **ق-٨٩/ب-٤١**: نوعُ المادة الإثرائية من **كتالوج T16 نفسِه** — لا معجمَ أنواعٍ ثانٍ.
  if (row.enrichment !== null && row.enrichment !== undefined) {
    if (!ctx.circles.hasType(row.enrichment.typeId)) {
      return logErr("UNKNOWN_ENRICHMENT_TYPE", row.enrichment.typeId)
    }
  }

  return logOk({
    enrollmentId: row.enrollmentId,
    attendance: row.attendance,
    memorization: row.memorization ?? null,
    memorizationGrade: row.memorizationGrade ?? null,
    review: row.review ?? null,
    reviewGrade: row.reviewGrade ?? null,
    tajweedGrade: row.tajweedGrade ?? null,
    enrichment: row.enrichment ?? null,
  })
}

/**
 * **تسجيلُ يومِ حلقةٍ** (ق-٩٠) — أو استبدالُ ما سُجِّل فيه (upsert).
 *
 * ترتيبُ الحرّاس ملزمٌ ويُختبر بترتيبه: الحلقةُ ⟵ الأرشفةُ ⟵ الأسطرُ ⟵ اليومُ ⟵ العضويةُ
 * ⟵ التكرارُ ⟵ العلاماتُ والنطاقات. فيُشخَّص الخرقُ الأولُ بسببه لا بسببِ ما بعده.
 */
export function recordSession(
  store: TahfeezLogStore,
  ctx: TahfeezLogContext,
  input: RecordSessionInput,
): DayLogResult<DaySession> {
  const circle = ctx.circles.circleOf(input.circleId)
  if (circle === null) return logErr("UNKNOWN_CIRCLE", input.circleId)
  if (circle.archived) return logErr("CIRCLE_ARCHIVED", input.circleId)
  if (input.rows.length === 0) return logErr("EMPTY_SESSION", input.circleId)

  const zone = settingText(ctx, "time.zone", circle.unitPath)
  const dayKey = dayKeyIn(input.at, zone)
  if (
    dayKey > dayKeyIn(ctx.now, zone) &&
    !settingBoolean(ctx, "records.allow_future_dating", circle.unitPath)
  ) {
    return logErr("FUTURE_DATING_BLOCKED", dayKey)
  }

  const roster = new Set(ctx.circles.enrollmentsOf(input.circleId).map((e) => e.id))
  const gradeMax = settingNumber(ctx, "edu.grade.max", circle.unitPath)
  const seen = new Set<string>()
  const rows: SessionRow[] = []

  for (const row of input.rows) {
    if (!roster.has(row.enrollmentId)) {
      return logErr("ENROLLMENT_NOT_IN_CIRCLE", row.enrollmentId)
    }
    if (seen.has(row.enrollmentId)) return logErr("DUPLICATE_STUDENT_ROW", row.enrollmentId)
    seen.add(row.enrollmentId)

    const checked = validateRow(store, ctx, row, gradeMax)
    if (!checked.ok) return checked
    rows.push(checked.value)
  }

  const existing = store.getSession(circle.id, dayKey)
  return logOk(
    store.upsertSession({
      tenantId: store.tenantId,
      id: existing?.id ?? store.nextId("session"),
      circleId: circle.id,
      dayKey,
      rows,
      recordedByPersonId: ctx.actorPersonId,
      recordedAt: ctx.now,
    }),
  )
}
