/**
 * بذرةُ عالم الحلقات — تُبنى على **العالم القانونيّ الواحد** (TESTING_POLICY §٥)، فلا عالمَ
 * ثانٍ يتباعد. تُضاف هنا إسقاطاتُ الوحدات وكتالوجُ أنواعٍ نموذجيّ وحدهما — **ولا عددَ مبذور**:
 * كلُّ رقمٍ اشتقاقٌ من المصدر الواحد (عقدُ الوحدة §٦).
 *
 * **حتميّ**: لحظةٌ مثبَّتة ومعرّفاتٌ متتابعة — لا عشوائيّة ولا ساعةَ زمن-تشغيل.
 */

import { CirclesStore } from "../../../src/features/circles/data/store.js"
import type { CirclesContext } from "../../../src/features/circles/services/context.js"
import { makeScopeReach } from "../../../src/features/circles/services/directory.js"
import { createCircle } from "../../../src/features/circles/services/circles.js"
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
export const OMAR_PATH = "/men/homs/sq7/omar/"

export const DECISION: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
export const WRITE: DecisionContext = { ...DECISION, intent: "write" }

/**
 * **الأنواعُ الأربعة المعتمدة** (ب-٢٨/ع-٦) — بياناتٌ مرجعية لا كود: تُبذَر صفوفاً هنا،
 * ويُبرهَن في `catalog.test.ts` أنّ **الخامس يعمل بإضافة صفٍّ خامس** بلا سطرِ كود.
 */
export const SEEDED_TYPES: readonly { readonly id: string; readonly ar: string }[] = Object.freeze([
  { id: "tahfeez", ar: "تحفيظ" },
  { id: "baseera", ar: "على بصيرة" },
  { id: "scientific", ar: "علمية" },
  // **المعرّفاتُ نفسُها المعتمدة** في سجل الإعدادات (`edu.paid_hours.curricula.allowed`) —
  // فلا معجمُ أنواعٍ ثانٍ يتباعد عن المعتمد (المادة ١/٢).
  { id: "rashidi", ar: "الرشيدي" },
])

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
 * مستودعٌ مبذورٌ بإسقاط وحدات العالم القانونيّ وكتالوجِ الأنواع — **قراءةٌ لا نسخةُ حقيقة**:
 * الوحدةُ موطنُها `org`، وهذا إسقاطُها الذي تحتاجه هذه الوحدة لاشتقاق النطاق (ADR-001 §٥).
 */
export function seedCirclesStore(tenantId: string = MAIN_TENANT_ID): CirclesStore {
  const store = new CirclesStore(tenantId)
  for (const unit of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId, id: unit.id, path: unit.path })
  }
  for (const type of SEEDED_TYPES) store.saveType({ tenantId, id: type.id, ar: type.ar })
  return store
}

export function circlesContext(actorPersonId: string): CirclesContext {
  return {
    now: NOW,
    actorPersonId,
    reaches: makeScopeReach(canonicalDirectory, NOW),
  }
}

/** حلقةٌ نموذجيّة — تُنشأ بالمسار المُعلَن لا بحقنٍ في المستودع. */
export function seedCircle(
  store: CirclesStore,
  input: {
    readonly unitId?: string
    readonly typeId?: string
    readonly nameAr?: string
    readonly capacity?: number
    readonly actorPersonId?: string
  } = {},
): string {
  const done = createCircle(store, circlesContext(input.actorPersonId ?? "u-amir"), {
    unitId: input.unitId ?? "khalid",
    typeId: input.typeId ?? "tahfeez",
    nameAr: input.nameAr ?? "حلقةُ الفجر",
    capacity: input.capacity ?? 20,
  })
  if (!done.ok) throw new Error(`تعذّر إنشاءُ الحلقة: ${done.error.code}`)
  return done.value.id
}
