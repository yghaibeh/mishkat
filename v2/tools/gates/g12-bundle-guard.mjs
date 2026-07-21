/**
 * G12 — حارس حزمة النشر: **وريث حارس ns=0** (ت-١).
 *
 * في v1 كان `await import("./database/schema")` يجعل الحزمة تعيد تصدير فضاء الأسماء
 * فترفضها Cloudflare (خطأ 10021) — خطأ مكلف تكرر أربع مرات. كان الحارس
 * `grep -c "schema as" dist/server/server.js === 0` **بعد** البناء.
 *
 * ما يقابله في حزمة v2 (وهذا اجتهاد المهمة المطلوب): الجذرُ ليس النصَّ «schema as»
 * بل **الاستيراد الديناميكي لوحدات المخطط/البيانات**. فنحرسه عند المصدر لا عند الناتج:
 * أبكرُ وأدقُّ وأقلُّ هشاشة من grep على ملف مبنيّ.
 *  ١. لا `await import(...)` ولا `import(...)` ديناميكي لوحدات `db/` أو المخطط.
 *  ٢. لا `export * from` في طبقة البيانات (إعادة تصدير فضاء الأسماء بعينها).
 *  ٣. لا `import * as` من وحدات المخطط.
 * وحين تُبنى حزمةُ نشرٍ فعلية تُضاف الحراسة على الناتج أيضاً (تُذكر في التقرير كمتبقٍّ).
 */
import { walk, read, rel, fail, pass, ROOT, stripCommentsOnly } from "./_lib.mjs"
import { join } from "node:path"

const violations = []
for (const file of walk(join(ROOT, "src"))) {
  const code = stripCommentsOnly(read(file))
  code.split("\n").forEach((line, i) => {
    const at = `${rel(file)}:${i + 1}`
    if (/\bimport\s*\(/.test(line) && /(schema|db\/|database)/.test(line)) {
      violations.push(`${at} — استيراد ديناميكي لوحدة بيانات/مخطط (وريث ns=0، ت-١)`)
    }
    if (/^\s*export\s+\*\s+from/.test(line) && rel(file).startsWith("src/db/")) {
      violations.push(`${at} — إعادة تصدير فضاء أسماء في طبقة البيانات`)
    }
    if (/import\s+\*\s+as\s+\w+\s+from\s+["'][^"']*(?:schema|database)/.test(line)) {
      violations.push(`${at} — استيراد فضاء أسماء من المخطط`)
    }
  })
}

if (violations.length) fail("G12", "حارس حزمة النشر (وريث ns=0)", violations)
pass("G12", "حارس حزمة النشر (وريث ns=0)", "لا استيراد ديناميكي للمخطط")
