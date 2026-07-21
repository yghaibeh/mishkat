/** تشغيل البوابات الـ١٩ بالترتيب — المادة ١٠. */
import { execFileSync } from "node:child_process"
import { join } from "node:path"
import { ROOT } from "./_lib.mjs"

const GATES = [
  ["G1", "g1-tsc.mjs"], ["G2", "g2-eslint.mjs"], ["G3", "g3-any-tsignore.mjs"],
  ["G4", "g4-tests-coverage.mjs"], ["G5", "g5-golden-matrix.mjs"], ["G6", "g6-no-role-checks.mjs"],
  ["G7", "g7-declared-serverfns.mjs"], ["G8", "g8-smoke.mjs"], ["G9", "g9-role-matrix-e2e.mjs"],
  ["G10", "g10-migrations.mjs"], ["G11", "g11-secrets.mjs"], ["G12", "g12-bundle-guard.mjs"],
  ["G13", "g13-spec-present.mjs"], ["G14", "g14-no-hard-numbers.mjs"], ["G15", "g15-cr-reference.mjs"],
  ["G16", "g16-public-routes-ceiling.mjs"], ["G17", "g17-db-import-boundary.mjs"],
  ["G18", "g18-query-params-ceiling.mjs"], ["G19", "g19-spec-matrix-table.mjs"],
]

let failed = []
for (const [id, script] of GATES) {
  try {
    const out = execFileSync("node", [join(ROOT, "tools/gates", script)], { cwd: ROOT, stdio: "pipe" })
    process.stdout.write(String(out))
  } catch (e) {
    process.stdout.write(String(e.stdout ?? ""))
    process.stderr.write(String(e.stderr ?? ""))
    failed.push(id)
  }
}
console.log("")
if (failed.length) {
  console.error(`✗ بوابات فاشلة: ${failed.join("، ")}`)
  process.exit(1)
}
console.log(`✓ البوابات الـ${GATES.length} خضراء`)
