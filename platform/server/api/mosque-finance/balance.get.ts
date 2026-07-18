import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { orgUnits } from '../../database/schema'
import { requireUser, assertAccessPath } from '../../utils/context'
import { mosqueBalance } from '../../services/mosqueFinance'

const querySchema = z.object({ mosqueId: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { mosqueId } = await getValidatedQuery(event, querySchema.parse)
  const db = useDb(event)
  const m = (await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all())[0]
  if (!m) throw createError({ statusCode: 404, statusMessage: 'المسجد غير موجود' })
  assertAccessPath(user, m.path)
  return await mosqueBalance(db, mosqueId)
})
