import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { weeklyRecords, dailyEntries } from '../../database/schema'
import { requireUser, assertAccessPath } from '../../utils/context'
import { getMosqueOrThrow } from '../../utils/records'
import { currentScheme } from '../../utils/scheme'
import { currentPointRate } from '../../utils/scheme'
import { pointsToMoney } from '../../utils/points'

// سجل أسبوع لمسجد: المخطط + الإدخالات + المجموع وقيمته المالية
const querySchema = z.object({
  mosqueId: z.string().min(1),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { mosqueId, weekStart } = await getValidatedQuery(event, querySchema.parse)
  const db = useDb(event)

  const mosque = await getMosqueOrThrow(db, mosqueId)
  assertAccessPath(user, mosque.path)

  const sc = await currentScheme(db, mosque.genderTrack)
  const rate = await currentPointRate(db)

  const recRows = await db.select().from(weeklyRecords).where(and(
    eq(weeklyRecords.mosqueId, mosqueId), eq(weeklyRecords.weekStart, weekStart),
  )).all()
  const record = recRows[0] ?? null
  const entries = record
    ? await db.select().from(dailyEntries).where(eq(dailyEntries.weeklyRecordId, record.id)).all()
    : []

  const totalPoints = record?.totalPoints ?? 0
  return {
    mosque: { id: mosque.id, name: mosque.name, genderTrack: mosque.genderTrack },
    weekStart,
    weeklyTarget: sc?.scheme.weeklyTarget ?? 70,
    activities: sc?.items.map((i) => ({ activityTypeId: i.activityTypeId, name: i.name, points: i.points })) ?? [],
    record: record ? { status: record.status, locked: record.locked, totalPoints } : null,
    money: rate ? pointsToMoney(totalPoints, rate.amount, rate.perUnit ?? 1) : null,
    entries: entries.map((e) => ({
      day: e.day, activityTypeId: e.activityTypeId, count: e.count, points: e.points,
      shuraConfirmed: e.shuraConfirmed, note: e.note, enteredByCommittee: e.enteredByCommittee,
    })),
  }
})
