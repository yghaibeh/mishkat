/**
 * خدمة الحسابات ودورة الحياة — SPEC_org_and_accounts §٢ (ق-٢٢/ق-٢٣).
 * كلُّ تغيير حالةٍ يرفع الحِقبة فتسقط الجلسات فوراً؛ والإلغاء نهائيّ لا رجعة له.
 */

import { OrgStore } from "../data/store.js"
import { ok, err, type Account, type AccountStatus, type Result } from "../types.js"

export type CreateAccountInput = {
  readonly username: string
}

export function createAccount(store: OrgStore, input: CreateAccountInput): Result<Account> {
  if (store.hasUsername(input.username)) return err("USERNAME_TAKEN")
  const account: Account = {
    tenantId: store.tenantId,
    personId: store.nextId("p"),
    username: input.username,
    status: "active",
    sessionEpoch: 1,
  }
  store.saveAccount(account)
  return ok(account)
}

/** الانتقالات المشروعة (§٢.٢): الملغى نهائيّ، وما عداه قابلٌ للتبديل. */
function isLegalTransition(from: AccountStatus, to: AccountStatus): boolean {
  if (from === "cancelled") return false
  return from !== to
}

export function setStatus(
  store: OrgStore,
  personId: string,
  status: AccountStatus,
): Result<Account> {
  const account = store.getAccount(personId)
  if (account === null) return err("ENTITY_NOT_FOUND")
  if (!isLegalTransition(account.status, status)) return err("INVALID_STATUS_TRANSITION")
  const updated: Account = { ...account, status, sessionEpoch: account.sessionEpoch + 1 }
  store.saveAccount(updated)
  return ok(updated)
}

export function resetPassword(store: OrgStore, personId: string): Result<Account> {
  const account = store.getAccount(personId)
  if (account === null) return err("ENTITY_NOT_FOUND")
  // كلمة المرور نفسها لطبقة البيانات (ملبَّدة قياسياً)؛ هنا الأثرُ الصلاحياتيّ: رفعُ الحِقبة.
  const updated: Account = { ...account, sessionEpoch: account.sessionEpoch + 1 }
  store.saveAccount(updated)
  return ok(updated)
}
