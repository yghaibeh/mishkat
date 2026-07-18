import { describe, it, expect } from 'vitest'
import { monthlyReportHtml } from '../server/services/reportHtml'

const sample = {
  mosque: { id: 'm1', name: 'مسجد الفاروق', genderTrack: 'male' },
  month: '1447-12',
  weeklyTarget: 70,
  weeksCount: 2,
  monthlyTarget: 140,
  monthTotal: 9,
  achievementPct: 6,
  money: 1.61,
  allApproved: true,
  weeks: [
    { weekStart: '2025-12-06', points: 5, status: 'layer_approved', locked: true },
    { weekStart: '2025-12-13', points: 4, status: 'draft', locked: false },
  ],
  activities: [
    { name: 'تدريس «على بصيرة»', times: 2, points: 4 },
    { name: 'اجتماع الأسرة اليومي', times: 1, points: 1 },
  ],
}

describe('reportHtml — قالب التقرير الشهري', () => {
  it('يُنتج HTML عربي RTL يحوي بيانات التقرير', () => {
    const html = monthlyReportHtml(sample as any)
    expect(html).toContain('<html lang="ar" dir="rtl">')
    expect(html).toContain('مسجد الفاروق')
    expect(html).toContain('1447-12')
    expect(html).toContain('$1.61')
    expect(html).toContain('تدريس «على بصيرة»')
    expect(html).toContain('معتمد نهائياً')   // حالة allApproved + الأسبوع المعتمد
    expect(html).toContain('مسودة')            // حالة الأسبوع الثاني
  })

  it('يهرّب HTML الخطير في الأسماء', () => {
    const html = monthlyReportHtml({ ...sample, mosque: { ...sample.mosque, name: '<script>x</script>' } } as any)
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
