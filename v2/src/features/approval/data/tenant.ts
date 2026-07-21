/**
 * قب-١٨ — **عزلُ الشبكة في الاعتماد** (عقدُ الوحدة §٨).
 *
 * المحرّكُ يعيش على ثلاثة مستودعات: **دفترُ النواة** (مصدرُ حمولة الإقفال) و**مستودعُ
 * الصندوق** و**مستودعُ الاعتماد**. فالعزلُ يقتضي أن تكون **مقترنةً بشبكةٍ واحدةٍ دائماً** —
 * ولذلك تُوزَّع الثلاثةُ معاً من هنا، فيستحيل الخلطُ **بالبناء لا بالانضباط**.
 *
 * وكما في النواة والصندوق: **لا فرعَ شبكةٍ في المحرّك ولا خليةَ في الملفّ الذهبيّ** —
 * مُحلِّلُ النطاق يبحث في مستودع شبكة الفاعل وحدها، فالكيانُ الغريب ⇒ `NO_SCOPE` ⇒ رفض.
 */

import { BoxStore, type BoxStores } from "../../box/data/store.js"
import { LedgerStore } from "../../ledger/data/store.js"
import { ApprovalStore } from "./store.js"

export type ApprovalStores = {
  readonly box: BoxStores
  readonly approval: ApprovalStore
}

export class ApprovalTenantRegistry {
  private readonly stores = new Map<string, ApprovalStores>()

  /** مستودعاتُ الشبكة **مقترنةً** — تُنشأ معاً عند أول طلبٍ ثم تُعاد هي نفسُها. */
  storesFor(tenantId: string): ApprovalStores {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created: ApprovalStores = {
      box: { ledger: new LedgerStore(tenantId), box: new BoxStore(tenantId) },
      approval: new ApprovalStore(tenantId),
    }
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
