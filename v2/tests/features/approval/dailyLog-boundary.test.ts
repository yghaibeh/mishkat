/**
 * **حدُّ المحرّك مع أوّل وحدةٍ غنيّةٍ تستهلكه** (G22، قب-٢٩) — يُقاس على المحتوى لا على الوعد.
 *
 * وحدةُ سجل اليوم هي أوّلُ مستهلكٍ يمرّ بسلسلة ق-٥ كاملةً؛ فإن تسرّب إليها سطرُ اعتمادٍ
 * واحدٌ عاد مرضُ v1 (منطقُ اعتمادٍ في كل ميزة فاختلفت السلوكيات). ولذلك يعيش هذا الحارسُ
 * **داخل مجلد اختبارات المحرّك**: هو حدُّ المحرّك لا تفصيلَ الوحدة، ومفرداتُ الفحص نفسُها
 * (`approveRequest`، `ApprovalRequest`، `report.approve` …) لا يجوز أن تُكتب خارجه.
 *
 * والبديلُ الذي جعله ممكناً: **منفذُ القفل المحقون** — الوحدةُ تسأل «أهذه الفترةُ مقفلة؟»
 * ولا تعرف مَن أقفلها ولا بأيّ سلسلة، والمُنفِّذُ (`weeklyRecordLockCheck`) يعيش هنا.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { WEEKLY_RECORD } from "../../../src/features/approval/registered/weeklyRecord.js"

const MODULE_DIR = join(process.cwd(), "src/features/dailyLog")

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

describe("G22 — صفرُ منطقِ اعتمادٍ في وحدة سجل اليوم", () => {
  it("**لا مفردةَ توجيهٍ ولا حالةَ اعتمادٍ ولا فعلَ بتٍّ في أيّ ملفٍّ من الوحدة**", () => {
    const forbidden: readonly [RegExp, string][] = [
      [/\bapproverLayer\w*/i, "توجيهُ NESSA"],
      [/\bnearestApprover\w*/i, "«من يعتمد؟»"],
      [/\bbreakGlass\w*/i, "كسرُ الزجاج"],
      [/\bnessa\b/i, "منطقُ NESSA"],
      [/\bApprovalRequest\b|\bApprovalState\b|\bApprovalRoute\b/, "حالةُ اعتمادٍ تُدار"],
      [/\bsubmitForApproval\b|\bapproveRequest\b|\brejectRequest\b|\bretractSubmission\b/, "فعلُ بتٍّ"],
      [/\blayer_approved\b|\bamir_approved\b/, "حالةُ اعتمادٍ من v1"],
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

  it("**ولا قدرةَ اعتمادٍ تُستهلَك في خدمات الوحدة** — سلسلةُ البتّ كلُّها في المحرّك", () => {
    // القائمةُ تُشتقّ من **عقد النوع المسجَّل** لا من سردٍ ثانٍ يتباعد عنه.
    const approvalCaps: readonly string[] = [
      WEEKLY_RECORD.approveCapability,
      WEEKLY_RECORD.overrideCapability,
      WEEKLY_RECORD.retractCapability,
    ].filter((c) => c !== null)
    expect(approvalCaps.length).toBeGreaterThan(0)

    const hits: string[] = []
    for (const file of FILES) {
      if (file.includes(`${"/"}screens${"/"}`)) continue // الواجهةُ تعرض ولا تقرر (G20)
      const source = readFileSync(file, "utf8")
      source.split("\n").forEach((line, i) => {
        for (const cap of approvalCaps) {
          if (line.includes(`"${cap}"`)) hits.push(`${file}:${i + 1} — ${cap}`)
        }
      })
    }
    expect(hits, hits.join(" · ")).toEqual([])
  })

  it("**والوحدةُ لا تستورد من مجلد المحرّك إطلاقاً** — القفلُ منفذٌ يُسأل لا حالةٌ تُقرأ", () => {
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
    expect(WEEKLY_RECORD.id).toBe("weekly.record")
    expect(WEEKLY_RECORD.scopeKind).toBe("unit")
    expect(WEEKLY_RECORD.uniquePerPeriod).toBe(true)
    expect(WEEKLY_RECORD.payloadRequired).toBe(true)
    expect(WEEKLY_RECORD.approvalLocks).toBe(true)
    expect(WEEKLY_RECORD.rejectionReturnsToDraft).toBe(true)
    expect(WEEKLY_RECORD.rejectionRequiresReason).toBe(true)
  })
})
