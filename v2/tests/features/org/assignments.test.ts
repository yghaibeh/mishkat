/**
 * الإسناد — SPEC_org_and_accounts §٣ (ق-٢٤ انتهاء التكليف يقطع فوراً).
 */
import { describe, it, expect } from "vitest"
import { seedWorld, NOW } from "./_seed.js"
import { endAssignment } from "../../../src/features/org/services/assignments.js"
import { buildActor } from "../../../src/features/org/services/session.js"
import { can } from "../../../src/authorization/can.js"
import { unitScope } from "../../../src/authorization/scope.js"

const CTX = { now: NOW, intent: "read" as const, isFeatureEnabled: () => true }

describe("إنهاء التكليف يقطع القدرات فوراً (ق-٢٤)", () => {
  it("قبل الإنهاء يملك الأمير قدرة مسجده، وبعده تسقط في الطلب التالي", () => {
    const { store } = seedWorld()
    const amirBefore = buildActor(store, "u-amir")
    expect(can(amirBefore, "circle.manage", unitScope("/men/homs/sq2/khalid/"), CTX).allowed).toBe(true)

    const own = store.assignmentsForPerson("u-amir")[0]!
    const r = endAssignment(store, CTX, own.id)
    expect(r.ok).toBe(true)

    const amirAfter = buildActor(store, "u-amir")
    const d = can(amirAfter, "circle.manage", unitScope("/men/homs/sq2/khalid/"), CTX)
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe("DENIED_NO_ACTIVE_ASSIGNMENT")
  })

  it("الإنهاء يرفع حِقبة الشخص المتأثِّر", () => {
    const { store } = seedWorld()
    const before = store.getAccount("u-amir")!.sessionEpoch
    const own = store.assignmentsForPerson("u-amir")[0]!
    endAssignment(store, CTX, own.id)
    expect(store.getAccount("u-amir")!.sessionEpoch).toBeGreaterThan(before)
  })

  it("يرفض إنهاء إسنادٍ غير موجود", () => {
    const { store } = seedWorld()
    expect(endAssignment(store, CTX, "ghost").ok).toBe(false)
  })
})

describe("بناء لقطة الفاعل من المستودع (§٤.٥)", () => {
  it("يجمع إسنادات الشخص وحالته وحِقبته الحيّة", () => {
    const { store } = seedWorld()
    const a = buildActor(store, "u-dual")
    expect(a.assignments.length).toBe(2)
    expect(a.accountStatus).toBe("active")
  })

  it("يعلّم الإسناد بأن وحدته مؤرشفة عبر السلَف", () => {
    const { store } = seedWorld()
    const khalid = store.getUnit("khalid")!
    store.saveUnit({ ...khalid, archived: true })
    const a = buildActor(store, "u-amir")
    expect(a.assignments[0]!.unitArchived).toBe(true)
  })

  it("يرمي على شخصٍ غير موجود", () => {
    const { store } = seedWorld()
    expect(() => buildActor(store, "ghost")).toThrow()
  })
})
