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

export function renderNodeHtml(node: UiNode): string {
  const r = mapNode(node)
  const attrs = Object.entries(r.attrs)
    .map(([k, v]) => ` ${k}="${escape(v)}"`)
    .join("")
  const inner = r.text.length > 0 ? `<span class="mk-text">${escape(r.text)}</span>` : ""
  const kids = node.children.map(renderNodeHtml).join("")
  return `<${r.tag}${attrs}>${inner}${kids}</${r.tag}>`
}
