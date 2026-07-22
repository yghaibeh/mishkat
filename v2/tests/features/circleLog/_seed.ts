/**
 * بذرةُ عالم السجلّ اليوميّ — تُبنى على **العالم القانونيّ الواحد** (TESTING_POLICY §٥)
 * وعلى **نموذج الحلقات الموحّد نفسِه** (ب-٢٨): الحلقةُ والطالبُ يُنشآن بمسار وحدة `circles`
 * المُعلَن — **لا نسخةَ ثانية هنا**، وهو بعينه ما يُثبت «التعلّق لا الاستنساخ».
 *
 * **حتميّ**: لحظةٌ مثبَّتة · معرّفاتٌ متتابعة · رمزٌ من مولّدٍ محقونٍ متتابع — لا عشوائيّة.
 */

import { CirclesStore } from "../../../src/features/circles/data/store.js"
import { createCircle, assignTeacher } from "../../../src/features/circles/services/circles.js"
import { enroll } from "../../../src/features/circles/services/enrollment.js"
import { makeScopeReach } from "../../../src/features/circles/services/directory.js"
import { CircleLogStore } from "../../../src/features/circleLog/data/store.js"
import { circleModelFrom } from "../../../src/features/circleLog/services/circlesPort.js"
import {
  NEVER_LOCKED,
  RECITATION_SHAPE_ONLY,
  type SessionLockPort,
  type SessionShapePort,
} from "../../../src/features/circleLog/services/sessionShape.js"
import type { CircleLogContext } from "../../../src/features/circleLog/services/context.js"
import { createSettingsResolver, type SettingOverride } from "../../../src/settings/resolver.js"
import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import type { Actor, DecisionContext } from "../../../src/authorization/can.js"

export const MAIN_TENANT_ID = "t-main"
export const SECOND_TENANT_ID = "t-second"

/** لحظةُ العالم المثبَّتة — كلُّ تاريخٍ في الاختبارات مشتقٌّ منها. */
export const NOW = new Date("2026-07-22T09:00:00.000Z")

export const ROOT_SCOPE_PATH = "/"
export const MEN_PATH = "/men/"
export const HOMS_PATH = "/men/homs/"
export const SQ2_PATH = "/men/homs/sq2/"
export const KHALID_PATH = "/men/homs/sq2/khalid/"
export const BILAL_PATH = "/men/homs/sq2/bilal/"

export const DECISION: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
export const WRITE: DecisionContext = { ...DECISION, intent: "write" }

/** أنواعُ الحلقات — **بياناتٌ** من كتالوج T16 نفسِه (لا معجمَ أنواعٍ ثانٍ — CR-014). */
export const SEEDED_TYPES: readonly { readonly id: string; readonly ar: string }[] = Object.freeze([
  { id: "tahfeez", ar: "تحفيظ" },
  { id: "baseera", ar: "على بصيرة" },
  { id: "scientific", ar: "علمية" },
  { id: "rashidi", ar: "الرشيدي" },
])

/**
 * كتالوجُ المصحف — **صفوفٌ مرجعية** (ق-٨٩/قب-٢٢): عددُ الآيات وعددُ الصفحات **بياناتٌ**،
 * ولذلك لا قائمةَ سورٍ في مصدر الوحدة ولا رقمَ صلبٌ فيه (G14).
 */
export const SEEDED_SURAHS: readonly { readonly id: string; readonly ar: string; readonly ayahCount: number }[] =
  Object.freeze([
    { id: "001", ar: "الفاتحة", ayahCount: 7 },
    { id: "002", ar: "البقرة", ayahCount: 286 },
    { id: "114", ar: "الناس", ayahCount: 6 },
  ])

export const MUSHAF_ID = "hafs"
export const MUSHAF_PAGES = 604

/** دليلُ الفاعلين — العالمُ القانونيّ نفسُه، فلا نسخةَ أشخاصٍ ثانية. */
export function canonicalDirectory(personId: string): Actor | null {
  return buildCanonicalWorld().people.find((p) => p.personId === personId) ?? null
}

export function canonicalActor(personId: string): Actor {
  const actor = canonicalDirectory(personId)
  if (actor === null) throw new Error(`لا فاعلَ بهذا المعرّف في العالم القانونيّ: ${personId}`)
  return actor
}

/**
 * **محفّظٌ مُسنَدٌ على المسجد نفسِه** — تكوينٌ ميدانيٌّ مشروعٌ نصاً (ع-٤/ع-٢٧: «أميرُ المسجد
 * يضيف محفّظاً لمسجده»). لازمٌ لبابِ رابط وليّ الأمر: `guardianLink.manage` نطاقُها «ذ»
 * (مطابقةٌ تامّة) فلا يبلغها مَن أُسنِد على وحدةٍ **أعمقَ** من الحلقة.
 */
export const MOSQUE_TEACHER_ID = "u-teacher-mosque"

export function mosqueTeacher(): Actor {
  return {
    personId: MOSQUE_TEACHER_ID,
    accountStatus: "active",
    sessionEpoch: 1,
    currentSessionEpoch: 1,
    assignments: [
      {
        roleId: "teacher",
        scopePath: KHALID_PATH,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: null,
        approvalStatus: "approved",
        unitArchived: false,
      },
    ],
    overrides: [],
  }
}

/** دليلٌ يضمّ العالمَ القانونيّ **ومحفّظَ المسجد** — لا يُعدَّل العالمُ القانونيّ نفسُه. */
export function directoryWithMosqueTeacher(personId: string): Actor | null {
  if (personId === MOSQUE_TEACHER_ID) return mosqueTeacher()
  return canonicalDirectory(personId)
}

export function circlesContext(actorPersonId: string) {
  return {
    now: NOW,
    actorPersonId,
    reaches: makeScopeReach(directoryWithMosqueTeacher, NOW),
  }
}

/** مستودعُ الحلقات مبذوراً بإسقاط وحدات العالم القانونيّ وكتالوج الأنواع. */
export function seedCirclesStore(tenantId: string = MAIN_TENANT_ID): CirclesStore {
  const store = new CirclesStore(tenantId)
  for (const unit of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId, id: unit.id, path: unit.path })
  }
  for (const type of SEEDED_TYPES) store.saveType({ tenantId, id: type.id, ar: type.ar })
  return store
}

/** مستودعُ السجلّ مبذوراً بكتالوج المصحف المرجعيّ. */
export function seedLogStore(tenantId: string = MAIN_TENANT_ID): CircleLogStore {
  const store = new CircleLogStore(tenantId)
  for (const s of SEEDED_SURAHS) store.saveSurah({ tenantId, ...s })
  store.saveMushaf({ tenantId, id: MUSHAF_ID, ar: "مصحف المدينة", pageCount: MUSHAF_PAGES })
  return store
}

export type World = {
  readonly circles: CirclesStore
  readonly log: CircleLogStore
  readonly circleId: string
  readonly otherCircleId: string
  readonly studentA: string
  readonly studentB: string
}

/**
 * عالمُ الاختبارات: حلقةٌ في مسجد خالد **مُسنَدةٌ إلى المعلّم** وفيها طالبان،
 * وحلقةٌ ثانية في مسجد بلال بلا معلّم — تُنشآن **بمسار T16 المُعلَن** لا بحقنٍ في مستودع.
 */
export function seedWorld(tenantId: string = MAIN_TENANT_ID): World {
  const circles = seedCirclesStore(tenantId)
  const log = seedLogStore(tenantId)

  const created = createCircle(circles, circlesContext("u-amir"), {
    unitId: "khalid",
    typeId: "tahfeez",
    nameAr: "حلقةُ الفجر",
    capacity: 20,
  })
  if (!created.ok) throw new Error(`تعذّر إنشاءُ الحلقة: ${created.error.code}`)
  const circleId = created.value.id

  const assigned = assignTeacher(circles, circlesContext("u-amir"), {
    circleId,
    teacherPersonId: MOSQUE_TEACHER_ID,
  })
  if (!assigned.ok) throw new Error(`تعذّر إسنادُ المعلّم: ${assigned.error.code}`)

  const other = createCircle(circles, circlesContext("u-amir-bilal"), {
    unitId: "bilal",
    typeId: "baseera",
    nameAr: "حلقةُ بلال",
    capacity: 10,
  })
  if (!other.ok) throw new Error(`تعذّر إنشاءُ الحلقة الثانية: ${other.error.code}`)

  return {
    circles,
    log,
    circleId,
    otherCircleId: other.value.id,
    studentA: enrolledId(circles, circleId, "عبد الله"),
    studentB: enrolledId(circles, circleId, "معاذ"),
  }
}

function enrolledId(circles: CirclesStore, circleId: string, nameAr: string): string {
  const done = enroll(circles, circlesContext("u-amir"), { circleId, nameAr })
  if (!done.ok) throw new Error(`تعذّر إلحاقُ الطالب: ${done.error.code}`)
  return done.value.id
}

/** مولّدُ رموزٍ **متتابعٌ حتميّ** — لا عشوائيّة في الاختبار (TESTING_POLICY §٥). */
export function sequentialTokens(): () => string {
  let n = 0
  return () => {
    n += 1
    return `tok-${n}`
  }
}

export function logContext(
  world: World,
  actorPersonId: string,
  options: {
    readonly now?: Date
    readonly overrides?: readonly SettingOverride[]
    readonly newToken?: () => string
    readonly shape?: SessionShapePort
    readonly isSessionLocked?: SessionLockPort
  } = {},
): CircleLogContext {
  return {
    now: options.now ?? NOW,
    actorPersonId,
    settings: createSettingsResolver(options.overrides ?? []),
    circles: circleModelFrom(world.circles),
    newToken: options.newToken ?? sequentialTokens(),
    // CR-016 — **التركيبُ الأدنى**: بذرةٌ بلا كتالوج مناهجَ ⇒ كلُّ جلساتها تحفيظ، ولا مُقفِل.
    shape: options.shape ?? RECITATION_SHAPE_ONLY,
    isSessionLocked: options.isSessionLocked ?? NEVER_LOCKED,
  }
}

/** ضبطُ إعدادٍ عالميٍّ للاختبار — **الرقمُ يعيش في السجل لا في الكود** (قب-٦). */
export function globalOverride(settingId: string, value: SettingOverride["value"]): SettingOverride {
  return {
    settingId,
    scopePath: ROOT_SCOPE_PATH,
    value,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
    id: `ov-${settingId}`,
  }
}
