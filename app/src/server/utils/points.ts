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

// قواعد اللجنة (0047) — تُطبَّق قبل حساب النقاط:
// سقفٌ يوميّ للعدد، وعتبةُ مشاركةٍ مئويّةٌ من طلاب الأسرة المسجّلين (دون بلوغها لا نقاط).
// ق١ (تشديد): نشاطٌ مشروطُ المشاركةِ وعددُ طلاب الأسرة غيرُ محدَّدٍ ⇒ غيرُ مؤهَّلٍ أصلًا —
// كان يمرّ صامتًا (fail-open) فتُحتسب الصلواتُ بلا تحقّقٍ من النسبة؛ الواجهة تُلزم الأميرَ بالعدد أوّلًا.
export interface ActivityRule { maxPerDay: number | null; minParticipationPct: number | null }
export function applyActivityRules(
  count: number,
  participantCount: number,
  rule: ActivityRule | undefined,
  familyStudents: number | null | undefined,
): { count: number; eligible: boolean; requiredParticipants: number | null } {
  const capped = rule?.maxPerDay != null ? Math.min(Math.max(0, count), rule.maxPerDay) : Math.max(0, count)
  if (rule?.minParticipationPct != null) {
    if (familyStudents == null || familyStudents <= 0) return { count: capped, eligible: false, requiredParticipants: null }
    const required = Math.ceil((rule.minParticipationPct / 100) * familyStudents)
    return { count: capped, eligible: participantCount >= required, requiredParticipants: required }
  }
  return { count: capped, eligible: true, requiredParticipants: null }
}
