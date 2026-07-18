import { z } from 'zod'
import { eq, inArray } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { monthlyEntitlements, entitlementTracks, payouts, persons } from '../../database/schema'
import { requireUser, isGlobalAdmin } from '../../utils/context'

// تقرير مالي لشهر: المستحقات + المسارات + المصروفات + المجاميع (الإدارة العليا)
const querySchema = z.object({ month: z.string().min(4) })

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!isGlobalAdmin(user)) throw createError({ statusCode: 403, statusMessage: 'التقرير المالي للإدارة العليا' })
  const { month } = await getValidatedQuery(event, querySchema.parse)
  const db = useDb(event)

  const ents = await db.select().from(monthlyEntitlements).where(eq(monthlyEntitlements.month, month)).all()
  if (!ents.length) return { month, entitlements: [], summary: { count: 0, gross: 0, paid: 0 } }

  const ids = ents.map((e) => e.id)
  const personIds = ents.map((e) => e.personId)
  const tracks = await db.select().from(entitlementTracks).where(inArray(entitlementTracks.entitlementId, ids)).all()
  const pays = await db.select().from(payouts).where(inArray(payouts.entitlementId, ids)).all()
  const people = await db.select().from(persons).where(inArray(persons.id, personIds)).all()
  const nameOf = new Map(people.map((p) => [p.id, p.fullName]))

  const entitlements = ents.map((e) => ({
    id: e.id, personId: e.personId, name: nameOf.get(e.personId) ?? '', status: e.status,
    grossAmount: e.grossAmount,
    tracks: tracks.filter((t) => t.entitlementId === e.id).map((t) => ({ kind: t.kind, basis: t.basis, amount: t.amount })),
    paidAmount: pays.filter((p) => p.entitlementId === e.id).reduce((s, p) => s + p.paidAmount, 0),
  }))

  const gross = Math.round(entitlements.reduce((s, e) => s + e.grossAmount, 0) * 100) / 100
  const paid = Math.round(pays.reduce((s, p) => s + p.paidAmount, 0) * 100) / 100
  return { month, entitlements, summary: { count: entitlements.length, gross, paid } }
})
