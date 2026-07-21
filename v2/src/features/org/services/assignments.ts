/**
 * خدمة الإسناد — SPEC_org_and_accounts §٣ (ق-٢٤ انتهاء التكليف يقطع فوراً).
 * تعديلُ التكاليف وإنهاؤها قدرتُه `user.manage` (لرأس القسم/المنطقة) — تُفرَض في الخادم.
 */

import { OrgStore } from "../data/store.js"
import { bumpEpoch } from "./session.js"
import { ok, err, type Result, type StoredAssignment } from "../types.js"

type Clock = { readonly now: Date }

export function endAssignment(
  store: OrgStore,
  ctx: Clock,
  assignmentId: string,
): Result<StoredAssignment> {
  const index = store.assignments.findIndex((a) => a.id === assignmentId)
  if (index === -1) return err("ENTITY_NOT_FOUND")
  const current = store.assignments[index]!
  const ended: StoredAssignment = { ...current, endDate: ctx.now }
  store.assignments[index] = ended
  // الإسناد يخرج من المجموعة الفعّالة في الطلب التالي — لا انتظار انتهاء الرمز (ق-٢٤).
  bumpEpoch(store, current.personId)
  return ok(ended)
}
