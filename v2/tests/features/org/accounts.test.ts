/**
 * الحسابات ودورة الحياة — SPEC_org_and_accounts §٢ (ق-٢٢/ق-٢٣).
 */
import { describe, it, expect } from "vitest"
import { seedWorld } from "./_seed.js"
import { createAccount, setStatus, resetPassword } from "../../../src/features/org/services/accounts.js"

describe("إنشاء الحساب", () => {
  it("ينشئ حساباً فعّالاً بحِقبةٍ ابتدائية واسمٍ فريد", () => {
    const { store } = seedWorld()
    const r = createAccount(store, { username: "newbie" })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.status).toBe("active")
      expect(store.getAccount(r.value.personId)?.username).toBe("newbie")
    }
  })

  it("يرفض اسم دخولٍ محجوزاً", () => {
    const { store } = seedWorld()
    const r = createAccount(store, { username: "u-amir" })
    expect(!r.ok && r.error.code).toBe("USERNAME_TAKEN")
  })
})

describe("حالة الحساب والإبطال اللحظي (ق-٢٢/ق-٢٣)", () => {
  it("تجميد الحساب يرفع الحِقبة فتسقط الجلسات فوراً", () => {
    const { store } = seedWorld()
    const before = store.getAccount("u-amir")!.sessionEpoch
    const r = setStatus(store, "u-amir", "suspended")
    expect(r.ok && r.value.status).toBe("suspended")
    expect(store.getAccount("u-amir")!.sessionEpoch).toBeGreaterThan(before)
  })

  it("الإلغاء نهائيّ لا رجعة له — لا يعود من ملغى إلى فعّال", () => {
    const { store } = seedWorld()
    setStatus(store, "u-amir", "cancelled")
    const r = setStatus(store, "u-amir", "active")
    expect(!r.ok && r.error.code).toBe("INVALID_STATUS_TRANSITION")
  })

  it("إعادة الحساب الموقوف إلى فعّال جائزة", () => {
    const { store } = seedWorld()
    setStatus(store, "u-amir", "suspended")
    expect(setStatus(store, "u-amir", "active").ok).toBe(true)
  })

  it("يرفض تغيير حالة حسابٍ غير موجود", () => {
    const { store } = seedWorld()
    expect(setStatus(store, "ghost", "suspended").ok).toBe(false)
  })
})

describe("إعادة تعيين كلمة المرور ترفع الحِقبة (ق-٢٣)", () => {
  it("ترفع الحِقبة فتبطل الرموز القديمة", () => {
    const { store } = seedWorld()
    const before = store.getAccount("u-teacher")!.sessionEpoch
    const r = resetPassword(store, "u-teacher")
    expect(r.ok).toBe(true)
    expect(store.getAccount("u-teacher")!.sessionEpoch).toBeGreaterThan(before)
  })

  it("يرفض حساباً غير موجود", () => {
    const { store } = seedWorld()
    expect(resetPassword(store, "ghost").ok).toBe(false)
  })
})
