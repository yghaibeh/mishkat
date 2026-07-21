/** G4 — الاختبارات + عتبات التغطية (المادة ٥، TESTING_POLICY §٣). */
import { execFileSync } from "node:child_process"
import { ROOT, fail, pass } from "./_lib.mjs"
try {
  const out = execFileSync("npx", ["vitest", "run", "--coverage"], { cwd: ROOT, stdio: "pipe" })
  const text = String(out)
  const m = /Tests\s+(\d+) passed/.exec(text)
  pass("G4", "الاختبارات وعتبات التغطية", m ? `${m[1]} اختباراً` : "")
} catch (e) {
  const out = String(e.stdout ?? "") + String(e.stderr ?? "")
  const lines = out.trim().split("\n").filter((l) => /ERROR|✗|×|FAIL|threshold/.test(l))
  fail("G4", "الاختبارات وعتبات التغطية", lines.length ? lines : [out.slice(-1500)])
}
