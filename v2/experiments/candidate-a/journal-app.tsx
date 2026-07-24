/**
 * المرشّح (أ) — **طبقةُ التفاعل** على الشاشة الحاسمة: React يمسك الحالةَ ويُعيد التصيير.
 *
 * هذا الملفُّ هو **كلُّ ما يخصّ الإطارَ** في هذا المرشّح: النموذجُ والشجرةُ مشتركان مع (ب)،
 * فما يُقاس هنا إدارةُ الحالة وإعادةُ التصيير وحدهما. وعدد أسطره المفيدة **يُقاس ويُقارَن**
 * بنظيره في (ب) — لأنه الجواب الوحيد الممكن اليوم عن سؤال ADR-002r §٥-١ («كم يكلّف بناءُ
 * شاشةِ إدخالٍ معقّدةٍ يدوياً في (ب) مقارنةً بـ(أ)؟»).
 *
 * **التفويضُ لا مُستمعٌ لكل حقل**: مُستمعان اثنان على الجذر — نفسُ ما يفعله (ب) بالضبط،
 * فلا يُحسب لأحدهما توفيرُ مستمعاتٍ ليس من الإطار.
 */

import { useLayoutEffect, useRef, useState, createElement, type ReactNode } from "react"
import { renderNode } from "./render-react.js"
import { journalTree, JOURNAL_CTX, JOURNAL_DRAFT } from "../shared/journal-fixture.js"
import { addLine, removeLine, withField, type JournalDraft } from "../shared/journal-model.js"
import { journalScreenTree } from "../shared/journal-tree.js"
import { JOURNAL_CAPS } from "../shared/journal-fixture.js"

declare global {
  var __mkUpdateMs: number | undefined
  var __mkLineSeq: number | undefined
}

function nextLineId(): string {
  globalThis.__mkLineSeq = (globalThis.__mkLineSeq ?? 0) + 1
  return `n${globalThis.__mkLineSeq}`
}

export function JournalApp(): ReactNode {
  const [draft, setDraft] = useState<JournalDraft>(JOURNAL_DRAFT)
  const startedAt = useRef<number | null>(null)

  // زمنُ الدورة يُختم **بعد التثبيت في المستند** لا بعد `setState` — وإلا قِيس النصف.
  useLayoutEffect(() => {
    if (startedAt.current !== null) {
      globalThis.__mkUpdateMs = performance.now() - startedAt.current
      startedAt.current = null
    }
  })

  function onInput(event: { target: EventTarget | null }): void {
    const el = event.target as HTMLInputElement | null
    const name = el?.getAttribute("data-field")
    if (name === null || name === undefined) return
    startedAt.current = performance.now()
    setDraft((d) => withField(d, name, el?.value ?? ""))
  }

  function onClick(event: { target: EventTarget | null }): void {
    const el = (event.target as Element | null)?.closest?.("[data-capability]")
    const label = el?.getAttribute("aria-label") ?? ""
    if (label.length === 0) return
    startedAt.current = performance.now()
    if (el?.getAttribute("data-icon") === "plus") setDraft((d) => addLine(d, nextLineId()))
    else if (el?.getAttribute("data-icon") === "trash") {
      const card = el.closest("[data-component='EntityCard']")
      const fieldEl = card?.querySelector("[data-field^='amount:']")
      const id = fieldEl?.getAttribute("data-field")?.split(":")[1]
      if (id !== undefined) setDraft((d) => removeLine(d, id))
      else startedAt.current = null
    } else startedAt.current = null
  }

  return createElement(
    "div",
    { id: "journal-root", onInput, onClick },
    renderNode(journalScreenTree(JOURNAL_CAPS, draft, JOURNAL_CTX)),
  )
}

/** شجرةُ الخادم — نفسُ الدالة، فالمستندُ الأولُ واحدٌ للمرشّحَين. */
export function serverTree(): ReactNode {
  return createElement("div", { id: "journal-root" }, renderNode(journalTree()))
}
