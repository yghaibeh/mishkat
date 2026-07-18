import { describe, it, expect } from 'vitest'
import {
  isAdmin, canAccess, isAmirOf, canEditLockedWeek, canUnlockWeek,
  canLockWeek, isLayerApprover, isSupervisor,
} from '../server/utils/caps'

// مسارات: مسجد m1 تحت مربع sq1 تحت كتلة bloc تحت رابطة idlib
const M1 = '/idlib/bloc/sq1/m1/'
const M2 = '/idlib/bloc/sq2/m2/' // مسجد في مربع آخر

const mk = (assignments: any[]) => ({ userId: 'u', personId: 'p', fullName: 'x', assignments }) as any
const admin = mk([{ role: 'admin', orgUnitId: 'idlib', orgPath: '/idlib/' }])
const bloc = mk([{ role: 'bloc', orgUnitId: 'bloc', orgPath: '/idlib/bloc/' }])
const square = mk([{ role: 'square', orgUnitId: 'sq1', orgPath: '/idlib/bloc/sq1/' }])
const amir = mk([{ role: 'amir', orgUnitId: 'm1', orgPath: M1 }])
const member = mk([{ role: 'member', orgUnitId: 'm1', orgPath: M1 }])

describe('caps — الوصول النطاقي (القاعدة الذهبية)', () => {
  it('كلٌّ يرى نطاقه فقط', () => {
    expect(canAccess(admin, M1)).toBe(true)
    expect(canAccess(admin, M2)).toBe(true)
    expect(canAccess(bloc, M1)).toBe(true)
    expect(canAccess(bloc, M2)).toBe(true)        // كلا المسجدين تحت الكتلة
    expect(canAccess(square, M1)).toBe(true)
    expect(canAccess(square, M2)).toBe(false)      // مربع آخر
    expect(canAccess(amir, M1)).toBe(true)
    expect(canAccess(amir, M2)).toBe(false)
    expect(canAccess(member, M2)).toBe(false)
  })
})

describe('caps — أدوار المسجد', () => {
  it('isAmirOf للمسجد الصحيح فقط', () => {
    expect(isAmirOf(amir, 'm1')).toBe(true)
    expect(isAmirOf(amir, 'm2')).toBe(false)
    expect(isAmirOf(square, 'm1')).toBe(false)
  })
  it('isAdmin / isSupervisor', () => {
    expect(isAdmin(admin)).toBe(true)
    expect(isAdmin(bloc)).toBe(false)
    expect([square, bloc, admin].every(isSupervisor)).toBe(true)
    expect(isSupervisor(amir)).toBe(false)
    expect(isSupervisor(member)).toBe(false)
  })
})

describe('caps — قفل الأسبوع (ق5)', () => {
  it('تعديل/فتح المقفل للكتلة/المحافظة فأعلى فقط', () => {
    expect(canEditLockedWeek(bloc, M1)).toBe(true)
    expect(canEditLockedWeek(admin, M1)).toBe(true)
    expect(canEditLockedWeek(square, M1)).toBe(false)   // المربع لا يعدّل المقفل
    expect(canEditLockedWeek(amir, M1)).toBe(false)
    expect(canEditLockedWeek(bloc, M2)).toBe(true)
    expect(canUnlockWeek(square, M1)).toBe(false)
  })
  it('القفل للأمير أو أعلى', () => {
    expect(canLockWeek(amir, 'm1', M1)).toBe(true)
    expect(canLockWeek(bloc, 'm1', M1)).toBe(true)
    expect(canLockWeek(square, 'm1', M1)).toBe(false)   // المربع ليس أميراً ولا كتلة
    expect(canLockWeek(amir, 'm2', M2)).toBe(false)     // ليس أمير m2
  })
})

describe('caps — الاعتماد النهائي (ق1)', () => {
  it('أعلى طبقة مفعّلة فوق المسجد', () => {
    expect(isLayerApprover(square, M1)).toBe(true)      // المربع فوق المسجد
    expect(isLayerApprover(bloc, M1)).toBe(true)
    expect(isLayerApprover(admin, M1)).toBe(true)
    expect(isLayerApprover(amir, M1)).toBe(false)       // الأمير ليس طبقة أعلى
    expect(isLayerApprover(member, M1)).toBe(false)
    expect(isLayerApprover(square, M2)).toBe(false)     // مربع آخر
  })
})
