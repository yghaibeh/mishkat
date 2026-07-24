/**
 * المرشّح (أ) — تصييرُ الشاشة الحاسمة على الخادم. المخرجُ يُقارَن حرفياً بمخرج (ب).
 */

import { renderToString } from "react-dom/server"
import { serverTree } from "./journal-app.js"
import { documentHtml } from "../shared/page.js"
import { JOURNAL_TITLE_AR } from "../shared/journal-fixture.js"

export function renderPage(scripts: string): string {
  return documentHtml({
    bodyHtml: renderToString(serverTree()),
    scripts,
    cssHref: "tokens.css",
    titleAr: JOURNAL_TITLE_AR,
  })
}
