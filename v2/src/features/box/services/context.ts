/**
 * سياقُ خدمات الصندوق — **امتدادٌ لسياق النواة لا بديلٌ عنه**.
 *
 * `LedgerContext` يحمل الساعةَ ومُحلِّلَ الإعدادات والفاعل (كلُّها **تُحقن ولا تُستورد** —
 * `SPEC_settings` §١-٨)، ويضيف الصندوقُ عليه سؤالاً واحداً: **«أهذا الشخصُ أمينُ تلك الوحدة؟»**
 * جوابُه من المحرّك بالقدرة لا بقائمة أدوار (ق-٥٩، G6 — عقدُ الوحدة §١).
 */

import type { LedgerContext } from "../../ledger/services/journal.js"
import type { CustodyCheck } from "./custodian.js"

export type BoxContext = LedgerContext & {
  /** يُحقن من طبقة الخادم مع سياق الطلب — فلا تعرف الخدمةُ دوراً ولا تستورد محرّكاً. */
  readonly custody: CustodyCheck
}
