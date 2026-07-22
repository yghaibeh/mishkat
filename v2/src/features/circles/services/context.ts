/**
 * سياقُ خدمات الحلقات — **الساعةُ والدليلُ يُحقنان ولا يُستوردان**: دالةٌ تقرأ `Date.now()`
 * من داخلها ليست حتمية ولا تُختبر (TESTING_POLICY §٥).
 *
 * و`reaches` سؤالُ **بلوغ النطاق** لا سؤالُ دور — يُقاس بمسار التكليف لا بمسمّاه (G6).
 */

import type { ScopeReach } from "./directory.js"

export type CirclesContext = {
  readonly now: Date
  /** الفاعلُ **من الجلسة** لا من مدخل العميل. */
  readonly actorPersonId: string
  readonly reaches: ScopeReach
}
