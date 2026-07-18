import { describe, it, expect } from "vitest";
import { ROLE_DEFAULTS, ROLE_LABEL, ALL_ROLES, effectiveCaps, hasCap, roleDefaultHas } from "@/lib/capabilities";
import { allowedNav, firstAllowed, canAccess } from "@/lib/access";
import { curriculumIsFinancial, curriculumLabel, CURRICULUM_OPTIONS } from "@/lib/curricula";

// ===== الأدوار والصلاحيات (سياسة RBAC — نقية، حاسمة أمنياً) =====
describe("RBAC policy — الأدوار", () => {
  it("الأدوار الخمسة معرّفة بمسمّياتها", () => {
    expect(ALL_ROLES).toEqual(expect.arrayContaining(["admin", "rabita", "square", "amir", "teacher"]));
    expect(ROLE_LABEL.teacher).toBe("مدرّس/محفّظ");
  });

  it("المدرّس يملك حلقاته ومكتبته ونشاطاته فقط — لا شبكة/مالية/تهيئة", () => {
    // §ت: المعلّم جمهورٌ للمكتبة · §ن: يُنشئ نشاطاتٍ لطلابه ويتابع ردودهم
    expect(ROLE_DEFAULTS.teacher).toEqual(["circle.teach", "library.view", "duties.view", "duties.manage"]);
    const caps = effectiveCaps(["teacher"]);
    expect(hasCap(caps, "circle.teach")).toBe(true);
    expect(hasCap(caps, "library.view")).toBe(true);
    expect(hasCap(caps, "duties.manage")).toBe(true);
    // §ن: الطالب المعتمَد يرى «المطلوب منّي» ومكتبته فقط
    expect(ROLE_DEFAULTS.student).toEqual(["duties.view", "library.view"]);
    expect(hasCap(effectiveCaps(["student"]), "duties.manage")).toBe(false);
    for (const denied of ["network.view", "finance.view", "admin.view", "report.approve", "mosqueFinance.view", "alaBaseera.viewAll"]) {
      expect(hasCap(caps, denied)).toBe(false);
    }
  });

  it("المدير العام (*) يملك كل شيء، والأمير لا يرى المالية المركزية (خصوصية)", () => {
    expect(hasCap(effectiveCaps(["admin"]), "circle.teach")).toBe(true);
    expect(hasCap(effectiveCaps(["admin"]), "anything.at.all")).toBe(true);
    expect(roleDefaultHas("amir", "finance.view")).toBe(false);
  });

  it("اتحاد القدرات لأدوارٍ متعددة + تطبيق التجاوزات (منح/حجب)", () => {
    const caps = effectiveCaps(["teacher", "amir"]);
    expect(hasCap(caps, "circle.teach")).toBe(true);
    expect(hasCap(caps, "tahfeez.manage")).toBe(true); // من الأمير
    const revoked = effectiveCaps(["teacher"], [{ role: "teacher", capability: "circle.teach", effect: "revoke" }]);
    expect(hasCap(revoked, "circle.teach")).toBe(false);
    const granted = effectiveCaps(["teacher"], [{ role: "teacher", capability: "report.view", effect: "grant" }]);
    expect(hasCap(granted, "report.view")).toBe(true);
  });
});

describe("RBAC policy — الملاحة والهبوط", () => {
  it("المدرّس يهبط على /my-circles وهو نطاقه الوحيد", () => {
    const nav = allowedNav(["circle.teach"]);
    expect(nav.map((n) => n.to)).toEqual(["/my-circles"]);
    expect(firstAllowed(["circle.teach"])).toBe("/my-circles");
    expect(canAccess("/my-circles", ["circle.teach"])).toBe(true);
    expect(canAccess("/network", ["circle.teach"])).toBe(false);
  });

  it("المدير لا يهبط على /my-circles (الشبكة أولاً) رغم امتلاكه «*»", () => {
    expect(firstAllowed(effectiveCaps(["admin"]))).toBe("/network");
  });

  it("ثابت التوجيه الكليّ: مَن بلا صلاحيات ⇒ /no-access (لا /login) ⇒ استحالةُ حلقةِ تحويل", () => {
    expect(firstAllowed([])).toBe("/no-access");
    expect(allowedNav([])).toEqual([]);
  });

  it("المشرف (مربع) لا يملك circle.teach", () => {
    expect(hasCap(effectiveCaps(["square"]), "circle.teach")).toBe(false);
  });
});

describe("المناهج — المالية لـ«على بصيرة» فقط (D3)", () => {
  it("baseera فقط ماليّة", () => {
    expect(curriculumIsFinancial("baseera")).toBe(true);
    for (const c of ["tahfeez", "rashidi", "general", "", null]) expect(curriculumIsFinancial(c)).toBe(false);
  });
  it("المسميات والخيارات", () => {
    expect(curriculumLabel("tahfeez")).toBe("تحفيظ قرآن");
    expect(curriculumLabel("rashidi")).toBe("منهج الرشيدي");
    expect(CURRICULUM_OPTIONS.map((o) => o.value)).toEqual(["baseera", "tahfeez", "rashidi", "general"]);
  });
});
