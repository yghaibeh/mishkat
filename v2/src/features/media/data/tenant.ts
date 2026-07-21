/**
 * قب-١٨ — **عزلُ الشبكة في الإعلام** (عقدُ الوحدة §١٠).
 *
 * الوسائطُ أخطرُ ما يتسرّب: صورةُ مسجدٍ في شبكةٍ تظهر في معرض شبكةٍ أخرى **لا تُسترجَع**
 * بعد أن تُرى. فالعزلُ هنا **بنيويّ لا شرطيّ**: الطلبُ يُوجَّه إلى مستودع شبكته، و`tenantId`
 * مشتقٌّ من المستودع لا من مدخل العميل، والوحدةُ الغريبة **لا تُحلّ أصلاً** ⇒ `NO_SCOPE` ⇒ رفض.
 *
 * وكما في بقيّة الوحدات: **لا فرعَ شبكةٍ في المحرّك ولا خليةَ في الملفّ الذهبيّ**.
 */

import { MediaStore } from "./store.js"

export class MediaTenantRegistry {
  private readonly stores = new Map<string, MediaStore>()

  /** مستودعُ الشبكة — يُنشأ عند أول طلبٍ ثم يُعاد هو نفسُه. */
  storeFor(tenantId: string): MediaStore {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created = new MediaStore(tenantId)
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
