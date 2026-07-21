/**
 * **صندوقا الانتظار والتذكير** (عقدُ الوحدة §٤) — قراءةٌ لا كتابةَ حالةٍ إلا الإشعار.
 *
 * وكلاهما **يشتقّ وجهتَه من التوجيه نفسِه** (`approverLayerFor`) لا من قائمةٍ موازية:
 * فلا يمكن أن يظهر عملٌ في صندوق مَن لا يعتمده (ع-٢٢)، ولا أن يصل تذكيرٌ غيرَ الأقرب (ق-١١).
 */

import type { ApprovalStore } from "../data/store.js"
import { approvalType } from "../registry.js"
import { approverLayerFor, withinScope } from "./routing.js"
import { escalationDays } from "./locking.js"
import { isSubmitter, noticeTargets, routingOf, type ApprovalContext } from "./shared.js"
import type { ApprovalNotice, ApprovalRequest } from "../types.js"

/** صندوقُ «بانتظار اعتمادك»: ما أنا **الأقربُ** له داخلَ نطاقي (ق-١ + ق-١٧). */
export function pendingForApprover(
  store: ApprovalStore,
  ctx: ApprovalContext,
  input: { readonly typeId: string; readonly scopePath: string },
): readonly ApprovalRequest[] {
  const definition = approvalType(input.typeId)
  if (definition === null) return []
  return store.requests().filter((r) => {
    if (r.typeId !== input.typeId || r.state !== "submitted") return false
    if (!withinScope(input.scopePath, r.unitPath)) return false
    if (isSubmitter(r, ctx.actorPersonId)) return false
    const layer = approverLayerFor(routingOf(ctx), definition.approveCapability, r.unitPath)
    return layer.kind === "layer" && layer.approvers.includes(ctx.actorPersonId)
  })
}

/**
 * ب-٣٠ب — **التصعيدُ إشعاريٌّ لا يفتح صلاحية**: بعد المدة المضبوطة يُذكَّر **المرشّحون
 * أنفسُهم**؛ والتوجيهُ لا يتغيّر ولا يُمنح أحدٌ قدرةً بمرور الزمن.
 */
export function escalationNoticesFor(
  store: ApprovalStore,
  ctx: ApprovalContext,
  input: { readonly typeId: string },
): readonly ApprovalNotice[] {
  const definition = approvalType(input.typeId)
  if (definition === null) return []
  const out: ApprovalNotice[] = []
  for (const request of store.requests()) {
    if (request.typeId !== input.typeId || request.state !== "submitted") continue
    const days = escalationDays(ctx, request.unitPath)
    // حالةُ «مقدَّم» تضمن ختمَ التقديم — والحالةُ المستحيلةُ التي لا تُختبر لا تُكتب.
    const due = new Date(request.submittedAt!.getTime())
    due.setUTCDate(due.getUTCDate() + days)
    if (ctx.now.getTime() < due.getTime()) continue
    const layer = approverLayerFor(routingOf(ctx), definition.approveCapability, request.unitPath)
    const notice: Omit<ApprovalNotice, "tenantId"> = {
      at: ctx.now,
      kind: "escalation",
      requestId: request.id,
      recipients: noticeTargets(ctx, layer),
    }
    store.appendNotice(notice)
    out.push({ ...notice, tenantId: store.tenantId })
  }
  return out
}
