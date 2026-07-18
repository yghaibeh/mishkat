import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { persons, personContacts, users, roleAssignments, orgUnits } from '../../database/schema'
import { hashPassword, signToken } from '../../utils/auth'
import { ROLES } from '../../utils/rbac'
import { writeAudit } from '../../utils/audit'

// التسجيل الذاتي المفتوح (ق4): أي شخص يسجّل ويبدأ بدور «عضو/مسجَّل» بلا صلاحيات إشرافية
const bodySchema = z.object({
  fullName: z.string().min(3),
  login: z.string().min(3),
  password: z.string().min(6),
  gender: z.enum(['male', 'female']),
  homeOrgUnitId: z.string().min(1),
  birthYearHijri: z.number().int().optional(),
  phone: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDb(event)

  const existing = await db.select().from(users).where(eq(users.login, body.login)).all()
  if (existing.length) throw createError({ statusCode: 409, statusMessage: 'اسم الدخول مستخدم' })

  const homeRows = await db.select().from(orgUnits).where(eq(orgUnits.id, body.homeOrgUnitId)).all()
  const home = homeRows[0]
  if (!home) throw createError({ statusCode: 400, statusMessage: 'مسجد الحي غير موجود' })

  const personId = crypto.randomUUID()
  const userId = crypto.randomUUID()
  const now = Date.now()

  await db.insert(persons).values({
    id: personId, fullName: body.fullName, gender: body.gender,
    birthYearHijri: body.birthYearHijri ?? null, homeOrgUnitId: home.id,
    status: 'active', createdAt: now,
  }).run()
  if (body.phone) {
    await db.insert(personContacts).values({ personId, phone: body.phone, telegram: null, guardianPhone: null }).run()
  }
  const passwordHash = await hashPassword(body.password)
  await db.insert(users).values({
    id: userId, personId, login: body.login, passwordHash, lastLogin: null, createdAt: now,
  }).run()
  // الدور الافتراضي: عضو ضمن نطاق مسجد الحي (بلا صلاحيات إشرافية حتى تُمنح)
  await db.insert(roleAssignments).values({
    id: crypto.randomUUID(), personId, role: ROLES.MEMBER, orgUnitId: home.id, orgPath: home.path,
    portfolio: null, startDate: now, endDate: null, termNumber: 1,
    approvalStatus: 'approved', approvedBy: null, createdAt: now,
  }).run()
  await writeAudit(db, { actorUserId: userId, action: 'register', entity: 'user', entityId: userId, after: { login: body.login } })

  const cfg = useRuntimeConfig(event)
  const token = await signToken({ sub: userId, pid: personId }, cfg.jwtSecret)
  return { token, user: { id: userId, fullName: body.fullName } }
})
