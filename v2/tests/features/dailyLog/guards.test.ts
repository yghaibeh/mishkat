/**
 * حرّاسُ التسليم البنيويّة — تُقاس على **المحتوى** لا على الوعد (قب-٢٣).
 *
 *  ١. **صفر رقمٍ تشغيليٍّ صلب** (G14) — ولا أثرَ لمقياس ٥٦/٤٠ الساقط (قب-١١): كلُّ عتبةٍ
 *     وسقفٍ وهدفٍ وتوقيتٍ من سجل الإعدادات، فتغييرُ السياسة ضبطٌ لا نشرُ كود.
 *  ٢. **صفر قدرةٍ مخترعة**: كلُّ ما تعلنه سطوحُ الوحدة موجودٌ في الكتالوج الذهبيّ.
 *
 * وحدُّ المحرّك (G22: صفرُ منطقِ اعتماد) يعيش حارسُه في `tests/features/approval/` —
 * فمفرداتُ فحصِه نفسُها لا يجوز أن تُكتب خارج مجلد المحرّك.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { CAP_IDS } from "../../../src/authorization/generated/capabilities.generated.js"

const MODULE_DIR = join(process.cwd(), "src/features/dailyLog")

function sourcesOf(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...sourcesOf(full))
    else if (name.endsWith(".ts")) out.push(full)
  }
  return out
}

/** تجريدُ التعليقات (نظيرُ G6/G14): التوثيقُ لا يُدان، والمُدان كودٌ يُنفَّذ. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) ?? []).length))
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

const FILES = sourcesOf(MODULE_DIR)

describe("G14/قب-١١ — صفرُ رقمٍ تشغيليٍّ صلب، ولا أثرَ لمقياس ٥٦/٤٠", () => {
  it("**لا `56` ولا `40` في أيّ ملفٍّ من الوحدة** — المقياسُ الصلب ساقطٌ نصاً وكوداً", () => {
    const hits: string[] = []
    for (const file of FILES) {
      const code = codeOnly(readFileSync(file, "utf8"))
      code.split("\n").forEach((line, i) => {
        if (/(?<![\w.])(56|40)(?![\w.])/.test(line)) hits.push(`${file}:${i + 1} — ${line.trim()}`)
      })
    }
    expect(hits, hits.join(" · ")).toEqual([])
  })

  it("**ولا رقمَ عملٍ خارج القائمة البيضاء** (نظيرُ G14 مقصوراً على هذه الوحدة)", () => {
    const allowed = new Set(["0", "1", "-1", "2", "100"])
    const hits: string[] = []
    for (const file of FILES) {
      const code = codeOnly(readFileSync(file, "utf8")).replace(/"[^"\\]*"|'[^'\\]*'|`[^`\\]*`/g, '""')
      code.split("\n").forEach((line, i) => {
        for (const m of line.matchAll(/(?<![\w.])(\d[\d_]*(?:\.\d+)?)(?![\w.])/g)) {
          if (!allowed.has(m[1]!.replace(/_/g, ""))) hits.push(`${file}:${i + 1} — ${m[1]}`)
        }
      })
    }
    expect(hits, hits.join(" · ")).toEqual([])
  })

  it("**وكلُّ عتبةٍ تُقرأ من سجل الإعدادات**: الإعداداتُ المستهلَكة معلنةٌ بأسمائها في الكود", () => {
    const source = FILES.map((f) => readFileSync(f, "utf8")).join("\n")
    for (const id of [
      "points.weekly_target",
      "points.participation_min_pct",
      "points.participation_fail_closed",
      "points.tier.excellent_pct",
      "points.tier.below_pct",
      "time.zone",
      "time.week_start_day",
      "records.allow_future_dating",
    ]) {
      expect(source, `الإعداد ${id} غيرُ مستهلَك`).toContain(`"${id}"`)
    }
  })
})

describe("صفرُ قدرةٍ مخترعة — كلُّ ما تعلنه سطوحُ الوحدة من الكتالوج الذهبيّ", () => {
  it("كلُّ قدرةٍ معلنةٍ على دالةِ خادمٍ أو عنصرِ واجهةٍ موجودةٌ في الكتالوج", () => {
    const consumed = new Set<string>()
    for (const file of FILES) {
      const source = readFileSync(file, "utf8")
      for (const m of source.matchAll(/capability:\s*"([\w.]+)"/g)) consumed.add(m[1]!)
      for (const m of source.matchAll(/capabilities:\s*\[([^\]]*)\]/g)) {
        for (const c of m[1]!.matchAll(/"([\w.]+)"/g)) consumed.add(c[1]!)
      }
    }
    expect(consumed.size).toBeGreaterThan(0)
    for (const cap of consumed) expect(CAP_IDS, cap).toContain(cap)
  })
})
