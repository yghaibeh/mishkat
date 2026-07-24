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

import type { CircleLogStore } from "../data/store.js"
import { settingNumber, settingText, type SessionContext } from "./context.js"
import { dayKeyIn } from "./day.js"
import { recitationRefAr } from "./mushaf.js"
import { foldMarks, resolvePeriodId } from "./periods.js"
import type { SessionShapeKind } from "./sessionShape.js"
import {
  logErr,
  logOk,
  type AttendanceMark,
  type CurriculumCompanion,
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
  /** **CR-٠٢٠** — كشفُ **فترةٍ** بعينها: الشاشةُ تعرف أيَّ جلسةٍ تعرض، ولا تخلط فترتين. */
  readonly periodId: string
  readonly recorded: boolean
  /** **شكلُ يومِ هذه الحلقة** — من نوعها لا من المسجَّل: فالشاشةُ تعرف أعمدتَها قبل التسجيل. */
  readonly shape: SessionShapeKind
  /** المنهجُ المصاحب حين يكون الشكلُ شكلَه — **الموطنُ واحدٌ يعرض الشكلين** (CR-016). */
  readonly companion: CurriculumCompanion | null
  /** ع-٩: **الحدُّ يصل الشاشةَ من اللقطة** لا رقماً في الواجهة. */
  readonly gradeMax: number
  readonly rows: readonly CircleDayRow[]
}

const NO_REF = ""

function rowView(
  store: CircleLogStore,
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
  // **الحقولُ تتبع الشكل** (CR-016): جلسةُ منهاجٍ بلا `evaluation` ⇒ أعمدةُ التقييم فارغةٌ
  // في العرض **لأنها غيرُ موجودةٍ في الكيان**، لا لأنّ أحداً نسي ملأها.
  const evaluation = recorded.evaluation
  return {
    enrollmentId: student.id,
    nameAr: student.nameAr,
    attendance: recorded.attendance,
    memorizationAr: recitationRefAr(store, evaluation?.memorization ?? null),
    memorizationGrade: evaluation?.memorizationGrade ?? null,
    reviewAr: recitationRefAr(store, evaluation?.review ?? null),
    reviewGrade: evaluation?.reviewGrade ?? null,
    tajweedGrade: evaluation?.tajweedGrade ?? null,
    enrichmentTypeId: evaluation?.enrichment?.typeId ?? null,
    enrichmentGrade: evaluation?.enrichment?.grade ?? null,
  }
}

/** كشفُ يومِ حلقةٍ — **مصدرُ بياناتٍ واحدٌ للصفحة** (ق-١١١). */
export function circleDayView(
  store: CircleLogStore,
  ctx: SessionContext,
  input: { readonly circleId: string; readonly at: Date; readonly periodId?: string },
): DayLogResult<CircleDayView> {
  const circle = ctx.circles.circleOf(input.circleId)
  if (circle === null) return logErr("UNKNOWN_CIRCLE", input.circleId)

  const dayKey = dayKeyIn(input.at, settingText(ctx, "time.zone", circle.unitPath))
  // **CR-٠٢٠** — القراءةُ تُحسم فترتَها بالقاعدة نفسِها التي تحسمها الكتابة: شبكةٌ قسّمت يومَها
  // ⇒ سؤالٌ بلا فترةٍ **يُردّ** ولا يُجاب بأولى الفترات نيابةً عن السائل.
  const period = resolvePeriodId(store, input.periodId)
  if (!period.ok) return period
  const session = store.getSession(circle.id, dayKey, period.value)
  const byEnrollment = new Map((session?.rows ?? []).map((r) => [r.enrollmentId, r]))

  return logOk({
    circleId: circle.id,
    dayKey,
    periodId: period.value,
    recorded: session !== null,
    shape: ctx.shape.shapeOf(circle.typeId),
    companion: session?.shape.kind === "curriculum" ? session.shape.companion : null,
    gradeMax: settingNumber(ctx, "edu.grade.max", circle.unitPath),
    rows: ctx.circles
      .enrollmentsOf(circle.id)
      .map((student) => rowView(store, student, byEnrollment.get(student.id))),
  })
}

/** سطرُ يومٍ في سجلّ الطالب — ما يخصّه هو وحده (ق-٩٣: لا يكشف إلا طالبَه). */
export type StudentDayLine = {
  readonly dayKey: string
  /** **CR-٠٢٠** — سطرٌ **لكلِّ فترةٍ سُجِّلت**: التفصيلُ بالفترة، **والعدُّ باليوم** (أدناه). */
  readonly periodId: string
  readonly attendance: AttendanceMark
  /** شكلُ ذلك اليوم — **الكيانُ واحدٌ والشكلُ صفة** (CR-016). */
  readonly shape: SessionShapeKind
  readonly curriculumSessionId: string | null
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
  /**
   * **عددُ الأيام لا عددُ الفترات** (CR-020): يومٌ بفترتين **يُعدّ يوماً واحداً**، وعلامتُه
   * أقوى علامتَيه. ولولا ذلك لقال سجلُّ ثلاثة أيامٍ «ستُّ جلسات» — **ع-٢٩ في ثوبٍ جديد**.
   */
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

/**
 * جلساتُ حلقةٍ مرتّبةً باليوم **ثم بالفترة** — **ترتيبٌ حتميّ** لا يتغيّر بين تشغيلين.
 * (وبعد CR-020 صار اليومُ وحدَه **قيمةَ فرزٍ يتقاسمها كيانان** — فالضلعُ الثاني يحسم.)
 */
function sessionsOf(store: CircleLogStore, circleId: string): readonly DaySession[] {
  return store
    .sessions()
    .filter((s) => s.circleId === circleId)
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.periodId.localeCompare(b.periodId))
}

function lineOf(store: CircleLogStore, session: DaySession, row: SessionRow): StudentDayLine {
  const evaluation = row.evaluation
  return {
    dayKey: session.dayKey,
    periodId: session.periodId,
    attendance: row.attendance,
    // **شكلُ اليوم منطوقٌ في سجل الطالب** (ق-١١٢): يومُ منهاجٍ بلا علاماتٍ **يُقرأ بسببه**.
    shape: session.shape.kind,
    curriculumSessionId:
      session.shape.kind === "curriculum" ? session.shape.companion.curriculumSessionId : null,
    memorizationAr: recitationRefAr(store, evaluation?.memorization ?? null),
    memorizationGrade: evaluation?.memorizationGrade ?? null,
    reviewAr: recitationRefAr(store, evaluation?.review ?? null),
    reviewGrade: evaluation?.reviewGrade ?? null,
    tajweedGrade: evaluation?.tajweedGrade ?? null,
    enrichmentTypeId: evaluation?.enrichment?.typeId ?? null,
    enrichmentGrade: evaluation?.enrichment?.grade ?? null,
  }
}

export function studentRecordView(
  store: CircleLogStore,
  ctx: SessionContext,
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
    if (row !== undefined) days.push(lineOf(store, session, row))
  }

  // **CR-٠٢٠ — الحضورُ يُجمع عبر فترات اليوم ولا يُضاعَف**: طالبٌ حضر صباحاً وغاب مساءً
  // **حضر ذلك اليوم**، ويومُه واحدٌ في البسط والمقام معاً.
  const byDay = foldMarks(days, (d) => d.dayKey, (d) => d.attendance)
  const dayMarks = [...byDay.values()]
  const counted = (mark: AttendanceMark): number => dayMarks.filter((m) => m === mark).length
  const grades = days
    .flatMap((d) => [d.memorizationGrade, d.reviewGrade, d.tajweedGrade, d.enrichmentGrade])
    .filter((g): g is number => g !== null)
  const present = counted("present")

  return logOk({
    circleId: circle.id,
    enrollmentId: student.id,
    nameAr: student.nameAr,
    sessions: dayMarks.length,
    present,
    absent: counted("absent"),
    left: counted("left"),
    excused: counted("excused"),
    attendancePct: dayMarks.length === 0 ? 0 : (present * 100) / dayMarks.length,
    averageGrade:
      grades.length === 0 ? null : grades.reduce((sum, g) => sum + g, 0) / grades.length,
    gradeMax: settingNumber(ctx, "edu.grade.max", circle.unitPath),
    days,
  })
}
