/**
 * رئيسيةُ أمير المسجد — الشاشةُ البرهانية لسياج الواجهة (`SPEC.md` في هذه الوحدة).
 *
 * **مبنيّةٌ كاملةً على المكتبة والقشرة**: لا وسمَ HTML ولا لونَ ولا حرفَ عربيٍّ هنا — مكوّناتٌ
 * من المكتبة المغلقة، ونصوصٌ بمفاتيح، ورموزٌ من مصدرها. وهي **إسقاطٌ للقدرات**: كلُّ كتلةٍ
 * تظهر إن ملك الفاعلُ قدرتَها، وتغيب صامتةً إن لم يملكها — والفراغُ **مُشخِّصٌ** لا أبيض.
 */

import { appShell, navProjection } from "../../../ui/shell/shell.js"
import { statCard, listItem, entityCard } from "../../../ui/components/molecules.js"
import { button, link, money } from "../../../ui/components/atoms.js"
import { emptyState, diagnosisBlock } from "../../../ui/components/organisms.js"
import type { UiNode } from "../../../ui/components/kernel.js"
import { registerScreen } from "../../../ui/screens/registry.js"
import type { ScreenContract } from "../../../ui/screens/contract.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import { formatNumber } from "../../../ui/text/format.js"

/** لقطةُ الرئيسية — **مصدرُ بياناتٍ واحد** (ق-١١١)، القيمُ منسّقةٌ في طبقةٍ واحدة. */
export type AmirHomeSnapshot = {
  readonly mosqueLabelAr: string
  readonly scopePath: string
  readonly weekPointsAr: string
  readonly weekRemainingAr: string
  readonly circlesCountAr: string
  readonly committeesCountAr: string
  readonly pendingApprovalsAr: string
  readonly todayLogEntered: boolean
  readonly boxBalance: {
    readonly amount: number
    readonly currencyCode: string
    readonly fractionDigits: number
  } | null
}

/** لقطةٌ فارغةٌ للمعاينة (G20 تبني الشاشةَ بها لكل دورٍ حيّ بلا بيانات ولا متصفح). */
const ZERO_AR = formatNumber(0)

export const EMPTY_SNAPSHOT: AmirHomeSnapshot = Object.freeze({
  mosqueLabelAr: "—",
  scopePath: "/",
  weekPointsAr: ZERO_AR,
  weekRemainingAr: ZERO_AR,
  circlesCountAr: ZERO_AR,
  committeesCountAr: ZERO_AR,
  pendingApprovalsAr: ZERO_AR,
  todayLogEntered: false,
  boxBalance: null,
})

export const AMIR_HOME_CONTRACT: ScreenContract = Object.freeze({
  route: "/home",
  surface: "home",
  lenses: ["amir"] as const,
  // عرضٌ منسوب: كلُّ ما فيها روابطُ إلى مواطنها القانونية في IA §١ — لا موطنَ ثانياً.
  canonicalHome: [] as const,
  capabilities: [
    "dailyLog.edit",
    "report.submit",
    "report.retract",
    "report.approve",
    "circle.manage",
    "committees.manage",
    "box.view",
    "users.provision",
    "custody.grant",
  ] as const,
  dataSource: "home.amirSnapshot",
  emptyStates: { owner: "state.emptyOwnerTitle", viewer: "state.emptyViewerIdle" } as const,
})

/** «ماذا بقي عليّ اليوم؟» — أسطرٌ مفهومة، كلٌّ بفعلٍ مملوك (ق-١٠٩/ق-١١٢). */
function todayItems(caps: ReadonlySet<CapId>, snapshot: AmirHomeSnapshot): readonly UiNode[] {
  const items: UiNode[] = []
  if (caps.has("dailyLog.edit") && !snapshot.todayLogEntered) {
    items.push(
      listItem({
        sentenceKey: "amirHome.emptyLog",
        action: button({
          labelKey: "amirHome.enterDailyLog",
          variant: "primary",
          capability: "dailyLog.edit",
        }),
        tone: "warning",
        iconName: "alert",
      }),
    )
  }
  if (caps.has("report.submit")) {
    items.push(
      listItem({
        sentenceKey: "amirHome.submitReport",
        action: button({
          labelKey: "amirHome.submitReport",
          variant: "secondary",
          capability: "report.submit",
        }),
      }),
    )
  }
  if (caps.has("report.retract")) {
    items.push(
      listItem({
        sentenceKey: "amirHome.retractReport",
        action: button({
          labelKey: "amirHome.retractReport",
          variant: "ghost",
          capability: "report.retract",
        }),
      }),
    )
  }
  if (caps.has("report.approve")) {
    items.push(
      listItem({
        sentenceKey: "amirHome.pendingMyApproval",
        action: button({
          labelKey: "amirHome.pendingMyApproval",
          variant: "secondary",
          capability: "report.approve",
        }),
      }),
    )
  }
  if (caps.has("users.provision")) {
    items.push(
      listItem({
        sentenceKey: "amirHome.provisionAccount",
        action: button({
          labelKey: "amirHome.provisionAccount",
          variant: "ghost",
          capability: "users.provision",
        }),
      }),
    )
  }
  if (caps.has("custody.grant")) {
    items.push(
      listItem({
        sentenceKey: "amirHome.custodyGrant",
        action: button({
          labelKey: "amirHome.custodyGrant",
          variant: "ghost",
          capability: "custody.grant",
        }),
      }),
    )
  }
  return items
}

/** «كيف حال حلقات مسجدي ولجانه؟» — بطاقةُ كيانٍ بأفعالها المملوكة أو تشخيصٍ للمطّلع. */
function mosqueCard(caps: ReadonlySet<CapId>, snapshot: AmirHomeSnapshot): UiNode {
  const actions: UiNode[] = []
  if (caps.has("circle.manage")) {
    actions.push(
      button({ labelKey: "amirHome.manageCircles", variant: "secondary", capability: "circle.manage" }),
    )
  }
  if (caps.has("committees.manage")) {
    actions.push(
      button({ labelKey: "amirHome.committees", variant: "ghost", capability: "committees.manage" }),
    )
  }
  return entityCard({
    titleAr: snapshot.mosqueLabelAr,
    facts: [
      { key: "circles", labelKey: "amirHome.manageCircles", valueAr: snapshot.circlesCountAr },
      { key: "committees", labelKey: "amirHome.committees", valueAr: snapshot.committeesCountAr },
    ],
    actions,
    // المطّلعُ (لا يملك أفعال المسجد) يرى تشخيصاً لا زرّاً (ق-١٠٩).
    ...(actions.length === 0
      ? {
          diagnosis: diagnosisBlock({
            stateKey: "state.emptyViewerIdle",
            responsibleKey: "state.emptyViewerAsk",
          }),
        }
      : {}),
  })
}

export function amirHomeScreen(caps: ReadonlySet<CapId>, snapshot: AmirHomeSnapshot): UiNode {
  const blocks: UiNode[] = []

  // السؤال ١: أين أنا من هدف الأسبوع؟ — رقمٌ **يقود لفعل** ونطاقُه منطوق (ق-١٠٨/ق-١١٠).
  if (caps.has("dailyLog.edit")) {
    blocks.push(
      statCard({
        sentenceKey: "amirHome.weekProgress",
        valueAr: snapshot.weekPointsAr,
        scopeNoteKey: "amirHome.scopeNote",
        action: button({
          labelKey: "amirHome.enterDailyLog",
          variant: "primary",
          capability: "dailyLog.edit",
        }),
        tone: "brand",
      }),
    )
  }

  // السؤال ٢: ماذا بقي عليّ اليوم؟
  const today = todayItems(caps, snapshot)
  blocks.push(...today)

  // السؤال ٣: حال الحلقات واللجان + رصيدُ الصندوق (على المسجد وحده).
  blocks.push(mosqueCard(caps, snapshot))

  if (caps.has("box.view") && snapshot.boxBalance !== null) {
    blocks.push(
      statCard({
        sentenceKey: "amirHome.boxBalance",
        valueAr: money(snapshot.boxBalance).meta.textAr ?? snapshot.weekRemainingAr,
        scopeNoteKey: "amirHome.scopeNote",
        action: link({ labelKey: "nav.box", href: "/box", capability: "box.view" }),
      }),
    )
  }

  // الفراغُ مُشخِّص: لصاحب العمل دعوةُ فعل، وللمطّلع تشخيصٌ ومن يُسأل (ق-١١٢).
  if (today.length === 0) {
    blocks.push(
      caps.has("dailyLog.edit")
        ? emptyState({
            audience: "owner",
            titleKey: "state.emptyOwnerTitle",
            actionKey: "state.emptyOwnerAction",
            capability: "dailyLog.edit",
          })
        : emptyState({
            audience: "viewer",
            titleKey: "state.emptyViewerIdle",
            diagnosisKey: "state.emptyViewerAsk",
          }),
    )
  }

  return appShell({
    nav: navProjection({ caps, priority: "myMosque", currentSurface: "home" }),
    scopePath: snapshot.scopePath,
    scopeLabelAr: snapshot.mosqueLabelAr,
    // البحثُ لمن يملك عرضَ الشبكة على نطاقه وحده — والأميرُ لا يملكه (§٢.٥).
    showSearch: caps.has("network.view"),
    content: blocks,
  })
}

registerScreen({
  contract: AMIR_HOME_CONTRACT,
  preview: (caps) => amirHomeScreen(caps, EMPTY_SNAPSHOT),
})
