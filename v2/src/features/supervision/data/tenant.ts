/**
 * قب-١٨ — **عزلُ الشبكة في الزيارات الإشرافية** (عقدُ الوحدة §٧).
 *
 * مستودعٌ لكل شبكة، فلا مِقبضَ عابرٌ بين شبكتين أصلاً: هدفُ شبكةٍ لا يُبلَغ من أخرى
 * **ولو تطابق مسارُه النسبيّ** — مُحلِّلُ النطاق يبحث في مستودع شبكته وحدها ⇒ `NO_SCOPE`
 * ⇒ رفضٌ **يسبق فحصَ القدرة**. و`tenantId` **مشتقٌّ من المستودع لا من مدخل العميل**.
 */

import { SupervisionStore } from "./store.js"

export class SupervisionTenantRegistry {
  private readonly stores = new Map<string, SupervisionStore>()

  /** مستودعُ الشبكة — يُنشأ موسوماً بها عند أوّل طلبٍ ثم يُعاد هو نفسُه (لا ازدواج). */
  storeFor(tenantId: string): SupervisionStore {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created = new SupervisionStore(tenantId)
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
