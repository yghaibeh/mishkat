/** G11 — فحص الأسرار (المادة ٨/١): سرٌّ في الكود أو `.env` مُلتزَم = حادثة. */
import { walk, read, rel, fail, pass, ROOT } from "./_lib.mjs"
import { join } from "node:path"
import { existsSync } from "node:fs"

const PATTERNS = [
  [/(?:JWT_SECRET|API_KEY|SECRET_KEY|PRIVATE_KEY|CLOUDFLARE_API_TOKEN)\s*[:=]\s*["'][^"']{8,}/i, "سرّ مكتوب نصاً"],
  [/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, "مفتاح خاص"],
  [/\bAKIA[0-9A-Z]{16}\b/, "مفتاح AWS"],
  [/\bghp_[A-Za-z0-9]{36}\b/, "رمز GitHub"],
  [/\bsk-[A-Za-z0-9]{32,}\b/, "مفتاح API"],
]

const violations = []
for (const file of walk(ROOT, [".ts", ".mjs", ".js", ".json", ".toml", ".env"])) {
  const src = read(file)
  src.split("\n").forEach((line, i) => {
    for (const [re, what] of PATTERNS) {
      if (re.test(line)) violations.push(`${rel(file)}:${i + 1} — ${what}`)
    }
  })
}
for (const f of [".env", ".env.local", ".env.production"]) {
  if (existsSync(join(ROOT, f))) violations.push(`${f} موجود في الشجرة — الأسرار في مخزن المنصة حصراً`)
}

if (violations.length) fail("G11", "فحص الأسرار", violations)
pass("G11", "فحص الأسرار", "لا سرّ في الشجرة")
