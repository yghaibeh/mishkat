/**
 * الكائنات الأحد عشر — SPEC_design_system §٢-ج، والجوال أولاً والوصول في صميمها (§٤):
 *  - الجدولُ يتحوّل بطاقاتٍ على الجوال؛ **لا تمريرَ أفقيٍّ للصفحة** أبداً (§٤-١).
 *  - الحوارُ ورقةٌ سفليّةٌ على الجوال مع حبس تركيز (§٤-٢/§٤-٤).
 *  - الشجرةُ توسِّع بحسب نوع الورقة وتُحمّل كسولاً عند العتبة (ق-١١٦).
 *  - كل قائمةٍ/جدولٍ/شجرةٍ **بحالةٍ فارغةٍ مُشخِّصة** وإلا لم تُبنَ (§٣-١، G20).
 */

import { node, label, type CapabilityDeclaration, type Tone, type UiNode } from "./kernel.js"
import type { TextKey } from "../text/dictionary.js"

// ── ك-٧ الحالة الفارغة (تُبنى أولاً لأن غيرَها يطلبها) ───────────────────────
export type EmptyStateProps = {
  readonly audience: "owner" | "viewer"
  readonly titleKey: TextKey
  /** لصاحب العمل: دعوةُ فعلٍ صريحة (ق-١١٢). */
  readonly actionKey?: TextKey
  readonly capability?: CapabilityDeclaration
  /** للمطّلع: تشخيصٌ ووجهةُ العلاج ومن يُسأل (ق-١٠٩/ق-١١٢). */
  readonly diagnosisKey?: TextKey
}

export function emptyState(props: EmptyStateProps): UiNode {
  if (props.audience === "owner" && props.actionKey === undefined) {
    throw new Error("فراغُ صاحب العمل بلا دعوة فعلٍ = شاشةٌ بيضاء — يقول ماذا يفعل (ق-١١٢)")
  }
  if (props.audience === "viewer" && props.diagnosisKey === undefined) {
    throw new Error("فراغُ المطّلع بلا تشخيصٍ = «لا بيانات» خام — يقول شاغرٌ أم لم يُنتج (ق-١١٢)")
  }
  const textKeys: TextKey[] = [props.titleKey]
  if (props.actionKey !== undefined) textKeys.push(props.actionKey)
  if (props.diagnosisKey !== undefined) textKeys.push(props.diagnosisKey)
  return node({
    component: "EmptyState",
    textKeys,
    a11y: { role: "status", nameAr: label(props.titleKey) },
    meta: {
      audience: props.audience,
      diagnostic: "true",
      ...(props.capability === undefined ? {} : { actionCapability: props.capability }),
    },
  })
}

// ── ك-٨ الكتلة الشارحة ──────────────────────────────────────────────────────
export type DiagnosisBlockProps = {
  readonly stateKey: TextKey
  readonly responsibleKey: TextKey
}

export function diagnosisBlock(props: DiagnosisBlockProps): UiNode {
  // للمطّلع تشخيصٌ **بلا زرٍّ تشغيليّ**: لا أبناءَ تفاعليين بحكم البناء (ق-١٠٩).
  return node({
    component: "DiagnosisBlock",
    textKeys: [props.stateKey, props.responsibleKey],
    a11y: { role: "note", nameAr: label(props.stateKey) },
    meta: { operationalAction: "none" },
  })
}

// ── ك-١ الجدول ──────────────────────────────────────────────────────────────
export type TableColumn = { readonly key: string; readonly labelKey: TextKey }

export type DataTableProps = {
  readonly columns: readonly TableColumn[]
  readonly rows: readonly Readonly<Record<string, string>>[]
  readonly state: "loading" | "empty" | "error" | "data"
  readonly capability: CapabilityDeclaration
  readonly emptyState: UiNode
}

export function dataTable(props: DataTableProps): UiNode {
  if (props.emptyState === undefined || props.emptyState.component !== "EmptyState") {
    throw new Error("جدولٌ بلا حالة فارغةٍ معلنة — كل قائمةٍ تقول سببَ فراغها (§٣-١، G20)")
  }
  return node({
    component: "DataTable",
    textKeys: props.columns.map((c) => c.labelKey),
    a11y: { role: "table", nameAr: label(props.columns[0]?.labelKey ?? "common.details") },
    meta: {
      state: props.state,
      rows: String(props.rows.length),
      columns: props.columns.map((c) => c.key).join(","),
      guardedBy: props.capability,
      // الجوال أولاً: بطاقاتٌ مكدّسة لا أعمدةٌ تختفي خلف تمريرٍ أفقيّ (§٤-١).
      mobileLayout: "cards",
      horizontalPageScroll: "false",
    },
    children: [props.emptyState],
  })
}

// ── ك-٢ الشجرة ──────────────────────────────────────────────────────────────
export type TreeNodeInput = {
  readonly id: string
  readonly labelAr: string
  readonly type: string
  readonly depth: number
}

export type UnitTreeProps = {
  readonly nodes: readonly TreeNodeInput[]
  /** نوعُ الورقة يحكم التوسيع الافتراضيّ (ق-١١٦). */
  readonly leafKind: "structure" | "people"
  /** عتبةُ التحميل الكسول — **إعدادٌ حيّ** يُمرَّر ولا يُصلَّب (قب-٦). */
  readonly lazyThreshold: number
  readonly capability: CapabilityDeclaration
  readonly emptyState: UiNode
}

export function unitTree(props: UnitTreeProps): UiNode {
  if (props.emptyState.component !== "EmptyState") {
    throw new Error("شجرةٌ بلا حالة فارغةٍ معلنة — تقول سببَ فراغها (§٣-١، G20)")
  }
  const lazy = props.nodes.length > props.lazyThreshold
  return node({
    component: "UnitTree",
    a11y: { role: "tree", nameAr: props.nodes[0]?.labelAr ?? label("state.emptyViewerVacant") },
    meta: {
      leafKind: props.leafKind,
      // الهيكليةُ مفتوحةٌ حتى الحاويات؛ وأوراقُ الأشخاص مطويّةٌ خلف حاويتها (لا ٥٠ اسماً دفعة).
      defaultExpanded: String(props.leafKind === "structure"),
      lazyThreshold: String(props.lazyThreshold),
      lazyLoading: String(lazy),
      nodes: String(props.nodes.length),
      guardedBy: props.capability,
    },
    children: [props.emptyState],
  })
}

// ── ك-٣ الحوار / الورقة السفلية ─────────────────────────────────────────────
export type DialogProps = {
  readonly titleKey: TextKey
  readonly bodyKey: TextKey
  readonly confirm: UiNode
  readonly cancelKey: TextKey
  readonly destructive?: boolean
}

export function dialog(props: DialogProps): UiNode {
  const destructive = props.destructive === true
  if (destructive && props.confirm.meta.variant !== "danger") {
    throw new Error("الفعلُ الهدّام يُؤكَّد بزرٍّ من نوع «خطر» يقول الأثر (§٣-٩)")
  }
  return node({
    component: "Dialog",
    textKeys: [props.titleKey, props.bodyKey, props.cancelKey],
    a11y: { role: "dialog", nameAr: label(props.titleKey), focusTrap: true },
    meta: {
      // على الجوال ورقةٌ سفليّة يصلها الإبهام لا حوارٌ مركزيّ (§٤-١/§٤-٢).
      mobilePresentation: "bottom-sheet",
      destructive: String(destructive),
      dismissible: "true",
    },
    children: [props.confirm],
  })
}

// ── ك-٤ التنبيه العابر والثابت ──────────────────────────────────────────────
export type ToastProps = {
  readonly messageKey: TextKey
  readonly tone: Tone
  readonly iconName: string
}

export function toast(props: ToastProps): UiNode {
  return node({
    component: "Toast",
    textKeys: [props.messageKey],
    tone: props.tone,
    iconName: props.iconName,
    // تغيّرُ المحتوى الحيّ مُعلَنٌ لقارئ الشاشة (§٤-٤)، والخطأ الدائم يُعلَن لا يُبتلَع (ت-٨).
    a11y: { role: "alert", nameAr: label(props.messageKey), live: "assertive" },
    meta: { transient: "true" },
  })
}

export function banner(props: ToastProps): UiNode {
  return node({
    component: "Banner",
    textKeys: [props.messageKey],
    tone: props.tone,
    iconName: props.iconName,
    a11y: { role: "status", nameAr: label(props.messageKey), live: "polite" },
    meta: { transient: "false" },
  })
}

// ── ك-٥ التبويبات ───────────────────────────────────────────────────────────
export type TabItem = {
  readonly labelKey: TextKey
  readonly capability: CapabilityDeclaration
  readonly routeSegment: string
}

export function tabs(props: { readonly items: readonly TabItem[] }): UiNode {
  return node({
    component: "Tabs",
    textKeys: props.items.map((i) => i.labelKey),
    a11y: { role: "tablist", nameAr: label(props.items[0]?.labelKey ?? "common.details") },
    meta: {
      // التبويباتُ **لا تستبدل القشرة** (ق-١١٤): شريطُ الدور يبقى فوقها في كل صفحة.
      replacesShell: "false",
      // ولا معلومةَ جوهرية تختفي بتغيير التبويب بلا أثرٍ في المسار.
      routed: "true",
      segments: props.items.map((i) => i.routeSegment).join(","),
      guardedBy: props.items.map((i) => i.capability).join(","),
    },
  })
}

// ── ك-٩ لوحة الرفع ──────────────────────────────────────────────────────────
export type UploaderProps = {
  readonly capability: CapabilityDeclaration
  readonly acceptedTypes: readonly string[]
  readonly maxBytes: number
  /** نسبةُ الصورة: ماذا/أين/متى/مَن — «لا محتوى بلا سياق» (ق-١٠٣). */
  readonly attribution: readonly string[]
}

const REQUIRED_ATTRIBUTION = ["what", "where", "when", "who"] as const

export function uploader(props: UploaderProps): UiNode {
  if (props.acceptedTypes.some((t) => t.includes("svg"))) {
    throw new Error("رفعُ SVG مرفوض (ت-٥: تنفيذُ نصٍّ داخل الصورة) — الصورُ النقطية فقط")
  }
  const missing = REQUIRED_ATTRIBUTION.filter((k) => !props.attribution.includes(k))
  if (missing.length > 0) {
    throw new Error(`الصورةُ منسوبةٌ دائماً (ق-١٠٣): ينقصها ${missing.join("، ")}`)
  }
  return node({
    component: "Uploader",
    capability: props.capability,
    a11y: { role: "button", nameAr: label("common.submit") },
    meta: {
      acceptedTypes: props.acceptedTypes.join(","),
      maxBytes: String(props.maxBytes),
      attribution: props.attribution.join(","),
      // التحقّقُ في الخادم أيضاً — الواجهةُ لا تحمي (المادة ٤/٦)؛ والأوفلاين يُطابَر (ت-٨).
      serverValidated: "true",
      offlineBehavior: "queued",
    },
  })
}

// ── ك-١٠ البحث ──────────────────────────────────────────────────────────────
export type SearchBoxProps = {
  readonly capability: CapabilityDeclaration
  /** نطاقُ البحث — بلا نطاقٍ يصير بحثاً شبكياً يكشف ما خارج العدسة (ثغرةُ v1). */
  readonly scopePath: string
}

export function searchBox(props: SearchBoxProps): UiNode {
  if (props.scopePath.trim().length === 0) {
    throw new Error("بحثٌ بلا نطاقٍ معلن — البحثُ محكومٌ بالنطاق والقدرة (ك-١٠)")
  }
  return node({
    component: "SearchBox",
    capability: props.capability,
    textKeys: ["shell.searchPlaceholder"],
    a11y: { role: "searchbox", nameAr: label("shell.searchPlaceholder") },
    meta: { scopePath: props.scopePath, scoped: "true" },
  })
}

// ── ك-١١ جرس الإشعارات ──────────────────────────────────────────────────────
export function notificationBell(props: {
  readonly capability: CapabilityDeclaration
  readonly unread?: number
}): UiNode {
  return node({
    component: "NotificationBell",
    capability: props.capability,
    textKeys: ["shell.notifications"],
    iconName: "bell",
    a11y: { role: "button", nameAr: label("shell.notifications"), live: "polite" },
    meta: {
      unread: String(props.unread ?? 0),
      // الاطّلاعُ هابطٌ معزولٌ بالنطاق (ق-١٠٥)، ولا تكرارَ للإشعار نفسه (ت-٩).
      scopeIsolated: "true",
      deduplicated: "true",
    },
  })
}
