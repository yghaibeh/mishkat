/**
 * دوالُّ خادم نواة الدفتر — `SPEC_authorization` §٥.٢ + `SPEC_finance_ledger` §٥.
 *
 * **نقطةُ الخنق بنيويّةٌ هنا**: ليس في هذا الملفّ دالةٌ تُرحِّل مباشرةً. ثلاثُ دوالٍّ
 * **تقترح** (لا تلمس الدفتر)، ودالةٌ واحدةٌ **تبتّ** (وحدها تُرحِّل)، وثلاثٌ **تقرأ**.
 * فالتفافُ الاعتماد الثنائي لا يحتاج انضباطاً — لا يوجد له مسارٌ أصلاً.
 *
 * وكلُّ نقطةٍ تعلن: `capability` من الكتالوج · مُحلِّلَ `scope` **يشتقّ النطاق من الكيان
 * المخزَّن** (الغائبُ ⇒ `NO_SCOPE` ⇒ رفض) · `intent` · `audit`.
 *
 * مصنعٌ يحقن المستودع ومُحلِّلَ الإعدادات: فلا استيرادَ مباشرٍ لطبقة القاعدة (G17)، ويُبدَّل
 * المستودعُ في الاختبار وفي الإنتاج دون تغيير الإعلان. و**المستودعُ هو مستودعُ شبكة الطلب**،
 * فعزلُ الشبكة يقع قبل المحرّك (§٨.١).
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, unitScope, type Scope } from "../../../authorization/scope.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type { LedgerStore } from "../data/store.js"
import { decideAction, pendingActionsFor, proposeAction } from "../services/dualControl.js"
import { balanceProof, type LedgerContext } from "../services/journal.js"
import { cashBalances, type CurrencyBalance } from "../services/balances.js"
import { deductionsVisible } from "../services/deductions.js"
import type {
  CurrencyCode,
  JournalEntry,
  ManualJournalPayload,
  PendingAction,
  SimpleOperation,
} from "../types.js"

/** نطاقٌ من وحدةٍ مخزَّنةٍ **في مستودع هذه الشبكة**، أو `NO_SCOPE` — يُقفل ولا يُفتح (§٥.٢). */
function unitById(store: LedgerStore, unitId: string | undefined): Scope {
  const unit = unitId === undefined ? null : store.getUnit(unitId)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

/** نطاقُ قيدٍ = نطاقُ رأسه المخزَّن — لا مسارٌ يأتي من العميل. */
function entryScope(store: LedgerStore, entryId: string | undefined): Scope {
  const entry = entryId === undefined ? null : store.getEntry(entryId)
  return entry === null ? NO_SCOPE : unitScope(entry.unitPath)
}

/** نطاقُ فعلٍ معلَّق = نطاقُه المخزَّن عند الاقتراح — لا يُعاد اشتقاقُه من مدخل الباتّ. */
function actionScope(store: LedgerStore, actionId: string | undefined): Scope {
  const action = actionId === undefined ? null : store.getAction(actionId)
  return action === null ? NO_SCOPE : unitScope(action.unitPath)
}

export type BalancesView = {
  readonly unitPath: string
  readonly byCurrency: Readonly<Record<CurrencyCode, CurrencyBalance>>
  readonly balanced: boolean
  readonly deductionsShown: boolean
}

export type EntriesView = {
  readonly unitPath: string
  readonly entries: readonly JournalEntry[]
}

function toRecord(
  balances: ReadonlyMap<CurrencyCode, CurrencyBalance>,
): Readonly<Record<CurrencyCode, CurrencyBalance>> {
  return Object.freeze(Object.fromEntries(balances))
}

export function makeLedgerEndpoints(store: LedgerStore, settings: SettingsResolver) {
  /** سياقُ الخدمات — الساعةُ من الطلب والفاعلُ من الجلسة، والإعداداتُ محقونة (قب-٦). */
  const contextOf = (actor: Actor, request: DecisionContext): LedgerContext => ({
    now: request.now,
    settings,
    actorPersonId: actor.personId,
  })

  // ── اقتراحٌ (maker): ثلاثُ نقاطٍ **لا تلمس الدفتر** ────────────────────────
  const proposeJournalFn = defineServerFn({
    name: "ledger.journal.propose",
    capability: "ledger.journal.entry",
    scope: (input: { entry: ManualJournalPayload }) => unitById(store, input.entry.unitId),
    intent: "write",
    audit: "ledger.journal.propose",
    handler: async (input: { entry: ManualJournalPayload }, { actor, request }) => {
      const proposed = proposeAction(store, contextOf(actor, request), {
        unitId: input.entry.unitId,
        // **المُقترِحُ من الفاعل لا من المدخل** — فلا يُزوَّر اعتمادٌ ذاتيّ (ق-٥٤).
        requestedBy: actor.personId,
        payload: { kind: "journal.manual", entry: input.entry },
      })
      return proposed
    },
  })

  const proposeReversalFn = defineServerFn({
    name: "ledger.reversal.propose",
    capability: "ledger.journal.entry",
    scope: (input: { entryId: string }) => entryScope(store, input.entryId),
    intent: "write",
    audit: "ledger.reversal.propose",
    handler: async (input: { entryId: string; reasonAr: string }, { actor, request }) => {
      const entry = store.getEntry(input.entryId)
      // وحدةُ الفعل هي **وحدةُ القيد المخزَّن نفسِه** لا وحدةٌ يمرّرها العميل (§٥.٢).
      const unit = entry === null ? null : store.unitByPath(entry.unitPath)
      return proposeAction(store, contextOf(actor, request), {
        unitId: unit === null ? "" : unit.id,
        requestedBy: actor.personId,
        payload: { kind: "journal.reverse", entryId: input.entryId, reasonAr: input.reasonAr },
      })
    },
  })

  const proposeOperationFn = defineServerFn({
    name: "ledger.operation.propose",
    capability: "finance.entry",
    scope: (input: { operation: SimpleOperation }) => unitById(store, input.operation.unitId),
    intent: "write",
    audit: "ledger.operation.propose",
    handler: async (input: { operation: SimpleOperation }, { actor, request }) =>
      proposeAction(store, contextOf(actor, request), {
        unitId: input.operation.unitId,
        requestedBy: actor.personId,
        payload: { kind: "operation.simple", operation: input.operation },
      }),
  })

  // ── بتٌّ (checker): النقطةُ **الوحيدة** التي يخرج منها قيدٌ إلى الدفتر ───────
  const decideFn = defineServerFn({
    name: "ledger.action.decide",
    capability: "finance.supervise",
    scope: (input: { actionId: string }) => actionScope(store, input.actionId),
    intent: "write",
    audit: "ledger.action.decide",
    handler: async (
      input: { actionId: string; approve: boolean; reasonAr?: string },
      { actor, request },
    ) =>
      decideAction(store, contextOf(actor, request), {
        actionId: input.actionId,
        // **الباتُّ من الفاعل لا من المدخل** — شرطُ فصل المهام يقع على هويةٍ مُصادَقة.
        decidedBy: actor.personId,
        approve: input.approve,
        ...(input.reasonAr === undefined ? {} : { reasonAr: input.reasonAr }),
      }),
  })

  // ── قراءةٌ ────────────────────────────────────────────────────────────────
  const pendingFn = defineServerFn({
    name: "ledger.actions.pending",
    capability: "finance.supervise",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "ledger.actions.pending",
    handler: async (input: { unitId: string }): Promise<readonly PendingAction[]> => {
      const unit = store.getUnit(input.unitId)
      return unit === null ? [] : pendingActionsFor(store, unit.path)
    },
  })

  const balancesFn = defineServerFn({
    name: "ledger.balances.view",
    capability: "finance.view",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "ledger.balances.view",
    handler: async (input: { unitId: string }, { actor, request }): Promise<BalancesView> => {
      const unit = store.getUnit(input.unitId)!
      const ctx = contextOf(actor, request)
      return {
        unitPath: unit.path,
        byCurrency: toRecord(cashBalances(store, unit.path)),
        balanced: balanceProof(store).balanced,
        deductionsShown: deductionsVisible(ctx, unit.path),
      }
    },
  })

  const entriesFn = defineServerFn({
    name: "ledger.entries.view",
    capability: "finance.view",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "ledger.entries.view",
    handler: async (input: { unitId: string }): Promise<EntriesView> => {
      const unit = store.getUnit(input.unitId)!
      return {
        unitPath: unit.path,
        entries: store.entries().filter((e) => e.unitPath.startsWith(unit.path)),
      }
    },
  })

  return {
    proposeJournal: proposeJournalFn,
    proposeReversal: proposeReversalFn,
    proposeOperation: proposeOperationFn,
    decide: decideFn,
    pending: pendingFn,
    balances: balancesFn,
    entries: entriesFn,
  }
}
