/**
 * دوالُّ خادم الإشراف — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٥.
 *
 * أربعةُ ثوابتٍ في كل نقطةٍ هنا:
 *  ١. **قدرةٌ معلنة** من الكتالوج — لا نقطةَ بلا إعلان (G7)، ولا قدرةَ مخترعة.
 *  ٢. **النطاقُ يُشتقّ من الكيان المخزَّن**: الهدفُ والوحدةُ من مستودع الشبكة، والغائبُ ⇒
 *     `NO_SCOPE` ⇒ **رفضٌ يُقفل ولا يُفتح** (فيقع عزلُ الشبكة قبل فحص القدرة — قب-١٨).
 *  ٣. **الفاعلُ من الجلسة لا من المدخل**: مَن زار ومساراتُ إسناده من `actor` حصراً — فلا
 *     يُنسب أحدٌ زيارةً لغيره ولا يدّعي نطاقاً ليس له.
 *  ٤. **نطاقُ الزيارة نطاقُ الهدف**: `visit.conduct` نطاقُها «و» (الوحدةُ وما تحتها)، فزيارةُ
 *     ما هو خارج شجرة الزائر يردُّها `can()` **قبل جسم الدالة** (ق-١٧).
 *
 * **وليس هنا سطحُ اعتمادٍ واحد** (G22): رفعُ الزيارة واعتمادُها ورفضُها سطوحٌ تعيش في مجلد
 * المحرّك (`approval/server/supervisionVisit.ts`) — والحُكمُ يصل هذه الوحدةَ **منفذاً محقوناً**.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { SupervisionStore } from "../data/store.js"
import type {
  SupervisionContext,
  UnitResponsibleLookup,
  VisitVerdictLookup,
} from "../services/context.js"
import { effectiveScopePathsOf, recordVisit, type RecordVisitInput } from "../services/visits.js"
import { supervisionBoard, supervisionOverview, visitsInScope } from "../services/views.js"
import type {
  OverviewRow,
  SupervisionBoard,
  SupervisionResult,
  SupervisionVisit,
  VisitRecord,
} from "../types.js"

/** المنفذان المحقونان — تُمرَّرهما نقطةُ التركيب، ولا تعرف الوحدةُ مَن ينفّذهما. */
export type SupervisionPorts = {
  readonly verdictOf: VisitVerdictLookup
  readonly responsibleOf: UnitResponsibleLookup
}

/** نطاقٌ من **هدفٍ مخزَّنٍ في مستودع هذه الشبكة**، أو `NO_SCOPE` (§٥.٢). */
function targetById(store: SupervisionStore, targetId: string | undefined): Scope {
  const target = targetId === undefined ? null : store.getTarget(targetId)
  return target === null ? NO_SCOPE : unitScope(target.path)
}

/** ونطاقٌ من وحدةٍ مخزَّنةٍ فيه كذلك — لا من مسارٍ يرسله العميل. */
function unitById(store: SupervisionStore, unitId: string | undefined): Scope {
  const unit = unitId === undefined ? null : store.getUnit(unitId)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

export function makeSupervisionEndpoints(
  store: SupervisionStore,
  settings: SettingsResolver,
  ports: SupervisionPorts,
) {
  const contextOf = (actor: Actor, request: DecisionContext): SupervisionContext => ({
    now: request.now,
    actorPersonId: actor.personId,
    settings,
    verdictOf: ports.verdictOf,
    responsibleOf: ports.responsibleOf,
    // **مساراتٌ لا أدوار**: منها تُشتقّ مرساةُ السلسلة (ق-١٦).
    actorScopePaths: effectiveScopePathsOf(actor.assignments, request.now),
  })

  const recordFn = defineServerFn({
    name: "visit.record",
    capability: "visit.conduct",
    scope: (input: { targetId: string }) => targetById(store, input.targetId),
    intent: "write",
    audit: "visit.record",
    handler: async (
      input: RecordVisitInput,
      { actor, request },
    ): Promise<SupervisionResult<SupervisionVisit>> =>
      recordVisit(store, contextOf(actor, request), input),
  })

  const boardFn = defineServerFn({
    name: "supervision.board.view",
    capability: "visit.conduct",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "supervision.board.view",
    handler: async (input: { unitId: string }, { actor, request }): Promise<SupervisionBoard> => {
      const unit = store.getUnit(input.unitId)!
      return supervisionBoard(store, contextOf(actor, request), unit.path)
    },
  })

  const overviewFn = defineServerFn({
    name: "supervision.overview.view",
    capability: "visit.view",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "supervision.overview.view",
    handler: async (
      input: { unitId: string },
      { actor, request },
    ): Promise<readonly OverviewRow[]> => {
      const unit = store.getUnit(input.unitId)!
      return supervisionOverview(store, contextOf(actor, request), unit.path)
    },
  })

  const visitsFn = defineServerFn({
    name: "supervision.visits.list",
    capability: "visit.view",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "supervision.visits.list",
    handler: async (
      input: { unitId: string },
      { actor, request },
    ): Promise<readonly VisitRecord[]> => {
      const unit = store.getUnit(input.unitId)!
      return visitsInScope(store, contextOf(actor, request), unit.path)
    },
  })

  return { record: recordFn, board: boardFn, overview: overviewFn, visits: visitsFn }
}
