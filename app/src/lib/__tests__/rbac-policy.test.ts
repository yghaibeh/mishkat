import { describe, it, expect } from "vitest";
import { ROLE_DEFAULTS, ROLE_LABEL, ALL_ROLES, ALL_CAPS, PERSONAL_CAPS, effectiveCaps, hasCap, roleDefaultHas } from "@/lib/capabilities";
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
    expect(hasCap(effectiveCaps(["admin"]), "anything.at.all")).toBe(true);
    expect(roleDefaultHas("amir", "finance.view")).toBe(false);
  });

  // حارسٌ بنيويّ دائم (قاعدة المالك الواحد ٣٤ + بلاغ المالك ٢٠٢٦-٠٧-١٨ «هل المدير يضيف تغطية؟»):
  // «*» شمولُ اطّلاعٍ لا شمولُ عمل. كلُّ قدرةٍ في PERSONAL_CAPS يقوم بها صاحبُها وحدَه، ويُمنع
  // منها المديرُ رغم «*». أيُّ قدرةِ عملٍ شخصيّةٍ جديدةٍ تُضاف للقائمة فيسري الحارسُ عليها.
  it("القدراتُ الشخصيّة: «*» لا يمنح عملًا شخصيًّا — المديرُ يطَّلع ولا يعمل مكان أصحاب الأدوار", () => {
    const adminCaps = effectiveCaps(["admin"]);
    for (const cap of PERSONAL_CAPS) {
      expect(hasCap(adminCaps, cap)).toBe(false);
      expect(roleDefaultHas("admin", cap)).toBe(false);
    }
    // ولكلِّ قدرةٍ شخصيّةٍ دورٌ واحدٌ على الأقلّ يحملها نصًّا (وإلّا فهي قدرةٌ ميتةٌ لا يقوم بها أحد)
    for (const cap of PERSONAL_CAPS) {
      expect(ALL_ROLES.some((r) => (ROLE_DEFAULTS[r] ?? []).includes(cap))).toBe(true);
    }
    expect(hasCap(effectiveCaps(["media"]), "media.post")).toBe(true);
    expect(hasCap(effectiveCaps(["teacher"]), "circle.teach")).toBe(true);
    // ويبقى المنحُ الصريحُ بالتجاوزات ممكنًا (شغورٌ أو تكليفٌ استثنائيّ) — منعٌ للشمول لا للمنح
    expect(hasCap(effectiveCaps(["amir"], [{ role: "amir", capability: "media.post", effect: "grant" }]), "media.post")).toBe(true);
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

// ===== حارسُ «لكلّ قدرةٍ باب» (بلاغ الميدان ٢٠٢٦-٠٧-١٨) =====
// مسؤولُ منطقةٍ حقيقيٌّ لم يستطع إضافةَ مسجد: الخادمُ يمنحه orgUnit.manage ويعزله بنطاقه،
// لكنّ البابَ الوحيدَ لتلك القدرة (/admin) كان مقفولاً بـ admin.view — قدرةٌ ميّتةٌ في يده.
// المعجمُ أدناه يُعلن لكلّ قدرةٍ **من أيّ تبويبٍ تُمارَس**، والحارسُ يتحقّق أنّ كلّ دورٍ يجد
// باباً لكلّ قدرةٍ يحملها. أيُّ قدرةٍ جديدةٍ بلا بابٍ مُعلَنٍ تُفشل البناء (بروتوكول ٣٧).
const CAP_DOORS: Record<string, string[]> = {
  "network.view": ["/network"],
  "report.view": ["/network", "/home"],
  "report.approve": ["/network", "/home"],
  "report.approve.override": ["/network"],
  "dailyLog.view": ["/network", "/home"],
  "dailyLog.edit": ["/home"],                    // الأميرُ من صفحة مسجده (رئيسيّته تصلها)
  "finance.view": ["/finance"],
  "box.view": ["/finance"],
  "finance.entry": ["/finance"],
  "finance.approve": ["/finance"],
  "finance.payout": ["/finance"],
  "finance.supervise": ["/finance"],
  "mosqueFinance.view": ["/home", "/network"],
  "mosqueFinance.manage": ["/home"],
  "circles.view": ["/home", "/network"],
  "circles.manage": ["/home"],
  "alaBaseera.viewAll": ["/ala-baseera"],
  "alaBaseera.view": ["/home", "/ala-baseera"],
  "alaBaseera.manage": ["/home", "/ala-baseera"],
  "tahfeez.view": ["/home", "/network"],
  "tahfeez.manage": ["/home"],
  "meetings.view": ["/home", "/network"],
  "meetings.manage": ["/home"],
  "committees.view": ["/home", "/network"],
  "committees.manage": ["/home"],
  "committee.own": ["/my-committee"],
  "circle.teach": ["/my-circles"],
  "competition.view": ["/competition"],
  "competition.manage": ["/competition"],
  "media.hub": ["/media-hub"],
  "media.post": ["/media-hub"],
  "library.view": ["/library"],
  "library.manage": ["/library"],
  "duties.view": ["/home"],
  "duties.manage": ["/home"],
  "admin.view": ["/admin"],
  "user.manage": ["/admin"],
  "orgUnit.manage": ["/admin"],
  "permissions.manage": ["/admin"],
  "settings.view": ["/admin"],
  "settings.manage": ["/admin"],
  "audit.view": ["/admin"],
};

describe("ثابتُ «لكلّ قدرةٍ باب» — لا قدرةَ في يدِ دورٍ بلا شاشةٍ يمارسها منها", () => {
  it("كلُّ قدرةٍ في المعجم لها بابٌ مُعلَن (قدرةٌ جديدةٌ بلا بابٍ تُفشل البناء)", () => {
    for (const cap of ALL_CAPS) expect(CAP_DOORS[cap], `القدرة ${cap} بلا بابٍ مُعلَن`).toBeTruthy();
  });

  it("كلُّ دورٍ يجد باباً لكلّ قدرةٍ يحملها — الحارسُ الذي كان سيمنع عجزَ مسؤول المنطقة", () => {
    for (const role of ALL_ROLES) {
      const caps = effectiveCaps([role]);
      if (caps.includes("*")) continue; // المديرُ يفتح كلَّ الأبواب
      const nav = allowedNav(caps).map((n) => n.to);
      for (const cap of caps) {
        const doors = CAP_DOORS[cap] ?? [];
        expect(doors.some((d) => nav.includes(d)),
          `الدور «${role}» يملك ${cap} ولا يجد باباً (${doors.join("، ") || "بلا باب"}) — تبويباته: ${nav.join("، ")}`).toBe(true);
      }
    }
  });

  it("مسؤولُ المنطقة يصل «الإدارة» فيضيف مسجداً، ويرى «الإعلام» ضمن نطاقه (بلاغ الميدان)", () => {
    const rabita = effectiveCaps(["rabita"]);
    expect(canAccess("/admin", rabita)).toBe(true);
    expect(canAccess("/media-hub", rabita)).toBe(true);
    expect(hasCap(rabita, "orgUnit.manage")).toBe(true);
    // ورأسُ القسم كذلك؛ والمربّعُ لا إدارةَ له (لا يملك القدرة أصلاً) فلا بابَ زائفاً
    expect(canAccess("/admin", effectiveCaps(["section_head"]))).toBe(true);
    expect(canAccess("/admin", effectiveCaps(["square"]))).toBe(false);
    // ولا يمنح البابُ نشراً: الاطّلاع لا العمل
    expect(hasCap(rabita, "media.post")).toBe(false);
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

  it("كل الأدوار تهبط على «الرئيسية» أولاً (الوثيقة ٣٦ §١) — والمدير لا يهبط على /my-circles رغم «*»", () => {
    expect(firstAllowed(effectiveCaps(["admin"]))).toBe("/home");
    expect(firstAllowed(effectiveCaps(["amir"]))).toBe("/home");
    expect(firstAllowed(effectiveCaps(["square"]))).toBe("/home");
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

describe("التبويبات الشخصية (قاعدة المرآة ٣٤)", () => {
  it("«حلقاتي» و«لجنتي» لا يمنحهما الشمول «*» — للمعلم ومسؤول اللجنة نصاً", async () => {
    const { allowedNav, canAccess } = await import("@/lib/access");
    const adminNav = allowedNav(["*"]).map((n) => n.to);
    expect(adminNav).not.toContain("/my-circles");
    expect(adminNav).not.toContain("/my-committee");
    expect(canAccess("/my-circles", ["*"])).toBe(false);
    expect(allowedNav(["circle.teach", "duties.view"]).map((n) => n.to)).toContain("/my-circles");
    expect(canAccess("/my-committee", ["committee.own"])).toBe(true);
  });
});

describe("ترتيب الشريط بأهمية الدور (قرار المالك)", () => {
  it("المدير: الإدارة بعد الرئيسية مباشرة؛ المعلم: حلقاتي؛ المالي: الصندوق", async () => {
    const { orderedNav } = await import("@/lib/access");
    const adminOrder = orderedNav(["*"], ["admin"]).map((n) => n.to);
    expect(adminOrder[0]).toBe("/home");
    expect(adminOrder[1]).toBe("/admin");
    const teacherOrder = orderedNav(["duties.view", "library.view", "circle.teach"], ["teacher"]).map((n) => n.to);
    expect(teacherOrder[1]).toBe("/my-circles");
    const finOrder = orderedNav(["finance.view", "box.view", "duties.view", "library.view"], ["finance_officer"]).map((n) => n.to);
    expect(finOrder[1]).toBe("/finance");
  });
});
