/**
 * مُصيِّرُ السلسلة — طبقةُ التصيير للمرشّح (ب): `UiNode` ⟵ HTML بلا إطار.
 * يستهلك `mapNode` نفسه الذي يستهلكه مُصيِّر React، فيخرج المستندان متطابقَين بنيوياً.
 */

import type { UiNode } from "../../src/ui/components/kernel.js"
import { mapNode } from "./mapping.js"

const VOID_SAFE = /[&<>"']/g
const ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})

function escape(value: string): string {
  return value.replace(VOID_SAFE, (c) => ESCAPES[c] ?? c)
}

function attrString(attrs: Readonly<Record<string, string>>): string {
  return Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${escape(v)}"`)
    .join("")
}

export function renderNodeHtml(node: UiNode): string {
  const r = mapNode(node)
  const inner = r.text.length > 0 ? `<span class="mk-text">${escape(r.text)}</span>` : ""
  const control = r.control === null ? "" : `<${r.control.tag}${attrString(r.control.attrs)}>`
  const kids = node.children.map(renderNodeHtml).join("")
  return `<${r.tag}${attrString(r.attrs)}>${inner}${control}${kids}</${r.tag}>`
}
