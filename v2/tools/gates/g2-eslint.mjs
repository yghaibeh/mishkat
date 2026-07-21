/** G2 — ESLint صفر تحذيرات + قاعدة حدود الطبقات (المادتان ٢، ٣). */
import { execFileSync } from "node:child_process"
import { ROOT, fail, pass } from "./_lib.mjs"
try {
  execFileSync("npx", ["eslint", ".", "--max-warnings", "0"], { cwd: ROOT, stdio: "pipe" })
} catch (e) {
  const out = String(e.stdout ?? "") + String(e.stderr ?? "")
  fail("G2", "ESLint صفر تحذيرات + حدود الطبقات", out.trim().split("\n").filter(Boolean))
}
pass("G2", "ESLint صفر تحذيرات + حدود الطبقات")
