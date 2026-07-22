/**
 * قب-١٨ — **عزلُ الشبكة في السجلّ اليوميّ** (عقدُ الوحدة §١٢).
 *
 * مستودعٌ لكل شبكة، يُنشأ عند أوّل طلبٍ ثم يُعاد هو نفسُه — فلا مِقبضَ عابرٌ بين شبكتين
 * أصلاً، ولا فرعَ شبكةٍ في المحرّك ولا خليةَ في الملفّ الذهبيّ. وأخصُّ أثرٍ هنا:
 * **رمزُ وليّ الأمر لا يُحلّ إلا في مستودع شبكته** — فرمزان متطابقان في شبكتين لا يفتح
 * أحدُهما بابَ الآخر، وجلسةُ شبكةٍ لا تُقرأ من أخرى ولو تطابق مسارُها النسبيّ.
 */

import { CircleLogStore } from "./store.js"

export class CircleLogTenantRegistry {
  private readonly stores = new Map<string, CircleLogStore>()

  storeFor(tenantId: string): CircleLogStore {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created = new CircleLogStore(tenantId)
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
