/**
 * **المخارجُ الثلاثة المحكومة** (عقدُ الوحدة §٣) — كلٌّ بابٌ ضيّقٌ **بأثرٍ مدقَّقٍ ظاهر**:
 * كسرُ الزجاج (ق-٣) · التدخلُ الفوقيّ (ق-١٢) · تعديلُ المقفل (ق-٨).
 *
 * فُصلت عن الطريق العاديّ عمداً: **الاستثناءُ يُقرأ استثناءً** ولا يختبئ بين فروع الفعل
 * المعتاد. وكلُّها تمرّ بحرّاس `shared.ts` نفسِها — فلا مسارَ يلتفّ على القفل أو الحالة.
 */

import type { ApprovalStore } from "../data/store.js"
import { approverLayerFor, breakGlassHolders, isAboveLayer, isAboveUnit, EDIT_LOCKED } from "./routing.js"
import { isLocked } from "./locking.js"
import {
  audit,
  decidable,
  isSubmitter,
  routingOf,
  settle,
  type ApprovalContext,
  type DecideInput,
} from "./shared.js"
import { approvalErr, approvalOk, type ApprovalRequest, type ApprovalResult } from "../types.js"

/**
 * ق-١٢ — **التدخلُ الفوقيّ**: سلَفٌ **أعلى** من الأقرب بقدرةٍ صريحةٍ وبسببٍ مدوَّن.
 * والإدارةُ ممنوعةٌ نصاً — **من المصفوفة** لا بفرعٍ هنا (`admin × report.approve.override` = `·`).
 */
export function overrideApprove(
  store: ApprovalStore,
  ctx: ApprovalContext,
  input: DecideInput,
): ApprovalResult<ApprovalRequest> {
  const gate = decidable(store, input.requestId)
  if (!gate.ok) return gate
  const { request, definition } = gate.value

  const capability = definition.overrideCapability
  if (capability === null) return approvalErr("OVERRIDE_NOT_AVAILABLE", definition.id)
  if (!ctx.holds(ctx.actorPersonId, capability, request.unitPath)) {
    return approvalErr("NO_OVERRIDE_CAPABILITY", ctx.actorPersonId)
  }
  const reason = (input.reasonAr ?? "").trim()
  if (reason.length === 0) return approvalErr("REASON_REQUIRED", request.id)

  const layer = approverLayerFor(routingOf(ctx), definition.approveCapability, request.unitPath)
  const above =
    layer.kind === "layer"
      ? isAboveLayer(routingOf(ctx), ctx.actorPersonId, layer.scopePath)
      : isAboveUnit(routingOf(ctx), ctx.actorPersonId, request.unitPath)
  if (!above) return approvalErr("NOT_ABOVE_NEAREST", ctx.actorPersonId)
  if (isSubmitter(request, ctx.actorPersonId)) {
    return approvalErr("SELF_APPROVAL_REJECTED", ctx.actorPersonId)
  }
  return approvalOk(settle(store, ctx, request, "override", reason))
}

/** ق-٣ — **كسرُ الزجاج**: عند شغور كل الطبقات وحده، بقدرةٍ جذرية وبأثرٍ مدقَّقٍ متميّز. */
export function breakGlassApprove(
  store: ApprovalStore,
  ctx: ApprovalContext,
  input: DecideInput,
): ApprovalResult<ApprovalRequest> {
  const gate = decidable(store, input.requestId)
  if (!gate.ok) return gate
  const { request, definition } = gate.value

  if (!breakGlassHolders(routingOf(ctx)).includes(ctx.actorPersonId)) {
    return approvalErr("NO_BREAK_GLASS_CAPABILITY", ctx.actorPersonId)
  }
  const layer = approverLayerFor(routingOf(ctx), definition.approveCapability, request.unitPath)
  if (layer.kind === "layer") return approvalErr("LAYER_NOT_VACANT", layer.scopePath)
  if (isSubmitter(request, ctx.actorPersonId)) {
    return approvalErr("SELF_APPROVAL_REJECTED", ctx.actorPersonId)
  }
  return approvalOk(settle(store, ctx, request, "breakGlass", input.reasonAr ?? null))
}

/**
 * ق-٨ — **تعديلُ المقفل للطبقات الأعلى حصراً**: قدرةُ `records.editLocked` **مع** تكليفٍ
 * عند سلَفٍ صارمٍ فوق الوحدة، وبسببٍ مدوَّن. يفتح المعتمَدَ مسودةً فيُعاد تقديمُه بالسلسلة.
 */
export function amendLocked(
  store: ApprovalStore,
  ctx: ApprovalContext,
  input: DecideInput,
): ApprovalResult<ApprovalRequest> {
  const request = store.getRequest(input.requestId)
  if (request === null) return approvalErr("REQUEST_NOT_FOUND", input.requestId)
  if (!isLocked(request)) return approvalErr("NOT_SUBMITTED", input.requestId)

  const authorized =
    ctx.holds(ctx.actorPersonId, EDIT_LOCKED, request.unitPath) &&
    isAboveUnit(routingOf(ctx), ctx.actorPersonId, request.unitPath)
  if (!authorized) return approvalErr("NOT_ABOVE_UNIT", ctx.actorPersonId)

  const reason = (input.reasonAr ?? "").trim()
  if (reason.length === 0) return approvalErr("REASON_REQUIRED", request.id)

  const reopened: ApprovalRequest = {
    ...request,
    state: "draft",
    approvedBy: null,
    approvedAt: null,
    route: null,
    lockedAt: null,
  }
  store.saveRequest(reopened)
  audit(store, ctx, reopened, "approval.amendLocked", reason)
  return approvalOk(store.getRequest(request.id)!)
}

