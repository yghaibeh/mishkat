import { and, desc, eq } from 'drizzle-orm'
import { pointsSchemes, pointsSchemeItems, activityTypes, rateSchemes } from '../database/schema'
import type { Db } from './db'

// المخطط الساري لمسار جنس معيّن + بنوده (الأحدث صلاحيةً)
export async function currentScheme(db: Db, genderTrack: string) {
  const schemes = await db.select().from(pointsSchemes)
    .where(and(eq(pointsSchemes.genderTrack, genderTrack), eq(pointsSchemes.active, true)))
    .orderBy(desc(pointsSchemes.validFrom)).all()
  const scheme = schemes[0]
  if (!scheme) return null

  const items = await db.select({
    activityTypeId: pointsSchemeItems.activityTypeId,
    points: pointsSchemeItems.points,
    code: activityTypes.code,
    name: activityTypes.name,
    sortOrder: activityTypes.sortOrder,
  }).from(pointsSchemeItems)
    .innerJoin(activityTypes, eq(activityTypes.id, pointsSchemeItems.activityTypeId))
    .where(eq(pointsSchemeItems.schemeId, scheme.id)).all()

  items.sort((a, b) => a.sortOrder - b.sortOrder)
  return { scheme, items }
}

// خريطة وزن كل نشاط في مخطط (activityTypeId → points)
export function weightMap(items: Array<{ activityTypeId: string; points: number }>): Map<string, number> {
  return new Map(items.map((i) => [i.activityTypeId, i.points]))
}

// المعدّل المالي الساري للنقطة (الأحدث)
export async function currentPointRate(db: Db) {
  const rows = await db.select().from(rateSchemes)
    .where(and(eq(rateSchemes.kind, 'point_rate'), eq(rateSchemes.active, true)))
    .orderBy(desc(rateSchemes.validFrom)).all()
  return rows[0] ?? null
}
