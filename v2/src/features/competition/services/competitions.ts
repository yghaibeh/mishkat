/**
 * دورةُ حياة المسابقة والفئاتُ والمراحلُ والجوائز — **الكاتبُ الوحيد** لهذه الكيانات
 * (عقدُ الوحدة §١ و§٨).
 *
 * **آلةُ الحالات أماميّةٌ فقط عدا الإلغاء**، و**العودةُ للخلف غيرُ موجودة**: الخريطةُ أدناه
 * هي كلُّ الانتقالات الممكنة، فلا دالةَ رجوعٍ يُمنع استعمالُها — بل **لا رجوعَ في النموذج**.
 * وتصحيحُ إغلاقٍ خاطئ يمرّ بمسار `records.correct` المدقَّق **خارج هذه الوحدة** (قب-٩).
 */

import type { CompetitionStore } from "../data/store.js"
import type { CompetitionContext } from "./context.js"
import { numberSetting, trimmed } from "./shared.js"
import {
  competitionErr,
  competitionOk,
  type Advancement,
  type Award,
  type AwardKind,
  type Category,
  type Competition,
  type CompetitionResult,
  type CompetitionStatus,
  type Stage,
  type SubjectType,
} from "../types.js"

/**
 * **كلُّ الانتقالات المشروعة في موضعٍ واحد** — وما ليس هنا **غيرُ موجود**، لا ممنوعاً بفحص.
 * والإلغاءُ مخرجٌ من كل حالةٍ حيّة، وله دالتُه لأنه يلزمه سببٌ نصّيّ.
 */
const FORWARD: Readonly<Record<CompetitionStatus, readonly CompetitionStatus[]>> = Object.freeze({
  draft: ["enrolling"],
  enrolling: ["running"],
  running: ["qualifying"],
  qualifying: ["closed"],
  closed: [],
  cancelled: [],
})

/** الحالاتُ التي تقبل الكتابةَ — والمغلقةُ والملغاةُ **تُقرأ ولا تُكتب** (§٢-١-١). */
export function isWritable(status: CompetitionStatus): boolean {
  return status !== "closed" && status !== "cancelled"
}

/** **مفاتيحُ الصور المؤجَّلة** (قب-٧): غيرُ مسجَّلةٍ في السجل المُجمَّد ⟵ `CR-DRAFT`. */
const SUBJECT_TYPE_FLAGS: Readonly<Record<SubjectType, string | null>> = Object.freeze({
  person: null,
  team: "feature.competition_teams",
  unit: "feature.competition_unit_subject",
})

export type CreateCompetitionInput = {
  readonly unitId: string
  readonly titleAr: string
  readonly startMonthHijri: string
  readonly endMonthHijri: string
  readonly enrollmentOpensAt: Date
  readonly enrollmentClosesAt: Date
  readonly subjectType?: SubjectType
  readonly publicRegistration?: boolean
  readonly clonedFrom?: string
}

/**
 * **إنشاءُ مسابقةٍ نطاقُها الوحدةُ المخزَّنة** (ت-١/قب-٤: كلُّ قائدٍ داخل نطاقه).
 *
 * وتُنشأ معها **فئةُ «عام» واحدةٌ تسع الجميع** بحدَّي سنٍّ من سجل الإعدادات — فالمسابقةُ
 * البسيطةُ تبقى بسيطةً بلا أن يُطالَب منشئُها بتقسيمٍ لا يريده، والترتيبُ **داخل الفئة**
 * يبقى قاعدةً واحدةً لا حالتين.
 */
export function createCompetition(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: CreateCompetitionInput,
): CompetitionResult<Competition> {
  const unit = store.getUnit(input.unitId)
  if (unit === null) return competitionErr("UNKNOWN_UNIT", input.unitId)

  const titleAr = trimmed(input.titleAr)
  if (titleAr === null) return competitionErr("EMPTY_TITLE")

  if (input.enrollmentClosesAt.getTime() <= input.enrollmentOpensAt.getTime()) {
    return competitionErr("ENROLLMENT_WINDOW_CLOSED", "نافذةٌ مقلوبة")
  }

  const subjectType = input.subjectType ?? "person"
  const flag = SUBJECT_TYPE_FLAGS[subjectType]
  if (flag !== null && !ctx.isFeatureEnabled(flag)) {
    return competitionErr("SUBJECT_TYPE_NOT_ENABLED", subjectType)
  }

  const competition: Competition = {
    tenantId: store.tenantId,
    id: store.nextId("comp"),
    scopePath: unit.path,
    titleAr,
    status: "draft",
    startMonthHijri: input.startMonthHijri,
    endMonthHijri: input.endMonthHijri,
    enrollmentOpensAt: input.enrollmentOpensAt,
    enrollmentClosesAt: input.enrollmentClosesAt,
    subjectType,
    publicRegistration: input.publicRegistration ?? false,
    clonedFrom: input.clonedFrom ?? null,
    cancelReason: null,
    createdBy: ctx.actorPersonId,
    createdAt: ctx.now,
  }
  store.saveCompetition(competition)

  // **فئةُ «عام»**: حدّاها الافتراضيان إعدادان مسجَّلان — ويقتلان الثابتين الصلبين في v1.
  const general: Category = {
    tenantId: store.tenantId,
    id: store.nextId("cat"),
    competitionId: competition.id,
    titleAr: "عام",
    ageMin: numberSetting(ctx, "competition.min_age", unit.path),
    ageMax: numberSetting(ctx, "competition.max_age", unit.path),
    level: null,
  }
  store.saveCategory(general)

  return competitionOk(competition)
}

/** مسابقةٌ موجودةٌ — والغائبةُ تُردّ بسببٍ مميِّزٍ لا بصمت (دفاعٌ في العمق تحت النطاق). */
export function liveCompetition(
  store: CompetitionStore,
  competitionId: string,
): CompetitionResult<Competition> {
  const competition = store.getCompetition(competitionId)
  if (competition === null) return competitionErr("UNKNOWN_COMPETITION", competitionId)
  return competitionOk(competition)
}

/** مسابقةٌ **تقبل الكتابة** — والمغلقةُ والملغاةُ تُردّان قبل أيّ تغيير. */
export function writableCompetition(
  store: CompetitionStore,
  competitionId: string,
): CompetitionResult<Competition> {
  const found = liveCompetition(store, competitionId)
  if (!found.ok) return found
  if (!isWritable(found.value.status)) {
    return competitionErr("COMPETITION_CLOSED", found.value.status)
  }
  return found
}

/**
 * **انتقالٌ أماميٌّ واحد** — والقفزُ والرجوعُ مرفوضان بالخريطة نفسِها. وكلُّ انتقالٍ **حدثٌ
 * مدقَّق** بمن ومتى (يحمله إعلانُ دالة الخادم).
 */
export function advanceStatus(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: { readonly competitionId: string; readonly to: CompetitionStatus },
): CompetitionResult<Competition> {
  void ctx
  const found = liveCompetition(store, input.competitionId)
  if (!found.ok) return found
  const current = found.value

  if (!FORWARD[current.status].includes(input.to)) {
    return competitionErr("ILLEGAL_TRANSITION", `${current.status}⟶${input.to}`)
  }
  const moved: Competition = { ...current, status: input.to }
  store.saveCompetition(moved)
  return competitionOk(moved)
}

/**
 * **الإلغاءُ يحفظ البيانات ولا يمحوها**، ويلزمه سببٌ نصّيّ — فالقرارُ الذي يُنهي برنامجاً
 * لا يُتخذ بلا بيان، ويبقى مقروءاً لمن يسأل بعد سنة.
 */
export function cancelCompetition(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: { readonly competitionId: string; readonly reason: string },
): CompetitionResult<Competition> {
  void ctx
  const found = writableCompetition(store, input.competitionId)
  if (!found.ok) return found
  const reason = trimmed(input.reason)
  if (reason === null) return competitionErr("EMPTY_REASON")

  const cancelled: Competition = { ...found.value, status: "cancelled", cancelReason: reason }
  store.saveCompetition(cancelled)
  return competitionOk(cancelled)
}

export type DefineCategoryInput = {
  readonly competitionId: string
  readonly titleAr: string
  readonly ageMin?: number
  readonly ageMax?: number
  readonly level?: string
}

/** **الفئةُ حدٌّ لا لغز**: حدّان مقلوبان يُردّان، والافتراضيان من سجل الإعدادات. */
export function defineCategory(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: DefineCategoryInput,
): CompetitionResult<Category> {
  const found = writableCompetition(store, input.competitionId)
  if (!found.ok) return found
  const titleAr = trimmed(input.titleAr)
  if (titleAr === null) return competitionErr("EMPTY_TITLE")

  const scopePath = found.value.scopePath
  const ageMin = input.ageMin ?? numberSetting(ctx, "competition.min_age", scopePath)
  const ageMax = input.ageMax ?? numberSetting(ctx, "competition.max_age", scopePath)
  if (ageMin > ageMax) return competitionErr("INVALID_AGE_RANGE", `${ageMin}>${ageMax}`)

  const category: Category = {
    tenantId: store.tenantId,
    id: store.nextId("cat"),
    competitionId: found.value.id,
    titleAr,
    ageMin,
    ageMax,
    level: input.level ?? null,
  }
  store.saveCategory(category)
  return competitionOk(category)
}

export type DefineStageInput = {
  readonly competitionId: string
  readonly order: number
  readonly titleAr: string
  readonly advancement: Advancement
}

/**
 * **المرحلةُ تحمل معيارَها بياناتٍ** — فيُعرض للمتبارين **قبل** تنفيذه، ولا تأهيلَ يدويٌّ
 * بلا معيار. (وفي v1 كان المعيارُ واحداً مثبَّتاً بلا فئاتٍ ولا سقوف.)
 */
export function defineStage(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: DefineStageInput,
): CompetitionResult<Stage> {
  void ctx
  const found = writableCompetition(store, input.competitionId)
  if (!found.ok) return found
  const titleAr = trimmed(input.titleAr)
  if (titleAr === null) return competitionErr("EMPTY_TITLE")
  if (!Number.isInteger(input.order) || input.order < 1) {
    return competitionErr("INVALID_VALUE", `order=${input.order}`)
  }

  const stage: Stage = {
    tenantId: store.tenantId,
    id: store.nextId("stage"),
    competitionId: found.value.id,
    order: input.order,
    titleAr,
    advancement: input.advancement,
    executedAt: null,
  }
  store.saveStage(stage)
  return competitionOk(stage)
}

export type DeclareAwardInput = {
  readonly competitionId: string
  readonly titleAr: string
  readonly kind: AwardKind
  readonly categoryId?: string
  readonly stageId?: string
  readonly place?: number
  readonly amountCents?: number
  readonly currency?: string
}

/**
 * **إعلانُ جائزةٍ — معلومةُ برنامجٍ لا قيدٌ ماليّ** (قب-٤٥): تُعرض للمتبارين قبل البدء،
 * **ولا تُنتج مستحقّاً ولا قيداً**. ورصدُها في الموازنة وصرفُها للفائز يمرّان بالمال حصراً
 * (مقترحٌ ← اعتمادٌ ثنائيّ ← ترحيلٌ للدفتر) — **لا مسارَ مالٍ ثانٍ** (ق-٥٣/ق-٥٤).
 */
export function declareAward(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: DeclareAwardInput,
): CompetitionResult<Award> {
  void ctx
  const found = writableCompetition(store, input.competitionId)
  if (!found.ok) return found
  const titleAr = trimmed(input.titleAr)
  if (titleAr === null) return competitionErr("EMPTY_TITLE")

  const award: Award = {
    tenantId: store.tenantId,
    id: store.nextId("award"),
    competitionId: found.value.id,
    categoryId: input.categoryId ?? null,
    stageId: input.stageId ?? null,
    place: input.place ?? null,
    titleAr,
    kind: input.kind,
    // العينيّةُ والمعنويّةُ **بلا مبلغٍ ولا عملة** — فلا رقمٌ يوهم بمسارٍ ماليّ.
    amountCents: input.kind === "cash" ? (input.amountCents ?? null) : null,
    currency: input.kind === "cash" ? (input.currency ?? null) : null,
  }
  store.saveAward(award)
  return competitionOk(award)
}
