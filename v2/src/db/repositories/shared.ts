/**
 * ما يشترك فيه المستودعان المهاجَران — **العدّادات** وقراءةُ المعرّف المتتابع.
 *
 * وكان هنا شكلُ صفِّ التدقيق وقراءتُه؛ وقد انتقلا إلى `auditRepository.ts` يوم صار السجلُّ
 * **واحداً موحَّداً** (CR-027): مصدرُ حقيقةٍ واحدٌ لا يحتاج أرضاً مشتركةً بين مالكَين.
 */

import { TENANT_ROOT_PATH } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"

export function sequenceRow(tenantId: string, name: string, value: number): SqlRow {
  return { tenant_id: tenantId, unit_path: TENANT_ROOT_PATH, name, value }
}

/** لاحقةُ المعرّف المتتابع (`je-7` ⟵ ٧)، و**صفرٌ لِما لم يُولَد من العدّاد**. */
export function suffixOf(id: string): number {
  const match = /^[A-Za-z_]+-(\d+)$/.exec(id)
  return match === null ? 0 : Number(match[1])
}
