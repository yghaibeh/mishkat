/**
 * شاشتا العُهد — عقودُهما في `SPEC.md` §٨، وحاكمُهما G20.
 *
 * **طبقةُ عرضٍ نقيّة**: دالةٌ من (قشرةِ القدرات المحسوبة + لقطةِ الصفحة) إلى بنية عرض. لا
 * تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦)، **ولا تشتقّ حالة**: الحائزُ والحالةُ يصلانها
 * محسوبَين من `services/derive.ts` — **مصدرٌ واحدٌ للصفحة** (ق-١١١).
 *
 * **والحالُ دلالةٌ مزدوجة** (§٤-٥): لونٌ **وأيقونةٌ ونصّ** — «بانتظار إقرارك» ليست لوناً.
 * **والطابعُ قب-٢٥**: الفراغُ مِحرابٌ ينتظر (من مكوّن `EmptyState` نفسِه)، و**صفر صورة**.
 */

import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import { appShell, navProjection } from "../../../ui/shell/shell.js"
import { badge, button } from "../../../ui/components/atoms.js"
import { field, form, statCard } from "../../../ui/components/molecules.js"
import { dataTable, dialog, emptyState } from "../../../ui/components/organisms.js"
import type { UiNode } from "../../../ui/components/kernel.js"
import { registerScreen } from "../../../ui/screens/registry.js"
import type { ScreenContract } from "../../../ui/screens/contract.js"
import type { TextKey } from "../../../ui/text/dictionary.js"
import { formatNumber } from "../../../ui/text/format.js"
import type { CustodyStatus } from "../services/derive.js"

type Caps = ReadonlySet<CapId>

/** قيمةٌ غائبةٌ في المعاينة — محرفٌ محايدٌ لا نصَّ فيه (لا حرفَ خارج طبقة النصوص). */
const ABSENT = "—"

/**
 * **معجمُ الحال**: لكل حالةٍ مشتقّةٍ مفتاحُ نصٍّ ونبرةٌ وأيقونة — مصدرٌ واحدٌ يمنع أن تُسمّى
 * الحالةُ في شاشةٍ بغير ما تُسمّى في أخرى، ويفرض الدلالةَ المزدوجة على كل حالة.
 */
export const STATUS_PRESENTATION: Readonly<
  Record<CustodyStatus, { readonly labelKey: TextKey; readonly tone: "success" | "warning" | "danger" | "neutral"; readonly iconName: string }>
> = Object.freeze({
  inUnit: { labelKey: "custody.stateInUnit", tone: "neutral", iconName: "archive" },
  pendingAck: { labelKey: "custody.statePending", tone: "warning", iconName: "clock" },
  held: { labelKey: "custody.stateHeld", tone: "success", iconName: "check" },
  damaged: { labelKey: "custody.stateDamaged", tone: "danger", iconName: "alert" },
  lost: { labelKey: "custody.stateLost", tone: "danger", iconName: "alert" },
  retired: { labelKey: "custody.stateRetired", tone: "neutral", iconName: "archive" },
})

export type CustodyRow = Readonly<Record<string, string>>

/** لقطةُ الصفحة — **مصدرُ بياناتٍ واحد** (ق-١١١)، منسّقةٌ في طبقةٍ واحدة قبل العرض. */
export type CustodySnapshot = {
  readonly unitLabelAr: string
  readonly scopePath: string
  readonly assetRows: readonly CustodyRow[]
  readonly mineRows: readonly CustodyRow[]
  readonly pendingCountAr: string
  readonly openCountAr: string
  readonly statuses: readonly CustodyStatus[]
}

export const EMPTY_CUSTODY_SNAPSHOT: CustodySnapshot = Object.freeze({
  unitLabelAr: ABSENT,
  scopePath: "/",
  assetRows: Object.freeze([]),
  mineRows: Object.freeze([]),
  pendingCountAr: formatNumber(0),
  openCountAr: formatNumber(0),
  statuses: Object.freeze([]),
})

/** فراغُ المطّلع مُشخِّصٌ دائماً (ق-١١٢)، وبطابع المحراب (قب-٢٥ — من المكوّن نفسِه). */
function viewerEmpty(): UiNode {
  return emptyState({
    audience: "viewer",
    titleKey: "state.deniedTitle",
    diagnosisKey: "state.deniedHint",
  })
}

function shell(caps: Caps, snapshot: CustodySnapshot, content: readonly UiNode[], surface: "custody" | "personal"): UiNode {
  return appShell({
    nav: navProjection({ caps, priority: null, currentSurface: surface }),
    scopePath: snapshot.scopePath,
    scopeLabelAr: snapshot.unitLabelAr,
    // البحثُ لمن يملك عرضَ الشبكة على نطاقه وحده — وليس من قدرات هذه الشاشة.
    showSearch: false,
    content,
  })
}

/** شارةُ الحال بدلالةٍ مزدوجة — تُبنى من المعجم الواحد لا من اجتهاد الشاشة. */
export function statusBadge(status: CustodyStatus): UiNode {
  const presentation = STATUS_PRESENTATION[status]
  return badge({
    labelKey: presentation.labelKey,
    tone: presentation.tone,
    iconName: presentation.iconName,
  })
}

// ── شاشةُ «عُهد نطاقي» ───────────────────────────────────────────────────────
export const CUSTODY_SCOPE_CONTRACT: ScreenContract = Object.freeze({
  route: "/custody",
  surface: "custody",
  lenses: ["admin", "section_head", "rabita", "square", "amir", "finance_officer"] as const,
  // موطنُ «العُهدة/الأصل» (IA §١ ك-٣٠) — لا موطنَ ثانٍ له (يقتل ز-٣).
  canonicalHome: ["custody"] as const,
  capabilities: ["custody.view", "custody.grant", "asset.manage"] as const,
  dataSource: "custody.scopeView",
  emptyStates: { owner: "custody.emptyOwner", viewer: "state.deniedTitle" } as const,
})

export function custodyScopeScreenNodes(caps: Caps, snapshot: CustodySnapshot): UiNode {
  if (!caps.has("custody.view")) return viewerEmpty()

  const blocks: UiNode[] = [
    dataTable({
      columns: [
        { key: "asset", labelKey: "custody.assetLabel" },
        { key: "holder", labelKey: "custody.holder" },
        { key: "state", labelKey: "custody.state" },
      ],
      rows: snapshot.assetRows,
      state: snapshot.assetRows.length === 0 ? "empty" : "data",
      capability: "custody.view",
      emptyState: caps.has("asset.manage")
        ? emptyState({
            audience: "owner",
            titleKey: "custody.heading",
            actionKey: "custody.emptyOwner",
            capability: "asset.manage",
          })
        : emptyState({
            audience: "viewer",
            titleKey: "custody.heading",
            diagnosisKey: "custody.emptyScope",
          }),
    }),
  ]

  // **الحالُ لا يُحمَل بلونٍ وحده**: لكل حالةٍ حاضرةٍ شارةٌ بنصٍّ وأيقونة (§٤-٥).
  for (const status of snapshot.statuses) blocks.push(statusBadge(status))

  // **تسجيلُ الأصل ومحاسبتُه** — بلا حقلِ حائزٍ ولا حالة (ب-٢٩: البابُ الثاني مُغلق).
  if (caps.has("asset.manage")) {
    blocks.push(
      form({
        schema: "custodyRegisterAssetInput",
        fields: [
          field({ name: "labelAr", labelKey: "custody.assetLabel", kind: "text", required: true }),
          field({ name: "unitId", labelKey: "custody.unitHome", kind: "select", required: true }),
          field({ name: "serialAr", labelKey: "custody.serial", kind: "text" }),
        ],
        submit: button({ labelKey: "custody.register", variant: "primary", capability: "asset.manage" }),
      }),
      form({
        schema: "custodyAmendAssetInput",
        fields: [
          field({ name: "assetId", labelKey: "custody.assetLabel", kind: "select", required: true }),
          field({ name: "noteAr", labelKey: "custody.note", kind: "textarea" }),
        ],
        submit: button({ labelKey: "custody.amend", variant: "primary", capability: "asset.manage" }),
      }),
    )
  }

  // **حركةُ السلسلة: المسارُ الوحيد للحيازة** (ق-٧٨/ب-٢٩) — والحالُ حقلٌ إلزاميّ فيها.
  if (caps.has("custody.grant")) {
    blocks.push(
      form({
        schema: "custodyMoveInput",
        fields: [
          field({ name: "assetId", labelKey: "custody.assetLabel", kind: "select", required: true }),
          field({ name: "action", labelKey: "custody.action", kind: "select", required: true }),
          field({ name: "toPersonId", labelKey: "custody.recipient", kind: "select" }),
          field({ name: "conditionAr", labelKey: "custody.condition", kind: "text", required: true }),
        ],
        submit: button({ labelKey: "custody.move", variant: "primary", capability: "custody.grant" }),
      }),
    )
  }

  return shell(caps, snapshot, blocks, "custody")
}

// ── شاشةُ «عُهدتي» ───────────────────────────────────────────────────────────
export const MY_CUSTODY_CONTRACT: ScreenContract = Object.freeze({
  route: "/custody/mine",
  surface: "personal",
  lenses: [
    "section_head",
    "rabita",
    "square",
    "amir",
    "teacher",
    "committee_head",
    "media",
    "finance_officer",
  ] as const,
  // عرضٌ منسوبٌ شخصيّ: موطنُ الكيان `/custody` — لا موطنَ ثانٍ (IA §١، ز-٤).
  canonicalHome: [] as const,
  capabilities: ["custody.own"] as const,
  dataSource: "custody.mine",
  emptyStates: { owner: "custody.emptyMine", viewer: "state.deniedTitle" } as const,
})

export function myCustodyScreenNodes(caps: Caps, snapshot: CustodySnapshot): UiNode {
  if (!caps.has("custody.own")) return viewerEmpty()

  const blocks: UiNode[] = [
    statCard({
      sentenceKey: "custody.mineHeading",
      valueAr: snapshot.openCountAr,
      scopeNoteKey: "custody.mineScopeNote",
      action: button({ labelKey: "custody.chain", variant: "ghost", capability: "custody.own" }),
      tone: "brand",
    }),
    dataTable({
      columns: [
        { key: "asset", labelKey: "custody.assetLabel" },
        { key: "state", labelKey: "custody.state" },
      ],
      rows: snapshot.mineRows,
      state: snapshot.mineRows.length === 0 ? "empty" : "data",
      capability: "custody.own",
      emptyState: emptyState({
        audience: "owner",
        titleKey: "custody.mineHeading",
        actionKey: "custody.emptyMine",
        capability: "custody.own",
      }),
    }),
    // **الإقرارُ فعلٌ شخصيٌّ بتأكيد** (ك-٣ «إقرارُ المستلِم») — لصاحبه وحده لا لمن سلّمه.
    dialog({
      titleKey: "custody.receive",
      bodyKey: "custody.receiveBody",
      confirm: button({ labelKey: "custody.receive", variant: "primary", capability: "custody.own" }),
      cancelKey: "common.cancel",
    }),
  ]

  return shell(caps, snapshot, blocks, "personal")
}

registerScreen({
  contract: CUSTODY_SCOPE_CONTRACT,
  preview: (caps) => custodyScopeScreenNodes(caps, EMPTY_CUSTODY_SNAPSHOT),
})
registerScreen({
  contract: MY_CUSTODY_CONTRACT,
  preview: (caps) => myCustodyScreenNodes(caps, EMPTY_CUSTODY_SNAPSHOT),
})
