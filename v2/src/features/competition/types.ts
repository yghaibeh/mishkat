/**
 * أنواعُ نموذج المسابقة — عقدُ الوحدة `features/competition/SPEC.md`.
 *
 * **قب-١٢ يُفرَض هنا بالنوع قبل أيّ سطرِ منطق** — خمسةُ ثوابت:
 *  ١. **المسابقةُ كيانٌ متعدّدٌ نطاقُه حقلٌ عليه** (`scopePath`) من **شجرة المشروع نفسها** —
 *     لا شجرةٌ موازية ولا مفهومُ «المسابقة النشطة الواحدة» أصلاً.
 *  ٢. **صفرُ عدّادٍ مخزَّن** (ق-٩٢): ليس في أيّ كيانٍ هنا حقلٌ يحفظ نقاطاً ولا رتبةً ولا
 *     عدداً — فالرصيدُ اشتقاقٌ لحظةَ السؤال، **ولا يوجد ما يتباعد عن الواقع أصلاً**.
 *  ٣. **`mosquePath` إلزاميٌّ على كل متبارٍ**: هو مَن يوافق ومَن يرصد وحدُّ العزل — أي أنه
 *     ليس وصفاً بل **محورَ الصلاحية كلِّها**؛ فبلا مسجدٍ لا موافقةَ ولا رصدَ ولا عزل.
 *  ٤. **المتبارِي لا يوجد خارج مسابقة**: `competitionId` حقلٌ إلزاميّ ⇒ يستحيل أن يصير كياناً
 *     موازياً لـ«الشخص» في النظام (حدُّ تسرّب المفاهيم — العقدُ الأمّ §١-٢).
 *  ٥. **الجائزةُ إعلانٌ لا صرف**: `Award` بلا مستحقٍّ ولا قيدٍ ولا مرجعٍ ماليّ — والمسارُ
 *     الماليُّ **واحدٌ خارج هذه الوحدة** (قب-٤٥، ق-٥٣/ق-٥٤).
 */

/** وحدةٌ تنظيمية كما يعرفها هذا المستودع — إسقاطُها لا نسخةُ حقيقتها. */
export type CompetitionUnit = {
  readonly tenantId: string
  readonly id: string
  readonly path: string
  readonly type: string
}

/**
 * آلةُ حالاتٍ مغلقة، **أماميّةٌ فقط عدا الإلغاء**. والعودةُ للخلف **غيرُ موجودة**: لا قيمةَ
 * تسمح بها الخريطةُ في `services/competitions.ts`، ولا دالةَ لها — فالمنعُ بغياب المِقبض.
 */
export type CompetitionStatus =
  | "draft"
  | "enrolling"
  | "running"
  | "qualifying"
  | "closed"
  | "cancelled"

/** موضوعُ التباري — والأخيران خلف مفتاحيهما (قب-٧): كلفتُهما حقلٌ لا طبقةُ تجريد. */
export type SubjectType = "person" | "team" | "unit"

/** **المسابقة** (IA ك-٢١) — كيانٌ متعدّدٌ نطاقُه عقدةٌ من شجرة الصلاحيات نفسِها. */
export type Competition = {
  readonly tenantId: string
  readonly id: string
  /** نطاقُها — **مصدرُ التوسّع كلِّه** (مسابقةُ قسمٍ أو منطقةٍ أو مربعٍ أو مسجدٍ واحد). */
  readonly scopePath: string
  readonly titleAr: string
  readonly status: CompetitionStatus
  /** المدةُ **بالهجريّ** إحياءً للتاريخ المنسيّ (وثيقةُ العميل نصاً). */
  readonly startMonthHijri: string
  readonly endMonthHijri: string
  /** نافذةُ التسجيل **منفصلةٌ عن مدة المسابقة عمداً**: تسجيلٌ يُغلق والمسابقةُ تستمر. */
  readonly enrollmentOpensAt: Date
  readonly enrollmentClosesAt: Date
  readonly subjectType: SubjectType
  readonly publicRegistration: boolean
  /** **بدل كيان «قالب»**: النسخُ فعلُ إنشاءٍ لا كيانٌ ثالثٌ يضيف مصدرَ حقيقةٍ ثانياً. */
  readonly clonedFrom: string | null
  /** الإلغاءُ **يحفظ البيانات ولا يمحوها**، ويلزمه سببٌ نصّيّ. */
  readonly cancelReason: string | null
  readonly createdBy: string
  readonly createdAt: Date
}

/**
 * **الفئة** — والترتيبُ يُحسب **داخلها دائماً**. ومسابقةٌ بلا فئاتٍ معلنة تُنشأ آلياً بفئةٍ
 * واحدةٍ تسع الجميع ⇐ **البسيطُ يبقى بسيطاً، والمعقَّدُ ممكن**.
 */
export type Category = {
  readonly tenantId: string
  readonly id: string
  readonly competitionId: string
  readonly titleAr: string
  readonly ageMin: number
  readonly ageMax: number
  readonly level: string | null
}

/** معيارُ الصعود — **بياناتٌ معلنةٌ تُعرض قبل تنفيذها** لا شيفرةٌ مخفيّة. */
export type AdvancementTake =
  | { readonly topN: number }
  | { readonly topPercent: number }
  | { readonly minScore: number }

export type Advancement = {
  readonly basis: "category" | "overall"
  readonly take: AdvancementTake
  /** سقفُ الصاعدين لكل مسجد — **عدالةٌ جغرافية**، اختياريٌّ فارغٌ افتراضاً (ق-م-٩). */
  readonly perMosqueCap?: number
}

export type Stage = {
  readonly tenantId: string
  readonly id: string
  readonly competitionId: string
  readonly order: number
  readonly titleAr: string
  readonly advancement: Advancement
  /** تنفيذُ المعيار **فعلٌ واحدٌ ذرّيٌّ مدقَّق** — ووسمُه هنا يمنع تنفيذَه مرتين. */
  readonly executedAt: Date | null
}

/** الأنواعُ الأربعةُ للقيمة **تكفي وتُغني** عن اختراع نوعٍ لكل نشاط (العقدُ الأمّ §٢-٤-١). */
export type ScoringValueKind = "count" | "score" | "boolean" | "duration"
export type ScoringPeriod = "daily" | "weekly" | "hijri_month" | "stage" | "once"

/**
 * **نوعُ حدث التنقيط — قلبُ التوسّع**: في v1 كانت الأنواعُ **مثبَّتةً** («برنامجٌ شهريّ»
 * و«اختبارٌ مركزيّ») لا ثالثَ لهما إلا بمبرمجٍ وهجرة؛ وهنا **صفٌّ يُضاف فيعمل بلا سطر كود**.
 *
 * و**النسخُ مؤرَّخة** (ق-٣٦): `id` معرّفُ **النسخة**، و`key` هويةُ النوع عبر نسخه.
 * فتغييرُ وزنٍ **يختم نسخةً ويفتح أخرى** ولا يمسّ الماضي أبداً.
 *
 * **ولا `recordedByCapability` ولا `recordScope` هنا**: قدرةُ الرصد ونطاقُها معلنانِ **مرّةً
 * واحدة** في دالة الخادم، وحقلٌ يحملهما على كل نوعٍ **مصدرُ حقيقةٍ ثانٍ يتباعد** (المادة ١/٢).
 */
export type ScoringEventType = {
  readonly tenantId: string
  readonly id: string
  readonly competitionId: string
  readonly key: string
  readonly titleAr: string
  /** وسمٌ حرٌّ معلن: تعبدي · علمي · أنشطة · حفظ… — **وسمٌ لا كيان**. */
  readonly track: string
  readonly valueKind: ScoringValueKind
  readonly weight: number
  /** سقفُ الفترة (نظيرُ ق-٤٠) — والتجاوزُ **يُردّ لا يُبتلع صامتاً**. */
  readonly maxPerPeriod: number | null
  readonly period: ScoringPeriod
  readonly excusable: boolean
  readonly activeFrom: Date
  readonly activeTo: Date | null
  /** النسخةُ التي حلّت هذه محلَّها — فالتاريخُ سلسلةٌ مقروءةٌ لا صفٌّ يُكتب فوقه. */
  readonly supersedes: string | null
}

export type ContestantStatus = "active" | "advanced" | "withdrawn" | "removed"

/**
 * **المتبارِي** — *ما يُرتَّب في اللوحة*. وفصلُه عن الالتحاق ضروريٌّ لأنّ الفريق يُنشأ مرّةً
 * ويلتحق أفرادُه أفراداً. **والسنُّ يُثبَّت عند الالتحاق** فلا يقفز أحدٌ فئةً في منتصف السنة.
 */
export type Contestant = {
  readonly tenantId: string
  readonly id: string
  readonly competitionId: string
  readonly subjectType: SubjectType
  readonly subjectRef: string
  readonly categoryId: string
  /** مسجدُ الانتساب — **محورُ الصلاحية**: مَن يوافق، ومَن يرصد، وحدُّ العزل. */
  readonly mosquePath: string
  readonly status: ContestantStatus
  readonly ageAtEnrollment: number
  readonly joinedAt: Date
}

/** القنواتُ **ثلاثٌ لا رابعَ لها** — فبابُ «المشترِك اليتيم» مغلقٌ بغياب القيمة الرابعة. */
export type EnrollmentChannel = "public_link" | "invite" | "amir_added"

/** والحالةُ `expired` معلنةٌ **قبل** مجدولها — فلا يلزم تغييرُ كيانٍ حين يصل (عقدُ الوحدة §٠). */
export type EnrollmentState = "requested" | "active" | "rejected" | "expired"

/**
 * **الالتحاق** (IA ك-٢٢) — *سجلُّ دخوله وحالته*. والمقدَّمُ **لا يُحتسب له شيء** ولا يظهر في
 * لوحةٍ (ق-٢٥: كالإسناد المعلّق تماماً)، فلا يوجد `contestantId` قبل البتّ.
 *
 * و**`personRef` هو المعياريّ من (الاسم + الهاتف)** — جوابُ «مَن هو نفسُ الشخص بلا حساب؟»
 * (ق-٣٢)، وعليه يقوم فهرسُ منع التكرار الذي تلتقي عنده القنواتُ الثلاث.
 */
export type Enrollment = {
  readonly tenantId: string
  readonly id: string
  readonly competitionId: string
  readonly contestantId: string | null
  readonly personRef: string
  readonly nameAr: string
  readonly phone: string
  readonly birthDate: Date
  readonly mosquePath: string
  readonly channel: EnrollmentChannel
  readonly state: EnrollmentState
  /** وسمُ «مدعو» (قب-١٣ زيادةُ المالك) — فيُقبل بنقرةٍ لأنّ الإصدارَ **هو** الموافقة. */
  readonly invited: boolean
  readonly inviteId: string | null
  readonly requestedAt: Date
  readonly decidedBy: string | null
  readonly decidedAt: Date | null
  /** **سببٌ نصّيٌّ إلزاميّ** عند الرفض، يراه المتقدّم برمز المتابعة (ق-٣٢). */
  readonly rejectionReason: string | null
  /** رمزُ المتابعة — **يتابع به حالتَه بلا حساب** (ق-٣١: الخصوصيةُ والحجم معاً). */
  readonly followUpCode: string
}

/**
 * **رمزُ الدعوة** — القناةُ الثانية (قب-١٣ §٨). و**الرمزُ هو الهوية** فليس مساراً عامّاً
 * معلناً ولا يدخل القائمةَ البيضاء ولا يُعدّ في سقف G16.
 * أربعةُ ثوابت: منسوبٌ لمُصدِره · منتهي الصلاحية · قابلٌ للإبطال · **أحاديُّ الاستعمال**.
 */
export type Invite = {
  readonly tenantId: string
  readonly id: string
  readonly competitionId: string
  readonly mosquePath: string
  readonly issuedBy: string
  readonly issuedAt: Date
  readonly expiresAt: Date
  readonly revokedAt: Date | null
  readonly usedAt: Date | null
  readonly usedByEnrollmentId: string | null
}

export type ExcuseState = "none" | "excused"

/**
 * **حدثُ التنقيط** — ومفتاحُه الطبيعيُّ `(contestantId, typeId, periodKey, sourceRef)` فريدٌ
 * والإدخالُ **upsert**: فمزامنتان لا تضاعفان نقطة (ق-٤٥)، **وق-٤٦ مُقفَلةٌ رياضياً** لأنّ
 * نفسَ المصدر يُنتج نفسَ `sourceRef` ⇒ صفٌّ واحدٌ لا صفّان.
 *
 * **والنقطةُ تُفسَّر دائماً**: راصدٌ ووقتٌ ونطاقٌ **ونسخةُ وزن** ⇒ «لماذا فاز فلان؟» جوابُه
 * سطرٌ سطر (وفي v1 كان `recordedBy` يُسجَّل ولا يُعرض).
 */
export type ScoreEvent = {
  readonly tenantId: string
  readonly id: string
  readonly competitionId: string
  readonly contestantId: string
  readonly typeKey: string
  /** نسخةُ الوزن التي حُسب بها — **فالماضي لا يتغيّر** حين تُرفع الأوزان (ق-٣٦). */
  readonly typeVersionId: string
  /** مفتاحٌ هجريّ: `1447-08` · `1447-W03` · `stage-2`. */
  readonly periodKey: string
  readonly value: number
  /** **«العذرُ لا يخصم»**: يُسجَّل بقيمته ولا يُنقص الرصيد (وثيقةُ العميل نصاً). */
  readonly excuse: ExcuseState
  readonly excuseReason: string | null
  readonly recordedBy: string
  readonly recordedAt: Date
  readonly occurredAt: Date
  readonly scopePathAtRecord: string
  /** مرجعُ الكيان الأصل إن كان مشتقّاً — **جزءٌ من المفتاح الطبيعيّ** (ق-٤٦). */
  readonly sourceRef: string | null
}

export type AwardKind = "cash" | "in_kind" | "honorary"

/**
 * **الجائزة — إعلانٌ فقط**. الصرفُ يمرّ بالمال حصراً: مقترحٌ ← اعتمادٌ ثنائيّ ← ترحيلٌ للدفتر.
 * **ولا مسارَ مالٍ ثانٍ** (ق-٥٣/ق-٥٤) — فليس في هذا الكيان مستحقٌّ ولا قيدٌ ولا مرجعٌ ماليّ.
 */
export type Award = {
  readonly tenantId: string
  readonly id: string
  readonly competitionId: string
  readonly categoryId: string | null
  readonly stageId: string | null
  readonly place: number | null
  readonly titleAr: string
  readonly kind: AwardKind
  readonly amountCents: number | null
  readonly currency: string | null
}

export type CompetitionErrorCode =
  | "UNKNOWN_UNIT"
  | "UNKNOWN_COMPETITION"
  | "UNKNOWN_CATEGORY"
  | "UNKNOWN_STAGE"
  | "UNKNOWN_SCORING_TYPE"
  | "UNKNOWN_CONTESTANT"
  | "UNKNOWN_ENROLLMENT"
  | "UNKNOWN_INVITE"
  | "EMPTY_TITLE"
  | "EMPTY_REASON"
  | "INVALID_SCOPE_PATH"
  | "INVALID_WEIGHT"
  | "INVALID_VALUE"
  | "INVALID_AGE_RANGE"
  | "AGE_OUT_OF_CATEGORIES"
  | "SUBJECT_TYPE_NOT_ENABLED"
  | "ILLEGAL_TRANSITION"
  | "COMPETITION_CLOSED"
  | "ENROLLMENT_WINDOW_CLOSED"
  | "PUBLIC_REGISTRATION_DISABLED"
  | "DUPLICATE_ENROLLMENT"
  | "PHONE_QUOTA_EXCEEDED"
  | "ALREADY_DECIDED"
  | "INVITE_EXPIRED"
  | "INVITE_REVOKED"
  | "INVITE_ALREADY_USED"
  | "MOSQUE_OUT_OF_COMPETITION_SCOPE"
  | "COMPETITION_OUT_OF_VIEW_SCOPE"
  | "BACKDATE_LOCKED"
  | "EXCUSE_REASON_REQUIRED"
  | "ALREADY_DECLARED"
  | "NOT_QUALIFYING"

export type CompetitionError = {
  readonly code: CompetitionErrorCode
  readonly detail?: string
}

export type CompetitionOk<T> = { readonly ok: true; readonly value: T }
export type CompetitionErr = { readonly ok: false; readonly error: CompetitionError }
export type CompetitionResult<T> = CompetitionOk<T> | CompetitionErr

export function competitionOk<T>(value: T): CompetitionOk<T> {
  return { ok: true, value }
}

export function competitionErr(code: CompetitionErrorCode, detail?: string): CompetitionErr {
  return detail === undefined
    ? { ok: false, error: { code } }
    : { ok: false, error: { code, detail } }
}
