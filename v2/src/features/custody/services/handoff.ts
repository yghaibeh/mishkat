/**
 * ق-٨٢ — **لا تُطوى صفحةُ كادرٍ وبيده عهدة** (عقدُ الوحدة §٥).
 *
 * القاعدةُ نجت من دفن «دورة الولايات» (ب-٦) وضُمّت لبند العُهد (ب-١١)، ولذلك موطنُها هنا.
 * والتحقّقُ **قيمةٌ تُصدَّر لا رميةٌ ولا كتابةٌ في وحدةِ غيرها**: دورةُ حياة الحساب في `org`
 * تستوردها يوم تُبنى، و**لم يُعدَّل في تلك الوحدة سطرٌ واحد** (قب-٣١ §٢: كلٌّ في مجلده).
 *
 * وهذا الملفّ **لا يستورد من وحدةٍ أخرى إطلاقاً** — التصديرُ اتجاهٌ واحد، يحرسه اختبار.
 */

import type { CustodyStore } from "../data/store.js"
import { openCustodyOf, type OpenCustody } from "./derive.js"

export type CustodyClearance = {
  /** مُبرَّأٌ؟ — `true` حين لا شيءَ بيده، فتُطوى صفحتُه بأمان. */
  readonly clear: boolean
  /** وإلا: ما بيده باسمه وحاله — كي يقول المانعُ **ماذا** يمنع لا «لا يجوز» مبهمةً (ق-١١٢). */
  readonly open: readonly OpenCustody[]
}

export function custodyClearance(store: CustodyStore, personId: string): CustodyClearance {
  const open = openCustodyOf(store, personId)
  return { clear: open.length === 0, open }
}
