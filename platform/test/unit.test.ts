import { describe, it, expect } from 'vitest'
import { buildChildPath, ancestorIds, descendantPattern, isWithin } from '../server/utils/orgPath'
import { entryPoints, computePoints, pointsToMoney } from '../server/utils/points'
import { weekStartSaturday, dayCode, hijriMonthKey, hijriMonthFromWeekStart } from '../server/utils/week'

describe('orgPath — المسار المادّي', () => {
  it('يبني مسار الأبناء', () => {
    expect(buildChildPath(null, 'idlib')).toBe('/idlib/')
    expect(buildChildPath('/idlib/', 'bloc')).toBe('/idlib/bloc/')
  })
  it('يستخرج الآباء (دون العقدة نفسها)', () => {
    expect(ancestorIds('/idlib/bloc/sq/m/')).toEqual(['idlib', 'bloc', 'sq'])
  })
  it('نمط التحقق من النطاق', () => {
    expect(descendantPattern('/idlib/bloc/')).toBe('/idlib/bloc/%')
    expect(isWithin('/idlib/bloc/sq/m/', '/idlib/bloc/')).toBe(true)
    expect(isWithin('/idlib/other/', '/idlib/bloc/')).toBe(false)
  })
})

describe('points — حساب النقاط', () => {
  it('نقاط الإدخال = العدد × الوزن', () => {
    expect(entryPoints(2, 2)).toBe(4)
    expect(entryPoints(0, 5)).toBe(0)
  })
  it('يتجاهل الإدخالات بلا إقرار شورى', () => {
    const weights = new Map([['a', 2], ['b', 1]])
    const entries = [
      { activityTypeId: 'a', count: 2, shuraConfirmed: true },   // 4
      { activityTypeId: 'b', count: 3, shuraConfirmed: false },  // مُتجاهل
      { activityTypeId: 'b', count: 1, shuraConfirmed: true },   // 1
    ]
    expect(computePoints(entries, weights)).toBe(5)
  })
  it('القيمة المالية: 280 نقطة = 50$', () => {
    expect(pointsToMoney(280, 50, 280)).toBe(50)
    expect(pointsToMoney(70, 50, 280)).toBe(12.5)
  })
})

describe('week — الأسبوع يبدأ السبت', () => {
  const sat = new Date(Date.UTC(2024, 0, 6))  // السبت 6 يناير 2024
  const sun = new Date(Date.UTC(2024, 0, 7))
  const fri = new Date(Date.UTC(2024, 0, 12))
  const nextSat = new Date(Date.UTC(2024, 0, 13))
  it('يحسب بداية الأسبوع (السبت)', () => {
    expect(weekStartSaturday(sat)).toBe('2024-01-06')
    expect(weekStartSaturday(sun)).toBe('2024-01-06')
    expect(weekStartSaturday(fri)).toBe('2024-01-06')
    expect(weekStartSaturday(nextSat)).toBe('2024-01-13')
  })
  it('رمز اليوم', () => {
    expect(dayCode(sat)).toBe('sat')
    expect(dayCode(sun)).toBe('sun')
  })
})

describe('hijri — التقويم الهجري (أم القرى عبر Intl)', () => {
  it('يحوّل الميلادي إلى مفتاح شهر هجري YYYY-MM', () => {
    expect(hijriMonthKey(new Date('2026-06-14T00:00:00Z'))).toBe('1447-12')
    expect(hijriMonthFromWeekStart('2025-12-06')).toBe('1447-06')
  })
})
