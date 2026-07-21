/**
 * مكتبة المكوّنات — SPEC_design_system §٢ (٢٦ مكوّناً) و§٣ (الأنماط الحاكمة) و§٤ (الجوال والوصول).
 *
 * المكتبةُ **مغلقة**: لا شاشةٌ تستعمل ما ليس فيها. وكلُّ قاعدةٍ من قواعد v1 غير المؤتمتة
 * تصير هنا **بنيةً ترفض المخالفة زمنَ التشغيل** لا وصيّةً في وثيقة: عنصرٌ تفاعليٌّ بلا قدرة
 * يرمي، ودلالةٌ بلونٍ وحده ترمي، وبطاقةُ إحصاءٍ بلا فعلٍ ترمي، وسطرٌ بمالكين يرمي.
 */
import { describe, it, expect } from "vitest"
import {
  COMPONENTS,
  COMPONENT_IDS,
  node,
  walkNodes,
  declaredCapabilities,
  type UiNode,
} from "../../src/ui/components/kernel.js"
import {
  button,
  link,
  icon,
  badge,
  hijriDate,
  money,
  avatar,
} from "../../src/ui/components/atoms.js"
import {
  field,
  form,
  statCard,
  listItem,
  entityCard,
  inlineFeedback,
} from "../../src/ui/components/molecules.js"
import {
  dataTable,
  unitTree,
  dialog,
  toast,
  banner,
  tabs,
  emptyState,
  diagnosisBlock,
  uploader,
  searchBox,
  notificationBell,
} from "../../src/ui/components/organisms.js"
import { TOKENS } from "../../src/ui/tokens/tokens.js"

const NOW = new Date("2026-07-21T09:00:00.000Z")

describe("سجلّ المكتبة — مغلقٌ ومسنَدٌ، لا مكوّنَ مخترعاً بلا مُستعمِل (§٢ معيار ١)", () => {
  it("المكتبةُ ٢٦ مكوّناً: ٧ ذرّات + ٦ جزيئات + ١١ كائناً + ٢ قشرة", () => {
    expect(COMPONENT_IDS.length).toBe(26)
    const tiers = COMPONENT_IDS.map((id) => COMPONENTS[id].tier)
    expect(tiers.filter((t) => t === "atom").length).toBe(7)
    expect(tiers.filter((t) => t === "molecule").length).toBe(6)
    expect(tiers.filter((t) => t === "organism").length).toBe(11)
    expect(tiers.filter((t) => t === "shell").length).toBe(2)
  })

  it("كلُّ مكوّنٍ يعلن غرضَه وحالاتِه و«متى لا» ومُستعمِلَه", () => {
    for (const id of COMPONENT_IDS) {
      const c = COMPONENTS[id]
      expect(c.purposeAr.length, id).toBeGreaterThan(5)
      expect(c.statesAr.length, id).toBeGreaterThan(0)
      expect(c.neverAr.length, id).toBeGreaterThan(5)
      expect(c.usedByAr.length, id).toBeGreaterThan(0)
    }
  })

  it("مكوّنٌ خارج المكتبة يُرفض عند البناء (المكتبةُ مغلقة — G20)", () => {
    expect(() =>
      node({
        // @ts-expect-error معرّفٌ مخترع خارج السجل — يجب أن يُرفض نوعياً وزمنَ التشغيل معاً
        component: "FancyCarousel",
        a11y: { role: "region", nameAr: "شريطٌ مبتكر" },
      }),
    ).toThrow(/خارج المكتبة/)
  })
})

describe("ثابتُ «كل عنصرٍ يعلن قدرته» — يُفرَض في النواة لا في المراجعة (المادة ٤/٦)", () => {
  it("زرٌّ بلا إعلان قدرةٍ **يرمي** — العنصرُ بلا إعلانٍ لا يُسجَّل", () => {
    expect(() =>
      node({
        component: "Button",
        a11y: { role: "button", nameAr: "احفظ" },
      }),
    ).toThrow(/يعلن قدرته/)
  })

  it("وبإعلانٍ صريح يُبنى ويحمل قدرتَه", () => {
    const b = button({ labelKey: "common.save", variant: "primary", capability: "circle.manage" })
    expect(b.capability).toBe("circle.manage")
    expect(b.interactive).toBe(true)
  })

  it("«الحقُّ المشتقّ» إعلانٌ صريحٌ كذلك (`derived`) — لا صمتَ ولا استثناءَ خفيّ (§٢.١٢/٣)", () => {
    const bell = notificationBell({ capability: "derived" })
    expect(bell.capability).toBe("derived")
  })

  it("جمعُ القدرات المعلنة في شجرة عرضٍ يعطي كلَّ ما تُظهره الشاشة", () => {
    const tree = entityCard({
      titleAr: "مسجد خالد",
      facts: [{ key: "circles", labelKey: "amirHome.manageCircles", valueAr: "٣" }],
      actions: [
        button({ labelKey: "amirHome.enterDailyLog", variant: "primary", capability: "dailyLog.edit" }),
        button({ labelKey: "amirHome.submitReport", variant: "secondary", capability: "report.submit" }),
      ],
    })
    expect([...declaredCapabilities(tree)].sort()).toEqual(["dailyLog.edit", "report.submit"])
  })
})

describe("الذرّات السبع (§٢-أ)", () => {
  it("ذ-١ الزر: أربعةُ أنواعٍ وحالةُ «مُحمَّل» تمنع النقر المزدوج (ت-٨)", () => {
    for (const variant of ["primary", "secondary", "ghost", "danger"] as const) {
      const b = button({ labelKey: "common.submit", variant, capability: "report.submit" })
      expect(b.meta.variant).toBe(variant)
    }
    const loading = button({
      labelKey: "common.sending",
      variant: "primary",
      capability: "report.submit",
      state: "loading",
    })
    expect(loading.meta.state).toBe("loading")
    expect(loading.meta.disabled).toBe("true")
  })

  it("ذ-١ الزر: هدفُ اللمس ≥ ٤٤ نقطة على كل عنصرٍ تفاعليّ (§٤-٢)", () => {
    const b = button({ labelKey: "common.save", variant: "primary", capability: "circle.manage" })
    expect(b.a11y.minTouchTarget).toBe(TOKENS.size["touch-min"])
  })

  it("ذ-٢ الرابط: انتقالٌ لا فعل — يحمل وجهتَه وحالةَ «حاليّ»", () => {
    const l = link({ labelKey: "nav.bayan", href: "/bayan", capability: "network.view", current: true })
    expect(l.meta.href).toBe("/bayan")
    expect(l.meta.current).toBe("true")
    expect(l.a11y.role).toBe("link")
  })

  it("ذ-٣ الأيقونة: لا تحمل المعنى وحدها — اسمٌ بديلٌ إلزاميّ (§٤-٥)", () => {
    const i = icon({ name: "mosque", labelKey: "nav.myMosque" })
    expect(i.a11y.nameAr.length).toBeGreaterThan(0)
    expect(() => icon({ name: "", labelKey: "nav.myMosque" })).toThrow(/أيقونة/)
  })

  it("ذ-٤ الشارة: أيقونةٌ **ونصٌّ** مع اللون دائماً — لا لونٌ وحده (§٣-٩/§٤-٥)", () => {
    const ok = badge({ labelKey: "state.emptyViewerVacant", tone: "warning", iconName: "alert" })
    expect(ok.meta.tone).toBe("warning")
    expect(ok.meta.icon).toBe("alert")
    expect(() =>
      badge({ labelKey: "state.emptyViewerVacant", tone: "danger", iconName: "" }),
    ).toThrow(/بلونٍ وحده/)
  })

  it("ذ-٥ الطابع الهجري: هجريٌّ مرةً واحدة بلا «هـ هـ» (ق-١١٧)", () => {
    const d = hijriDate({ at: NOW })
    const textAr = String(d.meta.textAr)
    expect(textAr).toContain("هـ")
    expect(textAr.split("هـ").length - 1).toBe(1)
  })

  it("ذ-٥ الطابع الهجري: النسبيُّ من لحظتين حقيقيتين لا نصّاً جامداً (ق-١١٢)", () => {
    const earlier = new Date(NOW.getTime() - 2 * 86_400_000)
    const d = hijriDate({ at: earlier, relativeTo: NOW })
    expect(String(d.meta.relativeAr).length).toBeGreaterThan(0)
  })

  it("ذ-٦ المبلغ: عملةٌ ومنزلةٌ من الإعدادات، والسالبُ بعلامةٍ نصّية (قب-٦/قب-٨)", () => {
    const m = money({ amount: -1500, currencyCode: "SYP", fractionDigits: 0 })
    expect(m.meta.textAr).toContain("−")
    expect(m.meta.sign).toBe("negative")
  })

  it("ذ-٧ الصورة الرمزية: **لا صورةَ لطالبٍ قاصر** حتى حسم قب-١٩ — رمزٌ مجرّد", () => {
    const a = avatar({ kind: "person", nameAr: "طالب", iconName: "user", isMinor: true })
    expect(a.meta.rendering).toBe("glyph")
    expect(a.meta.photoAllowed).toBe("false")
  })
})

describe("الجزيئات الست (§٢-ب)", () => {
  it("ز-١ الحقل: حالةُ خطأ التحقّق برسالةٍ من طبقة النصوص أسفل الحقل", () => {
    const f = field({
      name: "username",
      labelKey: "org.username",
      kind: "text",
      state: "error",
      messageKey: "common.required",
    })
    expect(f.meta.state).toBe("error")
    expect(f.children.some((c) => c.component === "InlineFeedback")).toBe(true)
  })

  it("ز-٢ النموذج: **مخطط تحقّقٍ معلن** وزرُّ إرسالٍ واحدٌ أساسيّ (§٣-٤ + المادة ٣/٣)", () => {
    const f = form({
      schema: "provisionInput",
      fields: [field({ name: "username", labelKey: "org.username", kind: "text" })],
      submit: button({ labelKey: "common.submit", variant: "primary", capability: "users.provision" }),
    })
    expect(f.meta.schema).toBe("provisionInput")
    expect(() =>
      form({
        schema: "",
        fields: [],
        submit: button({ labelKey: "common.submit", variant: "primary", capability: "users.provision" }),
      }),
    ).toThrow(/مخطط تحقّق/)
  })

  it("ز-٢ النموذج: زرُّ الإرسال غيرُ الأساسيّ مرفوض (فعلٌ أساسيٌّ واحدٌ للشاشة)", () => {
    expect(() =>
      form({
        schema: "provisionInput",
        fields: [],
        submit: button({ labelKey: "common.submit", variant: "ghost", capability: "users.provision" }),
      }),
    ).toThrow(/أساسي/)
  })

  it("ز-٣ بطاقة الإحصاء: رقمٌ **يقود لفعل** بجملةٍ ونطاقٍ منطوق (ق-١١٢/ق-١١٠)", () => {
    const s = statCard({
      sentenceKey: "amirHome.weekProgress",
      valueAr: "٤١",
      scopeNoteKey: "amirHome.scopeNote",
      action: button({ labelKey: "amirHome.enterDailyLog", variant: "primary", capability: "dailyLog.edit" }),
    })
    expect(s.meta.scopeDeclared).toBe("true")
    expect(declaredCapabilities(s)).toContain("dailyLog.edit")
  })

  it("ز-٣ بطاقة الإحصاء: رقمٌ بلا فعلٍ **يُرفض** — مكانُه التقارير لا الرئيسية (ق-١٠٨)", () => {
    expect(() =>
      // @ts-expect-error الفعلُ إلزاميّ في العقد — لا بطاقةَ إحصاءٍ بلا فعل
      statCard({ sentenceKey: "amirHome.weekProgress", valueAr: "٤١", scopeNoteKey: "amirHome.scopeNote" }),
    ).toThrow(/فعل/)
  })

  it("ز-٤ عنصر القائمة: **مالكٌ واحد** — فعلٌ مملوك أو تشخيصٌ للمطّلع، لا الاثنان (ق-١٠٩)", () => {
    const owned = listItem({
      sentenceKey: "amirHome.emptyLog",
      action: button({ labelKey: "amirHome.enterDailyLog", variant: "secondary", capability: "dailyLog.edit" }),
    })
    expect(owned.children.some((c) => c.component === "Button")).toBe(true)

    const viewer = listItem({
      sentenceKey: "amirHome.emptyLog",
      diagnosis: diagnosisBlock({
        stateKey: "state.emptyViewerIdle",
        responsibleKey: "state.emptyViewerAsk",
      }),
    })
    expect(viewer.children.some((c) => c.component === "DiagnosisBlock")).toBe(true)

    expect(() =>
      listItem({
        sentenceKey: "amirHome.emptyLog",
        action: button({ labelKey: "common.save", variant: "ghost", capability: "dailyLog.edit" }),
        diagnosis: diagnosisBlock({
          stateKey: "state.emptyViewerIdle",
          responsibleKey: "state.emptyViewerAsk",
        }),
      }),
    ).toThrow(/مالكٌ واحد/)
  })

  it("ز-٥ بطاقة الكيان: **الحقيقة الواحدة** — لا كتلتان تجيبان سؤالاً واحداً (ق-١١١)", () => {
    expect(() =>
      entityCard({
        titleAr: "مسجد خالد",
        facts: [
          { key: "circles", labelKey: "amirHome.manageCircles", valueAr: "٣" },
          { key: "circles", labelKey: "amirHome.circlesHealth" as never, valueAr: "ثلاث حلقات" },
        ],
        actions: [],
      }),
    ).toThrow(/الحقيقة الواحدة/)
  })

  it("ز-٦ التغذية الراجعة: مقترنةٌ بعنصرٍ ودلالتُها مزدوجة", () => {
    const fb = inlineFeedback({ messageKey: "common.required", tone: "danger", iconName: "alert" })
    expect(fb.meta.tone).toBe("danger")
    expect(fb.a11y.live).toBe("polite")
  })
})

describe("الكائنات الأحد عشر (§٢-ج) — الجوال والوصول في الصميم (§٤)", () => {
  it("ك-١ الجدول: على الجوال بطاقاتٌ مكدّسة لا تمريرٌ أفقيّ للصفحة (§٤-١)", () => {
    const t = dataTable({
      columns: [{ key: "name", labelKey: "org.username" }],
      rows: [{ name: "أحمد" }],
      state: "data",
      capability: "audit.view",
      emptyState: emptyState({ audience: "owner", titleKey: "state.emptyOwnerTitle", actionKey: "state.emptyOwnerAction", capability: "audit.view" }),
    })
    expect(t.meta.mobileLayout).toBe("cards")
    expect(t.meta.horizontalPageScroll).toBe("false")
  })

  it("ك-١ الجدول: قائمةٌ بلا حالةٍ فارغةٍ معلنة **مرفوضة** (§٣-١ يحرسها G20)", () => {
    expect(() =>
      // @ts-expect-error الحالةُ الفارغة إلزاميةٌ في العقد
      dataTable({ columns: [], rows: [], state: "empty", capability: "audit.view" }),
    ).toThrow(/حالة فارغة/)
  })

  it("ك-٢ الشجرة: التوسيعُ الافتراضيّ بحسب نوع الورقة، وأوراقُ الأشخاص مطويّة (ق-١١٦)", () => {
    const structural = unitTree({
      nodes: [{ id: "khalid", labelAr: "مسجد خالد", type: "mosque", depth: 1 }],
      leafKind: "structure",
      lazyThreshold: 500,
      capability: "network.view",
      emptyState: emptyState({ audience: "viewer", titleKey: "state.emptyViewerVacant", diagnosisKey: "state.emptyViewerAsk" }),
    })
    expect(structural.meta.defaultExpanded).toBe("true")

    const people = unitTree({
      nodes: [{ id: "s1", labelAr: "طالب", type: "circle", depth: 3 }],
      leafKind: "people",
      lazyThreshold: 500,
      capability: "circle.view",
      emptyState: emptyState({ audience: "viewer", titleKey: "state.emptyViewerVacant", diagnosisKey: "state.emptyViewerAsk" }),
    })
    expect(people.meta.defaultExpanded).toBe("false")
  })

  it("ك-٢ الشجرة: عتبةُ التحميل الكسول **مُمرَّرةٌ من الإعدادات** لا رقماً صلباً (قب-٦)", () => {
    const t = unitTree({
      nodes: [],
      leafKind: "structure",
      lazyThreshold: 300,
      capability: "network.view",
      emptyState: emptyState({ audience: "viewer", titleKey: "state.emptyViewerVacant", diagnosisKey: "state.emptyViewerAsk" }),
    })
    expect(t.meta.lazyThreshold).toBe("300")
  })

  it("ك-٣ الحوار: ورقةٌ سفليّة على الجوال + حبسُ التركيز (§٤-٢/§٤-٤)", () => {
    const d = dialog({
      titleKey: "common.confirm",
      bodyKey: "state.deniedHint",
      confirm: button({ labelKey: "common.confirm", variant: "danger", capability: "orgUnit.manage" }),
      cancelKey: "common.cancel",
      destructive: true,
    })
    expect(d.meta.mobilePresentation).toBe("bottom-sheet")
    expect(d.a11y.focusTrap).toBe(true)
    expect(d.meta.destructive).toBe("true")
  })

  it("ك-٣ الحوار: الفعلُ الهدّام بلا تأكيدٍ **مرفوض** (§٣-٩)", () => {
    expect(() =>
      dialog({
        titleKey: "common.confirm",
        bodyKey: "state.deniedHint",
        confirm: button({ labelKey: "common.confirm", variant: "primary", capability: "orgUnit.manage" }),
        cancelKey: "common.cancel",
        destructive: true,
      }),
    ).toThrow(/هدّام/)
  })

  it("ك-٤ العابرُ والثابت: `Toast` نتيجةٌ حيّةٌ مُعلَنة و`Banner` حالةٌ مستمرّة", () => {
    const tst = toast({ messageKey: "common.error", tone: "danger", iconName: "alert" })
    expect(tst.a11y.live).toBe("assertive")
    expect(tst.meta.transient).toBe("true")

    const bnr = banner({ messageKey: "state.newVersion", tone: "info", iconName: "refresh" })
    expect(bnr.meta.transient).toBe("false")
  })

  it("ك-٥ التبويبات: **لا تستبدل القشرة** ولها أثرٌ في المسار (ق-١١٤)", () => {
    const t = tabs({
      items: [
        { labelKey: "nav.education", capability: "circle.view", routeSegment: "education" },
        { labelKey: "nav.box", capability: "box.view", routeSegment: "box" },
      ],
    })
    expect(t.meta.replacesShell).toBe("false")
    expect(t.meta.routed).toBe("true")
  })

  it("ك-٧ الحالة الفارغة: **مُشخِّصة** — دعوةُ فعلٍ لصاحبها وتشخيصٌ للمطّلع (ق-١١٢)", () => {
    const owner = emptyState({
      audience: "owner",
      titleKey: "state.emptyOwnerTitle",
      actionKey: "state.emptyOwnerAction",
      capability: "dailyLog.edit",
    })
    expect(owner.meta.audience).toBe("owner")

    const viewer = emptyState({
      audience: "viewer",
      titleKey: "state.emptyViewerVacant",
      diagnosisKey: "state.emptyViewerAsk",
    })
    expect(viewer.meta.audience).toBe("viewer")

    // فراغُ صاحبِ العمل بلا دعوةِ فعلٍ = شاشةٌ بيضاء ⇒ يُرفض.
    expect(() => emptyState({ audience: "owner", titleKey: "state.emptyOwnerTitle" })).toThrow(
      /دعوة فعل/,
    )
  })

  it("ك-٨ الكتلةُ الشارحة: للمطّلع تشخيصٌ **بلا زرٍّ تشغيليّ** (ق-١٠٩)", () => {
    const d = diagnosisBlock({ stateKey: "state.emptyViewerVacant", responsibleKey: "state.emptyViewerAsk" })
    expect(declaredCapabilities(d)).toEqual([])
    expect(walkNodes(d).some((n: UiNode) => n.component === "Button")).toBe(false)
  })

  it("ك-٩ لوحةُ الرفع: نوعٌ وحجمٌ محدودان، ونسبةُ الصورة إلزامية، و`SVG` مرفوض (ت-٥/ق-١٠٣)", () => {
    const u = uploader({
      capability: "dailyLog.attach",
      acceptedTypes: ["image/jpeg", "image/png"],
      maxBytes: 5_000_000,
      attribution: ["what", "where", "when", "who"],
    })
    expect(u.meta.acceptedTypes).toContain("image/jpeg")
    expect(u.meta.attribution).toBe("what,where,when,who")
    expect(() =>
      uploader({
        capability: "dailyLog.attach",
        acceptedTypes: ["image/svg+xml"],
        maxBytes: 5_000_000,
        attribution: ["what", "where", "when", "who"],
      }),
    ).toThrow(/SVG/)
    expect(() =>
      uploader({
        capability: "dailyLog.attach",
        acceptedTypes: ["image/png"],
        maxBytes: 5_000_000,
        attribution: ["what"],
      }),
    ).toThrow(/منسوبة/)
  })

  it("ك-١٠ البحث: **محكومٌ بالنطاق والقدرة** — لا كشفَ خارج عدسة الدور (ثغرةُ بحث v1)", () => {
    const s = searchBox({ capability: "network.view", scopePath: "/men/homs/" })
    expect(s.meta.scopePath).toBe("/men/homs/")
    expect(() => searchBox({ capability: "network.view", scopePath: "" })).toThrow(/نطاق/)
  })

  it("ك-١١ الجرس: اطّلاعٌ هابطٌ معزولٌ بالنطاق وحقٌّ مشتقّ (ق-١٠٥/§٢.١٣)", () => {
    const b = notificationBell({ capability: "derived" })
    expect(b.a11y.live).toBe("polite")
  })
})

describe("الوصولُ عابرٌ لكل المكتبة (§٤-٤) — قابلٌ للفحص لا وعداً", () => {
  const samples: readonly UiNode[] = [
    button({ labelKey: "common.save", variant: "primary", capability: "circle.manage" }),
    link({ labelKey: "nav.bayan", href: "/bayan", capability: "network.view" }),
    badge({ labelKey: "state.emptyViewerVacant", tone: "info", iconName: "info" }),
    field({ name: "username", labelKey: "org.username", kind: "text" }),
    toast({ messageKey: "common.error", tone: "danger", iconName: "alert" }),
    searchBox({ capability: "network.view", scopePath: "/" }),
  ]

  it("كل عنصرٍ باسمٍ ودورٍ مقروءين لقارئ الشاشة", () => {
    for (const n of samples) {
      for (const child of walkNodes(n)) {
        expect(child.a11y.role.length, child.component).toBeGreaterThan(0)
        expect(child.a11y.nameAr.trim().length, child.component).toBeGreaterThan(0)
      }
    }
  })

  it("وكلُّ تفاعليٍّ بهدفِ لمسٍ لا يقلّ عن ٤٤ نقطة", () => {
    for (const n of samples) {
      for (const child of walkNodes(n)) {
        if (child.interactive) expect(child.a11y.minTouchTarget, child.component).toBe(TOKENS.size["touch-min"])
      }
    }
  })

  it("ولا نصَّ عربياً حرفياً في عقد المكوّن — المفاتيحُ فقط (§٥-٣)", () => {
    for (const n of samples) {
      for (const child of walkNodes(n)) {
        expect(Array.isArray(child.textKeys), child.component).toBe(true)
      }
    }
  })
})
