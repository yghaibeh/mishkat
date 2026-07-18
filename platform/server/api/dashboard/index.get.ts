import { z } from 'zod'
import { and, eq, inArray, like, or } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { orgUnits, weeklyRecords } from '../../database/schema'
import { requireUser, isGlobalAdmin } from '../../utils/context'
import { descendantPattern } from '../../utils/orgPath'
import { currentPointRate } from '../../utils/scheme'
import { pointsToMoney } from '../../utils/points'

// لوحة المتابعة: مساجد النطاق + نقاطها للأسبوع + المتأخرون (ق: «متأخر» = لا إدخال منذ يومين)
const querySchema = z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
const LATE_MS = 2 * 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { weekStart } = await getValidatedQuery(event, querySchema.parse)
  const db = useDb(event)

  // مساجد ضمن النطاق
  let mosques
  if (isGlobalAdmin(user)) {
    mosques = await db.select().from(orgUnits).where(eq(orgUnits.type, 'mosque')).all()
  } else {
    const patterns = user.assignments.map((a) => like(orgUnits.path, descendantPattern(a.orgPath)))
    if (!patterns.length) return { weekStart, mosques: [], summary: { total: 0, entered: 0, late: 0, avgPoints: 0 } }
    mosques = await db.select().from(orgUnits).where(and(eq(orgUnits.type, 'mosque'), or(...patterns))).all()
  }
  if (!mosques.length) return { weekStart, mosques: [], summary: { total: 0, entered: 0, late: 0, avgPoints: 0 } }

  const ids = mosques.map((m) => m.id)
  const records = await db.select().from(weeklyRecords).where(and(
    eq(weeklyRecords.weekStart, weekStart), inArray(weeklyRecords.mosqueId, ids),
  )).all()
  const byMosque = new Map(records.map((r) => [r.mosqueId, r]))
  const rate = await currentPointRate(db)
  const now = Date.now()

  const list = mosques.map((m) => {
    const r = byMosque.get(m.id)
    const points = r?.totalPoints ?? 0
    const late = !r || !r.lastEntryAt || (now - r.lastEntryAt) > LATE_MS
    return {
      mosqueId: m.id, name: m.name, genderTrack: m.genderTrack,
      points, status: r?.status ?? 'none', locked: r?.locked ?? false, late,
      money: rate ? pointsToMoney(points, rate.amount, rate.perUnit ?? 1) : null,
    }
  })
  list.sort((a, b) => b.points - a.points)

  const entered = list.filter((m) => !m.late).length
  const avg = list.length ? Math.round(list.reduce((s, m) => s + m.points, 0) / list.length) : 0
  return {
    weekStart,
    mosques: list,
    summary: { total: list.length, entered, late: list.length - entered, avgPoints: avg },
  }
})
