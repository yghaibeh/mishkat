/**
 * المرشّح (أ) — مدخلُ العميل: ترطيبُ (hydration) الشجرة المُصيَّرة على الخادم.
 * هذا هو ما يدفعه الميدانُ فعلاً: React + ReactDOM + طبقةُ التصيير + الشاشة + الطابور.
 */

import { hydrateRoot } from "react-dom/client"
import { renderNode } from "./render-react.js"
import { proofScreenTree } from "../shared/tree.js"
import { wireOutboxButtons } from "../shared/outbox.js"

const host = document.getElementById("app")
if (host !== null) {
  hydrateRoot(host, renderNode(proofScreenTree()))
  wireOutboxButtons(document)
  performance.mark("mishkat-hydrated")
}
