/**
 * الشاشات (نماذج العرض) — SPEC_org_and_accounts §٥. الواجهة تعرض ولا تقرر (المادة ٤/٦).
 */
import { describe, it, expect } from "vitest"
import { seedWorld } from "./_seed.js"
import {
  orgTreeScreen,
  createAccountScreen,
  assignmentsScreen,
} from "../../../src/features/org/screens/screens.js"
import type { CapId } from "../../../src/authorization/generated/capabilities.generated.js"

const caps = (list: readonly CapId[]) => new Set<CapId>(list)

describe("شاشة الشجرة", () => {
  it("تعرض عناصر الإدارة لمن يملك orgUnit.manage، وتَسِمُ الطبقة الموقوفة", () => {
    const { store } = seedWorld()
    const v = orgTreeScreen(caps(["network.view", "orgUnit.manage"]), [...store.units.values()])
    expect(v.kind).toBe("granted")
    if (v.kind === "granted") {
      expect(v.actions.createUnit).toBe(true)
      expect(v.actions.archiveUnit).toBe(true)
      expect(v.disabledLayersAr.some((s) => s.includes("bloc"))).toBe(true)
      expect(v.nodes.length).toBeGreaterThan(0)
    }
  })

  it("تهبط على حالةٍ فارغةٍ مُشخِّصة لمن لا يملك عرضاً — لا شاشة بيضاء", () => {
    const v = orgTreeScreen(caps([]), [])
    expect(v.kind).toBe("denied")
    if (v.kind === "denied") expect(v.reasonAr.length).toBeGreaterThan(10)
  })
})

describe("شاشة إنشاء الحساب", () => {
  it("تعرض منتقيَ الأدوار الجائزة بتسمياتها العربية لمن يملك التمكين", () => {
    const v = createAccountScreen(caps(["users.provision"]), ["teacher", "committee_head"])
    expect(v.kind).toBe("granted")
    if (v.kind === "granted") {
      expect(v.roleOptions.map((o) => o.id)).toEqual(["teacher", "committee_head"])
      expect(v.roleOptions[0]!.labelAr.length).toBeGreaterThan(0)
    }
  })

  it("تُمنع كاملةً عمّن لا يملك users.provision", () => {
    expect(createAccountScreen(caps([]), []).kind).toBe("denied")
  })
})

describe("شاشة قائمة الإسنادات", () => {
  it("تعرض زر إنهاء التكليف لمن يملك user.manage فقط", () => {
    const { store } = seedWorld()
    const withManage = assignmentsScreen(caps(["network.view", "user.manage"]), store.assignments)
    const viewOnly = assignmentsScreen(caps(["network.view"]), store.assignments)
    expect(withManage.kind === "granted" && withManage.actions.endAssignment).toBe(true)
    expect(viewOnly.kind === "granted" && viewOnly.actions.endAssignment).toBe(false)
    if (withManage.kind === "granted") expect(withManage.rows.length).toBeGreaterThan(0)
  })

  it("تُمنع عمّن لا يملك عرضاً", () => {
    expect(assignmentsScreen(caps([]), []).kind).toBe("denied")
  })
})
