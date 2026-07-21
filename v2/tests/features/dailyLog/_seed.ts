/**
 * بذرةُ عالم سجل اليوم — تُبنى على **العالم القانونيّ الواحد** (TESTING_POLICY §٥) فلا عالمَ
 * ثانٍ يتباعد: الوحداتُ والأشخاصُ من `tests/fixtures/canonical-world.ts` كما هم.
 *
 * وتُضاف هنا **بياناتُ الوحدة المرجعية وحدها**: مخطّطا الأنشطة (رجاليّ ونسائيّ) وكتالوجُهما.
 * وسلسلةُ وحداتٍ نسائيةٍ تعيش في **مستودع هذه الوحدة فقط** — لأنّ ق-٤٢ يُقاس على **النطاق**
 * (مخطّطٌ لكل نطاق) لا على فرعٍ جنسانيٍّ في الكود، فيلزم مسجدٌ في القسم النسائيّ يُسجَّل عليه.
 * **الفيكستشر الحاكم لم يُمسّ** (تغييرُه يتطلب مراجعة مدير البرنامج).
 */

import { DailyLogStore } from "../../../src/features/dailyLog/data/store.js"
import type { DailyLogContext } from "../../../src/features/dailyLog/services/context.js"
import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import { createSettingsResolver, type SettingOverride } from "../../../src/settings/resolver.js"
import type { Actor, DecisionContext } from "../../../src/authorization/can.js"

export const NOW = new Date("2026-07-20T00:00:00.000Z")
export const MAIN_TENANT_ID = "t-main"
/** الشبكةُ الثانية — بنفس المسارات النسبيّة عمداً، فيثبت العزلُ أنّ التطابق لا يسرّب (قب-١٨). */
export const SECOND_TENANT_ID = "t-aleppo"

export const KHALID = "khalid"
export const KHALID_PATH = "/men/homs/sq2/khalid/"
export const BILAL_PATH = "/men/homs/sq2/bilal/"
export const SQ2_PATH = "/men/homs/sq2/"
export const MEN_PATH = "/men/"

/** مسجدٌ في القسم النسائيّ — موجودٌ في مستودع هذه الوحدة وحدها (ق-٤٢). */
export const NOUR = "nour"
export const NOUR_PATH = "/women/aleppo/sq1/nour/"
const WOMEN_CHAIN: readonly { id: string; path: string }[] = [
  { id: "aleppo", path: "/women/aleppo/" },
  { id: "sq1", path: "/women/aleppo/sq1/" },
  { id: NOUR, path: NOUR_PATH },
]

/** مفاتيحُ زمنٍ محسوبةٌ بتوقيت الإعداد الافتراضيّ (دمشق) — تُكتب صراحةً كي يُقرأ الاختبار. */
export const TODAY = "2026-07-20"
export const WEEK = "2026-07-18"
export const LAST_WEEK = "2026-07-11"

/**
 * **مخطّطان بنفس الهدف** (ق-٤٢): لكلٍّ نطاقُه، والاختيارُ بأعمق نطاقٍ يحتوي الوحدة —
 * فلا سطرَ في الكود يذكر «رجال» أو «نساء».
 */
export const SCHEMES = [
  { id: "scheme-men", ar: "مخطّطُ أنشطة الشباب", scopePath: MEN_PATH, active: true },
  { id: "scheme-women", ar: "مخطّطُ الأنشطة النسائية", scopePath: "/women/", active: true },
]

/** الكتالوج **بياناتٌ مرجعية** تُبذَر ولا تُصلَّب في الكود (ب-٣٩ج/قب-١١). */
export const ACTIVITIES = [
  {
    id: "a-jamaah",
    schemeId: "scheme-men",
    activityId: "jamaah",
    ar: "صلاةُ الجماعة",
    weight: 1,
    maxPerDay: 1,
    requiresParticipation: true,
    active: true,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "a-lesson",
    schemeId: "scheme-men",
    activityId: "lesson",
    ar: "درسٌ في المسجد",
    weight: 5,
    maxPerDay: null,
    requiresParticipation: false,
    active: true,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "a-retired",
    schemeId: "scheme-men",
    activityId: "retired",
    ar: "نشاطٌ أُوقف",
    weight: 3,
    maxPerDay: null,
    requiresParticipation: false,
    active: false,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "a-dawah",
    schemeId: "scheme-women",
    activityId: "dawah",
    ar: "لقاءٌ دعويّ",
    weight: 2,
    maxPerDay: null,
    requiresParticipation: false,
    active: true,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
  },
]

export function seedDailyLogStore(tenantId: string = MAIN_TENANT_ID): DailyLogStore {
  const store = new DailyLogStore(tenantId)
  for (const u of buildCanonicalWorld().units) store.saveUnit({ tenantId, id: u.id, path: u.path })
  for (const u of WOMEN_CHAIN) store.saveUnit({ tenantId, id: u.id, path: u.path })
  for (const s of SCHEMES) store.saveScheme({ tenantId, ...s })
  for (const a of ACTIVITIES) store.saveActivity({ tenantId, ...a })
  return store
}

export const READ: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
export const WRITE: DecisionContext = { ...READ, intent: "write" }

export type ContextOptions = {
  readonly settings?: readonly SettingOverride[]
  readonly now?: Date
  /** منفذُ القفل — يُحقن ولا يُستنتج: الوحدةُ لا تعرف مَن أقفل ولا لماذا (G22). */
  readonly isPeriodLocked?: (unitPath: string, periodKey: string) => boolean
}

export function dailyLogContext(
  actorPersonId: string,
  options: ContextOptions = {},
): DailyLogContext {
  return {
    now: options.now ?? NOW,
    actorPersonId,
    settings: createSettingsResolver(options.settings ?? []),
    isPeriodLocked: options.isPeriodLocked ?? (() => false),
  }
}

/** فاعلٌ من العالم القانونيّ بمعرّفه — بلا نسخٍ لتعريفه هنا. */
export function canonicalActor(personId: string): Actor {
  const person = buildCanonicalWorld().people.find((p) => p.personId === personId)
  if (person === undefined) throw new Error(`لا شخص بهذا المعرّف في العالم القانوني: ${personId}`)
  return person
}

export function canonicalDirectory(personId: string): Actor | null {
  return buildCanonicalWorld().people.find((p) => p.personId === personId) ?? null
}

export function canonicalPeople(): readonly Actor[] {
  return buildCanonicalWorld().people
}
