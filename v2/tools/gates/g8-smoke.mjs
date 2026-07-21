/**
 * G8 — طقم الدخان (TESTING_POLICY §٦): أصغر مجموعة تثبت أن النظام حي.
 * هدفه < ٥ دقائق. يشغّل رحلة «دخول ← رئيسية ← فعل ← منع» لثلاثة أدوار مختارة.
 */
import { execFileSync } from "node:child_process"
import { ROOT, fail, pass } from "./_lib.mjs"
try {
  execFileSync("npx", ["vitest", "run", "tests/smoke"], { cwd: ROOT, stdio: "pipe" })
} catch (e) {
  const out = String(e.stdout ?? "") + String(e.stderr ?? "")
  fail("G8", "طقم الدخان", out.trim().split("\n").filter((l) => /×|FAIL|Error/.test(l)))
}
pass("G8", "طقم الدخان", "ثلاثة أدوار: مدير · أمير · محفّظ")
