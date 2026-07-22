/**
 * قب-١٨ — **عزلُ الشبكة في الحلقات** (عقدُ الوحدة §١٠).
 *
 * مستودعٌ لكل شبكة، يُنشأ عند أوّل طلبٍ ثم يُعاد هو نفسُه — فلا مِقبضَ عابرٌ بين شبكتين
 * أصلاً، ولا فرعَ شبكةٍ في المحرّك ولا خليةَ في الملفّ الذهبيّ: مُحلِّلُ النطاق يبحث في
 * مستودع شبكة الطلب وحدها، والحلقةُ الغريبة ⇒ `NO_SCOPE` ⇒ **رفضٌ يُقفل ولا يُفتح**.
 */

import { CirclesStore } from "./store.js"

export class CirclesTenantRegistry {
  private readonly stores = new Map<string, CirclesStore>()

  storeFor(tenantId: string): CirclesStore {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created = new CirclesStore(tenantId)
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
