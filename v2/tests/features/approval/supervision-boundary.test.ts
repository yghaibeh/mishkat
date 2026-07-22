/**
 * **حدُّ المحرّك مع وحدة الإشراف** (G22، قب-٣٣) — يُقاس على المحتوى لا على الوعد.
 *
 * الزياراتُ كانت في v1 أحدَ المواضع الـ١٢ التي تناثر فيها منطقُ الاعتماد
 * (`supervision.server.ts` مع `records.ts` و`registration.server.ts` و`unitBox.ts`) فاختلفت
 * السلوكيات وتناقضت. ولذلك يعيش هذا الحارسُ **داخل مجلد اختبارات المحرّك**: هو حدُّ المحرّك
 * لا تفصيلَ الوحدة، ومفرداتُ الفحص نفسُها (`approveRequest`، `ApprovalRequest`،
 * `visit.approve` …) لا يجوز أن تُكتب خارجه.
 *
 * والبديلُ الذي جعله ممكناً: **منفذُ الحُكم المحقون** — الوحدةُ تسأل «أمعتمَدةٌ ومَن اعتمدها؟»
 * (فتفي بـق-١٠٢) ولا تعرف السلسلةَ ولا حالتَها، والمُنفِّذُ (`supervisionVisitVerdict`) يعيش هنا.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { SUPERVISION_VISIT } from "../../../src/features/approval/registered/supervisionVisit.js"

const MODULE_DIR = join(process.cwd(), "src/features/supervision")

function sourcesOf(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...sourcesOf(full))
    else if (name.endsWith(".ts")) out.push(full)
  }
  return out
}

/** تجريدُ التعليقات (نظيرُ G6/G22): التوثيقُ لا يُدان، والمُدان كودٌ يُنفَّذ. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) ?? []).length))
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

const FILES = sourcesOf(MODULE_DIR)

describe("G22 — صفرُ منطقِ اعتمادٍ في وحدة الإشراف", () => {
  it("**لا مفردةَ توجيهٍ ولا حالةَ اعتمادٍ ولا فعلَ بتٍّ في أيّ ملفٍّ من الوحدة**", () => {
    const forbidden: readonly [RegExp, string][] = [
      [/\bapproverLayer\w*/i, "توجيهُ NESSA"],
      [/\bnearestApprover\w*/i, "«من يعتمد؟»"],
      [/\bbreakGlass\w*/i, "كسرُ الزجاج"],
      [/\bnessa\b/i, "منطقُ NESSA"],
      [/\bApprovalRequest\b|\bApprovalState\b|\bApprovalRoute\b/, "حالةُ اعتمادٍ تُدار"],
      [/\bsubmitForApproval\b|\bapproveRequest\b|\brejectRequest\b|\bretractSubmission\b/, "فعلُ بتٍّ"],
      [/\blayer_approved\b|\bamir_approved\b/, "حالةُ اعتمادٍ من v1"],
      [/\bsupervisor(?:y)?Layers?\b/, "قائمةُ طبقاتٍ إشرافية (ث-٣)"],
    ]
    const hits: string[] = []
    for (const file of FILES) {
      const code = codeOnly(readFileSync(file, "utf8"))
      code.split("\n").forEach((line, i) => {
        for (const [re, what] of forbidden) {
          if (re.test(line)) hits.push(`${file}:${i + 1} — ${what}`)
        }
      })
    }
    expect(hits, hits.join(" · ")).toEqual([])
  })

  // **حُذف هنا حارسٌ موضعيّ** كان يشتقّ قدراتِ البتّ من عقد النوع ويطاردها في ملفات الوحدة:
  // بناه وكيلُ T11 في مساحته لأن G22 كانت **مُجمَّدةً** وقائمتُها مسرودةٌ يدوياً فلا تعرف
  // `visit.approve`. وقد تكفّلت البوابةُ بذلك للشجرة كلِّها بعد CR-011/قب-٣٦ (تشتقّ قائمتها
  // من السجل نفسِه، ومُثبَتةٌ بالفشل على **قدرةِ نوعٍ سُجِّل حديثاً**) — وحارسان لمعنىً واحد
  // مصدرا حقيقةٍ يتباعدان (المادة ١/٢). والباقي هنا **حدُّ الوحدة** الذي لا تقيسه البوابة.

  it("**والوحدةُ لا تستورد من مجلد المحرّك إطلاقاً** — الحُكمُ منفذٌ يُسأل لا حالةٌ تُقرأ", () => {
    const hits: string[] = []
    for (const file of FILES) {
      const code = codeOnly(readFileSync(file, "utf8"))
      code.split("\n").forEach((line, i) => {
        if (/from\s+["'][^"']*features\/approval\//.test(line)) hits.push(`${file}:${i + 1}`)
      })
    }
    expect(hits, `استيرادٌ من المحرّك: ${hits.join(" · ")}`).toEqual([])
  })

  it("**والتسجيلُ سطرُ بيانٍ لا وحدةُ منطق**: النوعُ يعلن قدراته وأثرَي بتّه ولا يعطّل حارساً", () => {
    expect(SUPERVISION_VISIT.id).toBe("supervision.visit")
    expect(SUPERVISION_VISIT.scopeKind).toBe("unit")
    expect(SUPERVISION_VISIT.uniquePerPeriod).toBe(true)
    expect(SUPERVISION_VISIT.payloadRequired).toBe(true)
    expect(SUPERVISION_VISIT.approvalLocks).toBe(true)
    expect(SUPERVISION_VISIT.rejectionReturnsToDraft).toBe(true)
    expect(SUPERVISION_VISIT.rejectionRequiresReason).toBe(true)
  })
})
