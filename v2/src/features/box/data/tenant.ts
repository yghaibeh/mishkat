/**
 * قب-١٨ — **عزلُ الشبكة في الصندوق** (عقدُ الوحدة §٥).
 *
 * الصندوقُ يعيش على مستودعَين: **دفترُ النواة** (مصدرُ المال) و**مستودعُ الصندوق** (مراجعُه
 * وتوثيقُه). فالعزلُ يقتضي أن يكونا **مقترنَين بشبكةٍ واحدة دائماً** — لا دفترُ شبكةٍ مع
 * مستودعِ أخرى. ولذلك يُوزَّع الاثنان معاً من هنا، فيستحيل الخلطُ بالبناء لا بالانضباط.
 *
 * وكما في النواة: **لا فرعَ شبكةٍ في المحرّك ولا خليةَ في الملفّ الذهبيّ** — مُحلِّلُ النطاق
 * يبحث في مستودع شبكة الفاعل وحدها، فالكيانُ الغريب ⇒ `NO_SCOPE` ⇒ رفض.
 */

import { boxStoresFor, type BoxStores } from "./store.js"

export class BoxTenantRegistry {
  private readonly stores = new Map<string, BoxStores>()

  /**
   * مستودعا الشبكة **مقترنَين** — يُنشآن معاً عند أول طلبٍ ثم يُعادان هما نفسُهما.
   * **وبسجلِّ تدقيقٍ واحدٍ مُحقَن** (شرطُ قب-٤٩): البناءُ من `boxStoresFor` وحدَها، فلا
   * يُنشئ الدفترُ سجلَّه الافتراضيَّ الخاصّ — سجلّان لدفترٍ واحدٍ محوٌ صامتٌ عند القذف.
   */
  storesFor(tenantId: string): BoxStores {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created = boxStoresFor(tenantId)
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
