/**
 * بذرةُ عالم اللجان — مُشتقّة من **العالم القانونيّ الواحد** (`tests/fixtures/canonical-world.ts`،
 * TESTING_POLICY §٥) فلا عالمَ ثانٍ يتباعد. تُضيف عليه ما تحتاجه هذه الوحدة (وحداتُ الشجرة
 * في مستودع اللجان + مُحلِّلُ إعدادات) **دون تغيير الفيكستشر الحاكم**.
 *
 * ولا مفردةَ اعتمادٍ هنا (G22): سلسلةُ ق-١٣ تُختبر في مجلد المحرّك، وهذه بذرةُ **بيانات
 * اللجان وحدها**.
 */

import { CommitteeStore } from "../../../src/features/committees/data/store.js"
import type { CommitteeContext } from "../../../src/features/committees/services/context.js"
import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import { createSettingsResolver, type SettingOverride } from "../../../src/settings/resolver.js"
import type { Actor, DecisionContext } from "../../../src/authorization/can.js"

export const NOW = new Date("2026-07-20T00:00:00.000Z")
export const MAIN_TENANT_ID = "t-main"
/** الشبكةُ الثانية — بنفس المسارات النسبيّة عمداً، فيثبت العزلُ أنّ التطابق لا يسرّب (قب-١٨). */
export const SECOND_TENANT_ID = "t-aleppo"

export const KHALID = "khalid"
export const KHALID_PATH = "/men/homs/sq2/khalid/"
export const BILAL = "bilal"
export const BILAL_PATH = "/men/homs/sq2/bilal/"
export const SQ2_PATH = "/men/homs/sq2/"
export const HOMS_PATH = "/men/homs/"

/** الفترةُ المعتمَدُ عنها — معرّفٌ نصّيٌّ حتميّ لا حسابَ تقويمٍ في الاختبار. */
export const PERIOD = "1447-12"

export const READ: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
export const WRITE: DecisionContext = { ...READ, intent: "write" }

export function seedCommitteeStore(tenantId: string = MAIN_TENANT_ID): CommitteeStore {
  const store = new CommitteeStore(tenantId)
  for (const u of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId, id: u.id, path: u.path })
  }
  return store
}

/** فاعلٌ من العالم القانونيّ بمعرّفه — بلا نسخٍ لتعريفه هنا. */
export function canonicalActor(personId: string): Actor {
  const person = buildCanonicalWorld().people.find((p) => p.personId === personId)
  if (person === undefined) throw new Error(`لا شخص بهذا المعرّف في العالم القانوني: ${personId}`)
  return person
}

/** دليلُ الفاعلين — العالمُ القانونيّ نفسُه، فلا نسخةَ أشخاصٍ ثانية. */
export function canonicalDirectory(personId: string): Actor | null {
  return buildCanonicalWorld().people.find((p) => p.personId === personId) ?? null
}

export function committeeContext(
  actorPersonId: string,
  overrides: readonly SettingOverride[] = [],
): CommitteeContext {
  return { now: NOW, actorPersonId, settings: createSettingsResolver(overrides) }
}

/** لجنةٌ قانونيّةٌ في مسجد خالد — مسؤولُها **صاحبُ حساب** (ع-١٧: الأمير مكّنه). */
export const RELIEF = {
  id: "cm-relief",
  labelAr: "لجنة الإغاثة",
  headPersonId: "u-committee-head",
  headNameAr: "مسؤول لجنة الإغاثة",
} as const

/** لجنةٌ ثانيةٌ في المسجد نفسِه — مسؤولُها **اسمٌ حرٌّ بلا حساب** (ق-٣١). */
export const DAWAH = {
  id: "cm-dawah",
  labelAr: "لجنة الدعوة",
  headPersonId: null,
  headNameAr: "أبو عبد الرحمن",
} as const
