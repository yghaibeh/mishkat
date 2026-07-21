/**
 * G14 — «لا رقم تشغيلي صلب» (قب-٦، SPEC_settings §١-٩).
 * المفحوص: `services/` و`shared/` وكل ما يحسب منطق عمل.
 * المستثنى: طبقة العرض، الاختبارات، المولَّد، و**سجل الإعدادات نفسه** (فيه تعيش
 * الافتراضيات بحكم التعريف).
 */
import { walk, read, rel, fail, pass, ROOT, stripCommentsAndStrings } from "./_lib.mjs"
import { join } from "node:path"

const SCANNED = ["src/services/", "src/shared/", "src/features/"]
const WHITELIST = new Set(["0", "1", "-1", "2", "100"])

const violations = []
for (const file of walk(join(ROOT, "src"))) {
  const r = rel(file)
  if (!SCANNED.some((p) => r.startsWith(p))) continue
  const code = stripCommentsAndStrings(read(file))
  code.split("\n").forEach((line, i) => {
    if (/\/\/\s*hard-constant:/.test(read(file).split("\n")[i] ?? "")) return
    for (const m of line.matchAll(/(?<![\w.])(\d[\d_]*(?:\.\d+)?)(?![\w.])/g)) {
      const raw = m[1].replace(/_/g, "")
      if (WHITELIST.has(raw)) continue
      violations.push(
        `${r}:${i + 1} — رقم تشغيلي صلب «${m[1]}» — كل ثابت عمل إعدادٌ في السجل (قب-٦)`,
      )
    }
  })
}

if (violations.length) fail("G14", "لا رقم تشغيلي صلب", violations)
pass("G14", "لا رقم تشغيلي صلب", "طبقة الخدمات نظيفة")
