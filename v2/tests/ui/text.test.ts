/**
 * طبقة النصوص المركزية والمعاجم المغلقة — SPEC_design_system §٥ + المادة ٢/٦.
 *
 * كلُّ حرفٍ يراه المستخدم في مكانٍ واحد يُدقَّق لغوياً؛ والمكوّنُ يستقبل **مفتاحاً** لا حرفاً.
 * ثلاثةُ أمراضٍ من v1 تموت هنا: مفتاحٌ إنجليزيٌّ خام يظهر للمستخدم (ق-١١٧)، واسمُ دورٍ
 * مكرَّرٌ خارج مصدره فيتسرّب دورٌ، و«١٤٤٨ هـ هـ» من إلحاقٍ يدويٍّ فوق ما يُلحقه Intl (ذ-٥).
 */
import { describe, it, expect } from "vitest"
import {
  TEXT,
  TEXT_KEYS,
  t,
  type TextKey,
} from "../../src/ui/text/dictionary.js"
import {
  roleLabel,
  orgTypeLabel,
  ROLE_ICON,
  ORG_TYPE_ICON,
  lexicon,
  FALLBACK_LABEL_AR,
} from "../../src/ui/text/lexicons.js"
import {
  formatNumber,
  formatHijri,
  formatMoney,
  formatRelativeDays,
} from "../../src/ui/text/format.js"
import { ROLES, ROLE_IDS, type UnitTypeId } from "../../src/authorization/generated/roles.generated.js"
import { LEGAL_CHILDREN } from "../../src/features/org/data/hierarchy.js"

/** أنواعُ الوحدات من سلّم الشجرة (مصدرُها الواحد) — لا قائمةٌ ثانيةٌ في الاختبار. */
const UNIT_TYPE_IDS = Object.keys(LEGAL_CHILDREN) as readonly UnitTypeId[]

const ARABIC = /[؀-ۿ]/
const LATIN_WORD = /[A-Za-z]{3,}/

describe("طبقة النصوص — كل مفتاحٍ له عربيّةٌ مدقَّقة، ولا مفتاحَ خامٌّ يتسرّب (ق-١١٧)", () => {
  it("القاموسُ غيرُ فارغ وكل مفاتيحه منمّطةٌ بمجالها (`مجال.اسم`)", () => {
    expect(TEXT_KEYS.length).toBeGreaterThan(20)
    for (const key of TEXT_KEYS) expect(key, key).toMatch(/^[a-z][a-zA-Z]*\.[a-zA-Z.]+$/)
  })

  it("كل قيمةٍ عربيةٌ غيرُ فارغة — ولا قيمةٌ تساوي مفتاحَها (المفتاح الخام موتٌ مؤجَّل)", () => {
    for (const key of TEXT_KEYS) {
      const value = TEXT[key]
      expect(value.trim().length, key).toBeGreaterThan(0)
      expect(value, key).not.toBe(key)
      expect(value, key).toMatch(ARABIC)
      expect(value, key).not.toMatch(LATIN_WORD)
    }
  })

  it("`t` يحلّ المفتاحَ إلى نصٍّ عربيّ", () => {
    const first = TEXT_KEYS[0] as TextKey
    expect(t(first)).toBe(TEXT[first])
  })

  it("لا مفتاحين بنصٍّ واحدٍ في المجال نفسه (ازدواجُ صياغةٍ يُدقَّق مرةً واحدة)", () => {
    const seen = new Map<string, TextKey>()
    const duplicates: string[] = []
    for (const key of TEXT_KEYS) {
      const domain = key.split(".")[0] as string
      const composite = `${domain}::${TEXT[key]}`
      const prior = seen.get(composite)
      if (prior !== undefined) duplicates.push(`${prior} = ${key} («${TEXT[key]}»)`)
      else seen.set(composite, key)
    }
    expect(duplicates).toEqual([])
  })
})

describe("المعاجم المغلقة — مصدرٌ واحدٌ لكلٍّ وسقوطٌ آمن «أخرى» (§٥-٢)", () => {
  it("اسمُ الدور من `ROLES` وحده — لا نسخةٌ محلية تتسرّب (درس v1)", () => {
    for (const id of ROLE_IDS) expect(roleLabel(id)).toBe(ROLES[id].ar)
  })

  it("لكل دورٍ أيقونة، ولا أيقونةَ لمفتاحٍ غير موجود (حارسٌ بنيويّ — ق-١١٨)", () => {
    expect(Object.keys(ROLE_ICON).sort()).toEqual([...ROLE_IDS].sort())
    for (const id of ROLE_IDS) expect(ROLE_ICON[id].length, id).toBeGreaterThan(0)
  })

  it("لكل نوع وحدةٍ اسمٌ وأيقونة — ولا نوعَ بلا مفتاح (ق-١١٨)", () => {
    expect(Object.keys(ORG_TYPE_ICON).sort()).toEqual([...UNIT_TYPE_IDS].sort())
    for (const type of UNIT_TYPE_IDS) {
      expect(orgTypeLabel(type)).toMatch(ARABIC)
      expect(ORG_TYPE_ICON[type].length, type).toBeGreaterThan(0)
    }
  })

  it("مفتاحٌ مجهولٌ يسقط إلى «أخرى» ولا يظهر خاماً أبداً (نظير material-categories)", () => {
    expect(lexicon({ a: "ألف" }, "zzz")).toBe(FALLBACK_LABEL_AR)
    expect(lexicon({ a: "ألف" }, "a")).toBe("ألف")
    expect(FALLBACK_LABEL_AR).toBe("أخرى")
  })
})

describe("التنسيقاتُ المركزية — هجريٌّ وأرقامٌ عربية-هندية ومبلغٌ متسق (ذ-٥/ذ-٦، قب-٢٠)", () => {
  const at = new Date("2026-07-21T09:00:00.000Z")

  it("الأرقامُ عربية-هندية ٤٥ موحّدةً (قب-٢٠ م-٢)", () => {
    expect(formatNumber(45)).toBe("٤٥")
    expect(formatNumber(0)).toBe("٠")
  })

  it("التاريخُ هجريٌّ بأمّ القرى بأرقامٍ عربية-هندية (ق-١١٧)", () => {
    const s = formatHijri(at)
    expect(s).toMatch(/[٠-٩]/)
    expect(s).toContain("هـ")
  })

  it("**لا «هـ هـ»**: لا إلحاقَ يدويٌّ فوق ما يُلحقه Intl (الخطأ المكلف في v1)", () => {
    const s = formatHijri(at)
    expect(s.split("هـ").length - 1).toBe(1)
  })

  it("التاريخُ حتميّ: منطقةٌ زمنيةٌ مثبَّتة ⇒ نفسُ اللحظة نفسُ النص", () => {
    expect(formatHijri(at)).toBe(formatHijri(new Date(at.getTime())))
  })

  it("التاريخُ النسبيّ من سجلٍّ حيٍّ لا نصٌّ جامد (ق-١١٢)", () => {
    const twoDaysEarlier = new Date(at.getTime() - 2 * 24 * 60 * 60 * 1000)
    expect(formatRelativeDays(twoDaysEarlier, at)).toMatch(ARABIC)
    expect(formatRelativeDays(at, at)).toMatch(ARABIC)
  })

  it("المبلغُ بعملةٍ ومنزلةٍ **من الإعدادات لا صلبتين** (قب-٦)، والسالبُ بنمطٍ واحد", () => {
    const syp = formatMoney({ amount: 1500, currencyCode: "SYP", fractionDigits: 0 })
    expect(syp).toMatch(/[٠-٩]/)
    const negative = formatMoney({ amount: -1500, currencyCode: "SYP", fractionDigits: 0 })
    // الدلالةُ لا تُحمَل باللون وحده (§٤-٥): السالبُ يحمل علامتَه في النص نفسه.
    expect(negative).not.toBe(syp)
    expect(negative).toContain("−")
  })

  it("منزلةُ الكسر تُحترم كما جاءت من الإعداد (لا تقريبٌ منزليّ الصنع)", () => {
    const two = formatMoney({ amount: 12.5, currencyCode: "USD", fractionDigits: 2 })
    expect(two).toMatch(/٥٠/)
  })
})
