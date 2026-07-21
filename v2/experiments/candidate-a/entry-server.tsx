/**
 * المرشّح (أ) — تصييرُ الخادم: نفسُ الشجرة إلى HTML عبر `react-dom/server`.
 * المخرجُ يُقارَن حرفياً بمخرج المرشّح (ب) للتحقق من أن المقيسَين **صفحةٌ واحدة**.
 */

import { renderToString } from "react-dom/server"
import { renderNode } from "./render-react.js"
import { proofScreenTree } from "../shared/tree.js"
import { documentHtml } from "../shared/page.js"

export function renderPage(scripts: string): string {
  return documentHtml({
    bodyHtml: renderToString(renderNode(proofScreenTree())),
    scripts,
    cssHref: "tokens.css",
    titleAr: "رئيسية أمير المسجد — مشكاة",
  })
}
