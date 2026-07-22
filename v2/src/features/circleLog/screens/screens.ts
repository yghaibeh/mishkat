/**
 * ثلاثُ شاشاتٍ للسجلّ اليوميّ — عقودُها في `SPEC.md` §١١، وحاكمُها G20.
 *
 * **طبقةُ عرضٍ نقيّة**: دالةٌ من (قشرةِ القدرات المحسوبة + لقطةِ الصفحة) إلى بنية عرض. لا
 * تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦)، **ولا تحسب رقماً**: النسبُ والمتوسّطاتُ والحدُّ
 * تصلها محسوبةً من الخدمات — **مصدرٌ واحدٌ للصفحة** (ق-١١١).
 *
 * وثلاثةُ ثوابتٍ تُرى بالعين هنا:
 *  - **ق-٨٤**: نموذجُ التسجيل **لا يُبنى أصلاً** لمن لا يملك بابَه — فالمشرفُ والمديرُ
 *    يبلغان الجدولَ بلا نموذج، ورفضُ الخادم مقرونٌ بالغياب في مصفوفة الشاشات.
 *  - **ب-٣٥أ**: ملاحظاتُ المشرف تصل المعلّمَ **جدولاً بلا نموذجِ تحرير** — ومعها سطرٌ يقول
 *    إنها تُقرأ ولا تُحرَّر، فلا يبقى الغيابُ لغزاً (ق-١١٢).
 *  - **ع-٩**: حقلُ العلامة **يقول حدَّه**، والحدُّ من اللقطة لا رقماً في الشاشة.
 * **والطابعُ قب-٢٥**: الفراغُ مِحرابٌ ينتظر (من مكوّن `EmptyState` نفسِه)، و**صفر صورة**.
 */

import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import { appShell, navProjection } from "../../../ui/shell/shell.js"
import { button } from "../../../ui/components/atoms.js"
import { field, form, statCard } from "../../../ui/components/molecules.js"
import { dataTable, diagnosisBlock, emptyState } from "../../../ui/components/organisms.js"
import type { UiNode } from "../../../ui/components/kernel.js"
import { registerScreen } from "../../../ui/screens/registry.js"
import type { ScreenContract } from "../../../ui/screens/contract.js"
import { formatNumber } from "../../../ui/text/format.js"

type Caps = ReadonlySet<CapId>

/** قيمةٌ غائبةٌ في المعاينة — محرفٌ محايدٌ لا نصَّ فيه (لا حرفَ خارج طبقة النصوص). */
const ABSENT = "—"

export type LogRow = Readonly<Record<string, string>>

/** لقطةُ الصفحة — **مصدرُ بياناتٍ واحد** (ق-١١١)، منسّقةٌ في طبقةٍ واحدة قبل العرض. */
export type CircleLogSnapshot = {
  readonly unitLabelAr: string
  readonly scopePath: string
  readonly dayKey: string
  /** ع-٩: الحدُّ يصل الشاشةَ **من اللقطة** لا رقماً فيها. */
  readonly gradeMaxAr: string
  readonly dayRows: readonly LogRow[]
  readonly rankingRows: readonly LogRow[]
  /** ق-٩١: ترتيبٌ كلُّه أصفارٌ لا يُعرض — تقرؤه الشاشةُ ولا تجتهد. */
  readonly rankingHidden: boolean
  readonly noteRows: readonly LogRow[]
  readonly guardianRows: readonly LogRow[]
  readonly mineRows: readonly LogRow[]
  readonly mineTotalAr: string
}

export const EMPTY_CIRCLE_LOG_SNAPSHOT: CircleLogSnapshot = Object.freeze({
  unitLabelAr: ABSENT,
  scopePath: "/",
  dayKey: ABSENT,
  gradeMaxAr: ABSENT,
  dayRows: Object.freeze([]),
  rankingRows: Object.freeze([]),
  rankingHidden: false,
  noteRows: Object.freeze([]),
  guardianRows: Object.freeze([]),
  mineRows: Object.freeze([]),
  mineTotalAr: formatNumber(0),
})

/** فراغُ المطّلع مُشخِّصٌ دائماً (ق-١١٢)، وبطابع المحراب (قب-٢٥ — من المكوّن نفسِه). */
function viewerEmpty(): UiNode {
  return emptyState({
    audience: "viewer",
    titleKey: "state.deniedTitle",
    diagnosisKey: "state.deniedHint",
  })
}

function shell(
  snapshot: CircleLogSnapshot,
  caps: Caps,
  content: readonly UiNode[],
  surface: "education" | "myCircles",
): UiNode {
  return appShell({
    nav: navProjection({ caps, priority: null, currentSurface: surface }),
    scopePath: snapshot.scopePath,
    scopeLabelAr: snapshot.unitLabelAr,
    showSearch: false,
    content,
  })
}

/** جدولُ يومِ الحلقة — أعمدتُه **مفاتيحُ نصٍّ** لا حروفاً، وحالتُه من طول الصفوف. */
function dayTable(snapshot: CircleLogSnapshot, caps: Caps): UiNode {
  return dataTable({
    columns: [
      { key: "student", labelKey: "circleLog.student" },
      { key: "attendance", labelKey: "circleLog.attendance" },
      { key: "memorization", labelKey: "circleLog.memorization" },
      { key: "memorizationGrade", labelKey: "circleLog.grade" },
      { key: "review", labelKey: "circleLog.review" },
      { key: "tajweed", labelKey: "circleLog.tajweed" },
      { key: "enrichment", labelKey: "circleLog.enrichment" },
    ],
    rows: snapshot.dayRows,
    state: snapshot.dayRows.length === 0 ? "empty" : "data",
    capability: caps.has("circle.manage") ? "circle.manage" : "circle.view",
    emptyState: caps.has("circle.manage")
      ? emptyState({
          audience: "owner",
          titleKey: "circleLog.heading",
          actionKey: "circleLog.emptyOwner",
          capability: "circle.manage",
        })
      : emptyState({
          audience: "viewer",
          titleKey: "circleLog.heading",
          diagnosisKey: "circleLog.emptyViewer",
        }),
  })
}

/**
 * **نموذجُ تسجيل اليوم** — يُبنى بالقدرة الممرَّرة (ق-٨٤): `circle.manage` للأمير
 * و`circle.teach` للمعلّم؛ ولا يُبنى لمن لا يملك أياً منهما.
 */
function recordForm(capability: CapId): UiNode {
  return form({
    schema: "circleDaySessionInput",
    fields: [
      field({ name: "attendance", labelKey: "circleLog.attendance", kind: "select", required: true }),
      // ق-٨٩: **قائمةٌ لا كتابةٌ حرّة** — السورةُ والمصحفُ من الكتالوج المرجعيّ.
      field({ name: "surahId", labelKey: "circleLog.surah", kind: "select" }),
      field({ name: "fromAyah", labelKey: "circleLog.fromAyah", kind: "number" }),
      field({ name: "toAyah", labelKey: "circleLog.toAyah", kind: "number" }),
      // ع-٩: **العلامةُ رقمٌ محدودٌ بحدٍّ معلن** — لا خانةٌ حرّةٌ يكتب فيها ما شاء.
      field({ name: "memorizationGrade", labelKey: "circleLog.grade", kind: "number" }),
      field({ name: "reviewGrade", labelKey: "circleLog.review", kind: "number" }),
      field({ name: "tajweedGrade", labelKey: "circleLog.tajweed", kind: "number" }),
      // ب-٤١/ع-١٠: المادةُ الإثرائية **بعلامةٍ لها**، ونوعُها من كتالوج الأنواع الواحد.
      field({ name: "enrichmentTypeId", labelKey: "circleLog.enrichment", kind: "select" }),
    ],
    submit: button({ labelKey: "circleLog.record", variant: "primary", capability }),
  })
}

// ── شاشةُ «سجلُّ الحلقة اليوميّ» ───────────────────────────────────────────────
export const LOG_DAY_CONTRACT: ScreenContract = Object.freeze({
  route: "/mosque/circles/log",
  surface: "education",
  lenses: ["admin", "section_head", "rabita", "square", "amir"] as const,
  // موطنُ «الجلسة اليومية» (ك-٣) و«رابط وليّ الأمر» (ك-٦) — لا موطنَ ثانٍ لهما.
  canonicalHome: ["lesson", "guardianLink"] as const,
  capabilities: ["circle.view", "circle.manage", "guardianLink.manage"] as const,
  dataSource: "circle.logDayView",
  emptyStates: { owner: "circleLog.emptyOwner", viewer: "circleLog.emptyViewer" } as const,
})

export function logDayScreenNodes(caps: Caps, snapshot: CircleLogSnapshot): UiNode {
  if (!caps.has("circle.view")) return viewerEmpty()

  const blocks: UiNode[] = [
    statCard({
      sentenceKey: "circleLog.rankingSentence",
      valueAr: snapshot.gradeMaxAr,
      scopeNoteKey: "circleLog.rankingScopeNote",
      action: button({
        labelKey: "circleLog.rankingHeading",
        variant: "ghost",
        capability: "circle.view",
      }),
      tone: "brand",
    }),
    dayTable(snapshot, caps),
    // ق-٩١: الترتيبُ المُخفى **يقول سببَه** ولا يترك الصفحةَ صامتة (ق-١١٢).
    snapshot.rankingHidden
      ? diagnosisBlock({
          stateKey: "circleLog.rankingHidden",
          responsibleKey: "circleLog.rankingScopeNote",
        })
      : dataTable({
          columns: [
            { key: "circle", labelKey: "circleLog.heading" },
            { key: "attendance", labelKey: "circleLog.rankingAttendance" },
            { key: "grades", labelKey: "circleLog.rankingGrades" },
            { key: "score", labelKey: "circleLog.rankingScore" },
          ],
          rows: snapshot.rankingRows,
          state: snapshot.rankingRows.length === 0 ? "empty" : "data",
          capability: "circle.view",
          emptyState: emptyState({
            audience: "viewer",
            titleKey: "circleLog.rankingHeading",
            diagnosisKey: "circleLog.rankingInactive",
          }),
        }),
  ]

  // **ق-٨٤ على الشاشة**: النموذجُ لا يُبنى إلا لمالك الإدخال — والمشرفُ يبلغ الجدولَ وحده.
  if (caps.has("circle.manage")) blocks.push(recordForm("circle.manage"))

  // ق-٩٣: رابطُ وليّ الأمر بجانب طلابه — بابُه `guardianLink.manage` وحدَه.
  if (caps.has("guardianLink.manage")) {
    blocks.push(
      dataTable({
        columns: [
          { key: "student", labelKey: "circleLog.student" },
          { key: "state", labelKey: "circleLog.guardianState" },
          { key: "expiry", labelKey: "circleLog.guardianExpiry" },
        ],
        rows: snapshot.guardianRows,
        state: snapshot.guardianRows.length === 0 ? "empty" : "data",
        capability: "guardianLink.manage",
        emptyState: emptyState({
          audience: "owner",
          titleKey: "circleLog.guardianHeading",
          actionKey: "circleLog.guardianEmptyOwner",
          capability: "guardianLink.manage",
        }),
      }),
      form({
        schema: "guardianLinkIssueInput",
        fields: [
          field({ name: "enrollmentId", labelKey: "circleLog.student", kind: "select", required: true }),
        ],
        submit: button({
          labelKey: "circleLog.guardianIssue",
          variant: "primary",
          capability: "guardianLink.manage",
        }),
      }),
      button({
        labelKey: "circleLog.guardianRenew",
        variant: "secondary",
        capability: "guardianLink.manage",
      }),
      button({
        labelKey: "circleLog.guardianRevoke",
        variant: "danger",
        capability: "guardianLink.manage",
      }),
    )
  }

  return shell(snapshot, caps, blocks, "education")
}

// ── شاشةُ «ملاحظات الإشراف» ───────────────────────────────────────────────────
export const NOTES_CONTRACT: ScreenContract = Object.freeze({
  route: "/mosque/circles/notes",
  surface: "education",
  // موطنُ «ملاحظات الإشراف على الحلقة» (ك-٥) — لا موطنَ ثانٍ لها.
  canonicalHome: ["supervisionNote"] as const,
  lenses: ["section_head", "rabita", "square", "amir"] as const,
  capabilities: ["circle.view", "circle.notes.supervise"] as const,
  dataSource: "circle.notesView",
  emptyStates: { owner: "circleLog.notesEmptyOwner", viewer: "circleLog.notesEmptyViewer" } as const,
})

export function notesScreenNodes(caps: Caps, snapshot: CircleLogSnapshot): UiNode {
  if (!caps.has("circle.view")) return viewerEmpty()

  const blocks: UiNode[] = [
    dataTable({
      columns: [
        { key: "body", labelKey: "circleLog.noteBody" },
        { key: "author", labelKey: "circleLog.noteAuthor" },
        { key: "day", labelKey: "circleLog.day" },
      ],
      rows: snapshot.noteRows,
      state: snapshot.noteRows.length === 0 ? "empty" : "data",
      capability: "circle.view",
      emptyState: caps.has("circle.notes.supervise")
        ? emptyState({
            audience: "owner",
            titleKey: "circleLog.notesHeading",
            actionKey: "circleLog.notesEmptyOwner",
            capability: "circle.notes.supervise",
          })
        : emptyState({
            audience: "viewer",
            titleKey: "circleLog.notesHeading",
            diagnosisKey: "circleLog.notesEmptyViewer",
          }),
    }),
  ]

  // **ق-٨٧**: نموذجُ الكتابة لحاملِ قدرة الإشراف وحده — ولا يُبنى لغيره.
  if (caps.has("circle.notes.supervise")) {
    blocks.push(
      form({
        schema: "circleSupervisionNoteInput",
        fields: [field({ name: "bodyAr", labelKey: "circleLog.noteBody", kind: "textarea", required: true })],
        submit: button({
          labelKey: "circleLog.noteWrite",
          variant: "primary",
          capability: "circle.notes.supervise",
        }),
      }),
    )
  }

  return shell(snapshot, caps, blocks, "education")
}

// ── شاشةُ «سجلُّ حلقاتي» ───────────────────────────────────────────────────────
export const MY_LOG_CONTRACT: ScreenContract = Object.freeze({
  route: "/my-circles/log",
  surface: "myCircles",
  lenses: ["teacher"] as const,
  // **عرضٌ منسوبٌ شخصيّ**: موطنُ الجلسة `/mosque/circles/log` — لا موطنَ ثانٍ (IA ز-٢).
  canonicalHome: [] as const,
  capabilities: ["circle.teach", "guardianLink.manage"] as const,
  dataSource: "circle.logMineView",
  emptyStates: { owner: "circleLog.mineEmptyOwner", viewer: "state.deniedTitle" } as const,
})

export function myLogScreenNodes(caps: Caps, snapshot: CircleLogSnapshot): UiNode {
  if (!caps.has("circle.teach")) return viewerEmpty()

  const blocks: UiNode[] = [
    statCard({
      sentenceKey: "circleLog.mineSentence",
      valueAr: snapshot.mineTotalAr,
      scopeNoteKey: "circleLog.mineScopeNote",
      action: button({
        labelKey: "circleLog.mineHeading",
        variant: "ghost",
        capability: "circle.teach",
      }),
      tone: "brand",
    }),
    dataTable({
      columns: [
        { key: "student", labelKey: "circleLog.student" },
        { key: "attendance", labelKey: "circleLog.attendance" },
        { key: "memorization", labelKey: "circleLog.memorization" },
        { key: "memorizationGrade", labelKey: "circleLog.grade" },
      ],
      rows: snapshot.mineRows,
      state: snapshot.mineRows.length === 0 ? "empty" : "data",
      capability: "circle.teach",
      emptyState: emptyState({
        audience: "owner",
        titleKey: "circleLog.mineHeading",
        actionKey: "circleLog.mineEmptyOwner",
        capability: "circle.teach",
      }),
    }),
    // **ق-٩٠**: المعلّمُ يسجّل يومَ حلقته — بابُه الشخصيّ `circle.teach`.
    recordForm("circle.teach"),
    // **ب-٣٥أ**: ملاحظاتُ المشرف **جدولٌ بلا نموذجِ تحرير**، ومعه سطرٌ يقول لماذا (ق-١١٢).
    dataTable({
      columns: [
        { key: "body", labelKey: "circleLog.noteBody" },
        { key: "author", labelKey: "circleLog.noteAuthor" },
      ],
      rows: snapshot.noteRows,
      state: snapshot.noteRows.length === 0 ? "empty" : "data",
      capability: "circle.teach",
      emptyState: emptyState({
        audience: "viewer",
        titleKey: "circleLog.notesHeading",
        diagnosisKey: "circleLog.notesEmptyViewer",
      }),
    }),
    diagnosisBlock({
      stateKey: "circleLog.notesReadOnly",
      responsibleKey: "circleLog.notesScopeNote",
    }),
  ]

  if (caps.has("guardianLink.manage")) {
    blocks.push(
      button({
        labelKey: "circleLog.guardianIssue",
        variant: "secondary",
        capability: "guardianLink.manage",
      }),
    )
  }

  return shell(snapshot, caps, blocks, "myCircles")
}

registerScreen({
  contract: LOG_DAY_CONTRACT,
  preview: (caps) => logDayScreenNodes(caps, EMPTY_CIRCLE_LOG_SNAPSHOT),
})
registerScreen({
  contract: NOTES_CONTRACT,
  preview: (caps) => notesScreenNodes(caps, EMPTY_CIRCLE_LOG_SNAPSHOT),
})
registerScreen({
  contract: MY_LOG_CONTRACT,
  preview: (caps) => myLogScreenNodes(caps, EMPTY_CIRCLE_LOG_SNAPSHOT),
})
