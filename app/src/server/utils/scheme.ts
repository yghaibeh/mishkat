import { and, desc, eq } from 'drizzle-orm'
import { pointsSchemes, pointsSchemeItems, activityTypes, rateSchemes } from '../database/schema'
import { hijriMonthStartMs } from './week'
import type { Db } from './db'

async function schemeItems(db: Db, schemeId: string) {
  const items = await db.select({
    activityTypeId: pointsSchemeItems.activityTypeId,
    points: pointsSchemeItems.points,
    code: activityTypes.code,
    name: activityTypes.name,
    sortOrder: activityTypes.sortOrder,
  }).from(pointsSchemeItems)
    .innerJoin(activityTypes, eq(activityTypes.id, pointsSchemeItems.activityTypeId))
    .where(eq(pointsSchemeItems.schemeId, schemeId)).all()
  items.sort((a, b) => a.sortOrder - b.sortOrder)
  return items
}

// المخطط الساري لمسار جنس معيّن + بنوده (الأحدث صلاحيةً) — يُستخدم عند إنشاء سجلٍ جديد فقط
export async function currentScheme(db: Db, genderTrack: string) {
  const schemes = await db.select().from(pointsSchemes)
    .where(and(eq(pointsSchemes.genderTrack, genderTrack), eq(pointsSchemes.active, true)))
    .orderBy(desc(pointsSchemes.validFrom)).all()
  const scheme = schemes[0]
  if (!scheme) return null
  return { scheme, items: await schemeItems(db, scheme.id) }
}

// مخططٌ بعينه (المخطط المثبَّت على السجل وقت إنشائه) — لإعادة حسابٍ بلا أثرٍ رجعي (ق-6)
export async function schemeById(db: Db, schemeId: string) {
  const scheme = (await db.select().from(pointsSchemes).where(eq(pointsSchemes.id, schemeId)).all())[0]
  if (!scheme) return null
  return { scheme, items: await schemeItems(db, scheme.id) }
}

// خريطة وزن كل نشاط في مخطط (activityTypeId → points)
export function weightMap(items: Array<{ activityTypeId: string; points: number }>): Map<string, number> {
  return new Map(items.map((i) => [i.activityTypeId, i.points]))
}

// المعدّل المالي الساري للنقطة (الأحدث) — للعرض التقديري الحالي فقط
export async function currentPointRate(db: Db) {
  const rows = await db.select().from(rateSchemes)
    .where(and(eq(rateSchemes.kind, 'point_rate'), eq(rateSchemes.active, true)))
    .orderBy(desc(rateSchemes.validFrom)).all()
  return rows[0] ?? null
}

// المعدّل المُطبَّق على شهرٍ هجري بعينه: أحدث معدّلٍ سرى قبل/مع بداية الشهر (ق-6: بأثرٍ قادمٍ لا رجعي).
// تغييرُ معدّلٍ اليوم لا يمسّ شهراً بدأ قبل سريانه؛ ويسري تلقائياً من الشهر التالي.
export async function rateForMonth(db: Db, kind: string, month: string) {
  const monthStart = hijriMonthStartMs(month)
  // كسرُ التعادل بالمعرّف (بعد validFrom) ⇒ اختيارٌ حتميٌّ لمعدّلين بنفس تاريخ السريان (ج١)
  const rows = (await db.select().from(rateSchemes)
    .where(and(eq(rateSchemes.kind, kind), eq(rateSchemes.active, true))).all())
    .sort((a, b) => (b.validFrom ?? 0) - (a.validFrom ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return rows.find((r) => (r.validFrom ?? 0) <= monthStart) ?? rows[rows.length - 1] ?? null
}
