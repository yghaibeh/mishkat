/**
 * **الاشتقاقات** — عقدُ الوحدة §٩: *كلُّ رقمٍ استعلامٌ لحظةَ السؤال، و**صفر عدّادٍ مخزَّن***.
 *
 * ثلاثةُ بلاغاتٍ ميدانية جذرُها واحد — رقمٌ مخزَّنٌ تباعد عن واقعه:
 *  - **ع-١٢/ع-٢٣**: «أُضيف الدرسُ… فأين هو؟! لم يظهر في البرنامج».
 *  - **ع-٢٩**: «أضفتُ لسامح ٣ حلقات فالعدد في صفحته ٠».
 *  - **ع-١٩**: «أضفنا حلقاتٍ فلم يظهر في الإحصاء سوى واحدة».
 * وعلاجُها هنا **بنيويّ**: لا يوجد عدّادٌ يُحدَّث فيُنسى. وكلُّ دالةٍ في هذا الملفّ **قراءةٌ
 * محضة** — ولا تكتب حرفاً.
 *
 * و**كشفُ اليوم يبدأ من سجلّ العضوية لا من المسجَّل**: كلُّ ملتحقٍ حاليٍّ سطرٌ ولو لم يُسجَّل
 * بعد — فالغيابُ **سطرٌ يُملأ** لا فراغٌ يُفسَّر (نظيرُ «الإحصاءُ يبدأ من الكتالوج» في T16).
 */

import type { TahfeezLogStore } from "../data/store.js"
import { settingNumber, settingText, type TahfeezLogContext } from "./context.js"
import { dayKeyIn } from "./day.js"
import { recitationRefAr } from "./mushaf.js"
import {
  logErr,
  logOk,
  type AttendanceMark,
  type DaySession,
  type SessionRow,
  type DayLogResult,
} from "../types.js"

/** سطرُ الكشف — **مُسقَطٌ للعرض**: الاسمُ من سجلّ العضوية، والمرجعُ من كتالوج المصحف. */
export type CircleDayRow = {
  readonly enrollmentId: string
  readonly nameAr: string
  /** `null` = **لم يُسجَّل بعد** — حالةٌ مميَّزةٌ عن «غائب» (ق-١١٢: لا صفرَ يكذب). */
  readonly attendance: AttendanceMark | null
  readonly memorizationAr: string
  readonly memorizationGrade: number | null
  readonly reviewAr: string
  readonly reviewGrade: number | null
  readonly tajweedGrade: number | null
  readonly enrichmentTypeId: string | null
  readonly enrichmentGrade: number | null
}

export type CircleDayView = {
  readonly circleId: string
  readonly dayKey: string
  readonly recorded: boolean
  /** ع-٩: **الحدُّ يصل الشاشةَ من اللقطة** لا رقماً في الواجهة. */
  readonly gradeMax: number
  readonly rows: readonly CircleDayRow[]
}

const NO_REF = ""

function rowView(
  store: TahfeezLogStore,
  student: { readonly id: string; readonly nameAr: string },
  recorded: SessionRow | undefined,
): CircleDayRow {
  if (recorded === undefined) {
    return {
      enrollmentId: student.id,
      nameAr: student.nameAr,
      attendance: null,
      memorizationAr: NO_REF,
      memorizationGrade: null,
      reviewAr: NO_REF,
      reviewGrade: null,
      tajweedGrade: null,
      enrichmentTypeId: null,
      enrichmentGrade: null,
    }
  }
  return {
    enrollmentId: student.id,
    nameAr: student.nameAr,
    attendance: recorded.attendance,
    memorizationAr: recitationRefAr(store, recorded.memorization),
    memorizationGrade: recorded.memorizationGrade,
    reviewAr: recitationRefAr(store, recorded.review),
    reviewGrade: recorded.reviewGrade,
    tajweedGrade: recorded.tajweedGrade,
    enrichmentTypeId: recorded.enrichment?.typeId ?? null,
    enrichmentGrade: recorded.enrichment?.grade ?? null,
  }
}

/** كشفُ يومِ حلقةٍ — **مصدرُ بياناتٍ واحدٌ للصفحة** (ق-١١١). */
export function circleDayView(
  store: TahfeezLogStore,
  ctx: TahfeezLogContext,
  input: { readonly circleId: string; readonly at: Date },
): DayLogResult<CircleDayView> {
  const circle = ctx.circles.circleOf(input.circleId)
  if (circle === null) return logErr("UNKNOWN_CIRCLE", input.circleId)

  const dayKey = dayKeyIn(input.at, settingText(ctx, "time.zone", circle.unitPath))
  const session = store.getSession(circle.id, dayKey)
  const byEnrollment = new Map((session?.rows ?? []).map((r) => [r.enrollmentId, r]))

  return logOk({
    circleId: circle.id,
    dayKey,
    recorded: session !== null,
    gradeMax: settingNumber(ctx, "edu.grade.max", circle.unitPath),
    rows: ctx.circles
      .enrollmentsOf(circle.id)
      .map((student) => rowView(store, student, byEnrollment.get(student.id))),
  })
}

/** سطرُ يومٍ في سجلّ الطالب — ما يخصّه هو وحده (ق-٩٣: لا يكشف إلا طالبَه). */
export type StudentDayLine = {
  readonly dayKey: string
  readonly attendance: AttendanceMark
  readonly memorizationAr: string
  readonly memorizationGrade: number | null
  readonly reviewAr: string
  readonly reviewGrade: number | null
  readonly tajweedGrade: number | null
  readonly enrichmentTypeId: string | null
  readonly enrichmentGrade: number | null
}

/**
 * **سجلُّ الطالب التراكميّ** — كلُّ رقمٍ فيه **محسوبٌ الآن**: لا حقلَ حضورٍ ولا متوسّطَ
 * علاماتٍ مخزَّنٌ في أيّ كيان (§٩). والمتوسّطُ **`null` حين لا علامة** لا صفرٌ كاذب.
 */
export type StudentRecordView = {
  readonly circleId: string
  readonly enrollmentId: string
  readonly nameAr: string
  readonly sessions: number
  readonly present: number
  readonly absent: number
  readonly left: number
  readonly excused: number
  readonly attendancePct: number
  readonly averageGrade: number | null
  readonly gradeMax: number
  readonly days: readonly StudentDayLine[]
}

/** جلساتُ حلقةٍ مرتّبةً باليوم — **ترتيبٌ حتميّ** لا يتغيّر بين تشغيلين. */
function sessionsOf(store: TahfeezLogStore, circleId: string): readonly DaySession[] {
  return store
    .sessions()
    .filter((s) => s.circleId === circleId)
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
}

function lineOf(store: TahfeezLogStore, dayKey: string, row: SessionRow): StudentDayLine {
  return {
    dayKey,
    attendance: row.attendance,
    memorizationAr: recitationRefAr(store, row.memorization),
    memorizationGrade: row.memorizationGrade,
    reviewAr: recitationRefAr(store, row.review),
    reviewGrade: row.reviewGrade,
    tajweedGrade: row.tajweedGrade,
    enrichmentTypeId: row.enrichment?.typeId ?? null,
    enrichmentGrade: row.enrichment?.grade ?? null,
  }
}

export function studentRecordView(
  store: TahfeezLogStore,
  ctx: TahfeezLogContext,
  input: { readonly circleId: string; readonly enrollmentId: string },
): DayLogResult<StudentRecordView> {
  const circle = ctx.circles.circleOf(input.circleId)
  if (circle === null) return logErr("UNKNOWN_CIRCLE", input.circleId)

  const student = ctx.circles
    .enrollmentsOf(circle.id)
    .find((e) => e.id === input.enrollmentId)
  if (student === undefined) return logErr("ENROLLMENT_NOT_IN_CIRCLE", input.enrollmentId)

  const days: StudentDayLine[] = []
  for (const session of sessionsOf(store, circle.id)) {
    const row = session.rows.find((r) => r.enrollmentId === student.id)
    if (row !== undefined) days.push(lineOf(store, session.dayKey, row))
  }

  const counted = (mark: AttendanceMark): number => days.filter((d) => d.attendance === mark).length
  const grades = days
    .flatMap((d) => [d.memorizationGrade, d.reviewGrade, d.tajweedGrade, d.enrichmentGrade])
    .filter((g): g is number => g !== null)
  const present = counted("present")

  return logOk({
    circleId: circle.id,
    enrollmentId: student.id,
    nameAr: student.nameAr,
    sessions: days.length,
    present,
    absent: counted("absent"),
    left: counted("left"),
    excused: counted("excused"),
    attendancePct: days.length === 0 ? 0 : (present * 100) / days.length,
    averageGrade:
      grades.length === 0 ? null : grades.reduce((sum, g) => sum + g, 0) / grades.length,
    gradeMax: settingNumber(ctx, "edu.grade.max", circle.unitPath),
    days,
  })
}
