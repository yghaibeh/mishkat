/**
 * ما يشترك فيه المستودعان المهاجَران — **سجلُّ التدقيق الواحد** والعدّادات.
 * (README الحسم ٣: السجلُّ مركزيّ، فشكلُ صفِّه يعيش في موضعٍ واحد لا في كل مستودع.)
 */

import { encodeDate, readDate, readInt, readText, readTextOrNull } from "../encode.js"
import { TENANT_ROOT_PATH } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"

export type AuditProjection = {
  readonly tenantId: string
  readonly source: string
  readonly seq: number
  readonly unitPath: string
  /** ١ = مشتقٌّ من الكيان المُدقَّق · ٠ = تعذّر فوُجِّه للجذر **موسوماً** لا مُموَّهاً. */
  readonly scopeExact: boolean
  readonly at: Date
  readonly actorPersonId: string
  readonly action: string
  readonly capability: string | null
  readonly targetType: string | null
  readonly targetId: string
  readonly reason: string | null
}

/**
 * الأعمدةُ الستةُ الأخيرة من عقد `AuditEntry` (`contracts.ts`) تبقى `NULL` اليوم: سجلّا
 * الوحدتين **أضيقُ من العقد المعلن**، وتوسيعُهما تغييرُ نوعٍ في وحدة ميزة ⟵ قرارُ
 * `CR-DRAFT-persistence-002` لا قرارُ مخطط. والعمودُ موجودٌ لأن إضافتَه لاحقاً إلى **أكبر
 * جدولٍ في القاعدة** (٣٦٪ من النمو — ADR ملحق أ) هي الهجرةُ التي نتجنّبها.
 */
export function auditRow(projection: AuditProjection): SqlRow {
  return {
    tenant_id: projection.tenantId,
    unit_path: projection.unitPath,
    source: projection.source,
    seq: projection.seq,
    at: encodeDate(projection.at),
    actor_person_id: projection.actorPersonId,
    action: projection.action,
    capability: projection.capability,
    target_type: projection.targetType,
    target_id: projection.targetId,
    reason: projection.reason,
    scope_exact: projection.scopeExact ? 1 : 0,
    actor_roles_at_time: null,
    impersonated_by: null,
    decision: null,
    reason_code: null,
    request_id: null,
    before: null,
    after: null,
  }
}

export type AuditRead = {
  readonly seq: number
  readonly unitPath: string
  readonly at: Date
  readonly actorPersonId: string
  readonly action: string
  readonly capability: string | null
  readonly targetType: string | null
  readonly targetId: string
  readonly reason: string | null
}

/** يُعيد قيودَ التدقيق **بترتيب تسلسلها** — فالسجلُّ ملحقٌ فقط وترتيبُه جزءٌ من معناه. */
export function readAuditInto(
  rows: ReadonlyMap<string, SqlRow>,
  append: (record: AuditRead) => void,
): void {
  const ordered = [...rows.values()].sort((a, b) => readInt(a, "seq") - readInt(b, "seq"))
  for (const row of ordered) {
    append({
      seq: readInt(row, "seq"),
      unitPath: readText(row, "unit_path"),
      at: readDate(row, "at"),
      actorPersonId: readText(row, "actor_person_id"),
      action: readText(row, "action"),
      capability: readTextOrNull(row, "capability"),
      targetType: readTextOrNull(row, "target_type"),
      targetId: readText(row, "target_id"),
      reason: readTextOrNull(row, "reason"),
    })
  }
}

export function sequenceRow(tenantId: string, name: string, value: number): SqlRow {
  return { tenant_id: tenantId, unit_path: TENANT_ROOT_PATH, name, value }
}

/** لاحقةُ المعرّف المتتابع (`je-7` ⟵ ٧)، و**صفرٌ لِما لم يُولَد من العدّاد**. */
export function suffixOf(id: string): number {
  const match = /^[A-Za-z_]+-(\d+)$/.exec(id)
  return match === null ? 0 : Number(match[1])
}
