import { describe, it, expect } from "vitest";
import { isWithin, selfAndAncestorIds, ancestorIds, descendantPattern, buildChildPath } from "@/server/utils/orgPath";
import { isGlobalAdmin, canAccessPath } from "@/server/utils/context";
import type { AuthUser } from "@/server/utils/context";

const user = (assignments: AuthUser["assignments"]): AuthUser => ({ userId: "u", personId: "p", fullName: "x", assignments });

// عزل النطاق عبر المسار المادّي (Materialized Path) — أساس كل الصلاحيات الهرمية
describe("عزل النطاق: isWithin + canAccessPath", () => {
  it("isWithin يحترم حدود المسار (لا تطابق جزئي خاطئ)", () => {
    expect(isWithin("/idlib/sq-1/m-nour/", "/idlib/")).toBe(true);
    expect(isWithin("/idlib/sq-1/m-nour/", "/idlib/sq-1/")).toBe(true);
    expect(isWithin("/idlib/sq-1/m-nour/", "/idlib/sq-2/")).toBe(false);
    expect(isWithin("/idlib/", "/idlib/sq-1/")).toBe(false); // الأب ليس ضمن الابن
  });

  it("مسؤول المربع يصل لمساجد مربعه فقط", () => {
    const sq = user([{ role: "square", orgUnitId: "sq-1", orgPath: "/idlib/sq-1/", portfolio: null }]);
    expect(canAccessPath(sq, "/idlib/sq-1/m-nour/")).toBe(true);
    expect(canAccessPath(sq, "/idlib/sq-2/m-bilal/")).toBe(false);
    expect(canAccessPath(sq, "/idlib/")).toBe(false);
  });

  it("المدير العام يصل لكل شيء", () => {
    const admin = user([{ role: "admin", orgUnitId: "root", orgPath: "/", portfolio: null }]);
    expect(isGlobalAdmin(admin)).toBe(true);
    expect(canAccessPath(admin, "/sahel/sq-tartus/m-khaled/")).toBe(true);
  });

  it("المدرّس ليس له نطاقٌ هرمي (نطاقه بالملكية لا بالمسار)", () => {
    const teacher = user([{ role: "teacher", orgUnitId: "sq-1", orgPath: "/idlib/sq-1/", portfolio: null }]);
    // يصل لمسار مربعه عبر canAccessPath (تكليفه هناك) لكنه لا يدير المساجد — الإدارة بالملكية في halaqaInScope
    expect(canAccessPath(teacher, "/idlib/sq-2/m-bilal/")).toBe(false);
  });
});

describe("مساعدات المسار", () => {
  it("ancestors + descendant pattern + child path", () => {
    expect(selfAndAncestorIds("/idlib/sq-1/m-nour/")).toEqual(["idlib", "sq-1", "m-nour"]);
    expect(ancestorIds("/idlib/sq-1/m-nour/")).toEqual(["idlib", "sq-1"]);
    expect(descendantPattern("/idlib/")).toBe("/idlib/%");
    expect(buildChildPath("/idlib/", "sq-9")).toBe("/idlib/sq-9/");
  });
});
