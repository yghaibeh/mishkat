/**
 * بذرةُ عالم العُهد — تُبنى على **العالم القانونيّ الواحد** (TESTING_POLICY §٥)، فلا عالمَ
 * ثانٍ يتباعد. تُضاف هنا إسقاطاتُ الوحدات وأصولٌ نموذجية وحدها — **ولا حائزَ ولا حالةَ
 * مبذورة**: كلاهما اشتقاقٌ من السلسلة (عقدُ الوحدة §٣).
 *
 * **حتميّ**: لحظةٌ مثبَّتة ومعرّفاتٌ متتابعة — لا عشوائيّة ولا ساعةَ زمن-تشغيل.
 */

import { CustodyStore } from "../../../src/features/custody/data/store.js"
import type { CustodyContext } from "../../../src/features/custody/services/context.js"
import { makeScopeReach } from "../../../src/features/custody/services/directory.js"
import { registerAsset } from "../../../src/features/custody/services/assets.js"
import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import type { Actor, DecisionContext } from "../../../src/authorization/can.js"

export const MAIN_TENANT_ID = "t-main"
export const SECOND_TENANT_ID = "t-second"

/** لحظةُ العالم المثبَّتة — كلُّ تاريخٍ في الاختبارات مشتقٌّ منها. */
export const NOW = new Date("2026-07-22T09:00:00.000Z")

export const KHALID_PATH = "/men/homs/sq2/khalid/"
export const BILAL_PATH = "/men/homs/sq2/bilal/"
export const SQ2_PATH = "/men/homs/sq2/"
export const ROOT_SCOPE_PATH = "/"

export const DECISION: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
export const WRITE: DecisionContext = { ...DECISION, intent: "write" }

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
 * مستودعٌ مبذورٌ بإسقاط وحدات العالم القانونيّ — **قراءةٌ لا نسخةُ حقيقة**: الوحدةُ موطنُها
 * `org`، وهذا إسقاطُها الذي تحتاجه هذه الوحدة لاشتقاق النطاق (عزلُ ADR-001 §٥).
 */
export function seedCustodyStore(tenantId: string = MAIN_TENANT_ID): CustodyStore {
  const store = new CustodyStore(tenantId)
  for (const unit of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId, id: unit.id, path: unit.path })
  }
  return store
}

export function custodyContext(actorPersonId: string, store?: CustodyStore): CustodyContext {
  void store
  return {
    now: NOW,
    actorPersonId,
    reaches: makeScopeReach(canonicalDirectory, NOW),
  }
}

/** أصلٌ نموذجيٌّ في مسجد خالد — يُسجَّل بالمسار المُعلَن لا بحقنٍ في المستودع. */
export function seedAsset(
  store: CustodyStore,
  unitId: string = "khalid",
  labelAr = "حاسوبٌ محمول",
): string {
  const done = registerAsset(store, custodyContext("u-finance"), { unitId, labelAr })
  if (!done.ok) throw new Error(`تعذّر تسجيلُ الأصل: ${done.error.code}`)
  return done.value.id
}
