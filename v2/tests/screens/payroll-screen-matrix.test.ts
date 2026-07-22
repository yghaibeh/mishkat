/**
 * **الطبقةُ الثانية من E2E — مصفوفةُ شاشات الرواتب** (TESTING_POLICY §٤، G9).
 *
 * لكل دورٍ حيّ × كل عنصر: يُبنى العرضُ بقشرة القدرات المحسوبة، ويُفحص **حضورُ العنصر بعدسة
 * الدور** و**غيابُه الصريح** — وهو تحديداً ما كان مكسوراً في v1. وحالاتُ السلب أكثر.
 *
 * **وأخطرُ خليةٍ في هذه المصفوفة**: `amir` × `/finance/payroll` — **ق-٣٠**. فخصوصيةُ الرواتب
 * المركزية عن الأمير **ثغرةٌ أُغلقت مبكراً بكلفة** («أُزيل `finance.view` من الأمير» —
 * تدقيقُ المطابقة)، وهذا الاختبارُ حارسُها الدائم.
 *
 * **ملاحظةُ صدقٍ منهجيّة** (كما أعلنت سائرُ المصفوفات): لا إطارَ واجهةٍ في v2 بعد (قب-٢٦)،
 * فهذه المصفوفة تُجسّد الطبقة الثانية على **مستوى شجرة العرض** — ورفضُ الخادم مبرهنٌ في
 * `tests/features/payroll/privacy-endpoints.test.ts`، فالطبقتان معاً لا واحدة.
 */
import { describe, it, expect } from "vitest"
import { computePayrollCaps } from "../../src/features/payroll/screens/caps.js"
import {
  EMPTY_PAYROLL_SNAPSHOT,
  PAYROLL_CONTRACT,
  PAYSLIP_CONTRACT,
  payrollScreenNodes,
  payslipScreenNodes,
  projectPayrollSnapshot,
  silenceTextKey,
} from "../../src/features/payroll/screens/screens.js"
import { screenContentNodes, walkNodes, type UiNode } from "../../src/ui/components/kernel.js"
import { ROLE_CAPABILITIES, type RoleId } from "../../src/authorization/generated/roles.generated.js"
import { TEXT } from "../../src/ui/text/dictionary.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import type { MonthlyPlanView, SilenceCode } from "../../src/features/payroll/types.js"
import type { Cents } from "../../src/features/ledger/types.js"
import { canonicalActor, DECISION, KHALID_PATH } from "../features/payroll/_seed.js"

function visibleCaps(root: UiNode): readonly string[] {
  const out = new Set<string>()
  for (const block of screenContentNodes(root)) {
    for (const n of walkNodes(block)) {
      if (n.capability !== null && n.capability !== "derived") out.add(n.capability)
      const guarded = n.meta.guardedBy
      if (guarded !== undefined) for (const cap of guarded.split(",")) out.add(cap)
    }
  }
  return [...out].filter((c) => c.length > 0).sort()
}

/** الأدوارُ الحيّةُ التي **لا** تملك عرضَ الرواتب — وهي الأكثرية، وكلُّها سلب. */
const DENIED_ROLES: readonly RoleId[] = [
  "amir",
  "teacher",
  "committee_head",
  "media",
  "student",
  "square",
  "rabita",
  "section_head",
]

describe("**مصفوفةُ شاشة الرواتب المركزية — الحضورُ بالعدسة والغيابُ صريح**", () => {
  it("عقدُ الشاشة يعلن موطنَها ومصدرَها وعدساتِها وفراغَيها (G20/ق-١١١/ق-١١٢)", () => {
    expect(PAYROLL_CONTRACT.route).toBe("/finance/payroll")
    expect(PAYROLL_CONTRACT.surface).toBe("centralFinance")
    expect(PAYROLL_CONTRACT.canonicalHome, "IA ك-٢٩ — موطنٌ واحدٌ لا ثانيَ له").toEqual(["payroll"])
    expect(PAYROLL_CONTRACT.dataSource, "الحقيقةُ الواحدة في الصفحة").toBe("payroll.monthlyPlan")
    expect(TEXT[PAYROLL_CONTRACT.emptyStates.owner]).toContain("لا مستحقّات")
  })

  it("**ق-٣٠ — `amir` ليس من عدسات هذه الشاشة أصلاً**، ولا يبني منها عنصراً واحداً", () => {
    expect(PAYROLL_CONTRACT.lenses, "المنعُ في العقد قبل التصيير").not.toContain("amir")
    const caps = computePayrollCaps(canonicalActor("u-amir"), KHALID_PATH, DECISION)
    expect(payrollScreenNodes(caps, EMPTY_PAYROLL_SNAPSHOT).component).toBe("EmptyState")
  })

  it("**وكلُّ دورٍ لا يملك `payroll.view` يرى فراغَ المطّلع** — ثمانيةُ أدوارٍ سلباً", () => {
    for (const role of DENIED_ROLES) {
      const caps = new Set<CapId>(ROLE_CAPABILITIES[role])
      expect(caps.has("payroll.view"), `${role} لا يملك عرضَ الرواتب`).toBe(false)
      expect(payrollScreenNodes(caps, EMPTY_PAYROLL_SNAPSHOT).component, role).toBe("EmptyState")
    }
  })

  it("**والمسؤولُ الماليّ يرى الجدولَ وزرَّ الرفع** — ولا يرى بابَ إقرارٍ (فصلُ المهام)", () => {
    const caps = new Set<CapId>(ROLE_CAPABILITIES["finance_officer"])
    const seen = visibleCaps(payrollScreenNodes(caps, EMPTY_PAYROLL_SNAPSHOT))
    expect(seen).toContain("payroll.view")
    expect(seen).toContain("payroll.run")
    expect(seen, "**الإقرارُ بابُه في المحرّك لا هنا** (G22)").not.toContain("payroll.approve")
  })

  it("**والمديرُ يرى الجدولَ ولا يرى زرَّ الرفع ولا زرَّ التسليم** — لا يملكهما", () => {
    const caps = new Set<CapId>(ROLE_CAPABILITIES["admin"])
    const sealed = visibleCaps(payrollScreenNodes(caps, { ...EMPTY_PAYROLL_SNAPSHOT, stage: "sealed" }))
    expect(sealed).toContain("payroll.view")
    expect(sealed, "من يقرّ لا يرفع").not.toContain("payroll.run")
    expect(sealed, "ومن يقرّ لا يصرف").not.toContain("finance.payout")
  })

  it("**ولا قدرةَ تظهر لأحدٍ لا يملكها** — الجسرُ ثنائيُّ الاتجاه على كل دورٍ حيّ", () => {
    const leaks: string[] = []
    for (const role of [...DENIED_ROLES, "admin", "finance_officer"] as readonly RoleId[]) {
      const caps = new Set<CapId>(ROLE_CAPABILITIES[role])
      for (const shown of visibleCaps(payrollScreenNodes(caps, EMPTY_PAYROLL_SNAPSHOT))) {
        if (!caps.has(shown as CapId)) leaks.push(`${role} يرى «${shown}» وليست له`)
      }
    }
    expect(leaks).toEqual([])
  })
})

describe("**مصفوفةُ «كشفُ راتبي» — قدرةٌ شخصيةٌ لكل عاملٍ ولا يفتحها الشمول**", () => {
  it("عقدُها **بلا موطنٍ قانونيّ**: عرضٌ منسوبٌ لا نسخةُ حقيقة (IA §١)", () => {
    expect(PAYSLIP_CONTRACT.route).toBe("/account/payslip")
    expect(PAYSLIP_CONTRACT.canonicalHome).toEqual([])
    expect(PAYSLIP_CONTRACT.capabilities).toEqual(["payroll.own"])
  })

  it("**وكلُّ دورٍ حيٍّ في عدساتها يملك `payroll.own` فعلاً** — لا بابَ بلا قدرة", () => {
    for (const role of PAYSLIP_CONTRACT.lenses) {
      expect(ROLE_CAPABILITIES[role], role).toContain("payroll.own")
    }
  })

  it("**ومَن لا يملكها يرى فراغَ المطّلع** — والقدرةُ الشخصية لا تُمنح بالشمول (ق-٢٧)", () => {
    expect(payslipScreenNodes(new Set(), EMPTY_PAYROLL_SNAPSHOT).component).toBe("EmptyState")
  })
})

// ═══ ع-٢٥ في الشاشة: **كلُّ سببِ صمتٍ له نصٌّ مقروء** ═════════════════════════

describe("**ع-٢٥ في الشاشة — لا رمزَ صمتٍ بلا عربيّةٍ مدقَّقة**", () => {
  const ALL_CODES: readonly SilenceCode[] = [
    "LESSONS_RECORDED_NOT_APPROVED",
    "CURRICULUM_NOT_PAID",
    "NO_LESSONS_RECORDED",
    "HOURLY_RATE_UNSET",
    "POINTS_RECORDED_NOT_APPROVED",
    "NO_POINTS_RECORDED",
    "POINT_RATE_UNSET",
    "NOT_POINTS_BENEFICIARY",
    "NOT_FIXED_SALARY_STAFF",
    "FIXED_SALARY_UNSET",
  ]

  it("**كلُّ سببٍ في الكتالوج له مفتاحُ نصٍّ، وكلُّ نصٍّ يبدأ بـ«صفر —»**", () => {
    for (const code of ALL_CODES) {
      const key = silenceTextKey(code)
      expect(TEXT[key], `${code} بلا نصّ`).toBeDefined()
      expect(TEXT[key], `${code} لا يشرح نفسه`).toMatch(/^صفر — /)
    }
  })

  it("**والسطرُ الصفريّ يحمل سببَه في عمود «بيانُ الاحتساب»** — لا خانةً فارغة", () => {
    const view: MonthlyPlanView = {
      unitPath: KHALID_PATH,
      periodId: "2026-07",
      stage: "derived",
      lines: [
        {
          personId: "u-teacher",
          unitPath: KHALID_PATH,
          tracks: [],
          silences: [{ track: "hours", code: "LESSONS_RECORDED_NOT_APPROVED", count: 4 }],
          grossCents: 0 as Cents,
          deductionCents: 0 as Cents,
          netCents: 0 as Cents,
        },
      ],
      totalNetCents: 0 as Cents,
      drift: [],
      paidPersonIds: [],
    }

    const snapshot = projectPayrollSnapshot(view, {
      unitLabelAr: "مسجد خالد",
      currencyCode: "USD",
      fractionDigits: 2,
    })

    expect(snapshot.rows[0]?.why, "**صفرٌ صامتٌ في الشاشة = ع-٢٥ من جديد**").toBe(
      "payroll.silence.lessonsNotApproved",
    )
    expect(snapshot.rows[0]?.net, "والرقمُ صفرٌ بالأرقام العربية المنسّقة").toContain("٠")
  })

  it("**والسطرُ المُثمِر يحمل أوجهَ استحقاقه مجتمعة** (ق-٣٨) لا سبباً", () => {
    const view: MonthlyPlanView = {
      unitPath: KHALID_PATH,
      periodId: "2026-07",
      stage: "sealed",
      lines: [
        {
          personId: "u-teacher",
          unitPath: KHALID_PATH,
          tracks: [
            { basis: { kind: "hours", lessonCount: 1, minutes: 60, lessonIds: ["l1"], hourlyRateCents: 400 as Cents }, amountCents: 400 as Cents },
            { basis: { kind: "points", points: 280, periodKeys: ["w1"], packageAmountCents: 5000 as Cents, packagePoints: 280 }, amountCents: 5000 as Cents },
          ],
          silences: [{ track: "fixed", code: "NOT_FIXED_SALARY_STAFF" }],
          grossCents: 5400 as Cents,
          deductionCents: 0 as Cents,
          netCents: 5400 as Cents,
        },
      ],
      totalNetCents: 5400 as Cents,
      drift: [
        { personId: "u-teacher", sealedNetCents: 5400 as Cents, liveNetCents: 5800 as Cents, deltaCents: 400 as Cents },
      ],
      paidPersonIds: ["u-teacher"],
    }

    const snapshot = projectPayrollSnapshot(view, {
      unitLabelAr: "مسجد خالد",
      currencyCode: "USD",
      fractionDigits: 2,
    })

    expect(snapshot.rows[0]?.why).toBe("payroll.basisHours · payroll.basisPoints")
    expect(snapshot.rows[0]?.paid, "«سُلّم» مشتقٌّ من سجل الصرف").toBe("u-teacher")
    expect(snapshot.stage).toBe("sealed")
    expect(snapshot.driftRows, "**الفارقُ يُعلَن**").toHaveLength(1)

    // ويظهر جدولُ الفارق في الشجرة حين يوجد — «الصمتُ عيبٌ».
    const caps = new Set<CapId>(ROLE_CAPABILITIES["admin"])
    expect(JSON.stringify(payrollScreenNodes(caps, snapshot))).toContain("payroll.driftSealed")
  })
})
