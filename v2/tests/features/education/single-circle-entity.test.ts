/**
 * **الاختبارُ الإلزاميّ السادس** (T19) — **ب-٢٨: صفر كيانِ حلقةٍ ثانٍ** — **فحصٌ بنيويّ**.
 *
 * هذه الوحدةُ هي أخطرُ موضعٍ يمكن أن يُبعث فيه مرضُ v1: «على بصيرة» كان **نظاماً كاملاً**
 * له حلقاتُه وطلابُه ومعلّموه بجانب `tahfeez_*` وبجانب `circles`، وجسرٌ خفيّ يخيط الثلاثة
 * (ق-٨٨). فلو أنشأت هذه الوحدةُ كيانَ حلقةٍ أو سجلَّ طلابٍ **ثانياً** لعاد العَرَضُ نفسُه
 * («أضفتُ ٢٠ طالباً وسجلُّ اليوم يقول لا طلاب» — ع-١٩/ع-٢٩) في ثوبٍ جديد.
 *
 * **والدعوى بنيوية فتُقاس بالمحتوى** (درسُ قب-٤٠): لا يكفي أن نَعِد ولا أن نُجري سلوكاً.
 * ويحرس الملفُّ معها **ق-٩٨**: المعهدُ **نوعُ مكانٍ لا كيانٌ إداريّ**.
 */
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const UNIT_DIR = fileURLToPath(new URL("../../../src/features/education", import.meta.url))

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (name.endsWith(".ts")) out.push(path)
  }
  return out
}

function within(path: string): string {
  return relative(UNIT_DIR, path).split(sep).join("/")
}

function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
}

/** الكياناتُ المخزَّنة تعيش في `types.ts` و`data/` — فهذه مساحةُ القياس. */
const STORED = sourceFiles(UNIT_DIR).filter(
  (f) => within(f) === "types.ts" || within(f).startsWith("data/"),
)

describe("**ب-٢٨ — صفر كيانِ حلقةٍ ثانٍ ولا سجلِّ طلابٍ ثانٍ في وحدة التعليم**", () => {
  it("مساحةُ الكيانات المخزَّنة موجودة (وإلا فالفحصُ يمرّ على الفراغ)", () => {
    expect(STORED.length).toBeGreaterThan(0)
  })

  it("**لا كيانَ حلقةٍ ولا تسجيلٍ ولا نوعِ حلقةٍ مخزَّنٌ هنا** — الحلقةُ تُقرأ ولا تُبنى", () => {
    const RIVAL = /\b(?:type|interface)\s+\w*(?:Circle|Enrollment|Student|CircleType)\w*\s*=?\s*\{/
    const declarers = STORED.filter((f) => RIVAL.test(code(f))).map(within)
    expect(declarers, `كيانٌ منافسٌ للحلقة أو للتسجيل: ${declarers.join(" · ")}`).toEqual([])
  })

  it("**ولا مستودعٌ يكتب حلقةً أو التحاقاً**: صفر كاتبٍ لسجلَّي `circles` في هذه الوحدة", () => {
    const WRITERS = /\.(?:saveCircle|appendEnrollment|stampLeft|saveType)\s*\(/
    const offenders = sourceFiles(UNIT_DIR).filter((f) => WRITERS.test(code(f))).map(within)
    expect(offenders, `كتابةٌ في سجل الحلقات: ${offenders.join(" · ")}`).toEqual([])
  })

  it("**والوصولُ إلى الحلقة عبر منفذٍ معلن** — لا استيرادَ من طبقة بياناتها ولا من مستودعها", () => {
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      if (within(file) === "services/bindings.ts") continue
      code(file)
        .split("\n")
        .forEach((line, i) => {
          // **بلا محرفِ اقتباسٍ داخل نمطٍ** — فمُجرِّدُ السلاسل في البوابات يُسيء قراءتَه.
          if (/\bfrom\b/.test(line) && /circles\//.test(line)) {
            offenders.push(`${within(file)}:${i + 1}`)
          }
        })
    }
    expect(
      offenders,
      `استيرادٌ من وحدة الحلقات خارج ملفّ الوصل: ${offenders.join(" · ")}`,
    ).toEqual([])
  })

  it("**ولا جسرَ ولا مزامنةَ ولا توأمة** (ق-٨٨ متقاعدةٌ لا منقولة)", () => {
    const forbidden = ["bridge", "sync", "twin", "mirror", "propagate"]
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      const lowered = code(file).toLowerCase()
      for (const token of forbidden) {
        if (new RegExp(`\\b${token}\\w*\\s*[(:]`).test(lowered)) {
          offenders.push(`${within(file)} ⟵ ${token}`)
        }
      }
    }
    expect(offenders, `مقبضُ جسرٍ في وحدة التعليم: ${offenders.join(" · ")}`).toEqual([])
  })

  /**
   * **CR-016 — الحارسُ اشتدّ ولم يُخفَّف**: كان يقول «كاتبُ الدرس واحدٌ **هنا**»، فصار يقول
   * «**لا كاتبَ للدرس هنا أصلاً**، والتفويضُ من ملفٍّ واحد». فالكيانُ واحدٌ في موطنه، وهذه
   * الوحدةُ طبقةُ قواعدَ فوقه.
   */
  it("**ولا كاتبَ للدرس هنا أصلاً** (CR-016) — والتفويضُ من `services/lessons.ts` وحده", () => {
    const lessonWriters = sourceFiles(UNIT_DIR)
      .filter((f) => /\.(?:saveLesson|saveAttendance|savePhoto|upsertSession)\s*\(/.test(code(f)))
      .map(within)
    expect(lessonWriters, `مستودعُ درسٍ ثانٍ في وحدة التعليم: ${lessonWriters.join(" · ")}`).toEqual([])

    // **مَن يُفوّض الكتابةَ إلى موطن الكيان؟ ملفٌّ واحدٌ لا أكثر** — فلا مساران يكتبان يوماً.
    const delegators = sourceFiles(UNIT_DIR)
      .filter((f) => within(f) !== "services/dayLogPort.ts" && /\bdays\.record\s*\(/.test(code(f)))
      .map(within)
    expect(delegators).toEqual(["services/lessons.ts"])

    const correctionWriters = sourceFiles(UNIT_DIR)
      .filter((f) => /\.saveCorrection\s*\(/.test(code(f)))
      .map(within)
    expect([...new Set(correctionWriters)]).toEqual(["services/progress.ts"])
  })

  it("**ولا وحدةَ ميزةٍ ثانيةٌ للتعليم**: لا مجلدَ باسم نظامٍ من أنظمة v1 الثلاثة", () => {
    const featuresDir = join(UNIT_DIR, "..")
    const modules = readdirSync(featuresDir).filter((d) =>
      statSync(join(featuresDir, d)).isDirectory(),
    )
    const rivals = modules.filter((m) => /^(tahfeez|alabaseera|baseera|halaqa|halaqat)$/i.test(m))
    expect(rivals, `وحدةُ نظامٍ تعليميٍّ ثانية: ${rivals.join(" · ")}`).toEqual([])
    expect(modules).toContain("circles")
    expect(modules).toContain("education")
  })
})

describe("**ق-٩٨ — المعهدُ نوعُ مكانٍ لا كيانٌ إداريّ**", () => {
  it("لا كيانَ مكانٍ/معهدٍ مخزَّنٌ في الوحدة — المكانُ **وسمٌ على الدرس** لا كيانٌ يُشرَف عليه", () => {
    const VENUE_ENTITY = /\b(?:type|interface)\s+\w*(?:Venue|Institute|Campus|Place)\w*\s*=?\s*\{/
    const declarers = STORED.filter((f) => VENUE_ENTITY.test(code(f))).map(within)
    expect(declarers, `كيانُ مكانٍ إداريّ: ${declarers.join(" · ")}`).toEqual([])
  })

  it("**والنطاقُ لا يُشتقّ من المكان أبداً** — كلُّ حارسٍ يشتقّ نطاقَه من وحدة الحلقة المخزَّنة", () => {
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      code(file)
        .split("\n")
        .forEach((line, i) => {
          if (/unitScope\s*\(\s*[^)]*venue/i.test(line) || /venue\w*\s*\.\s*path\b/i.test(line)) {
            offenders.push(`${within(file)}:${i + 1} — ${line.trim()}`)
          }
        })
    }
    expect(offenders, `نطاقٌ مشتقٌّ من المكان: ${offenders.join(" · ")}`).toEqual([])
  })
})

describe("**G22 نظيراً — صفر منطقِ اعتمادٍ في وحدة التعليم** (الشقُّ المحليّ؛ وحدُّ المحرّك في مجلده)", () => {
  it("لا مفردةَ توجيهٍ ولا فعلَ بتٍّ ولا حالةَ اعتمادٍ مخزَّنة في أيّ ملفٍّ من الوحدة", () => {
    const forbidden = ["nessa", "approvalstate", "approvalroute", "approvalrequest"]
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      const lowered = code(file).toLowerCase()
      for (const token of forbidden) {
        if (lowered.includes(token)) offenders.push(`${within(file)} ⟵ ${token}`)
      }
    }
    expect(offenders, `مفردةُ اعتمادٍ في وحدة التعليم: ${offenders.join(" · ")}`).toEqual([])
  })

  it("**ولا حقلَ حالةِ اعتمادٍ في كيانات الوحدة** — الحالُ يصل **منفذاً** لا يُخزَّن", () => {
    const offenders: string[] = []
    for (const file of STORED) {
      code(file)
        .split("\n")
        .forEach((line, i) => {
          if (/readonly\s+\w*(?:approved|approval|submitted|locked)\w*\s*[?:]/i.test(line)) {
            offenders.push(`${within(file)}:${i + 1} — ${line.trim()}`)
          }
        })
    }
    expect(offenders, `حالةُ اعتمادٍ مخزَّنة: ${offenders.join(" · ")}`).toEqual([])
  })
})
