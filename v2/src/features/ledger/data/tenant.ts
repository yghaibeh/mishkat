/**
 * عزلُ الشبكة في المال — قب-١٨/CR-006 (`SPEC_finance_ledger` §٨.١).
 *
 * **العزلُ بنيويٌّ في طبقة البيانات لا فحصٌ زمنيّ**: مستودعُ دفترٍ **لكل شبكة**، فيستحيل
 * بلوغُ قيدِ شبكةٍ من أخرى — **لا يوجد مِقبضٌ عابرٌ أصلاً**. ولذلك **لا فرعَ شبكةٍ في
 * المحرّك ولا خليةٌ جديدة في الملفّ الذهبيّ**: مُحلِّلُ النطاق يبحث في مستودع شبكة الفاعل
 * وحدها، فالكيانُ الغريب ⇒ `NO_SCOPE` ⇒ رفض.
 *
 * وهذا هو الموضعُ الذي يجعل **تطابقَ المسار النسبيّ بين شبكتين آمناً**: `/men/homs/` في
 * «مشكاة» غيرُ `/men/homs/` في «حلب» لأنهما في مستودعين، لا لأن أحداً تذكّر مقارنةً.
 */

import { LedgerStore } from "./store.js"

/**
 * العنوانُ المادّي الكونيّ للكيان الماليّ: **بادئتُه معرّفُ الشبكة** — مفتاحُ التخزين
 * المستقبليّ في D1 حيث تُجمع الشبكات في جدولٍ واحد وتُفصَل بـ`tenantId`. أمّا مسارُ النطاق
 * الذي يراه المحرّك فيبقى **نسبيّاً للشبكة**، فالملفّ الذهبيّ لا يُمسّ.
 */
export function globalLedgerPath(tenantId: string, path: string): string {
  return `/${tenantId}${path}`
}

/** سجلُّ دفاتر الشبكات — يوجّه كلَّ استعلامٍ إلى **مستودع شبكته** ولا يخلطهما. */
export class LedgerTenantRegistry {
  private readonly stores = new Map<string, LedgerStore>()

  /** دفترُ الشبكة — يُنشأ موسوماً بها عند أوّل طلبٍ ثم يُعاد هو نفسُه (لا ازدواج). */
  storeFor(tenantId: string): LedgerStore {
    const existing = this.stores.get(tenantId)
    if (existing !== undefined) return existing
    const created = new LedgerStore(tenantId)
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
