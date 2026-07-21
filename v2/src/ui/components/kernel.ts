/**
 * نواةُ مكتبة المكوّنات — SPEC_design_system §٢/§٦-١.
 *
 * ثلاثةُ ثوابتٍ تُفرَض **هنا** فتستحيل مخالفتُها في أي شاشة (لا تُترك للمراجعة البشرية):
 *  ١. **المكتبة مغلقة**: مكوّنٌ خارج السجل يُرفض نوعياً وزمنَ التشغيل معاً.
 *  ٢. **كل عنصرٍ تفاعليٍّ يعلن قدرته** (المادة ٤/٦): بلا إعلانٍ لا يُبنى العنصر أصلاً —
 *     نظيرُ G7 على الخادم («الدالة بلا إعلانٍ لا تُسجَّل»).
 *  ٣. **الدلالة مزدوجة** (§٤-٥): كل نبرةٍ دلاليّة تقترن بأيقونةٍ ونصّ — لا لونٌ وحده.
 *
 * والعرضُ **بنيةُ بياناتٍ نقيّة** لا DOM: يُختبر بلا متصفح، ويُصيَّر لاحقاً بأي إطارٍ يُعتمد
 * (ADR-002) دون تغيير عقدٍ واحد — وهو ما يجعل «السياج قبل الميزات» ممكناً قبل حسم الإطار.
 */

import type { CapId } from "../../authorization/generated/capabilities.generated.js"
import { TEXT, type TextKey } from "../text/dictionary.js"
import { TOKENS } from "../tokens/tokens.js"

// ── سجلّ المكتبة المغلق ─────────────────────────────────────────────────────
export type ComponentId =
  // ٢-أ الذرّات (٧)
  | "Button"
  | "Link"
  | "Icon"
  | "Badge"
  | "HijriDate"
  | "Money"
  | "Avatar"
  // ٢-ب الجزيئات (٦)
  | "Field"
  | "Form"
  | "StatCard"
  | "ListItem"
  | "EntityCard"
  | "InlineFeedback"
  // ٢-ج الكائنات (١١)
  | "DataTable"
  | "UnitTree"
  | "Dialog"
  | "Toast"
  | "Banner"
  | "Tabs"
  | "EmptyState"
  | "DiagnosisBlock"
  | "Uploader"
  | "SearchBox"
  | "NotificationBell"
  // القشرة (٢)
  | "AppShell"
  | "NavBar"

export type ComponentTier = "atom" | "molecule" | "organism" | "shell"

export type ComponentContract = {
  readonly id: ComponentId
  readonly tier: ComponentTier
  readonly purposeAr: string
  readonly statesAr: readonly string[]
  /** متى **لا** يُستعمل — نصفُ العقد الذي أهملته v1 فتلزّقت الشاشات. */
  readonly neverAr: string
  /** المُستعمِلُ المُسنَد من `A_features` — لا مكوّنَ مخترعٌ بلا مستعمِل (§٢ معيار ١). */
  readonly usedByAr: readonly string[]
  /** تفاعليّ ⇒ يلزمه إعلانُ قدرةٍ عند كل استعمال. */
  readonly interactive: boolean
}

function contract(c: ComponentContract): ComponentContract {
  return Object.freeze(c)
}

export const COMPONENTS: Readonly<Record<ComponentId, ComponentContract>> = Object.freeze({
  Button: contract({
    id: "Button",
    tier: "atom",
    purposeAr: "فعلٌ واحدٌ واضح",
    statesAr: ["عاديّ", "تحويم", "تركيز", "مضغوط", "مُعطَّل", "مُحمَّل"],
    neverAr: "للتنقّل (استعمل الرابط) ولا لأكثر من فعل",
    usedByAr: ["اعتماد NESSA", "إرسال تقرير", "رفع وسائط"],
    interactive: true,
  }),
  Link: contract({
    id: "Link",
    tier: "atom",
    purposeAr: "انتقالٌ إلى موطنٍ في هندسة المعلومات",
    statesAr: ["عاديّ", "تحويم", "تركيز", "مُزار", "حاليّ"],
    neverAr: "لتنفيذ فعلٍ (ذاك زر)",
    usedByAr: ["القشرة والتنقّل", "الشجرة", "البطاقات"],
    interactive: true,
  }),
  Icon: contract({
    id: "Icon",
    tier: "atom",
    purposeAr: "دعمٌ بصريٌّ للمعنى لا يحمله وحده",
    statesAr: ["عاديّ", "مُعطَّل"],
    neverAr: "لحمل المعنى بلا نصٍّ مقترن",
    usedByAr: ["الشريط", "الشجرة", "الشارات", "الأدوار"],
    interactive: false,
  }),
  Badge: contract({
    id: "Badge",
    tier: "atom",
    purposeAr: "وسمُ حالةٍ أو تصنيف",
    statesAr: ["نجاح", "تحذير", "خطر", "معلومة", "محايد"],
    neverAr: "لعرض رقمٍ يقود لفعل (ذاك سطرٌ مفهوم) ولا لتزيينٍ بلا معنى",
    usedByAr: ["حالة سجل NESSA", "تصنيف المسجد", "حالة العهدة"],
    interactive: false,
  }),
  HijriDate: contract({
    id: "HijriDate",
    tier: "atom",
    purposeAr: "تاريخٌ ووقتٌ هجريٌّ بأم القرى",
    statesAr: ["مطلق", "نسبيّ"],
    neverAr: "لتنسيقٍ محليٍّ في شاشة (يسرّب اختلافَ الشكل)",
    usedByAr: ["كل شاشة"],
    interactive: false,
  }),
  Money: contract({
    id: "Money",
    tier: "atom",
    purposeAr: "مبلغٌ بعملةٍ ومنزلةٍ متسقة",
    statesAr: ["موجب", "سالب", "صفر"],
    neverAr: "لعملةٍ أو منزلةٍ صلبتين في العرض (كلاهما إعداد)",
    usedByAr: ["الصندوق الهرمي", "الدفتر المزدوج", "مالية المسجد", "الرواتب"],
    interactive: false,
  }),
  Avatar: contract({
    id: "Avatar",
    tier: "atom",
    purposeAr: "تمييزُ شخصٍ أو وحدةٍ بصرياً",
    statesAr: ["رمز", "صورة"],
    neverAr: "لصورة قاصرٍ حقيقية قبل حسم سياسة القُصَّر (قب-١٩)",
    usedByAr: ["الشجرة", "بوابة الطالب", "الإشراف"],
    interactive: false,
  }),
  Field: contract({
    id: "Field",
    tier: "molecule",
    purposeAr: "مدخلٌ واحدٌ بتسميةٍ ورسالةِ تحقّق",
    statesAr: ["فارغ", "مُركَّز", "مملوء", "خطأ تحقّق", "مُعطَّل", "للقراءة فقط"],
    neverAr: "لاختيارٍ من خياراتٍ كثيرةٍ مع بحث",
    usedByAr: ["كل النماذج"],
    interactive: true,
  }),
  Form: contract({
    id: "Form",
    tier: "molecule",
    purposeAr: "تجميعُ حقولٍ وإرسالٌ محكوم",
    statesAr: ["جاهز", "قيد الإرسال", "خطأ", "مُطابَر أوفلاين"],
    neverAr: "بلا مخطط تحقّقٍ معلن أو بأكثر من فعلٍ أساسيّ",
    usedByAr: ["كل إدخال"],
    interactive: false,
  }),
  StatCard: contract({
    id: "StatCard",
    tier: "molecule",
    purposeAr: "رقمٌ يقود لفعلٍ بجملةٍ تجيب سؤال الصفحة",
    statesAr: ["بيانات", "تحميل", "فارغ مُشخِّص"],
    neverAr: "لعدّادٍ شبكيٍّ داخل صفحة وحدة، ولا لرقمٍ بلا فعل",
    usedByAr: ["الرئيسيات حسب الدور", "لوحة الإشراف", "الصندوق"],
    interactive: false,
  }),
  ListItem: contract({
    id: "ListItem",
    tier: "molecule",
    purposeAr: "سطرٌ جملةٌ تجيب سؤال الصفحة",
    statesAr: ["عاديّ", "تحويم", "مُختار", "قابل للطيّ"],
    neverAr: "لرصف حقولٍ بلا معنى، ولا بمالكَين معاً",
    usedByAr: ["كل قائمة"],
    interactive: false,
  }),
  EntityCard: contract({
    id: "EntityCard",
    tier: "molecule",
    purposeAr: "تلخيصُ كيانٍ بعنوانٍ وحالٍ وأفعالٍ مملوكة",
    statesAr: ["بيانات", "تحميل", "فارغ مُشخِّص"],
    neverAr: "لكتلتين تجيبان سؤالاً واحداً",
    usedByAr: ["صفحة المسجد", "البيان", "التغطية", "العُهد"],
    interactive: false,
  }),
  InlineFeedback: contract({
    id: "InlineFeedback",
    tier: "molecule",
    purposeAr: "رسالةٌ مقترنةٌ بعنصر",
    statesAr: ["خطأ", "تحذير", "معلومة", "نجاح"],
    neverAr: "لرسالةٍ عابرةٍ عامة (ذاك تنبيهٌ عابر)",
    usedByAr: ["النماذج", "الأفعال الحسّاسة"],
    interactive: false,
  }),
  DataTable: contract({
    id: "DataTable",
    tier: "organism",
    purposeAr: "صفوفٌ متجانسةٌ قابلةٌ للفرز والترشيح",
    statesAr: ["تحميل", "فارغ مُشخِّص", "خطأ", "بيانات"],
    neverAr: "لعناصر من وحداتٍ مختلفة (تلك شجرة)",
    usedByAr: ["المحاسبة", "الرواتب", "التدقيق", "التقارير"],
    interactive: false,
  }),
  UnitTree: contract({
    id: "UnitTree",
    tier: "organism",
    purposeAr: "قائمةٌ تجمع عناصر من وحداتٍ مختلفة — شجرةٌ لا مسطّحة",
    statesAr: ["موسّعة", "مطويّة", "تحميلٌ كسول", "فارغ مُشخِّص"],
    neverAr: "لقائمةٍ داخل وحدةٍ واحدة",
    usedByAr: ["البيان والاستكشاف", "الإشراف", "الإدارة"],
    interactive: false,
  }),
  Dialog: contract({
    id: "Dialog",
    tier: "organism",
    purposeAr: "تأكيدٌ أو نموذجٌ قصيرٌ فوق السياق",
    statesAr: ["مفتوح", "مغلق"],
    neverAr: "لمحتوىً طويل (صفحة) ولا لرسالةٍ عابرة",
    usedByAr: ["تأكيد الحذف", "اعتماد NESSA", "إقرار المستلِم"],
    interactive: false,
  }),
  Toast: contract({
    id: "Toast",
    tier: "organism",
    purposeAr: "نتيجةُ فعلٍ عابرة",
    statesAr: ["نجاح", "خطأ", "معلومة"],
    neverAr: "لحالةٍ مستمرّة (تلك بانر)",
    usedByAr: ["كل فعلٍ ونتيجة"],
    interactive: false,
  }),
  Banner: contract({
    id: "Banner",
    tier: "organism",
    purposeAr: "حالةٌ مستمرّة: أوفلاين، نسخةٌ جديدة، صلاحيةٌ منتهية",
    statesAr: ["تحذير", "معلومة", "خطر"],
    neverAr: "لنتيجةِ فعلٍ عابرة",
    usedByAr: ["القشرة", "الأوفلاين", "توحّد النسخة"],
    interactive: false,
  }),
  Tabs: contract({
    id: "Tabs",
    tier: "organism",
    purposeAr: "أقسامُ كيانٍ مزار — شريطٌ ثانويٌّ داخل الصفحة",
    statesAr: ["حاليّ", "متاح", "مُعطَّل"],
    neverAr: "لتنقّلٍ رئيسيّ بين أقسام التطبيق ولا لاستبدال القشرة",
    usedByAr: ["صفحة المسجد", "الكيانات متعددة الأوجه"],
    interactive: false,
  }),
  EmptyState: contract({
    id: "EmptyState",
    tier: "organism",
    purposeAr: "فراغٌ مُشخِّص يقول السبب ومن يُسأل",
    statesAr: ["لصاحب العمل", "للمطّلع"],
    neverAr: "لشاشةٍ بيضاء أو «لا بيانات» خام",
    usedByAr: ["كل قائمة وجدولٍ وشجرةٍ ورئيسية"],
    interactive: false,
  }),
  DiagnosisBlock: contract({
    id: "DiagnosisBlock",
    tier: "organism",
    purposeAr: "للمطّلع: الحال ومن المسؤول ويُسأل",
    statesAr: ["شاغر", "معيَّنٌ لم يُنتج"],
    neverAr: "لعرض زرٍّ تشغيليٍّ ليس للمطّلع",
    usedByAr: ["صفحات النزول للقيادات"],
    interactive: false,
  }),
  Uploader: contract({
    id: "Uploader",
    tier: "organism",
    purposeAr: "رفعُ صورةٍ أو ملفٍّ بتحقّق نوعٍ وحجم",
    statesAr: ["جاهز", "قيد الرفع", "خطأ", "مُطابَر أوفلاين"],
    neverAr: "لرفعٍ بلا نسبةٍ (ماذا/أين/متى/من) أو بأنواعٍ خطرة",
    usedByAr: ["مركز الإعلام", "التغطية", "الإدخال الميداني"],
    interactive: true,
  }),
  SearchBox: contract({
    id: "SearchBox",
    tier: "organism",
    purposeAr: "بحثٌ فوريٌّ محكومٌ بالنطاق والقدرة",
    statesAr: ["فارغ", "يكتب", "نتائج", "لا نتائج"],
    neverAr: "لبحثٍ يكشف ما خارج عدسة الدور",
    usedByAr: ["القشرة", "الشجرة", "الإدارة"],
    interactive: true,
  }),
  NotificationBell: contract({
    id: "NotificationBell",
    tier: "organism",
    purposeAr: "إعلامٌ باطّلاع النطاق الهابط",
    statesAr: ["بلا جديد", "جديد", "مقروء"],
    neverAr: "لتكرار الإشعار نفسه أو لاشتراكٍ منتهٍ لا يُنظَّف",
    usedByAr: ["القشرة", "الميدان", "الإعلام"],
    interactive: true,
  }),
  AppShell: contract({
    id: "AppShell",
    tier: "shell",
    purposeAr: "القشرةُ الواحدة: شريطُ دورك في كل صفحة",
    statesAr: ["مسجَّل", "زائر"],
    neverAr: "لصفحةٍ تبدّل ترويستها فيضيع طريق العودة",
    usedByAr: ["كل صفحة"],
    interactive: false,
  }),
  NavBar: contract({
    id: "NavBar",
    tier: "shell",
    purposeAr: "وجهاتُ الدور مرتّبةً بأهميتها لعمله",
    statesAr: ["سطح مكتب", "شريطٌ سفليٌّ للجوال"],
    neverAr: "لوجهةٍ لا يملك الدورُ قدرتَها",
    usedByAr: ["كل صفحة"],
    interactive: false,
  }),
})

export const COMPONENT_IDS: readonly ComponentId[] = Object.freeze(
  Object.keys(COMPONENTS) as ComponentId[],
)

// ── عقدة العرض ──────────────────────────────────────────────────────────────

/** النبرةُ الدلاليّة — تقترن دائماً بأيقونةٍ ونصّ (§٤-٥). */
export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand"

/**
 * إعلانُ قدرةِ العنصر: قدرةٌ من الكتالوج، أو `derived` للحقّ المشتقّ من الإسناد
 * (قراءةُ الإعلانات والإشعارات — `SPEC_role_lenses` §٢.١٢/٣: تُوسم ولا تُعدّ شذوذاً).
 */
export type CapabilityDeclaration = CapId | "derived"

export type A11y = {
  readonly role: string
  readonly nameAr: string
  readonly live?: "polite" | "assertive"
  readonly focusTrap?: boolean
  readonly minTouchTarget?: string
}

export type UiNode = {
  readonly component: ComponentId
  readonly interactive: boolean
  readonly capability: CapabilityDeclaration | null
  /** مفاتيحُ النص المستعملة — لا حرفٌ في المكوّن (§٥). */
  readonly textKeys: readonly TextKey[]
  readonly a11y: A11y
  readonly meta: Readonly<Record<string, string>>
  readonly children: readonly UiNode[]
}

export type NodeSpec = {
  readonly component: ComponentId
  readonly capability?: CapabilityDeclaration
  readonly textKeys?: readonly TextKey[]
  readonly a11y: A11y
  readonly tone?: Tone
  readonly iconName?: string
  readonly meta?: Readonly<Record<string, string>>
  readonly children?: readonly UiNode[]
}

/**
 * البانية الوحيدة للعُقَد — كلُّ مكوّنٍ يمرّ بها، فتصير القواعدُ بنيةً لا ذاكرة.
 */
export function node(spec: NodeSpec): UiNode {
  const contractOf = COMPONENTS[spec.component] as ComponentContract | undefined
  if (contractOf === undefined) {
    throw new Error(`مكوّنٌ خارج المكتبة: «${String(spec.component)}» — المكتبة مغلقة (§٢/G20)`)
  }

  const capability = spec.capability ?? null
  if (contractOf.interactive && capability === null) {
    throw new Error(
      `«${contractOf.id}» عنصرٌ تفاعليٌّ لا يعلن قدرته — العنصرُ بلا إعلانٍ لا يُسجَّل (المادة ٤/٦، G20)`,
    )
  }

  // الدلالةُ مزدوجةٌ دائماً: نبرةٌ بلا أيقونةٍ ونصٍّ = معنىً محمولٌ باللون وحده.
  if (spec.tone !== undefined && spec.tone !== "brand") {
    const hasIcon = (spec.iconName ?? "").trim().length > 0
    const hasText = (spec.textKeys ?? []).length > 0
    if (!hasIcon || !hasText) {
      throw new Error(
        `«${contractOf.id}» يحمل دلالةً بلونٍ وحده — الحالةُ لونٌ **وأيقونةٌ ونصّ** (§٣-٩/§٤-٥)`,
      )
    }
  }

  const meta: Record<string, string> = { ...(spec.meta ?? {}) }
  if (spec.tone !== undefined) meta.tone = spec.tone
  if (spec.iconName !== undefined && spec.iconName.length > 0) meta.icon = spec.iconName

  const a11y: A11y = contractOf.interactive
    ? { ...spec.a11y, minTouchTarget: TOKENS.size["touch-min"] }
    : spec.a11y

  return Object.freeze({
    component: contractOf.id,
    interactive: contractOf.interactive,
    capability,
    textKeys: Object.freeze([...(spec.textKeys ?? [])]),
    a11y: Object.freeze(a11y),
    meta: Object.freeze(meta),
    children: Object.freeze([...(spec.children ?? [])]),
  })
}

/**
 * زينةُ القشرة: إطارٌ حول كل شاشة لا جزءٌ من عقدها (ق-١١٤). لها حارسُها المستقلّ —
 * السطوحُ تعلن أبوابَها (`openedBy`) والشريطُ يعلن القدرةَ التي فتحت الوجهةَ لحاملها —
 * فلا تُحسب قدراتُها في عقد الشاشة، وإلا لكرّرت كلُّ شاشةٍ إعلانَ الشريط كلَّه.
 */
export const SHELL_CHROME: readonly ComponentId[] = Object.freeze([
  "AppShell",
  "NavBar",
  "SearchBox",
  "NotificationBell",
  "Link",
])

/** محتوى الشاشة دون إطار القشرة — ما يُحاكَم إلى عقد الشاشة. */
export function screenContentNodes(root: UiNode): readonly UiNode[] {
  if (root.component !== "AppShell") return [root]
  return root.children.filter((c) => !SHELL_CHROME.includes(c.component))
}

/** كل العقد في الشجرة (الجذرُ أولاً) — أساسُ فحوص G20. */
export function walkNodes(root: UiNode): readonly UiNode[] {
  const out: UiNode[] = [root]
  for (const child of root.children) out.push(...walkNodes(child))
  return out
}

/** القدراتُ المعلنة في شجرة عرضٍ — بلا `derived` (فتلك حقٌّ مشتقٌّ لا قدرة). */
export function declaredCapabilities(root: UiNode): readonly CapId[] {
  const out = new Set<CapId>()
  for (const n of walkNodes(root)) {
    if (n.capability !== null && n.capability !== "derived") out.add(n.capability)
  }
  return [...out]
}

/** نصُّ مفتاحٍ — يُستعمل لاسم قارئ الشاشة داخل المكتبة وحدها. */
export function label(key: TextKey): string {
  return TEXT[key]
}
