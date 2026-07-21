/**
 * منطق تصنيف التسليم — مفصولٌ عن سباكة git ليكون **قابلاً للإثبات** بلا التزامٍ مصطنع
 * في مستودع المالك. (CHANGE_PROTOCOL §٣: التسليم الذي يمسّ أصلاً في شبكة التتبع جوهري.)
 */
export const SENSITIVE_PREFIXES = [
  "v2/src/authorization/matrix/",
  "v2/src/settings/registry.ts",
  "v2/src/server/publicRoutes.ts",
  "v2/tools/gates/matrix.digest.json",
  "rebuild/ENGINEERING_RULES.md",
  "rebuild/specs/",
]

/** @returns {{substantive:boolean, touched:string[], cr:string|null, verdict:"pass"|"fail", why:string}} */
export function classifyDelivery(changedFiles, commitMessage, existingCrIds = []) {
  const touched = changedFiles.filter((f) => SENSITIVE_PREFIXES.some((s) => f.startsWith(s)))
  if (touched.length === 0) {
    return { substantive: false, touched, cr: null, verdict: "pass", why: "لا يمسّ أصلاً حسّاساً" }
  }
  const m = /CR-(\d{3})/.exec(commitMessage ?? "")
  if (!m) {
    return { substantive: true, touched, cr: null, verdict: "fail", why: "تسليم جوهري بلا طلب تغيير" }
  }
  if (!existingCrIds.includes(m[1])) {
    return { substantive: true, touched, cr: m[1], verdict: "fail", why: `CR-${m[1]} لا ملف له` }
  }
  return { substantive: true, touched, cr: m[1], verdict: "pass", why: `مسنَدٌ إلى CR-${m[1]}` }
}
