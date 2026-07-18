import { z } from 'zod'
import { useDb } from '../../utils/db'
import { requireUser, assertAccessPath } from '../../utils/context'
import { canEditLockedWeek } from '../../utils/caps'
import { ROLES } from '../../utils/rbac'
import { getMosqueOrThrow } from '../../utils/records'
import { syncEntries } from '../../services/records'

// مزامنة الإدخالات اليومية (offline-first) — يفوّض المنطق لطبقة الخدمة المختبَرة
const bodySchema = z.object({
  mosqueId: z.string().min(1),
  entries: z.array(z.object({
    clientUuid: z.string().min(8),
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    day: z.string(),
    activityTypeId: z.string().min(1),
    count: z.number().int().min(0),
    note: z.string().optional(),
    shuraConfirmed: z.boolean(),
    recordedAt: z.number().int(),
    committee: z.string().optional(),
  })).min(1).max(200),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  const mosque = await getMosqueOrThrow(db, body.mosqueId)
  assertAccessPath(user, mosque.path)

  const canEditLocked = canEditLockedWeek(user, mosque.path)
  const committee = body.entries.find((e) => e.committee)?.committee
    ?? (user.assignments.find((a) => a.role === ROLES.COMMITTEE)?.portfolio ?? null)

  return await syncEntries(db, mosque, { userId: user.userId, canEditLocked, committee }, body.entries)
})
