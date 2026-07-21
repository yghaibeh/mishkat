/**
 * دوالُّ خادم سجل اليوم — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٥.
 *
 * أربعةُ ثوابتٍ في كل نقطةٍ هنا:
 *  ١. **قدرةٌ معلنة** من الكتالوج — لا نقطةَ بلا إعلان (G7)، ولا قدرةَ مخترعة.
 *  ٢. **النطاقُ يُشتقّ من الكيان المخزَّن**: الوحدةُ من مستودع الشبكة، والغائبُ ⇒ `NO_SCOPE`
 *     ⇒ **رفضٌ يُقفل ولا يُفتح** (فيقع عزلُ الشبكة قبل فحص القدرة — قب-١٨).
 *  ٣. **الفاعلُ من الجلسة لا من المدخل**: مَن أدخل ومَن ضبط عددَ الأسرة من `actor` حصراً.
 *  ٤. **الخادمُ قاطع** (ق-٤٠): لا يستقبل مدخلٌ «نقاطاً» — تُحسب في الخدمة وحدها، فالالتفافُ
 *     على الواجهة لا يشتري نقطةً واحدة.
 *
 * **وليس هنا سطحُ اعتمادٍ واحد** (G22): تقديمُ السجل واعتمادُه ورفضُه وسحبُه سطوحٌ تعيش في
 * مجلد المحرّك (`approval/server/weeklyRecord.ts`) — والقفلُ يصل هذه الوحدةَ **منفذاً محقوناً**.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, rootScope, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { DailyLogStore } from "../data/store.js"
import type { DailyLogContext, PeriodLockCheck } from "../services/context.js"
import {
  catalogView,
  upsertActivity,
  type CatalogView,
  type UpsertActivityInput,
} from "../services/catalog.js"
import { recordDailyEntry, type RecordEntryInput } from "../services/entries.js"
import { setFamilyRoster, type FamilyRosterInput } from "../services/roster.js"
import { unitDailyLogView, type DailyLogView } from "../services/totals.js"
import type { ActivityDefinition, DailyEntry, DaySpan, DailyLogResult, FamilyRoster } from "../types.js"

/** نطاقٌ من وحدةٍ مخزَّنةٍ **في مستودع هذه الشبكة**، أو `NO_SCOPE` (§٥.٢). */
function unitById(store: DailyLogStore, unitId: string | undefined): Scope {
  const unit = unitId === undefined ? null : store.getUnit(unitId)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

export function makeDailyLogEndpoints(
  store: DailyLogStore,
  settings: SettingsResolver,
  /** ق-٨: منفذُ القفل — يُحقن من مُركِّب النظام، فلا تعرف الوحدةُ سلسلةَ الاعتماد (G22). */
  isPeriodLocked: PeriodLockCheck,
) {
  const contextOf = (actor: Actor, request: DecisionContext): DailyLogContext => ({
    now: request.now,
    actorPersonId: actor.personId,
    settings,
    isPeriodLocked,
  })

  const viewFn = defineServerFn({
    name: "dailyLog.unit.view",
    capability: "dailyLog.view",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "dailyLog.unit.view",
    handler: async (
      input: { unitId: string; periodKey: string; span: DaySpan },
      { actor, request },
    ): Promise<DailyLogView> => {
      const unit = store.getUnit(input.unitId)!
      return unitDailyLogView(store, contextOf(actor, request), unit.path, {
        periodKey: input.periodKey,
        span: input.span,
      })
    },
  })

  const recordFn = defineServerFn({
    name: "dailyLog.entry.record",
    capability: "dailyLog.edit",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "write",
    audit: "dailyLog.entry.record",
    handler: async (
      input: RecordEntryInput,
      { actor, request },
    ): Promise<DailyLogResult<DailyEntry>> =>
      recordDailyEntry(store, contextOf(actor, request), input),
  })

  const rosterFn = defineServerFn({
    name: "dailyLog.familyRoster.set",
    capability: "familyRoster.manage",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "write",
    audit: "dailyLog.familyRoster.set",
    handler: async (
      input: FamilyRosterInput,
      { actor, request },
    ): Promise<DailyLogResult<FamilyRoster>> =>
      setFamilyRoster(store, contextOf(actor, request), input),
  })

  const catalogViewFn = defineServerFn({
    name: "activityCatalog.view",
    capability: "activityCatalog.manage",
    // قدرةٌ **جذرية**: نطاقُها الجذر صراحةً — فلا يكون الشمولُ سهواً (المادة ٤/٣).
    scope: () => rootScope(),
    intent: "read",
    audit: "activityCatalog.view",
    handler: async (): Promise<CatalogView> => catalogView(store),
  })

  const catalogUpsertFn = defineServerFn({
    name: "activityCatalog.upsert",
    capability: "activityCatalog.manage",
    scope: () => rootScope(),
    intent: "write",
    audit: "activityCatalog.upsert",
    handler: async (
      input: UpsertActivityInput,
      { actor, request },
    ): Promise<DailyLogResult<ActivityDefinition>> =>
      upsertActivity(store, contextOf(actor, request), input),
  })

  return {
    view: viewFn,
    record: recordFn,
    roster: rosterFn,
    catalogView: catalogViewFn,
    catalogUpsert: catalogUpsertFn,
  }
}
