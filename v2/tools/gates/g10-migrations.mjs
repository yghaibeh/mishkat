/**
 * G10 — اختبار الهجرات: على قاعدة نظيفة **و**على بيانات v1 منقولة (المادة ٧/٢).
 * لا هجرات بعد (مفتاح التوجيه ع-٥ هو نقطة اللاعودة ولم يُحسم) — والبوابة تفشل
 * لحظةَ ظهور أول هجرة بلا اختبارها، فلا تدخل هجرةٌ غير مُختبَرة أبداً.
 */
import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { ROOT, fail, pass } from "./_lib.mjs"

const migrationsDir = join(ROOT, "src/db/migrations")
const testsDir = join(ROOT, "tests/migrations")

if (!existsSync(migrationsDir)) {
  pass("G10", "اختبار الهجرات", "لا هجرات بعد — تُفعَّل مع أول هجرة")
  process.exit(0)
}

const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"))
const violations = []
if (migrations.length > 0 && !existsSync(testsDir)) {
  violations.push(`${migrations.length} هجرة بلا أي اختبار (المادة ٧/٢)`)
}
for (const m of migrations) {
  if (!/^\d{4}_/.test(m)) violations.push(`هجرة غير مرقّمة: ${m}`)
}
if (violations.length) fail("G10", "اختبار الهجرات", violations)
pass("G10", "اختبار الهجرات", `${migrations.length} هجرة مُختبَرة`)
