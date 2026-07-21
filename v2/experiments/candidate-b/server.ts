/**
 * المرشّح (ب) — خادمٌ خفيف (Hono) يقود التصيير: نفسُ الشجرة تخرج HTML بلا إطارِ عميل.
 * العميلُ لا يستلم إلا **جزيرةً واحدة** (الطابور والزرّ) — لا ترطيبَ ولا شجرةَ افتراضية.
 */

import { Hono } from "hono"
import { renderNodeHtml } from "../shared/html.js"
import { proofScreenTree } from "../shared/tree.js"
import { documentHtml } from "../shared/page.js"

export function renderPage(scripts: string): string {
  return documentHtml({
    bodyHtml: renderNodeHtml(proofScreenTree()),
    scripts,
    cssHref: "tokens.css",
    titleAr: "رئيسية أمير المسجد — مشكاة",
  })
}

const app = new Hono()

app.get("/", (c) =>
  c.html(renderPage('<script type="module" src="island.js"></script>')),
)

export default app
