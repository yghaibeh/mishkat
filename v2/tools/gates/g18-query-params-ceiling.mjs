/**
 * G18 — لا استعلام بأكثر من ٨٠ معاملاً مربوطاً (ADR-001 ع-٧، يأتمت درس ت-٣).
 * حدّ متغيرات SQLite في D1 (~١٠٠) كسر لوحة الإشراف حياً عند ١٢٨ حلقة.
 */
import { walk, read, rel, fail, pass, ROOT, stripCommentsOnly } from "./_lib.mjs"
import { join } from "node:path"

const CEILING = 80
const violations = []

for (const file of walk(join(ROOT, "src"))) {
  const code = stripCommentsOnly(read(file))
  code.split("\n").forEach((line, i) => {
    const at = `${rel(file)}:${i + 1}`
    const placeholders = (line.match(/\?/g) ?? []).length
    if (placeholders > CEILING) {
      violations.push(`${at} — ${placeholders} معاملاً مربوطاً (السقف ${CEILING})`)
    }
    // `IN (...)` بقائمة غير مُقطَّعة: يجب أن تمرّ بمُعين التقطيع.
    if (/\bIN\s*\(\s*\$?\{?[\w.]*(?:ids|Ids|list)\b/.test(line) && !/chunk/i.test(code)) {
      violations.push(`${at} — IN(...) بقائمة معرّفات بلا تقطيع (ت-٣)`)
    }
  })
}

if (violations.length) fail("G18", "سقف معاملات الاستعلام", violations)
pass("G18", "سقف معاملات الاستعلام", `الحد ${CEILING}`)
