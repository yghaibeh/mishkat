/**
 * جذر الشبكة (Tenant) — SPEC_org_and_accounts §١.٠ (قب-١٨/CR-006).
 *
 * فوق القسمين **شبكةٌ (tenant) جذراً حقيقياً**. النموذج مهيّأٌ للتعدّد وإن شغّلنا **شبكةً
 * واحدة** اليوم (قب-١٨). العزلُ **بنيويٌّ في طبقة البيانات**: مستودعٌ مقسَّمٌ بالشبكة، فكلُّ
 * استعلامٍ يمرّ بمستودع شبكته — لا فرعَ شبكةٍ في المحرّك ولا خليةٌ جديدة في الملفّ الذهبي.
 *
 * **`tenantId` يُشتقّ من سياق المستودع لا من مدخل العميل** — نظيرُ اشتقاق النطاق (§٥.٢):
 * المستودعُ يعرف شبكتَه، فيختمها على كلّ كيانٍ يحفظه، فلا يُصعّد أحدٌ شبكتَه بمدخلٍ ملفَّق.
 */

import { OrgStore } from "./store.js"

// معرّفُ الشبكة المبذورة يعيش في `store.js` (يختمه المستودعُ افتراضاً) ويُعاد تصديرُه هنا
// حيث يعيش مفهومُ الشبكة — فلا حلقةَ استيراد بين الملفّين.
export { DEFAULT_TENANT_ID } from "./store.js"

/**
 * العنوانُ المادّي الكونيّ للكيان: **بادئتُه معرّفُ الشبكة** (§١.٠). هو مفتاحُ التخزين
 * المستقبليّ في D1 حيث يُجمع كلُّ الشبكات في جدولٍ واحد ويُفصَل بـ`tenantId`. أمّا مسارُ
 * النطاق الذي يراه المحرّك فيبقى نسبيّاً للشبكة (`path`) — فالملفّ الذهبيّ لا يُمسّ.
 */
export function globalPath(tenantId: string, path: string): string {
  return `/${tenantId}${path}`
}

/**
 * سجلُّ الشبكات — يوجّه كلَّ استعلامٍ إلى **مستودع شبكته**. المستودعُ لكلّ شبكةٍ منفصلٌ
 * فيستحيل بلوغُ كيانِ شبكةٍ من أخرى: لا يوجد مِقبضٌ عابرٌ أصلاً (عزلٌ بنيويّ لا فحصٌ زمنيّ).
 */
export class TenantRegistry {
  private readonly stores = new Map<string, OrgStore>()

  /** مستودعُ الشبكة — يُنشأ موسوماً بها عند أوّل طلبٍ ثم يُعاد هو نفسُه (لا ازدواج). */
  storeFor(tenantId: string): OrgStore {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created = new OrgStore(tenantId)
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
