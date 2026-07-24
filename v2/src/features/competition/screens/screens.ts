/**
 * شاشتا المسابقة — عقودُهما في `SPEC.md` §١١، وحاكمُهما G20.
 *
 * **طبقةُ عرضٍ نقيّة**: دالةٌ من (قشرةِ القدرات المحسوبة + لقطةِ الصفحة) إلى بنية عرض. لا
 * تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦)، **ولا تشتقّ رقماً**: الرتبةُ والرصيدُ وعددُ
 * المتبارين تصلها محسوبةً من `services/derive.ts` — **مصدرٌ واحدٌ للصفحة** (ق-١١١).
 *
 * **وشاشتان لا واحدة** لأنّ الموطنين اثنان (IA ك-٢١ المسابقة · ك-٢٢ المشترِك)، ولأنّ
 * **العدستين مختلفتان**: القائدُ يضبط ويُعلن، والأميرُ يبتّ ويرصد. وخلطُهما في شاشةٍ واحدة
 * يُظهر للمدير زرَّ بتٍّ لا يملكه — وهو عينُ ما تحرسه مصفوفةُ الشاشات.
 *
 * **والطابعُ قب-٢٥**: الفراغُ مِحرابٌ ينتظر (من مكوّن `EmptyState` نفسِه)، و**صفر صورة**.
 */

import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import { appShell, navProjection } from "../../../ui/shell/shell.js"
import { button } from "../../../ui/components/atoms.js"
import { field, form, statCard } from "../../../ui/components/molecules.js"
import { dataTable, emptyState } from "../../../ui/components/organisms.js"
import type { UiNode } from "../../../ui/components/kernel.js"
import { registerScreen } from "../../../ui/screens/registry.js"
import type { ScreenContract } from "../../../ui/screens/contract.js"
import { formatNumber } from "../../../ui/text/format.js"

type Caps = ReadonlySet<CapId>

/** قيمةٌ غائبةٌ في المعاينة — محرفٌ محايدٌ لا نصَّ فيه (لا حرفَ خارج طبقة النصوص). */
const ABSENT = "—"

export type CompetitionRow = Readonly<Record<string, string>>

/** لقطةُ الصفحة — **مصدرُ بياناتٍ واحد** (ق-١١١)، منسّقةٌ في طبقةٍ واحدة قبل العرض. */
export type CompetitionSnapshot = {
  readonly unitLabelAr: string
  readonly scopePath: string
  readonly competitionRows: readonly CompetitionRow[]
  readonly pendingRows: readonly CompetitionRow[]
  readonly totalAr: string
  readonly pendingTotalAr: string
}

export const EMPTY_COMPETITION_SNAPSHOT: CompetitionSnapshot = Object.freeze({
  unitLabelAr: ABSENT,
  scopePath: "/",
  competitionRows: Object.freeze([]),
  pendingRows: Object.freeze([]),
  totalAr: formatNumber(0),
  pendingTotalAr: formatNumber(0),
})

/** فراغُ المطّلع مُشخِّصٌ دائماً (ق-١١٢)، وبطابع المحراب (قب-٢٥ — من المكوّن نفسِه). */
function viewerEmpty(): UiNode {
  return emptyState({
    audience: "viewer",
    titleKey: "state.deniedTitle",
    diagnosisKey: "state.deniedHint",
  })
}

function shell(caps: Caps, snapshot: CompetitionSnapshot, content: readonly UiNode[]): UiNode {
  return appShell({
    nav: navProjection({ caps, priority: null, currentSurface: "competition" }),
    scopePath: snapshot.scopePath,
    scopeLabelAr: snapshot.unitLabelAr,
    showSearch: false,
    content,
  })
}

// ── شاشةُ «المسابقة» ─────────────────────────────────────────────────────────
export const COMPETITION_SCOPE_CONTRACT: ScreenContract = Object.freeze({
  route: "/competition",
  surface: "competition",
  lenses: ["admin", "section_head", "rabita", "square", "amir"] as const,
  // موطنُ «المسابقة» (IA ك-٢١) — والمشترِكُ موطنُه الشاشةُ الأخرى، فلا كيانَ في موطنين.
  canonicalHome: ["competition"] as const,
  capabilities: ["competition.view", "competition.manage", "competition.result.declare"] as const,
  dataSource: "competition.scopeView",
  emptyStates: { owner: "competition.emptyOwner", viewer: "state.deniedTitle" } as const,
})

export function competitionScopeScreenNodes(caps: Caps, snapshot: CompetitionSnapshot): UiNode {
  if (!caps.has("competition.view")) return viewerEmpty()

  const blocks: UiNode[] = [
    // **النطاقُ منطوقٌ على الصفحة** (ق-١١٠): لا رقمَ شبكيٍّ داخل صفحة وحدة.
    statCard({
      sentenceKey: "competition.statsSentence",
      valueAr: snapshot.totalAr,
      scopeNoteKey: "competition.statsScopeNote",
      action: button({
        labelKey: "competition.heading",
        variant: "ghost",
        capability: "competition.view",
      }),
      tone: "brand",
    }),
    dataTable({
      columns: [
        { key: "title", labelKey: "competition.titleLabel" },
        { key: "scope", labelKey: "competition.scopeLabel" },
        { key: "status", labelKey: "competition.statusLabel" },
        // **كلُّ رقمٍ اشتقاقٌ** لا عدّادٌ مخزَّن (ق-٩٢) — ومن المصدر نفسِه لا من ثانٍ.
        { key: "contestants", labelKey: "competition.contestants" },
        { key: "pending", labelKey: "competition.pending" },
      ],
      rows: snapshot.competitionRows,
      state: snapshot.competitionRows.length === 0 ? "empty" : "data",
      capability: "competition.view",
      emptyState: caps.has("competition.manage")
        ? emptyState({
            audience: "owner",
            titleKey: "competition.heading",
            actionKey: "competition.emptyOwner",
            capability: "competition.manage",
          })
        : emptyState({
            audience: "viewer",
            titleKey: "competition.heading",
            diagnosisKey: "competition.emptyScope",
          }),
    }),
  ]

  // **ضبطُ المسابقة لصاحب `competition.manage` على نطاقه** (ت-١/قب-٤: كلُّ قائدٍ داخل نطاقه).
  if (caps.has("competition.manage")) {
    blocks.push(
      form({
        schema: "competitionCreateInput",
        fields: [
          field({ name: "titleAr", labelKey: "competition.titleLabel", kind: "text", required: true }),
          field({ name: "startMonthHijri", labelKey: "competition.startMonth", kind: "text", required: true }),
          field({ name: "endMonthHijri", labelKey: "competition.endMonth", kind: "text", required: true }),
          field({ name: "enrollmentOpensAt", labelKey: "competition.windowOpens", kind: "date", required: true }),
          field({ name: "enrollmentClosesAt", labelKey: "competition.windowCloses", kind: "date", required: true }),
        ],
        submit: button({
          labelKey: "competition.create",
          variant: "primary",
          capability: "competition.manage",
        }),
      }),
      // **الكتالوجُ بياناتٌ**: نوعٌ يُضاف من الشاشة فيعمل بلا سطر كود (قب-٢٢).
      form({
        schema: "competitionScoringTypeInput",
        fields: [
          field({ name: "key", labelKey: "competition.scoringTypeLabel", kind: "text", required: true }),
          field({ name: "titleAr", labelKey: "competition.titleLabel", kind: "text", required: true }),
          field({ name: "weight", labelKey: "competition.weightLabel", kind: "number", required: true }),
        ],
        submit: button({
          labelKey: "competition.scoringTypeDefine",
          variant: "primary",
          capability: "competition.manage",
        }),
      }),
      // **الجائزةُ تُعلَن ولا تُصرف** (قب-٤٥): صفرُ حقلٍ يُحيل إلى صرفٍ أو مستحق.
      form({
        schema: "competitionAwardInput",
        fields: [
          field({ name: "titleAr", labelKey: "competition.awardDeclare", kind: "text", required: true }),
          field({ name: "categoryId", labelKey: "competition.categoryLabel", kind: "select" }),
        ],
        submit: button({
          labelKey: "competition.awardDeclare",
          variant: "primary",
          capability: "competition.manage",
        }),
      }),
    )
  }

  // **فصلُ المهام على الفعل الذي لا رجعة فيه** (ق-٥٤): قدرةٌ مستقلّةٌ لا امتدادُ الضبط.
  if (caps.has("competition.result.declare")) {
    blocks.push(
      form({
        schema: "competitionDeclareInput",
        fields: [field({ name: "competitionId", labelKey: "competition.titleLabel", kind: "select", required: true })],
        submit: button({
          labelKey: "competition.resultDeclare",
          variant: "primary",
          capability: "competition.result.declare",
        }),
      }),
    )
  }

  return shell(caps, snapshot, blocks)
}

// ── شاشةُ «صندوقُ التحاق مسجدي» ──────────────────────────────────────────────
export const COMPETITION_INBOX_CONTRACT: ScreenContract = Object.freeze({
  route: "/competition/enrollments",
  surface: "competition",
  lenses: ["amir"] as const,
  // موطنُ «المشترِك/التسجيل في المسابقة» (IA ك-٢٢) — لا موطنَ ثانٍ له.
  canonicalHome: ["competitionEnrollment"] as const,
  capabilities: ["competition.enroll.approve", "competition.score.record"] as const,
  dataSource: "competition.inbox",
  emptyStates: { owner: "competition.emptyInbox", viewer: "state.deniedTitle" } as const,
})

export function enrollmentInboxScreenNodes(caps: Caps, snapshot: CompetitionSnapshot): UiNode {
  // **البابُ لأمير المسجد بعينه** (ق-١٤/ق-٢٧): المديرُ والمشرفُ يبلغان فراغاً مُشخِّصاً.
  if (!caps.has("competition.enroll.approve") && !caps.has("competition.score.record")) {
    return viewerEmpty()
  }

  const blocks: UiNode[] = []

  if (caps.has("competition.enroll.approve")) {
    blocks.push(
      statCard({
        sentenceKey: "competition.inboxSentence",
        valueAr: snapshot.pendingTotalAr,
        scopeNoteKey: "competition.inboxScopeNote",
        action: button({
          labelKey: "competition.inboxHeading",
          variant: "ghost",
          capability: "competition.enroll.approve",
        }),
        tone: "brand",
      }),
      dataTable({
        columns: [
          { key: "name", labelKey: "competition.applicantName" },
          { key: "phone", labelKey: "competition.applicantPhone" },
          { key: "channel", labelKey: "competition.titleLabel" },
        ],
        rows: snapshot.pendingRows,
        state: snapshot.pendingRows.length === 0 ? "empty" : "data",
        capability: "competition.enroll.approve",
        emptyState: emptyState({
          audience: "owner",
          titleKey: "competition.inboxHeading",
          actionKey: "competition.emptyInbox",
          capability: "competition.enroll.approve",
        }),
      }),
      // **الرفضُ بسببٍ نصّيٍّ إلزاميّ** يراه المتقدّم برمزه (ق-٣٢) — حقلٌ لا خيار.
      form({
        schema: "competitionDecisionInput",
        fields: [
          field({ name: "enrollmentId", labelKey: "competition.applicantName", kind: "select", required: true }),
          field({ name: "reason", labelKey: "competition.rejectReason", kind: "text" }),
        ],
        submit: button({
          labelKey: "competition.approve",
          variant: "primary",
          capability: "competition.enroll.approve",
        }),
      }),
      // **قناةُ الدعوة** (قب-١٣ زيادةُ المالك): رمزٌ موقّتٌ منسوبٌ لمُصدِره ومسجده.
      form({
        schema: "competitionInviteInput",
        fields: [
          field({ name: "competitionId", labelKey: "competition.titleLabel", kind: "select", required: true }),
          field({ name: "expiresAt", labelKey: "competition.inviteExpires", kind: "date", required: true }),
        ],
        submit: button({
          labelKey: "competition.inviteIssue",
          variant: "primary",
          capability: "competition.enroll.approve",
        }),
      }),
    )
  }

  // **الراصدُ أميرُ المسجد** (ب-٣٧ب) — والمديرُ لا يرصد (ق-٢٧)، فلا نموذجَ له.
  if (caps.has("competition.score.record")) {
    blocks.push(
      form({
        schema: "competitionScoreInput",
        fields: [
          field({ name: "contestantId", labelKey: "competition.contestants", kind: "select", required: true }),
          field({ name: "typeKey", labelKey: "competition.scoringTypeLabel", kind: "select", required: true }),
          field({ name: "periodKey", labelKey: "competition.scorePeriod", kind: "text", required: true }),
          field({ name: "value", labelKey: "competition.scoreValue", kind: "number", required: true }),
          field({ name: "excuseReason", labelKey: "competition.excuseReason", kind: "text" }),
        ],
        submit: button({
          labelKey: "competition.scoreRecord",
          variant: "primary",
          capability: "competition.score.record",
        }),
      }),
    )
  }

  return shell(caps, snapshot, blocks)
}

registerScreen({
  contract: COMPETITION_SCOPE_CONTRACT,
  preview: (caps) => competitionScopeScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT),
})
registerScreen({
  contract: COMPETITION_INBOX_CONTRACT,
  preview: (caps) => enrollmentInboxScreenNodes(caps, EMPTY_COMPETITION_SNAPSHOT),
})
