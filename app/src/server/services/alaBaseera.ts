import { and, eq, inArray } from 'drizzle-orm'
import {
  venues, teachers, halaqat, enrollments, lessonSessions,
} from '../database/schema'
import { writeAudit } from '../utils/audit'
import { rateForMonth } from '../utils/scheme'
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

export async function createHalaqa(db: Db, input: { name: string; venueId: string; teacherId: string; genderTrack?: string; capacity?: number; curriculum?: string }) {
  const id = crypto.randomUUID()
  await db.insert(halaqat).values({
    id, name: input.name, venueId: input.venueId, teacherId: input.teacherId,
    genderTrack: input.genderTrack ?? 'male', capacity: input.capacity ?? 30,
    curriculum: input.curriculum || 'baseera', createdAt: Date.now(),
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

// سعر الساعة المُطبَّق على شهرٍ بعينه (بأثرٍ قادمٍ لا رجعي — ق-6)
async function hourlyRate(db: Db, month: string): Promise<number> {
  const r = await rateForMonth(db, 'hourly_rate', month)
  return r?.amount ?? 0
}

// مسار الساعات لمعلّم في شهر — يُستهلك من وحدة المالية (ق8)
export async function teacherHoursTrack(db: Db, personId: string, month: string): Promise<{ hours: number; rate: number; amount: number } | null> {
  // كلُّ كيانات المعلّم النشطة لهذا الشخص (قد تتعدّد صفوفُه) — لا أوّلُ صفٍّ فقط (ج٢)
  const ts = (await db.select().from(teachers).where(eq(teachers.personId, personId)).all()).filter((t) => t.active)
  if (!ts.length) return null
  const teacherIds = ts.map((t) => t.id)
  // المالية تُحتسَب للدروس المعتمَدة فقط (موافقة المدير/المشرف — منعاً للغش)
  const sessions = await db.select().from(lessonSessions).where(and(
    inArray(lessonSessions.teacherId, teacherIds), eq(lessonSessions.hijriMonth, month), eq(lessonSessions.status, 'approved'),
  )).all()
  // المالية لـ«على بصيرة» فقط (قرار D3): استبعاد دروس مناهج التحفيظ/الرشيدي/العام
  const halaqaIds = [...new Set(sessions.map((x) => x.halaqaId))]
  const baseeraHalaqat = halaqaIds.length
    ? await db.select({ id: halaqat.id }).from(halaqat).where(and(inArray(halaqat.id, halaqaIds), eq(halaqat.curriculum, 'baseera'))).all()
    : []
  const baseeraSet = new Set(baseeraHalaqat.map((h) => h.id))
  const hours = sessions.filter((x) => baseeraSet.has(x.halaqaId)).reduce((s, x) => s + x.durationHours, 0)
  const rate = await hourlyRate(db, month)
  return { hours, rate, amount: Math.round(hours * rate * 100) / 100 }
}
