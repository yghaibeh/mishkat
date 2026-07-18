import { and, desc, eq } from 'drizzle-orm'
import {
  venues, teachers, halaqat, enrollments, lessonSessions, rateSchemes,
} from '../database/schema'
import { writeAudit } from '../utils/audit'
import type { Db } from '../utils/db'

// وحدة «على بصيرة» (ق8/ق9): المعلّم يُحاسَب بالساعة؛ المعهد مجرد مكان.

export async function createVenue(db: Db, input: { type: string; name: string; orgUnitId?: string; genderTrack?: string }) {
  const id = crypto.randomUUID()
  await db.insert(venues).values({
    id, type: input.type, name: input.name, orgUnitId: input.orgUnitId ?? null,
    genderTrack: input.genderTrack ?? 'male', createdAt: Date.now(),
  }).run()
  return { id }
}

export async function createTeacher(db: Db, input: { personId: string; qualification?: string }) {
  const id = crypto.randomUUID()
  await db.insert(teachers).values({
    id, personId: input.personId, qualification: input.qualification ?? null,
    hourlyRateId: 'rate-hour-current', active: true, createdAt: Date.now(),
  }).run()
  return { id }
}

export async function createHalaqa(db: Db, input: { name: string; venueId: string; teacherId: string; genderTrack?: string; capacity?: number }) {
  const id = crypto.randomUUID()
  await db.insert(halaqat).values({
    id, name: input.name, venueId: input.venueId, teacherId: input.teacherId,
    genderTrack: input.genderTrack ?? 'male', capacity: input.capacity ?? 30, createdAt: Date.now(),
  }).run()
  return { id }
}

// تسجيل طالب — يمنع الازدواج في نفس الحلقة (ق9)
export async function enrollStudent(db: Db, halaqaId: string, personId: string): Promise<{ id?: string; error?: string }> {
  const h = (await db.select().from(halaqat).where(eq(halaqat.id, halaqaId)).all())[0]
  if (!h) return { error: 'الحلقة غير موجودة' }
  const dup = await db.select().from(enrollments).where(and(
    eq(enrollments.halaqaId, halaqaId), eq(enrollments.personId, personId), eq(enrollments.status, 'active'),
  )).all()
  if (dup[0]) return { error: 'الطالب مسجَّل في هذه الحلقة' }
  const count = (await db.select().from(enrollments).where(and(
    eq(enrollments.halaqaId, halaqaId), eq(enrollments.status, 'active'),
  )).all()).length
  if (count >= h.capacity) return { error: 'الحلقة مكتملة' }
  const id = crypto.randomUUID()
  await db.insert(enrollments).values({ id, halaqaId, personId, status: 'active', createdAt: Date.now() }).run()
  return { id }
}

// تسجيل جلسة درس (أساس المحاسبة بالساعة)
// يستخرج مفتاح الشهر 'YYYY-MM' من تاريخ هجري 'YYYY-MM-DD'
function monthFromHijriDate(dateHijri?: string): string | null {
  if (!dateHijri) return null
  const m = dateHijri.match(/^(\d{3,4})-(\d{1,2})/)
  return m ? `${m[1]}-${m[2].padStart(2, '0')}` : null
}

export async function recordLesson(db: Db, input: {
  halaqaId: string; teacherId: string; durationHours: number;
  dateHijri?: string; hijriMonth?: string; lessonTitle?: string; majlis?: string; materials?: string;
}, actorUserId?: string): Promise<{ id?: string; error?: string }> {
  if (input.durationHours <= 0) return { error: 'مدة الدرس يجب أن تكون أكبر من صفر' }
  const hijriMonth = input.hijriMonth ?? monthFromHijriDate(input.dateHijri)
  const id = crypto.randomUUID()
  await db.insert(lessonSessions).values({
    id, halaqaId: input.halaqaId, teacherId: input.teacherId, dateHijri: input.dateHijri ?? null,
    hijriMonth, lessonTitle: input.lessonTitle ?? null, majlis: input.majlis ?? null,
    durationHours: input.durationHours, materials: input.materials ?? null, status: 'recorded', createdAt: Date.now(),
  }).run()
  await writeAudit(db, { actorUserId: actorUserId ?? null, action: 'record_lesson', entity: 'lesson_session', entityId: id, after: { halaqaId: input.halaqaId, durationHours: input.durationHours } })
  return { id }
}

// السعر الساري للساعة
async function hourlyRate(db: Db): Promise<number> {
  const rows = await db.select().from(rateSchemes).where(and(
    eq(rateSchemes.kind, 'hourly_rate'), eq(rateSchemes.active, true),
  )).orderBy(desc(rateSchemes.validFrom)).all()
  return rows[0]?.amount ?? 0
}

// مسار الساعات لمعلّم في شهر — يُستهلك من وحدة المالية (ق8)
export async function teacherHoursTrack(db: Db, personId: string, month: string): Promise<{ hours: number; rate: number; amount: number } | null> {
  const t = (await db.select().from(teachers).where(eq(teachers.personId, personId)).all())[0]
  if (!t) return null
  const sessions = await db.select().from(lessonSessions).where(and(
    eq(lessonSessions.teacherId, t.id), eq(lessonSessions.hijriMonth, month),
  )).all()
  const hours = sessions.reduce((s, x) => s + x.durationHours, 0)
  const rate = await hourlyRate(db)
  return { hours, rate, amount: Math.round(hours * rate * 100) / 100 }
}
