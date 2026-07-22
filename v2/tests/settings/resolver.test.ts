import { describe, it, expect } from "vitest"
import { SETTINGS, SETTINGS_BY_ID, DELIBERATE_HARD_CONSTANTS } from "../../src/settings/registry.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import type { SettingOverride } from "../../src/settings/resolver.js"

const AT = new Date("2026-07-20T00:00:00.000Z")

describe("سلامة السجل (SPEC_settings §١-١)", () => {
  it("٨٣ إعداداً: ٧١ عمل + ١٢ منصة (بعد شطبات CR-008…CR-010 وCR-014 وCR-021 وCR-024 وCR-025)", () => {
    expect(SETTINGS).toHaveLength(83)
    expect(SETTINGS.filter((d) => d.category === "business")).toHaveLength(71)
    expect(SETTINGS.filter((d) => d.category === "platform")).toHaveLength(12)
  })

  /**
   * **CR-021/قب-٤٥ — الفحصُ يتوسّع من الأسماء إلى الدلالة.**
   *
   * الأصنافُ الثلاثة السابقة تُقاس **بفعلٍ صريحٍ في الاسم** (`exempt`/`bypass`/`skip_`) أو
   * **بمفردةٍ من نموذجٍ منسوخ**. و`edu.paid_hours.approved_only` **عَبَرها كلَّها باسمٍ بريء**:
   * لا يَعِد بإعفاءٍ ولا يذكر نموذجاً — بل **يَعِد بإطفاء حارسٍ يُشغّله اسمُه**.
   *
   * **القياسُ المحتوائيّ المعتمد** — ثلاثةُ شروطٍ مجتمعة، كلُّها تُقرأ من السجل نفسِه:
   *  ١. المعرّفُ **يُعلن حارساً مُشغَّلاً**: `*_only` أو `*_required` أو `*_enforced`.
   *  ٢. النوعُ `toggle` **وافتراضُه `true`** — أي أن الحارس **يعمل اليوم**، فالضبطُ الوحيد
   *     المتاح هو **إطفاؤه**: إعدادٌ قيمتُه الوحيدة المفيدة هي تعطيلُ قاعدة.
   *  ٣. ومصدرُه **قاعدةٌ في العقد** (`ق-` أو `ب-`) لا موضعُ كودٍ تقنيّ — فالمُطفَأُ قاعدةٌ
   *     محسومة لا تفصيلُ تنفيذ.
   *
   * > **وحدُّ القياس مُصرَّحٌ به** (المادة ٠ — سابقة T17): الشطرُ الرابع في نصّ CR-021
   * > («والقاعدةُ **معلَّلةٌ بمنع الغش**») **لا يُقاس هنا** — نصوصُ القواعد تعيش في
   * > `rebuild/inventory/C_business_rules.md` خارج حزمة `v2`، وقراءتُها من اختبارٍ تقلب
   * > اتجاه الاعتماد وتُنتج حارساً هشّاً. فالمقيسُ **بنيةُ الإعداد** لا **تعليلُ قاعدته**،
   * > وهو أضيقُ من النصّ عمداً: يمسك الصنفَ ولا يدّعي ما لا يقيس.
   *
   * **وقد أثمر القياسُ فوراً**: بعد شطب `edu.paid_hours.approved_only` بقي **بندان** يستوفيان
   * الشروطَ الثلاثة، **ولم يكن أيٌّ منهما مرصوداً قبل هذا الفحص**. وهما **ليسا من نصيب هذا
   * التسليم** (`v2/src/settings/**` مُجمَّد — `PARALLEL_WORK` §٢)، فرُفعا مسوّدتَي طلبِ تغييرٍ
   * ووُضعا في **حَجْرٍ مُعلَن** على نمط `allowlist.any.json` الذي أقرّته المادة ٢/٢:
   * **العددُ لا ينمو** — بندٌ جديدٌ من الصنف يُفشل هذا الاختبار فوراً.
   */
  it("**ولا إعدادَ يُطفئ حارساً يُشغّله اسمُه** (§١-٨أ المُوسَّعة بـCR-021 — القياس الدلاليّ)", () => {
    const DECLARES_ACTIVE_GUARD = /(_only|_required|_enforced)$/
    const FROM_CONTRACT_RULE = /(^|[^\w])(ق|ب)-/u

    const offenders = SETTINGS.filter(
      (d) =>
        DECLARES_ACTIVE_GUARD.test(d.id) &&
        d.type === "toggle" &&
        d.default === true &&
        FROM_CONTRACT_RULE.test(d.source),
    ).map((d) => d.id)

    /**
     * **والحَجْرُ أُفرغ** (CR-024 وCR-025، ٢٠٢٦-٠٧-٢٢): البندان اللذان اصطادهما هذا الفحصُ
     * نفسُه **شُطبا بقرار المدير**، فلم يبقَ في السجل بندٌ واحدٌ من الصنف.
     *
     * **والحَجْرُ الفارغُ ليس زينةً بل الحالةَ الصحيحة**: `[]` **حدٌّ لا يُتجاوز** — أوّلُ
     * إعدادٍ جديدٍ يَعِد بإطفاء حارسٍ يُشغّله اسمُه **يُفشل هذا الاختبار يومَ يُكتب**، لا
     * يومَ يُكتشف بعد سنة. ولذلك يبقى القياسُ كما هو **بلا تخفيفٍ ولا استثناء**:
     * الحَجْرُ أُفرغ لأن الواقعَ نظُف، **لا لأن الفحص رقّ**.
     */
    const QUARANTINED_PENDING_DECISION: readonly string[] = []

    expect(
      offenders.sort(),
      "إعدادٌ جديدٌ يَعِد بإطفاء حارسٍ يُشغّله اسمُه — يُشطب أو يُرفع بـCR قبل أن يُدمج",
    ).toEqual([...QUARANTINED_PENDING_DECISION].sort())

    for (const revoked of [
      "edu.paid_hours.approved_only",
      "finance.entitlement.approval_required",
      "identity.impersonation.read_only",
    ]) {
      expect(SETTINGS_BY_ID.has(revoked), `${revoked} مشطوبٌ فلا يبقى في السجل`).toBe(false)
    }
  })

  /**
   * **§١-٨أ المُوسَّعة بـCR-009**: كل إعدادٍ يوحي اسمُه بتعطيل حارسٍ أو إحياء قاعدةٍ منسوخة
   * = مخالفةٌ **بحكم الاسم**، تُشطب ولو بلا مستهلك. والبحثُ عنها **دوريٌّ لا انتظاريّ** —
   * فهذا الاختبارُ هو تحويلُ المسح اليدويّ إلى فحصٍ آليّ (المادة ١/٤: ما تكرّر مرتين يُؤتمت).
   */
  it("**لا إعدادَ يَعِد بإعفاءٍ من حارسٍ أو بإحياء قاعدةٍ منسوخة** (§١-٨أ — CR-008/CR-009/CR-010)", () => {
    const suspicious = [
      /exempt/i,
      /bypass/i,
      /_override_/i,
      /disable_guard/i,
      /skip_/i,
      // **صنفُ CR-010**: مفتاحٌ يَعِد بتنقيطٍ آليٍّ لِما لا وزنَ له في الكتالوج — نقضٌ
      // لـب-٤٢ («بلا نقاط آلية») ولـب-٣٢ («نقطةٌ بلا تحقّقٍ نقطةٌ زائفة») معاً.
      /free_.*scores?/i,
      /auto_.*(scores?|points)/i,
    ]
    const offenders = SETTINGS.filter((d) => suspicious.some((re) => re.test(d.id)))
    expect(offenders.map((d) => d.id), "إعدادٌ يشتري إعفاءً من قاعدة").toEqual([])
  })

  /**
   * **الصنفُ الثالث — «إعدادٌ يفترض نموذجاً مَنسوخاً»** (CR-014/قب-٤٠، ٢٠٢٦-٠٧-٢٢).
   *
   * الصنفان السابقان يُقاسان بفعلٍ في الاسم (`exempt`/`bypass`/`skip_`) — وهذا يُقاس
   * **بمفردةٍ من معجم النموذج المنسوخ**: كانت في v1 **أسماءَ أنظمةٍ منفصلة**
   * (`tahfeez_*` × `/ala-baseera` × `halaqa`) وصارت بب-٢٨ **قيمَ صفوفٍ في كتالوجٍ واحد**.
   * فظهورُها في **معرّف إعدادٍ** أو في **قائمة قيمه المسرودة** دليلٌ محتوائيّ على أن السجل
   * ما زال يفترض النموذجَ القديم: إمّا مفتاحُ تفعيلٍ لكيانٍ صار نوعاً (`feature.tahfeez`)،
   * وإمّا قائمةٌ تسرد الأنواعَ بدل أن تشتقّها (`edu.paid_hours.curricula.allowed`).
   * **والمعجمُ نفسُه** الذي يحرس به T16 وحدةَ الحلقات (`tests/features/circles/single-entity.test.ts`)
   * — مصدرُ قياسٍ واحد لا اثنان (المادة ١/٢).
   *
   * **حدُّ هذا القياس معلَنٌ لا مخفيّ**: يمسك النموذجَ المنسوخ **المعروف** بمعجمه، ولا يمسك
   * كياناً يصير نوعاً في كتالوجٍ **مستقبلاً** باسمٍ خارج المعجم — فذاك لا قياسَ محتوائيّاً
   * موثوقاً له اليوم (الأنواعُ **بياناتٌ** لا ثوابتُ كودٍ تُقارَن بها، وهو عينُ المطلوب).
   * فيُوسَّع المعجمُ يومَ يُنسخ نموذجٌ آخر — ولا يُخترع حارسٌ شكليّ يوهم بما لا يحرسه (المادة ٠).
   *
   * **المُستثنى بعلّة**: حقلُ `source` وحدَه يجوز أن يحمل مفردةً منها، لأنه **استشهادٌ عكسيّ
   * بموضع v1** (`tahfeez.server.ts:325`) — توثيقُ أصلٍ لا إعلانُ نموذجٍ عامل. والمُدان
   * ما **يعمل به الأدمن**: المعرّفُ وقائمةُ القيم.
   */
  it("**ولا إعدادَ يفترض نموذجاً نُسخ بإعادة تصميم** (§١-٨أ المُوسَّعة بـCR-014 — ب-٢٨/ع-٨)", () => {
    // معجمُ الأنظمة الثلاثة المنسوخة بب-٢٨ — نفسُ قائمة حارس T16 المحتوائيّ.
    const REVOKED_MODEL = ["tahfeez", "alabaseera", "baseera", "halaqa", "halaqat", "rashidi"]
    const hit = (text: string): string | null =>
      REVOKED_MODEL.find((token) => text.toLowerCase().includes(token)) ?? null

    const offenders: string[] = []
    for (const d of SETTINGS) {
      const inId = hit(d.id)
      if (inId !== null) offenders.push(`${d.id} ⟵ معرّفٌ يحمل «${inId}»`)
      for (const value of d.allowed ?? []) {
        const inValue = hit(value)
        if (inValue !== null) offenders.push(`${d.id}.allowed ⟵ يسرد «${inValue}»`)
      }
    }
    expect(
      offenders,
      "إعدادٌ يفترض «وحدةً تُخفى» أو يسرد أنواعاً صارت بياناتٍ — يُشطب يوم يُنسخ النموذج",
    ).toEqual([])
  })

  /**
   * **الوجهُ المُنتِج للشطب** (CR-014 بند ٢): القاموسُ المغلق باقٍ، ومصدرُه هو الذي تبدّل —
   * من **سردٍ في الكود** إلى **إعلانِ كتالوجٍ بياناتٍ**. فلو عاد أحدٌ يسرد الأنواع سقط
   * الاختبارُ السابق، ولو حُذف القاموسُ صمتاً فصار الحقلُ نصّاً حرّاً سقط هذا (§١-٢).
   */
  it("و`edu.paid_hours.curricula` يُعلن **مصدرَ** قاموسه ولا يسرده (قب-٢٢/CR-011)", () => {
    const d = SETTINGS_BY_ID.get("edu.paid_hours.curricula")
    expect(d, "الإعدادُ حيٌّ المعنى (ق-٨٦) فلا يُشطب").toBeDefined()
    expect(d?.allowed, "قائمةٌ تُسرد تتخلّف عن أي نوعٍ خامس").toBeUndefined()
    expect(d?.allowedFrom, "قاموسٌ بلا مصدرٍ معلن = نصٌّ حرّ").toBe("circles.typeCatalog")
  })

  it("سبعة مفاتيح تفعيل (قب-٧) — بعد شطب مفتاحَي «الوحدة» بـCR-014", () => {
    expect(SETTINGS.filter((d) => d.featureFlag !== undefined)).toHaveLength(7)
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
