/**
 * قشرةُ القدرات المحسوبة على الخادم — `SPEC_authorization` §٤.٥ (الواجهةُ تعرض ولا تقرر).
 *
 * الخادمُ يحسب ويُرسل قائمةً مسطّحةً من القدرات الممنوحة على نطاق الشاشة؛ الواجهةُ تُظهر
 * وتُخفي بها فقط — لا فحصَ دورٍ في المتصفح (المادة ٤/٦). **إخفاءُ الزر ليس حمايةً**:
 * الحمايةُ إعلانُ القدرة على دالة الخادم، وهذه تجربةُ استخدامٍ متسقةٌ مع الفرض.
 *
 * **وفصلُ المهام مرسومٌ في المصفوفة نفسها قبل أن تُبنى شاشة**: الماليُّ يحصل على الإعداد
 * (`finance.entry` · `ledger.journal.entry`) ولا يحصل على البتّ؛ والمديرُ يحصل على البتّ
 * (`finance.supervise`) ولا يحصل على تأليف القيد الذي يعتمده (ق-٥٤).
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"

/** القدراتُ التي تحكم عناصرَ شاشتَي هذه الوحدة (منطاقةٌ كلُّها) — أربعٌ لا خامسةَ لها. */
export const SCREEN_SURFACE_CAPS: readonly CapId[] = Object.freeze([
  "finance.view",
  "finance.entry",
  "ledger.journal.entry",
  "finance.supervise",
])

/** يحسب القدراتِ المتاحةَ للفاعل على نطاق الشاشة — تُرسل للواجهة كما هي. */
export function computeLedgerCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
): ReadonlySet<CapId> {
  const granted = new Set<CapId>()
  for (const cap of SCREEN_SURFACE_CAPS) {
    if (can(actor, cap, unitScope(scopePath), ctx).allowed) granted.add(cap)
  }
  return granted
}
