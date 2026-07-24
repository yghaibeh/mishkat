/**
 * المرشّح (ب) — **طبقةُ التفاعل** على الشاشة الحاسمة: جزيرةٌ أمريّةٌ تُرقّع المستند بيدها.
 *
 * الخادمُ صيَّر المستندَ كاملاً؛ وهذه الجزيرةُ تفعل بيدها ما يفعله الإطارُ بالتوفيق:
 *  ١. **تعيد الحساب** عند كل ضغطة مفتاح (من `journal-model.ts` المشترك — لا كلفةَ لأحد).
 *  ٢. **تُرقّع الموضع المتغيّر وحده**: بطاقاتُ التوازن (عددُها يتغيّر بتغيّر العملات) ·
 *     رسالةُ كل سطر · حالةُ زرّ الإرسال · ترقيمُ البطاقات بعد الحذف.
 *  ٣. **تبني بطاقةَ السطر الجديد** من الشجرة المشتركة ومُصيِّر السلسلة — أي أنها **تستورد
 *     ما يستورده (أ)** ناقصَ الشجرةِ الافتراضية والترطيب. وهذا بالضبط ما تنبّأ به ADR-002r
 *     §٣-١: «جزيرةٌ… أي استيرادُ ما يفعله (أ) بحجمٍ أصغر».
 *
 * **الرقعةُ موضعيةٌ عمداً ولا تُستبدل الشجرةُ كلها**: `innerHTML` على النموذج كلِّه يقتل
 * التركيزَ والمؤشّرَ عند كل حرف — فقياسُه سيكون أسرعَ وأكذب. المقيسُ هنا **الرقعةُ التي
 * يكتبها مهندسٌ فعلاً**، وثمنُها مكتوبٌ في أسطر هذا الملفّ.
 */

import { renderNodeHtml } from "../shared/html.js"
import { journalBalanceCards, journalLineCard } from "../shared/journal-tree.js"
import { JOURNAL_CTX, JOURNAL_DRAFT } from "../shared/journal-fixture.js"
import {
  addLine,
  balanceByCurrency,
  isBalanced,
  isSubmittable,
  removeLine,
  validateDraft,
  withField,
  type JournalDraft,
} from "../shared/journal-model.js"
import { wireOutboxButtons } from "../shared/outbox.js"

declare global {
  var __mkUpdateMs: number | undefined
  var __mkLineSeq: number | undefined
}

let draft: JournalDraft = JOURNAL_DRAFT

const root = document.getElementById("journal-root")
const formEl = root?.querySelector("form[data-component='Form']") ?? null

function lineCards(): readonly Element[] {
  return [...(formEl?.querySelectorAll("[data-component='EntityCard']") ?? [])]
}

function balanceCardEls(): readonly Element[] {
  return [...(formEl?.querySelectorAll("[data-component='StatCard']") ?? [])]
}

/** بطاقاتُ التوازن: عددُها **يتغيّر** بتغيّر العملات، فلا يكفي تحديثُ نصٍّ في مكانه. */
function patchBalances(): void {
  const cards = balanceCardEls()
  const html = journalBalanceCards(draft).map(renderNodeHtml).join("")
  const first = cards[0]
  if (first === undefined || formEl === null) return
  const holder = document.createElement("template")
  holder.innerHTML = html
  for (let i = 1; i < cards.length; i += 1) cards[i]?.remove()
  first.replaceWith(...holder.content.childNodes)
}

/** رسالةُ كل سطرٍ وحالتُه — مقترنةٌ بحقلها لا تنبيهٌ عام (§٩-٢/٣). */
function patchLineIssues(): void {
  const issues = validateDraft(draft, JOURNAL_CTX)
  const cards = lineCards()
  draft.lines.forEach((line, i) => {
    const card = cards[i]
    if (card === undefined) return
    const amountField = card.querySelector(`[data-field='amount:${line.id}']`)
    const label = amountField?.closest("[data-component='Field']") ?? null
    if (label === null) return
    const mine = issues.filter((issue) => issue.lineId === line.id)
    label.setAttribute("data-state", mine.length > 0 ? "error" : "filled")
    const note = label.querySelector("[data-component='InlineFeedback']")
    if (mine.length === 0) note?.remove()
    else if (note === null) {
      const holder = document.createElement("template")
      holder.innerHTML = renderNodeHtml(
        journalLineCard(line, i, mine).children.find(
          (c) => c.component === "Field" && c.meta.name === `amount:${line.id}`,
        )?.children[0] ?? journalLineCard(line, i, mine),
      )
      label.append(...holder.content.childNodes)
    }
  })
}

/** ترقيمُ البطاقات: حذفُ سطرٍ يُزحزح كلَّ ما بعده — يدويّاً هنا، ومجّاناً في (أ). */
function patchOrdinals(): void {
  const cards = lineCards()
  draft.lines.forEach((line, i) => {
    const card = cards[i]
    const shown = journalLineCard(line, i, []).meta.titleAr ?? ""
    if (card !== undefined && card.getAttribute("aria-label") !== shown) {
      card.setAttribute("aria-label", shown)
    }
  })
}

function patchSubmit(): void {
  const submit = formEl?.querySelector("button[data-component='Button'][data-variant]") ?? null
  const buttons = [...(formEl?.querySelectorAll("button[data-component='Button']") ?? [])]
  const target = buttons[buttons.length - 1] ?? submit
  if (target === null || target === undefined) return
  const ok = isSubmittable(draft, JOURNAL_CTX)
  target.setAttribute("disabled", String(!ok))
  target.setAttribute("data-state", ok ? "idle" : "disabled")
}

/** تحذيرُ عدم التوازن — يظهر ويختفي، فلا يكفي تبديلُ نصّه. */
function patchImbalanceNote(): void {
  if (formEl === null) return
  const notes = [...formEl.querySelectorAll(":scope > [data-component='InlineFeedback']")]
  const balanced = isBalanced(balanceByCurrency(draft.lines))
  const existing = notes[notes.length - 1] ?? null
  if (balanced) existing?.remove()
  else if (existing === null) {
    const holder = document.createElement("template")
    holder.innerHTML = `<p class="mk-inlinefeedback" data-component="InlineFeedback" data-tone="warning" data-icon="alert" aria-live="polite"></p>`
    const buttons = [...formEl.querySelectorAll("button[data-component='Button']")]
    ;(buttons[buttons.length - 1] ?? formEl.lastElementChild)?.before(
      ...holder.content.childNodes,
    )
  }
}

function repaint(): void {
  patchBalances()
  patchLineIssues()
  patchOrdinals()
  patchImbalanceNote()
  patchSubmit()
}

function nextLineId(): string {
  globalThis.__mkLineSeq = (globalThis.__mkLineSeq ?? 0) + 1
  return `n${globalThis.__mkLineSeq}`
}

root?.addEventListener("input", (event) => {
  const el = event.target as HTMLInputElement | null
  const name = el?.getAttribute("data-field")
  if (name === null || name === undefined) return
  const t0 = performance.now()
  draft = withField(draft, name, el?.value ?? "")
  repaint()
  globalThis.__mkUpdateMs = performance.now() - t0
})

root?.addEventListener("click", (event) => {
  const el = (event.target as Element | null)?.closest("[data-capability]")
  if (el === null || el === undefined) return
  const icon = el.getAttribute("data-icon")
  if (icon === "plus") {
    const t0 = performance.now()
    const id = nextLineId()
    draft = addLine(draft, id)
    const index = draft.lines.length - 1
    const line = draft.lines[index]
    if (line !== undefined && formEl !== null) {
      const holder = document.createElement("template")
      holder.innerHTML = renderNodeHtml(journalLineCard(line, index, []))
      const cards = lineCards()
      const last = cards[cards.length - 1]
      if (last !== undefined) last.after(...holder.content.childNodes)
      else formEl.append(...holder.content.childNodes)
    }
    repaint()
    globalThis.__mkUpdateMs = performance.now() - t0
    return
  }
  if (icon === "trash") {
    const card = el.closest("[data-component='EntityCard']")
    const id = card?.querySelector("[data-field^='amount:']")?.getAttribute("data-field")?.split(":")[1]
    if (id === undefined) return
    const t0 = performance.now()
    draft = removeLine(draft, id)
    card?.remove()
    repaint()
    globalThis.__mkUpdateMs = performance.now() - t0
  }
})

wireOutboxButtons(document)
performance.mark("mishkat-hydrated")
