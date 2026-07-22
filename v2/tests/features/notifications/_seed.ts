/**
 * بذرةُ عالم الإشعارات — مشتقّةٌ من **العالم القانونيّ الواحد** (TESTING_POLICY §٥) فلا عالمَ
 * ثانٍ يتباعد. تُضيف ما تحتاجه هذه الوحدة وحدها: **كتالوجَ أنواع الإشعار** (بياناتٌ مرجعية —
 * قب-٢٢) و**منفذَي الإسناد المعلنَين** (عقدُ الوحدة §٢ و§٥).
 *
 * **المنفذُ ساذجٌ عمداً**: `assignedAt` يعيد **كلَّ** من يحمل إسناداً عند المسار — بمنتهي
 * التكليف والمعلَّقِ فيه — لأنّ **الحكمَ للمحرّك لا للمنفذ** (ق-٢٥ في عقد الوحدة §٢.١).
 * منفذٌ «مهذَّب» يرشّح بنفسه يجعل اختبارَ ق-٢٥ يقيس المنفذَ بدل أن يقيس المحرّك.
 */

import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import { NotificationStore } from "../../../src/features/notifications/data/store.js"
import { makeCapabilityAnswer } from "../../../src/features/notifications/services/targeting.js"
import type { NotificationContext } from "../../../src/features/notifications/services/context.js"
import type { NotificationPorts } from "../../../src/features/notifications/services/ports.js"
import { createSettingsResolver, type SettingOverride } from "../../../src/settings/resolver.js"
import type { Actor, DecisionContext } from "../../../src/authorization/can.js"

export const NOW = new Date("2026-07-20T00:00:00.000Z")
export const MAIN_TENANT_ID = "t-main"
/** الشبكةُ الثانية — بنفس المسارات النسبيّة عمداً، فيثبت العزلُ أنّ التطابق لا يسرّب (قب-١٨). */
export const SECOND_TENANT_ID = "t-aleppo"

export const DECISION: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
export const WRITE: DecisionContext = { ...DECISION, intent: "write" }

/** مساراتُ العالم القانونيّ المستعملة هنا. */
export const SECTION_PATH = "/men/"
export const REGION_PATH = "/men/homs/"
export const SQUARE_PATH = "/men/homs/sq2/"
export const KHALID_PATH = "/men/homs/sq2/khalid/"
export const BILAL_PATH = "/men/homs/sq2/bilal/"
export const OMAR_PATH = "/men/homs/sq7/omar/"

/**
 * عمرُ رمز الربط مضبوطٌ للاختبار — الإعدادُ **مسجَّلٌ بلا افتراضيٍّ عمداً** (ق-م-٢)،
 * فغيابُ الضبط حالةٌ تُختبر (`LINK_TTL_UNSET`) لا حالةٌ تُتفادى.
 */
export const TTL_MINUTES = 15
export const LINK_TTL: SettingOverride = {
  settingId: "notify.telegram_link_ttl_minutes",
  scopePath: "/",
  value: TTL_MINUTES,
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
}

export function ttlOverride(minutes: number): SettingOverride {
  return { ...LINK_TTL, value: minutes }
}

export function channelsOverride(channels: readonly string[]): SettingOverride {
  return {
    settingId: "notify.channels.enabled",
    scopePath: "/",
    value: channels,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
  }
}

/**
 * كتالوجُ أنواع الإشعار — **بياناتٌ مرجعية** تُبذَر ولا تُصلَّب (قب-٢٢/G14).
 * وليس فيه — ولا يمكن أن يكون فيه — نوعٌ محفّزُه «إدخالٌ يوميّ» (ق-١١، §٦ من العقد).
 */
export const KINDS = [
  { id: "record.submitted", ar: "سجلٌّ قُدِّم وينتظر بتَّ طبقته", trigger: "submission" as const, active: true },
  { id: "visit.due", ar: "زيارةٌ ميدانيةٌ مستحقّة", trigger: "reminder" as const, active: true },
  { id: "library.overdue", ar: "مادةٌ إلزاميةٌ متأخرة", trigger: "reminder" as const, active: true },
  { id: "action.outcome", ar: "نتيجةُ فعلك", trigger: "outcome" as const, active: true },
  { id: "announcement.published", ar: "إعلانٌ جديدٌ على نطاقك", trigger: "announcement" as const, active: true },
  { id: "retired.kind", ar: "نوعٌ أُوقف", trigger: "reminder" as const, active: false },
]

export function seedNotificationStore(tenantId: string = MAIN_TENANT_ID): NotificationStore {
  const store = new NotificationStore(tenantId)
  for (const u of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId, id: u.id, ar: u.ar, path: u.path })
  }
  for (const k of KINDS) store.saveKind({ tenantId, ...k })
  return store
}

/** فاعلٌ من العالم القانونيّ بمعرّفه — بلا نسخٍ لتعريفه هنا. */
export function canonicalActor(personId: string): Actor {
  const person = buildCanonicalWorld().people.find((p) => p.personId === personId)
  if (person === undefined) throw new Error(`لا شخص بهذا المعرّف في العالم القانوني: ${personId}`)
  return person
}

/** كلُّ مَن يحمل إسناداً **عند هذا المسار بعينه** — وقائعُ خامّ بلا ترشيحٍ زمنيّ (عمداً). */
export function assignedAtCanonical(scopePath: string): readonly Actor[] {
  return buildCanonicalWorld().people.filter((p) =>
    p.assignments.some((a) => a.scopePath === scopePath),
  )
}

/** مواضعُ إسناد الشخص — أساسُ الحقّ المشتقّ في قراءة إعلانات نطاقه (ح-٥ · §٢.١٣). */
export function assignmentScopesCanonical(personId: string): readonly string[] {
  const person = buildCanonicalWorld().people.find((p) => p.personId === personId)
  return person === undefined ? [] : person.assignments.map((a) => a.scopePath)
}

export type PortOverrides = Partial<NotificationPorts>

export function notificationPorts(over: PortOverrides = {}): NotificationPorts {
  return {
    assignedAt: assignedAtCanonical,
    assignmentScopesOf: assignmentScopesCanonical,
    ...over,
  }
}

export function notificationContext(
  actorPersonId: string,
  over: {
    readonly ports?: PortOverrides
    readonly settings?: readonly SettingOverride[]
    readonly now?: Date
    readonly decision?: DecisionContext
  } = {},
): NotificationContext {
  const decision = over.decision ?? DECISION
  return {
    now: over.now ?? NOW,
    actorPersonId,
    settings: createSettingsResolver(over.settings ?? [LINK_TTL]),
    holdsCapability: makeCapabilityAnswer(decision),
    ports: notificationPorts(over.ports ?? {}),
  }
}

/** حمولةٌ مهيكلةٌ صالحة — الاختباراتُ تكسر منها حقلاً واحداً فتُظهر الحارس (ق-٧٥). */
export function payload(over: Record<string, unknown> = {}) {
  return {
    summaryAr: "سجلُّ مسجد خالد للأسبوع ٢٩ ينتظر بتَّك",
    amount: null,
    outcomeAr: null,
    reasonAr: null,
    ...over,
  }
}

/**
 * حدثٌ صحيحٌ كامل — جمهورُه **الطبقةُ الأقرب** التي يصلنا نطاقُها بياناً من المُصدِّر (§٢).
 * والقدرةُ `report.view` قدرةُ اطّلاعٍ مقصودةٌ هنا: هذه الوحدةُ **لا تسمّي قدرةَ بتٍّ** (G22).
 *
 * **ومستهدَفوه اثنان** في العالم القانونيّ (`u-square` و`u-granted` — كلاهما مكلَّفٌ عند
 * المربع الثاني): وهذا **مقصودٌ لا عارض**، فيُختبر التوزيعُ على أكثر من واحدٍ ومفتاحُ كلٍّ.
 */
export const SQUARE_LAYER_TARGETS = ["u-granted", "u-square"] as const

export function submissionEvent(over: Record<string, unknown> = {}) {
  return {
    kindId: "record.submitted",
    refId: "khalid|w29",
    windowKey: "w29",
    audience: {
      mode: "capabilityOnScope" as const,
      scopePath: SQUARE_PATH,
      capability: "report.view" as const,
    },
    payload: payload(),
    ...over,
  }
}

/**
 * حدثٌ **لشخصٍ بعينه** — تُستعمل في اختبارات الطابور والقنوات كي يُقاس المفتاحُ الطبيعيُّ
 * وسطورُ التسليم على مستهدَفٍ واحدٍ معلوم، بلا خلطٍ مع توزيع الجمهور (كلُّ اختبارٍ ثابتَه).
 */
export function personEvent(personId = "u-square", over: Record<string, unknown> = {}) {
  return {
    kindId: "action.outcome",
    refId: "act-1",
    windowKey: "w29",
    audience: { mode: "person" as const, personId },
    payload: payload({ summaryAr: "نتيجةُ فعلك وصلت" }),
    ...over,
  }
}
