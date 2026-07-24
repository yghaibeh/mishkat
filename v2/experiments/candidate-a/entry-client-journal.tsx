/**
 * المرشّح (أ) — مدخلُ العميل للشاشة الحاسمة: ترطيبُ النموذج المُصيَّر على الخادم.
 * هذا ما يدفعه الميدانُ فعلاً: React + ReactDOM + الشجرةُ + النموذجُ + الطابور.
 */

import { hydrateRoot } from "react-dom/client"
import { createElement } from "react"
import { JournalApp } from "./journal-app.js"
import { wireOutboxButtons } from "../shared/outbox.js"

const host = document.getElementById("app")
if (host !== null) {
  hydrateRoot(host, createElement(JournalApp))
  wireOutboxButtons(document)
  performance.mark("mishkat-hydrated")
}
