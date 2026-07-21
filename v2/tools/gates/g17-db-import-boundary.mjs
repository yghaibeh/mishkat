/** G17 — لا استيراد لمكتبة قاعدة البيانات خارج طبقة البيانات (ADR-001 ع-١/ع-٢، قب-١٤). */
import { walk, read, rel, fail, pass, ROOT, stripCommentsOnly } from "./_lib.mjs"
import { join } from "node:path"

const DB_LAYER = "src/db/"
const FORBIDDEN = [
  [/\bdrizzle-orm\b/, "استيراد Drizzle"],
  [/\b@libsql\/client\b/, "استيراد عميل libsql"],
  [/\bD1Database\b|\benv\.DB\b/, "واجهة D1 مباشرة"],
  [/\.\s*batch\s*\(/, "واجهة D1 الخاصة (batch) — بلا مقابل في Postgres (ع-٢)"],
  [/\bwithSession\s*\(|\bbookmark\b/, "واجهة D1 الخاصة (Sessions/bookmarks) — ع-٢"],
  [/\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/, "SQL خام (ع-١)"],
]

const violations = []
for (const file of [...walk(join(ROOT, "src"))]) {
  const r = rel(file)
  if (r.startsWith(DB_LAYER)) continue
  const code = stripCommentsOnly(read(file))
  code.split("\n").forEach((line, i) => {
    for (const [re, what] of FORBIDDEN) {
      if (what && re.test(line)) violations.push(`${r}:${i + 1} — ${what}`)
    }
  })
}

if (violations.length) fail("G17", "حدود طبقة البيانات", violations)
pass("G17", "حدود طبقة البيانات", "لا استيراد لمكتبة القاعدة خارج db/")
