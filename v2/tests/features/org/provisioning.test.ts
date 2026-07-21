/**
 * التمكين المفوَّض — SPEC_org_and_accounts §٤ + SPEC_authorization §١.٦.
 * القاعدة الرياضية المانعة للتصعيد: الشروط الخمسة عبر `canProvision` — صفر فحص دور.
 * **السلب مُبرهَن**: محاولاتُ التصعيد تُرفض، وحالاتُ السلب أكثر من الإيجاب.
 */
import { describe, it, expect } from "vitest"
import { seedWorld, NOW } from "./_seed.js"
import { provision } from "../../../src/features/org/services/provisioning.js"
import { buildActor } from "../../../src/features/org/services/session.js"
import type { Actor, Override } from "../../../src/authorization/can.js"

const CTX = { now: NOW, intent: "write" as const, isFeatureEnabled: () => true }

describe("التوفير من فوق ينجح داخل المصفوفة (ع-٤/١٧/٢٧/٢٨)", () => {
  it("أمير المسجد يوفّر محفّظاً على مسجده مباشرةً — حساب + تكليف معتمَد ذرّياً", () => {
    const w = seedWorld()
    const r = provision(w.store, w.actor("u-amir"), CTX, {
      targetUnitId: "khalid",
      targetRoleId: "teacher",
      username: "hafith",
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.assignment.roleId).toBe("teacher")
      expect(r.value.assignment.scopePath).toBe("/men/homs/sq2/khalid/")
      expect(r.value.assignment.approvalStatus).toBe("approved")
      expect(w.store.getAccount(r.value.account.personId)?.status).toBe("active")
    }
  })

  it("أمير المسجد يوفّر مسؤول لجنة على مسجده (ع-٢٨ نمط اللجان قاعدةً)", () => {
    const w = seedWorld()
    const r = provision(w.store, w.actor("u-amir"), CTX, {
      targetUnitId: "khalid",
      targetRoleId: "committee_head",
      username: "lajna",
    })
    expect(r.ok).toBe(true)
  })

  it("مسؤول المربع يوفّر أميراً على مساجد مربعه (ع-٣٢)", () => {
    const w = seedWorld()
    const r = provision(w.store, w.actor("u-square"), CTX, {
      targetUnitId: "bilal",
      targetRoleId: "amir",
      username: "amir-bilal-2",
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.assignment.roleId).toBe("amir")
  })
})

describe("استحالةُ تصعيد الامتياز رياضياً — السلب مُبرهَن (§١.٦)", () => {
  it("ش٢: أميرٌ لا يوفّر أميراً (رتبته لا تكفي)", () => {
    const w = seedWorld()
    const r = provision(w.store, w.actor("u-amir"), CTX, {
      targetUnitId: "khalid",
      targetRoleId: "amir",
      username: "clone",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe("PROVISION_DENIED")
      expect(r.error.detail).toBe("ش٢")
    }
  })

  it("ش٢: أميرٌ لا يوفّر مسؤول مربعٍ أعلى منه", () => {
    const w = seedWorld()
    const r = provision(w.store, w.actor("u-amir"), CTX, {
      targetUnitId: "khalid",
      targetRoleId: "square",
      username: "up",
    })
    expect(!r.ok && r.error.detail).toBe("ش٢")
  })

  it("ش٣: نوعُ الوحدة يمنع — «أمير» على وحدةٍ من نوع مربع", () => {
    const w = seedWorld()
    const r = provision(w.store, w.actor("u-amir"), CTX, {
      targetUnitId: "khalid",
      targetRoleId: "teacher",
      username: "ok1",
    })
    expect(r.ok).toBe(true) // ضبطُ خطٍّ أساس؛ يليه السلب:
    const r2 = provision(w.store, w.actor("u-square"), CTX, {
      targetUnitId: "sq2",
      targetRoleId: "amir",
      username: "amir-on-square",
    })
    expect(!r2.ok && r2.error.detail).toBe("ش٣")
  })

  it("ش٤: أميرٌ لا يوفّر خارج نطاقه — على مسجدٍ مجاور", () => {
    const w = seedWorld()
    const r = provision(w.store, w.actor("u-amir"), CTX, {
      targetUnitId: "bilal",
      targetRoleId: "teacher",
      username: "far",
    })
    expect(!r.ok && r.error.detail).toBe("ش٤")
  })

  it("ش٥: حتى المدير لا يوفّر دوراً عالياً إن حُجبت عنه القدرة الجذرية", () => {
    const w = seedWorld()
    const base = w.actor("u-admin")
    const denyElevated: Override = {
      capId: "user.role.grant.elevated",
      scopePath: "/",
      effect: "deny",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: null,
      reason: "حجبٌ للاختبار",
    }
    const admin: Actor = { ...base, overrides: [denyElevated] }
    const r = provision(w.store, admin, CTX, {
      targetUnitId: "men",
      targetRoleId: "section_head",
      username: "sh2",
    })
    expect(!r.ok && r.error.detail).toBe("ش٥")
  })

  it("لا يوفّر دوراً موقوفاً (قب-٧)", () => {
    const w = seedWorld()
    const r = provision(w.store, w.actor("u-amir"), CTX, {
      targetUnitId: "khalid",
      targetRoleId: "secretary",
      username: "sec2",
    })
    expect(!r.ok && r.error.code).toBe("ROLE_SUSPENDED")
  })

  it("يرفض وحدة هدفٍ غير موجودة (الكيان يُشتقّ منه النطاق — لا مدخل عميل)", () => {
    const w = seedWorld()
    const r = provision(w.store, w.actor("u-amir"), CTX, {
      targetUnitId: "ghost",
      targetRoleId: "teacher",
      username: "x",
    })
    expect(!r.ok && r.error.code).toBe("ENTITY_NOT_FOUND")
  })

  it("يرفض اسم دخولٍ محجوزاً دون أن يترك أثراً", () => {
    const w = seedWorld()
    const before = w.store.assignments.length
    const r = provision(w.store, w.actor("u-amir"), CTX, {
      targetUnitId: "khalid",
      targetRoleId: "teacher",
      username: "u-amir",
    })
    expect(!r.ok && r.error.code).toBe("USERNAME_TAKEN")
    expect(w.store.assignments.length).toBe(before)
  })
})

describe("الذرّية: عطبٌ جزئيّ يُرجع كل شيء (ع-٣٣، ق-١٥)", () => {
  it("إن فشل تدوين التدقيق في منتصف الدفعة لم يبقَ حسابٌ ولا تكليف", () => {
    const w = seedWorld()
    const accountsBefore = w.store.accounts.size
    const assignmentsBefore = w.store.assignments.length
    // نحقن فشلاً في آخر خطوةٍ من الدفعة الذرّية.
    w.store.appendAudit = () => {
      throw new Error("عطبٌ مُحقَن أثناء الدفعة")
    }
    expect(() =>
      provision(w.store, w.actor("u-amir"), CTX, {
        targetUnitId: "khalid",
        targetRoleId: "teacher",
        username: "atomic",
      }),
    ).toThrow()
    expect(w.store.accounts.size).toBe(accountsBefore)
    expect(w.store.assignments.length).toBe(assignmentsBefore)
    expect(w.store.hasUsername("atomic")).toBe(false)
  })

  it("التوفير الناجح يترك قيدَ تدقيقٍ واحداً على الأقل", () => {
    const w = seedWorld()
    const before = w.store.audit.length
    provision(w.store, w.actor("u-amir"), CTX, {
      targetUnitId: "khalid",
      targetRoleId: "teacher",
      username: "audited",
    })
    expect(w.store.audit.length).toBeGreaterThan(before)
  })

  it("الحساب المُوفَّر يدخل بلقطته فوراً ويعمل بقدرات دوره", () => {
    const w = seedWorld()
    const r = provision(w.store, w.actor("u-square"), CTX, {
      targetUnitId: "bilal",
      targetRoleId: "amir",
      username: "fresh-amir",
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const fresh = buildActor(w.store, r.value.account.personId)
      expect(fresh.assignments.some((a) => a.roleId === "amir")).toBe(true)
    }
  })
})
