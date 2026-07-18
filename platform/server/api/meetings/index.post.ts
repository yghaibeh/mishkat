import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { orgUnits, meetings } from '../../database/schema'
import { requireUser, assertAccessPath } from '../../utils/context'
import { createMeeting, setAttendance, recordDecision } from '../../services/meetings'

// الاجتماعات: إنشاء/حضور/قرار (المادة 18) — ضمن نطاق المسجد
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), mosqueId: z.string().min(1), type: z.enum(['periodic', 'extraordinary']).optional(), scheduledAt: z.number().int(), memberCount: z.number().int().min(0) }),
  z.object({ action: z.literal('attendance'), meetingId: z.string().min(1), personId: z.string().min(1), present: z.boolean() }),
  z.object({ action: z.literal('decision'), meetingId: z.string().min(1), title: z.string().min(2), kind: z.enum(['binding', 'advisory']).optional(), votesFor: z.number().int().min(0), votesAgainst: z.number().int().min(0), totalVoters: z.number().int().min(0), amirVoteFor: z.boolean().optional(), note: z.string().optional() }),
])

async function mosqueOfMeeting(db: any, meetingId: string) {
  const mt = (await db.select().from(meetings).where(eq(meetings.id, meetingId)).all())[0]
  if (!mt) return null
  return (await db.select().from(orgUnits).where(eq(orgUnits.id, mt.mosqueId)).all())[0] ?? null
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  if (body.action === 'create') {
    const m = (await db.select().from(orgUnits).where(eq(orgUnits.id, body.mosqueId)).all())[0]
    if (!m) throw createError({ statusCode: 404, statusMessage: 'المسجد غير موجود' })
    assertAccessPath(user, m.path)
    return await createMeeting(db, { ...body, calledBy: user.userId })
  }
  const m = await mosqueOfMeeting(db, body.meetingId)
  if (!m) throw createError({ statusCode: 404, statusMessage: 'الاجتماع غير موجود' })
  assertAccessPath(user, m.path)
  if (body.action === 'attendance') return await setAttendance(db, body.meetingId, body.personId, body.present)
  return await recordDecision(db, body, user.userId)
})
