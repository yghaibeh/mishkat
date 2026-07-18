import { eq } from 'drizzle-orm'
import { tahfeezCircles, tahfeezStudents, tahfeezProgress } from '../database/schema'
import type { Db } from '../utils/db'

// حلقات التحفيظ (المادة 29، الباب السادس)

export async function createCircle(db: Db, input: { mosqueId: string; name: string; teacherPersonId?: string }) {
  const id = crypto.randomUUID()
  await db.insert(tahfeezCircles).values({ id, mosqueId: input.mosqueId, name: input.name, teacherPersonId: input.teacherPersonId ?? null, createdAt: Date.now() }).run()
  return { id }
}

export async function addStudent(db: Db, circleId: string, personId: string) {
  const id = crypto.randomUUID()
  await db.insert(tahfeezStudents).values({ id, circleId, personId, status: 'active', createdAt: Date.now() }).run()
  return { id }
}

export async function addProgress(db: Db, input: { studentId: string; scope?: string; fromAyah?: number; toAyah?: number; rating?: number; dateHijri?: string }) {
  const id = crypto.randomUUID()
  await db.insert(tahfeezProgress).values({
    id, studentId: input.studentId, scope: input.scope ?? null, fromAyah: input.fromAyah ?? null,
    toAyah: input.toAyah ?? null, rating: input.rating ?? null, dateHijri: input.dateHijri ?? null, createdAt: Date.now(),
  }).run()
  return { id }
}

// إجمالي الآيات المحفوظة لطالب (مقياس تقريبي)
export async function studentMemorizedAyahs(db: Db, studentId: string): Promise<number> {
  const rows = await db.select().from(tahfeezProgress).where(eq(tahfeezProgress.studentId, studentId)).all()
  return rows.reduce((s, r) => s + (r.fromAyah != null && r.toAyah != null ? (r.toAyah - r.fromAyah + 1) : 0), 0)
}
