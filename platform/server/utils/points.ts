// منطق حساب النقاط — دوال نقية (قابلة للاختبار بلا قاعدة بيانات)

export interface CountedEntry {
  activityTypeId: string
  count: number
  shuraConfirmed: boolean
}

// نقاط إدخال واحد = العدد × وزن النشاط (درسان من نشاط وزنه 2 = 4)
export function entryPoints(count: number, weight: number): number {
  return Math.max(0, count) * weight
}

// مجموع نقاط مجموعة إدخالات.
// قاعدة التوطئة (ق): يوم/إدخال بلا إقرار شورى لا يُحتسب.
export function computePoints(entries: CountedEntry[], weightByActivity: Map<string, number>): number {
  let total = 0
  for (const e of entries) {
    if (!e.shuraConfirmed) continue
    total += entryPoints(e.count, weightByActivity.get(e.activityTypeId) ?? 0)
  }
  return total
}

// القيمة المالية للنقاط (ق2): points × (amount / perUnit). مثال 280 نقطة=50$.
export function pointsToMoney(points: number, amount: number, perUnit: number): number {
  if (!perUnit) return 0
  return Math.round((points * (amount / perUnit)) * 100) / 100
}
