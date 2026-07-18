import { and, desc, eq, isNull } from 'drizzle-orm'
import {
  roleAssignments, weeklyRecords, rateSchemes,
  monthlyEntitlements, entitlementTracks, payouts,
} from '../database/schema'
import { ROLES } from '../utils/rbac'
import { pointsToMoney } from '../utils/points'
import { writeAudit } from '../utils/audit'
import { teacherHoursTrack } from './alaBaseera'
import type { Db } from '../utils/db'

// وحدة المالية (ق2/ق4/ق7/ق8): المستحق = جمع مسارات الشخص (مقطوع/نقاط/ساعات)، بلا خصومات.

interface Track { kind: 'fixed' | 'points' | 'hours'; basis: number | null; rate: number | null; amount: number; sourceRef: string | null }

async function activeAssignments(db: Db, personId: string) {
  return await db.select().from(roleAssignments).where(and(
    eq(roleAssignments.personId, personId),
    isNull(roleAssignments.endDate),
    eq(roleAssignments.approvalStatus, 'approved'),
  )).all()
}

async function latestRate(db: Db, kind: string) {
  const rows = await db.select().from(rateSchemes).where(and(
    eq(rateSchemes.kind, kind), eq(rateSchemes.active, true),
  )).orderBy(desc(rateSchemes.validFrom)).all()
  return rows[0] ?? null
}

// يبني مسارات المستحق لشخص في شهر (دالة منطق قابلة للاختبار)
export async function buildTracks(db: Db, personId: string, month: string): Promise<Track[]> {
  const asg = await activeAssignments(db, personId)
  const tracks: Track[] = []

  // مسار مقطوع: الإدارة العليا (ق2-ب)
  if (asg.some((a) => a.role === ROLES.ADMIN)) {
    const fixed = await latestRate(db, 'fixed_salary')
    if (fixed) tracks.push({ kind: 'fixed', basis: null, rate: fixed.amount, amount: fixed.amount, sourceRef: 'admin' })
  }

  // مسار النقاط: أمير المسجد — مجموع نقاط شهر مساجده (ق2-ج)
  const amirMosques = asg.filter((a) => a.role === ROLES.AMIR).map((a) => a.orgUnitId)
  if (amirMosques.length) {
    const pr = await latestRate(db, 'point_rate')
    let totalPoints = 0
    for (const mid of amirMosques) {
      const recs = await db.select().from(weeklyRecords).where(and(
        eq(weeklyRecords.mosqueId, mid), eq(weeklyRecords.hijriMonth, month),
      )).all()
      totalPoints += recs.reduce((s, r) => s + r.totalPoints, 0)
    }
    const perPoint = pr && pr.perUnit ? pr.amount / pr.perUnit : 0
    const amount = pr ? pointsToMoney(totalPoints, pr.amount, pr.perUnit ?? 1) : 0
    tracks.push({ kind: 'points', basis: totalPoints, rate: perPoint, amount, sourceRef: amirMosques.join(',') })
  }

  // مسار الساعات: معلّم «على بصيرة» — يُحاسَب بالساعة (ق8)
  const hours = await teacherHoursTrack(db, personId, month)
  if (hours && hours.hours > 0) {
    tracks.push({ kind: 'hours', basis: hours.hours, rate: hours.rate, amount: hours.amount, sourceRef: 'ala_baseera' })
  }

  return tracks
}

// يحسب/يعيد ترشيح المستحق الشهري ويخزّنه (لا يلمس مستحقاً مصروفاً)
export async function computeMonthlyEntitlement(db: Db, personId: string, month: string, actorUserId?: string) {
  const tracks = await buildTracks(db, personId, month)
  const gross = Math.round(tracks.reduce((s, t) => s + t.amount, 0) * 100) / 100

  const existing = await db.select().from(monthlyEntitlements).where(and(
    eq(monthlyEntitlements.personId, personId), eq(monthlyEntitlements.month, month),
  )).all()
  const prev = existing[0]
  if (prev?.status === 'paid') return { id: prev.id, status: 'paid', grossAmount: prev.grossAmount, tracks, note: 'مصروف — لا يُعاد الحساب' }

  // إزالة الترشيح السابق غير المصروف ثم إعادة البناء
  if (prev) {
    await db.delete(entitlementTracks).where(eq(entitlementTracks.entitlementId, prev.id)).run()
    await db.delete(monthlyEntitlements).where(eq(monthlyEntitlements.id, prev.id)).run()
  }

  const id = crypto.randomUUID()
  const now = Date.now()
  await db.insert(monthlyEntitlements).values({
    id, personId, month, grossAmount: gross, currency: 'USD', status: 'proposed', approvedBy: null, createdAt: now,
  }).run()
  for (const t of tracks) {
    await db.insert(entitlementTracks).values({
      id: crypto.randomUUID(), entitlementId: id, kind: t.kind, basis: t.basis, rate: t.rate, amount: t.amount, sourceRef: t.sourceRef,
    }).run()
  }
  await writeAudit(db, { actorUserId: actorUserId ?? null, action: 'compute_entitlement', entity: 'monthly_entitlement', entityId: id, after: { personId, month, gross } })
  return { id, status: 'proposed', grossAmount: gross, tracks }
}

export async function approveEntitlement(db: Db, id: string, approverUserId: string) {
  const rows = await db.select().from(monthlyEntitlements).where(eq(monthlyEntitlements.id, id)).all()
  const ent = rows[0]
  if (!ent) return { error: 'المستحق غير موجود' }
  if (ent.status !== 'proposed') return { status: ent.status }
  await db.update(monthlyEntitlements).set({ status: 'approved', approvedBy: approverUserId }).where(eq(monthlyEntitlements.id, id)).run()
  await writeAudit(db, { actorUserId: approverUserId, action: 'approve_entitlement', entity: 'monthly_entitlement', entityId: id, after: { status: 'approved' } })
  return { status: 'approved' }
}

export async function recordPayout(db: Db, entitlementId: string, paidAmount: number, recordedBy: string, reference?: string) {
  const rows = await db.select().from(monthlyEntitlements).where(eq(monthlyEntitlements.id, entitlementId)).all()
  const ent = rows[0]
  if (!ent) return { error: 'المستحق غير موجود' }
  if (ent.status !== 'approved') return { error: 'يجب اعتماد المستحق قبل الصرف' }
  const id = crypto.randomUUID()
  await db.insert(payouts).values({
    id, entitlementId, netAmount: ent.grossAmount, paidAmount, reference: reference ?? null, recordedBy, paidAt: Date.now(),
  }).run()
  await db.update(monthlyEntitlements).set({ status: 'paid' }).where(eq(monthlyEntitlements.id, entitlementId)).run()
  await writeAudit(db, { actorUserId: recordedBy, action: 'record_payout', entity: 'payout', entityId: id, after: { entitlementId, paidAmount } })
  return { id, status: 'paid', paidAmount }
}
