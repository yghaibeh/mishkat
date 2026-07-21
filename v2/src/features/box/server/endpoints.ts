/**
 * دوالُّ خادم الصندوق ومالية المسجد — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٦.
 *
 * أربعةُ ثوابتٍ في كل نقطةٍ هنا:
 *  ١. **قدرةٌ معلنة** من الكتالوج — لا نقطةَ بلا إعلان (G7)، ولا قدرةَ مخترعة.
 *  ٢. **النطاقُ يُشتقّ من الكيان المخزَّن**: الوحدةُ من المستودع، والتسليمُ من سجلّه —
 *     والغائبُ ⇒ `NO_SCOPE` ⇒ **رفضٌ يُقفل ولا يُفتح**.
 *  ٣. **الإقرارُ نطاقُه شخصيّ**: `selfScope(أمينُ الوجهة)` من التسليم المخزَّن — فالمدير
 *     وأميرٌ آخرُ ومانحُ التسليم كلُّهم مرفوضون **قبل** جسم الدالة (خ-٧).
 *  ٤. **الفاعلُ من الجلسة لا من المدخل**: مَن يسلّم ومَن يقرّ يُؤخذان من `actor` حصراً.
 *
 * والمستودعُ **مستودعُ شبكة الطلب** (قب-١٨)، فعزلُ الشبكة يقع قبل المحرّك.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, selfScope, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { BoxStores } from "../data/store.js"
import { makeCustodyCheck, type ActorDirectory } from "../services/custodian.js"
import type { BoxContext } from "../services/context.js"
import { receiveIntoBox, spendFromBox, type ReceiveInput, type SpendInput } from "../services/operations.js"
import {
  acknowledgeHandover,
  handoverDown,
  handoversIn,
  type HandoverInput,
} from "../services/handover.js"
import {
  mosqueFinanceView,
  unitBoxView,
  type MosqueFinanceView,
  type UnitBoxView,
} from "../services/boxViews.js"
import { recordMosqueFinance, type MosqueFinanceInput } from "../services/mosqueFinance.js"
import type { BoxHandover } from "../types.js"

/** نطاقٌ من وحدةٍ مخزَّنةٍ **في مستودع هذه الشبكة**، أو `NO_SCOPE` (§٥.٢). */
function unitById(stores: BoxStores, unitId: string | undefined): Scope {
  const unit = unitId === undefined ? null : stores.ledger.getUnit(unitId)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

/**
 * نطاقُ الإقرار **شخصيٌّ من التسليم المخزَّن**: صاحبُه أمينُ الوجهة المسجَّل عند التسليم،
 * لا شخصٌ يمرّره الباتّ. التسليمُ المجهول ⇒ `NO_SCOPE` ⇒ رفض.
 */
function handoverOwnerScope(stores: BoxStores, handoverId: string | undefined): Scope {
  const handover = handoverId === undefined ? null : stores.box.getHandover(handoverId)
  return handover === null
    ? NO_SCOPE
    : selfScope(handover.toCustodianPersonId, "boxHandover", handover.id)
}

export function makeBoxEndpoints(
  stores: BoxStores,
  settings: SettingsResolver,
  directory: ActorDirectory,
) {
  /**
   * سياقُ الخدمات: الساعةُ من الطلب، والفاعلُ من الجلسة، والإعداداتُ محقونة (قب-٦).
   * وسؤالُ الأمانة يُسأل بنيّة **قراءة** دائماً — فهو سؤالٌ عن شخصٍ آخر لا فعلٌ باسمه.
   */
  const contextOf = (actor: Actor, request: DecisionContext): BoxContext => ({
    now: request.now,
    settings,
    actorPersonId: actor.personId,
    custody: makeCustodyCheck(directory, { ...request, intent: "read" }),
  })

  const unitViewFn = defineServerFn({
    name: "box.unit.view",
    capability: "box.view",
    scope: (input: { unitId: string }) => unitById(stores, input.unitId),
    intent: "read",
    audit: "box.unit.view",
    handler: async (input: { unitId: string }): Promise<UnitBoxView> => {
      const unit = stores.ledger.getUnit(input.unitId)!
      return unitBoxView(stores, unit.path)
    },
  })

  const receiveFn = defineServerFn({
    name: "box.receive.record",
    capability: "box.receive",
    scope: (input: { unitId: string }) => unitById(stores, input.unitId),
    intent: "write",
    audit: "box.receive.record",
    handler: async (input: ReceiveInput, { actor, request }) =>
      receiveIntoBox(stores, contextOf(actor, request), input),
  })

  const spendFn = defineServerFn({
    name: "box.spend.record",
    capability: "box.spend",
    scope: (input: { unitId: string }) => unitById(stores, input.unitId),
    intent: "write",
    audit: "box.spend.record",
    handler: async (input: SpendInput, { actor, request }) =>
      spendFromBox(stores, contextOf(actor, request), input),
  })

  const handoverFn = defineServerFn({
    name: "box.handover.record",
    capability: "box.handover",
    // نطاقُ الفعل **وحدةُ المصدر**: التسليمُ نازلٌ من صندوقك أنت (ق-٦١).
    scope: (input: { fromUnitId: string }) => unitById(stores, input.fromUnitId),
    intent: "write",
    audit: "box.handover.record",
    handler: async (input: HandoverInput, { actor, request }) =>
      handoverDown(stores, contextOf(actor, request), input),
  })

  const acknowledgeFn = defineServerFn({
    name: "box.handover.ack",
    capability: "box.handover.acknowledge",
    scope: (input: { handoverId: string }) => handoverOwnerScope(stores, input.handoverId),
    intent: "write",
    audit: "box.handover.ack",
    handler: async (input: { handoverId: string }, { actor, request }) =>
      // **المقرُّ من الجلسة لا من المدخل** — فلا يُزوَّر إقرارٌ باسم غيره.
      acknowledgeHandover(stores, contextOf(actor, request), {
        handoverId: input.handoverId,
        personId: actor.personId,
      }),
  })

  const handoversFn = defineServerFn({
    name: "box.handovers.view",
    capability: "box.view",
    scope: (input: { unitId: string }) => unitById(stores, input.unitId),
    intent: "read",
    audit: "box.handovers.view",
    handler: async (input: { unitId: string }): Promise<readonly BoxHandover[]> => {
      const unit = stores.ledger.getUnit(input.unitId)!
      return handoversIn(stores.box, unit.path)
    },
  })

  const mosqueFinanceRecordFn = defineServerFn({
    name: "mosqueFinance.record",
    capability: "mosqueFinance.manage",
    scope: (input: { unitId: string }) => unitById(stores, input.unitId),
    intent: "write",
    audit: "mosqueFinance.record",
    handler: async (input: MosqueFinanceInput, { actor, request }) =>
      recordMosqueFinance(stores, contextOf(actor, request), input),
  })

  const mosqueFinanceViewFn = defineServerFn({
    name: "mosqueFinance.view",
    capability: "mosqueFinance.view",
    scope: (input: { unitId: string }) => unitById(stores, input.unitId),
    intent: "read",
    audit: "mosqueFinance.view",
    handler: async (input: { unitId: string }): Promise<MosqueFinanceView> => {
      const unit = stores.ledger.getUnit(input.unitId)!
      return mosqueFinanceView(stores, unit.path)
    },
  })

  return {
    unitView: unitViewFn,
    receive: receiveFn,
    spend: spendFn,
    handover: handoverFn,
    acknowledge: acknowledgeFn,
    handovers: handoversFn,
    mosqueFinanceRecord: mosqueFinanceRecordFn,
    mosqueFinanceView: mosqueFinanceViewFn,
  }
}
