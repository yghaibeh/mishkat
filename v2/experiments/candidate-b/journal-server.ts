/**
 * المرشّح (ب) — خادمُ الشاشة الحاسمة: نفسُ الشجرة تخرج HTML بلا إطارِ عميل.
 * جذرُ التفويض `#journal-root` واحدٌ للمرشّحَين كي يتطابق المستندان.
 */

import { Hono } from "hono"
import { renderNodeHtml } from "../shared/html.js"
import { journalTree, JOURNAL_TITLE_AR } from "../shared/journal-fixture.js"
import { documentHtml } from "../shared/page.js"

export function renderPage(scripts: string): string {
  return documentHtml({
    bodyHtml: `<div id="journal-root">${renderNodeHtml(journalTree())}</div>`,
    scripts,
    cssHref: "tokens.css",
    titleAr: JOURNAL_TITLE_AR,
  })
}

const app = new Hono()

app.get("/", (c) => c.html(renderPage('<script type="module" src="journal-island.js"></script>')))

export default app
