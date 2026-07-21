/**
 * القشرةُ الواحدة والشريط — SPEC_design_system §٣-١٠ + IA §٢.١ (ق-١١٤/ق-١١٥).
 *
 * **قشرةٌ واحدةٌ في كل صفحة**: التبويباتُ شريطٌ ثانويٌّ **داخل** المحتوى ولا تستبدل القشرة —
 * فلا «منظرٌ مختلفٌ جذرياً بين تبويبين» ولا ضياعُ طريق العودة (بلاغُ الميدان، ت-٤).
 *
 * **التنقّل إسقاطٌ للقدرات**: `navProjection` لا يستقبل دوراً — قدراتٌ محسوبةٌ من الخادم
 * وأولويةٌ مُمرَّرة. فالواجهةُ **تعرض ولا تقرر**، وواحدةٌ تتكيّف تكفي عشرين دوراً.
 */

import { node, type UiNode } from "../components/kernel.js"
import { link } from "../components/atoms.js"
import { notificationBell, searchBox } from "../components/organisms.js"
import type { CapId } from "../../authorization/generated/capabilities.generated.js"
import { SURFACES, type Surface, type SurfaceId } from "./surfaces.js"
import { label } from "../components/kernel.js"

/**
 * خاناتُ الشريط السفليّ على الجوال: أربعُ وجهاتٍ + «المزيد» في متناول الإبهام (§٣-١٠/§٤-٢).
 * ثابتٌ **تخطيطيّ** لا رقمُ عملٍ — فليس إعداداً حيّاً (G14: حدُّ الفصل «أيغيّره الأدمن لتغيير
 * سلوك العمل؟» — لا).
 */
export const MOBILE_PRIMARY_SLOTS = 5

export type Destination = {
  readonly id: SurfaceId
  readonly route: string
  readonly node: UiNode
}

export type NavProjection = {
  readonly destinations: readonly Destination[]
  readonly mobilePrimary: readonly Destination[]
  readonly mobileOverflow: readonly Destination[]
  /** الهبوطُ بعد الدخول للجميع (ق-١١٥). */
  readonly landingRoute: string
}

function opens(surface: Surface, caps: ReadonlySet<CapId>): boolean {
  if (surface.openedBy.length === 0) return true
  return surface.openedBy.some((cap) => caps.has(cap))
}

export function navProjection(input: {
  readonly caps: ReadonlySet<CapId>
  /** ما يلي «الرئيسية» — تُحسب على الخادم من رتبة الدور (ق-١١٥) وتصل هنا قيمةً. */
  readonly priority: SurfaceId | null
  readonly currentSurface?: SurfaceId
}): NavProjection {
  const visible = SURFACES.filter(
    (s) => !(s.withinUnitPage === true) && opens(s, input.caps),
  )

  const ordered = [...visible].sort((a, b) => {
    if (a.id === "home") return -1
    if (b.id === "home") return 1
    if (input.priority !== null) {
      if (a.id === input.priority) return -1
      if (b.id === input.priority) return 1
    }
    return a.order - b.order
  })

  const destinations: Destination[] = ordered.map((s) => ({
    id: s.id,
    route: s.route,
    node: link({
      labelKey: s.labelKey,
      href: s.route,
      // الوجهةُ تعلن **القدرةَ التي فتحتها لهذا المستخدم بعينه** لا أولى قدرات السطح:
      // فباب «الإدارة» يفتحه للأمير `users.provision` ولا يدّعي `admin.view` التي لا يملكها
      // (وإلا صار الإعلانُ كذبةً تُسقطها G20). والمفتوحُ للجميع حقٌّ مشتقٌّ معلَن (§٢.١٢/٣).
      capability: s.openedBy.find((cap) => input.caps.has(cap)) ?? "derived",
      current: input.currentSurface === s.id,
    }),
  }))

  return Object.freeze({
    destinations: Object.freeze(destinations),
    mobilePrimary: Object.freeze(destinations.slice(0, MOBILE_PRIMARY_SLOTS)),
    mobileOverflow: Object.freeze(destinations.slice(MOBILE_PRIMARY_SLOTS)),
    landingRoute: "/home",
  })
}

export type AppShellProps = {
  readonly nav: NavProjection
  readonly scopePath: string
  /** اسمُ النطاق الحاليّ منطوقاً على الصفحة (ق-١١٠). */
  readonly scopeLabelAr: string
  readonly content: readonly UiNode[]
  /** زائرٌ غيرُ مسجَّل: ترويسةٌ عامةٌ خفيفة (IA §٢.١). */
  readonly visitor?: boolean
  /** بحثُ القشرة عنصرٌ محروسٌ كغيره: يُمرَّر حسابُه من الخادم (`network.view` على نطاق الصفحة). */
  readonly showSearch?: boolean
}

function navBar(nav: NavProjection): UiNode {
  return node({
    component: "NavBar",
    textKeys: ["shell.mainNav"],
    a11y: { role: "navigation", nameAr: label("shell.mainNav") },
    meta: {
      destinations: nav.destinations.map((d) => d.id).join(","),
      mobilePrimary: nav.mobilePrimary.map((d) => d.id).join(","),
      mobileOverflow: nav.mobileOverflow.map((d) => d.id).join(","),
      mobileLayout: "bottom-bar",
    },
    children: nav.destinations.map((d) => d.node),
  })
}

export function appShell(props: AppShellProps): UiNode {
  const visitor = props.visitor === true
  const children: UiNode[] = []

  children.push(navBar(props.nav))
  if (!visitor) {
    // الزائر: شعارٌ ودخولٌ فقط — لا بحثَ ولا إشعارات (لا بياناتِ نطاقٍ لمن لا نطاقَ له).
    // والبحثُ لا يظهر إلا لمن يملك عرضَ الشبكة على نطاقه (لا كشفَ خارج العدسة — ثغرةُ v1).
    if (props.showSearch === true) {
      children.push(searchBox({ capability: "network.view", scopePath: props.scopePath }))
    }
    children.push(notificationBell({ capability: "derived" }))
  }
  children.push(...props.content)

  return node({
    component: "AppShell",
    textKeys: ["shell.skipToContent", "shell.scopeLabel"],
    a11y: { role: "application", nameAr: props.scopeLabelAr },
    meta: {
      variant: visitor ? "visitor" : "member",
      scopePath: props.scopePath,
      scopeLabelAr: props.scopeLabelAr,
      landingRoute: props.nav.landingRoute,
      // التبويباتُ داخل المحتوى لا بديلاً عن القشرة (ق-١١٤) — ثابتٌ يُفحص.
      shellReplaced: "false",
    },
    children,
  })
}
