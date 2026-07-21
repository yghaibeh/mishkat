/**
 * المرشّح (أ-٢) — نفسُ الشاشة **مع موجّه TanStack Router** (ما تشحنه TanStack Start فعلاً
 * على العميل: الموجّه + React + ReactDOM). قياسُه منفصلٌ عن (أ-١) ليُرى **ثمنُ الموجّه وحده**.
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
import { renderNode } from "./render-react.js"
import { proofScreenTree } from "../shared/tree.js"
import { wireOutboxButtons } from "../shared/outbox.js"

const rootRoute = createRootRoute()
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => renderNode(proofScreenTree()),
})

const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute]),
  history: createMemoryHistory({ initialEntries: ["/"] }),
})

const host = document.getElementById("app")
if (host !== null) {
  hydrateRoot(host, createElement(RouterProvider, { router }))
  wireOutboxButtons(document)
  performance.mark("mishkat-hydrated")
}
