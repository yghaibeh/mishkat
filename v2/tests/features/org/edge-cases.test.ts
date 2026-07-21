/**
 * حالات الحواف الهرمية — SPEC_org_and_accounts §٧ (تُكتب يدوياً، الطبقة الثالثة).
 */
import { describe, it, expect } from "vitest"
import { seedWorld, NOW } from "./_seed.js"
import { endAssignment } from "../../../src/features/org/services/assignments.js"
import { provision } from "../../../src/features/org/services/provisioning.js"
import { setStatus } from "../../../src/features/org/services/accounts.js"
import { buildActor } from "../../../src/features/org/services/session.js"
import { can } from "../../../src/authorization/can.js"
import { unitScope, selfScope } from "../../../src/authorization/scope.js"

const CTX = { now: NOW, intent: "read" as const, isFeatureEnabled: () => true }
const WRITE = { now: NOW, intent: "write" as const, isFeatureEnabled: () => true }

describe("١) انتقال شخص بين وحدتين — قدرات النطاق القديم تسقط فوراً (ق-٢٤)", () => {
  it("أميرٌ أُنهي تكليفُه على مسجده ثم وُفّر أميراً على مسجدٍ آخر لا يحمل قدرات الأول", () => {
    const w = seedWorld()
    const old = w.store.assignmentsForPerson("u-amir")[0]!
    endAssignment(w.store, WRITE, old.id)
    provision(w.store, w.actor("u-square"), WRITE, {
      targetUnitId: "bilal",
      targetRoleId: "amir",
      username: "moved",
    })
    // الأمير الأصلي (u-amir) فقد مسجده كلياً:
    const moved = buildActor(w.store, "u-amir")
    expect(can(moved, "circle.manage", unitScope("/men/homs/sq2/khalid/"), CTX).allowed).toBe(false)
  })
})

describe("٢) ذو دورين بنطاقين — اتحادٌ بلا تسريب بين النطاقين", () => {
  it("أمير مسجد A ومحفّظ حلقة في مسجد B لا يحمل الإمارة في B", () => {
    const w = seedWorld()
    const dual = buildActor(w.store, "u-dual")
    // أمير على خالد:
    expect(can(dual, "circle.manage", unitScope("/men/homs/sq2/khalid/"), CTX).allowed).toBe(true)
    // لكنه لا يملك الإمارة على مسجد عمر (حيث هو محفّظٌ فقط):
    expect(can(dual, "circle.manage", unitScope("/men/homs/sq7/omar/"), CTX).allowed).toBe(false)
    // وملكيتُه للتدريس على حلقته في عمر قائمة:
    expect(can(dual, "circle.teach", selfScope("u-dual", "circles", "c2"), CTX).allowed).toBe(true)
  })
})

describe("٣–٤) تصعيدٌ ونطاقٌ أجنبيّ — مرفوضان (مرآةُ برهان §١.٦)", () => {
  it("توفيرُ دورٍ أعلى مرفوض (ش٢) وتوفيرٌ خارج النطاق مرفوض (ش٤)", () => {
    const w = seedWorld()
    const up = provision(w.store, w.actor("u-amir"), WRITE, {
      targetUnitId: "khalid",
      targetRoleId: "square",
      username: "u1",
    })
    expect(!up.ok && up.error.detail).toBe("ش٢")
    const out = provision(w.store, w.actor("u-amir"), WRITE, {
      targetUnitId: "bilal",
      targetRoleId: "teacher",
      username: "u2",
    })
    expect(!out.ok && out.error.detail).toBe("ش٤")
  })
})

describe("٥) الحساب الموقوف يُمنع الدخول (خطوة ١)", () => {
  it("تجميد الحساب يُسقط كل قدراته برسالة موقوف", () => {
    const w = seedWorld()
    setStatus(w.store, "u-amir", "suspended")
    const suspended = buildActor(w.store, "u-amir")
    const d = can(suspended, "circle.manage", unitScope("/men/homs/sq2/khalid/"), CTX)
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_ACCOUNT_SUSPENDED")
  })
})

describe("٦) الدور الموقوف لا يُسنَد", () => {
  it("توفيرُ دورٍ موقوفٍ مرفوض", () => {
    const w = seedWorld()
    const r = provision(w.store, w.actor("u-amir"), WRITE, {
      targetUnitId: "khalid",
      targetRoleId: "deputy",
      username: "dep",
    })
    expect(!r.ok && r.error.code).toBe("ROLE_SUSPENDED")
  })
})

describe("٧) ثابت «المدير لا يُكلَّف» — لا قناة توفيرٍ تُنتج له تكليفاً تشغيلياً", () => {
  it("لا يستطيع أحدٌ توفير دور «admin» على أي وحدة (المصفوفة تحكم)", () => {
    const w = seedWorld()
    // الأدمن أعلى الرتب (٠): لا موفِّرَ رتبتُه أدنى منه ⇒ ش٢ يمنع دائماً.
    const r = provision(w.store, w.actor("u-admin"), WRITE, {
      targetUnitId: "root",
      targetRoleId: "admin",
      username: "admin2",
    })
    expect(r.ok).toBe(false)
  })
})
