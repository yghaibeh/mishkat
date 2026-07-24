/**
 * بذرةُ عالم المسابقة — تُبنى على **العالم القانونيّ الواحد** (TESTING_POLICY §٥)، فلا عالمَ
 * ثانٍ يتباعد. تُضاف هنا إسقاطاتُ الوحدات وحدَها — **ولا رقمَ مبذور ولا رصيدٌ**: كلُّ نقطةٍ
 * ورتبةٍ اشتقاقٌ من الأحداث المخزَّنة (عقدُ الوحدة §٧، ق-٩٢).
 *
 * **حتميّ**: لحظةٌ مثبَّتة ومعرّفاتٌ متتابعة — لا عشوائيّة ولا ساعةَ زمن-تشغيل.
 */

import { CompetitionStore } from "../../../src/features/competition/data/store.js"
import type { CompetitionContext } from "../../../src/features/competition/services/context.js"
import {
  advanceStatus,
  createCompetition,
} from "../../../src/features/competition/services/competitions.js"
import { defineScoringType } from "../../../src/features/competition/services/catalog.js"
import { addByLeader } from "../../../src/features/competition/services/enrollment.js"
import type {
  Competition,
  CompetitionStatus,
  Contestant,
  ScoringEventType,
  ScoringValueKind,
} from "../../../src/features/competition/types.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import type { Actor, DecisionContext } from "../../../src/authorization/can.js"

export const MAIN_TENANT_ID = "t-main"
export const SECOND_TENANT_ID = "t-second"

/** لحظةُ العالم المثبَّتة — كلُّ تاريخٍ في الاختبارات مشتقٌّ منها. */
export const NOW = new Date("2026-07-24T09:00:00.000Z")
export const DAY_MS = 24 * 60 * 60 * 1000

export const ROOT_SCOPE_PATH = "/"
export const MEN_PATH = "/men/"
export const WOMEN_PATH = "/women/"
export const HOMS_PATH = "/men/homs/"
export const SQ2_PATH = "/men/homs/sq2/"
export const KHALID_PATH = "/men/homs/sq2/khalid/"
export const BILAL_PATH = "/men/homs/sq2/bilal/"
export const OMAR_PATH = "/men/homs/sq7/omar/"

/**
 * **مفاتيحُ التفعيل في عالم الاختبار = المسجَّلةُ وحدَها**: `feature.competition_public_registration`
 * مسجَّلٌ في السجل فيُفتح هنا؛ و`competition_teams` و`unit_subject` **غيرُ مسجَّلَين** (⟵
 * `CR-DRAFT-competition-settings`) فيبقيان **مطفأَين حتماً** — إذ **مفتاحٌ لا وجودَ له لا يُشعَل**.
 */
const REGISTERED_FLAGS: readonly string[] = ["feature.competition_public_registration"]

export function defaultFlags(flag: string): boolean {
  return REGISTERED_FLAGS.includes(flag)
}

export function decisionContext(
  enabled: (flag: string) => boolean = defaultFlags,
): DecisionContext {
  return { now: NOW, intent: "read", isFeatureEnabled: enabled }
}

export const DECISION: DecisionContext = decisionContext()
export const WRITE: DecisionContext = { ...DECISION, intent: "write" }

/** دليلُ الفاعلين — العالمُ القانونيّ نفسُه، فلا نسخةَ أشخاصٍ ثانية. */
export function canonicalActor(personId: string): Actor {
  const actor = buildCanonicalWorld().people.find((p) => p.personId === personId)
  if (actor === null || actor === undefined) {
    throw new Error(`لا فاعلَ بهذا المعرّف في العالم القانونيّ: ${personId}`)
  }
  return actor
}

/**
 * مستودعٌ مبذورٌ بإسقاط وحدات العالم القانونيّ — **قراءةٌ لا نسخةُ حقيقة**: الوحدةُ موطنُها
 * `org`، وهذا إسقاطُها الذي يحتاجه مُحلِّلُ النطاق هنا (ADR-001 §٥).
 */
export function seedCompetitionStore(tenantId: string = MAIN_TENANT_ID): CompetitionStore {
  const store = new CompetitionStore(tenantId)
  for (const unit of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId, id: unit.id, path: unit.path, type: unit.type })
  }
  return store
}

/** سياقُ الخدمات — **الساعةُ والإعداداتُ تُحقن ولا تُستورد** (TESTING_POLICY §٥). */
export function competitionContext(
  actorPersonId: string,
  over: Partial<CompetitionContext> = {},
): CompetitionContext {
  return {
    now: NOW,
    actorPersonId,
    settings: createSettingsResolver([]),
    isFeatureEnabled: defaultFlags,
    ...over,
  }
}

/** نافذةُ تسجيلٍ مفتوحةٌ حول اللحظة المثبَّتة — بلا رقمٍ صلبٍ في الوحدة نفسِها. */
export const WINDOW_OPENS = new Date(NOW.getTime() - 30 * DAY_MS)
export const WINDOW_CLOSES = new Date(NOW.getTime() + 30 * DAY_MS)

export const START_MONTH = "1447-07"
export const END_MONTH = "1448-07"
export const PERIOD = "1447-08"

/**
 * **مسابقةٌ نموذجيّةٌ تُنشأ بالمسار المُعلَن** لا بحقنٍ في المستودع — فما تختبره الأسطرُ التالية
 * هو ما يمرّ به المستخدم. وتُترك في حالة `enrolling` أو تُدفع أماميّاً بحسب الطلب.
 */
export function seedCompetition(
  store: CompetitionStore,
  input: {
    readonly unitId?: string
    readonly titleAr?: string
    readonly actorPersonId?: string
    readonly publicRegistration?: boolean
    readonly advanceTo?: readonly CompetitionStatus[]
  } = {},
): Competition {
  const ctx = competitionContext(input.actorPersonId ?? "u-rabita")
  const created = createCompetition(store, ctx, {
    unitId: input.unitId ?? "homs",
    titleAr: input.titleAr ?? "مسابقةُ المسجد المؤثّر",
    startMonthHijri: START_MONTH,
    endMonthHijri: END_MONTH,
    enrollmentOpensAt: WINDOW_OPENS,
    enrollmentClosesAt: WINDOW_CLOSES,
    publicRegistration: input.publicRegistration ?? true,
  })
  if (!created.ok) throw new Error(`تعذّر إنشاءُ المسابقة: ${created.error.code}`)
  let current = created.value
  for (const to of input.advanceTo ?? ["enrolling"]) {
    const moved = advanceStatus(store, ctx, { competitionId: current.id, to })
    if (!moved.ok) throw new Error(`تعذّر الانتقالُ إلى ${to}: ${moved.error.code}`)
    current = moved.value
  }
  return current
}

/** نوعُ تنقيطٍ نموذجيّ — صفٌّ في الكتالوج، **بلا سطر كودٍ خاصٍّ به** (العقدُ الأمّ §٢-٤). */
export function seedScoringType(
  store: CompetitionStore,
  competitionId: string,
  over: {
    readonly key?: string
    readonly valueKind?: ScoringValueKind
    readonly weight?: number
    readonly maxPerPeriod?: number
  } = {},
): ScoringEventType {
  const done = defineScoringType(store, competitionContext("u-rabita"), {
    competitionId,
    key: over.key ?? "monthly_program",
    titleAr: "البرنامجُ الشهريّ",
    track: "تعبدي",
    valueKind: over.valueKind ?? "count",
    weight: over.weight ?? 10,
    period: "hijri_month",
    excusable: true,
    ...(over.maxPerPeriod === undefined ? {} : { maxPerPeriod: over.maxPerPeriod }),
  })
  if (!done.ok) throw new Error(`تعذّر تعريفُ نوع التنقيط: ${done.error.code}`)
  return done.value
}

/** متبارٍ جاهزٌ عبر **مسار القائد المباشر** — أقصرُ طريقٍ مُعلَنٍ إلى متبارٍ مشارك. */
export function seedContestant(
  store: CompetitionStore,
  input: {
    readonly competitionId: string
    readonly mosquePath?: string
    readonly nameAr?: string
    readonly phone?: string
    readonly actorPersonId?: string
  },
): Contestant {
  const done = addByLeader(store, competitionContext(input.actorPersonId ?? "u-amir"), {
    competitionId: input.competitionId,
    mosquePath: input.mosquePath ?? KHALID_PATH,
    nameAr: input.nameAr ?? "أحمدُ بنُ عبد الله",
    phone: input.phone ?? "0900000001",
    birthDate: new Date("2004-01-01T00:00:00.000Z"),
  })
  if (!done.ok) throw new Error(`تعذّرت إضافةُ المتبارِي: ${done.error.code}`)
  return done.value
}
