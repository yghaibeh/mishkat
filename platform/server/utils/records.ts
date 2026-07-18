import { and, eq } from 'drizzle-orm'
import { orgUnits, weeklyRecords, dailyEntries } from '../database/schema'
import { currentScheme, weightMap } from './scheme'
import { computePoints } from './points'
import { hijriMonthFromWeekStart } from './week'
import type { Db } from './db'

export async function getMosqueOrThrow(db: Db, mosqueId: string) {
  const rows = await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all()
  const ou = rows[0]
  if (!ou) throw createError({ statusCode: 404, statusMessage: 'المسجد غير موجود' })
  if (ou.type !== 'mosque') throw createError({ statusCode: 400, statusMessage: 'الوحدة ليست مسجداً' })
  return ou
}

// يجلب السجل الأسبوعي أو ينشئه بمخطط مسار جنس المسجد
export async function getOrCreateWeeklyRecord(db: Db, mosque: typeof orgUnits.$inferSelect, weekStart: string) {
  const existing = await db.select().from(weeklyRecords)
    .where(and(eq(weeklyRecords.mosqueId, mosque.id), eq(weeklyRecords.weekStart, weekStart))).all()
  if (existing[0]) return existing[0]

  const sc = await currentScheme(db, mosque.genderTrack)
  if (!sc) throw createError({ statusCode: 500, statusMessage: `لا يوجد مخطط نقاط لمسار ${mosque.genderTrack}` })

  const id = crypto.randomUUID()
  const now = Date.now()
  await db.insert(weeklyRecords).values({
    id, mosqueId: mosque.id, mosquePath: mosque.path, weekStart,
    hijriMonth: hijriMonthFromWeekStart(weekStart),  // يُحسب آلياً (التقويم الهجري أساسي)
    schemeId: sc.scheme.id, totalPoints: 0, status: 'draft', locked: false,
    lockedAt: null, lastEntryAt: null, approvedByAmir: null, approvedByLayer: null, createdAt: now,
  }).run()
  const rows = await db.select().from(weeklyRecords).where(eq(weeklyRecords.id, id)).all()
  return rows[0]
}

// يعيد حساب مجموع نقاط السجل من إدخالاته × أوزان المخطط الساري
export async function recomputeWeeklyTotal(db: Db, record: typeof weeklyRecords.$inferSelect, genderTrack: string) {
  const sc = await currentScheme(db, genderTrack)
  const weights = weightMap(sc?.items ?? [])
  const entries = await db.select().from(dailyEntries)
    .where(eq(dailyEntries.weeklyRecordId, record.id)).all()
  const total = computePoints(
    entries.map((e) => ({ activityTypeId: e.activityTypeId, count: e.count, shuraConfirmed: e.shuraConfirmed })),
    weights,
  )
  await db.update(weeklyRecords).set({ totalPoints: total }).where(eq(weeklyRecords.id, record.id)).run()
  return total
}
