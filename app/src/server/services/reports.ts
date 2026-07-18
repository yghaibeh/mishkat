import { and, eq, inArray } from 'drizzle-orm'
import { orgUnits, weeklyRecords, dailyEntries } from '../database/schema'
import { currentScheme, weightMap, rateForMonth } from '../utils/scheme'
import { weeksInHijriMonth } from '../utils/week'
import { pointsToMoney } from '../utils/points'
import type { Db } from '../utils/db'

// التقرير الشهري المولّد لمسجد (المادة 19 + شاشة التقرير الشهري):
// النقاط الأسبوعية + تفصيل الأنشطة + المجموع وقيمته المالية + حالة الاعتماد.
export async function monthlyMosqueReport(db: Db, mosqueId: string, month: string) {
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all())[0]
  if (!mosque || mosque.type !== 'mosque') throw new Error('المسجد غير موجود')

  const sc = await currentScheme(db, mosque.genderTrack)
  const weights = weightMap(sc?.items ?? [])
  const nameOf = new Map((sc?.items ?? []).map((i) => [i.activityTypeId, i.name]))
  const weeklyTarget = sc?.scheme.weeklyTarget ?? 70

  const recs = await db.select().from(weeklyRecords).where(and(
    eq(weeklyRecords.mosqueId, mosqueId), eq(weeklyRecords.hijriMonth, month),
  )).all()
  recs.sort((a, b) => a.weekStart.localeCompare(b.weekStart))

  const recIds = recs.map((r) => r.id)
  const entries = recIds.length
    ? await db.select().from(dailyEntries).where(inArray(dailyEntries.weeklyRecordId, recIds)).all()
    : []

  // تفصيل الأنشطة (الإدخالات المعتمَدة بالشورى فقط — كما في حساب المجموع)
  const agg = new Map<string, { name: string; times: number; points: number }>()
  for (const e of entries) {
    if (!e.shuraConfirmed) continue
    const cur = agg.get(e.activityTypeId) ?? { name: nameOf.get(e.activityTypeId) ?? e.activityTypeId, times: 0, points: 0 }
    cur.times += e.count
    cur.points += e.points
    agg.set(e.activityTypeId, cur)
  }

  const monthTotal = recs.reduce((s, r) => s + r.totalPoints, 0)
  // عدد أسابيع الشهر = عدد سُبوته تقويمياً (٤/٥)، لا عدد السجلات المُدخَلة (ق-10)
  const weeksCount = weeksInHijriMonth(month) || 4
  const monthlyTarget = weeklyTarget * weeksCount
  const rate = await rateForMonth(db, 'point_rate', month)

  // الأسابيع النشطة فقط (التي تحتوي بيانات فعلية) — تتجاهل الأسابيع الفارغة في الشهر الجزئي
  const activeRecs = recs.filter(r => r.totalPoints > 0 || r.lastEntryAt !== null)

  return {
    mosque: { id: mosque.id, name: mosque.name, genderTrack: mosque.genderTrack },
    month,
    weeklyTarget,
    weeksCount,
    monthlyTarget,
    monthTotal,
    achievementPct: monthlyTarget ? Math.round((monthTotal / monthlyTarget) * 100) : 0,
    money: rate ? pointsToMoney(monthTotal, rate.amount, rate.perUnit ?? 1) : null,
    allApproved: activeRecs.length > 0 && activeRecs.every((r) => r.status === 'layer_approved'),
    weeks: recs.map((r) => ({ weekStart: r.weekStart, points: r.totalPoints, status: r.status, locked: r.locked })),
    activities: [...agg.values()].sort((a, b) => b.points - a.points),
  }
}
