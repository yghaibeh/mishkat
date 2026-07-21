/**
 * G13 — «فحص وجود مواصفة محدثة للميزة الملموسة» (المادة ١/٣: الوثيقة عقد لا سرد).
 * كل وحدة ميزة في `src/features/` يجب أن تحمل `SPEC.md` غير فارغة، وأن تكون
 * **أحدث من أو مساوية** لأحدث ملف كود فيها — فلا يسبق الكودُ عقدَه.
 */
import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { walk, read, rel, ROOT, fail, pass } from "./_lib.mjs"

const featuresDir = join(ROOT, "src/features")
const violations = []
let checked = 0

const modules = existsSync(featuresDir)
  ? readdirSync(featuresDir).filter((d) => statSync(join(featuresDir, d)).isDirectory())
  : []

for (const mod of modules) {
  checked++
  const dir = join(featuresDir, mod)
  const spec = join(dir, "SPEC.md")
  if (!existsSync(spec)) {
    violations.push(`وحدة الميزة «${mod}» بلا SPEC.md — الميزة بلا عقد`)
    continue
  }
  if (read(spec).trim().length < 200) {
    violations.push(`مواصفة «${mod}» أقصر من أن تكون عقداً (< ٢٠٠ حرف)`)
    continue
  }
  const specTime = statSync(spec).mtimeMs
  for (const f of walk(dir)) {
    if (statSync(f).mtimeMs > specTime + 60_000) {
      violations.push(`${rel(f)} أحدث من مواصفته — الكود سبق عقده (المادة ١/٣)`)
    }
  }
}

if (violations.length) fail("G13", "مواصفة محدثة لكل ميزة", violations)
pass("G13", "مواصفة محدثة لكل ميزة", `${checked} وحدة ميزة`)
