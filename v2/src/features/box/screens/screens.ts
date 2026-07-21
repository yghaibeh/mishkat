/**
 * شاشاتُ الصندوق ومالية المسجد — عقودُها في `SPEC.md` §٧، وحاكمُها G20.
 *
 * **طبقةُ عرضٍ نقيّة**: دالةٌ من (قشرةِ القدرات المحسوبة + لقطةِ الصفحة) إلى بنية عرض. لا
 * تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦)، **ولا تحسب رقماً**: كلُّ رقمٍ فيها مُسقَطٌ من
 * **نموذج الصفحة الواحد** (`unitBoxView`) — وهو علاجُ ع-١٣/ع-١٤/ع-٢٤ البنيويّ (ق-١١١).
 *
 * **والوجهُ يتبسّط** (قب-٨): «قبضتُ · صرفتُ · سلّمتُ» و«رصيدُ صندوقي» — لا مدينَ ولا دائنَ
 * ولا يوميّة. **والطابعُ قب-٢٥**: الفراغُ مِحرابٌ ينتظر (من مكوّن `EmptyState` نفسِه)،
 * و**صفر صورة** في كل شجرة العرض.
 */

import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import { appShell, navProjection } from "../../../ui/shell/shell.js"
import { button } from "../../../ui/components/atoms.js"
import { field, form, statCard } from "../../../ui/components/molecules.js"
import { dataTable, dialog, emptyState, unitTree } from "../../../ui/components/organisms.js"
import { TREE_LAZY_THRESHOLD } from "../../../ui/components/limits.js"
import type { UiNode } from "../../../ui/components/kernel.js"
import { registerScreen } from "../../../ui/screens/registry.js"
import type { ScreenContract } from "../../../ui/screens/contract.js"
import { formatMoney } from "../../../ui/text/format.js"
import { fromCents } from "../../ledger/services/money.js"
import type { Cents } from "../../ledger/types.js"
import type { MosqueFinanceView, UnitBoxView } from "../services/boxViews.js"

type Caps = ReadonlySet<CapId>

/** قيمةٌ غائبةٌ في المعاينة — محرفٌ محايدٌ لا نصَّ فيه (لا حرفَ خارج طبقة النصوص). */
const ABSENT = "—"

export type BoxBalanceRow = { readonly currency: string; readonly netAr: string }
export type BoxFlowRow = {
  readonly currency: string
  readonly incomingAr: string
  readonly outgoingAr: string
  readonly netAr: string
}
export type BoxRow = Readonly<Record<string, string>>

/** لقطةُ الصفحة — **مصدرُ بياناتٍ واحد** (ق-١١١)، منسّقةٌ في طبقةٍ واحدة قبل العرض. */
export type BoxSnapshot = {
  readonly unitLabelAr: string
  readonly scopePath: string
  readonly balanceRows: readonly BoxBalanceRow[]
  readonly flowRows: readonly BoxFlowRow[]
  readonly movementRows: readonly BoxRow[]
  readonly childRows: readonly { readonly id: string; readonly labelAr: string }[]
  readonly handoverRows: readonly BoxRow[]
}

export const EMPTY_BOX_SNAPSHOT: BoxSnapshot = Object.freeze({
  unitLabelAr: ABSENT,
  scopePath: "/",
  balanceRows: Object.freeze([]),
  flowRows: Object.freeze([]),
  movementRows: Object.freeze([]),
  childRows: Object.freeze([]),
  handoverRows: Object.freeze([]),
})

export type DisplayMoney = {
  readonly unitLabelAr: string
  /** من الإعدادات الحيّة (قب-٦) — لا عملةَ صلبةٌ في العرض. */
  readonly currencyCode: string
  readonly fractionDigits: number
}

/**
 * التنسيقُ **مخرجُ العرض الوحيد**: السنتُ يُحوَّل بـ`fromCents` (قسمةٌ صحيحةٌ في النواة)
 * ثم يُنسَّق — فلا حسابَ عائمٌ على المال في طبقة العرض (ق-٤٨، §١.٢).
 */
function amountAr(value: Cents, currencyCode: string, fractionDigits: number): string {
  return formatMoney({ amount: Number(fromCents(value)), currencyCode, fractionDigits })
}

/** إسقاطُ نموذج الصفحة إلى لقطةِ عرضٍ — **بلا حسابٍ جديد**، تنسيقٌ فقط. */
export function projectBoxSnapshot(view: UnitBoxView, display: DisplayMoney): BoxSnapshot {
  const digits = display.fractionDigits
  return {
    unitLabelAr: display.unitLabelAr,
    scopePath: view.unitPath,
    balanceRows: [...view.own].map(([currency, b]) => ({
      currency,
      netAr: amountAr(b.net, currency, digits),
    })),
    flowRows: [...view.flow].map(([currency, f]) => ({
      currency,
      incomingAr: amountAr(f.incoming, currency, digits),
      outgoingAr: amountAr(f.outgoing, currency, digits),
      netAr: amountAr(f.net, currency, digits),
    })),
    movementRows: view.movements.map((m) => ({
      voucher: m.voucherNo,
      amount: amountAr(m.amount, m.currency, digits),
      currency: m.currency,
      direction: m.direction,
    })),
    childRows: view.children.map((child) => ({
      id: child.unitId,
      labelAr: `${child.unitId}${[...child.balances]
        .map(([currency, b]) => ` ${amountAr(b.net, currency, digits)}`)
        .join("")}`,
    })),
    handoverRows: view.handovers.map((h) => ({
      id: h.id,
      from: h.fromUnitPath,
      to: h.toUnitPath,
      acknowledged: h.acknowledgedBy === null ? "" : h.acknowledgedBy,
    })),
  }
}

/** إسقاطُ مالية المسجد — نفسُ التنسيق ونفسُ المصدر، بنطاق المسجد وحده (ب-٩/ق-٣٠). */
export function projectMosqueSnapshot(view: MosqueFinanceView, display: DisplayMoney): BoxSnapshot {
  const digits = display.fractionDigits
  return {
    ...EMPTY_BOX_SNAPSHOT,
    unitLabelAr: display.unitLabelAr,
    scopePath: view.unitPath,
    balanceRows: [...view.balances].map(([currency, b]) => ({
      currency,
      netAr: amountAr(b.net, currency, digits),
    })),
    flowRows: [...view.flow].map(([currency, f]) => ({
      currency,
      incomingAr: amountAr(f.incoming, currency, digits),
      outgoingAr: amountAr(f.outgoing, currency, digits),
      netAr: amountAr(f.net, currency, digits),
    })),
    movementRows: view.movements.map((m) => ({
      voucher: m.voucherNo,
      amount: amountAr(m.amount, m.currency, digits),
    })),
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

function shell(caps: Caps, snapshot: BoxSnapshot, content: readonly UiNode[]): UiNode {
  return appShell({
    nav: navProjection({ caps, priority: null, currentSurface: "box" }),
    scopePath: snapshot.scopePath,
    scopeLabelAr: snapshot.unitLabelAr,
    // البحثُ لمن يملك عرضَ الشبكة على نطاقه وحده — وليس من قدرات هذه الشاشة.
    showSearch: false,
    content,
  })
}

/** أوّلُ قيمةٍ منسّقةٍ أو محرفُ الغياب — «قاعدةُ الصفر» لا رقمَ وهميّ (ق-١١٢). */
function firstOr(rows: readonly string[]): string {
  return rows[0] ?? ABSENT
}

// ── شاشةُ صندوق الوحدة ──────────────────────────────────────────────────────
export const BOX_CONTRACT: ScreenContract = Object.freeze({
  route: "/box",
  surface: "box",
  lenses: ["admin", "section_head", "rabita", "square", "amir", "finance_officer"] as const,
  // موطنُ «الصندوق وسلسلة العهدة المالية» (IA §١ ك-٢٦) — لا موطنَ ثانٍ له.
  canonicalHome: ["box"] as const,
  capabilities: ["box.view", "box.receive", "box.spend", "box.handover"] as const,
  dataSource: "box.unitView",
  emptyStates: { owner: "box.emptyOwner", viewer: "state.deniedTitle" } as const,
})

export function boxScreenNodes(caps: Caps, snapshot: BoxSnapshot): UiNode {
  if (!caps.has("box.view")) return viewerEmpty()

  const blocks: UiNode[] = []

  // «الصناديق الثلاثة» (ع-١٤): رصيدٌ · واردٌ · صادر — ثلاثتُها من نفس المصدر (ق-١١١).
  blocks.push(
    statCard({
      sentenceKey: "box.balance",
      valueAr: firstOr(snapshot.balanceRows.map((r) => r.netAr)),
      scopeNoteKey: "box.scopeNote",
      action: button({ labelKey: "box.movements", variant: "ghost", capability: "box.view" }),
      tone: "brand",
    }),
    statCard({
      sentenceKey: "box.incoming",
      valueAr: firstOr(snapshot.flowRows.map((r) => r.incomingAr)),
      scopeNoteKey: "box.derivedNote",
      action: button({ labelKey: "box.movements", variant: "ghost", capability: "box.view" }),
    }),
    statCard({
      sentenceKey: "box.outgoing",
      valueAr: firstOr(snapshot.flowRows.map((r) => r.outgoingAr)),
      scopeNoteKey: "box.derivedNote",
      action: button({ labelKey: "box.movements", variant: "ghost", capability: "box.view" }),
    }),
  )

  // «آخرُ حركات الصندوق»: المبلغُ ثم تفصيلُه — الأسفلُ يقرأ ما كُتب في الأعلى (ع-١٣).
  blocks.push(
    dataTable({
      columns: [
        { key: "voucher", labelKey: "box.voucherNo" },
        { key: "amount", labelKey: "box.amount" },
      ],
      rows: snapshot.movementRows,
      state: snapshot.movementRows.length === 0 ? "empty" : "data",
      capability: "box.view",
      emptyState: caps.has("box.receive")
        ? emptyState({
            audience: "owner",
            titleKey: "box.emptyMovements",
            actionKey: "box.emptyOwner",
            capability: "box.receive",
          })
        : emptyState({
            audience: "viewer",
            titleKey: "box.emptyMovements",
            diagnosisKey: "state.emptyViewerIdle",
          }),
    }),
  )

  // «الصناديقُ السُّفلية» (ع-٢٤): قائمةٌ **عابرةٌ للوحدات** ⇒ شجرةٌ لا قائمةٌ مسطّحة (§٣-٥).
  blocks.push(
    unitTree({
      nodes: snapshot.childRows.map((child, index) => ({
        id: child.id,
        labelAr: child.labelAr,
        type: "unit",
        depth: index,
      })),
      leafKind: "structure",
      lazyThreshold: TREE_LAZY_THRESHOLD,
      capability: "box.view",
      emptyState: emptyState({
        audience: "viewer",
        titleKey: "box.childBoxes",
        diagnosisKey: "box.emptyChildBoxes",
      }),
    }),
  )

  // أفعالُ الأمين الثلاثة بلغته (قب-٨) — كلٌّ نموذجٌ بمخطط تحقّقه (§٣-٤).
  if (caps.has("box.receive")) {
    blocks.push(
      form({
        schema: "boxReceiveInput",
        fields: [
          field({ name: "currency", labelKey: "box.currency", kind: "select", required: true }),
          field({ name: "amount", labelKey: "box.amount", kind: "money", required: true }),
        ],
        submit: button({ labelKey: "box.receive", variant: "primary", capability: "box.receive" }),
      }),
    )
  }
  if (caps.has("box.spend")) {
    blocks.push(
      form({
        schema: "boxSpendInput",
        fields: [
          // الفئةُ **اختيارٌ من قاموسٍ مغلق** لا نصٌّ حرّ (ق-٦٤) — والقاموسُ بياناتٌ مرجعية.
          field({ name: "categoryId", labelKey: "box.category", kind: "select", required: true }),
          field({ name: "amount", labelKey: "box.amount", kind: "money", required: true }),
        ],
        submit: button({ labelKey: "box.spend", variant: "primary", capability: "box.spend" }),
      }),
    )
  }
  if (caps.has("box.handover")) {
    blocks.push(
      form({
        schema: "boxHandoverInput",
        fields: [
          field({ name: "toUnitId", labelKey: "box.destinationUnit", kind: "select", required: true }),
          field({
            name: "toCustodianPersonId",
            labelKey: "box.recipientCustodian",
            kind: "select",
            required: true,
          }),
          field({ name: "amount", labelKey: "box.amount", kind: "money", required: true }),
        ],
        submit: button({ labelKey: "box.handover", variant: "primary", capability: "box.handover" }),
      }),
    )
  }

  return shell(caps, snapshot, blocks)
}

// ── شاشةُ التسليمات والإقرار ────────────────────────────────────────────────
export const BOX_HANDOVERS_CONTRACT: ScreenContract = Object.freeze({
  route: "/box/handovers",
  surface: "box",
  lenses: ["admin", "section_head", "rabita", "square", "amir"] as const,
  // عرضٌ منسوب: موطنُ الصندوق وسلسلته شاشةُ `/box` — لا موطنَ ثانٍ (IA §١).
  canonicalHome: [] as const,
  capabilities: ["box.view", "box.handover.acknowledge"] as const,
  dataSource: "box.handovers",
  emptyStates: { owner: "box.emptyHandovers", viewer: "state.deniedTitle" } as const,
})

export function boxHandoversScreenNodes(caps: Caps, snapshot: BoxSnapshot): UiNode {
  if (!caps.has("box.view")) return viewerEmpty()

  const blocks: UiNode[] = [
    dataTable({
      columns: [
        { key: "from", labelKey: "box.handoverFrom" },
        { key: "acknowledged", labelKey: "box.acknowledged" },
      ],
      rows: snapshot.handoverRows,
      state: snapshot.handoverRows.length === 0 ? "empty" : "data",
      capability: "box.view",
      emptyState: emptyState({
        audience: "viewer",
        titleKey: "box.handoversHeading",
        diagnosisKey: "box.emptyHandovers",
      }),
    }),
  ]

  // **الإقرارُ فعلٌ شخصيّ**: يظهر لحامل القدرة وحده، وتأكيدُه حوارٌ (ك-٣ «إقرارُ المستلِم»).
  if (caps.has("box.handover.acknowledge")) {
    blocks.push(
      dialog({
        titleKey: "box.acknowledge",
        bodyKey: "box.pendingAck",
        confirm: button({
          labelKey: "box.acknowledge",
          variant: "primary",
          capability: "box.handover.acknowledge",
        }),
        cancelKey: "common.cancel",
      }),
    )
  }

  return shell(caps, snapshot, blocks)
}

// ── شاشةُ مالية المسجد ──────────────────────────────────────────────────────
export const MOSQUE_FINANCE_CONTRACT: ScreenContract = Object.freeze({
  route: "/mosque/finance",
  surface: "box",
  lenses: ["admin", "section_head", "rabita", "square", "amir"] as const,
  // موطنُ «مالية المسجد الداخلية» (IA §١ ك-٢٨).
  canonicalHome: ["mosqueFinance"] as const,
  capabilities: ["mosqueFinance.view", "mosqueFinance.manage"] as const,
  dataSource: "mosqueFinance.view",
  emptyStates: { owner: "mosqueFinance.emptyOwner", viewer: "state.deniedTitle" } as const,
})

export function mosqueFinanceScreenNodes(caps: Caps, snapshot: BoxSnapshot): UiNode {
  if (!caps.has("mosqueFinance.view")) return viewerEmpty()

  const blocks: UiNode[] = [
    statCard({
      sentenceKey: "mosqueFinance.balance",
      valueAr: firstOr(snapshot.balanceRows.map((r) => r.netAr)),
      // **ق-٣٠**: نطاقُه منطوقٌ على الصفحة — مسجدُه وحده، لا مالَ المركز.
      scopeNoteKey: "mosqueFinance.scopeNote",
      action: button({ labelKey: "box.movements", variant: "ghost", capability: "mosqueFinance.view" }),
      tone: "brand",
    }),
    dataTable({
      columns: [
        { key: "voucher", labelKey: "box.voucherNo" },
        { key: "amount", labelKey: "box.amount" },
      ],
      rows: snapshot.movementRows,
      state: snapshot.movementRows.length === 0 ? "empty" : "data",
      capability: "mosqueFinance.view",
      emptyState: caps.has("mosqueFinance.manage")
        ? emptyState({
            audience: "owner",
            titleKey: "mosqueFinance.heading",
            actionKey: "mosqueFinance.emptyOwner",
            capability: "mosqueFinance.manage",
          })
        : emptyState({
            audience: "viewer",
            titleKey: "mosqueFinance.heading",
            diagnosisKey: "state.emptyViewerIdle",
          }),
    }),
  ]

  // ق-٦٣: الأميرُ يسجّل **مباشرةً** — لا طابورَ اعتمادٍ في هذا الباب، وضبطُه سلسلةُ الإقفال.
  if (caps.has("mosqueFinance.manage")) {
    blocks.push(
      form({
        schema: "mosqueFinanceInput",
        fields: [
          field({ name: "verb", labelKey: "mosqueFinance.record", kind: "select", required: true }),
          field({ name: "amount", labelKey: "box.amount", kind: "money", required: true }),
        ],
        submit: button({
          labelKey: "mosqueFinance.record",
          variant: "primary",
          capability: "mosqueFinance.manage",
        }),
      }),
    )
  }

  return shell(caps, snapshot, blocks)
}

registerScreen({ contract: BOX_CONTRACT, preview: (caps) => boxScreenNodes(caps, EMPTY_BOX_SNAPSHOT) })
registerScreen({
  contract: BOX_HANDOVERS_CONTRACT,
  preview: (caps) => boxHandoversScreenNodes(caps, EMPTY_BOX_SNAPSHOT),
})
registerScreen({
  contract: MOSQUE_FINANCE_CONTRACT,
  preview: (caps) => mosqueFinanceScreenNodes(caps, EMPTY_BOX_SNAPSHOT),
})
