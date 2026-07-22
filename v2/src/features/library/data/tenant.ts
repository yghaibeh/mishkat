/**
 * قب-١٨ — **عزلُ الشبكة في المكتبة** (عقدُ الوحدة §١١).
 *
 * المادةُ التدريبية محتوىً **يُوجَّه لأشخاصٍ بأسمائهم** ويُتابَع إنجازُهم له: فتسريبُها بين
 * شبكتين يكشف **مَن في الشبكة الأخرى ومَن لم ينجز** — لا المحتوى وحده. فالعزلُ هنا **بنيويّ
 * لا شرطيّ**: الطلبُ يُوجَّه إلى مستودع شبكته، و`tenantId` مشتقٌّ من المستودع لا من مدخل
 * العميل، والمادةُ الغريبة **لا تُحلّ أصلاً** ⇒ `NO_SCOPE` ⇒ رفض.
 *
 * وكما في بقيّة الوحدات: **لا فرعَ شبكةٍ في المحرّك ولا خليةَ في الملفّ الذهبيّ**.
 */

import { LibraryStore } from "./store.js"

export class LibraryTenantRegistry {
  private readonly stores = new Map<string, LibraryStore>()

  /** مستودعُ الشبكة — يُنشأ عند أول طلبٍ ثم يُعاد هو نفسُه. */
  storeFor(tenantId: string): LibraryStore {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created = new LibraryStore(tenantId)
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
