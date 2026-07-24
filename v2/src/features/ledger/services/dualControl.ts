/**
 * ق-٥٣ + ق-٥٤ — الاعتماد الثنائي **نقطةَ خنقٍ واحدةً لا تُلتف**، وفصلُ المهام
 * (`SPEC_finance_ledger` §٥).
 *
 * **الالتفافُ يستحيل بالبناء لا بالانضباط**: ليس في هذه الوحدة — ولا في دوال خادمها —
 * مسارٌ يُرحِّل مباشرةً. المُقترِحُ يكتب **فعلاً معلَّقاً بحمولةٍ مجمَّدة** ولا يلمس الدفتر؛
 * والمعتمِدُ يستدعي **نفسَ** الخدمة بنفس الحمولة حرفياً — فالمعاينةُ تطابق الترحيل.
 *
 * **وفصلُ المهام على الشخص لا على الدور**: `requestedBy === decidedBy` مرفوضٌ ولو حمل
 * الشخصُ القدرتين معاً (بدورين أو بمنحٍ فرديّ) — فلا يُلتَفّ بتعدد الأدوار. ولا فحصَ دورٍ
 * هنا إطلاقاً (المادة ٤/٤، G6): القدرةُ تُفرض في طبقة الخادم، وهذه تحرس **الهوية**.
 */

import { postJournal, reverseEntry, type JournalInput, type LedgerContext } from "./journal.js"
import { simpleOperationLines, sourceTypeOfVerb } from "./simpleFace.js"
import { contains } from "../../../authorization/scope.js"
import {
  ACTION_KINDS,
  err,
  ok,
  type ActionPayload,
  type JournalEntry,
  type PendingAction,
  type Result,
  type SimpleOperation,
} from "../types.js"
import type { LedgerStore } from "../data/store.js"

export type ProposeInput = {
  readonly unitId: string
  readonly requestedBy: string
  readonly payload: ActionPayload
}

export type DecideInput = {
  readonly actionId: string
  readonly decidedBy: string
  readonly approve: boolean
  readonly reasonAr?: string
}

/**
 * لقطةُ حالِ الفعل المعلَّق — **الحالةُ ومَن بتَّها** (ق-٨٣ · CR-028): «أيُّ تعديلٍ يغيّر
 * الحائزَ أو الحالة يكتب قبل/بعد». وصياغتُها **واحدةٌ في الطرفين** فلا يُقرأ القيدُ بلسانين.
 */
function actionLabel(action: Pick<PendingAction, "status" | "decidedBy">): string {
  return `${action.status} \u00b7 ${action.decidedBy ?? "\u2014"}`
}

/** تجميدٌ عميق — الحمولةُ تُختم عند الاقتراح ولا تُبدَّل بين الاقتراح والبتّ (§٥.١). */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

/** الوجهُ المبسَّط يصير قيداً مزدوجاً — والمعرّفُ معرّفَ الفعل فيكون المفتاحُ طبيعياً. */
function simpleOperationInput(
  ctx: LedgerContext,
  operation: SimpleOperation,
  actionId: string,
): JournalInput {
  return {
    at: ctx.now,
    unitId: operation.unitId,
    memoAr: operation.memoAr,
    sourceType: sourceTypeOfVerb(operation.verb),
    sourceId: actionId,
    lines: simpleOperationLines(operation),
  }
}

/** التنفيذُ عند الاعتماد — **نفسُ الخدمات القائمة حرفياً**، لا مسارٌ ثانٍ للمعتمِد. */
function execute(
  store: LedgerStore,
  ctx: LedgerContext,
  action: PendingAction,
): Result<JournalEntry> {
  const payload = action.payload
  if (payload.kind === "journal.manual") return postJournal(store, ctx, payload.entry)
  if (payload.kind === "journal.reverse") {
    return reverseEntry(store, ctx, payload.entryId, payload.reasonAr)
  }
  return postJournal(store, ctx, simpleOperationInput(ctx, payload.operation, action.id))
}

/**
 * الاقتراح (maker) — **لا يلمس الدفتر**. ويحرس هنا حدُّ ب-٣٩ب: الرصيدُ الافتتاحيّ
 * عبر الاستيراد وحده، فلا بابَ خلفيٌّ يكتب أرصدةً بلا تحقّق «الكل أو لا شيء» (§٧.٢).
 */
export function proposeAction(
  store: LedgerStore,
  ctx: LedgerContext,
  input: ProposeInput,
): Result<PendingAction> {
  const kind = (input.payload as { kind?: string } | null | undefined)?.kind
  if (kind === undefined || !(ACTION_KINDS as readonly string[]).includes(kind)) {
    return err("UNKNOWN_ACTION", String(kind))
  }
  const unit = store.getUnit(input.unitId)
  if (unit === null) return err("UNKNOWN_UNIT", input.unitId)

  const payload = input.payload
  if (payload.kind === "journal.manual" && payload.entry.sourceType === "openingBalance") {
    return err("OPENING_BALANCE_VIA_IMPORT_ONLY", payload.entry.sourceId)
  }

  const id = store.nextId("act")
  store.saveAction({
    tenantId: store.tenantId,
    id,
    kind: payload.kind,
    payload: deepFreeze(payload),
    unitPath: unit.path,
    requestedBy: input.requestedBy,
    requestedAt: ctx.now,
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    reasonAr: null,
    resultEntryId: null,
    failureCode: null,
  })
  store.audit.append({
    at: ctx.now,
    actorPersonId: input.requestedBy,
    action: "ledger.action.propose",
    unitPath: unit.path,
    capability: null,
    targetType: "financeAction",
    targetId: id,
    reason: null,
    // **لا حالَ قبله**: الفعلُ يُنشأ الآن — و`null` قيمةٌ معلنةٌ تقول ذلك، لا إغفال.
    before: null,
    after: actionLabel(store.getAction(id)!),
  })
  return ok(store.getAction(id)!)
}

/**
 * البتّ (checker) — **المسارُ الوحيد الذي يُرحِّل**. ثلاثةُ حرّاسٍ قبل أي أثر:
 * الفعلُ قائمٌ · لم يُبتّ سلفاً · والباتُّ ليس المُقترِح (ق-٥٤).
 */
export function decideAction(
  store: LedgerStore,
  ctx: LedgerContext,
  input: DecideInput,
): Result<PendingAction> {
  const action = store.getAction(input.actionId)
  if (action === null) return err("ACTION_NOT_FOUND", input.actionId)
  if (action.status === "approved" || action.status === "rejected") {
    return err("ALREADY_DECIDED", input.actionId)
  }
  // ق-٥٤: على **الشخص** لا على الدور — فلا يُلتَفّ بتعدد الأدوار ولا بمنحٍ فرديّ.
  if (action.requestedBy === input.decidedBy) {
    return err("SELF_APPROVAL_REJECTED", input.decidedBy)
  }

  const reason = (input.reasonAr ?? "").trim()

  if (!input.approve) {
    if (reason.length === 0) return err("REASON_REQUIRED", input.actionId)
    store.saveAction({
      ...action,
      status: "rejected",
      decidedBy: input.decidedBy,
      decidedAt: ctx.now,
      reasonAr: reason,
    })
    store.audit.append({
      at: ctx.now,
      actorPersonId: input.decidedBy,
      action: "ledger.action.reject",
      unitPath: action.unitPath,
      capability: null,
      targetType: "financeAction",
      targetId: action.id,
      reason,
      before: actionLabel(action),
      after: actionLabel(store.getAction(action.id)!),
    })
    return ok(store.getAction(action.id)!)
  }

  const executed = execute(store, ctx, action)
  if (!executed.ok) {
    // **الفشلُ بعد الاعتماد يُسجَّل بسببه** ولا يُعلن نجاحاً كاذباً (§٥.٣).
    store.saveAction({
      ...action,
      status: "failed",
      decidedBy: input.decidedBy,
      decidedAt: ctx.now,
      reasonAr: reason.length === 0 ? null : reason,
      failureCode: executed.error.code,
    })
    store.audit.append({
      at: ctx.now,
      actorPersonId: input.decidedBy,
      action: "ledger.action.failed",
      unitPath: action.unitPath,
      capability: null,
      targetType: "financeAction",
      targetId: action.id,
      reason: executed.error.code,
      // **الفشلُ انتقالُ حالٍ لا عدمُه** (`pending` ⟵ `failed`): يُحفظ صراحةً أعلاه، فيُقال.
      before: actionLabel(action),
      after: actionLabel(store.getAction(action.id)!),
    })
    return executed
  }

  store.saveAction({
    ...action,
    status: "approved",
    decidedBy: input.decidedBy,
    decidedAt: ctx.now,
    reasonAr: reason.length === 0 ? null : reason,
    resultEntryId: executed.value.id,
  })
  store.audit.append({
    at: ctx.now,
    actorPersonId: input.decidedBy,
    action: "ledger.action.approve",
    unitPath: action.unitPath,
    capability: null,
    targetType: "financeAction",
    targetId: action.id,
    reason: reason.length === 0 ? null : reason,
    before: actionLabel(action),
    after: actionLabel(store.getAction(action.id)!),
  })
  return ok(store.getAction(action.id)!)
}

/** ما ينتظر بتَّ المعتمِد في نطاقه — بالاحتواء، فلا يرى ما خارج نطاقه. */
export function pendingActionsFor(
  store: LedgerStore,
  unitPath: string,
): readonly PendingAction[] {
  return store.actions().filter((a) => a.status === "pending" && contains(unitPath, a.unitPath))
}
