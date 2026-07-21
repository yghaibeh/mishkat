/** G1 — `tsc --noEmit` صفر أخطاء (المادة ٢/٣): لا «أخطاء معروفة مقبولة» في v2 أبداً. */
import { execFileSync } from "node:child_process"
import { ROOT, fail, pass } from "./_lib.mjs"
try {
  execFileSync("npx", ["tsc", "--noEmit", "-p", "tsconfig.json"], { cwd: ROOT, stdio: "pipe" })
} catch (e) {
  const out = String(e.stdout ?? "") + String(e.stderr ?? "")
  fail("G1", "tsc صفر أخطاء", out.trim().split("\n").filter(Boolean))
}
pass("G1", "tsc صفر أخطاء")
