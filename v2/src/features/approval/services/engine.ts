/**
 * **آلةُ حالات المحرّك** — الطريقُ العاديّ الذي تمرّ به كلُّ موافقةٍ في مِشكاة
 * (عقدُ الوحدة §٢): تقديمٌ ⟵ اعتمادُ الأقرب أو رفضُه ⟵ وسحبُ المقدِّم قبلهما.
 *
 * والترتيبُ في كل فعلٍ ملزمٌ ويُختبر بترتيبه: **الحالةُ أولاً** (فلا يُفتح بابٌ على مقفل —
 * `decidable` في `shared.ts`)، ثم **الأقربيّةُ** (شرطُ الكفاية)، ثم **الهويّةُ** (ق-٩ على
 * الشخص لا على الدور).
 *
 * وما **ليس** هنا مقصودٌ كما هو هنا:
 *  - لا فحصَ دورٍ ولا قائمةَ طبقات (G6) — السؤالُ الوحيد «أيملك القدرةَ على النطاق؟».
 *  - لا قراءةَ لإعدادٍ يعطّل حارساً (CR-008): `approval.draft_bypass_enabled` **لا يُقرأ**
 *    إطلاقاً، فتجاوزُ ق-٦ المنسوخُ بب-٣٠أ لا أثرَ له بأي صورة.
 *  - لا رقمَ تشغيليّ (G14): المددُ كلُّها من `locking.ts` أي من سجل الإعدادات.
 *  - والمخارجُ المحكومة في `exceptions.ts`، وصناديقُ الانتظار في `inbox.ts`.
 */

import type { ApprovalStore } from "../data/store.js"
import { approvalType } from "../registry.js"
import { EDIT_LOCKED, approverLayerFor } from "./routing.js"
import { isLocked, isPeriodTimeLocked, isWithdrawalEnabled } from "./locking.js"
import {
  audit,
  decidable,
  deepFreeze,
  isEmptyPayload,
  isSubmitter,
  noticeTargets,
  routingOf,
  settle,
  type ApprovalContext,
  type DecideInput,
  type SubmitInput,
} from "./shared.js"
import { approvalErr, approvalOk, type ApprovalRequest, type ApprovalResult } from "../types.js"

export type { ApprovalContext, ApprovalPayloadSource, DecideInput, SubmitInput } from "./shared.js"

/**
 * **التقديم** (ق-٥ · ق-٦٧ · ب-٣٩د): يُنشئ الطلبَ أو يُعيد المردودَ إلى الطابور،
 * وحمولتُه **مشتقّةٌ** من مصدرها لا من مدخل المقدِّم.
 */
export function submitForApproval(
  store: ApprovalStore,
  ctx: ApprovalContext,
  input: SubmitInput,
): ApprovalResult<ApprovalRequest> {
  const definition = approvalType(input.typeId)
  if (definition === null) return approvalErr("UNKNOWN_APPROVAL_TYPE", input.typeId)

  const existing = store.findByKey(input.typeId, input.unitPath, input.period.id)
  // ق-٦٧: لا إقفالَ مرتين — والمعتمَدُ مقفلٌ لا يُعاد تقديمُه (ق-٨).
  if (existing !== null && isLocked(existing)) return approvalErr("DUPLICATE_PERIOD", existing.id)
  if (existing !== null && existing.state === "submitted") {
    return approvalErr("ALREADY_SUBMITTED", existing.id)
  }

  // ب-٣٩د: القفلُ الزمنيّ **من الإعداد** — إلا لحامل قدرةِ تعديل المقفل (ق-٨).
  if (
    isPeriodTimeLocked(ctx, input.unitPath, input.period) &&
    !ctx.holds(ctx.actorPersonId, EDIT_LOCKED, input.unitPath)
  ) {
    return approvalErr("PERIOD_TIME_LOCKED", input.period.id)
  }

  const payload = deepFreeze(ctx.payloadFor(input.typeId, input.unitPath, input.period))
  if (definition.payloadRequired && isEmptyPayload(payload)) {
    return approvalErr("EMPTY_PAYLOAD", input.typeId)
  }

  const layer = approverLayerFor(routingOf(ctx), definition.approveCapability, input.unitPath)

  return store.transaction(() => {
    const id = existing?.id ?? store.nextId("apr")
    const request: ApprovalRequest = {
      tenantId: store.tenantId,
      id,
      typeId: input.typeId,
      unitPath: input.unitPath,
      period: input.period,
      state: "submitted",
      payload,
      submittedBy: ctx.actorPersonId,
      submittedAt: ctx.now,
      approvedBy: null,
      approvedAt: null,
      route: null,
      lockedAt: null,
      lastRejection: existing?.lastRejection ?? null,
    }
    store.saveRequest(request)
    // ق-١١: الإشعارُ عند **التقديم** لا عند كل إدخال، وللأقرب وحده.
    store.appendNotice({
      at: ctx.now,
      kind: "approvalNeeded",
      requestId: id,
      recipients: noticeTargets(ctx, layer),
    })
    audit(store, ctx, request, "approval.submit", null)
    return approvalOk(store.getRequest(id)!)
  })
}

/** **الاعتماد بالطريق العاديّ**: الأقربُ النشطُ وحده (ق-١) وليس مقدِّمَ العمل (ق-٩). */
export function approveRequest(
  store: ApprovalStore,
  ctx: ApprovalContext,
  input: DecideInput,
): ApprovalResult<ApprovalRequest> {
  const gate = decidable(store, input.requestId)
  if (!gate.ok) return gate
  const { request, definition } = gate.value

  const layer = approverLayerFor(routingOf(ctx), definition.approveCapability, request.unitPath)
  if (layer.kind !== "layer" || !layer.approvers.includes(ctx.actorPersonId)) {
    return approvalErr("NOT_NEAREST_LAYER", ctx.actorPersonId)
  }
  if (isSubmitter(request, ctx.actorPersonId)) {
    return approvalErr("SELF_APPROVAL_REJECTED", ctx.actorPersonId)
  }
  return approvalOk(settle(store, ctx, request, "nearest", null))
}

/** ق-٧ — **الرفضُ بسببٍ إلزاميّ**: يعيد الحالةَ مسودةً ويُشعر المقدِّم. */
export function rejectRequest(
  store: ApprovalStore,
  ctx: ApprovalContext,
  input: DecideInput,
): ApprovalResult<ApprovalRequest> {
  const gate = decidable(store, input.requestId)
  if (!gate.ok) return gate
  const { request, definition } = gate.value

  const layer = approverLayerFor(routingOf(ctx), definition.approveCapability, request.unitPath)
  if (layer.kind !== "layer" || !layer.approvers.includes(ctx.actorPersonId)) {
    return approvalErr("NOT_NEAREST_LAYER", ctx.actorPersonId)
  }
  const reason = (input.reasonAr ?? "").trim()
  if (definition.rejectionRequiresReason && reason.length === 0) {
    return approvalErr("REASON_REQUIRED", request.id)
  }

  return store.transaction(() => {
    const returned: ApprovalRequest = {
      ...request,
      state: "draft",
      lastRejection: { by: ctx.actorPersonId, at: ctx.now, reasonAr: reason },
    }
    store.saveRequest(returned)
    // ق-٧: يُشعَر **المقدِّم** ليصحّح ويعيد التقديم — لا الطبقاتُ الأخرى.
    store.appendNotice({
      at: ctx.now,
      kind: "rejected",
      requestId: request.id,
      recipients: request.submittedBy === null ? [] : [request.submittedBy],
    })
    audit(store, ctx, returned, "approval.reject", reason)
    return approvalOk(store.getRequest(request.id)!)
  })
}

/** ب-٣٠ج — **السحبُ للمقدِّم قبل الاعتماد وحده**، ولنوعٍ يعلن قدرةَ سحب. */
export function retractSubmission(
  store: ApprovalStore,
  ctx: ApprovalContext,
  input: DecideInput,
): ApprovalResult<ApprovalRequest> {
  const gate = decidable(store, input.requestId)
  if (!gate.ok) return gate
  const { request, definition } = gate.value

  if (definition.retractCapability === null) {
    return approvalErr("RETRACT_NOT_AVAILABLE", definition.id)
  }
  if (!isWithdrawalEnabled(ctx, request.unitPath)) {
    return approvalErr("RETRACT_DISABLED", definition.id)
  }
  if (!isSubmitter(request, ctx.actorPersonId)) {
    return approvalErr("NOT_SUBMITTER", ctx.actorPersonId)
  }

  const withdrawn: ApprovalRequest = { ...request, state: "draft" }
  store.saveRequest(withdrawn)
  audit(store, ctx, withdrawn, "approval.retract", null)
  return approvalOk(store.getRequest(request.id)!)
}

