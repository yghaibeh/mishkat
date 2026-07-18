// ك٦ (الوثيقة ٢٩): حارسٌ بنيويّ — كلُّ دورٍ ونوعِ وحدةٍ له أيقونة، فلا تُنسى أيقونةُ عنصرٍ جديدٍ مستقبلًا.
import { describe, it, expect } from "vitest";
import { ROLE_LABEL, ORG_TYPE_LABEL } from "@/lib/capabilities";
import { ROLE_ICON, ORG_TYPE_ICON } from "@/lib/role-icons";

describe("لا فقدَ أيقونة (role-icons)", () => {
  it("كلُّ دورٍ في ROLE_LABEL له أيقونةٌ في ROLE_ICON", () => {
    const missing = Object.keys(ROLE_LABEL).filter((r) => !ROLE_ICON[r]);
    expect(missing, `أدوارٌ بلا أيقونة: ${missing.join(", ")}`).toEqual([]);
  });
  it("كلُّ نوعِ وحدةٍ في ORG_TYPE_LABEL له أيقونةٌ في ORG_TYPE_ICON", () => {
    const missing = Object.keys(ORG_TYPE_LABEL).filter((t) => !ORG_TYPE_ICON[t]);
    expect(missing, `أنواعٌ بلا أيقونة: ${missing.join(", ")}`).toEqual([]);
  });
  it("لا أيقوناتٍ زائدةٍ لمفاتيحَ غير موجودة (نظافة)", () => {
    expect(Object.keys(ROLE_ICON).filter((r) => !ROLE_LABEL[r])).toEqual([]);
    expect(Object.keys(ORG_TYPE_ICON).filter((t) => !ORG_TYPE_LABEL[t])).toEqual([]);
  });
});
