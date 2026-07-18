import { and, eq } from 'drizzle-orm'
import { orgUnits, weeklyRecords, dailyEntries } from '../database/schema'
import { currentScheme, schemeById, weightMap } from './scheme'
import { computePoints } from './points'
import { hijriMonthFromWeekStart } from './week'
import type { Db } from './db'

export async function getMosqueOrThrow(db: Db, mosqueId: string) {
  const rows = await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all()
  const ou = rows[0]
  if (!ou) throw new Error('المسجد غير موجود')
  if (ou.type !== 'mosque') throw new Error('الوحدة ليست مسجداً')
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
    id, mosqueId: mosque.id, mosquePath: mosque.path, unitId: mosque.id, unitPath: mosque.path, weekStart,
    hijriMonth: hijriMonthFromWeekStart(weekStart),  // يُحسب آلياً (التقويم الهجري أساسي)
    schemeId: sc.scheme.id, totalPoints: 0, status: 'draft', locked: false,
    lockedAt: null, lastEntryAt: null, approvedByAmir: null, approvedByLayer: null, createdAt: now,
  }).run()
  const rows = await db.select().from(weeklyRecords).where(eq(weeklyRecords.id, id)).all()
  return rows[0]
}

// يعيد حساب مجموع نقاط السجل من إدخالاته × أوزان المخطط الساري
export async function recomputeWeeklyTotal(db: Db, record: typeof weeklyRecords.$inferSelect, _genderTrack: string) {
  // المجموع = جمعُ نقاط القيود المخزّنة: حُسبت عند الإدخال بمخطط السجل المثبَّت (ق-6)
  // وبقواعد اللجنة 0047 (سقفٌ يوميّ + عتبة مشاركة) — فلا يُعاد اشتقاقها من العدد×الوزن
  // وإلا ضاعت الأهليّة (صلاةٌ دون ٧٠٪ عادت تُحسب). قاعدة الشورى تبقى مُنفذةً هنا.
  const entries = await db.select().from(dailyEntries)
    .where(eq(dailyEntries.weeklyRecordId, record.id)).all()
  const total = entries.reduce((sum, e) => sum + (e.shuraConfirmed ? e.points : 0), 0)
  await db.update(weeklyRecords).set({ totalPoints: total }).where(eq(weeklyRecords.id, record.id)).run()
  return total
}
