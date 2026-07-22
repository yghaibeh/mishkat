/**
 * G10 — الهجرات: على قاعدةٍ نظيفة **و**على بيانات v1 منقولة (المادة ٧/٢)،
 * **ومفتاحُ التوجيه على كلِّ جدولِ بيانات** (ADR-001 ع-٥ — نقطةُ اللاعودة).
 *
 * ثلاثةُ أوجهٍ لا وجهٌ واحد:
 *  ١. **شكلُ الهجرات**: مرقّمةٌ بأربع خانات، بلا رقمٍ مكرّر، ولها اختبارات.
 *  ٢. **حارسُ مفتاح التوجيه**: يقرأ الهجرات **ويشتقّ قائمةَ الجداول من المخطط نفسِه**
 *     (CR-011/قب-٣٦: بوابةٌ تُسرد لها الحقيقةُ تتخلّف حتماً). كلُّ جدولٍ يحمل `tenant_id`
 *     يجب أن يحمل `unit_path` **وفهرساً على (tenant_id, unit_path)**؛ وجدولٌ يحمل
 *     `unit_path` بلا `tenant_id` مخالفةٌ كذلك — **فلا صنفَ ثالثٌ يفلت من الحكم**.
 *  ٣. **الاختبارُ يجري فعلاً**: تُشغَّل `tests/migrations` — فلا تكون البوابةُ إحصاءَ ملفات.
 *     وقبل هذه المهمة كانت تقول «لا هجرات بعد» أبداً: **بوابةٌ نائمة**.
 *
 * ولهجةُ القاسم المشترك محروسةٌ هنا (ع-٣): لا `JSONB` ولا فهرسٌ جزئيّ ولا `AUTOINCREMENT`
 * — كلفةُ اكتشافها بعد الدمج هجرةُ بياناتٍ لا تصحيحُ سطر.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT, fail, pass } from "./_lib.mjs"

const migrationsDir = join(ROOT, "src/db/migrations")
const testsDir = join(ROOT, "tests/migrations")

if (!existsSync(migrationsDir)) {
  pass("G10", "الهجرات ومفتاح التوجيه", "لا هجرات بعد — تُفعَّل مع أول هجرة")
  process.exit(0)
}

const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()
const violations = []

if (files.length > 0 && !existsSync(testsDir)) {
  violations.push(`${files.length} هجرة بلا أي اختبار (المادة ٧/٢)`)
}

const seenNumbers = new Set()
let sql = ""
for (const file of files) {
  if (!/^\d{4}_/.test(file)) {
    violations.push(`هجرة غير مرقّمة: ${file}`)
    continue
  }
  const number = file.slice(0, 4)
  if (seenNumbers.has(number)) violations.push(`رقمُ هجرةٍ مكرّر: ${number} (${file})`)
  seenNumbers.add(number)
  sql += `\n${readFileSync(join(migrationsDir, file), "utf8")}`
}

/** نصُّ المخطط بلا تعليقات — الحارسُ يقيس المخطط لا التوثيق. */
const schema = sql.replace(/--[^\n]*/g, "")

// ── ٢) الجداولُ تُشتقّ من المخطط ولا تُسرد ───────────────────────────────────
const tables = new Map()
for (const match of schema.matchAll(
  /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(\w+)\s*\(([\s\S]*?)\n\s*\);/gi,
)) {
  tables.set(match[1], match[2])
}
const indexes = []
for (const match of schema.matchAll(
  /CREATE\s+INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+\w+\s+ON\s+(\w+)\s*\(([^)]*)\)/gi,
)) {
  indexes.push({ table: match[1], columns: match[2].split(",").map((c) => c.trim()) })
}

const hasColumn = (body, column) =>
  new RegExp(`(^|\\n)\\s*${column}\\s+(TEXT|INTEGER)\\b`, "i").test(body)
const routed = (table) =>
  indexes.some(
    (i) => i.table === table && i.columns[0] === "tenant_id" && i.columns[1] === "unit_path",
  )

let dataTables = 0
for (const [name, body] of tables) {
  const tenant = hasColumn(body, "tenant_id")
  const routing = hasColumn(body, "unit_path")
  if (tenant) {
    dataTables += 1
    if (!routing) {
      violations.push(`جدولُ بياناتٍ بلا مفتاح توجيه: ${name} ينقصه unit_path (ع-٥)`)
    } else if (!routed(name)) {
      violations.push(
        `جدولُ بياناتٍ بلا فهرسِ توجيه: ${name} ينقصه فهرسٌ على (tenant_id, unit_path)`,
      )
    }
  } else if (routing) {
    violations.push(`جدولٌ يحمل unit_path بلا tenant_id: ${name} — العزلُ بنيويٌّ لا بالمسار (قب-١٨)`)
  }
}
if (tables.size === 0 && files.length > 0) {
  violations.push("هجراتٌ بلا جدولٍ واحدٍ يُقرأ — تعذّر اشتقاق القائمة، والحارسُ يحمرّ عند الغموض")
}

if (/\bJSONB\b/i.test(schema)) violations.push("مزيةُ محرّك: JSONB (ع-٣)")
if (/\bAUTOINCREMENT\b/i.test(schema)) violations.push("مزيةُ محرّك: AUTOINCREMENT (ع-٣)")
if (/CREATE\s+INDEX[^;]*\bWHERE\b/i.test(schema)) {
  violations.push("فهرسٌ جزئيّ — بلا مقابلٍ محمولٍ في Postgres (ع-٣)")
}

if (violations.length) fail("G10", "الهجرات ومفتاح التوجيه", violations)

// ── ٣) الاختبارُ يجري فعلاً ─────────────────────────────────────────────────
try {
  execFileSync("npx", ["vitest", "run", "tests/migrations"], { cwd: ROOT, stdio: "pipe" })
} catch (e) {
  const out = String(e.stdout ?? "") + String(e.stderr ?? "")
  fail(
    "G10",
    "الهجرات ومفتاح التوجيه",
    out.trim().split("\n").filter((l) => /×|FAIL|Error/.test(l)),
  )
}

pass(
  "G10",
  "الهجرات ومفتاح التوجيه",
  `${files.length} هجرة مُختبَرة · ${dataTables} جدولَ بياناتٍ كلُّها تحمل مفتاح التوجيه`,
)
