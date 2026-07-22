/**
 * قب-١٨ — **عزلُ الشبكة في الإشعارات** (عقدُ الوحدة §١٠).
 *
 * الإشعارُ **يخرج من النظام إلى هاتفٍ خارجه**: تسريبُه أخطرُ من تسريب شاشة، لأنه يصل قناةً
 * لا يملكها النظامُ ولا يسترجعه منها. فالعزلُ هنا **بنيويّ لا شرطيّ**: الطلبُ يُوجَّه إلى
 * مستودع شبكته، و`tenantId` مشتقٌّ من المستودع لا من مدخل العميل، وطابورُ شبكةٍ لا يُصرَّف
 * من أخرى أصلاً.
 *
 * وكما في بقيّة الوحدات: **لا فرعَ شبكةٍ في المحرّك ولا خليةَ في الملفّ الذهبيّ**.
 */

import { NotificationStore } from "./store.js"

export class NotificationTenantRegistry {
  private readonly stores = new Map<string, NotificationStore>()

  /** مستودعُ الشبكة — يُنشأ عند أول طلبٍ ثم يُعاد هو نفسُه. */
  storeFor(tenantId: string): NotificationStore {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created = new NotificationStore(tenantId)
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
