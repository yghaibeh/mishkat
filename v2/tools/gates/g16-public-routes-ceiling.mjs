/** G16 — سقف المسارات العامة = القائمة البيضاء المعتمدة (CR-001 §ج/٢). */
import { walk, read, rel, fail, pass, ROOT } from "./_lib.mjs"
import { join } from "node:path"
import { readFileSync } from "node:fs"

const matrix = JSON.parse(
  readFileSync(join(ROOT, "src/authorization/matrix/authorization.matrix.json"), "utf8"),
)
const whitelist = matrix.publicDeclaredWhitelist
const approved = new Set(whitelist.routes.map((r) => r.id))
const violations = []

// أ) القائمة في الكود مطابقة للمعتمدة في المصفوفة.
const listed = [
  ...read(join(ROOT, "src/server/publicRoutes.ts")).matchAll(/"([\w.]+)"/g),
].map((m) => m[1])
for (const id of listed) {
  if (!approved.has(id)) violations.push(`مسار عام غير معتمد في القائمة البيضاء: ${id}`)
}
for (const id of approved) {
  if (!listed.includes(id)) violations.push(`مسار معتمد مفقود من ملف القائمة: ${id}`)
}

// ب) السقف لا يُتجاوز — لا نمو صامت.
if (listed.length > whitelist.ceiling) {
  violations.push(`عدد المسارات العامة ${listed.length} تجاوز السقف المعتمد ${whitelist.ceiling}`)
}

// ج) لا دالة تعلن PUBLIC_DECLARED خارج القائمة.
for (const file of walk(join(ROOT, "src"))) {
  const r = rel(file)
  if (r.endsWith("defineServerFn.ts") || r.endsWith("publicRoutes.ts")) continue
  const src = read(file)
  for (const m of src.matchAll(/name\s*:\s*"([\w.]+)"[\s\S]{0,300}?capability\s*:\s*PUBLIC_DECLARED/g)) {
    if (!approved.has(m[1])) violations.push(`${r} — «${m[1]}» يعلن PUBLIC_DECLARED خارج القائمة البيضاء`)
  }
}

if (violations.length) fail("G16", "سقف المسارات العامة", violations)
pass("G16", "سقف المسارات العامة", `${listed.length}/${whitelist.ceiling}`)
