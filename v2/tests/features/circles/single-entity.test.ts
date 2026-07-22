/**
 * **الاختبارُ الإلزاميّ الأول** (T16) — ب-٢٨: **كيانٌ واحدٌ بلا جسر**، يُقاس بالمحتوى لا بالوعد
 * (نظيرُ حارس «صفر رصيدٍ مخزَّن» ق-٦٠ في الصندوق، وحارس «مسارٌ واحدٌ للحيازة» ب-٢٩ في العُهد).
 *
 * العطبُ في v1 (ز-١، ق-٨٨): **ثلاثةُ أنظمةٍ منفصلة** («على بصيرة» × `tahfeez_*` × `circles`)
 * يربطها **جسرُ مزامنةٍ خفيّ** (`studentBridge`). وفي v2 لا يكفي أن نَعِد: هذا الحارسُ يمسح
 * **مصدرَ `v2/src` كلَّه** فيفشل عند:
 *  ١. أيّ كيانِ حلقةٍ **ثانٍ** خارج `features/circles/types.ts`.
 *  ٢. أيّ مفردةٍ من نظامَي v1 المنفصلَين (`tahfeez` · `alaBaseera`/`baseera` · `halaqa`).
 *  ٣. أيّ دالةِ **جسرٍ أو مزامنةٍ أو توأمة** (ق-٨٨ متقاعد — عقدُ الوحدة §٩).
 *  ٤. أيّ **عدّادٍ مخزَّن** في كيانات الوحدة أو مستودعها (الاختبارُ الإلزاميّ الرابع، شقُّه البنيويّ).
 */
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const UNIT_DIR = fileURLToPath(new URL("../../../src/features/circles", import.meta.url))
const SRC_DIR = fileURLToPath(new URL("../../../src", import.meta.url))

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (name.endsWith(".ts")) out.push(path)
  }
  return out
}

function within(base: string, path: string): string {
  return relative(base, path).split(sep).join("/")
}

/** يُجرَّد التعليقُ كي لا يُدان التوثيقُ بما يشرحه (نفسُ منهج البوابات). */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
}

/**
 * **الكياناتُ المخزَّنة** تعيش في `types.ts` و`data/` لكل وحدة — فهذه هي المساحةُ التي يُقاس
 * فيها «كم كياناً للحلقة؟». وما في `services/` أو `screens/` نماذجُ عرضٍ مشتقّةٌ لا كيانات.
 */
function storedEntityFiles(featuresDir: string): string[] {
  return sourceFiles(featuresDir).filter((f) => {
    const r = within(featuresDir, f)
    return /(^|\/)types\.ts$/.test(r) || /(^|\/)data\//.test(r)
  })
}

describe("ب-٢٨/١ — **كيانُ الحلقة واحدٌ في المصدر كلِّه**", () => {
  const FEATURES_DIR = join(SRC_DIR, "features")

  it("لا كيانَ حلقةٍ مخزَّنٌ خارج `features/circles/types.ts` — لا ثلاثةُ أنظمة", () => {
    // اسمٌ يدلّ على نظام حلقةٍ بأيٍّ من ألسنة v1 الثلاثة.
    const CIRCLE_ENTITY = /\b(?:type|interface)\s+\w*(?:Circle|Tahfeez|AlaBaseera|Baseera|Halaqa)\w*\s*=\s*\{/
    const declarers = storedEntityFiles(FEATURES_DIR)
      .filter((f) => CIRCLE_ENTITY.test(code(f)))
      .map((f) => within(FEATURES_DIR, f))
    expect(declarers, `كيانُ حلقةٍ مخزَّنٌ في: ${declarers.join(" · ")}`).toEqual([
      "circles/types.ts",
    ])
  })

  it("**ولا وحدةَ ميزةٍ ثانيةٌ للحلقة**: لا `tahfeez` ولا `alaBaseera` ولا `halaqat` مجلداً", () => {
    const modules = readdirSync(FEATURES_DIR).filter((d) =>
      statSync(join(FEATURES_DIR, d)).isDirectory(),
    )
    const rivals = modules.filter((m) =>
      /^(tahfeez|alabaseera|baseera|halaqa|halaqat|circle)$/i.test(m) && m !== "circles",
    )
    expect(rivals, `وحدةُ حلقةٍ ثانية: ${rivals.join(" · ")}`).toEqual([])
    expect(modules).toContain("circles")
  })

  it("**ونوعُ الحلقة معرّفٌ بياناتٍ لا اسمُ نظام**: صفر مفردةٍ من ألسنة v1 في كود الوحدة", () => {
    // في v1 كان «التحفيظ» و«على بصيرة» **أسماءَ أنظمةٍ** في الكود (`tahfeez_*`، `/ala-baseera`).
    // وفي v2 هي **قيمُ صفوفٍ في كتالوج البيانات** — فلا تظهر في كود الوحدة إطلاقاً.
    const legacy = ["tahfeez", "alabaseera", "halaqa", "rashidi", "baseera"]
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      const lowered = code(file).toLowerCase()
      for (const token of legacy) {
        if (lowered.includes(token)) offenders.push(`${within(UNIT_DIR, file)} ⟵ ${token}`)
      }
    }
    expect(offenders, `نوعٌ مُصلَّبٌ في الكود بدل الكتالوج: ${offenders.join(" · ")}`).toEqual([])
  })
})

describe("ق-٨٨ — **الجسرُ متقاعدٌ لا منقول**: صفر مقبضِ مزامنةٍ في الوحدة", () => {
  it("لا دالةَ جسرٍ ولا مزامنةٍ ولا توأمةٍ ولا مرآةٍ في وحدة الحلقات", () => {
    const forbidden = ["bridge", "sync", "twin", "mirror", "propagate"]
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      const lowered = code(file).toLowerCase()
      for (const token of forbidden) {
        if (new RegExp(`\\b${token}\\w*\\s*[(:]`).test(lowered)) {
          offenders.push(`${within(UNIT_DIR, file)} ⟵ ${token}`)
        }
      }
    }
    expect(offenders, `مقبضُ جسرٍ في وحدة الحلقات: ${offenders.join(" · ")}`).toEqual([])
  })

  it("وكاتبُ الحلقة واحدٌ (`services/circles.ts`) وكاتبُ العضوية واحدٌ (`services/enrollment.ts`)", () => {
    const circleWriters = sourceFiles(UNIT_DIR).filter((f) => /\.saveCircle\s*\(/.test(code(f)))
    expect(circleWriters.map((f) => within(UNIT_DIR, f))).toEqual(["services/circles.ts"])

    const enrollmentWriters = sourceFiles(UNIT_DIR).filter((f) =>
      /\.(appendEnrollment|stampLeft)\s*\(/.test(code(f)),
    )
    expect([...new Set(enrollmentWriters.map((f) => within(UNIT_DIR, f)))]).toEqual([
      "services/enrollment.ts",
    ])
  })

  it("ولا سطرَ منطقِ اعتمادٍ في الوحدة (G22 نظيراً — اعتمادُ الدرس ق-٨٥ خارج النطاق)", () => {
    const FORBIDDEN = ["approve", "approver", "breakglass", "nessa"]
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      const lowered = code(file).toLowerCase()
      for (const token of FORBIDDEN) {
        if (new RegExp(`\\b${token}\\w*\\s*[(:]`).test(lowered)) offenders.push(within(UNIT_DIR, file))
      }
    }
    expect(offenders).toEqual([])
  })
})

describe("ع-١٩/ع-٢٩ — **صفر عدّادٍ مخزَّن**: لا يوجد ما يتباعد عن الواقع أصلاً", () => {
  it("`types.ts` و`data/` بلا حقلٍ يحفظ عدداً (`count`/`total`/`tally`)", () => {
    const stored = sourceFiles(UNIT_DIR).filter(
      (f) => within(UNIT_DIR, f) === "types.ts" || within(UNIT_DIR, f).startsWith("data/"),
    )
    expect(stored.length).toBeGreaterThan(0)

    const offenders: string[] = []
    for (const file of stored) {
      code(file)
        .split("\n")
        .forEach((line, i) => {
          if (/readonly\s+\w*(?:[Cc]ount|[Tt]otal|[Tt]ally|[Nn]umberOf)\w*\s*[?:]/.test(line)) {
            offenders.push(`${within(UNIT_DIR, file)}:${i + 1} — ${line.trim()}`)
          }
        })
    }
    expect(offenders, `عدّادٌ مخزَّن: ${offenders.join(" · ")}`).toEqual([])
  })

  it("**ولا مفتاحَ تفعيلٍ للنوع** في الوحدة كلِّها — «تفعيلُ القسم» هو عينُ ع-٨", () => {
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      code(file)
        .split("\n")
        .forEach((line, i) => {
          if (/\b(?:typeEnabled|enabledTypes|activeTypes|isTypeActive|sectionEnabled)\b/.test(line)) {
            offenders.push(`${within(UNIT_DIR, file)}:${i + 1} — ${line.trim()}`)
          }
        })
    }
    expect(offenders, `مفتاحُ تفعيلِ نوعٍ: ${offenders.join(" · ")}`).toEqual([])
  })
})

/**
 * **ع-٨ يُحرَس بالبنية لا بالنيّة** — وهذا الحارسُ وُلد من **كسرٍ يدويٍّ نجح**: زُرع حقلُ
 * `active` في `CircleType` وشرطُ `active === false` في الإنشاء، **فلم يسقط اختبارٌ واحد**،
 * لأنّ الفحوصَ السلوكية تقيس ما تبذره هي (والبذرةُ لا تكتب الحقل أصلاً).
 *
 * والدرسُ نفسُه المسجَّل في قب-٣٤ («الثابتُ الذي لا يسقط أول مرة كان محروساً بالنيّة»):
 * ما دام «لا مفتاحَ تفعيل» **دعوى بنيوية**، فقياسُها **على المحتوى** لا على السلوك.
 */
describe("ع-٨ — **مفتاحُ تفعيلِ النوع مستحيلٌ بنيوياً** (يُقاس بالمحتوى لا بالبذرة)", () => {
  /** جسمُ تعريفِ نوعٍ في `types.ts` — يُقتطع بالاسم لا بالسطر، فلا يتعلّق بالتنسيق. */
  function typeBody(): string {
    const source = code(join(UNIT_DIR, "types.ts"))
    const at = source.indexOf("export type CircleType = {")
    expect(at, "تعريفُ `CircleType` غير موجود في `types.ts`").toBeGreaterThan(-1)
    return source.slice(at, source.indexOf("}", at))
  }

  it("`CircleType` ثلاثةُ حقولٍ لا رابعَ لها — ولا حقلَ حالةٍ فيها إطلاقاً", () => {
    const fields = [...typeBody().matchAll(/readonly\s+(\w+)\s*[?:]/g)].map((m) => m[1])
    expect(fields.sort()).toEqual(["ar", "id", "tenantId"])
    for (const field of fields) {
      expect(/active|enabled|state|status|visible|published/i.test(field ?? ""), field).toBe(false)
    }
  })

  it("**ولا سطرَ يقرأ حالةَ نوعٍ** في الوحدة كلِّها — فلا سؤالَ «أمفعَّل؟» يُطرح أصلاً", () => {
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      code(file)
        .split("\n")
        .forEach((line, i) => {
          // قراءةُ حالةٍ عن نوعٍ: `type.active` · `foundType.enabled` · `t.isActive` …
          if (/\b\w*[Tt]ype\w*\.(?:active|enabled|isActive|state|status|visible)\b/.test(line)) {
            offenders.push(`${within(UNIT_DIR, file)}:${i + 1} — ${line.trim()}`)
          }
        })
    }
    expect(offenders, `سؤالُ «أمفعَّل؟» عن نوعٍ: ${offenders.join(" · ")}`).toEqual([])
  })

  it("**والكتالوجُ لا يُرشَّح بحالة**: `allTypes` تعيد كلَّ صفٍّ في المستودع بلا استثناء", () => {
    const catalog = code(join(UNIT_DIR, "services/catalog.ts"))
    expect(/\.filter\s*\(/.test(catalog), "مرشّحٌ في كتالوج الأنواع — قد يخفي نوعاً قائماً").toBe(
      false,
    )
  })
})
