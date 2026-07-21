/**
 * G15 — «كل تسليم جوهري يشير لطلب CR معتمد» (قب-١٠، CHANGE_PROTOCOL §٤/٤).
 *
 * التصنيف من البروتوكول §٣: التسليم الذي يمسّ أصلاً في شبكة التتبع **جوهري**.
 * الأصول الحساسة هنا: المصفوفة الذهبية · سجل الإعدادات · القائمة البيضاء العامة · الدستور.
 * تسليمٌ يمسّها ولا يذكر `CR-NNN` في رسالته يُرفض.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { ROOT, fail, pass } from "./_lib.mjs"

import { classifyDelivery } from "./g15-classify.mjs"

function sh(cmd, args) {
  try {
    return String(execFileSync(cmd, args, { cwd: ROOT, stdio: "pipe" })).trim()
  } catch {
    return ""
  }
}

const head = sh("git", ["rev-parse", "HEAD"])
if (!head) {
  pass("G15", "مرجع طلب التغيير", "لا التزامات بعد")
  process.exit(0)
}

const changed = sh("git", ["diff", "--name-only", "HEAD~1", "HEAD"]).split("\n").filter(Boolean)
const message = sh("git", ["log", "-1", "--pretty=%B"])
const requestsDir = join(ROOT, "..", "rebuild", "requests")
const crIds = (existsSync(requestsDir) ? readdirSync(requestsDir) : [])
  .map((f) => /^CR-(\d{3})/.exec(f)?.[1])
  .filter(Boolean)

const r = classifyDelivery(changed, message, crIds)
if (r.verdict === "fail") {
  fail("G15", "مرجع طلب التغيير", [
    r.why,
    ...r.touched.map((t) => `  ${t}`),
    "أضف «CR-NNN» لطلبٍ معتمد في رسالة التسليم (CHANGE_PROTOCOL §٤).",
  ])
}
pass("G15", "مرجع طلب التغيير", r.why)
