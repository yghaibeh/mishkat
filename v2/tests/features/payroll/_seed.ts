/**
 * بذرةُ عالم الرواتب — تُبنى على **العالم القانونيّ الواحد** (TESTING_POLICY §٥)، وعلى
 * **المصادر الحقيقية لا على بدائلَ مريحة**:
 *
 *  - ساعاتُ المعلّم من `education::approvedTeachingLoad` **نفسِها** فوق حلقةٍ حقيقيةٍ ودروسٍ
 *    حقيقية — فلو انحرف اشتقاقُ ق-٨٦ يوماً **سقط اختبارُنا هنا** لا في الإنتاج.
 *  - والختمُ من **محرّك الاعتماد نفسِه** (تقديمٌ ⟵ اعتماد) لا من علمٍ في الاختبار — فالمبدأ
 *    الحاكم («يُشتقّ حتى يُعتمد ثم يُختَم») **يُبرهن على التركيب الحقيقيّ**.
 *  - والقيدُ في **دفتر النواة** — فبرهانُ التوازن يُقاس على المال الفعليّ.
 *
 * **حتميّ**: لحظةٌ مثبَّتة ومعرّفاتٌ متتابعة — لا عشوائيّة ولا ساعةَ زمن-تشغيل.
 */

import { CirclesStore } from "../../../src/features/circles/data/store.js"
import { createCircle, assignTeacher } from "../../../src/features/circles/services/circles.js"
import { enroll } from "../../../src/features/circles/services/enrollment.js"
import { makeScopeReach } from "../../../src/features/circles/services/directory.js"
import type { CirclesContext } from "../../../src/features/circles/services/context.js"
import { EducationStore } from "../../../src/features/education/data/store.js"
import { CircleLogStore } from "../../../src/features/circleLog/data/store.js"
import { circleModelFrom } from "../../../src/features/circleLog/services/circlesPort.js"
import { circleDaysFrom } from "../../../src/features/education/services/dayLogPort.js"
import { recordLesson } from "../../../src/features/education/services/lessons.js"
import { approvedTeachingLoad } from "../../../src/features/education/services/teacherHours.js"
import { makeCirclePorts } from "../../../src/features/education/services/bindings.js"
import type { EducationContext } from "../../../src/features/education/services/context.js"
import { LedgerStore } from "../../../src/features/ledger/data/store.js"
import type { Cents } from "../../../src/features/ledger/types.js"
import { PayrollStore, type PayrollStores } from "../../../src/features/payroll/data/store.js"
import type { PayrollContext } from "../../../src/features/payroll/services/context.js"
import {
  rootAssignedRoster,
  NO_SEAL,
  type ApprovedPoints,
  type PayrollAccounts,
  type SealPort,
  type TeachingLoad,
} from "../../../src/features/payroll/services/ports.js"
import { ApprovalStore } from "../../../src/features/approval/data/store.js"
import { makeCapabilityCheck } from "../../../src/features/approval/services/authority.js"
import type { RoutingContext } from "../../../src/features/approval/services/routing.js"
import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import { createSettingsResolver, type SettingOverride } from "../../../src/settings/resolver.js"
import type { Actor, DecisionContext } from "../../../src/authorization/can.js"

export const MAIN_TENANT_ID = "t-main"
/** الشبكةُ الثانية — بنفس المسارات النسبيّة عمداً، فيثبت العزلُ أنّ التطابق لا يسرّب (قب-١٨). */
export const SECOND_TENANT_ID = "t-aleppo"

/** لحظةُ العالم المثبَّتة — كلُّ تاريخٍ مشتقٌّ منها. */
export const NOW = new Date("2026-07-22T09:00:00.000Z")
export const HELD_AT = new Date("2026-07-20T09:00:00.000Z")
export const NEXT_DAY = new Date("2026-07-21T09:00:00.000Z")
export const FROM = new Date("2026-07-01T00:00:00.000Z")
export const TO = new Date("2026-08-01T00:00:00.000Z")
export const PERIOD = { id: "2026-07", endsAt: new Date("2026-07-31T23:59:59.000Z") }

export const ROOT_PATH = "/"
export const KHALID_PATH = "/men/homs/sq2/khalid/"
export const BILAL_PATH = "/men/homs/sq2/bilal/"
/** مسجدٌ تحت **مربعٍ شاغرٍ عمداً** — أميرُه أمينُ صندوقه، فالصرفُ من وحدته. */
export const OMAR_PATH = "/men/homs/sq7/omar/"
/** **المربعُ السابع: شاغرٌ عمداً** — لا مكلَّفَ عليه، فبه يُختبر صعودُ ق-٦٥/NESSA. */
export const VACANT_SQUARE_PATH = "/men/homs/sq7/"
export const HOMS_PATH = "/men/homs/"
export const CIRCLE_UNIT_PATH = "/men/homs/sq2/khalid/c1/"

export const DECISION: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
export const WRITE: DecisionContext = { ...DECISION, intent: "write" }

/** مراجعُ الحسابات **بياناً لا كوداً** (عقدُ الوحدة §٤) — يمرّرها المُركِّب. */
export const ACCOUNTS: PayrollAccounts = Object.freeze({
  salaryExpense: "expense.salaries",
  staffReceivable: "receivable.staff",
  cash: "cash",
})

export const SEEDED_TYPES = Object.freeze([
  { id: "tahfeez", ar: "تحفيظ" },
  { id: "baseera", ar: "على بصيرة" },
])

export function canonicalDirectory(personId: string): Actor | null {
  return buildCanonicalWorld().people.find((p) => p.personId === personId) ?? null
}

export function canonicalPeople(): readonly Actor[] {
  return buildCanonicalWorld().people
}

export function canonicalActor(personId: string): Actor {
  const actor = canonicalDirectory(personId)
  if (actor === null) throw new Error(`لا فاعلَ بهذا المعرّف في العالم القانونيّ: ${personId}`)
  return actor
}

export function routingContext(now: Date = NOW): RoutingContext {
  const people = canonicalPeople()
  return { now, people, holds: makeCapabilityCheck(people, DECISION) }
}

// ── الإعدادات ────────────────────────────────────────────────────────────────

/**
 * `finance.hourly_rate.amount` و`finance.fixed_salary.amount` **مسجَّلان بلا افتراضيّ عمداً**
 * (ق-م-٢) — فالبذرةُ تضبطهما صراحةً، **ولا يُخترع رقمٌ في الكود**. وغيابُهما حالةٌ تُختبر
 * وحدَها (سببُ الصفر `HOURLY_RATE_UNSET`).
 */
export const HOURLY_RATE = 400 as Cents
export const FIXED_SALARY = 10_000 as Cents

export function settingsWith(overrides: readonly SettingOverride[] = []) {
  return createSettingsResolver(overrides)
}

export function ratedSettings(extra: readonly SettingOverride[] = []) {
  return createSettingsResolver([
    { settingId: "finance.hourly_rate.amount", scopePath: "/", value: HOURLY_RATE, validFrom: FROM },
    { settingId: "finance.fixed_salary.amount", scopePath: "/", value: FIXED_SALARY, validFrom: FROM },
    ...extra,
  ])
}

// ── مستودعاتُ العالم ─────────────────────────────────────────────────────────

export type PayrollWorld = {
  readonly stores: PayrollStores
  readonly approval: ApprovalStore
  readonly circles: CirclesStore
  readonly education: EducationStore
  readonly log: CircleLogStore
  readonly circleId: string
  readonly tahfeezCircleId: string
}

function circlesContext(actorPersonId: string): CirclesContext {
  return { now: NOW, actorPersonId, reaches: makeScopeReach(canonicalDirectory, NOW) }
}

/** دفترٌ مبذورٌ بوحدات العالم القانونيّ وحساباته الثلاثة (مراجعُ بياناتٍ لا كود). */
export function seedLedger(tenantId: string): LedgerStore {
  const ledger = new LedgerStore(tenantId)
  for (const unit of buildCanonicalWorld().units) {
    ledger.saveUnit({ tenantId, id: unit.id, path: unit.path })
  }
  ledger.saveAccount({ tenantId, id: ACCOUNTS.cash, ar: "النقد", kind: "asset" })
  ledger.saveAccount({ tenantId, id: ACCOUNTS.salaryExpense, ar: "مصروف الرواتب", kind: "expense" })
  ledger.saveAccount({ tenantId, id: ACCOUNTS.staffReceivable, ar: "ذمم الكادر المدينة", kind: "asset" })
  ledger.saveAccount({ tenantId, id: "revenue.donations", ar: "إيراد التبرعات", kind: "revenue" })
  return ledger
}

export function seedWorld(tenantId: string = MAIN_TENANT_ID): PayrollWorld {
  const circles = new CirclesStore(tenantId)
  for (const unit of buildCanonicalWorld().units) {
    circles.saveUnit({ tenantId, id: unit.id, path: unit.path })
  }
  for (const type of SEEDED_TYPES) circles.saveType({ tenantId, id: type.id, ar: type.ar })

  const created = createCircle(circles, circlesContext("u-amir"), {
    unitId: "khalid",
    typeId: "baseera",
    nameAr: "حلقةُ على بصيرة",
    capacity: 20,
  })
  if (!created.ok) throw new Error(created.error.code)
  const assigned = assignTeacher(circles, circlesContext("u-amir"), {
    circleId: created.value.id,
    teacherPersonId: "u-teacher",
  })
  if (!assigned.ok) throw new Error(assigned.error.code)
  for (const nameAr of ["أحمد", "بلال"]) {
    const done = enroll(circles, circlesContext("u-amir"), { circleId: created.value.id, nameAr })
    if (!done.ok) throw new Error(done.error.code)
  }

  /** حلقةُ تحفيظٍ — **منهاجُها ليس مما يُحتسب بالساعة** (ق-٨٦): سببُ صفرٍ مختلفُ العلاج. */
  const second = createCircle(circles, circlesContext("u-amir"), {
    unitId: "khalid",
    typeId: "tahfeez",
    nameAr: "حلقةُ الحفظ",
    capacity: 10,
  })
  if (!second.ok) throw new Error(second.error.code)
  // **نفسُ المعلّم على الحلقتين** — فالفارقُ في الحصيلة يعود إلى **المنهاج وحده** لا إلى
  // اختلافِ معلّم: عزلُ المتغيّر شرطُ أن يقول الاختبارُ ما يدّعي أنه يقوله.
  const assignedSecond = assignTeacher(circles, circlesContext("u-amir"), {
    circleId: second.value.id,
    teacherPersonId: "u-teacher",
  })
  if (!assignedSecond.ok) throw new Error(assignedSecond.error.code)
  const done = enroll(circles, circlesContext("u-amir"), { circleId: second.value.id, nameAr: "سعد" })
  if (!done.ok) throw new Error(done.error.code)

  const education = new EducationStore(tenantId)
  education.saveCurriculum({ tenantId, id: "cur-baseera", ar: "منهاجُ على بصيرة", circleTypeId: "baseera" })
  education.saveLevel({ tenantId, id: "lvl-1", curriculumId: "cur-baseera", ar: "المستوى الأول", ordinal: 1 })
  education.saveBook({ tenantId, id: "book-1", levelId: "lvl-1", ar: "كتابُ التوحيد", ordinal: 1 })
  education.saveSession({ tenantId, id: "ses-1", bookId: "book-1", ar: "المجلسُ الأول", ordinal: 1 })
  education.saveSession({ tenantId, id: "ses-2", bookId: "book-1", ar: "المجلسُ الثاني", ordinal: 2 })
  // منهاجُ التحفيظ **مسجَّلٌ ويعمل** — لكنه **ليس في `edu.paid_hours.curricula`**: فالدرسُ
  // يُسجَّل ويُعتمد ولا يُحتسب مالياً (ق-٨٦). وهو ما يجعل «المنهاجُ لا يُحتسب» سبباً حقيقياً
  // مختلفاً عن «بلا اعتماد» — لا فرضيةً في الاختبار.
  education.saveCurriculum({ tenantId, id: "cur-tahfeez", ar: "منهاجُ التحفيظ", circleTypeId: "tahfeez" })
  education.saveLevel({ tenantId, id: "lvl-t", curriculumId: "cur-tahfeez", ar: "مستوى الحفظ", ordinal: 1 })
  education.saveBook({ tenantId, id: "book-t", levelId: "lvl-t", ar: "جزءُ عمّ", ordinal: 1 })
  education.saveSession({ tenantId, id: "ses-t", bookId: "book-t", ar: "مجلسُ الحفظ", ordinal: 1 })

  return {
    stores: { ledger: seedLedger(tenantId), payroll: new PayrollStore(tenantId) },
    approval: new ApprovalStore(tenantId),
    circles,
    education,
    log: new CircleLogStore(tenantId),
    circleId: created.value.id,
    tahfeezCircleId: second.value.id,
  }
}

// ── وصلُ ساعات المعلّم بالمصدر الحقيقيّ (ق-٨٦) ───────────────────────────────

function educationContextOf(
  world: PayrollWorld,
  approvedLessonIds: ReadonlySet<string>,
): EducationContext {
  const settings = settingsWith()
  const isLessonApproved = (lessonId: string): boolean => approvedLessonIds.has(lessonId)
  return {
    now: NOW,
    actorPersonId: "u-teacher",
    settings,
    ...makeCirclePorts(world.circles),
    isLessonApproved,
    days: circleDaysFrom({
      logStore: world.log,
      education: world.education,
      circles: circleModelFrom(world.circles),
      settings,
      isLessonApproved,
    })("u-teacher", NOW),
  }
}

/** يسجّل درساً حقيقياً ويعيد معرّفه — **الجلسةُ اليومية في موطنها** (CR-016). */
export function recordRealLesson(
  world: PayrollWorld,
  input: { sessionId: string; minutes: number; heldAt?: Date; circleId?: string },
): string {
  const circleId = input.circleId ?? world.circleId
  const outcome = recordLesson(world.education, educationContextOf(world, new Set()), {
    circleId,
    sessionId: input.sessionId,
    heldAt: input.heldAt ?? HELD_AT,
    durationMinutes: input.minutes,
    presentEnrollmentIds: world.circles
      .enrollments()
      .filter((e) => e.circleId === circleId)
      .map((e) => e.id),
  })
  if (!outcome.ok) throw new Error(outcome.error.code)
  return outcome.value.id
}

/**
 * **المنفذُ موصولٌ بالمصدر الحقيقيّ**: `approvedTeachingLoad` هي التي تفرز المعتمَد من
 * غيره وتُسقط المناهجَ غيرَ المؤهَّلة (ق-٨٦) — ونحن **نعدّ ما أسقطته لنشرح الصفر** (ع-٢٥).
 */
export function teachingLoadPort(world: PayrollWorld, approvedLessonIds: ReadonlySet<string>) {
  return (personId: string, from: Date, to: Date): TeachingLoad => {
    const ctx = educationContextOf(world, approvedLessonIds)
    const load = approvedTeachingLoad(world.education, ctx, { teacherPersonId: personId, from, to })
    const paid = load.ok ? load.value : null

    // ما لم يُحتسب ولماذا — **مقيسٌ من الجلسات نفسِها**، فالسببُ مشتقٌّ لا مزعوم.
    let unapproved = 0
    let unpaidCurriculum = 0
    for (const day of ctx.days.ofTeacher(personId)) {
      if (day.heldAt.getTime() < from.getTime() || day.heldAt.getTime() >= to.getTime()) continue
      const circle = ctx.circleOf(day.circleId)
      if (circle === null) continue
      if (circle.typeId !== "baseera") unpaidCurriculum += 1
      else if (!approvedLessonIds.has(day.id)) unapproved += 1
    }

    return {
      lessonCount: paid?.totalLessonCount ?? 0,
      minutes: paid?.totalMinutes ?? 0,
      lessonIds: paid === null ? [] : paid.lines.flatMap((l) => l.lessonIds),
      unapprovedLessonCount: unapproved,
      unpaidCurriculumLessonCount: unpaidCurriculum,
    }
  }
}

/** منفذُ نقاطٍ صريحٌ في الاختبار — موطنُ حسابها `dailyLog` (ق-٤١)، ونحن نستهلكه. */
export function pointsPort(table: Readonly<Record<string, ApprovedPoints>>) {
  return (unitPath: string): ApprovedPoints =>
    table[unitPath] ?? { points: 0, periodKeys: [], unapprovedPoints: 0 }
}

/** ق-٣٧ — مستفيدُ نقاط الوحدة أميرُها: يُقاس بإسناده **على الوحدة بعينها** لا باسم دور. */
export function beneficiaryPort(pairs: readonly (readonly [string, string])[]) {
  const set = new Set(pairs.map(([personId, unitPath]) => `${personId}|${unitPath}`))
  return (personId: string, unitPath: string): boolean => set.has(`${personId}|${unitPath}`)
}

// ── سياقُ الرواتب ────────────────────────────────────────────────────────────

export type ContextInput = {
  readonly world: PayrollWorld
  readonly actorPersonId?: string
  readonly now?: Date
  readonly settings?: ReturnType<typeof createSettingsResolver>
  readonly approvedLessonIds?: ReadonlySet<string>
  readonly points?: Readonly<Record<string, ApprovedPoints>>
  readonly beneficiaries?: readonly (readonly [string, string])[]
  readonly fixedSalaryPersonIds?: readonly string[]
  readonly seal?: SealPort
  readonly payingUnit?: (unitPath: string) => string | null
  readonly handover?: PayrollContext["handover"]
}

export function payrollContext(input: ContextInput): PayrollContext {
  const roster = input.fixedSalaryPersonIds
  return {
    now: input.now ?? NOW,
    settings: input.settings ?? ratedSettings(),
    actorPersonId: input.actorPersonId ?? "u-finance",
    teachingLoad: teachingLoadPort(input.world, input.approvedLessonIds ?? new Set()),
    approvedPoints: pointsPort(input.points ?? {}),
    isPointsBeneficiary: beneficiaryPort(input.beneficiaries ?? []),
    fixedSalaryRoster:
      roster === undefined ? rootAssignedRoster(canonicalPeople(), NOW) : () => roster,
    seal: input.seal ?? NO_SEAL,
    payingUnit: input.payingUnit ?? ((unitPath: string) => unitPath),
    accounts: ACCOUNTS,
    ...(input.handover === undefined ? {} : { handover: input.handover }),
  }
}
