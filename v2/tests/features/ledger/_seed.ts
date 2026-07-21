/**
 * بذرةُ عالم الدفتر — مُشتقّة من `tests/fixtures/canonical-world.ts` (المصدر الواحد،
 * TESTING_POLICY §٥) فلا عالمَ ثانٍ يتباعد. تُضيف عليه ما تحتاجه هذه الوحدة (شجرةُ حسابات،
 * صناديق شرعية، مُحلِّلُ إعدادات) **دون تغيير الفيكستشر الحاكم** — تغييرُه يتطلب مراجعة
 * مدير البرنامج.
 */

import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import { LedgerStore } from "../../../src/features/ledger/data/store.js"
import type { LedgerContext } from "../../../src/features/ledger/services/journal.js"
import { createSettingsResolver, type SettingOverride } from "../../../src/settings/resolver.js"
import type { Actor } from "../../../src/authorization/can.js"
import type { AccountKind, Cents } from "../../../src/features/ledger/types.js"

export const NOW = new Date("2026-07-20T00:00:00.000Z")
export const MAIN_TENANT_ID = "t-main"
/** الشبكةُ الثانية — بنفس المسارات النسبيّة عمداً، فيثبت العزلُ أنّ التطابق لا يسرّب (§٨.١). */
export const SECOND_TENANT_ID = "t-aleppo"

/** أدوارٌ حسابيةٌ مغلقة يستعملها الوجه المبسَّط (§٦.٤) — تُبذَر في شجرة الحسابات. */
export const CHART: readonly { id: string; ar: string; kind: AccountKind }[] = [
  { id: "cash", ar: "النقد", kind: "asset" },
  { id: "revenue.donations", ar: "إيرادُ التبرعات", kind: "revenue" },
  { id: "expense.general", ar: "مصروفٌ عام", kind: "expense" },
  { id: "clearing.handover", ar: "مقاصّةُ التسليم", kind: "liability" },
  { id: "netAssets.opening", ar: "صافي الأصول الافتتاحيّ", kind: "netAssets" },
]

export const FUNDS: readonly { id: string; ar: string; restricted: boolean }[] = [
  { id: "zakat", ar: "صندوق الزكاة", restricted: true },
  { id: "general", ar: "الصندوق العام", restricted: false },
]

export function seedStore(tenantId: string = MAIN_TENANT_ID): LedgerStore {
  const store = new LedgerStore(tenantId)
  for (const a of CHART) store.saveAccount({ tenantId, id: a.id, ar: a.ar, kind: a.kind })
  for (const f of FUNDS) store.saveFund({ tenantId, id: f.id, ar: f.ar, restricted: f.restricted })
  for (const u of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId, id: u.id, path: u.path })
  }
  return store
}

export function ledgerContext(actorPersonId: string, overrides: readonly SettingOverride[] = []): LedgerContext {
  return { now: NOW, actorPersonId, settings: createSettingsResolver(overrides) }
}

/** فاعلٌ من العالم القانونيّ بمعرّفه — بلا نسخٍ لتعريفه هنا. */
export function canonicalActor(personId: string): Actor {
  const person = buildCanonicalWorld().people.find((p) => p.personId === personId)
  if (person === undefined) throw new Error(`لا شخص بهذا المعرّف في العالم القانوني: ${personId}`)
  return person
}

/**
 * فاعلٌ **يحمل قدرتَي الاقتراح والبتّ معاً** — بمنحٍ فرديّ فوق دوره (نمطُ «ذو منحة» في
 * TESTING_POLICY §٥). وجودُه ضروريٌّ لإثبات أن فصل المهام يقع على **الشخص** لا على الدور:
 * فحتى مَن ملك القدرتين لا يعتمد اقتراحَ نفسه (ق-٥٤، §٥.٣).
 */
export function actorWithBothCaps(personId: string = "u-finance"): Actor {
  const base = canonicalActor(personId)
  return {
    ...base,
    overrides: [
      ...base.overrides,
      {
        capId: "finance.supervise",
        scopePath: "/",
        effect: "grant",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: null,
        reason: "تفويضُ بتٍّ مؤقت — لإثبات أن فصل المهام على الشخص لا على الدور",
      },
    ],
  }
}

/** مبلغٌ بالسنتات في الاختبارات — بناءٌ صريحٌ بلا مرورٍ بالمُحلِّل (الاختبارُ يعرف ما يريد). */
export function c(value: number): Cents {
  return value as Cents
}
