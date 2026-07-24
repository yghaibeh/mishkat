/**
 * قب-١٨ — **عزلُ الشبكة في الرواتب** (عقدُ الوحدة §١٢).
 *
 * الرواتبُ تعيش على مستودعَين: **دفترُ النواة** (مصدرُ المال) و**مستودعُ الرواتب** (وقائعُه
 * وتوثيقُه). فالعزلُ يقتضي أن يكونا **مقترنَين بشبكةٍ واحدة دائماً** — لا دفترُ شبكةٍ مع
 * مستودعِ أخرى. ولذلك يُوزَّع الاثنان معاً من هنا، فيستحيل الخلطُ **بالبناء لا بالانضباط**.
 *
 * وكما في النواة: **لا فرعَ شبكةٍ في المحرّك ولا خليةَ في الملفّ الذهبيّ** — مُحلِّلُ النطاق
 * يبحث في مستودع شبكة الفاعل وحدها، فالكيانُ الغريب ⇒ `NO_SCOPE` ⇒ رفض. **ولو تطابق
 * المسارُ النسبيُّ بين شبكتين** (وهو ما تتعمّده بذرةُ الاختبار) لم يبلغ أحدُهما الآخر.
 */

import { payrollStoresFor, type PayrollStores } from "./store.js"

export class PayrollTenantRegistry {
  private readonly stores = new Map<string, PayrollStores>()

  /**
   * مستودعا الشبكة **مقترنَين** — يُنشآن معاً عند أول طلبٍ ثم يُعادان هما نفسُهما.
   * **وبسجلِّ تدقيقٍ واحدٍ مُحقَن** (شرطُ قب-٤٩) — انظر مسوّغَه في رأس `store.ts`.
   */
  storesFor(tenantId: string): PayrollStores {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created = payrollStoresFor(tenantId)
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
