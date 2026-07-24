/**
 * قب-١٨ — **عزلُ الشبكة في المسابقة** (عقدُ الوحدة §٦).
 *
 * مستودعٌ لكل شبكة، يُنشأ عند أوّل طلبٍ ثم يُعاد هو نفسُه — فلا مِقبضَ عابرٌ بين شبكتين
 * أصلاً، ولا فرعَ شبكةٍ في المحرّك ولا خليةَ في الملفّ الذهبيّ: مُحلِّلُ النطاق يبحث في
 * مستودع شبكة الطلب وحدها، والمسابقةُ الغريبة ⇒ `NO_SCOPE` ⇒ **رفضٌ يُقفل ولا يُفتح**.
 *
 * وهذا يسري على المسار العامّ كما يسري على المصادَق: الرابطُ العامُّ يكتب في مستودع شبكته،
 * فلا يبلغ به مجهولٌ مسابقةَ شبكةٍ أخرى ولو عرف معرّفَها.
 */

import { CompetitionStore } from "./store.js"

export class CompetitionTenantRegistry {
  private readonly stores = new Map<string, CompetitionStore>()

  storeFor(tenantId: string): CompetitionStore {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created = new CompetitionStore(tenantId)
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
