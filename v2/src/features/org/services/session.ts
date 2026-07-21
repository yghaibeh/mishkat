/**
 * لقطة الصلاحية — SPEC_authorization §٤.٥: تُحسب مرةً وتُحمل في الجلسة.
 * تبني `Actor` للمحرك من المستودع: الحساب + الإسنادات + وسمُ أرشفة السلَف.
 * الإبطالُ اللحظيّ برفع الحِقبة (ق-٢٣): كل تغييرٍ يمسّ الصلاحية يرفع `sessionEpoch`.
 */

import type { Actor, Assignment } from "../../../authorization/can.js"
import { OrgStore } from "../data/store.js"
import type { OrgUnit } from "../types.js"

/** هل الوحدة أو أحدُ سلَفها مؤرشف؟ (الأرشفة تسري نازلةً — §١.٤.) */
function ancestorArchived(store: OrgStore, unitId: string): boolean {
  let cur: OrgUnit | null = store.getUnit(unitId)
  while (cur !== null) {
    if (cur.archived) return true
    cur = cur.parentId === null ? null : store.getUnit(cur.parentId)
  }
  return false
}

/**
 * لقطةٌ لا-زمنيّة: التصفيةُ الزمنية للإسنادات تقع في `can()` بساعة الطلب لا هنا.
 */
export function buildActor(store: OrgStore, personId: string): Actor {
  const account = store.getAccount(personId)
  if (account === null) {
    throw new Error(`لا حساب بهذا المعرّف في المستودع: ${personId}`)
  }
  const assignments: Assignment[] = store.assignmentsForPerson(personId).map((a) => ({
    roleId: a.roleId,
    scopePath: a.scopePath,
    startDate: a.startDate,
    endDate: a.endDate,
    approvalStatus: a.approvalStatus,
    unitArchived: ancestorArchived(store, a.unitId),
  }))
  return {
    personId,
    accountStatus: account.status,
    sessionEpoch: account.sessionEpoch,
    currentSessionEpoch: account.sessionEpoch,
    assignments,
    overrides: [],
  }
}

/** رفعُ الحِقبة فتسقط الرموز القديمة فوراً على كل الأجهزة (ق-٢٣). */
export function bumpEpoch(store: OrgStore, personId: string): void {
  const account = store.getAccount(personId)
  if (account === null) return
  store.saveAccount({ ...account, sessionEpoch: account.sessionEpoch + 1 })
}

/** أرشفةُ وحدةٍ ترفع حِقبة كل المكلَّفين عليها وعلى ما تحتها (§٤.٥). */
export function bumpEpochsUnderPath(store: OrgStore, path: string): void {
  const affected = new Set<string>()
  for (const a of store.assignments) {
    if (a.scopePath.startsWith(path)) affected.add(a.personId)
  }
  for (const personId of affected) bumpEpoch(store, personId)
}
