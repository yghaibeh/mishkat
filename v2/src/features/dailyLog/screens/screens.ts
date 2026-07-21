/**
 * شاشتا سجل اليوم وكتالوج الأنشطة — عقودُهما في `SPEC.md` §٩، وحاكمُهما G20.
 *
 * **طبقةُ عرضٍ نقيّة**: دالةٌ من (قشرةِ القدرات المحسوبة + لقطةِ الصفحة) إلى بنية عرض. لا
 * تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦)، **ولا تحسب رقماً**: كلُّ رقمٍ فيها مُسقَطٌ من
 * **نموذج الصفحة الواحد** (`unitDailyLogView`) — الحقيقةُ الواحدة في الصفحة (ق-١١١).
 *
 * وثلاثةُ ثوابتٍ تُرى بالعين هنا:
 *  - **ق-١٠**: زرُّ التقديم **لا يُبنى أصلاً** فوق حصيلةٍ صفرية؛ ومكانَه سطرٌ موجّه يقول
 *    ماذا يفعل صاحبُه — لا زرٌّ مُعطَّلٌ ولا شاشةٌ صامتة.
 *  - **ب-٣٢**: حين لا يُضبط عددُ الأسرة يظهر **سببُ منع النقاط منطوقاً** ودعوةُ ضبطه.
 *  - **ب-٤٢**: النشاطُ الحرّ خانةٌ نصّيةٌ **مقرونةٌ بنصٍّ يقول إنه بلا نقاطٍ آلية**.
 */

import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import { appShell, navProjection } from "../../../ui/shell/shell.js"
import { badge, button } from "../../../ui/components/atoms.js"
import { field, form, listItem, statCard } from "../../../ui/components/molecules.js"
import { dataTable, emptyState } from "../../../ui/components/organisms.js"
import type { UiNode } from "../../../ui/components/kernel.js"
import { registerScreen } from "../../../ui/screens/registry.js"
import type { ScreenContract } from "../../../ui/screens/contract.js"
import type { TextKey } from "../../../ui/text/dictionary.js"
import { formatNumber } from "../../../ui/text/format.js"
import type { InfluenceTier } from "../types.js"

type Caps = ReadonlySet<CapId>

/** قيمةٌ غائبةٌ في المعاينة — محرفٌ محايدٌ لا نصَّ فيه (لا حرفَ خارج طبقة النصوص). */
const ABSENT = "—"
const ZERO_AR = formatNumber(0)

export type DailyLogRow = Readonly<Record<string, string>>

/** لقطةُ الصفحة — **مصدرُ بياناتٍ واحد** (ق-١١١)، منسّقةٌ في طبقةٍ واحدة قبل العرض. */
export type DailyLogSnapshot = {
  readonly unitLabelAr: string
  readonly scopePath: string
  readonly pointsAr: string
  readonly targetAr: string
  readonly tier: InfluenceTier
  readonly entryRows: readonly DailyLogRow[]
  readonly freeRows: readonly DailyLogRow[]
  readonly familyRosterAr: string
  /** ب-٣٢: عددُ الأسرة غيرُ مضبوط ⇒ سببُ منع النقاط يُنطق على الصفحة. */
  readonly rosterUnset: boolean
  /** ق-١٠: حصيلةٌ غيرُ صفرية ⇒ التقديمُ متاح — تقرأه الشاشةُ ولا تجتهد. */
  readonly submittable: boolean
}

export const EMPTY_DAILY_LOG_SNAPSHOT: DailyLogSnapshot = Object.freeze({
  unitLabelAr: ABSENT,
  scopePath: "/",
  pointsAr: ZERO_AR,
  targetAr: ZERO_AR,
  tier: "struggling",
  entryRows: Object.freeze([]),
  freeRows: Object.freeze([]),
  familyRosterAr: ABSENT,
  rosterUnset: true,
  submittable: false,
})

const TIER_KEY: Readonly<Record<InfluenceTier, TextKey>> = Object.freeze({
  excellent: "dailyLog.tierExcellent",
  below: "dailyLog.tierBelow",
  struggling: "dailyLog.tierStruggling",
})

const TIER_ICON: Readonly<Record<InfluenceTier, string>> = Object.freeze({
  excellent: "star",
  below: "alert",
  struggling: "alert",
})

/** الدلالةُ مزدوجةٌ دائماً (§٤-٥): نبرةٌ **مع** أيقونةٍ ونصّ — لا تصنيفٌ يُحمل باللون. */
function tierBadge(tier: InfluenceTier): UiNode {
  return badge({
    labelKey: TIER_KEY[tier],
    tone: tier === "excellent" ? "success" : tier === "below" ? "warning" : "danger",
    iconName: TIER_ICON[tier],
  })
}

/** فراغُ المطّلع مُشخِّصٌ دائماً (ق-١١٢)، وبطابع المحراب (قب-٢٥ — من المكوّن نفسِه). */
function viewerEmpty(): UiNode {
  return emptyState({
    audience: "viewer",
    titleKey: "state.deniedTitle",
    diagnosisKey: "state.deniedHint",
  })
}

function shell(caps: Caps, scopePath: string, labelAr: string, content: readonly UiNode[]): UiNode {
  return appShell({
    nav: navProjection({ caps, priority: null, currentSurface: "myMosque" }),
    scopePath,
    scopeLabelAr: labelAr,
    showSearch: false,
    content,
  })
}

// ── شاشةُ سجل اليوم ─────────────────────────────────────────────────────────
export const DAILY_LOG_CONTRACT: ScreenContract = Object.freeze({
  route: "/mosque/record",
  surface: "myMosque",
  lenses: ["admin", "section_head", "rabita", "square", "amir"] as const,
  // موطنُ «التقرير الأسبوعيّ/سجل الوحدة» (IA §١ ك-١٩) — لا موطنَ ثانٍ له.
  canonicalHome: ["weeklyReport"] as const,
  capabilities: [
    "dailyLog.view",
    "dailyLog.edit",
    "familyRoster.manage",
    "report.submit",
    "report.retract",
  ] as const,
  dataSource: "dailyLog.unitView",
  emptyStates: { owner: "dailyLog.emptyOwner", viewer: "state.deniedTitle" } as const,
})

export function dailyLogScreenNodes(caps: Caps, snapshot: DailyLogSnapshot): UiNode {
  if (!caps.has("dailyLog.view")) return viewerEmpty()

  const blocks: UiNode[] = []

  // «أين أنا من هدف الفترة؟» — رقمٌ يقود لفعلٍ، ونطاقُه منطوقٌ على الصفحة (ق-١٠٨/ق-١١٠).
  blocks.push(
    statCard({
      sentenceKey: "dailyLog.weekPoints",
      valueAr: snapshot.pointsAr,
      scopeNoteKey: "dailyLog.scopeNote",
      action: button({ labelKey: "dailyLog.entries", variant: "ghost", capability: "dailyLog.view" }),
      tone: "brand",
    }),
    statCard({
      sentenceKey: "dailyLog.target",
      valueAr: snapshot.targetAr,
      scopeNoteKey: "dailyLog.scopeNote",
      action: button({ labelKey: "dailyLog.entries", variant: "ghost", capability: "dailyLog.view" }),
    }),
  )

  // التصنيفُ **نسبةٌ من الهدف** (ق-٤٤/قب-١١) — شارةٌ بنصٍّ وأيقونة، لا مقياسَ صلب.
  blocks.push(
    listItem({ sentenceKey: "dailyLog.tier", diagnosis: tierBadge(snapshot.tier) }),
  )

  // ب-٣٢: سببُ منع النقاط **منطوقٌ** ودعوةُ علاجه لصاحبها وحده (ق-١٠٩/ق-١١٢).
  if (snapshot.rosterUnset) {
    blocks.push(
      caps.has("familyRoster.manage")
        ? listItem({
            sentenceKey: "dailyLog.rosterUnset",
            action: button({
              labelKey: "dailyLog.setFamilyRoster",
              variant: "primary",
              capability: "familyRoster.manage",
            }),
            tone: "warning",
            iconName: "alert",
          })
        : listItem({
            sentenceKey: "dailyLog.rosterUnset",
            diagnosis: emptyState({
              audience: "viewer",
              titleKey: "dailyLog.familyRoster",
              diagnosisKey: "state.emptyViewerAsk",
            }),
          }),
    )
  }

  blocks.push(
    dataTable({
      columns: [
        { key: "activity", labelKey: "dailyLog.activity" },
        { key: "count", labelKey: "dailyLog.count" },
        { key: "points", labelKey: "dailyLog.points" },
      ],
      rows: snapshot.entryRows,
      state: snapshot.entryRows.length === 0 ? "empty" : "data",
      capability: "dailyLog.view",
      emptyState: caps.has("dailyLog.edit")
        ? emptyState({
            audience: "owner",
            titleKey: "dailyLog.emptyEntries",
            actionKey: "dailyLog.emptyOwner",
            capability: "dailyLog.edit",
          })
        : emptyState({
            audience: "viewer",
            titleKey: "dailyLog.emptyEntries",
            diagnosisKey: "state.emptyViewerIdle",
          }),
    }),
  )

  // ب-٤٢: النشاطُ الحرُّ يُعرض لمعتمِد السجل ليقرّر — بنصٍّ يقول إنه بلا نقاطٍ آلية.
  blocks.push(
    dataTable({
      columns: [
        { key: "text", labelKey: "dailyLog.freeActivity" },
        { key: "count", labelKey: "dailyLog.count" },
      ],
      rows: snapshot.freeRows,
      state: snapshot.freeRows.length === 0 ? "empty" : "data",
      capability: "dailyLog.view",
      emptyState: emptyState({
        audience: "viewer",
        titleKey: "dailyLog.freeActivity",
        diagnosisKey: "dailyLog.freeActivityNote",
      }),
    }),
  )

  // فعلُ المُدخِل: نشاطٌ من الكتالوج **أو** نصٌّ حرّ — بمخطط تحقّقٍ واحدٍ عند الحدّ (§٣-٤).
  if (caps.has("dailyLog.edit")) {
    blocks.push(
      form({
        schema: "dailyLogEntryInput",
        fields: [
          field({ name: "activityId", labelKey: "dailyLog.activity", kind: "select" }),
          field({ name: "count", labelKey: "dailyLog.count", kind: "number", required: true }),
          field({ name: "attendees", labelKey: "dailyLog.attendees", kind: "number" }),
          field({
            name: "freeTextAr",
            labelKey: "dailyLog.freeActivity",
            kind: "textarea",
            messageKey: "dailyLog.freeActivityNote",
          }),
        ],
        submit: button({
          labelKey: "dailyLog.record",
          variant: "primary",
          capability: "dailyLog.edit",
        }),
      }),
    )
  }

  if (caps.has("familyRoster.manage")) {
    blocks.push(
      form({
        schema: "familyRosterInput",
        fields: [
          field({
            name: "studentCount",
            labelKey: "dailyLog.familyRoster",
            kind: "number",
            required: true,
            state: snapshot.rosterUnset ? "empty" : "filled",
          }),
        ],
        submit: button({
          labelKey: "dailyLog.setFamilyRoster",
          variant: "primary",
          capability: "familyRoster.manage",
        }),
      }),
    )
  }

  // **ق-١٠**: لا زرَّ تقديمٍ فوق حصيلةٍ صفرية — بل سطرٌ موجّهٌ يقول ماذا يفعل صاحبُه.
  if (caps.has("report.submit")) {
    blocks.push(
      snapshot.submittable
        ? listItem({
            sentenceKey: "dailyLog.submit",
            action: button({
              labelKey: "dailyLog.submit",
              variant: "primary",
              capability: "report.submit",
            }),
          })
        : listItem({
            sentenceKey: "dailyLog.zeroHarvest",
            diagnosis: emptyState({
              audience: "viewer",
              titleKey: "dailyLog.emptyEntries",
              diagnosisKey: "dailyLog.zeroHarvest",
            }),
            tone: "warning",
            iconName: "alert",
          }),
    )
  }

  if (caps.has("report.retract") && snapshot.submittable) {
    blocks.push(
      listItem({
        sentenceKey: "dailyLog.retract",
        action: button({
          labelKey: "dailyLog.retract",
          variant: "ghost",
          capability: "report.retract",
        }),
      }),
    )
  }

  return shell(caps, snapshot.scopePath, snapshot.unitLabelAr, blocks)
}

// ── شاشةُ كتالوج الأنشطة (المستقلة — قب-١١/ب-٣٩ج) ───────────────────────────
export type CatalogSnapshot = {
  readonly rows: readonly DailyLogRow[]
}

export const EMPTY_CATALOG_SNAPSHOT: CatalogSnapshot = Object.freeze({ rows: Object.freeze([]) })

export const ACTIVITY_CATALOG_CONTRACT: ScreenContract = Object.freeze({
  route: "/admin/activity-catalog",
  surface: "admin",
  lenses: ["admin"] as const,
  // موطنُ «كتالوج الأنشطة وأوزانها» (IA §١ ك-١٨): سطحُ الإدارة، بشاشةٍ مستقلة.
  canonicalHome: ["activityCatalog"] as const,
  capabilities: ["activityCatalog.manage"] as const,
  dataSource: "activityCatalog.view",
  emptyStates: { owner: "catalog.emptyOwner", viewer: "state.deniedTitle" } as const,
})

export function activityCatalogScreenNodes(caps: Caps, snapshot: CatalogSnapshot): UiNode {
  if (!caps.has("activityCatalog.manage")) return viewerEmpty()

  const blocks: UiNode[] = [
    dataTable({
      columns: [
        { key: "scheme", labelKey: "catalog.scheme" },
        { key: "activity", labelKey: "catalog.activity" },
        { key: "weight", labelKey: "catalog.weight" },
        { key: "maxPerDay", labelKey: "catalog.maxPerDay" },
        { key: "active", labelKey: "catalog.active" },
        { key: "validFrom", labelKey: "catalog.validFrom" },
      ],
      rows: snapshot.rows,
      state: snapshot.rows.length === 0 ? "empty" : "data",
      capability: "activityCatalog.manage",
      emptyState: emptyState({
        audience: "owner",
        titleKey: "catalog.heading",
        actionKey: "catalog.emptyOwner",
        capability: "activityCatalog.manage",
      }),
    }),
    // **إدارةٌ بلا مبرمج** (ب-٣٩ج): إضافةُ نشاطٍ ووزنِه وسقفِه نموذجٌ لا نشرُ كود.
    form({
      schema: "activityCatalogInput",
      fields: [
        field({ name: "schemeId", labelKey: "catalog.scheme", kind: "select", required: true }),
        field({ name: "activityId", labelKey: "catalog.activity", kind: "text", required: true }),
        field({ name: "weight", labelKey: "catalog.weight", kind: "number", required: true }),
        field({ name: "maxPerDay", labelKey: "catalog.maxPerDay", kind: "number" }),
        field({
          name: "requiresParticipation",
          labelKey: "catalog.requiresParticipation",
          kind: "select",
        }),
        field({ name: "active", labelKey: "catalog.active", kind: "select", required: true }),
      ],
      submit: button({
        labelKey: "catalog.upsert",
        variant: "primary",
        capability: "activityCatalog.manage",
      }),
    }),
  ]

  return appShell({
    nav: navProjection({ caps, priority: null, currentSurface: "admin" }),
    scopePath: "/",
    scopeLabelAr: ABSENT,
    showSearch: false,
    content: blocks,
  })
}

registerScreen({
  contract: DAILY_LOG_CONTRACT,
  preview: (caps) => dailyLogScreenNodes(caps, EMPTY_DAILY_LOG_SNAPSHOT),
})
registerScreen({
  contract: ACTIVITY_CATALOG_CONTRACT,
  preview: (caps) => activityCatalogScreenNodes(caps, EMPTY_CATALOG_SNAPSHOT),
})
