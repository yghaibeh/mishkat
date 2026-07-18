// جسر الطلاب الثنائيّ (0050) — إغلاق فجوة «سجلّي طلابٍ منفصلين»:
// طالبُ سجلّ الحلقات (circle_students) وطالبُ وحدة التحفيظ (tahfeez_students) صفّان لهويّةٍ واحدة.
// معرّفاتٌ اشتقاقيّة (ts-<csId> / cs-<tsId>) ⇒ مرآةٌ حتميّةٌ بلا ازدواجٍ ولا حلقات ارتداد.
import { and, eq } from 'drizzle-orm'
import { circles, circleStudents, halaqat as halaqatTbl, tahfeezCircles, tahfeezStudents, venues } from '../database/schema'
import type { Db } from '../utils/db'

// حلقة التحفيظ المقابلة لحلقة السجلّ: بالمعرّف الاشتقاقيّ أوّلًا ثم بالاسم داخل المسجد
export async function tahfeezTwin(db: Db, circle: { id: string; mosqueId: string; name: string }) {
  const byId = (await db.select().from(tahfeezCircles).where(eq(tahfeezCircles.id, `tc-${circle.id}`)).all())[0]
  if (byId) return byId
  return (await db.select().from(tahfeezCircles)
    .where(and(eq(tahfeezCircles.mosqueId, circle.mosqueId), eq(tahfeezCircles.name, circle.name))).all())[0]
}

// حلقة السجلّ المقابلة لحلقة تحفيظ: عكس الاشتقاق ثم الاسم
async function registryTwin(db: Db, tc: { id: string; mosqueId: string; name: string }) {
  if (tc.id.startsWith('tc-')) {
    const byId = (await db.select().from(circles).where(eq(circles.id, tc.id.slice(3))).all())[0]
    if (byId) return byId
  }
  return (await db.select().from(circles)
    .where(and(eq(circles.mosqueId, tc.mosqueId), eq(circles.name, tc.name), eq(circles.type, 'tahfeez'))).all())[0]
}

// أُضيف طالبٌ في سجلّ الحلقات ⇒ مرآتُه في وحدة التحفيظ (إن كانت الحلقة تحفيظًا مجسورة)
export async function mirrorStudentToTahfeez(db: Db, circleStudent: { id: string; circleId: string; name: string; personId: string | null }) {
  const c = (await db.select().from(circles).where(eq(circles.id, circleStudent.circleId)).all())[0]
  if (!c || c.type !== 'tahfeez') return
  const twin = await tahfeezTwin(db, c)
  if (!twin) return
  const mirrorId = `ts-${circleStudent.id}`
  const exists = (await db.select({ id: tahfeezStudents.id }).from(tahfeezStudents).where(eq(tahfeezStudents.id, mirrorId)).all())[0]
  if (exists) {
    await db.update(tahfeezStudents).set({ status: 'active', studentName: circleStudent.name }).where(eq(tahfeezStudents.id, mirrorId)).run()
    return
  }
  // اسمٌ مطابقٌ موجودٌ أصلًا في التحفيظ (أدخله المعلّم يدويًّا)؟ لا نكرّره
  const sameName = (await db.select({ id: tahfeezStudents.id }).from(tahfeezStudents)
    .where(and(eq(tahfeezStudents.circleId, twin.id), eq(tahfeezStudents.studentName, circleStudent.name), eq(tahfeezStudents.status, 'active'))).all())[0]
  if (sameName) return
  await db.insert(tahfeezStudents).values({
    id: mirrorId, circleId: twin.id, personId: circleStudent.personId ?? '', studentName: circleStudent.name,
    status: 'active', createdAt: Date.now(),
  }).run()
}

// أُضيف طالبٌ في وحدة التحفيظ ⇒ مرآتُه في سجلّ الحلقات (ليتطابق العدّ والهويّة)
export async function mirrorStudentToRegistry(db: Db, tahfeezStudent: { id: string; circleId: string; studentName: string | null; personId: string | null }) {
  if (tahfeezStudent.id.startsWith('ts-')) return // هو نفسه مرآة — لا ارتداد
  const tc = (await db.select().from(tahfeezCircles).where(eq(tahfeezCircles.id, tahfeezStudent.circleId)).all())[0]
  if (!tc) return
  const twin = await registryTwin(db, tc)
  if (!twin) return
  const name = tahfeezStudent.studentName || '—'
  const mirrorId = `cs-${tahfeezStudent.id}`
  const exists = (await db.select({ id: circleStudents.id }).from(circleStudents).where(eq(circleStudents.id, mirrorId)).all())[0]
  if (exists) {
    await db.update(circleStudents).set({ status: 'active', name }).where(eq(circleStudents.id, mirrorId)).run()
    return
  }
  const sameName = (await db.select({ id: circleStudents.id }).from(circleStudents)
    .where(and(eq(circleStudents.circleId, twin.id), eq(circleStudents.name, name), eq(circleStudents.status, 'active'))).all())[0]
  if (sameName) return
  await db.insert(circleStudents).values({
    id: mirrorId, circleId: twin.id, name, personId: tahfeezStudent.personId || null,
    notes: null, status: 'active', createdAt: Date.now(),
  }).run()
}

// إزالة طالبٍ من جهةٍ تُخمل مرآتَه في الأخرى (بالمعرّف الاشتقاقيّ في الاتجاهين)
export async function mirrorRemoval(db: Db, removedId: string, from: 'registry' | 'tahfeez') {
  if (from === 'registry') {
    // أُزيل cs-… ⇒ أصله ts؛ وإلا فمرآته ts-<id>
    const twinId = removedId.startsWith('cs-') ? removedId.slice(3) : `ts-${removedId}`
    await db.update(tahfeezStudents).set({ status: 'left' }).where(eq(tahfeezStudents.id, twinId)).run()
  } else {
    const twinId = removedId.startsWith('ts-') ? removedId.slice(3) : `cs-${removedId}`
    await db.update(circleStudents).set({ status: 'left' }).where(eq(circleStudents.id, twinId)).run()
  }
}

// مزامنة التوأمين عند تعديل حلقة السجلّ (غ٨): الاسم/المعلّم/الأرشفة تنعكس على
// توأم التحفيظ وحلقة «على بصيرة» — فلا تفترق الوحدات عن مصدرها أبدًا.
export async function syncCircleTwins(
  db: Db,
  circle: { id: string; mosqueId: string; type: string; name: string },
  patch: { name?: string; teacherPersonId?: string | null; archived?: boolean },
) {
  if (circle.type === 'tahfeez') {
    const twin = await tahfeezTwin(db, circle)
    if (twin) {
      const upd: Record<string, unknown> = {}
      if (patch.name && patch.name !== twin.name) upd.name = patch.name
      if (patch.teacherPersonId !== undefined) upd.teacherPersonId = patch.teacherPersonId
      if (patch.archived !== undefined) upd.status = patch.archived ? 'archived' : 'active'
      if (Object.keys(upd).length) await db.update(tahfeezCircles).set(upd).where(eq(tahfeezCircles.id, twin.id)).run()
    }
    return
  }
  if (circle.type === 'ala_baseera') {
    // توأم على بصيرة: حلقة halaqat باسمها داخل مكان المسجد
    const twin = (await db.select({ h: halaqatTbl }).from(halaqatTbl)
      .innerJoin(venues, eq(venues.id, halaqatTbl.venueId))
      .where(and(eq(venues.orgUnitId, circle.mosqueId), eq(halaqatTbl.name, circle.name))).all())[0]?.h
      ?? (await db.select().from(halaqatTbl).where(eq(halaqatTbl.id, `h-${circle.id}`)).all())[0]
    if (twin) {
      const upd: Record<string, unknown> = {}
      if (patch.name && patch.name !== twin.name) upd.name = patch.name
      if (patch.archived !== undefined) upd.status = patch.archived ? 'archived' : 'active'
      if (Object.keys(upd).length) await db.update(halaqatTbl).set(upd).where(eq(halaqatTbl.id, twin.id)).run()
    }
  }
}
