/**
 * الشاشتان الدنيا لنواة الدفتر — **إثباتُ الحراسة لا واجهةٌ ماليةٌ كاملة**
 * (`SPEC_finance_ledger` §٩ يسمّي الشاشة الثقيلة ولا يبنيها — قب-٢٦).
 *
 * **طبقةُ عرضٍ نقيّة**: كلُّ شاشةٍ دالةٌ من (قشرةِ القدرات المحسوبة + بيانات) إلى بنية عرض.
 * لا تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦) — تُظهر بأعلام القدرات فقط، وتعرض **فراغاً
 * مُشخِّصاً** عند المنع لا شاشةً بيضاء (ق-١١٢).
 *
 * **والوجهُ يتبسّط** (قب-٨): مفرداتُ الشاشة «قبضتُ/دفعتُ/سلّمتُ» و«هل الدفتر سليم؟» —
 * لا مدينَ ولا دائنَ ولا يوميّة؛ والمحرّكُ تحتها قيدٌ مزدوجٌ كامل.
 */

import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import { t } from "../../../ui/text/dictionary.js"
import type { UiNode } from "../../../ui/components/kernel.js"
import { button } from "../../../ui/components/atoms.js"
import { form, statCard } from "../../../ui/components/molecules.js"
import { dataTable, emptyState } from "../../../ui/components/organisms.js"
import { registerScreen } from "../../../ui/screens/registry.js"
import type { ScreenContract } from "../../../ui/screens/contract.js"
import { balanceProof, type LedgerContext } from "../services/journal.js"
import { cashBalances, type CurrencyBalance } from "../services/balances.js"
import { deductionsVisible } from "../services/deductions.js"
import { pendingActionsFor } from "../services/dualControl.js"
import type { LedgerStore } from "../data/store.js"
import type { CurrencyCode, PendingAction } from "../types.js"

export type DeniedView = { readonly kind: "denied"; readonly reasonAr: string }
type Caps = ReadonlySet<CapId>

const NO_VIEW: DeniedView = {
  kind: "denied",
  reasonAr: `${t("state.deniedTitle")} — ${t("state.deniedHint")}`,
}

/** فراغُ المطّلع مُشخِّصٌ دائماً (ق-١١٢) — يُعاد استعماله في معاينات هذه الوحدة. */
const VIEWER_EMPTY = (): UiNode =>
  emptyState({
    audience: "viewer",
    titleKey: "state.deniedTitle",
    diagnosisKey: "state.deniedHint",
  })

// ── شاشةُ الدفتر ────────────────────────────────────────────────────────────
export type LedgerRow = {
  readonly voucherNo: string
  readonly memoAr: string
  readonly currency: CurrencyCode
  readonly amount: number
}

export type LedgerView =
  | DeniedView
  | {
      readonly kind: "granted"
      readonly headingAr: string
      /** جوابُ سؤال صباح الماليّ الثالث: «هل الدفتر سليم؟» (عدسة §٢.٩). */
      readonly balanced: boolean
      readonly balances: ReadonlyMap<CurrencyCode, CurrencyBalance>
      readonly rows: readonly LedgerRow[]
      /** ب-٣١: عرضُ الخصومات خلف مفتاحِ إدارةٍ افتراضُه الإخفاء — البنيةُ قائمةٌ دائماً. */
      readonly deductionsShown: boolean
      readonly actions: {
        readonly proposeOperation: boolean
        readonly proposeJournal: boolean
      }
    }

function rowsOf(store: LedgerStore, unitPath: string): readonly LedgerRow[] {
  const out: LedgerRow[] = []
  for (const entry of store.entries()) {
    if (!entry.unitPath.startsWith(unitPath)) continue
    for (const line of store.linesOf(entry.id)) {
      if (line.debit === 0) continue
      out.push({
        voucherNo: entry.voucherNo,
        memoAr: entry.memoAr,
        currency: line.currency,
        amount: line.debit,
      })
    }
  }
  return out
}

export function ledgerScreen(
  caps: Caps,
  store: LedgerStore,
  unitPath: string,
  ctx: LedgerContext,
): LedgerView {
  if (!caps.has("finance.view")) return NO_VIEW
  return {
    kind: "granted",
    headingAr: t("ledger.heading"),
    balanced: balanceProof(store).balanced,
    balances: cashBalances(store, unitPath),
    rows: rowsOf(store, unitPath),
    deductionsShown: deductionsVisible(ctx, unitPath),
    actions: {
      proposeOperation: caps.has("finance.entry"),
      proposeJournal: caps.has("ledger.journal.entry"),
    },
  }
}

export const LEDGER_CONTRACT: ScreenContract = Object.freeze({
  route: "/finance/ledger",
  surface: "centralFinance",
  // عدستا المحاسبة المركزية: الماليُّ يُعِدّ، والمديرُ يطّلع (§٢.١ و§٢.٩ من عدسات الأدوار).
  lenses: ["admin", "finance_officer"] as const,
  canonicalHome: ["centralAccounting"] as const,
  capabilities: ["finance.view", "finance.entry", "ledger.journal.entry"] as const,
  dataSource: "ledger.balances",
  emptyStates: { owner: "ledger.emptyOwner", viewer: "state.deniedTitle" } as const,
})

export function ledgerScreenNodes(caps: Caps): UiNode {
  if (!caps.has("finance.view")) return VIEWER_EMPTY()

  // جوابُ «هل الدفتر سليم؟» رقمٌ **يقود لفعل** (ق-١٠٨)، ونطاقُه منطوقٌ على الصفحة (ق-١١٠).
  const health = statCard({
    sentenceKey: "ledger.healthQuestion",
    valueAr: t("ledger.healthBalanced"),
    scopeNoteKey: "ledger.scopeNote",
    action: button({ labelKey: "ledger.movements", variant: "ghost", capability: "finance.view" }),
  })
  const table = dataTable({
    columns: [
      { key: "voucher", labelKey: "ledger.voucherNo" },
      { key: "amount", labelKey: "ledger.amount" },
    ],
    rows: [],
    state: "empty",
    capability: "finance.view",
    emptyState: emptyState({
      audience: "viewer",
      titleKey: "ledger.movements",
      diagnosisKey: "state.emptyViewerIdle",
    }),
  })

  const journalButton = (variant: "primary" | "secondary"): UiNode =>
    button({ labelKey: "ledger.proposeJournal", variant, capability: "ledger.journal.entry" })

  // المطّلعُ (المدير) يرى العرضَ وحده — لا زرَّ تأليفٍ لقيدٍ سيعتمده هو (فصلُ المهام ق-٥٤).
  if (!caps.has("finance.entry")) {
    if (!caps.has("ledger.journal.entry")) return health
    return form({ schema: "ledgerJournalInput", fields: [health, table], submit: journalButton("primary") })
  }

  const fields: UiNode[] = caps.has("ledger.journal.entry")
    ? [health, table, journalButton("secondary")]
    : [health, table]
  return form({
    schema: "ledgerOperationInput",
    fields,
    submit: button({
      labelKey: "ledger.recordOperation",
      variant: "primary",
      capability: "finance.entry",
    }),
  })
}

// ── شاشةُ البتّ في المقترحات ────────────────────────────────────────────────
export type ApprovalRow = {
  readonly id: string
  readonly kind: PendingAction["kind"]
  readonly requestedBy: string
}

export type ApprovalsView =
  | DeniedView
  | {
      readonly kind: "granted"
      readonly headingAr: string
      readonly rows: readonly ApprovalRow[]
      readonly actions: { readonly approve: boolean; readonly reject: boolean }
    }

export function approvalsScreen(caps: Caps, store: LedgerStore, unitPath: string): ApprovalsView {
  if (!caps.has("finance.supervise")) return NO_VIEW
  return {
    kind: "granted",
    headingAr: t("ledger.approvalsHeading"),
    rows: pendingActionsFor(store, unitPath).map((a) => ({
      id: a.id,
      kind: a.kind,
      requestedBy: a.requestedBy,
    })),
    actions: { approve: true, reject: true },
  }
}

export const APPROVALS_CONTRACT: ScreenContract = Object.freeze({
  route: "/finance/approvals",
  surface: "centralFinance",
  // عدسةُ المدير وحدها: الماليُّ **محظورٌ عليه** زرُّ الاعتماد نصاً (§٣ من عدسات الأدوار).
  lenses: ["admin"] as const,
  // عرضٌ منسوب: موطنُ المحاسبة المركزية شاشةُ الدفتر — لا موطنَ ثانٍ (IA §١ ك-٢٧).
  canonicalHome: [] as const,
  capabilities: ["finance.supervise"] as const,
  dataSource: "ledger.pendingActions",
  emptyStates: { owner: "ledger.emptyApprovals", viewer: "state.deniedTitle" } as const,
})

export function approvalsScreenNodes(caps: Caps): UiNode {
  if (!caps.has("finance.supervise")) return VIEWER_EMPTY()
  return dataTable({
    columns: [
      { key: "requester", labelKey: "ledger.approvalRequester" },
      { key: "amount", labelKey: "ledger.amount" },
    ],
    rows: [],
    state: "empty",
    capability: "finance.supervise",
    emptyState: emptyState({
      audience: "owner",
      titleKey: "ledger.approvalsHeading",
      actionKey: "ledger.emptyApprovals",
      capability: "finance.supervise",
    }),
  })
}

registerScreen({ contract: LEDGER_CONTRACT, preview: ledgerScreenNodes })
registerScreen({ contract: APPROVALS_CONTRACT, preview: approvalsScreenNodes })
