/**
 * G7 — «كل دالة خادم تعلن قدرتها» (المادة ٤/٥ + CR-001 §ج).
 * الإعلان إمّا `capability` وإمّا `PUBLIC_DECLARED`؛ والدالة بلا إعلان لا تُسجَّل ⇒ يفشل البناء.
 */
import { walk, read, rel, fail, pass, ROOT } from "./_lib.mjs"
import { join } from "node:path"

const violations = []
let declared = 0

for (const file of walk(join(ROOT, "src"))) {
  const r = rel(file)
  if (r.endsWith("defineServerFn.ts")) continue
  const src = read(file)

  // كل استدعاء لـ defineServerFn يجب أن يحمل إعلاناً.
  const calls = src.split(/defineServerFn\s*\(/).slice(1)
  for (const [i, body] of calls.entries()) {
    declared++
    const head = body.slice(0, 900)
    const hasCap = /capability\s*:/.test(head)
    if (!hasCap) {
      violations.push(`${r} — دالة خادم #${i + 1} بلا إعلان قدرة (لا تُسجَّل)`)
      continue
    }
    const isPublic = /capability\s*:\s*PUBLIC_DECLARED/.test(head)
    if (!isPublic && !/scope\s*:/.test(head)) {
      violations.push(`${r} — دالة خادم #${i + 1} تعلن قدرةً بلا مُحلِّل نطاق`)
    }
    if (!/audit\s*:/.test(head)) {
      violations.push(`${r} — دالة خادم #${i + 1} بلا اسم فعل في سجل التدقيق`)
    }
  }

  // ولا مسار خادم يُصدَّر خارج آلية الإعلان.
  if (/\.server\.ts$/.test(r)) {
    const rawExports = [...src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map((m) => m[1])
    for (const name of rawExports) {
      violations.push(`${r} — الدالة «${name}» مُصدَّرة خارج defineServerFn (نقطة RPC بلا حارس)`)
    }
  }
}

if (violations.length) fail("G7", "كل دالة خادم تعلن قدرتها", violations)
// لافتةُ حالةٍ صريحة (كأخواتها G9/G10/G13): تُفصح هل للبوابة موضوعٌ اليوم أم لا.
const banner = declared === 0 ? "بلا موضوعٍ بعد — تُفعَّل مع أول دالة خادم" : `عاملة · المُعلِنة: ${declared}`
pass("G7", "كل دالة خادم تعلن قدرتها", banner)
