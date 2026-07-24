/**
 * **الالتحاقُ بقنواته الثلاث والبتُّ فيه** — عقدُ الوحدة §٥ (تنفيذُ ب-٤٤ وع-٢٠ وقب-١٣).
 *
 * ثلاثةُ ثوابتٍ تعيش هنا:
 *  ١. **ولا مسارَ رابع**: مَن لم يدخل برابطٍ عامٍّ ولا بمبادرةِ قائدٍ (إضافةً أو دعوةً)
 *     **لم يدخل أصلاً** — فبابُ «المشترِك اليتيم» الذي أنتج في v1 مشتركين بلا مسؤولِ رصدٍ
 *     **مغلقٌ بغياب القيمة الرابعة** في نوع القناة.
 *  ٢. **فهرسٌ واحدٌ تلتقي عنده القنوات**: `(المسابقة، الشخص)` على غير المرفوضة — **ويُعاد
 *     فحصُه لحظةَ القبول** درءاً للسباق (الدرسُ المدفوع في ق-٣٢: اعتمادٌ مزدوجٌ أنشأ شخصاً
 *     وحساباً مكرَّرين).
 *  ٣. **المقدَّمُ لا يُحتسب له شيء** (ق-٢٥): لا متبارِيَ يُنشأ قبل البتّ، فلا يظهر في لوحة.
 *
 * **وصفرُ منطقِ اعتمادٍ هنا** (G22): البتُّ **فعلُ قدرةٍ منطاقةٍ «ذ»** على كيان هذه الوحدة —
 * لا سلسلةَ طبقاتٍ ولا توجيهَ شغورٍ ولا حالةَ اعتمادٍ تُدار. وتوجيهُ الطلب عند شغور الأمير
 * **موقوفٌ ومُعلَنٌ** (عقدُ الوحدة §٠) لأنه منطقُ المحرّك لا منطقُ الوحدة.
 */

import type { CompetitionStore } from "../data/store.js"
import type { CompetitionContext } from "./context.js"
import { ageAt, personRefOf, scopesIntersect, trimmed } from "./shared.js"
import { liveCompetition } from "./competitions.js"
import {
  competitionErr,
  competitionOk,
  type Category,
  type Competition,
  type CompetitionResult,
  type Contestant,
  type Enrollment,
  type EnrollmentChannel,
} from "../types.js"

export type ApplicantInput = {
  readonly nameAr: string
  readonly phone: string
  readonly birthDate: Date
}

/** طلباتُ مسجدٍ **المعلَّقةُ وحدَها** — الصندوقُ صندوقُ الأمير بعينه (ق-١٤). */
export function inboxOf(store: CompetitionStore, mosquePath: string): readonly Enrollment[] {
  return store
    .enrollments()
    .filter((e) => e.mosquePath === mosquePath && e.state === "requested")
    .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime() || a.id.localeCompare(b.id))
}

/** فئاتُ المسابقة مرتَّبةً حتمياً — والترتيبُ يُحسب **داخلها** دائماً. */
export function categoriesOf(store: CompetitionStore, competitionId: string): readonly Category[] {
  return [...store.categoriesOfCompetition(competitionId)].sort((a, b) => a.ageMin - b.ageMin || a.id.localeCompare(b.id))
}

/** **الفئةُ التي تسع سنَّه** — ومَن لا تسعه فئةٌ **لا يلتحق**، يُرفض عند الحدّ لا بعد الإدخال. */
function categoryFor(
  store: CompetitionStore,
  competitionId: string,
  age: number,
): Category | null {
  return categoriesOf(store, competitionId).find((c) => age >= c.ageMin && age <= c.ageMax) ?? null
}

/** **المسجدُ داخل نطاق المسابقة؟** — والنطاقُ من الوحدة المخزَّنة لا من مدخل العميل. */
function mosqueInScope(store: CompetitionStore, competition: Competition, mosquePath: string): boolean {
  const unit = store.getUnitByPath(mosquePath)
  if (unit === null) return false
  return scopesIntersect(competition.scopePath, unit.path) && unit.path.startsWith(competition.scopePath)
}

/** **نافذةُ التسجيل**: الحالةُ تسمح، واللحظةُ داخل المدّة — وإلا فالبابُ مغلقٌ بسببٍ مفهوم. */
export function enrollmentWindowOpen(competition: Competition, at: Date): boolean {
  if (competition.status !== "enrolling" && competition.status !== "running") return false
  return (
    competition.enrollmentOpensAt.getTime() <= at.getTime() &&
    competition.enrollmentClosesAt.getTime() > at.getTime()
  )
}

type Prepared = {
  readonly competition: Competition
  readonly category: Category
  readonly personRef: string
  readonly age: number
  readonly nameAr: string
  readonly phone: string
}

/**
 * **الفحوصُ المشتركةُ للقنوات الثلاث في موضعٍ واحد** — فلا تتباعد قناةٌ عن أختها في شرطٍ،
 * وهو بعينه ما جعل الالتحاقَ في v1 ثلاثةَ سلوكياتٍ لا واحداً.
 */
function prepare(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: {
    readonly competitionId: string
    readonly mosquePath: string
    readonly applicant: ApplicantInput
    readonly requireWindow: boolean
  },
): CompetitionResult<Prepared> {
  const found = liveCompetition(store, input.competitionId)
  if (!found.ok) return found
  const competition = found.value

  if (input.requireWindow && !enrollmentWindowOpen(competition, ctx.now)) {
    return competitionErr("ENROLLMENT_WINDOW_CLOSED", competition.status)
  }
  if (!input.requireWindow && competition.status !== "enrolling" && competition.status !== "running") {
    return competitionErr("ENROLLMENT_WINDOW_CLOSED", competition.status)
  }
  if (!mosqueInScope(store, competition, input.mosquePath)) {
    return competitionErr("MOSQUE_OUT_OF_COMPETITION_SCOPE", input.mosquePath)
  }

  const nameAr = trimmed(input.applicant.nameAr)
  const phone = trimmed(input.applicant.phone)
  if (nameAr === null || phone === null) return competitionErr("EMPTY_TITLE")

  const age = ageAt(input.applicant.birthDate, ctx.now)
  const category = categoryFor(store, competition.id, age)
  if (category === null) return competitionErr("AGE_OUT_OF_CATEGORIES", String(age))

  const personRef = personRefOf(nameAr, phone)
  if (store.activeEnrollmentFor(competition.id, personRef) !== null) {
    return competitionErr("DUPLICATE_ENROLLMENT", personRef)
  }

  return competitionOk({ competition, category, personRef, age, nameAr, phone })
}

/** المتبارِي يُنشأ **عند القبول لا قبله** — فالمقدَّمُ لا يُحتسب له شيء (ق-٢٥). */
function createContestant(
  store: CompetitionStore,
  ctx: CompetitionContext,
  prepared: Pick<Prepared, "competition" | "category" | "personRef" | "age">,
  mosquePath: string,
): Contestant {
  const contestant: Contestant = {
    tenantId: store.tenantId,
    id: store.nextId("cont"),
    competitionId: prepared.competition.id,
    subjectType: prepared.competition.subjectType,
    subjectRef: prepared.personRef,
    categoryId: prepared.category.id,
    mosquePath,
    status: "active",
    ageAtEnrollment: prepared.age,
    joinedAt: ctx.now,
  }
  store.saveContestant(contestant)
  return contestant
}

function newEnrollment(
  store: CompetitionStore,
  ctx: CompetitionContext,
  prepared: Prepared,
  input: {
    readonly mosquePath: string
    readonly channel: EnrollmentChannel
    readonly birthDate: Date
    readonly invited: boolean
    readonly inviteId: string | null
    readonly contestantId: string | null
  },
): Enrollment {
  const decided = input.contestantId !== null
  return {
    tenantId: store.tenantId,
    id: store.nextId("enr"),
    competitionId: prepared.competition.id,
    contestantId: input.contestantId,
    personRef: prepared.personRef,
    nameAr: prepared.nameAr,
    phone: prepared.phone,
    birthDate: input.birthDate,
    mosquePath: input.mosquePath,
    channel: input.channel,
    state: decided ? "active" : "requested",
    invited: input.invited,
    inviteId: input.inviteId,
    requestedAt: ctx.now,
    decidedBy: decided ? ctx.actorPersonId : null,
    decidedAt: decided ? ctx.now : null,
    rejectionReason: null,
    followUpCode: store.nextId("fu"),
  }
}

export type PublicEnrollmentInput = {
  readonly competitionId: string
  readonly mosquePath: string
} & ApplicantInput

/**
 * **القناةُ العامّة** — تكتب **طلباً معلَّقاً واحداً** ولا تُنشئ متبارياً (قب-١٣).
 * وضوابطُ ق-٣٢ (الفخُّ وسقفُ الهاتف والمفتاح) تعيش في المنفذ الضيّق (`publicPort.ts`)
 * لأنها **حرزُ الباب** لا منطقَ الالتحاق — وهذه الدالةُ تُستدعى منه وحدَه ومن اختباره.
 */
export function submitPublicEnrollment(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: PublicEnrollmentInput,
): CompetitionResult<Enrollment> {
  const prepared = prepare(store, ctx, {
    competitionId: input.competitionId,
    mosquePath: input.mosquePath,
    applicant: input,
    requireWindow: true,
  })
  if (!prepared.ok) return prepared
  if (!prepared.value.competition.publicRegistration) {
    return competitionErr("PUBLIC_REGISTRATION_DISABLED", input.competitionId)
  }

  const enrollment = newEnrollment(store, ctx, prepared.value, {
    mosquePath: input.mosquePath,
    channel: "public_link",
    birthDate: input.birthDate,
    invited: false,
    inviteId: null,
    contestantId: null,
  })
  store.saveEnrollment(enrollment)
  return competitionOk(enrollment)
}

/** الالتحاقُ **المعلَّقُ وحدَه يُبتّ فيه** — والمبتوتُ لا يُبتّ ثانيةً (لا ختمٌ يمحو الأول). */
function pendingEnrollment(
  store: CompetitionStore,
  enrollmentId: string,
): CompetitionResult<Enrollment> {
  const enrollment = store.getEnrollment(enrollmentId)
  if (enrollment === null) return competitionErr("UNKNOWN_ENROLLMENT", enrollmentId)
  if (enrollment.state !== "requested") return competitionErr("ALREADY_DECIDED", enrollment.state)
  return competitionOk(enrollment)
}

/**
 * **القبولُ يُنشئ متبارياً في فئته**، **ويُعيد فحصَ التكرار لحظتَه** — فلو مرّ طلبان من
 * ثقبٍ زمنيّ، لا يصير أحدُهما متبارياً ثانياً للشخص نفسِه.
 */
export function approveEnrollment(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: { readonly enrollmentId: string },
): CompetitionResult<Contestant> {
  const found = pendingEnrollment(store, input.enrollmentId)
  if (!found.ok) return found
  const enrollment = found.value

  const competition = liveCompetition(store, enrollment.competitionId)
  if (!competition.ok) return competition

  const existing = store.activeEnrollmentFor(enrollment.competitionId, enrollment.personRef)
  if (existing !== null && existing.id !== enrollment.id) {
    return competitionErr("DUPLICATE_ENROLLMENT", enrollment.personRef)
  }

  const age = ageAt(enrollment.birthDate, enrollment.requestedAt)
  const category = categoryFor(store, enrollment.competitionId, age)
  if (category === null) return competitionErr("AGE_OUT_OF_CATEGORIES", String(age))

  const contestant = createContestant(
    store,
    ctx,
    { competition: competition.value, category, personRef: enrollment.personRef, age },
    enrollment.mosquePath,
  )
  store.saveEnrollment({
    ...enrollment,
    contestantId: contestant.id,
    state: "active",
    decidedBy: ctx.actorPersonId,
    decidedAt: ctx.now,
  })
  return competitionOk(contestant)
}

/** **الرفضُ بسببٍ نصّيٍّ إلزاميّ** يراه المتقدّم برمز متابعته (ق-٣٢) — وشفافيةٌ تقلّل الإعادة. */
export function rejectEnrollment(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: { readonly enrollmentId: string; readonly reason: string },
): CompetitionResult<Enrollment> {
  const found = pendingEnrollment(store, input.enrollmentId)
  if (!found.ok) return found
  const reason = trimmed(input.reason)
  if (reason === null) return competitionErr("EMPTY_REASON")

  const rejected: Enrollment = {
    ...found.value,
    state: "rejected",
    rejectionReason: reason,
    decidedBy: ctx.actorPersonId,
    decidedAt: ctx.now,
  }
  store.saveEnrollment(rejected)
  return competitionOk(rejected)
}

export type AddByLeaderInput = {
  readonly competitionId: string
  readonly mosquePath: string
} & ApplicantInput

/**
 * **مسارُ القائد المباشر** (ع-٢٠: «أو يضيف أميرُ المسجد أحد طلابه»): يُنشأ **مشاركاً فوراً**
 * بقناة `amir_added` لأنّ الإضافةَ والموافقةَ منه هو — والمدقِّقُ يسجّل أنه لم يمرّ بطلب.
 */
export function addByLeader(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: AddByLeaderInput,
): CompetitionResult<Contestant> {
  const prepared = prepare(store, ctx, {
    competitionId: input.competitionId,
    mosquePath: input.mosquePath,
    applicant: input,
    requireWindow: false,
  })
  if (!prepared.ok) return prepared

  const contestant = createContestant(store, ctx, prepared.value, input.mosquePath)
  store.saveEnrollment(
    newEnrollment(store, ctx, prepared.value, {
      mosquePath: input.mosquePath,
      channel: "amir_added",
      birthDate: input.birthDate,
      invited: false,
      inviteId: null,
      contestantId: contestant.id,
    }),
  )
  return competitionOk(contestant)
}

export type AddByInviteInput = { readonly inviteId: string } & ApplicantInput

/**
 * **قناةُ الدعوة** (قب-١٣ زيادةُ المالك): الطلبُ يصل **موسوماً «مدعو»** ومسجدُه **معبَّأٌ من
 * الرمز المخزَّن لا من مدخل العميل** (نفسُ حرز §٤-٢ — يقتل صنف خ)، **فيُقبل بنقرةٍ واحدة**
 * لأنّ الإصدارَ **هو** الموافقة.
 *
 * **والرمزُ يُستهلَك مرّةً واحدة**: يُختم بـ`usedAt` ومعرّفِ التحاقه، فلا يُعاد استعمالُه.
 * وهذه **صورةٌ ميسّرةٌ من مسار القائد المباشر** لا مسارٌ ثالثٌ يتيم.
 */
export function addByInvite(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: AddByInviteInput,
): CompetitionResult<Contestant> {
  const invite = store.getInvite(input.inviteId)
  if (invite === null) return competitionErr("UNKNOWN_INVITE", input.inviteId)
  if (invite.revokedAt !== null) return competitionErr("INVITE_REVOKED", invite.id)
  if (invite.usedAt !== null) return competitionErr("INVITE_ALREADY_USED", invite.id)
  if (invite.expiresAt.getTime() <= ctx.now.getTime()) {
    return competitionErr("INVITE_EXPIRED", invite.id)
  }

  const prepared = prepare(store, ctx, {
    competitionId: invite.competitionId,
    // **المسجدُ من الرمز** — ولا يُقبل مسارٌ من العميل أصلاً (ليس في المدخل حقلٌ له).
    mosquePath: invite.mosquePath,
    applicant: input,
    requireWindow: false,
  })
  if (!prepared.ok) return prepared

  const contestant = createContestant(store, ctx, prepared.value, invite.mosquePath)
  const enrollment = newEnrollment(store, ctx, prepared.value, {
    mosquePath: invite.mosquePath,
    channel: "invite",
    birthDate: input.birthDate,
    invited: true,
    inviteId: invite.id,
    contestantId: contestant.id,
  })
  store.saveEnrollment(enrollment)
  store.saveInvite({ ...invite, usedAt: ctx.now, usedByEnrollmentId: enrollment.id })
  return competitionOk(contestant)
}
