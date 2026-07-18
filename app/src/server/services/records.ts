import { and, eq } from 'drizzle-orm'
import { dailyEntries, weeklyRecords, orgUnits, activityTypes } from '../database/schema'
import { currentScheme, weightMap } from '../utils/scheme'
import { getOrCreateWeeklyRecord, recomputeWeeklyTotal } from '../utils/records'
import { entryPoints, applyActivityRules, type ActivityRule } from '../utils/points'
import { isValidDay, weekStartSaturday } from '../utils/week'
import { writeAudit } from '../utils/audit'
import type { Db } from '../utils/db'

// طبقة خدمة السجل — منطق نقي قابل للاختبار (لا يعتمد على H3/Nuxt)

export interface SyncCaps {
  userId: string
  canEditLocked: boolean   // المنطقة/الإدارة (ق5)
  committee: string | null // حقيبة اللجنة إن أدخلت (ق1)
}

export interface IncomingEntry {
  clientUuid: string
  weekStart: string
  day: string
  activityTypeId: string
  count: number
  participantCount?: number
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
  // قواعد اللجنة (0047): سقفٌ يوميّ + عتبة مشاركةٍ من طلاب الأسرة (الصلوات: 1/يوم و70٪)
  const ruleRows = await db.select().from(activityTypes).all()
  const rules = new Map<string, ActivityRule>(ruleRows.map((a) => [a.id, { maxPerDay: a.maxPerDay ?? null, minParticipationPct: a.minParticipationPct ?? null }]))
  const familyStudents = (mosque as { familyStudents?: number | null }).familyStudents ?? null

  const now = Date.now()
  // مرجع الزمن = ساعة النظام (ق-13): الأسبوع الحالي يُحسب خادمياً لمنع التأريخ المستقبلي.
  const currentWeekStart = weekStartSaturday(new Date(now))
  const recordsByWeek = new Map<string, typeof weeklyRecords.$inferSelect>()
  const rejected: SyncResult['rejected'] = []
  let applied = 0

  for (const e of entries) {
    if (!isValidDay(e.day)) { rejected.push({ clientUuid: e.clientUuid, reason: 'يوم غير صالح' }); continue }
    if (e.weekStart > currentWeekStart) { rejected.push({ clientUuid: e.clientUuid, reason: 'لا يمكن الإدخال لأسبوعٍ لم يأتِ' }); continue }
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

    // ق٣: الأسبوعُ المقفل (المعتمَد نهائيًّا) يرفض الجديدَ والتعديلَ معًا — كان يقبل قيدًا جديدًا فيرفع المجموعَ المعتمَد
    if (record.locked && !caps.canEditLocked) {
      rejected.push({ clientUuid: e.clientUuid, reason: isEdit ? 'الأسبوع مقفل — التعديل للمنطقة فأعلى' : 'الأسبوع معتمدٌ نهائيًّا — لا إدخال جديد' })
      continue
    }
    if (isEdit && e.recordedAt <= existing.recordedAt) {
      rejected.push({ clientUuid: e.clientUuid, reason: 'نسخة أقدم — أُبقي الأحدث' })
      continue
    }

    const participantCount = e.participantCount ?? 1
    const ruled = applyActivityRules(e.count, participantCount, rules.get(e.activityTypeId), familyStudents)
    e.count = ruled.count
    const pts = ruled.eligible ? entryPoints(ruled.count, weights.get(e.activityTypeId) ?? 0) : 0
    if (isEdit) {
      await db.update(dailyEntries).set({
        count: e.count, points: pts, participantCount, note: e.note ?? null, shuraConfirmed: e.shuraConfirmed,
        enteredBy: caps.userId, enteredByCommittee: caps.committee, recordedAt: e.recordedAt, syncedAt: now,
        clientUuid: e.clientUuid,
      }).where(eq(dailyEntries.id, existing.id)).run()
      await writeAudit(db, { actorUserId: caps.userId, action: 'update_entry', entity: 'daily_entry', entityId: existing.id,
        before: { count: existing.count, shura: existing.shuraConfirmed }, after: { count: e.count, shura: e.shuraConfirmed, participantCount } })
    } else {
      const id = crypto.randomUUID()
      // ق٣: upsert على المفتاح الطبيعيّ — سباقُ إدخالين متزامنين لا يُنتج صفّين فيتضاعف المجموع
      await db.insert(dailyEntries).values({
        id, clientUuid: e.clientUuid, weeklyRecordId: record.id, mosqueId: mosque.id, unitId: mosque.id, weekStart: e.weekStart,
        day: e.day, activityTypeId: e.activityTypeId, count: e.count, points: pts, participantCount,
        note: e.note ?? null, shuraConfirmed: e.shuraConfirmed, enteredBy: caps.userId, enteredByCommittee: caps.committee,
        recordedAt: e.recordedAt, syncedAt: now,
      }).onConflictDoUpdate({
        target: [dailyEntries.weeklyRecordId, dailyEntries.day, dailyEntries.activityTypeId],
        set: { count: e.count, points: pts, participantCount, note: e.note ?? null, shuraConfirmed: e.shuraConfirmed, enteredBy: caps.userId, enteredByCommittee: caps.committee, recordedAt: e.recordedAt, syncedAt: now, clientUuid: e.clientUuid },
      }).run()
      await writeAudit(db, { actorUserId: caps.userId, action: 'add_entry', entity: 'daily_entry', entityId: id,
        after: { day: e.day, activityTypeId: e.activityTypeId, count: e.count, participantCount } })
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

// رفض الأسبوع (ق1): يُعيده إلى مسودة مع تسجيل سبب الرفض وهوية الرافض
export async function rejectRecord(
  db: Db,
  record: typeof weeklyRecords.$inferSelect,
  caps: { userId: string },
  reason: string,
): Promise<void> {
  await db.update(weeklyRecords).set({
    status: 'draft',
    approvedByAmir: null,
    amirApprovedAt: null,
    rejectedByLayer: caps.userId,
    rejectionReason: reason,
  }).where(eq(weeklyRecords.id, record.id)).run()
  await writeAudit(db, { actorUserId: caps.userId, action: 'reject_record', entity: 'weekly_record', entityId: record.id, after: { reason } })
}

// سلسلة الاعتماد (ق1-د، الوثيقة ٢٩): مسودة → إقرار الأمير → اعتماد «الطبقة الأقرب» حصرًا.
// `isLayer` هنا تعني: هذا المستخدمُ هو المعتمِدُ الشرعيُّ للوحدة (الأقرب NESSA، أو تدخّلٌ فوقيّ، أو كسرُ زجاجٍ للإدارة).
// حسابُ «مَن هو الأقرب» يقع في المستدعي عبر services/approvalRouting — هنا تنفيذُ آلة الحالات فقط.
// `via` تُميّز فعلَ التدقيق (كسرُ الزجاج للإدارة يُسجَّل متميّزًا رقابيًّا).
export async function approveRecord(
  db: Db,
  record: typeof weeklyRecords.$inferSelect,
  caps: { isAmir: boolean; isLayer: boolean; isAdmin: boolean; userId: string; via?: 'nearest' | 'override' | 'breakglass' },
): Promise<{ status: string; error?: string }> {
  const layerAction = caps.via === 'breakglass' ? 'admin_breakglass_approve' : 'layer_approve_record'
  if (record.status === 'draft') {
    // المعتمِدُ الأقرب يعتمد المسودة نهائياً (اعتمادٌ يتجاوز إقرار الأمير عند الحاجة، لأن سلطته أعلى)
    if (caps.isLayer) {
      await db.update(weeklyRecords).set({ status: 'layer_approved', approvedByLayer: caps.userId, locked: true, lockedAt: Date.now(), rejectionReason: null, rejectedByLayer: null }).where(eq(weeklyRecords.id, record.id)).run()
      await writeAudit(db, { actorUserId: caps.userId, action: layerAction, entity: 'weekly_record', entityId: record.id, after: { status: 'layer_approved', from: 'draft', via: caps.via ?? 'nearest' } })
      return { status: 'layer_approved' }
    }
    // الأمير يُقِرّ تقريره (مسودة → اعتماد الأمير)
    if (!caps.isAmir) return { status: record.status, error: 'اعتماد المسودة من أمير المسجد أو الطبقة الأقرب فوقه' }
    await db.update(weeklyRecords).set({ status: 'amir_approved', approvedByAmir: caps.userId, amirApprovedAt: Date.now(), rejectionReason: null, rejectedByLayer: null }).where(eq(weeklyRecords.id, record.id)).run()
    await writeAudit(db, { actorUserId: caps.userId, action: 'amir_approve_record', entity: 'weekly_record', entityId: record.id, after: { status: 'amir_approved' } })
    return { status: 'amir_approved' }
  }
  if (record.status === 'amir_approved') {
    if (!caps.isLayer) return { status: record.status, error: 'الاعتماد النهائي من الطبقة الأقرب فوق المسجد' }
    await db.update(weeklyRecords).set({ status: 'layer_approved', approvedByLayer: caps.userId, locked: true, lockedAt: Date.now() }).where(eq(weeklyRecords.id, record.id)).run()
    await writeAudit(db, { actorUserId: caps.userId, action: layerAction, entity: 'weekly_record', entityId: record.id, after: { status: 'layer_approved', via: caps.via ?? 'nearest' } })
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
