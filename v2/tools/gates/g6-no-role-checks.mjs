/**
 * G6 — «لا فحص دور خارج المحرك» (المادة ٤/٤، §٥.٢).
 * السؤال الوحيد المشروع: «هل يملك القدرة X على النطاق Y؟» — ولا مفهوم «مدير» في كود v2.
 */
import { walk, read, rel, fail, pass, ROOT, stripCommentsAndStrings } from "./_lib.mjs"
import { join } from "node:path"

// مجلد المحرك وحده يعرف عن الأدوار؛ والمصفوفة والعالم القانوني بياناتٌ لا فحوص.
const ENGINE = ["src/authorization/", "tools/", "tests/fixtures/", "tests/engine/", "tests/generated/", "tests/world/"]

const PATTERNS = [
  [/\brole\s*===/, "مقارنة دور مباشرة (role ===)"],
  [/\brole\s*!==/, "مقارنة دور مباشرة (role !==)"],
  [/roles\s*\.\s*includes\s*\(/, "roles.includes"],
  [/\bisAdmin\b/, "دالة isAdmin — لا معنى لـ«المدير» في v2 (ت-٥)"],
  [/\bisGlobalAdmin\b/, "دالة isGlobalAdmin (ت-٥)"],
  [/caps\s*\.\s*includes\s*\(\s*""\s*\)/, 'caps.includes("*") — لا رمز شمول في v2 (ت-٦)'],
  [/\brole\s*==\s*/, "مقارنة دور"],
  [/\[\s*""\s*,\s*""\s*\]\s*\.\s*includes\s*\(\s*role/, "قائمة أدوار مُصلَّبة"],
  [/\bROLE_(?:RANK|PRECEDENCE|LIST)\b/, "قائمة أدوار مشتقة في الكود (ث-٣)"],
  [/\b(?:LEADER|STAFF|CUSTODIAN|SUPERVISOR|SUPERVISORY)_ROLES\b/, "قائمة أدوار مُصلَّبة (ث-٣)"],
]

const violations = []
for (const file of [...walk(join(ROOT, "src")), ...walk(join(ROOT, "tests"))]) {
  const r = rel(file)
  if (ENGINE.some((p) => r.startsWith(p))) continue
  const code = stripCommentsAndStrings(read(file))
  code.split("\n").forEach((line, i) => {
    for (const [re, what] of PATTERNS) {
      if (re.test(line)) violations.push(`${r}:${i + 1} — ${what}`)
    }
  })
}

if (violations.length) fail("G6", "لا فحص دور خارج المحرك", violations)
pass("G6", "لا فحص دور خارج المحرك", "نقطة الفرض واحدة")
