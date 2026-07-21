/**
 * سلّم الشجرة — قواعدُ الأنواع ووراثة القسم (SPEC_org_and_accounts §١.٢/§١.٥).
 */
import { describe, it, expect } from "vitest"
import {
  isLegalChildType,
  isDisabledUnitType,
  isSuspendedRole,
  sectionOfSegment,
} from "../../../src/features/org/data/hierarchy.js"

describe("قواعد السلّم", () => {
  it("الابن الشرعي فقط يُقبل في السلّم", () => {
    expect(isLegalChildType("region", "square")).toBe(true)
    expect(isLegalChildType("region", "mosque")).toBe(false)
    expect(isLegalChildType("circle", "mosque")).toBe(false)
  })

  it("نوع الكتلة معطَّل بمفتاح تفعيل", () => {
    expect(isDisabledUnitType("bloc")).toBe(true)
    expect(isDisabledUnitType("region")).toBe(false)
  })

  it("القسمان يُثبِّتان القسم في مقطعهما، وما عداهما بلا قسم", () => {
    expect(sectionOfSegment("men")).toBe("men")
    expect(sectionOfSegment("women")).toBe("women")
    expect(sectionOfSegment("homs")).toBeNull()
  })

  it("الأدوار الموقوفة تُعرَف بحالتها", () => {
    expect(isSuspendedRole("secretary")).toBe(true)
    expect(isSuspendedRole("amir")).toBe(false)
  })
})
