import { describe, it, expect } from 'vitest'
import { TOTP, Secret } from 'otpauth'
import { generateSecret, verifyCode } from '../totp.js'

describe('totp', () => {
  it('generateSecret ينتج سراً بصيغة base32 صالحة', () => {
    const secret = generateSecret()
    expect(typeof secret).toBe('string')
    expect(secret.length).toBeGreaterThan(0)
    // لا يرمي استثناء عند إعادة قراءته كـ base32
    expect(() => Secret.fromBase32(secret)).not.toThrow()
  })

  it('verifyCode يقبل الكود الصحيح الحالي', () => {
    const secret = generateSecret()
    const totp = new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secret) })
    const currentCode = totp.generate()
    expect(verifyCode(secret, currentCode)).toBe(true)
  })

  it('verifyCode يرفض كوداً خاطئاً', () => {
    const secret = generateSecret()
    expect(verifyCode(secret, '000000')).toBe(false)
  })

  it('verifyCode يرفض كوداً بسر مختلف', () => {
    const secretA = generateSecret()
    const secretB = generateSecret()
    const totpB = new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(secretB) })
    expect(verifyCode(secretA, totpB.generate())).toBe(false)
  })
})
