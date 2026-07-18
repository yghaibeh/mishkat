import { auditLog } from '../database/schema'
import type { Db } from './db'

// كتابة قيد في سجل التدقيق (لا حذف فعلي في النظام؛ كل تغيير مُسجَّل)
export async function writeAudit(db: Db, entry: {
  actorUserId?: string | null
  action: string
  entity: string
  entityId: string
  before?: unknown
  after?: unknown
}): Promise<void> {
  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    before: entry.before ? JSON.stringify(entry.before) : null,
    after: entry.after ? JSON.stringify(entry.after) : null,
    at: Date.now(),
  }).run()
}
