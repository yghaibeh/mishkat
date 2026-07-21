/**
 * G5 — المصفوفة الذهبية دور×قدرة (المادة ٤/٧).
 * ثلاث حراسات، الثالثة هي التي تمنع الانحراف الصامت فعلاً:
 *  أ) المشتقات مطابقة للمصفوفة (المولّد لا يُحدث فرقاً).
 *  ب) سلامة بنيوية: لا قدرة خارج الكتالوج، ولا قدرة يتيمة بلا دور، ولكل قدرة باب (ق-٢٨).
 *  ج) **بصمة المصفوفة** مطابقة للبصمة المعتمدة — أي تعديل خلية يفشل الدمج حتى
 *     يُحدَّث ملف البصمة عمداً بطلب تغيير معتمد (قب-١٠). هذه وحدها غير تكرارية:
 *     الاختبارات المولَّدة تقرأ المصفوفة نفسها، فلا تكشف تحريرها.
 */
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT, fail, pass } from "./_lib.mjs"

const violations = []

// أ) المشتقات
try {
  execFileSync("node", [join(ROOT, "tools/generate/emit-derived.mjs"), "--check"], {
    stdio: "pipe",
  })
} catch (e) {
  violations.push(`المشتقات منحرفة عن المصفوفة: ${String(e.stdout ?? e.message).trim()}`)
}

const matrix = JSON.parse(
  readFileSync(join(ROOT, "src/authorization/matrix/authorization.matrix.json"), "utf8"),
)

// ب) سلامة بنيوية
const capIds = new Set(matrix.capabilities.map((c) => c.id))
if (capIds.size !== matrix.capabilities.length) violations.push("معرّف قدرة مكرر في الكتالوج")

const used = new Set()
for (const [roleId, caps] of Object.entries(matrix.matrix)) {
  if (!matrix.roles.some((r) => r.id === roleId)) violations.push(`دور خارج القائمة: ${roleId}`)
  for (const c of caps) {
    if (!capIds.has(c)) violations.push(`قدرة خارج الكتالوج في حزمة ${roleId}: ${c}`)
    used.add(c)
  }
  if (new Set(caps).size !== caps.length) violations.push(`تكرار قدرة في حزمة ${roleId}`)
}

// «قدرة بلا مستهلك تُفشل البناء» — قدرة لا يحملها أي دور يتيمةٌ إلا أن تُعلن كذلك.
for (const c of capIds) {
  if (!used.has(c)) violations.push(`قدرة يتيمة لا يحملها أي دور: ${c}`)
}

for (const r of matrix.roles) {
  if (matrix.matrix[r.id] === undefined) violations.push(`دور بلا حزمة في المصفوفة: ${r.id}`)
}

// ج) بصمة المصفوفة
const normalized = JSON.stringify({
  capabilities: matrix.capabilities.map((c) => [c.id, c.type, c.scopeKind]).sort(),
  roles: matrix.roles.map((r) => [r.id, r.rank, r.state]).sort(),
  matrix: Object.fromEntries(
    Object.entries(matrix.matrix)
      .map(([k, v]) => [k, [...v].sort()])
      .sort(),
  ),
  provisionRules: matrix.provisionRules,
})
const digest = createHash("sha256").update(normalized).digest("hex")
const approved = JSON.parse(readFileSync(join(ROOT, "tools/gates/matrix.digest.json"), "utf8"))

if (approved.digest !== digest) {
  violations.push(
    `بصمة المصفوفة تغيّرت بلا اعتماد:\n     المعتمدة: ${approved.digest}\n     الحالية : ${digest}\n     ⇐ تعديل المصفوفة تغييرٌ جوهري يمرّ ببروتوكول التغيير (قب-١٠)، ثم يُحدَّث ملف البصمة بطلب معتمد.`,
  )
}

if (violations.length) fail("G5", "المصفوفة الذهبية", violations)
pass("G5", "المصفوفة الذهبية", `${matrix.capabilities.length} قدرة × ${matrix.roles.length} دور`)
