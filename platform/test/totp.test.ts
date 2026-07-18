import { describe, it, expect } from 'vitest'
import { totp, verifyTotp, base32Decode, base32Encode } from '../server/utils/totp'

// متجه اختبار RFC 6238: السرّ ASCII "12345678901234567890" (= base32 أدناه)
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('totp — المصادقة الثنائية (RFC 6238)', () => {
  it('base32 ترميز/فكّ ترميز متطابق', () => {
    expect(base32Encode(base32Decode(SECRET))).toBe(SECRET)
  })
  it('يطابق متجه RFC عند T=59 (6 خانات)', async () => {
    expect(await totp(SECRET, { time: 59, digits: 6 })).toBe('287082')
  })
  it('التحقق ينجح ضمن النافذة ويفشل خارجها', async () => {
    const code = await totp(SECRET, { time: 59, digits: 6 })
    expect(await verifyTotp(SECRET, code, { time: 59 })).toBe(true)
    expect(await verifyTotp(SECRET, '000000', { time: 59 })).toBe(false)
    // ضمن نافذة ±1 خطوة (30ث)
    expect(await verifyTotp(SECRET, code, { time: 59 + 30, window: 1 })).toBe(true)
  })
})
