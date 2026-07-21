/**
 * قب-١٨ — **عزلُ الشبكة في اللجان** (عقدُ الوحدة §٥).
 *
 * الوحدةُ تعيش على مستودعٍ واحد، فالعزلُ أن يكون **مستودعُ كل شبكةٍ منفصلاً** ويُوزَّع من
 * هنا حصراً: فلا مِقبضَ عابرٌ بين شبكتين أصلاً، و`tenantId` **مشتقٌّ من المستودع لا من مدخل
 * العميل**. فاعلٌ في شبكةٍ لا يبلغ لجنةَ أخرى **ولو تطابق مسارُها النسبيّ**: مُحلِّلُ النطاق
 * يبحث في مستودع شبكته وحدها ⇒ `NO_SCOPE` ⇒ رفض.
 *
 * **صفر قدرةٍ جديدة وصفر فرعِ شبكةٍ في المحرّك** — كما في النواة والصندوق والاعتماد.
 */

import { CommitteeStore } from "./store.js"

export class CommitteeTenantRegistry {
  private readonly stores = new Map<string, CommitteeStore>()

  /** مستودعُ الشبكة — يُنشأ عند أول طلبٍ ثم يُعاد هو نفسُه. */
  storeFor(tenantId: string): CommitteeStore {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created = new CommitteeStore(tenantId)
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
