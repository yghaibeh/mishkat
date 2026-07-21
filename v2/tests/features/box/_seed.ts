/**
 * بذرةُ عالم الصندوق — تُبنى **فوق** بذرة الدفتر (`tests/features/ledger/_seed.ts`) التي تُبنى
 * بدورها على العالم القانونيّ الواحد (TESTING_POLICY §٥). **لا عالمَ ثالثٌ يتباعد**: هنا
 * تُضاف مراجعُ الصندوق وحدها (حساباتُ فئات الصرف + القاموس المغلق المركزيّ).
 */

import { LedgerStore } from "../../../src/features/ledger/data/store.js"
import { BoxStore } from "../../../src/features/box/data/store.js"
import type { BoxStores } from "../../../src/features/box/data/store.js"
import type { BoxContext } from "../../../src/features/box/services/context.js"
import { makeCustodyCheck } from "../../../src/features/box/services/custodian.js"
import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import { createSettingsResolver, type SettingOverride } from "../../../src/settings/resolver.js"
import type { Actor, DecisionContext } from "../../../src/authorization/can.js"
import { MAIN_TENANT_ID, NOW, seedStore } from "../ledger/_seed.js"

export { MAIN_TENANT_ID, NOW, SECOND_TENANT_ID, c, canonicalActor, seedStore } from "../ledger/_seed.js"

/** حساباتُ المصروف التي تشير إليها فئاتُ القاموس — مراجعُ بياناتٍ لا أرقامَ في الكود. */
export const CATEGORY_ACCOUNTS = [
  { id: "expense.fuel", ar: "مصروفُ محروقات", kind: "expense" as const },
  { id: "expense.transport", ar: "مصروفُ نقليات", kind: "expense" as const },
]

/** القاموسُ المغلق المركزيّ (ق-٦٤) — **بياناتٌ مرجعية**، تُبذَر ولا تُصلَّب في الكود. */
export const CATEGORIES = [
  { id: "fuel", ar: "محروقات", accountId: "expense.fuel", active: true },
  { id: "transport", ar: "نقليات", accountId: "expense.transport", active: true },
  { id: "retired", ar: "فئةٌ أُوقفت", accountId: "expense.general", active: false },
]

export function seedBoxStores(tenantId: string = MAIN_TENANT_ID): BoxStores {
  const ledger: LedgerStore = seedStore(tenantId)
  for (const a of CATEGORY_ACCOUNTS) {
    ledger.saveAccount({ tenantId, id: a.id, ar: a.ar, kind: a.kind })
  }
  const box = new BoxStore(tenantId)
  for (const cat of CATEGORIES) {
    box.saveCategory({ tenantId, id: cat.id, ar: cat.ar, accountId: cat.accountId, active: cat.active })
  }
  return { ledger, box }
}

export const DECISION: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
export const WRITE: DecisionContext = { ...DECISION, intent: "write" }

/** دليلُ الفاعلين — العالمُ القانونيّ نفسُه، فلا نسخةَ أشخاصٍ ثانية. */
export function canonicalDirectory(personId: string): Actor | null {
  return buildCanonicalWorld().people.find((p) => p.personId === personId) ?? null
}

export function boxContext(
  actorPersonId: string,
  overrides: readonly SettingOverride[] = [],
): BoxContext {
  return {
    now: NOW,
    actorPersonId,
    settings: createSettingsResolver(overrides),
    custody: makeCustodyCheck(canonicalDirectory, DECISION),
  }
}
