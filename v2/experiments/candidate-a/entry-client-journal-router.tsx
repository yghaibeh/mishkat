/**
 * المرشّح (أ) في **شكله الواقعيّ** — نفسُ الشاشة الحاسمة **مع موجّه TanStack Router**.
 *
 * ADR-002r §٢-٥/٣ نصّاً: «أرضيةُ (أ) تمرّ، وشكلُه الواقعيُّ لا يمرّ» — قِيس ذلك على شاشة
 * عرضٍ خفيفة، **ويُعاد قياسُه هنا على الشاشة التي تفصل**. ولا يزال أخفَّ من TanStack Start
 * كاملاً (تنقصه مكتبةُ الاستعلام وزمنُ تشغيل دوالِّ الخادم) — فرقمُه **أرضيةٌ متفائلة**.
 */

import { hydrateRoot } from "react-dom/client"
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router"
import { createElement } from "react"
import { JournalApp } from "./journal-app.js"
import { wireOutboxButtons } from "../shared/outbox.js"

const rootRoute = createRootRoute()
const journalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: JournalApp,
})

const router = createRouter({
  routeTree: rootRoute.addChildren([journalRoute]),
  history: createMemoryHistory({ initialEntries: ["/"] }),
})

const host = document.getElementById("app")
if (host !== null) {
  hydrateRoot(host, createElement(RouterProvider, { router }))
  wireOutboxButtons(document)
  performance.mark("mishkat-hydrated")
}
