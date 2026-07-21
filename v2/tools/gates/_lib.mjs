/** أدوات مشتركة للبوابات — المادة ٠: لا قاعدة بلا بوابة. */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, extname } from "node:path"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

const SKIP_DIRS = new Set(["node_modules", "coverage", ".git", "dist", "__violations__"])

export function walk(dir, exts = [".ts", ".tsx", ".mjs", ".js"]) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full, exts))
    else if (exts.includes(extname(full))) out.push(full)
  }
  return out
}

export function read(file) {
  return readFileSync(file, "utf8")
}

export function rel(file) {
  return relative(ROOT, file)
}

/** يزيل التعليقات والسلاسل النصية حتى لا تُحسب أمثلةُ التوثيق مخالفاتٍ. */
export function stripCommentsAndStrings(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

/**
 * يزيل التعليقات **ويُبقي السلاسل** — لازمٌ لبوابات تفحص مسار الاستيراد أو نص SQL،
 * فتلك تعيش داخل سلاسل نصية أصلاً؛ وإزالتها كانت تُعمي البوابة عن المخالفة نفسها.
 */
export function stripCommentsOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
}

export function fail(gate, title, violations) {
  console.error(`\n✗ ${gate} — ${title}`)
  for (const v of violations) console.error(`   • ${v}`)
  console.error(`\n   المخالفات: ${violations.length}\n`)
  process.exit(1)
}

export function pass(gate, title, note = "") {
  console.log(`✓ ${gate} — ${title}${note ? ` (${note})` : ""}`)
}
