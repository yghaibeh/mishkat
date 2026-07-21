/**
 * مشتركاتُ المحرّك — الأنواعُ والحرّاسُ التي تجري على **كل** فعلٍ فيه.
 *
 * وُضعت في مِلفٍّ واحد كي يكون الحارسُ المشترك **مكتوباً مرةً واحدة**: فلو كرّر كلُّ فعلٍ
 * فحصَ القفلِ والحالةِ لنفسه لَتباعدت النسخُ يوماً — وهو بعينه مرضُ v1 (منطقُ اعتمادٍ في
 * كل ميزة). ومنه: `decidable` (النوعُ مسجَّلٌ · الطلبُ قائمٌ · مقدَّمٌ غيرُ مقفل) و`settle`
 * (الاعتمادُ يقفل ويُوسَم طريقُه ويُدوَّن) — يستعملهما البتُّ العاديّ والمخارجُ المحكومة سواءً.
 */

import type { SettingsResolver } from "../../../settings/resolver.js"
import type { Actor } from "../../../authorization/can.js"
import type { ApprovalStore } from "../data/store.js"
import { approvalType, type ApprovalTypeDefinition } from "../registry.js"
import { breakGlassHolders, type ApproverLayer, type RoutingContext } from "./routing.js"
import { isLocked } from "./locking.js"
import type { CapabilityCheck } from "./authority.js"
import {
  approvalErr,
  approvalOk,
  type ApprovalPayload,
  type ApprovalPeriod,
  type ApprovalRequest,
  type ApprovalResult,
  type ApprovalRoute,
} from "../types.js"

/** مُولِّدُ الحمولة: **تُشتقّ ولا تُدخَل** (ق-٦٧) — يُحقن مع سياق الطلب. */
export type ApprovalPayloadSource = (
  typeId: string,
  unitPath: string,
  period: ApprovalPeriod,
) => ApprovalPayload

export type ApprovalContext = {
  readonly now: Date
  readonly actorPersonId: string
  readonly settings: SettingsResolver
  /** لقطةُ الفاعلين المحقونة (§٤.٥) — لا استعلامَ في الخدمة. */
  readonly people: readonly Actor[]
  readonly holds: CapabilityCheck
  readonly payloadFor: ApprovalPayloadSource
}

export type SubmitInput = {
  readonly typeId: string
  readonly unitPath: string
  readonly period: ApprovalPeriod
}

export type DecideInput = {
  readonly requestId: string
  readonly reasonAr?: string
}

export function routingOf(ctx: ApprovalContext): RoutingContext {
  return { now: ctx.now, people: ctx.people, holds: ctx.holds }
}

/** تجميدٌ عميق — الحمولةُ تُختم عند التقديم فلا تُبدَّل بين التقديم والبتّ. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

export function isEmptyPayload(payload: ApprovalPayload): boolean {
  return Object.keys(payload).length === 0
}

export function audit(
  store: ApprovalStore,
  ctx: ApprovalContext,
  request: ApprovalRequest,
  action: string,
  reason: string | null,
): void {
  store.appendAudit({
    at: ctx.now,
    actorPersonId: ctx.actorPersonId,
    action,
    targetId: request.id,
    scopePath: request.unitPath,
    reason,
  })
}

/** ق-١١ — الإشعارُ **يتبع التوجيه**: الأقربُ وحده، وعند الشغور الكليّ حاملو كسر الزجاج. */
export function noticeTargets(ctx: ApprovalContext, layer: ApproverLayer): readonly string[] {
  return layer.kind === "layer" ? layer.approvers : breakGlassHolders(routingOf(ctx))
}

/** ق-٩ — الحارسُ على **الشخص**: مقدِّمُ العمل لا يبتّه بأيّ طريقٍ من الطرق الثلاثة. */
export function isSubmitter(request: ApprovalRequest, personId: string): boolean {
  return request.submittedBy === personId
}

export type Decidable = {
  readonly request: ApprovalRequest
  readonly definition: ApprovalTypeDefinition
}

/** الحرّاسُ المشتركون قبل أيّ بتّ: النوعُ مسجَّل · الطلبُ قائم · مقدَّمٌ غيرُ مقفل. */
export function decidable(store: ApprovalStore, requestId: string): ApprovalResult<Decidable> {
  const request = store.getRequest(requestId)
  if (request === null) return approvalErr("REQUEST_NOT_FOUND", requestId)
  const definition = approvalType(request.typeId)
  if (definition === null) return approvalErr("UNKNOWN_APPROVAL_TYPE", request.typeId)
  // ق-٨: القفلُ يسبق كلَّ شيء — لا كتابةَ على معتمَد.
  if (isLocked(request)) return approvalErr("LOCKED", requestId)
  // ب-٣٠أ: **لا اعتمادَ لمسودة** — والتجاوزُ المنسوخ لا يُقرأ إعداداً ولا يُستثنى فرعاً.
  if (request.state !== "submitted") return approvalErr("NOT_SUBMITTED", requestId)
  return approvalOk({ request, definition })
}

export function settle(
  store: ApprovalStore,
  ctx: ApprovalContext,
  request: ApprovalRequest,
  route: ApprovalRoute,
  reason: string | null,
): ApprovalRequest {
  const approved: ApprovalRequest = {
    ...request,
    state: "approved",
    approvedBy: ctx.actorPersonId,
    approvedAt: ctx.now,
    route,
    // ق-٨: الاعتمادُ يقفل — أثرٌ معلنٌ في عقد النوع (`approvalLocks`).
    lockedAt: ctx.now,
  }
  store.saveRequest(approved)
  audit(store, ctx, approved, `approval.${route === "nearest" ? "approve" : route}`, reason)
  return store.getRequest(approved.id)!
}

