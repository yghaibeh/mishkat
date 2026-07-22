/**
 * شاشتا الرواتب — عقودُهما في `SPEC.md` §١٠، وحاكمُها G20.
 *
 * **طبقةُ عرضٍ نقيّة**: دالةٌ من (قشرةِ القدرات المحسوبة + لقطةِ الصفحة) إلى بنية عرض.
 * لا تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦)، **ولا تحسب رقماً**: كلُّ رقمٍ مُسقَطٌ من
 * **نموذج الصفحة الواحد** (`monthlyPlan`) — وهو علاجُ ج٥ (انفصامُ الكتابة عن القراءة).
 *
 * **وهنا يموت ع-٢١ بالنموذج**: شريطُ المراحل الثلاث **جزءٌ من الشاشة لا حاشيةٌ فيها**،
 * وزرُّ التسليم **لا يُبنى قبل الختم** — لأن النموذج لا يُتيحه، لا لأن الشاشة تُخفيه.
 * **ويموت ع-٢٥ كذلك**: عمودُ «بيانُ الاحتساب» **إلزاميّ**، وسطرٌ صفريٌّ بلا سببٍ لا يُبنى
 * أصلاً — فالنموذجُ لا يُنتجه (`TrackOutcome` اتحادٌ لا ثالثَ له).
 */

import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import { appShell, navProjection } from "../../../ui/shell/shell.js"
import { button } from "../../../ui/components/atoms.js"
import { statCard } from "../../../ui/components/molecules.js"
import { dataTable, emptyState } from "../../../ui/components/organisms.js"
import type { UiNode } from "../../../ui/components/kernel.js"
import { registerScreen } from "../../../ui/screens/registry.js"
import type { ScreenContract } from "../../../ui/screens/contract.js"
import type { TextKey } from "../../../ui/text/dictionary.js"
import { formatMoney } from "../../../ui/text/format.js"
import { fromCents } from "../../ledger/services/money.js"
import type { Cents } from "../../ledger/types.js"
import type { MonthlyPlanView, PlanStage, SilenceCode } from "../types.js"

type Caps = ReadonlySet<CapId>

/** قيمةٌ غائبةٌ في المعاينة — محرفٌ محايدٌ لا نصَّ فيه (لا حرفَ خارج طبقة النصوص). */
const ABSENT = "—"

export type PayrollRow = Readonly<Record<string, string>>

/** لقطةُ الصفحة — **مصدرُ بياناتٍ واحد** (ق-١١١)، منسّقةٌ في طبقةٍ واحدة قبل العرض. */
export type PayrollSnapshot = {
  readonly unitLabelAr: string
  readonly scopePath: string
  readonly stage: PlanStage
  readonly totalAr: string
  readonly rows: readonly PayrollRow[]
  readonly driftRows: readonly PayrollRow[]
  readonly mapRows: readonly PayrollRow[]
  readonly remainingAr: string
}

export const EMPTY_PAYROLL_SNAPSHOT: PayrollSnapshot = Object.freeze({
  unitLabelAr: ABSENT,
  scopePath: "/",
  stage: "derived",
  totalAr: ABSENT,
  rows: Object.freeze([]),
  driftRows: Object.freeze([]),
  mapRows: Object.freeze([]),
  remainingAr: ABSENT,
})

export type DisplayMoney = {
  readonly unitLabelAr: string
  /** من الإعدادات الحيّة (قب-٦) — لا عملةَ صلبةٌ في العرض. */
  readonly currencyCode: string
  readonly fractionDigits: number
}

/**
 * **مفتاحُ نصِّ سببِ الصفر** — الترجمةُ الوحيدةُ من رمزٍ في النموذج إلى حرفٍ للمستخدم،
 * وموضعُها **طبقةُ العرض** لا الخدمة (المادة ٣/٤: رسالةُ المستخدم من العرض).
 * وهي **خريطةٌ كاملةٌ بحكم النوع**: رمزٌ جديدٌ بلا نصٍّ **لا يُترجَم** (G1 تمسكه زمن البناء).
 */
const SILENCE_TEXT: Readonly<Record<SilenceCode, TextKey>> = Object.freeze({
  LESSONS_RECORDED_NOT_APPROVED: "payroll.silence.lessonsNotApproved",
  CURRICULUM_NOT_PAID: "payroll.silence.curriculumNotPaid",
  NO_LESSONS_RECORDED: "payroll.silence.noLessons",
  HOURLY_RATE_UNSET: "payroll.silence.hourlyRateUnset",
  POINTS_RECORDED_NOT_APPROVED: "payroll.silence.pointsNotApproved",
  NO_POINTS_RECORDED: "payroll.silence.noPoints",
  POINT_RATE_UNSET: "payroll.silence.pointRateUnset",
  NOT_POINTS_BENEFICIARY: "payroll.silence.notBeneficiary",
  NOT_FIXED_SALARY_STAFF: "payroll.silence.notFixedStaff",
  FIXED_SALARY_UNSET: "payroll.silence.fixedUnset",
})

export function silenceTextKey(code: SilenceCode): TextKey {
  return SILENCE_TEXT[code]
}

/** التنسيقُ **مخرجُ العرض الوحيد**: السنتُ يُحوَّل بـ`fromCents` ثم يُنسَّق (ق-٤٨، §١.٢). */
function amountAr(value: Cents, currencyCode: string, fractionDigits: number): string {
  return formatMoney({ amount: Number(fromCents(value)), currencyCode, fractionDigits })
}

/** مفاتيحُ وصفِ المسارات — بأيّ وجهٍ استُحقّ («تُجمَع ولا يُختار أحدُها» — ق-٣٨). */
const BASIS_TEXT = Object.freeze({
  hours: "payroll.basisHours",
  points: "payroll.basisPoints",
  fixed: "payroll.basisFixed",
})

/** إسقاطُ نموذج الصفحة إلى لقطةِ عرضٍ — **بلا حسابٍ جديد**، تنسيقٌ فقط. */
export function projectPayrollSnapshot(
  view: MonthlyPlanView,
  display: DisplayMoney,
  mapRows: readonly PayrollRow[] = [],
  remaining: Cents = 0 as Cents,
): PayrollSnapshot {
  const digits = display.fractionDigits
  const paid = new Set(view.paidPersonIds)
  return {
    unitLabelAr: display.unitLabelAr,
    scopePath: view.unitPath,
    stage: view.stage,
    totalAr: amountAr(view.totalNetCents, display.currencyCode, digits),
    rows: view.lines.map((line) => ({
      person: line.personId,
      gross: amountAr(line.grossCents, display.currencyCode, digits),
      deduction: amountAr(line.deductionCents, display.currencyCode, digits),
      net: amountAr(line.netCents, display.currencyCode, digits),
      // **بيانُ الاحتساب حاضرٌ دائماً**: أوجهُ الاستحقاق، أو **سببُ الصفر** — ولا ثالث.
      why:
        line.tracks.length > 0
          ? line.tracks.map((t) => BASIS_TEXT[t.basis.kind]).join(" · ")
          : line.silences.map((s) => SILENCE_TEXT[s.code]).join(" · "),
      paid: paid.has(line.personId) ? line.personId : "",
    })),
    driftRows: view.drift.map((d) => ({
      person: d.personId,
      sealed: amountAr(d.sealedNetCents, display.currencyCode, digits),
      live: amountAr(d.liveNetCents, display.currencyCode, digits),
      delta: amountAr(d.deltaCents, display.currencyCode, digits),
    })),
    mapRows,
    remainingAr: amountAr(remaining, display.currencyCode, digits),
  }
}

/** فراغُ المطّلع مُشخِّصٌ دائماً (ق-١١٢)، وبطابع المحراب (قب-٢٥ — من المكوّن نفسِه). */
function viewerEmpty(): UiNode {
  return emptyState({
    audience: "viewer",
    titleKey: "state.deniedTitle",
    diagnosisKey: "state.deniedHint",
  })
}

/** **مفتاحُ نصِّ المرحلة** — المرحلةُ من النموذج، والشاشةُ تترجمها ولا تخترعها (ع-٢١). */
const STAGE_TEXT: Readonly<Record<PlanStage, TextKey>> = Object.freeze({
  derived: "payroll.stageDerived",
  pending: "payroll.stagePending",
  sealed: "payroll.stageSealed",
})

function shell(caps: Caps, snapshot: PayrollSnapshot, content: readonly UiNode[]): UiNode {
  return appShell({
    nav: navProjection({ caps, priority: null, currentSurface: "centralFinance" }),
    scopePath: snapshot.scopePath,
    scopeLabelAr: snapshot.unitLabelAr,
    showSearch: false,
    content,
  })
}

// ── شاشةُ الرواتب المركزية ───────────────────────────────────────────────────

export const PAYROLL_CONTRACT: ScreenContract = Object.freeze({
  route: "/finance/payroll",
  surface: "centralFinance",
  // **ق-٣٠**: `amir` **ليس** من عدسات هذه الشاشة — والمنعُ في المصفوفة قبل العدسة.
  lenses: ["admin", "finance_officer"] as const,
  // موطنُ «الرواتب/الحوافز/الاستحقاق» (IA §١ ك-٢٩) — لا موطنَ ثانٍ له.
  canonicalHome: ["payroll"] as const,
  capabilities: ["payroll.view", "payroll.run", "finance.payout", "incentive.manage"] as const,
  dataSource: "payroll.monthlyPlan",
  emptyStates: { owner: "payroll.emptyOwner", viewer: "payroll.emptyViewer" } as const,
})

export function payrollScreenNodes(caps: Caps, snapshot: PayrollSnapshot): UiNode {
  // **ق-٣٠ بالنموذج**: مَن لا يملك عرضَ الرواتب لا يرى رقماً واحداً — لا مخفياً ولا معطّلاً.
  if (!caps.has("payroll.view")) return viewerEmpty()

  const blocks: UiNode[] = []

  /**
   * **شريطُ المرحلة — علاجُ ع-٢١**: «أين وصلت دورةُ هذا الشهر؟» جوابُها **في الصفحة**
   * قبل أيّ زر. والفعلُ المقترنُ بها **يتبع المرحلة والقدرةَ معاً**:
   *  - **المرحلةُ** تحكم أيَّ فعلٍ يصحّ: رفعٌ قبل الإقرار، وتسليمٌ بعد الختم.
   *  - **والقدرةُ** تحكم هل يُبنى الزرُّ أصلاً — فمن لا يملكه **لا يراه معطّلاً بل لا يراه**.
   *
   * > **وهنا يظهر فصلُ المهام في الشاشة كما هو في المصفوفة** (ب-٣٣): `admin` يملك الإقرار
   * > **ولا يملك `payroll.run`** — فلا يُبنى له زرُّ الرفع أصلاً؛ و`finance_officer` يملك
   * > الرفعَ والتسليم ولا يملك الإقرار — فبابُه في شاشة المحرّك لا هنا. **اصطاده سياجُ
   * > الواجهة بالفشل** حين بُني الزرُّ بلا قيدِ قدرة، فصار القيدُ في البناء لا في النيّة.
   */
  const stageAction = ((): UiNode => {
    if (snapshot.stage === "sealed" && caps.has("finance.payout")) {
      return button({ labelKey: "payroll.payout", variant: "primary", capability: "finance.payout" })
    }
    if (snapshot.stage !== "sealed" && caps.has("payroll.run")) {
      return button({ labelKey: "payroll.submit", variant: "primary", capability: "payroll.run" })
    }
    // مطّلعٌ بلا فعل: **الرقمُ يقود إلى بيانه** لا إلى زرٍّ يُرفض (ق-١٠٨).
    return button({ labelKey: "payroll.why", variant: "ghost", capability: "payroll.view" })
  })()

  blocks.push(
    statCard({
      sentenceKey: "payroll.stageHeading",
      valueAr: ABSENT,
      scopeNoteKey: STAGE_TEXT[snapshot.stage],
      action: stageAction,
      tone: "brand",
    }),
    statCard({
      sentenceKey: "payroll.totalSentence",
      valueAr: snapshot.totalAr,
      scopeNoteKey: "payroll.stageNote",
      action: button({
        labelKey: "payroll.why",
        variant: "ghost",
        capability: "payroll.view",
      }),
    }),
  )

  /**
   * **جدولُ المستحقات — وعمودُ «بيانُ الاحتساب» إلزاميّ** (ع-٢٥): لا رقمَ بلا سببه،
   * ولا صفرَ صامت. وهو عمودٌ في **العقد** لا زينةٌ تُنسى.
   */
  blocks.push(
    dataTable({
      columns: [
        { key: "person", labelKey: "payroll.person" },
        { key: "gross", labelKey: "payroll.gross" },
        { key: "deduction", labelKey: "payroll.deduction" },
        { key: "net", labelKey: "payroll.net" },
        { key: "why", labelKey: "payroll.why" },
        { key: "paid", labelKey: "payroll.paid" },
      ],
      rows: snapshot.rows,
      state: snapshot.rows.length === 0 ? "empty" : "data",
      capability: "payroll.view",
      emptyState: caps.has("payroll.run")
        ? emptyState({
            audience: "owner",
            titleKey: "payroll.emptyOwner",
            actionKey: "payroll.submit",
            capability: "payroll.run",
          })
        : emptyState({
            audience: "viewer",
            titleKey: "payroll.emptyViewer",
            diagnosisKey: "state.emptyViewerIdle",
          }),
    }),
  )

  // **الفارقُ بعد الختم يُعلَن ولا يُطبَّق** (§٢-٣): يظهر حين يوجد، ويشرح أنه لا يمسّ المُقرّ.
  if (snapshot.driftRows.length > 0) {
    blocks.push(
      dataTable({
        columns: [
          { key: "person", labelKey: "payroll.person" },
          { key: "sealed", labelKey: "payroll.driftSealed" },
          { key: "live", labelKey: "payroll.driftLive" },
          { key: "delta", labelKey: "payroll.driftDelta" },
        ],
        rows: snapshot.driftRows,
        state: "data",
        capability: "payroll.view",
        emptyState: emptyState({
          audience: "viewer",
          titleKey: "payroll.driftHeading",
          diagnosisKey: "payroll.driftNote",
        }),
      }),
    )
  }

  // **خريطةُ التوزيع** (ق-٦٦): «صُرف كذا من كذا — المتبقي عند…»، كلُّ توقّفٍ بصاحبه.
  blocks.push(
    statCard({
      sentenceKey: "payroll.mapSentence",
      valueAr: snapshot.remainingAr,
      scopeNoteKey: "payroll.mapScopeNote",
      action: button({ labelKey: "payroll.mapHeading", variant: "ghost", capability: "payroll.view" }),
    }),
    dataTable({
      columns: [
        { key: "unit", labelKey: "payroll.mapUnit" },
        { key: "person", labelKey: "payroll.person" },
        { key: "net", labelKey: "payroll.mapRemaining" },
      ],
      rows: snapshot.mapRows,
      state: snapshot.mapRows.length === 0 ? "empty" : "data",
      capability: "payroll.view",
      emptyState: emptyState({
        audience: "viewer",
        titleKey: "payroll.emptyMap",
        diagnosisKey: "payroll.mapStop",
      }),
    }),
  )

  return shell(caps, snapshot, blocks)
}

registerScreen({
  contract: PAYROLL_CONTRACT,
  preview: (caps) => payrollScreenNodes(caps, EMPTY_PAYROLL_SNAPSHOT),
})

// ── شاشةُ «كشفُ راتبي» (ق-٢٩ — القدرةُ الشخصية) ──────────────────────────────

export const PAYSLIP_CONTRACT: ScreenContract = Object.freeze({
  route: "/account/payslip",
  surface: "personal",
  // **كلُّ دورٍ حيٍّ يملك `payroll.own`** — فالكشفُ الشخصيُّ حقُّ كل عامل، لا امتيازُ إدارة.
  lenses: [
    "admin",
    "section_head",
    "rabita",
    "square",
    "amir",
    "teacher",
    "committee_head",
    "media",
    "finance_officer",
  ] as const,
  canonicalHome: [] as const,
  capabilities: ["payroll.own"] as const,
  dataSource: "payroll.ownPayslip",
  emptyStates: { owner: "payroll.emptyMine", viewer: "payroll.emptyMine" } as const,
})

export function payslipScreenNodes(caps: Caps, snapshot: PayrollSnapshot): UiNode {
  if (!caps.has("payroll.own")) return viewerEmpty()

  return shell(caps, snapshot, [
    statCard({
      sentenceKey: "payroll.mineSentence",
      valueAr: snapshot.totalAr,
      scopeNoteKey: "payroll.mineScopeNote",
      action: button({ labelKey: "payroll.mineDetails", variant: "ghost", capability: "payroll.own" }),
    }),
    dataTable({
      columns: [
        { key: "gross", labelKey: "payroll.gross" },
        { key: "deduction", labelKey: "payroll.deduction" },
        { key: "net", labelKey: "payroll.net" },
        // **وفي كشفه أيضاً**: لا يرى صفراً بلا سببه (ع-٢٥ من جهة صاحب الحق).
        { key: "why", labelKey: "payroll.why" },
      ],
      rows: snapshot.rows,
      state: snapshot.rows.length === 0 ? "empty" : "data",
      capability: "payroll.own",
      emptyState: emptyState({
        audience: "owner",
        titleKey: "payroll.emptyMine",
        actionKey: "payroll.mineDetails",
        capability: "payroll.own",
      }),
    }),
  ])
}

registerScreen({
  contract: PAYSLIP_CONTRACT,
  preview: (caps) => payslipScreenNodes(caps, EMPTY_PAYROLL_SNAPSHOT),
})
