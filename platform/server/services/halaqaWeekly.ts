import { and, eq } from 'drizzle-orm'
import { halaqaGroupActivities, weeklyHalaqaRecords, studentEvaluations } from '../database/schema'
import type { Db } from '../utils/db'

// حلقات «على بصيرة» الأسبوعية التفصيلية (من سجل كتاب على بصيرة):
// تقييم الطلاب في الدروس + الأنشطة الجماعية (حتى 5) + ملاحظات الإشراف/الإدارة.

const MAX_GROUP_ACTIVITIES = 5

export async function addGroupActivity(db: Db, input: { halaqaId: string; weekStart: string; description: string; dateHijri?: string }): Promise<{ id?: string; seq?: number; error?: string }> {
  const existing = await db.select().from(halaqaGroupActivities).where(and(
    eq(halaqaGroupActivities.halaqaId, input.halaqaId), eq(halaqaGroupActivities.weekStart, input.weekStart),
  )).all()
  if (existing.length >= MAX_GROUP_ACTIVITIES) return { error: `الحدّ الأقصى ${MAX_GROUP_ACTIVITIES} أنشطة جماعية للأسبوع` }
  const id = crypto.randomUUID()
  const seq = existing.length + 1
  await db.insert(halaqaGroupActivities).values({
    id, halaqaId: input.halaqaId, weekStart: input.weekStart, seq, description: input.description,
    dateHijri: input.dateHijri ?? null, createdAt: Date.now(),
  }).run()
  return { id, seq }
}

export async function upsertWeeklyHalaqaRecord(db: Db, halaqaId: string, weekStart: string, notes: { supervisorNotes?: string; adminNotes?: string }) {
  const existing = await db.select().from(weeklyHalaqaRecords).where(and(
    eq(weeklyHalaqaRecords.halaqaId, halaqaId), eq(weeklyHalaqaRecords.weekStart, weekStart),
  )).all()
  if (existing[0]) {
    await db.update(weeklyHalaqaRecords).set({
      supervisorNotes: notes.supervisorNotes ?? existing[0].supervisorNotes,
      adminNotes: notes.adminNotes ?? existing[0].adminNotes,
    }).where(eq(weeklyHalaqaRecords.id, existing[0].id)).run()
    return { id: existing[0].id }
  }
  const id = crypto.randomUUID()
  await db.insert(weeklyHalaqaRecords).values({
    id, halaqaId, weekStart, supervisorNotes: notes.supervisorNotes ?? null, adminNotes: notes.adminNotes ?? null, createdAt: Date.now(),
  }).run()
  return { id }
}

export async function addStudentEvaluation(db: Db, input: { enrollmentId: string; lessonSessionId: string; score?: number; note?: string }) {
  const id = crypto.randomUUID()
  await db.insert(studentEvaluations).values({
    id, enrollmentId: input.enrollmentId, lessonSessionId: input.lessonSessionId,
    score: input.score ?? null, note: input.note ?? null, createdAt: Date.now(),
  }).run()
  return { id }
}
