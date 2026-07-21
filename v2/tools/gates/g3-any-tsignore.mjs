/** G3 — فحص `any`/`ts-ignore` ضد allowlist (المادة ٢/٢). */
import { walk, read, rel, fail, pass, ROOT, stripCommentsAndStrings } from "./_lib.mjs"
import { join } from "node:path"
import { readFileSync } from "node:fs"

const allowlist = new Set(
  JSON.parse(readFileSync(join(ROOT, "tools/gates/allowlist.any.json"), "utf8")).allowed,
)

const violations = []
for (const file of [...walk(join(ROOT, "src")), ...walk(join(ROOT, "tests"))]) {
  const code = stripCommentsAndStrings(read(file))
  const lines = code.split("\n")
  lines.forEach((line, i) => {
    const at = `${rel(file)}:${i + 1}`
    if (/@ts-ignore|@ts-expect-error/.test(line) && !allowlist.has(at)) {
      violations.push(`${at} — تعطيل فحص الأنواع`)
    }
    if (/(:|<)\s*any\b|\bas\s+any\b/.test(line) && !allowlist.has(at)) {
      violations.push(`${at} — استعمال any`)
    }
  })
}

if (violations.length) fail("G3", "صفر any وصفر ts-ignore خارج القائمة البيضاء", violations)
pass("G3", "صفر any وصفر ts-ignore", `القائمة البيضاء: ${allowlist.size}`)
