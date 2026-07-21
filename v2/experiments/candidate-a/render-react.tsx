/**
 * المرشّح (أ) — طبقةُ التصيير: `UiNode` ⟵ عناصر React.
 * لا شاشةَ تُكتب JSX (شرطُ ADR-002 §٣/٢): هذه الدالةُ وحدها تعرف الإطار.
 */

import { createElement, type ReactNode } from "react"
import { mapNode } from "../shared/mapping.js"
import type { UiNode } from "../../src/ui/components/kernel.js"

function reactProps(attrs: Readonly<Record<string, string>>, key: string): Record<string, unknown> {
  const props: Record<string, unknown> = { key }
  for (const [name, value] of Object.entries(attrs)) {
    if (name === "class") props.className = value
    else if (name === "disabled") props.disabled = true
    else props[name] = value
  }
  return props
}

export function renderNode(node: UiNode, key = "0"): ReactNode {
  const r = mapNode(node)
  const children: ReactNode[] = []
  if (r.text.length > 0) {
    children.push(createElement("span", { key: "t", className: "mk-text" }, r.text))
  }
  node.children.forEach((child, i) => children.push(renderNode(child, `${key}.${i}`)))
  return createElement(r.tag, reactProps(r.attrs, key), ...children)
}
