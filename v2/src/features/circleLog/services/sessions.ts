/**
 * ق-٩٠ + CR-016 — **الجلسةُ اليومية: الكاتبُ الوحيد للكيان الواحد** (عقدُ الوحدة §٢).
 *
 * أربعةُ ثوابتٍ تعيش في هذا الملفّ وحده:
 *  ١. **المفتاحُ طبيعيٌّ (حلقة × يوم)** ⇒ إعادةُ الإرسال آمنةٌ **بالبنية** لا بالانضباط.
 *  ٢. **الطالبُ من سجلّ العضوية الواحد** (المنفذ) — فما يُدخَل في الحلقة يظهر في السجل،
 *     وهو علاجُ ج٥ البنيويّ («أضفتُ ٢٠ طالباً وسجلُّ اليوم يقول لا طلاب»).
 *  ٣. **كلُّ حدٍّ يُقرأ من سجل الإعدادات** (قب-٦/G14): حدُّ العلامة · قبولُ التأريخ المستقبليّ
 *     · المنطقةُ الزمنية — **صفر رقمٍ تشغيليٍّ في هذا الملفّ**.
 *  ٤. **CR-016 — كيانٌ واحدٌ وشكلُ حقوله يتبع نوعَ الحلقة**: مدخلان **مميَّزان بالنوع**
 *     (تحفيظٌ · منهاج) يفوّضان **ختماً واحداً** (`seal`) على **مستودعٍ واحد**. فليس هنا
 *     «سجلّان وجسرٌ» ولا «كيانٌ لكل شكل» — بل **صفّان من كيانٍ واحدٍ يختلف شكلُ حقولهما**.
 *     ومَن أرسل شكلاً لا يطابق نوعَ حلقته ⇒ `SESSION_SHAPE_MISMATCH`.
 *
 * و**ق-٨٤ ليست هنا**: «مَن يُدخل؟» سؤالُ قدرةٍ ونطاقٍ يُجيبه المحرّكُ على دالة الخادم
 * (§٥ من العقد) — ولا فحصَ دورٍ في الخدمة (G6).
 */

import type { CircleLogStore } from "../data/store.js"
import { settingBoolean, settingNumber, settingText, type SessionContext } from "./context.js"
import { dayKeyIn } from "./day.js"
import { validateRecitation } from "./mushaf.js"
import type { CircleRef } from "./circleModel.js"
import type { SessionShapeKind } from "./sessionShape.js"
import {
  logErr,
  logOk,
  type AttendanceMark,
  type CurriculumCompanion,
  type DaySession,
  type Enrichment,
  type Recitation,
  type SessionRow,
  type SessionShape,
  type RecitationEvaluation,
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

/** مدخلُ **المنهج المصاحب** — والمجلسُ **مرجعٌ** يتحقّق صاحبُ كتالوجه من دلالته (§١-ب). */
export type CompanionInput = {
  readonly curriculumSessionId: string
  readonly durationMinutes: number
  readonly venueAr?: string
  /** الحاضرون — **والباقي يُسجَّل غائباً**: الغيابُ حقيقةٌ تُقرأ لا فراغٌ يُفسَّر. */
  readonly presentEnrollmentIds: readonly string[]
  readonly photoKeys?: readonly string[]
}

export type RecordCurriculumSessionInput = {
  readonly circleId: string
  readonly at: Date
  readonly companion: CompanionInput
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
  store: CircleLogStore,
  ctx: SessionContext,
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

  const evaluation: RecitationEvaluation = {
    memorization: row.memorization ?? null,
    memorizationGrade: row.memorizationGrade ?? null,
    review: row.review ?? null,
    reviewGrade: row.reviewGrade ?? null,
    tajweedGrade: row.tajweedGrade ?? null,
    enrichment: row.enrichment ?? null,
  }
  return logOk({ enrollmentId: row.enrollmentId, attendance: row.attendance, evaluation })
}

/**
 * **الحرّاسُ المشترَكون بين الشكلين** — الحلقةُ ثم الأرشفةُ ثم **مطابقةُ الشكل للنوع** ثم
 * اليومُ ثم القفل. وهي مشترَكةٌ لأنها **صفاتُ الجلسة لا صفاتُ شكلها**: كيانٌ واحدٌ ⇒ حرّاسُ
 * هويّةٍ واحدون.
 */
type Opened = {
  readonly circle: CircleRef
  readonly dayKey: string
  readonly existingId: string | null
}

/**
 * **هويّةُ الجلسة**: أهي على حلقةٍ قائمة؟ وأشكلُها شكلُ نوعها؟ — حارسان يسبقان كلَّ محتوى،
 * لأنّ الجوابَ عنهما **لا يتغيّر بالشكل**.
 */
function identify(
  ctx: SessionContext,
  circleId: string,
  kind: SessionShapeKind,
): DayLogResult<CircleRef> {
  const circle = ctx.circles.circleOf(circleId)
  if (circle === null) return logErr("UNKNOWN_CIRCLE", circleId)
  if (circle.archived) return logErr("CIRCLE_ARCHIVED", circleId)
  // **CR-016 — الحقولُ تتبع النوع**: شكلٌ لا يطابق نوعَ الحلقة يُردّ **قبل أيّ محتوى**.
  if (ctx.shape.shapeOf(circle.typeId) !== kind) {
    return logErr("SESSION_SHAPE_MISMATCH", `${circle.typeId}:${kind}`)
  }
  return logOk(circle)
}

/** **موضعُ الجلسة في الزمن**: يومُها بالمنطقة المضبوطة، ونافذةُ التأريخ، وقفلُ ما سبق. */
function locate(
  store: CircleLogStore,
  ctx: SessionContext,
  circle: CircleRef,
  at: Date,
): DayLogResult<Opened> {
  const zone = settingText(ctx, "time.zone", circle.unitPath)
  const dayKey = dayKeyIn(at, zone)
  if (
    dayKey > dayKeyIn(ctx.now, zone) &&
    !settingBoolean(ctx, "records.allow_future_dating", circle.unitPath)
  ) {
    return logErr("FUTURE_DATING_BLOCKED", dayKey)
  }

  const existing = store.getSession(circle.id, dayKey)
  // **ق-٨ — المقفلةُ لا يُكتب عليها**: حالٌ يُسأل عنه منفذاً، لا حقلٌ يُقرأ من الكيان (G22).
  if (existing !== null && ctx.isSessionLocked(existing.id)) {
    return logErr("SESSION_LOCKED", existing.id)
  }
  return logOk({ circle, dayKey, existingId: existing?.id ?? null })
}

/** **الختمُ الواحد**: كلُّ شكلٍ يصل إلى المستودع من هنا — فالكاتبُ واحدٌ بالقياس لا بالنيّة. */
function seal(
  store: CircleLogStore,
  ctx: SessionContext,
  opened: Opened,
  at: Date,
  shape: SessionShape,
  rows: readonly SessionRow[],
): DaySession {
  return store.upsertSession({
    tenantId: store.tenantId,
    id: opened.existingId ?? store.nextId("session"),
    circleId: opened.circle.id,
    dayKey: opened.dayKey,
    heldAt: at,
    shape,
    rows,
    recordedByPersonId: ctx.actorPersonId,
    recordedAt: ctx.now,
  })
}

/**
 * **تسجيلُ يومِ حلقةٍ بشكل التحفيظ** (ق-٩٠) — أو استبدالُ ما سُجِّل فيه (upsert).
 *
 * ترتيبُ الحرّاس ملزمٌ ويُختبر بترتيبه: الحلقةُ ⟵ الأرشفةُ ⟵ الشكلُ ⟵ الأسطرُ ⟵ اليومُ ⟵
 * العضويةُ ⟵ التكرارُ ⟵ العلاماتُ والنطاقات. فيُشخَّص الخرقُ الأولُ بسببه لا بسببِ ما بعده.
 */
export function recordSession(
  store: CircleLogStore,
  ctx: SessionContext,
  input: RecordSessionInput,
): DayLogResult<DaySession> {
  const identified = identify(ctx, input.circleId, "recitation")
  if (!identified.ok) return identified
  if (input.rows.length === 0) return logErr("EMPTY_SESSION", input.circleId)

  const opened = locate(store, ctx, identified.value, input.at)
  if (!opened.ok) return opened

  const roster = new Set(ctx.circles.enrollmentsOf(input.circleId).map((e) => e.id))
  const gradeMax = settingNumber(ctx, "edu.grade.max", identified.value.unitPath)
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

  return logOk(seal(store, ctx, opened.value, input.at, { kind: "recitation" }, rows))
}

/** الحرّاسُ **البنيويّون** للمنهج المصاحب — دلالتُه (أيُّ مجلسٍ؟) شأنُ صاحب كتالوجه. */
function validateCompanion(input: CompanionInput): DayLogResult<CurriculumCompanion> {
  if (input.curriculumSessionId.trim().length === 0) return logErr("EMPTY_COMPANION_REF")
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0) {
    return logErr("INVALID_DURATION", String(input.durationMinutes))
  }
  const photoKeys = (input.photoKeys ?? []).map((k) => k.trim())
  if (photoKeys.some((k) => k.length === 0)) return logErr("EMPTY_PHOTO_KEY")
  if (new Set(photoKeys).size !== photoKeys.length) return logErr("DUPLICATE_PHOTO_KEY")

  const venue = input.venueAr?.trim() ?? ""
  return logOk({
    curriculumSessionId: input.curriculumSessionId.trim(),
    durationMinutes: input.durationMinutes,
    venueAr: venue.length === 0 ? null : venue,
    photoKeys,
  })
}

/**
 * **تسجيلُ يومِ حلقةٍ بشكل المنهاج** (ق-٩٠ على حلقةٍ نوعُها ذو منهاج) — **الكيانُ نفسُه
 * والمستودعُ نفسُه والمفتاحُ نفسُه**، ولا يختلف إلا شكلُ الحقول (CR-016).
 *
 * و**كشفُ الحضور يبدأ من سجلّ العضوية**: كلُّ ملتحقٍ سطرٌ، والحاضرون من المدخل والباقي غائب
 * — فلا يُفسَّر الفراغُ ولا يُبنى سجلُّ طلابٍ ثانٍ.
 */
export function recordCurriculumSession(
  store: CircleLogStore,
  ctx: SessionContext,
  input: RecordCurriculumSessionInput,
): DayLogResult<DaySession> {
  const identified = identify(ctx, input.circleId, "curriculum")
  if (!identified.ok) return identified

  const opened = locate(store, ctx, identified.value, input.at)
  if (!opened.ok) return opened

  const companion = validateCompanion(input.companion)
  if (!companion.ok) return companion

  const roster = ctx.circles.enrollmentsOf(opened.value.circle.id)
  if (roster.length === 0) return logErr("EMPTY_SESSION", input.circleId)

  const present = input.companion.presentEnrollmentIds
  if (new Set(present).size !== present.length) {
    return logErr("DUPLICATE_STUDENT_ROW", input.circleId)
  }
  const rosterIds = new Set(roster.map((m) => m.id))
  const stranger = present.find((id) => !rosterIds.has(id))
  if (stranger !== undefined) return logErr("ENROLLMENT_NOT_IN_CIRCLE", stranger)

  const presentSet = new Set(present)
  const rows = roster.map<SessionRow>((member) => ({
    enrollmentId: member.id,
    attendance: presentSet.has(member.id) ? "present" : "absent",
    // **غيابُ الحقل لا فراغُه**: شكلُ المنهاج بلا تقييمِ حفظٍ أصلاً (CR-016).
    evaluation: null,
  }))

  return logOk(
    seal(
      store,
      ctx,
      opened.value,
      input.at,
      { kind: "curriculum", companion: companion.value },
      rows,
    ),
  )
}
