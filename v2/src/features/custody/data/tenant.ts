/**
 * قب-١٨ — **عزلُ الشبكة في العُهد** (عقدُ الوحدة §٦).
 *
 * مستودعٌ لكل شبكة، يُنشأ عند أوّل طلبٍ ثم يُعاد هو نفسُه — فلا مِقبضَ عابرٌ بين شبكتين
 * أصلاً، ولا فرعَ شبكةٍ في المحرّك ولا خليةَ في الملفّ الذهبيّ: مُحلِّلُ النطاق يبحث في
 * مستودع شبكة الطلب وحدها، والوحدةُ الغريبة ⇒ `NO_SCOPE` ⇒ **رفضٌ يُقفل ولا يُفتح**.
 */

import { CustodyStore } from "./store.js"

export class CustodyTenantRegistry {
  private readonly stores = new Map<string, CustodyStore>()

  storeFor(tenantId: string): CustodyStore {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created = new CustodyStore(tenantId)
    this.stores.set(tenantId, created)
    return created
  }

  has(tenantId: string): boolean {
    return this.stores.has(tenantId)
  }

  tenantIds(): string[] {
    return [...this.stores.keys()]
  }
}
