import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { orgUnits } from '../../database/schema'
import { requireUser, assertAccessPath } from '../../utils/context'
import { addDonation, addExpense } from '../../services/mosqueFinance'

// المالية الداخلية للمسجد: تبرع/مصروف (المواد 23/35/36) — ضمن نطاق المسجد
const bodySchema = z.discriminatedUnion('entity', [
  z.object({ entity: z.literal('donation'), mosqueId: z.string().min(1), amount: z.number().positive(), donorName: z.string().optional(), note: z.string().optional() }),
  z.object({ entity: z.literal('expense'), mosqueId: z.string().min(1), amount: z.number().positive(), category: z.string().optional(), note: z.string().optional() }),
])

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)
  const m = (await db.select().from(orgUnits).where(eq(orgUnits.id, body.mosqueId)).all())[0]
  if (!m) throw createError({ statusCode: 404, statusMessage: 'المسجد غير موجود' })
  assertAccessPath(user, m.path)

  if (body.entity === 'donation') return await addDonation(db, { ...body, collectedBy: user.userId }, user.userId)
  return await addExpense(db, { ...body, spentBy: user.userId }, user.userId)
})
