/**
 * بذرةُ عالم الزيارات الإشرافية — تُبنى على **العالم القانونيّ الواحد** (TESTING_POLICY §٥)
 * فلا عالمَ ثانٍ يتباعد: الوحداتُ والأشخاصُ من `tests/fixtures/canonical-world.ts` كما هم،
 * **والفيكستشر الحاكم لم يُمسّ** (تغييرُه يتطلب مراجعة مدير البرنامج).
 *
 * ويُضاف هنا **إسقاطُ أهداف الزيارة وحدَه** (ب-٢٨: كيانُ الحلقة موطنُه وحدتُه المتسلسلة، وهنا
 * مسارٌ ونوعُ منهاجٍ لا أكثر): ثلاثةُ أهدافٍ تحت المربع الثاني **المكلَّف**، وهدفٌ تحت المربع
 * السابع **الشاغر عمداً** — فتُقاس عليه دورةُ NESSA والتغطيةُ الصفرية معاً.
 */

import { SupervisionStore } from "../../../src/features/supervision/data/store.js"
import type { SupervisionContext } from "../../../src/features/supervision/services/context.js"
import type { VisitVerdict } from "../../../src/features/supervision/types.js"
import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import { createSettingsResolver, type SettingOverride } from "../../../src/settings/resolver.js"
import type { Actor, DecisionContext } from "../../../src/authorization/can.js"

export const NOW = new Date("2026-07-20T09:00:00.000Z")
export const MAIN_TENANT_ID = "t-main"
/** الشبكةُ الثانية — بنفس المسارات النسبيّة عمداً، فيثبت العزلُ أنّ التطابق لا يسرّب (قب-١٨). */
export const SECOND_TENANT_ID = "t-aleppo"

export const MEN_PATH = "/men/"
export const HOMS_PATH = "/men/homs/"
export const SQ2_PATH = "/men/homs/sq2/"
export const SQ7_PATH = "/men/homs/sq7/"
export const KHALID_PATH = "/men/homs/sq2/khalid/"
export const BILAL_PATH = "/men/homs/sq2/bilal/"
export const OMAR_PATH = "/men/homs/sq7/omar/"

/** أهدافُ الزيارة — حلقاتٌ بمنهاجَيها (ق-١٠٠)، إسقاطاً قرائياً لا موطناً. */
export const C1 = "c1"
export const C1_PATH = "/men/homs/sq2/khalid/c1/"
export const C1B = "c1b"
export const C1B_PATH = "/men/homs/sq2/khalid/c1b/"
export const C3 = "c3"
export const C3_PATH = "/men/homs/sq2/bilal/c3/"
export const C2 = "c2"
export const C2_PATH = "/men/homs/sq7/omar/c2/"
/** هدفٌ موقوفٌ — الإيقافُ حالةٌ في البيانات لا حذف (المادة ٧/٤). */
export const C_RETIRED = "c-retired"
export const C_RETIRED_PATH = "/men/homs/sq2/bilal/c-retired/"

export const TARGETS = [
  { id: C1, path: C1_PATH, curriculum: "tahfeez", active: true },
  { id: C1B, path: C1B_PATH, curriculum: "baseera", active: true },
  { id: C3, path: C3_PATH, curriculum: "tahfeez", active: true },
  { id: C2, path: C2_PATH, curriculum: "baseera", active: true },
  { id: C_RETIRED, path: C_RETIRED_PATH, curriculum: "tahfeez", active: false },
] as const

/** نواةُ زيارةٍ صالحة — تُشترك فيها الزيارتان (ق-١٠٠). */
export const CORE = { attendees: 12, ratingPct: 80, noteAr: "حلقةٌ منتظمة" }

/** حقولُ نوع التحفيظ كما يعلنها العقد (§٢) — تُكتب هنا صراحةً كي يُقرأ الاختبار. */
export const TAHFEEZ_DETAILS = {
  quranPlan: 90,
  teacherMemorization: 85,
  tajweed: 70,
  records: 100,
  ethics: 95,
  attendanceDiscipline: 75,
}

/** وحقولُ «على بصيرة» — مختلفةٌ عنها اسماً وعدداً. */
export const BASEERA_DETAILS = {
  lessonNumber: 12,
  recentActivities: 4,
  attendanceCount: 18,
}

export function seedSupervisionStore(tenantId: string = MAIN_TENANT_ID): SupervisionStore {
  const store = new SupervisionStore(tenantId)
  for (const u of buildCanonicalWorld().units) store.saveUnit({ tenantId, id: u.id, path: u.path })
  for (const t of TARGETS) store.saveTarget({ tenantId, ...t })
  return store
}

export const READ: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
export const WRITE: DecisionContext = { ...READ, intent: "write" }

/** حُكمٌ افتراضيّ: معلَّقٌ بلا معتمِد — فالاسمُ لا يُخترع حين لا يكون (ق-١٠٢). */
export const PENDING_VERDICT: VisitVerdict = { approved: false, approvedByPersonId: null }

/**
 * **المسؤولُ عن الوحدة** منفذٌ محقون: يُشتقّ هنا من إسنادات العالم القانونيّ — فلا تعرف
 * الوحدةُ إسناداً ولا دوراً (G6). والمربعُ السابع **شاغرٌ عمداً** فجوابُه `null`.
 */
export function canonicalResponsibleOf(unitPath: string): string | null {
  const person = buildCanonicalWorld().people.find((p) =>
    p.assignments.some(
      (a) => a.scopePath === unitPath && a.approvalStatus === "approved" && a.endDate === null,
    ),
  )
  return person?.personId ?? null
}

export type ContextOptions = {
  readonly settings?: readonly SettingOverride[]
  readonly now?: Date
  /** منفذُ الحكم — يُحقن ولا يُستنتج: الوحدةُ تعرف الحُكمَ ولا تعرف السلسلة (G22). */
  readonly verdictOf?: (visitId: string) => VisitVerdict
  readonly responsibleOf?: (unitPath: string) => string | null
  /** مساراتُ إسناد الفاعل الفعّالة — مساراتٌ لا أدوار. */
  readonly scopePaths?: readonly string[]
}

export function supervisionContext(
  actorPersonId: string,
  options: ContextOptions = {},
): SupervisionContext {
  return {
    now: options.now ?? NOW,
    actorPersonId,
    settings: createSettingsResolver(options.settings ?? []),
    verdictOf: options.verdictOf ?? (() => PENDING_VERDICT),
    responsibleOf: options.responsibleOf ?? canonicalResponsibleOf,
    actorScopePaths: options.scopePaths ?? scopePathsOf(actorPersonId),
  }
}

/** مساراتُ الشخص من العالم القانونيّ — بلا نسخِ تعريفٍ هنا. */
export function scopePathsOf(personId: string): readonly string[] {
  const person = buildCanonicalWorld().people.find((p) => p.personId === personId)
  if (person === undefined) return []
  return person.assignments
    .filter((a) => a.approvalStatus === "approved" && a.endDate === null)
    .map((a) => a.scopePath)
}

export function canonicalActor(personId: string): Actor {
  const person = buildCanonicalWorld().people.find((p) => p.personId === personId)
  if (person === undefined) throw new Error(`لا شخص بهذا المعرّف في العالم القانوني: ${personId}`)
  return person
}

export function canonicalPeople(): readonly Actor[] {
  return buildCanonicalWorld().people
}
