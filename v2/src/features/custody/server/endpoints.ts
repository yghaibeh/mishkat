/**
 * دوالُّ خادم العُهد والأصول — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٧.
 *
 * أربعةُ ثوابتٍ في كل نقطةٍ هنا:
 *  ١. **قدرةٌ معلنة** من الكتالوج — لا نقطةَ بلا إعلان (G7)، ولا قدرةَ مخترعة.
 *  ٢. **النطاقُ يُشتقّ من الكيان المخزَّن**: الوحدةُ من إسقاطها، والأصلُ من موطنه، والحركةُ
 *     من مستلِمها — والغائبُ ⇒ `NO_SCOPE` ⇒ **رفضٌ يُقفل ولا يُفتح**.
 *  ٣. **الشخصيُّ نطاقُه ملكيّة**: «عُهدتي» والإقرارُ نطاقُهما `selfScope` — فطلبُ صفحةِ غيرك
 *     أو الإقرارُ عن غيرك **مرفوضان قبل جسم الدالة** (ق-٧٩).
 *  ٤. **الفاعلُ من الجلسة لا من المدخل**: مَن ينفّذ الحركةَ ومَن يقرّ يُؤخذان من `actor` حصراً.
 *
 * والمستودعُ **مستودعُ شبكة الطلب** (قب-١٨)، فعزلُ الشبكة يقع قبل المحرّك.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, selfScope, unitScope, type Scope } from "../../../authorization/scope.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { CustodyStore } from "../data/store.js"
import type { CustodyContext } from "../services/context.js"
import { makeScopeReach, type ActorDirectory } from "../services/directory.js"
import { amendAsset, registerAsset, type AmendAssetInput, type RegisterAssetInput } from "../services/assets.js"
import {
  acknowledgeReceipt,
  recordCustodyMove,
  type CustodyMoveInput,
} from "../services/chain.js"
import {
  assetsInScope,
  chainOf,
  openCustodyOf,
  pendingReceiptsFor,
  type AssetState,
  type OpenCustody,
} from "../services/derive.js"
import type { CustodyMove } from "../types.js"

/** نموذجُ صفحة «عُهد نطاقي» — **مصدرُ بياناتٍ واحد** لكل رقمٍ فيها (ق-١١١). */
export type CustodyScopeView = {
  readonly unitPath: string
  readonly assets: readonly AssetState[]
}

/** نموذجُ صفحة «عُهدتي» — ما بيدي وما ينتظر إقراري، من مصدرٍ واحد. */
export type MyCustodyView = {
  readonly personId: string
  readonly open: readonly OpenCustody[]
  readonly pending: readonly CustodyMove[]
}

/** نطاقٌ من وحدةٍ مخزَّنةٍ **في مستودع هذه الشبكة**، أو `NO_SCOPE` (§٥.٢). */
function unitById(store: CustodyStore, unitId: string | undefined): Scope {
  const unit = unitId === undefined ? null : store.getUnit(unitId)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

/** نطاقٌ من **موطن الأصل التنظيميّ** — لا من مسارٍ يمرّره العميل. */
function assetScope(store: CustodyStore, assetId: string | undefined): Scope {
  const asset = assetId === undefined ? null : store.getAsset(assetId)
  return asset === null ? NO_SCOPE : unitScope(asset.unitPath)
}

/**
 * نطاقُ الإقرار **شخصيٌّ من الحركة المخزَّنة**: صاحبُه المستلِمُ المسجَّل عند التسليم، لا
 * شخصٌ يمرّره المُقرّ. والحركةُ المجهولةُ أو غيرُ القابلة للإقرار ⇒ `NO_SCOPE` ⇒ رفض.
 */
function receiptOwnerScope(store: CustodyStore, moveId: string | undefined): Scope {
  const move = moveId === undefined ? null : store.getMove(moveId)
  if (move === null || move.toPersonId === null) return NO_SCOPE
  return selfScope(move.toPersonId, "custodyMove", move.id)
}

export function makeCustodyEndpoints(store: CustodyStore, directory: ActorDirectory) {
  const contextOf = (actor: Actor, request: DecisionContext): CustodyContext => ({
    now: request.now,
    actorPersonId: actor.personId,
    reaches: makeScopeReach(directory, request.now),
  })

  const scopeViewFn = defineServerFn({
    name: "custody.scope.view",
    capability: "custody.view",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "custody.scope.view",
    handler: async (input: { unitId: string }): Promise<CustodyScopeView> => {
      const unit = store.getUnit(input.unitId)!
      return { unitPath: unit.path, assets: assetsInScope(store, unit.path) }
    },
  })

  const chainViewFn = defineServerFn({
    name: "custody.chain.view",
    capability: "custody.view",
    scope: (input: { assetId: string }) => assetScope(store, input.assetId),
    intent: "read",
    audit: "custody.chain.view",
    handler: async (input: { assetId: string }): Promise<readonly CustodyMove[]> =>
      chainOf(store, input.assetId),
  })

  const registerFn = defineServerFn({
    name: "custody.asset.register",
    capability: "asset.manage",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "write",
    audit: "custody.asset.register",
    handler: async (input: RegisterAssetInput, { actor, request }) =>
      registerAsset(store, contextOf(actor, request), input),
  })

  const amendFn = defineServerFn({
    name: "custody.asset.amend",
    capability: "asset.manage",
    scope: (input: { assetId: string }) => assetScope(store, input.assetId),
    intent: "write",
    audit: "custody.asset.amend",
    handler: async (input: AmendAssetInput, { actor, request }) =>
      amendAsset(store, contextOf(actor, request), input),
  })

  const moveFn = defineServerFn({
    name: "custody.move.record",
    capability: "custody.grant",
    // نطاقُ الفعل **موطنُ الأصل**: تُسلَّم عهدةُ نطاقك وحدَه (ق-٨١، ق-م٦).
    scope: (input: { assetId: string }) => assetScope(store, input.assetId),
    intent: "write",
    audit: "custody.move.record",
    handler: async (input: CustodyMoveInput, { actor, request }) =>
      recordCustodyMove(store, contextOf(actor, request), input),
  })

  const mineFn = defineServerFn({
    name: "custody.mine.view",
    capability: "custody.own",
    // **صفحةُ صاحبها وحده**: طلبُها بمعرّف غيرك ⇒ `DENIED_PERSONAL_NOT_OWNER` في المحرّك.
    scope: (input: { personId: string }) => selfScope(input.personId, "custody", input.personId),
    intent: "read",
    audit: "custody.mine.view",
    handler: async (_input: { personId: string }, { actor }): Promise<MyCustodyView> => ({
      // والقراءةُ **بمعرّف الجلسة** لا بالمدخل — فلا تُقرأ عهدةُ غيرك ولو مرّ الفحص.
      personId: actor.personId,
      open: openCustodyOf(store, actor.personId),
      pending: pendingReceiptsFor(store, actor.personId),
    }),
  })

  const acknowledgeFn = defineServerFn({
    name: "custody.receipt.acknowledge",
    capability: "custody.own",
    scope: (input: { moveId: string }) => receiptOwnerScope(store, input.moveId),
    intent: "write",
    audit: "custody.receipt.acknowledge",
    handler: async (input: { moveId: string }, { actor, request }) =>
      // **المقرُّ من الجلسة لا من المدخل** — فلا يُزوَّر إقرارٌ باسم غيره.
      acknowledgeReceipt(store, contextOf(actor, request), {
        moveId: input.moveId,
        personId: actor.personId,
      }),
  })

  return {
    scopeView: scopeViewFn,
    chainView: chainViewFn,
    register: registerFn,
    amend: amendFn,
    move: moveFn,
    mine: mineFn,
    acknowledge: acknowledgeFn,
  }
}
