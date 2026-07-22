/**
 * **الاختبارُ الإلزاميُّ الأول — مسحٌ بنيويّ**: «**صفرُ استحقاقٍ يدويّ**» (ق-٥٢) و«**صفرُ
 * عدّادٍ مخزَّنٍ قبل الاعتماد**» (عقدُ الوحدة §٢-١).
 *
 * **ولماذا مسحٌ محتوائيٌّ لا اختبارٌ سلوكيّ؟** لأن الدعوى **بنيوية**: «لا مسارَ كتابةٍ يقبل
 * مبلغاً من المستخدم». واختبارٌ سلوكيٌّ يمرّ على المسارات التي **كتبتُها أنا**، ويفوته
 * المسارُ الذي يكتبه غيري غداً — وهو **الدرسُ المعمَّم في قب-٤٠** حرفياً: *دعوى بنيوية
 * تُقاس بالمحتوى؛ وقياسُها بالسلوك يُنتج حارساً يمرّ على البذرة ويفوته الواقع.*
 *
 * فالحارسُ هنا يقرأ **مصدرَ الوحدة نفسَه** ويفشل على أوّل مخالفة — **ويعمل في CI بلا حالة
 * محلية** (قب-٢٣): لا `mtime` ولا ترتيبَ تنفيذٍ ولا أثرَ أداة.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const MODULE_DIR = new URL("../../../src/features/payroll/", import.meta.url).pathname

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".ts") ? [full] : []
  })
}

/** يجرّد التعليقاتِ — **فالتوثيقُ لا يُدان**، والمقيسُ الكودُ وحده (نظيرُ `stripCommentsOnly`). */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

const SOURCES = walk(MODULE_DIR).map((path) => ({
  rel: path.slice(MODULE_DIR.length),
  code: code(path),
}))

describe("**ق-٥٢ — لا مسارَ كتابةٍ يقبل مبلغَ استحقاقٍ من المستخدم** (مسحٌ بنيويّ)", () => {
  it("للوحدة مصدرٌ يُمسَح فعلاً — **لا يخضرّ الحارسُ على فراغ**", () => {
    expect(SOURCES.length, "مسحٌ بلا موضوعٍ ليس حارساً").toBeGreaterThan(10)
  })

  /**
   * **مدخلاتُ الاشتقاق والصرف لا تحمل مبلغاً**: `DeriveInput` و`DisburseInput` هما البابان
   * الوحيدان إلى المستحق، ولو حمل أحدُهما حقلَ مبلغٍ لَصار **الاستحقاقُ مكتوباً باليد**.
   * والمبلغان المشروعان (أصلُ السلفة · الحافز) **ليسا استحقاقاً** — عقدٌ ومنحةٌ (§٦/§٧).
   */
  it("**`DeriveInput` و`DisburseInput` بلا حقلِ مبلغٍ واحد** — المبالغُ من المصدر لا من المدخل", () => {
    const forbidden = /(amount|Amount|Cents|gross|net|salary|rate)\s*[?]?\s*:/
    const offenders: string[] = []

    for (const source of SOURCES) {
      for (const name of ["DeriveInput", "DisburseInput"]) {
        const match = new RegExp(`export type ${name} = \\{([\\s\\S]*?)\\n\\}`).exec(source.code)
        if (match === null) continue
        for (const line of match[1]!.split("\n")) {
          if (forbidden.test(line)) offenders.push(`${source.rel} · ${name}: ${line.trim()}`)
        }
      }
    }
    expect(offenders, "**مبلغُ استحقاقٍ يدخل من الحدود** — نقضٌ لق-٥٢").toEqual([])
  })

  /**
   * **صفرُ عدّادٍ مخزَّن**: لا كيانَ **مخزَّنٍ** في هذه الوحدة يحمل مستحقاً أو إجمالياً أو
   * حالةَ «مدفوع». والمقيسُ `types.ts` و`data/` — موطنُ الكيانات المخزَّنة.
   *
   * **والمستثنى بعلّةٍ معلنة** (§٦): `principalCents` و`instalmentCents` و`amountCents` في
   * السلفة وقسطها — **وقائعُ مالية التُزمت** لكلٍّ منها قيدُه برهاناً، لا عدّاداتُ عملٍ
   * تتغيّر بتغيّر الدروس. وهي **مسرودةٌ هنا صراحةً**: أيُّ حقلِ مالٍ رابعٍ يُفشل الاختبار.
   */
  it("**لا حقلَ مستحقٍّ ولا إجماليٍّ ولا «مدفوع» في كياناتٍ مخزَّنة** (§٢-١)", () => {
    const COMMITTED_FACTS = ["principalCents", "instalmentCents", "amountCents"]
    const MONEY_FIELD = /^\s*readonly (\w*(?:Cents|Total|Balance|Paid|paid))\b/
    const offenders: string[] = []

    for (const source of SOURCES) {
      if (source.rel !== "types.ts" && !source.rel.startsWith("data/")) continue
      // كتلُ الكيانات المخزَّنة وحدها: ما يحمل `tenantId` فهو مخزَّنٌ في مستودعٍ (نظيرُ box).
      for (const block of source.code.matchAll(/export type (\w+) = \{([\s\S]*?)\n\}/g)) {
        if (!block[2]!.includes("readonly tenantId")) continue
        for (const line of block[2]!.split("\n")) {
          const hit = MONEY_FIELD.exec(line)
          if (hit === null) continue
          if (COMMITTED_FACTS.includes(hit[1]!)) continue
          offenders.push(`${source.rel} · ${block[1]}.${hit[1]}`)
        }
      }
    }
    expect(offenders, "**عدّادٌ ماليٌّ مخزَّنٌ في كيانِ الوحدة** — نقضٌ للمبدأ الحاكم").toEqual([])
  })

  it("**ومستودعُ الوحدة بلا دالّةِ حفظِ مستحقٍّ ولا وسمِ دفعٍ** — «مدفوعٌ» اشتقاقٌ (ق-٦٥)", () => {
    const store = SOURCES.find((s) => s.rel === "data/store.ts")!
    expect(store.code).not.toMatch(/saveEntitlement|markPaid|setPaid|updateNet|savePlan/)
    expect(store.code, "و«مَن صُرف له» يُشتقّ من سجل الصرف").toMatch(/paidPersonIdsIn/)
  })

  it("**ولا حذفَ في طبقة البيانات** (المادة ٧/٤): الإقفالُ حالةٌ لا محو", () => {
    const store = SOURCES.find((s) => s.rel === "data/store.ts")!
    expect(store.code).not.toMatch(/\bdelete\b|\bremove\w*\(|\.clear\(\)/)
  })
})

describe("**G6 — صفرُ فحصِ دورٍ وصفرُ قائمةِ أدوار** في الوحدة", () => {
  it("لا اسمَ دورٍ واحدٍ في طبقتَي الخدمات والبيانات", () => {
    const ROLE_NAMES = /"(admin|amir|teacher|finance_officer|section_head|rabita|square)"/
    const offenders = SOURCES.filter(
      (s) => !s.rel.startsWith("screens/") && ROLE_NAMES.test(s.code),
    ).map((s) => s.rel)
    expect(offenders, "«مَن على المقطوع» إسنادُ جذرٍ لا اسمُ دور").toEqual([])
  })

  it("ولا مقارنةَ دورٍ ولا قائمةَ أدوارٍ مُصلَّبة", () => {
    const offenders = SOURCES.filter((s) =>
      /roles?\.includes|roleId\s*===|\brole\s*===/.test(s.code),
    ).map((s) => s.rel)
    expect(offenders).toEqual([])
  })
})

describe("**G14 — صفرُ رقمٍ تشغيليٍّ صلب**: كلُّ معدّلٍ من السجل، والساعةُ من التقويم", () => {
  /**
   * **دقائقُ الساعة تُشتقّ من مقياس الزمن لا تُكتب رقماً** — وهو أسلوبُ
   * `dailyLog/services/time.ts` نفسُه («صفر رقمٍ في هذا الملفّ»: الحدودُ من مفاتيحَ نصّية).
   * والاختبارُ يثبت شيئين معاً: **القيمةُ صحيحة** (٦٠)، و**الاشتقاقُ قائمٌ** لا ثابتٌ مدسوس.
   */
  it("**الساعةُ ستّون دقيقة — مشتقّةً من التقويم**، فلا رقمَ يُكتب ولا قيمةَ تُخطئ", async () => {
    const { MINUTES_PER_HOUR, minutesToCents } = await import(
      "../../../src/features/payroll/services/rates.js"
    )
    expect(MINUTES_PER_HOUR).toBe(60)
    expect(minutesToCents(90, 400 as never), "ساعةٌ ونصفٌ بأربعمئة للساعة").toBe(600)

    const rates = readFileSync(join(MODULE_DIR, "services/rates.ts"), "utf8")
    expect(rates, "الاشتقاقُ من فرق لحظتين معلَنتين").toContain("ONE_HOUR_MS / ONE_MINUTE_MS")
  })

  /** والقياسُ على **الكود المُجرَّد** — فذكرُ الوسم في توثيقٍ يشرح عطبَه ليس استعمالاً له. */
  it("**ولا وسمَ ثابتٍ صلبٍ في كود الوحدة كلِّه** — لم يبقَ ما يحتاج استثناءً", () => {
    const tagged = SOURCES.flatMap((s) =>
      s.code
        .split("\n")
        .filter((line) => line.includes("hard-constant:"))
        .map((line) => `${s.rel}: ${line.trim()}`),
    )
    expect(tagged).toEqual([])
  })

  it("**وكلُّ معدّلٍ من سجل الإعدادات** — المعرّفاتُ مسرودةٌ في `rates.ts` وحده", () => {
    const rates = SOURCES.find((s) => s.rel === "services/rates.ts")!
    for (const id of [
      "finance.hourly_rate.amount",
      "finance.point_rate.amount",
      "finance.point_rate.per_unit",
      "finance.fixed_salary.amount",
      "finance.currency.base",
    ]) {
      expect(rates.code, `${id} يُقرأ من السجل`).toContain(id)
    }
  })

  /**
   * **§١٣ — ما لم يُقرأ عمداً**: المفتاحان المحجوران لم يُقرآ في سطرٍ واحد. وهو **حارسٌ
   * دائم**: لو قرأهما أحدٌ غداً «التزاماً بالسجل» سقط هذا الاختبار — وهو عينُ السيناريو
   * الذي وصفه CR-021 (**«أوّلُ من يبني وحدةَ الرواتب سيجده فيقرؤه»**).
   */
  it("**ولم يُقرأ مفتاحا الحَجْر المُعلَن** (§١٣) — ولا المفتاحُ المشطوب بـCR-021", () => {
    const quarantined = [
      "finance.entitlement.approval_required",
      "identity.impersonation.read_only",
      "edu.paid_hours.approved_only",
    ]
    const offenders: string[] = []
    for (const source of SOURCES) {
      for (const id of quarantined) {
        if (source.code.includes(id)) offenders.push(`${source.rel} ⟵ ${id}`)
      }
    }
    expect(offenders, "**الختمُ غيرُ مشروط** — ولا إعدادَ يُرخّص تجاوزَه").toEqual([])
  })
})
