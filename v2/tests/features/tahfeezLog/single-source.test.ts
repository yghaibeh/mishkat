/**
 * **الاختباران الإلزاميّان السابع والثامن (شقُّهما البنيويّ)** (T18):
 *  ٧. **صفر كيانِ حلقةٍ ثانٍ** (ب-٢٨) — **فحصٌ بنيويّ يثبت الاتصال بنموذج T16 لا استنساخَه**.
 *  ٨. **صفر عدّادٍ مخزَّن** للتقدّم أو الحضور — يُقاس **بالمحتوى** لا بالوعد.
 *
 * ودرسُ قب-٤٠ مطبَّقٌ هنا نصاً: *دعوى بنيوية تُقاس بالمحتوى؛ وقياسُها بالسلوك يُنتج حارساً
 * يمرّ على البذرة ويفوته الواقع.* فهذا الحارسُ **يقرأ المصدرَ نفسَه**.
 */
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const UNIT_DIR = fileURLToPath(new URL("../../../src/features/tahfeezLog", import.meta.url))

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

/** يُجرَّد التعليقُ كي لا يُدان التوثيقُ بما يشرحه (نفسُ منهج البوابات). */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
}

/** الكياناتُ المخزَّنة تعيش في `types.ts` و`data/` — فهذه مساحةُ قياس «كم كياناً؟». */
function storedFiles(): string[] {
  return sourceFiles(UNIT_DIR).filter(
    (f) => within(f) === "types.ts" || within(f).startsWith("data/"),
  )
}

describe("**ب-٢٨/٧ — التعلّقُ بنموذج T16 لا استنساخُه**", () => {
  it("**لا كيانَ حلقةٍ ولا تسجيلٍ مخزَّنٌ في هذه الوحدة** — بل مراجعُ إليهما", () => {
    const RIVAL_ENTITY =
      /\b(?:type|interface)\s+\w*(?:Circle|Tahfeez|AlaBaseera|Baseera|Halaqa|Enrollment|Student)\w*\s*=\s*\{/
    const offenders = storedFiles()
      .filter((f) => RIVAL_ENTITY.test(code(f)))
      .map(within)
    expect(offenders, `كيانٌ منافسٌ لنموذج T16 في: ${offenders.join(" · ")}`).toEqual([])
  })

  it("**ولا نسخةَ حقلٍ من كيان الحلقة**: لا اسمَ حلقةٍ ولا سعةَ ولا معلّمَ ولا مسارَ وحدةٍ مخزَّن", () => {
    // (`typeId` في المادة الإثرائية **مرجعٌ** إلى كتالوج T16 لا نسخةُ نوعِ حلقة — فليس منسوخاً.)
    const COPIED_FIELD = /\b(?:nameAr|capacity|teacherPersonId|unitPath|archivedAt)\s*:/
    const offenders: string[] = []
    for (const file of storedFiles()) {
      code(file)
        .split("\n")
        .forEach((line, i) => {
          if (COPIED_FIELD.test(line)) offenders.push(`${within(file)}:${i + 1} — ${line.trim()}`)
        })
    }
    expect(offenders, `حقلٌ منسوخٌ من كيان الحلقة: ${offenders.join(" · ")}`).toEqual([])
  })

  it("**والاتصالُ مُثبَتٌ لا مُدَّعى**: مِلفٌّ واحدٌ في الوحدة يستورد من `features/circles/`", () => {
    const importers = sourceFiles(UNIT_DIR)
      .filter((f) => /from\s+"[^"]*\.\.\/circles\//.test(code(f)))
      .map(within)
    // واحدٌ لا أكثر: **محوّلُ المنفذ** — فلا تتسرّب معرفةُ نموذج T16 إلى الخدمات.
    expect(importers).toEqual(["services/circlesPort.ts"])
  })

  it("**ولا جسرَ ولا مزامنةَ ولا توأمة** (ق-٨٨ متقاعد) — لا امتناعاً بل بغياب المقبض", () => {
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
    expect(offenders, `مقبضُ جسرٍ: ${offenders.join(" · ")}`).toEqual([])
  })

  it("**ولا سطرَ منطقِ اعتمادٍ** (G22 نظيراً — اعتمادُ الدرس ق-٨٥ خارج النطاق وقد رُفع)", () => {
    const FORBIDDEN = ["approve", "approver", "breakglass", "nessa"]
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      const lowered = code(file).toLowerCase()
      for (const token of FORBIDDEN) {
        if (new RegExp(`\\b${token}\\w*\\s*[(:]`).test(lowered)) offenders.push(within(file))
      }
    }
    expect(offenders).toEqual([])
  })

  it("**وكاتبُ الجلسة واحدٌ** (`services/sessions.ts`) — لا مسارَ ثانٍ يكتب يوماً", () => {
    const writers = sourceFiles(UNIT_DIR)
      .filter((f) => /\.upsertSession\s*\(/.test(code(f)))
      .map(within)
    expect(writers).toEqual(["services/sessions.ts"])
  })
})

describe("**٨/بنيوياً — صفر عدّادٍ مخزَّن** للتقدّم أو الحضور", () => {
  it("`types.ts` و`data/` بلا حقلٍ يحفظ عدداً أو نسبةً أو متوسّطاً", () => {
    expect(storedFiles().length).toBeGreaterThan(0)
    const COUNTER =
      /\b(?:count|total|tally|attendanceCount|presentCount|average|avg|pct|percent|rate|score|streak)\w*\s*:/i
    const offenders: string[] = []
    for (const file of storedFiles()) {
      // `ayahCount`/`pageCount` **حدودُ مرجعٍ ثابتة** لا عدّاداتِ تقدّمٍ تتغيّر — تُستثنى بالاسم.
      code(file)
        .split("\n")
        .forEach((line, i) => {
          if (/\b(?:ayahCount|pageCount)\s*:/.test(line)) return
          if (COUNTER.test(line)) offenders.push(`${within(file)}:${i + 1} — ${line.trim()}`)
        })
    }
    expect(offenders, `عدّادٌ مخزَّن: ${offenders.join(" · ")}`).toEqual([])
  })

  it("**ولا رقمَ تشغيليٍّ صلبٌ في الخدمات** (G14 نظيراً): كلُّ حدٍّ ونسبةٍ من سجل الإعدادات", () => {
    const services = sourceFiles(UNIT_DIR).filter((f) => within(f).startsWith("services/"))
    expect(services.length).toBeGreaterThan(0)
    const offenders: string[] = []
    for (const file of services) {
      const stripped = code(file)
        .replace(/`(?:\\.|[^`\\])*`/g, '""')
        .replace(/"(?:\\.|[^"\\])*"/g, '""')
      stripped.split("\n").forEach((line, i) => {
        for (const m of line.matchAll(/(?<![\w.])(\d[\d_]*(?:\.\d+)?)(?![\w.])/g)) {
          if (["0", "1", "-1", "2", "100"].includes(m[1]!)) continue
          offenders.push(`${within(file)}:${i + 1} — «${m[1]}»`)
        }
      })
    }
    expect(offenders, `رقمٌ تشغيليٌّ صلب: ${offenders.join(" · ")}`).toEqual([])
  })

  it("**ولا قائمةَ سورٍ ولا اسمَ سورةٍ في الكود** — الكتالوجُ بياناتٌ مرجعية (ق-٨٩/قب-٢٢)", () => {
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      const src = code(file)
      for (const token of ["الفاتحة", "البقرة", "الناس", "SURAHS", "SURAH_LIST"]) {
        if (src.includes(token)) offenders.push(`${within(file)} ⟵ ${token}`)
      }
    }
    expect(offenders, `قائمةٌ مسرودةٌ في الكود: ${offenders.join(" · ")}`).toEqual([])
  })
})
