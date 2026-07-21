/**
 * أنواعُ الزيارات الإشرافية — عقدُ الوحدة `features/supervision/SPEC.md`.
 *
 * أربعةُ ثوابتٍ تُفرَض **بالنوع** قبل أيّ سطرِ منطق:
 *  ١. **المرساةُ غيرُ الهدف** (ق-١٦): `supervisorPath` (وحدةُ الزائر — منها تصعد السلسلة)
 *     حقلٌ مستقلٌّ عن `targetPath` (وحدةُ المَزور)؛ خلطُهما هو ما جعل زيارةَ المربع في v1
 *     تُعرض على المدير بدل المنطقة.
 *  ٢. **النوعُ يطبع النموذج** (ق-١٠٠): `curriculum` على الزيارة نفسِها، و`details` بنيةٌ
 *     تُطابَق بحقوله — فلا نموذجَ نصفَ مملوءٍ يُخزَّن.
 *  ٣. **الحُكمُ ليس حقلاً مخزَّناً** (G22): لا حالةَ اعتمادٍ في هذا الملفّ؛ `VisitVerdict`
 *     **جوابُ منفذٍ يُسأل** لحظةَ العرض — والوحدةُ لا تكتبه ولا تملكه.
 *  ٤. **حالةُ الدورة مشتقّةٌ لا مخزَّنة** (ق-٩٩): `VisitStatus` تُحسب من آخر زيارةٍ ومن
 *     الإعداد الحيّ عند كل قراءة — فتغييرُ الإعداد يغيّر الحالةَ بلا هجرةِ بيانات.
 */

/** منهاجُ الحلقة المزورة (ب-٢٨: النوعُ سِمةٌ لا كيانٌ ثانٍ) — وهو ما يطبع النموذج. */
export type VisitCurriculum = "tahfeez" | "baseera"

/** هدفُ الزيارة — **إسقاطٌ قرائيّ**: مسارٌ ونوعُ منهاجٍ وحالةُ تفعيل، لا موطنُ الحلقة. */
export type VisitTarget = {
  readonly tenantId: string
  readonly id: string
  readonly path: string
  readonly curriculum: VisitCurriculum
  /** الإيقافُ حالةٌ في البيانات لا حذف (المادة ٧/٤). */
  readonly active: boolean
}

/** وحدةٌ تنظيمية كما يعرفها هذا المستودع — معرّفُها ومسارُها (ت-٢). */
export type SupervisionUnit = {
  readonly tenantId: string
  readonly id: string
  readonly path: string
}

/** نواةُ الزيارة المشتركة بين النوعين (ق-١٠٠). */
export type VisitCore = {
  readonly attendees: number
  /** تقييمٌ مئويّ — مدىً معلنٌ لا مقياسٌ مخترع. */
  readonly ratingPct: number
  readonly noteAr: string
}

/** تفاصيلُ النوع — مفاتيحُها **حقولُ نوعه حصراً** (`services/forms.ts`). */
export type VisitDetails = Readonly<Record<string, number>>

export type SupervisionVisit = {
  readonly tenantId: string
  readonly id: string
  readonly targetId: string
  readonly targetPath: string
  readonly curriculum: VisitCurriculum
  /** ق-١٦: وحدةُ الزائر — **مرساةُ السلسلة**، تُشتقّ ولا تُدخَل. */
  readonly supervisorPath: string
  readonly dayKey: string
  readonly visitedAt: Date
  readonly core: VisitCore
  readonly details: VisitDetails
  readonly byPersonId: string
}

/** حالةُ الهدف من دورته (ق-٩٩) — مشتقّةٌ عند القراءة لا مخزَّنة. */
export type VisitStatus = "notVisited" | "late" | "recent"

export type TargetStatus = {
  readonly targetId: string
  readonly path: string
  readonly curriculum: VisitCurriculum
  readonly lastVisitDayKey: string | null
  readonly daysSinceLastVisit: number | null
  readonly status: VisitStatus
  /** الدورةُ التي قِيست بها — **من السجل** (قب-٦)، وتُعرض كي يُقرأ سببُ التصنيف (ق-١١٢). */
  readonly cadenceDays: number
}

/**
 * ق-١٠٢ — **حُكمُ الزيارة**: أمعتمَدةٌ ومَن اعتمدها. جوابُ **منفذٍ محقون** لا حقلٌ تكتبه
 * هذه الوحدة: تعرف الحُكمَ ولا تعرف السلسلةَ ولا حالتَها ولا مَن الأقرب (G22).
 */
export type VisitVerdict = {
  readonly approved: boolean
  readonly approvedByPersonId: string | null
}

/** زيارةٌ معروضةٌ بحُكمها — **لا معتمَدَ بلا اسمِ معتمِدٍ** (ق-١٠٢). */
export type VisitRecord = {
  readonly visit: SupervisionVisit
  readonly verdict: VisitVerdict
}

/** صفُّ العرض القياديّ (ق-١٠١): الوحدةُ التالية ومسؤولُها وتغطيتُها ضمن الدورة. */
export type OverviewRow = {
  readonly unitPath: string
  readonly responsiblePersonId: string | null
  readonly targetCount: number
  readonly visitedInCycle: number
  readonly coveragePct: number
}

/** لوحةُ المكلَّف التشغيلية (ق-١٠١): ما يستحقّ زيارةً، وما زاره بحُكمه. */
export type SupervisionBoard = {
  readonly scopePath: string
  readonly targets: readonly TargetStatus[]
  readonly recentVisits: readonly VisitRecord[]
}

export type SupervisionErrorCode =
  | "UNKNOWN_TARGET"
  | "TARGET_INACTIVE"
  | "WRONG_FORM_FIELDS"
  | "INVALID_RATING"
  | "NON_POSITIVE_ATTENDEES"
  | "FUTURE_DATED"
  | "NO_SUPERVISION_SCOPE"
  | "OUT_OF_SUPERVISION_SCOPE"

export type SupervisionError = {
  readonly code: SupervisionErrorCode
  readonly detail?: string
}

export type SupervisionOk<T> = { readonly ok: true; readonly value: T }
export type SupervisionErr = { readonly ok: false; readonly error: SupervisionError }
export type SupervisionResult<T> = SupervisionOk<T> | SupervisionErr

export function supervisionOk<T>(value: T): SupervisionOk<T> {
  return { ok: true, value }
}

export function supervisionErr(code: SupervisionErrorCode, detail?: string): SupervisionErr {
  return detail === undefined
    ? { ok: false, error: { code } }
    : { ok: false, error: { code, detail } }
}
