/**
 * خريطةُ العقدة إلى عنصرٍ في المستند — **مصدرُ حقيقةٍ واحدٌ للمرشّحَين**.
 *
 * غرضُها إنصافُ القياس: لو كتب كلُّ مرشّحٍ تصييرَه بنفسه لقِسنا اجتهادَ الكاتب لا كلفةَ
 * الإطار. فهنا يُقرَّر **الوسمُ والسماتُ والنصّ** مرةً واحدة، ويتولّى كلُّ مرشّحٍ إخراجَه
 * بأدواته (React عناصرَ · سلسلةَ HTML). فيصير الفارقُ المقيس فارقَ الإطار وحده.
 */

import type { UiNode } from "../../src/ui/components/kernel.js"
import { TEXT } from "../../src/ui/text/dictionary.js"

export type Rendered = {
  readonly tag: string
  readonly attrs: Readonly<Record<string, string>>
  /** النصُّ المباشر للعقدة (قبل أبنائها) — من مفاتيح النصّ والميتا لا من حرفٍ مكتوب. */
  readonly text: string
}

const TAGS: Readonly<Record<string, string>> = Object.freeze({
  AppShell: "div",
  NavBar: "nav",
  Link: "a",
  Button: "button",
  Icon: "span",
  Badge: "span",
  HijriDate: "time",
  Money: "span",
  Avatar: "span",
  Field: "label",
  Form: "form",
  StatCard: "section",
  ListItem: "li",
  EntityCard: "article",
  InlineFeedback: "p",
  DataTable: "table",
  UnitTree: "ul",
  Dialog: "dialog",
  Toast: "output",
  Banner: "aside",
  Tabs: "div",
  EmptyState: "section",
  DiagnosisBlock: "section",
  Uploader: "div",
  SearchBox: "search",
  NotificationBell: "button",
})

function textOf(node: UiNode): string {
  const parts = node.textKeys.map((k) => TEXT[k])
  const value = node.meta.valueAr ?? node.meta.textAr ?? node.meta.titleAr ?? ""
  if (value.length > 0) parts.push(value)
  const facts = node.meta.facts ?? ""
  if (facts.length > 0) parts.push(facts)
  return parts.join(" · ")
}

/** سماتٌ دلاليّةٌ ووصولٍ فقط — لا نمطٌ سطريّ ولا صنفٌ مخترع (§٤-٤). */
export function mapNode(node: UiNode): Rendered {
  const attrs: Record<string, string> = {
    class: `mk-${node.component.toLowerCase()}`,
    "data-component": node.component,
  }
  if (node.capability !== null) attrs["data-capability"] = node.capability
  if (node.meta.tone !== undefined) attrs["data-tone"] = node.meta.tone
  if (node.meta.icon !== undefined) attrs["data-icon"] = node.meta.icon
  if (node.meta.href !== undefined) attrs.href = node.meta.href
  if (node.meta.current === "true") attrs["aria-current"] = "page"
  if (node.meta.disabled === "true") attrs.disabled = "true"
  if (node.a11y.live !== undefined) attrs["aria-live"] = node.a11y.live
  attrs["aria-label"] = node.a11y.nameAr
  if (TAGS[node.component] === "div" || TAGS[node.component] === "span") {
    attrs.role = node.a11y.role
  }
  return Object.freeze({
    tag: TAGS[node.component] ?? "div",
    attrs: Object.freeze(attrs),
    text: textOf(node),
  })
}
