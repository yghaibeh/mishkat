/**
 * **الاختبارُ الإلزاميّ الأول** (T19، الشقُّ البنيويّ) — **حدُّ المحرّك مع وحدة التعليم** (G22).
 *
 * وحدةُ «على بصيرة» هي أخطرُ مستهلكٍ للمحرّك حتى اليوم: في v1 كان **اعتمادُ الدرس منطقاً
 * خاصاً بها** (`setLessonStatusData` عبر `halaqaLessonApprover`)، وهو أحدُ الاثني عشر موضعاً
 * التي فرّقت السلوك (ق-١، الوثيقة ٢٩). فإن تسرّب إليها سطرُ اعتمادٍ واحد عاد المرضُ نفسُه.
 *
 * ولذلك يعيش هذا الحارسُ **داخل مجلد اختبارات المحرّك**: مفرداتُ الفحص نفسُها
 * (`approveRequest`، `ApprovalRequest`، `report.approve` …) لا يجوز أن تُكتب خارجه.
 *
 * والبديلُ الذي جعله ممكناً: **منفذُ حال الاعتماد المحقون** — الوحدةُ تسأل «أهذا الدرسُ
 * معتمَد؟» ولا تعرف مَن اعتمده ولا بأيّ سلسلة، والمُنفِّذُ (`educationLessonApprovalCheck`)
 * يعيش هنا. وهو نظيرُ **منفذ القفل** في وحدة سجل اليوم (T10).
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import {
  EDUCATION_LESSON,
  EDUCATION_LESSON_TYPE,
  educationLessonApprovalCheck,
} from "../../../src/features/approval/registered/education.js"
import { registeredApprovalTypes } from "../../../src/features/approval/registry.js"
import { ApprovalStore } from "../../../src/features/approval/data/store.js"

const MODULE_DIR = join(process.cwd(), "src/features/education")

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

describe("G22 — **صفرُ منطقِ اعتمادٍ في وحدة «على بصيرة»**", () => {
  it("مساحةُ الفحص غيرُ فارغة (وإلا مرّ الحارسُ على العدم)", () => {
    expect(FILES.length).toBeGreaterThan(0)
  })

  it("**لا مفردةَ توجيهٍ ولا حالةَ اعتمادٍ ولا فعلَ بتٍّ في أيّ ملفٍّ من الوحدة**", () => {
    const forbidden: readonly [RegExp, string][] = [
      [/\bapproverLayer\w*/i, "توجيهُ NESSA"],
      [/\bapproverFor\b/i, "«من يعتمد؟»"],
      [/\bnearestApprover\w*/i, "«من يعتمد؟»"],
      [/\bbreakGlass\w*/i, "كسرُ الزجاج"],
      [/\bnessa\b/i, "منطقُ NESSA"],
      [/\bsupervisor(?:y)?Layers?\b/i, "قائمةُ طبقاتٍ إشرافية (ث-٣)"],
      [/\bApprovalRequest\b|\bApprovalState\b|\bApprovalRoute\b/, "حالةُ اعتمادٍ تُدار"],
      [/\bsubmitForApproval\b|\bapproveRequest\b|\brejectRequest\b|\bretractSubmission\b|\boverrideApprove\b|\bamendLocked\b/, "فعلُ بتٍّ"],
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

  it("**ولا قدرةَ بتٍّ تُستهلَك في الوحدة** — قدراتُها أربعٌ لا خامسةَ لها", () => {
    const decisionCaps = ["report.approve", "report.approve.override", "approve.breakGlass", "records.editLocked"]
    const hits: string[] = []
    for (const file of FILES) {
      const source = readFileSync(file, "utf8")
      source.split("\n").forEach((line, i) => {
        for (const cap of decisionCaps) {
          if (line.includes(`"${cap}"`)) hits.push(`${file}:${i + 1} — ${cap}`)
        }
      })
    }
    expect(hits, hits.join(" · ")).toEqual([])
  })

  it("**ولا استيرادَ من مجلد المحرّك في الوحدة** — الوصلُ منفذٌ محقون لا استيراد", () => {
    const hits: string[] = []
    for (const file of FILES) {
      const code = codeOnly(readFileSync(file, "utf8"))
      code.split("\n").forEach((line, i) => {
        if (/\bfrom\b/.test(line) && /approval\//.test(line)) hits.push(`${file}:${i + 1}`)
      })
    }
    expect(hits, `استيرادٌ من المحرّك: ${hits.join(" · ")}`).toEqual([])
  })
})

describe("نقطةُ التمديد — **النوعُ بيانٌ يُعلن، والمنفذُ يجيب عن حالٍ لا عن سلسلة**", () => {
  it("النوعُ مسجَّلٌ في سجل المحرّك بقدراته الأربع المعلنة", () => {
    const registered = registeredApprovalTypes().find((t) => t.id === EDUCATION_LESSON_TYPE)
    expect(registered).toBeDefined()
    expect(registered?.approveCapability).toBe("report.approve")
    expect(registered?.overrideCapability).toBe("report.approve.override")
    // **قدرةُ التقديم والسحب شخصيةٌ** — ملكيةُ المعلّم لحلقته، وليست قدرةَ بتٍّ (حدُّ G22 المعلن).
    expect(registered?.submitCapability).toBe("circle.teach")
    expect(registered?.retractCapability).toBe("circle.teach")
  })

  it("**وحقولُ الحراسة نوعُها الحرفيّ `true`** — فنوعٌ لا يستطيع تعطيلَ حارس (CR-008)", () => {
    expect(EDUCATION_LESSON.uniquePerPeriod).toBe(true)
    expect(EDUCATION_LESSON.payloadRequired).toBe(true)
    expect(EDUCATION_LESSON.approvalLocks).toBe(true)
    expect(EDUCATION_LESSON.rejectionReturnsToDraft).toBe(true)
    expect(EDUCATION_LESSON.rejectionRequiresReason).toBe(true)
  })

  it("**والمنفذُ يجيب «لا» ما لم يُقفَل الطلب** — فالاعتمادُ فعلٌ يقع لا حالةٌ ضمنية", () => {
    const store = new ApprovalStore("t-main")
    const check = educationLessonApprovalCheck(store)
    expect(check("lesson-1")).toBe(false)

    store.saveRequest({
      tenantId: "t-main",
      id: "apr-1",
      typeId: EDUCATION_LESSON_TYPE,
      unitPath: "/men/homs/sq2/khalid/circle-1/",
      period: { id: "lesson-1", endsAt: new Date("2026-07-20T09:00:00.000Z") },
      state: "submitted",
      payload: { lessonId: "lesson-1" },
      submittedBy: "u-teacher",
      submittedAt: new Date("2026-07-22T09:00:00.000Z"),
      approvedBy: null,
      approvedAt: null,
      route: null,
      lockedAt: null,
      lastRejection: null,
    })
    // **مقدَّمٌ ليس معتمَداً**: القفلُ وحده هو الجواب (ق-٨).
    expect(check("lesson-1")).toBe(false)

    store.saveRequest({
      ...store.getRequest("apr-1")!,
      state: "approved",
      approvedBy: "u-amir",
      approvedAt: new Date("2026-07-22T10:00:00.000Z"),
      route: "nearest",
      lockedAt: new Date("2026-07-22T10:00:00.000Z"),
    })
    expect(check("lesson-1")).toBe(true)
    // ودرسٌ آخر لا يتلوّث بجواب جاره.
    expect(check("lesson-2")).toBe(false)
  })
})
