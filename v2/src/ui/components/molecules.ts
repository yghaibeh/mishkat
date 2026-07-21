/**
 * الجزيئات الست — SPEC_design_system §٢-ب، وفيها تُفرَض ثلاثُ قواعد من v1 بنيةً:
 *  - **السطر المفهوم وقاعدة الصفر** (ق-١١٢): بطاقةُ إحصاءٍ بلا فعلٍ لا تُبنى.
 *  - **المالك الواحد** (ق-١٠٩): سطرٌ بفعلٍ **و**تشخيصٍ معاً لا يُبنى.
 *  - **الحقيقة الواحدة** (ق-١١١): حقيقتان بمفتاحٍ واحدٍ في بطاقةٍ لا تُبنيان.
 */

import { node, label, type UiNode } from "./kernel.js"
import type { Tone } from "./kernel.js"
import type { TextKey } from "../text/dictionary.js"
import { LIST_SEPARATOR_AR } from "../text/format.js"

// ── ز-١ الحقل ───────────────────────────────────────────────────────────────
export type FieldKind = "text" | "number" | "date" | "money" | "select" | "textarea"
export type FieldState = "empty" | "focused" | "filled" | "error" | "disabled" | "readonly"

export type FieldProps = {
  readonly name: string
  readonly labelKey: TextKey
  readonly kind: FieldKind
  readonly state?: FieldState
  readonly messageKey?: TextKey
  readonly required?: boolean
}

export function field(props: FieldProps): UiNode {
  const state = props.state ?? "empty"
  const children =
    props.messageKey === undefined
      ? []
      : [
          inlineFeedback({
            messageKey: props.messageKey,
            tone: state === "error" ? "danger" : "info",
            iconName: state === "error" ? "alert" : "info",
          }),
        ]
  return node({
    component: "Field",
    // الحقلُ عنصرٌ تفاعليّ: قدرتُه قدرةُ الشاشة التي تحويه — تُعلَن ولا تُفترض.
    capability: "derived",
    textKeys: [props.labelKey],
    a11y: { role: "textbox", nameAr: label(props.labelKey) },
    meta: {
      name: props.name,
      kind: props.kind,
      state,
      required: String(props.required === true),
    },
    children,
  })
}

// ── ز-٢ النموذج ─────────────────────────────────────────────────────────────
export type FormProps = {
  /** اسمُ مخطط التحقّق (Zod) عند الحدّ — G20 تربط كل نموذجٍ بمخططه (§٣-٤). */
  readonly schema: string
  readonly fields: readonly UiNode[]
  readonly submit: UiNode
  readonly state?: "ready" | "submitting" | "error" | "queued"
}

export function form(props: FormProps): UiNode {
  if (props.schema.trim().length === 0) {
    throw new Error("نموذجٌ بلا مخطط تحقّقٍ معلن — التحقّق عند الحدّ (المادة ٣/٣، §٣-٤)")
  }
  if (props.submit.meta.variant !== "primary") {
    throw new Error("زرُّ الإرسال يجب أن يكون الفعلَ الأساسي الوحيد للنموذج (§٣-٤)")
  }
  return node({
    component: "Form",
    a11y: { role: "form", nameAr: props.submit.a11y.nameAr },
    meta: {
      schema: props.schema,
      state: props.state ?? "ready",
      // الفشلُ الدائم يُعلَن لا يُبتلَع، والأوفلاين حالةٌ معلنةٌ لا خطأ (ت-٨).
      announcesPermanentFailure: "true",
      offlineBehavior: "queued",
    },
    children: [...props.fields, props.submit],
  })
}

// ── ز-٣ بطاقة الإحصاء ───────────────────────────────────────────────────────
export type StatCardProps = {
  /** جملةٌ تجيب سؤال الصفحة لا رصفَ أرقام (ق-١١٢). */
  readonly sentenceKey: TextKey
  readonly valueAr: string
  /** النطاقُ منطوقٌ على الصفحة (ق-١١٠). */
  readonly scopeNoteKey: TextKey
  /** الفعلُ الذي يقود إليه الرقم — إلزاميّ (ق-١٠٨). */
  readonly action: UiNode
  readonly tone?: Tone
  readonly iconName?: string
}

export function statCard(props: StatCardProps): UiNode {
  if (props.action === undefined) {
    throw new Error("بطاقةُ إحصاءٍ بلا فعلٍ — الرقمُ بلا فعلٍ مكانه التقارير لا الرئيسية (ق-١٠٨)")
  }
  return node({
    component: "StatCard",
    textKeys: [props.sentenceKey, props.scopeNoteKey],
    ...(props.tone === undefined ? {} : { tone: props.tone }),
    ...(props.iconName === undefined ? {} : { iconName: props.iconName }),
    a11y: { role: "group", nameAr: label(props.sentenceKey) },
    meta: { valueAr: props.valueAr, scopeDeclared: "true" },
    children: [props.action],
  })
}

// ── ز-٤ عنصر القائمة ────────────────────────────────────────────────────────
export type ListItemProps = {
  readonly sentenceKey: TextKey
  /** إمّا فعلٌ مملوك (لصاحبه) **أو** تشخيصٌ (للمطّلع) — لا الاثنان (ق-١٠٩). */
  readonly action?: UiNode
  readonly diagnosis?: UiNode
  readonly tone?: Tone
  readonly iconName?: string
  readonly selected?: boolean
}

export function listItem(props: ListItemProps): UiNode {
  const hasAction = props.action !== undefined
  const hasDiagnosis = props.diagnosis !== undefined
  if (hasAction && hasDiagnosis) {
    throw new Error(
      "مالكٌ واحدٌ لكل عنصر: الفعلُ التشغيليّ لصاحبه، والمطّلعُ يرى تشخيصاً لا زرّاً (ق-١٠٩)",
    )
  }
  const children: UiNode[] = []
  if (props.action !== undefined) children.push(props.action)
  if (props.diagnosis !== undefined) children.push(props.diagnosis)
  return node({
    component: "ListItem",
    textKeys: [props.sentenceKey],
    ...(props.tone === undefined ? {} : { tone: props.tone }),
    ...(props.iconName === undefined ? {} : { iconName: props.iconName }),
    a11y: { role: "listitem", nameAr: label(props.sentenceKey) },
    meta: { selected: String(props.selected === true), owned: String(hasAction) },
    children,
  })
}

// ── ز-٥ بطاقة الكيان ────────────────────────────────────────────────────────
export type EntityFact = {
  /** مفتاحُ الحقيقة — تكرارُه في البطاقة نفسها ازدواجٌ يُرفض (ق-١١١). */
  readonly key: string
  readonly labelKey: TextKey
  readonly valueAr: string
}

export type EntityCardProps = {
  readonly titleAr: string
  readonly facts: readonly EntityFact[]
  readonly actions: readonly UiNode[]
  readonly diagnosis?: UiNode
}

export function entityCard(props: EntityCardProps): UiNode {
  const seen = new Set<string>()
  for (const fact of props.facts) {
    if (seen.has(fact.key)) {
      throw new Error(
        `الحقيقة الواحدة (ق-١١١): «${fact.key}» تظهر مرتين في بطاقةٍ واحدة — تُدمَج الكتلتان`,
      )
    }
    seen.add(fact.key)
  }
  if (props.actions.length > 0 && props.diagnosis !== undefined) {
    throw new Error("مالكٌ واحدٌ لكل عنصر: أفعالٌ مملوكة أو تشخيصٌ للمطّلع، لا الاثنان (ق-١٠٩)")
  }
  const children = [...props.actions]
  if (props.diagnosis !== undefined) children.push(props.diagnosis)
  return node({
    component: "EntityCard",
    textKeys: props.facts.map((f) => f.labelKey),
    a11y: { role: "article", nameAr: props.titleAr },
    meta: {
      titleAr: props.titleAr,
      facts: props.facts.map((f) => `${f.key}=${f.valueAr}`).join(LIST_SEPARATOR_AR),
    },
    children,
  })
}

// ── ز-٦ التغذية الراجعة السطرية ─────────────────────────────────────────────
export type InlineFeedbackProps = {
  readonly messageKey: TextKey
  readonly tone: Tone
  readonly iconName: string
}

export function inlineFeedback(props: InlineFeedbackProps): UiNode {
  return node({
    component: "InlineFeedback",
    textKeys: [props.messageKey],
    tone: props.tone,
    iconName: props.iconName,
    a11y: { role: "note", nameAr: label(props.messageKey), live: "polite" },
  })
}
