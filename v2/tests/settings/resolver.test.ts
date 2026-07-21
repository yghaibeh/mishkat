import { describe, it, expect } from "vitest"
import { SETTINGS, SETTINGS_BY_ID, DELIBERATE_HARD_CONSTANTS } from "../../src/settings/registry.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import type { SettingOverride } from "../../src/settings/resolver.js"

const AT = new Date("2026-07-20T00:00:00.000Z")

describe("سلامة السجل (SPEC_settings §١-١)", () => {
  it("٩٠ إعداداً: ٧٨ عمل + ١٢ منصة (بعد شطب CR-008)", () => {
    expect(SETTINGS).toHaveLength(90)
    expect(SETTINGS.filter((d) => d.category === "business")).toHaveLength(78)
    expect(SETTINGS.filter((d) => d.category === "platform")).toHaveLength(12)
  })

  it("تسعة مفاتيح تفعيل (قب-٧)", () => {
    expect(SETTINGS.filter((d) => d.featureFlag !== undefined)).toHaveLength(9)
  })

  it("لا معرّف مكرر — والمعرّف فريد عالمياً", () => {
    expect(new Set(SETTINGS.map((d) => d.id)).size).toBe(SETTINGS.length)
  })

  it("لا إعداد ناقص الإعلان", () => {
    for (const d of SETTINGS) {
      expect(d.ar.length, `${d.id} بلا وصف`).toBeGreaterThan(3)
      expect(d.source.length, `${d.id} بلا مصدر متتبَّع`).toBeGreaterThan(2)
    }
  })

  it("كل مفتاح تفعيل عالميّ المستوى وله إجراء مرافق معلن (§١-٧)", () => {
    for (const d of SETTINGS.filter((x) => x.featureFlag !== undefined)) {
      expect(d.level, `${d.id} ليس عالمياً`).toBe("global")
      expect(d.type).toBe("toggle")
      expect(d.featureFlag?.companionAction.length, `${d.id} بلا إجراء مرافق`).toBeGreaterThan(30)
    }
  })

  it("المؤثِّر مالياً بأثر قادم دائماً (ق-٣٦)", () => {
    for (const d of SETTINGS.filter((x) => x.type === "money")) {
      expect(d.effect, `${d.id} مؤثر مالياً وسريانه فوري`).toBe("forward_dated")
    }
  })

  it("خمس قيم مسجَّلة بلا افتراضي عمداً — لا اختراع أرقام (ق-م-٢ الأربع + سقف النثرية الذي يُضبط لكل صندوق)", () => {
    const missing = SETTINGS.filter((d) => d.default === null).map((d) => d.id)
    expect(missing.sort()).toEqual(
      [
        "finance.fixed_salary.amount",
        "finance.hourly_rate.amount",
        "finance.petty_cash.ceiling",
        "notify.telegram_link_ttl_minutes",
        "platform.upload.max_bytes",
      ].sort(),
    )
  })

  it("مقياس ٥٦/٤٠ الصلب أُسقط ولم يُنقل إعداداً (قب-١١)", () => {
    expect(SETTINGS_BY_ID.has("network.unit_status.done_pct")).toBe(false)
    expect(SETTINGS_BY_ID.has("network.unit_status.below_pct")).toBe(false)
    expect(SETTINGS_BY_ID.has("points.tier.excellent_pct")).toBe(true)
  })

  it("أربعة عشر ثابتاً صلباً معلَّلاً (§٢-٤)", () => {
    expect(DELIBERATE_HARD_CONSTANTS).toHaveLength(14)
    for (const c of DELIBERATE_HARD_CONSTANTS) expect(c.why.length).toBeGreaterThan(2)
  })
})

describe("المُحلِّل: النطاق معامل إلزامي والأدقُّ يغلب الأعمَّ (§١-٣، §١-٨)", () => {
  it("بلا تخصيص يعيد الافتراضي المعلن", () => {
    const get = createSettingsResolver([])
    expect(get("points.weekly_target", "/men/homs/", AT)).toBe(70)
  })

  it("والقيمة الأدقُّ تغلب الأعمَّ — أول قيمة صعوداً من الوحدة", () => {
    const overrides: SettingOverride[] = [
      { settingId: "points.weekly_target", scopePath: "/men/", value: 60, validFrom: new Date("2026-01-01T00:00:00.000Z") },
      { settingId: "points.weekly_target", scopePath: "/", value: 50, validFrom: new Date("2026-01-01T00:00:00.000Z") },
    ]
    const get = createSettingsResolver(overrides)
    expect(get("points.weekly_target", "/men/homs/sq2/", AT)).toBe(60)
    expect(get("points.weekly_target", "/women/homs/", AT)).toBe(50)
  })

  it("ولا تتسرب قيمة قسمٍ إلى القسم الآخر (ق-٢٠)", () => {
    const get = createSettingsResolver([
      { settingId: "points.weekly_target", scopePath: "/women/", value: 40, validFrom: new Date("2026-01-01T00:00:00.000Z") },
    ])
    expect(get("points.weekly_target", "/women/homs/", AT)).toBe(40)
    expect(get("points.weekly_target", "/men/homs/", AT)).toBe(70)
  })

  it("وتخصيصُ مفتاحٍ خارج السجل يُرفض عند البناء — لا يدخل الذاكرة أصلاً", () => {
    expect(() =>
      createSettingsResolver([
        { settingId: "points.invented", scopePath: "/", value: 1, validFrom: AT },
      ]),
    ).toThrow(/غير مسجَّل/)
  })

  it("والإعداد المسجَّل بلا افتراضي يرمي رسالةً مُشخِّصة بدل قيمةٍ مخترعة (ق-م-٢)", () => {
    const get = createSettingsResolver([])
    expect(() => get("finance.hourly_rate.amount", "/men/", AT)).toThrow(
      /بلا قيمة افتراضية/,
    )
  })

  it("مفتاح خارج السجل يرمي — لا قيمة صامتة", () => {
    const get = createSettingsResolver([])
    expect(() => get("points.invented", "/", AT)).toThrow(/غير مسجَّل/)
  })

  it("والقراءة بلا نطاق مستحيلة بالتوقيع نفسه — يمنعها المترجم لا زمن التشغيل", () => {
    const get = createSettingsResolver([])
    // @ts-expect-error — النطاق و`at` معاملان مطلوبان لا اختياريان (نظير المادة ٤/٣)
    const illegal = () => get("points.weekly_target")
    expect(typeof illegal).toBe("function")
    expect(get.length, "التوقيع يطلب ثلاثة معاملات").toBe(3)
  })
})

describe("الأثر القادم: الماضي لا يُعاد حسابه أبداً (§١-٥، ق-٣٦)", () => {
  const overrides: SettingOverride[] = [
    { settingId: "finance.point_rate.amount", scopePath: "/", value: 5000, validFrom: new Date("2026-01-01T00:00:00.000Z") },
    { settingId: "finance.point_rate.amount", scopePath: "/", value: 7000, validFrom: new Date("2026-07-01T00:00:00.000Z") },
  ]
  const get = createSettingsResolver(overrides)

  it("الحساب اليوم يستعمل النسخة السارية اليوم", () => {
    expect(get("finance.point_rate.amount", "/men/", AT)).toBe(7000)
  })

  it("وإعادة حساب شهرٍ ماضٍ تستعمل نسخته هو — لا النسخة النشطة", () => {
    expect(
      get("finance.point_rate.amount", "/men/", new Date("2026-03-15T00:00:00.000Z")),
    ).toBe(5000)
  })

  it("والنسخة التي لم تسرِ بعدُ لا تُستعمل", () => {
    expect(
      get("finance.point_rate.amount", "/men/", new Date("2026-06-30T00:00:00.000Z")),
    ).toBe(5000)
  })

  it("وعند تعادل كلِّ شيء بلا معرّفات يبقى الجواب حتمياً", () => {
    const same = new Date("2026-01-01T00:00:00.000Z")
    const r = createSettingsResolver([
      { settingId: "finance.point_rate.amount", scopePath: "/", value: 111, validFrom: same },
      { settingId: "finance.point_rate.amount", scopePath: "/", value: 222, validFrom: same },
    ])
    const first = r("finance.point_rate.amount", "/", AT)
    expect(r("finance.point_rate.amount", "/", AT)).toBe(first)
  })

  it("وعند تعادل validFrom يُكسر التعادل حتمياً بالمعرّف — لا لا-حتمية", () => {
    const same = new Date("2026-01-01T00:00:00.000Z")
    const a = createSettingsResolver([
      { settingId: "finance.point_rate.amount", scopePath: "/", value: 100, validFrom: same, id: "v-b" },
      { settingId: "finance.point_rate.amount", scopePath: "/", value: 200, validFrom: same, id: "v-a" },
    ])
    const b = createSettingsResolver([
      { settingId: "finance.point_rate.amount", scopePath: "/", value: 200, validFrom: same, id: "v-a" },
      { settingId: "finance.point_rate.amount", scopePath: "/", value: 100, validFrom: same, id: "v-b" },
    ])
    expect(a("finance.point_rate.amount", "/", AT)).toBe(b("finance.point_rate.amount", "/", AT))
  })
})

describe("قاعدة السقف: لا يُضبط إعداد عند مستوىً أدقَّ من سقفه (§١-٤)", () => {
  it("تخصيص إعدادٍ عالميّ عند وحدة يُرفض ولو ملك المستخدم القدرة هناك", () => {
    expect(() =>
      createSettingsResolver([
        { settingId: "time.zone", scopePath: "/men/homs/", value: "Asia/Istanbul", validFrom: AT },
      ]),
    ).toThrow(/سقف/)
  })

  it("وتخصيص إعدادٍ سقفه القسم عند وحدةٍ أدقَّ يُرفض", () => {
    expect(() =>
      createSettingsResolver([
        { settingId: "points.weekly_target", scopePath: "/men/homs/sq2/", value: 60, validFrom: AT },
      ]),
    ).toThrow(/سقف/)
  })

  it("ويُقبل ما سقفه الوحدة عند أي عقدة", () => {
    const get = createSettingsResolver([
      { settingId: "finance.budget.alert_pct", scopePath: "/men/homs/sq2/khalid/", value: 80, validFrom: AT },
    ])
    expect(get("finance.budget.alert_pct", "/men/homs/sq2/khalid/", AT)).toBe(80)
  })
})
