/**
 * أنواعُ سجل اليوم والنقاط — عقدُ الوحدة `features/dailyLog/SPEC.md`.
 *
 * أربعةُ ثوابتٍ تُفرَض **بالنوع** قبل أيّ سطرِ منطق:
 *  ١. **النقاطُ تُخزَّن مع القيد** (ق-٤١): `points` حقلٌ في القيد لا اشتقاقٌ من العدد×الوزن —
 *     فتغييرُ وزنٍ اليوم لا يُعيد كتابة أسبوعٍ مضى، والأهليةُ حُسمت يوم الإدخال.
 *  ٢. **المخطّطُ له نطاقٌ لا جنس** (ق-٤٢): `scopePath` هو ما يختار المخطّط — فلا فرعَ
 *     جنسانيٌّ في الكود، ومسارُ النساء **حالةٌ من القاعدة** لا استثناءٌ مفصَّلٌ لها.
 *  ٣. **نسخةُ النشاط مؤرَّخة** (ق-٣٦): `validFrom` على كل نسخة — والماضي لا يُعاد حسابه.
 *  ٤. **سببُ منعِ النقاط معلَنٌ لا صامت** (ب-٣٢/ب-٤٢): `block` يقول لماذا صار صفراً،
 *     فيُعرض للمستخدم بدل «رقمٍ لا يُفهم» (ق-١١٢).
 */

/** وحدةٌ تنظيمية كما يعرفها هذا المستودع — معرّفُها ومسارُها (ت-٢). */
export type DailyLogUnit = {
  readonly tenantId: string
  readonly id: string
  readonly path: string
}

/**
 * مخطّطُ أنشطةٍ لنطاق (ق-٤٢) — **كيانُ بياناتٍ**: يُضاف ويُعطَّل بلا مبرمج،
 * والأعمقُ نطاقاً يغلب الأعمّ (نظيرُ قاعدة سجل الإعدادات).
 */
export type ActivityScheme = {
  readonly tenantId: string
  readonly id: string
  readonly ar: string
  readonly scopePath: string
  readonly active: boolean
}

/**
 * نسخةُ نشاطٍ في الكتالوج (ب-٣٩ج/قب-١١، IA ك-١٨) — **بياناتٌ تُدار بشاشةٍ لا كودٌ يُنشر**.
 * `activityId` ثابتُ هويّة النشاط عبر نسخه، و`id` معرّفُ النسخة بتاريخ سريانها.
 */
export type ActivityDefinition = {
  readonly tenantId: string
  readonly id: string
  readonly schemeId: string
  readonly activityId: string
  readonly ar: string
  /** نقاطُ الوحدة الواحدة من هذا النشاط. */
  readonly weight: number
  /** ق-٤٠: سقفٌ يوميّ اختياريّ — `null` = بلا سقف. */
  readonly maxPerDay: number | null
  /** ق-٤٠: هل يشترط بلوغَ عتبة مشاركةٍ من طلاب الأسرة؟ */
  readonly requiresParticipation: boolean
  /** الإيقافُ بيانٌ لا حذف (المادة ٧/٤). */
  readonly active: boolean
  /** ق-٣٦: **بأثرٍ قادمٍ فقط** — نسخةٌ لا تسري قبل تاريخها. */
  readonly validFrom: Date
}

/** ب-٣٢: عددُ طلاب الأسرة — `null` يعني **غيرَ مضبوط** فتُمنع النقاط المشروطة. */
export type FamilyRoster = {
  readonly tenantId: string
  readonly unitPath: string
  readonly studentCount: number | null
  readonly setBy: string
  readonly setAt: Date
}

/** سببُ منع النقاط — قيمةٌ معلنةٌ تُعرض، لا صفرٌ صامت (ق-١١٢). */
export type PointsBlock =
  | "none"
  | "familyRosterUnset"
  | "belowParticipation"
  | "alreadyCredited"
  | "dailyCap"
  | "freeActivity"

/**
 * قيدُ اليوم (ق-٤٥) — فريدٌ بـ`clientUuid` **و**بالمفتاح الطبيعيّ (وحدة/نشاط/يوم)،
 * ومفاتيحُ زمنه (`dayKey`/`periodKey`) محسوبةٌ **بتوقيت الإعداد** لا بـUTC.
 */
export type DailyEntry = {
  readonly tenantId: string
  readonly id: string
  readonly clientUuid: string
  readonly unitPath: string
  /** `null` = نشاطٌ حرٌّ خارج الكتالوج (ب-٤٢). */
  readonly activityId: string | null
  readonly freeTextAr: string | null
  readonly dayKey: string
  readonly periodKey: string
  /** ما أُدخل. */
  readonly count: number
  /** ما احتُسب فعلاً بعد السقف ومنع الازدواج (ق-٤٠/ق-٤٦). */
  readonly creditedCount: number
  /** ق-٤١: النقاطُ **مخزَّنة** — لا تُشتقّ من العدد×الوزن عند الجمع. */
  readonly points: number
  readonly studentIds: readonly string[]
  readonly creditedStudentIds: readonly string[]
  readonly block: PointsBlock
  readonly byPersonId: string
  readonly at: Date
}

/** تصنيفُ المسجد نسبةً من الهدف (ق-٤٤/قب-١١) — لا مقياسَ ٥٦/٤٠. */
export type InfluenceTier = "excellent" | "below" | "struggling"

/** مدى تقويميّ بمفتاحَي يومٍ — حدودُه تأتي من المستدعي (التقويمُ الهجريّ إعدادُ عرض). */
export type DaySpan = {
  readonly fromDayKey: string
  readonly toDayKey: string
}

export type DailyLogErrorCode =
  | "UNKNOWN_UNIT"
  | "NO_SCHEME_FOR_SCOPE"
  | "UNKNOWN_SCHEME"
  | "UNKNOWN_ACTIVITY"
  | "ACTIVITY_INACTIVE"
  | "INVALID_WEIGHT"
  | "BACKDATED_VERSION"
  | "FUTURE_DATED"
  | "NON_POSITIVE_COUNT"
  | "EMPTY_FREE_TEXT"
  | "ACTIVITY_OR_FREE_TEXT_REQUIRED"
  | "PERIOD_LOCKED"
  | "INVALID_STUDENT_COUNT"

export type DailyLogError = {
  readonly code: DailyLogErrorCode
  readonly detail?: string
}

export type DailyLogOk<T> = { readonly ok: true; readonly value: T }
export type DailyLogErr = { readonly ok: false; readonly error: DailyLogError }
export type DailyLogResult<T> = DailyLogOk<T> | DailyLogErr

export function dailyLogOk<T>(value: T): DailyLogOk<T> {
  return { ok: true, value }
}

export function dailyLogErr(code: DailyLogErrorCode, detail?: string): DailyLogErr {
  return detail === undefined
    ? { ok: false, error: { code } }
    : { ok: false, error: { code, detail } }
}
