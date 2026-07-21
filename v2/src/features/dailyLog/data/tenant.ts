/**
 * قب-١٨ — **عزلُ الشبكة في سجل اليوم** (عقدُ الوحدة §٧).
 *
 * مستودعٌ لكل شبكة، فلا مِقبضَ عابرٌ بين شبكتين أصلاً: وحدةُ شبكةٍ لا تُبلَغ من أخرى
 * **ولو تطابق مسارُها النسبيّ** — مُحلِّلُ النطاق يبحث في مستودع شبكته وحدها ⇒ `NO_SCOPE`
 * ⇒ رفض. و`tenantId` **مشتقٌّ من المستودع لا من مدخل العميل**.
 *
 * **صفر قدرةٍ جديدة وصفر فرعِ شبكةٍ في المحرّك** — العزلُ بنيويٌّ لا فحصٌ زمنيّ.
 */

import { DailyLogStore } from "./store.js"

export class DailyLogTenantRegistry {
  private readonly stores = new Map<string, DailyLogStore>()

  /** مستودعُ الشبكة — يُنشأ موسوماً بها عند أوّل طلبٍ ثم يُعاد هو نفسُه (لا ازدواج). */
  storeFor(tenantId: string): DailyLogStore {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created = new DailyLogStore(tenantId)
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
