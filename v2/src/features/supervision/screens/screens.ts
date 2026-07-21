/**
 * شاشاتُ الإشراف الثلاث — عقودُها في `SPEC.md` §٦، وحاكمُها G20.
 *
 * **طبقةُ عرضٍ نقيّة**: دالةٌ من (قشرةِ القدرات المحسوبة + لقطةِ الصفحة) إلى بنية عرض. لا
 * تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦)، **ولا تحسب رقماً**: كلُّ رقمٍ فيها مُسقَطٌ من
 * مصدر بياناتها الواحد (ق-١١١).
 *
 * وثلاثةُ ثوابتٍ من ق-١٠١ تُرى بالعين هنا:
 *  - **لوحةُ المكلَّف قائمةُ عملٍ**: أهدافٌ مرتَّبةٌ بالحاجة ونموذجُ تسجيلٍ — أفعالٌ مملوكة.
 *  - **العرضُ القياديُّ تشخيصٌ**: وحداتٌ ومسؤولوها وتغطيتُها، **بلا زرٍّ تشغيليّ** (ق-١٠٩).
 *  - **الأميرُ يرى ولا ينفّذ** (عدسة §٢.٥ بابُ ٨): زياراتُ مسجده باسم معتمِدها (ق-١٠٢).
 * و**لا زرَّ اعتمادٍ فوق صندوقٍ فارغ**: مكانَه سطرٌ يقول إنه فارغ (ق-١١٢) — نظيرُ ق-١٠ في سجل اليوم.
 */

import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import { appShell, navProjection } from "../../../ui/shell/shell.js"
import { button } from "../../../ui/components/atoms.js"
import { field, form, listItem, statCard } from "../../../ui/components/molecules.js"
import { dataTable, emptyState } from "../../../ui/components/organisms.js"
import type { UiNode } from "../../../ui/components/kernel.js"
import { registerScreen } from "../../../ui/screens/registry.js"
import type { ScreenContract } from "../../../ui/screens/contract.js"
import { formatNumber } from "../../../ui/text/format.js"

type Caps = ReadonlySet<CapId>

/** قيمةٌ غائبةٌ في المعاينة — محرفٌ محايدٌ لا نصَّ فيه (لا حرفَ خارج طبقة النصوص). */
const ABSENT = "—"
const ZERO_AR = formatNumber(0)

export type SupervisionRow = Readonly<Record<string, string>>

/** فراغُ المطّلع مُشخِّصٌ دائماً (ق-١١٢)، وبطابع المحراب (قب-٢٥ — من المكوّن نفسِه). */
function viewerEmpty(): UiNode {
  return emptyState({
    audience: "viewer",
    titleKey: "state.deniedTitle",
    diagnosisKey: "state.deniedHint",
  })
}

function shell(
  caps: Caps,
  surface: "bayan" | "myMosque",
  scopePath: string,
  labelAr: string,
  content: readonly UiNode[],
): UiNode {
  return appShell({
    nav: navProjection({ caps, priority: null, currentSurface: surface }),
    scopePath,
    scopeLabelAr: labelAr,
    showSearch: false,
    content,
  })
}

// ── ١) لوحةُ المكلَّف التشغيلية ───────────────────────────────────────────────
export type BoardSnapshot = {
  readonly scopePath: string
  readonly unitLabelAr: string
  readonly dueCountAr: string
  readonly targetRows: readonly SupervisionRow[]
  readonly pendingRows: readonly SupervisionRow[]
  /** صندوقُ الاعتماد غيرُ فارغ — تقرأه الشاشةُ ولا تجتهد (ق-١١٢). */
  readonly hasPending: boolean
}

export const EMPTY_BOARD_SNAPSHOT: BoardSnapshot = Object.freeze({
  scopePath: "/",
  unitLabelAr: ABSENT,
  dueCountAr: ZERO_AR,
  targetRows: Object.freeze([]),
  pendingRows: Object.freeze([]),
  hasPending: false,
})

export const SUPERVISION_BOARD_CONTRACT: ScreenContract = Object.freeze({
  route: "/supervision/board",
  surface: "bayan",
  lenses: ["section_head", "rabita", "square"] as const,
  // موطنُ «الزيارة الإشرافية» (IA §١ ك-٢٠) — لا موطنَ ثانٍ لها.
  canonicalHome: ["supervisionVisit"] as const,
  capabilities: ["visit.conduct", "visit.approve"] as const,
  dataSource: "supervision.board.view",
  emptyStates: { owner: "supervision.emptyOwner", viewer: "state.deniedTitle" } as const,
})

export function supervisionBoardScreenNodes(caps: Caps, snapshot: BoardSnapshot): UiNode {
  const conducts = caps.has("visit.conduct")
  const approves = caps.has("visit.approve")
  if (!conducts && !approves) return viewerEmpty()

  const blocks: UiNode[] = []

  if (conducts) {
    // «مَن أزور اليوم؟» — رقمٌ يقود لفعل، ونطاقُه منطوقٌ على الصفحة (ق-١٠٨/ق-١١٠).
    blocks.push(
      statCard({
        sentenceKey: "supervision.dueNow",
        valueAr: snapshot.dueCountAr,
        scopeNoteKey: "supervision.scopeNote",
        action: button({
          labelKey: "supervision.record",
          variant: "primary",
          capability: "visit.conduct",
        }),
        tone: "brand",
      }),
      dataTable({
        columns: [
          { key: "target", labelKey: "supervision.target" },
          { key: "status", labelKey: "supervision.status" },
          { key: "lastVisit", labelKey: "supervision.lastVisit" },
          { key: "cadence", labelKey: "supervision.cadence" },
        ],
        rows: snapshot.targetRows,
        state: snapshot.targetRows.length === 0 ? "empty" : "data",
        capability: "visit.conduct",
        emptyState: emptyState({
          audience: "owner",
          titleKey: "supervision.emptyTargets",
          actionKey: "supervision.emptyOwner",
          capability: "visit.conduct",
        }),
      }),
      // ق-١٠٠: النموذجُ مطبوعٌ بحقول النوع — والحقولُ التفصيلية تُبنى من عقد النوع نفسِه.
      form({
        schema: "supervisionVisitInput",
        fields: [
          field({ name: "targetId", labelKey: "supervision.target", kind: "select", required: true }),
          field({ name: "attendees", labelKey: "supervision.attendees", kind: "number", required: true }),
          field({ name: "ratingPct", labelKey: "supervision.rating", kind: "number", required: true }),
          field({ name: "noteAr", labelKey: "supervision.note", kind: "textarea" }),
        ],
        submit: button({
          labelKey: "supervision.record",
          variant: "primary",
          capability: "visit.conduct",
        }),
      }),
    )
  }

  // ق-١٦: صندوقُ «بانتظار اعتمادك» — **ولا زرَّ اعتمادٍ فوق صندوقٍ فارغ** (ق-١١٢).
  if (approves) {
    blocks.push(
      snapshot.hasPending
        ? dataTable({
            columns: [
              { key: "target", labelKey: "supervision.target" },
              { key: "supervisor", labelKey: "supervision.pendingSupervisor" },
              { key: "visitedAt", labelKey: "supervision.pendingDate" },
            ],
            rows: snapshot.pendingRows,
            state: "data",
            capability: "visit.approve",
            emptyState: emptyState({
              audience: "viewer",
              titleKey: "supervision.pending",
              diagnosisKey: "supervision.noPending",
            }),
          })
        : listItem({
            sentenceKey: "supervision.noPending",
            diagnosis: emptyState({
              audience: "viewer",
              titleKey: "supervision.pending",
              diagnosisKey: "supervision.pendingViewer",
            }),
          }),
    )
    if (snapshot.hasPending) {
      blocks.push(
        listItem({
          sentenceKey: "supervision.pending",
          action: button({
            labelKey: "supervision.approve",
            variant: "primary",
            capability: "visit.approve",
          }),
        }),
      )
    }
  }

  return shell(caps, "bayan", snapshot.scopePath, snapshot.unitLabelAr, blocks)
}

// ── ٢) العرضُ القياديّ (ق-١٠١) ────────────────────────────────────────────────
export type OverviewSnapshot = {
  readonly scopePath: string
  readonly unitLabelAr: string
  readonly weakestCoverageAr: string
  readonly rows: readonly SupervisionRow[]
}

export const EMPTY_OVERVIEW_SNAPSHOT: OverviewSnapshot = Object.freeze({
  scopePath: "/",
  unitLabelAr: ABSENT,
  weakestCoverageAr: ZERO_AR,
  rows: Object.freeze([]),
})

export const SUPERVISION_OVERVIEW_CONTRACT: ScreenContract = Object.freeze({
  route: "/supervision/overview",
  surface: "bayan",
  lenses: ["admin", "section_head", "rabita", "square"] as const,
  // عرضٌ منسوبٌ لا موطن: الزيارةُ موطنُها لوحةُ الإشراف وحدها (IA §١).
  canonicalHome: [] as const,
  capabilities: ["visit.view"] as const,
  dataSource: "supervision.overview.view",
  emptyStates: { owner: "supervision.emptyOverview", viewer: "state.deniedTitle" } as const,
})

export function supervisionOverviewScreenNodes(caps: Caps, snapshot: OverviewSnapshot): UiNode {
  if (!caps.has("visit.view")) return viewerEmpty()

  const blocks: UiNode[] = [
    // «كيف تقوم لي منطقتي؟» — الجوابُ سطرٌ واحدٌ يقود إلى الوحدة الأضعف (ق-١٠٨).
    statCard({
      sentenceKey: "supervision.weakestUnit",
      valueAr: snapshot.weakestCoverageAr,
      scopeNoteKey: "supervision.scopeNote",
      action: button({
        labelKey: "supervision.openUnit",
        variant: "ghost",
        capability: "visit.view",
      }),
      tone: "warning",
      iconName: "alert",
    }),
    dataTable({
      columns: [
        { key: "unit", labelKey: "supervision.unit" },
        { key: "responsible", labelKey: "supervision.responsible" },
        { key: "visited", labelKey: "supervision.visitedInCycle" },
        { key: "targets", labelKey: "supervision.targetCount" },
        { key: "coverage", labelKey: "supervision.coverage" },
      ],
      rows: snapshot.rows,
      state: snapshot.rows.length === 0 ? "empty" : "data",
      capability: "visit.view",
      emptyState: emptyState({
        audience: "viewer",
        titleKey: "supervision.emptyOverview",
        diagnosisKey: "supervision.emptyOverviewViewer",
      }),
    }),
  ]

  return shell(caps, "bayan", snapshot.scopePath, snapshot.unitLabelAr, blocks)
}

// ── ٣) زياراتُ مسجدي (عدسة الأمير — اطّلاعٌ لا تنفيذ) ─────────────────────────
export type MosqueVisitsSnapshot = {
  readonly scopePath: string
  readonly unitLabelAr: string
  readonly rows: readonly SupervisionRow[]
}

export const EMPTY_MOSQUE_VISITS_SNAPSHOT: MosqueVisitsSnapshot = Object.freeze({
  scopePath: "/",
  unitLabelAr: ABSENT,
  rows: Object.freeze([]),
})

export const MOSQUE_VISITS_CONTRACT: ScreenContract = Object.freeze({
  route: "/mosque/supervision",
  surface: "myMosque",
  lenses: ["amir"] as const,
  canonicalHome: [] as const,
  capabilities: ["visit.view"] as const,
  dataSource: "supervision.visits.list",
  emptyStates: { owner: "supervision.emptyMosqueVisits", viewer: "state.deniedTitle" } as const,
})

export function mosqueVisitsScreenNodes(caps: Caps, snapshot: MosqueVisitsSnapshot): UiNode {
  if (!caps.has("visit.view")) return viewerEmpty()

  const blocks: UiNode[] = [
    dataTable({
      columns: [
        { key: "date", labelKey: "supervision.visitDate" },
        { key: "curriculum", labelKey: "supervision.curriculum" },
        { key: "rating", labelKey: "supervision.visitRating" },
        // ق-١٠٢: عمودُ «اعتمدها» جزءٌ من الجدول لا حاشيةٌ اختيارية.
        { key: "approvedBy", labelKey: "supervision.approvedBy" },
      ],
      rows: snapshot.rows,
      state: snapshot.rows.length === 0 ? "empty" : "data",
      capability: "visit.view",
      emptyState: emptyState({
        audience: "viewer",
        titleKey: "supervision.emptyMosqueVisits",
        diagnosisKey: "supervision.emptyMosqueViewer",
      }),
    }),
  ]

  return shell(caps, "myMosque", snapshot.scopePath, snapshot.unitLabelAr, blocks)
}

registerScreen({
  contract: SUPERVISION_BOARD_CONTRACT,
  preview: (caps) => supervisionBoardScreenNodes(caps, EMPTY_BOARD_SNAPSHOT),
})
registerScreen({
  contract: SUPERVISION_OVERVIEW_CONTRACT,
  preview: (caps) => supervisionOverviewScreenNodes(caps, EMPTY_OVERVIEW_SNAPSHOT),
})
registerScreen({
  contract: MOSQUE_VISITS_CONTRACT,
  preview: (caps) => mosqueVisitsScreenNodes(caps, EMPTY_MOSQUE_VISITS_SNAPSHOT),
})
