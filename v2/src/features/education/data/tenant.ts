/**
 * قب-١٨ — **عزلُ الشبكة في وحدة التعليم** (عقدُ الوحدة §١٠).
 *
 * مستودعٌ لكل شبكة، يُنشأ عند أوّل طلبٍ ثم يُعاد هو نفسُه — فلا مِقبضَ عابرٌ بين شبكتين
 * أصلاً، ولا فرعَ شبكةٍ في المحرّك ولا خليةَ في الملفّ الذهبيّ: مُحلِّلُ النطاق يقرأ الحلقةَ
 * من **منفذِ شبكة الطلب** وحدها، والغريبةُ ⇒ `NO_SCOPE` ⇒ **رفضٌ يُقفل ولا يُفتح**.
 */

import { EducationStore } from "./store.js"

export class EducationTenantRegistry {
  private readonly stores = new Map<string, EducationStore>()

  storeFor(tenantId: string): EducationStore {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created = new EducationStore(tenantId)
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
