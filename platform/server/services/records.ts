import { and, eq } from 'drizzle-orm'
import { dailyEntries, weeklyRecords, orgUnits } from '../database/schema'
import { currentScheme, weightMap } from '../utils/scheme'
import { getOrCreateWeeklyRecord, recomputeWeeklyTotal } from '../utils/records'
import { entryPoints } from '../utils/points'
import { isValidDay } from '../utils/week'
import { writeAudit } from '../utils/audit'
import type { Db } from '../utils/db'

// طبقة خدمة السجل — منطق نقي قابل للاختبار (لا يعتمد على H3/Nuxt)

export interface SyncCaps {
  userId: string
  canEditLocked: boolean   // الكتلة/المحافظة/الإدارة (ق5)
  committee: string | null // حقيبة اللجنة إن أدخلت (ق1)
}

export interface IncomingEntry {
  clientUuid: string
  weekStart: string
  day: string
  activityTypeId: string
  count: number
  note?: string
  shuraConfirmed: boolean
  recordedAt: number
}

export interface SyncResult {
  applied: number
  rejected: Array<{ clientUuid: string; reason: string }>
  records: Array<{ weekStart: string; totalPoints: number; status: string; locked: boolean }>
}

type Mosque = typeof orgUnits.$inferSelect

// مزامنة الإدخالات اليومية: idempotent بـ client_uuid + آخر كتابة تكسب + قفل ق5
export async function syncEntries(db: Db, mosque: Mosque, caps: SyncCaps, entries: IncomingEntry[]): Promise<SyncResult> {
  const sc = await currentScheme(db, mosque.genderTrack)
  if (!sc) throw new Error(`لا يوجد مخطط نقاط لمسار ${mosque.genderTrack}`)
  const weights = weightMap(sc.items)

  const now = Date.now()
  const recordsByWeek = new Map<string, typeof weeklyRecords.$inferSelect>()
  const rejected: SyncResult['rejected'] = []
  let applied = 0

  for (const e of entries) {
    if (!isValidDay(e.day)) { rejected.push({ clientUuid: e.clientUuid, reason: 'يوم غير صالح' }); continue }
    if (!weights.has(e.activityTypeId)) { rejected.push({ clientUuid: e.clientUuid, reason: 'نشاط لا يخص مسار المسجد' }); continue }

    let record = recordsByWeek.get(e.weekStart)
    if (!record) {
      record = await getOrCreateWeeklyRecord(db, mosque, e.weekStart)
      recordsByWeek.set(e.weekStart, record)
    }

    // idempotency
    const byUuid = await db.select().from(dailyEntries).where(eq(dailyEntries.clientUuid, e.clientUuid)).all()
    if (byUuid[0]) { rejected.push({ clientUuid: e.clientUuid, reason: 'مستقبَل مسبقاً (idempotent)' }); continue }

    // المفتاح الطبيعي: (سجل الأسبوع، اليوم، النشاط)
    const existingRows = await db.select().from(dailyEntries).where(and(
      eq(dailyEntries.weeklyRecordId, record.id),
      eq(dailyEntries.day, e.day),
      eq(dailyEntries.activityTypeId, e.activityTypeId),
    )).all()
    const existing = existingRows[0]
    const isEdit = !!existing

    if (record.locked && isEdit && !caps.canEditLocked) {
      rejected.push({ clientUuid: e.clientUuid, reason: 'الأسبوع مقفل — التعديل للكتلة/المحافظة فأعلى' })
      continue
    }
    if (isEdit && e.recordedAt <= existing.recordedAt) {
      rejected.push({ clientUuid: e.clientUuid, reason: 'نسخة أقدم — أُبقي الأحدث' })
      continue
    }

    const pts = entryPoints(e.count, weights.get(e.activityTypeId) ?? 0)
    if (isEdit) {
      await db.update(dailyEntries).set({
        count: e.count, points: pts, note: e.note ?? null, shuraConfirmed: e.shuraConfirmed,
        enteredBy: caps.userId, enteredByCommittee: caps.committee, recordedAt: e.recordedAt, syncedAt: now,
        clientUuid: e.clientUuid,
      }).where(eq(dailyEntries.id, existing.id)).run()
      await writeAudit(db, { actorUserId: caps.userId, action: 'update_entry', entity: 'daily_entry', entityId: existing.id,
        before: { count: existing.count, shura: existing.shuraConfirmed }, after: { count: e.count, shura: e.shuraConfirmed } })
    } else {
      const id = crypto.randomUUID()
      await db.insert(dailyEntries).values({
        id, clientUuid: e.clientUuid, weeklyRecordId: record.id, mosqueId: mosque.id, weekStart: e.weekStart,
        day: e.day, activityTypeId: e.activityTypeId, count: e.count, points: pts, note: e.note ?? null,
        shuraConfirmed: e.shuraConfirmed, enteredBy: caps.userId, enteredByCommittee: caps.committee,
        recordedAt: e.recordedAt, syncedAt: now,
      }).run()
      await writeAudit(db, { actorUserId: caps.userId, action: 'add_entry', entity: 'daily_entry', entityId: id,
        after: { day: e.day, activityTypeId: e.activityTypeId, count: e.count } })
    }
    applied++
  }

  const records: SyncResult['records'] = []
  for (const [weekStart, record] of recordsByWeek) {
    const total = await recomputeWeeklyTotal(db, record, mosque.genderTrack)
    const patch: Record<string, unknown> = { lastEntryAt: now }
    let status = record.status
    if (record.status !== 'draft' && !record.locked) {
      patch.status = 'draft'; patch.approvedByAmir = null; patch.approvedByLayer = null; status = 'draft'
    }
    await db.update(weeklyRecords).set(patch).where(eq(weeklyRecords.id, record.id)).run()
    records.push({ weekStart, totalPoints: total, status, locked: record.locked })
  }

  return { applied, rejected, records }
}

// سلسلة الاعتماد (ق1): مسودة → اعتماد الأمير → اعتماد أعلى طبقة مفعّلة
export async function approveRecord(
  db: Db,
  record: typeof weeklyRecords.$inferSelect,
  caps: { isAmir: boolean; isLayer: boolean; isAdmin: boolean; userId: string },
): Promise<{ status: string; error?: string }> {
  if (record.status === 'draft') {
    if (!caps.isAmir && !caps.isAdmin) return { status: record.status, error: 'اعتماد المسودة من أمير المسجد' }
    await db.update(weeklyRecords).set({ status: 'amir_approved', approvedByAmir: caps.userId }).where(eq(weeklyRecords.id, record.id)).run()
    await writeAudit(db, { actorUserId: caps.userId, action: 'amir_approve_record', entity: 'weekly_record', entityId: record.id, after: { status: 'amir_approved' } })
    return { status: 'amir_approved' }
  }
  if (record.status === 'amir_approved') {
    if (!caps.isLayer) return { status: record.status, error: 'الاعتماد النهائي من أعلى طبقة مفعّلة' }
    await db.update(weeklyRecords).set({ status: 'layer_approved', approvedByLayer: caps.userId }).where(eq(weeklyRecords.id, record.id)).run()
    await writeAudit(db, { actorUserId: caps.userId, action: 'layer_approve_record', entity: 'weekly_record', entityId: record.id, after: { status: 'layer_approved' } })
    return { status: 'layer_approved' }
  }
  return { status: record.status }
}

// قفل/فتح الأسبوع (ق5)
export async function setLock(
  db: Db,
  record: typeof weeklyRecords.$inferSelect,
  userId: string,
  locked: boolean,
): Promise<{ locked: boolean }> {
  await db.update(weeklyRecords).set({ locked, lockedAt: locked ? Date.now() : null }).where(eq(weeklyRecords.id, record.id)).run()
  await writeAudit(db, { actorUserId: userId, action: locked ? 'lock_week' : 'unlock_week', entity: 'weekly_record', entityId: record.id, after: { locked } })
  return { locked }
}
