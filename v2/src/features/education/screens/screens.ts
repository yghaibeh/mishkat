/**
 * شاشاتُ «على بصيرة» الثلاث — عقودُها في `SPEC.md` §٩، وحاكمُها G20.
 *
 * **طبقةُ عرضٍ نقيّة**: دالةٌ من (قشرةِ القدرات المحسوبة + لقطةِ الصفحة) إلى بنية عرض. لا
 * تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦)، **ولا تشتقّ رقماً**: الحضورُ والتقدّمُ وحالُ
 * الاعتماد تصلها محسوبةً من الخادم — **مصدرٌ واحدٌ للصفحة** (ق-١١١).
 *
 * **و«دروسي» تُبنى على سطح «حلقاتي» القائم لا نسخةً منه** (المهمّة، البند ٨): سطحُها
 * `myCircles` نفسُه، وموطنُها **فارغ** فلا تدّعي ملكيةَ كيانٍ له موطنٌ آخر (IA ز-٢) — ولا
 * تكرّر جدولَ الحلقات، بل تعرض **دروسَ** حلقاته وحالَ كلٍّ منها.
 *
 * **والطابعُ قب-٢٥**: الفراغُ مِحرابٌ ينتظر (من مكوّن `EmptyState` نفسِه)، و**صفر صورة**.
 */

import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import { appShell, navProjection } from "../../../ui/shell/shell.js"
import { button } from "../../../ui/components/atoms.js"
import { field, form, statCard } from "../../../ui/components/molecules.js"
import { dataTable, emptyState } from "../../../ui/components/organisms.js"
import type { UiNode } from "../../../ui/components/kernel.js"
import { registerScreen } from "../../../ui/screens/registry.js"
import type { ScreenContract } from "../../../ui/screens/contract.js"
import { formatNumber } from "../../../ui/text/format.js"

type Caps = ReadonlySet<CapId>

/** قيمةٌ غائبةٌ في المعاينة — محرفٌ محايدٌ لا نصَّ فيه (لا حرفَ خارج طبقة النصوص). */
const ABSENT = "—"

export type EducationRow = Readonly<Record<string, string>>

/** لقطةُ الصفحات — **مصدرُ بياناتٍ واحد** (ق-١١١)، منسّقةٌ في طبقةٍ واحدة قبل العرض. */
export type EducationSnapshot = {
  readonly unitLabelAr: string
  readonly scopePath: string
  readonly lessonRows: readonly EducationRow[]
  readonly progressRows: readonly EducationRow[]
  readonly mineRows: readonly EducationRow[]
  readonly manhajRows: readonly EducationRow[]
  readonly lessonTotalAr: string
  readonly progressTotalAr: string
  readonly mineTotalAr: string
  readonly manhajTotalAr: string
}

export const EMPTY_EDUCATION_SNAPSHOT: EducationSnapshot = Object.freeze({
  unitLabelAr: ABSENT,
  scopePath: "/",
  lessonRows: Object.freeze([]),
  progressRows: Object.freeze([]),
  mineRows: Object.freeze([]),
  manhajRows: Object.freeze([]),
  lessonTotalAr: formatNumber(0),
  progressTotalAr: formatNumber(0),
  mineTotalAr: formatNumber(0),
  manhajTotalAr: formatNumber(0),
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
  caps: Caps,
  snapshot: EducationSnapshot,
  content: readonly UiNode[],
  surface: "education" | "myCircles" | "admin",
): UiNode {
  return appShell({
    nav: navProjection({ caps, priority: null, currentSurface: surface }),
    scopePath: snapshot.scopePath,
    scopeLabelAr: snapshot.unitLabelAr,
    showSearch: false,
    content,
  })
}

// ── ① شاشةُ «دروسُ الحلقة وتقدّمُ المنهج» ─────────────────────────────────────
export const CIRCLE_LESSONS_CONTRACT: ScreenContract = Object.freeze({
  route: "/mosque/circles/lessons",
  surface: "education",
  lenses: ["admin", "section_head", "rabita", "square", "amir"] as const,
  // موطنُ «الدرس» و«مصفوفة تقدّم المنهج» (IA §١ ك-٣/ك-٤) — لا موطنَ ثانيَ لهما.
  // **CR-016 — «الدرس/الجلسة اليومية» (ك-٣) موطنُه `/mosque/circles/log`**: كيانٌ واحدٌ
  // صاحبُه وحدةُ السجل اليوميّ، وهذه الشاشةُ **موطنُ مصفوفة التقدّم (ك-٤)** وعرضٌ منسوبٌ
  // للدروس فوقها (نظيرُ ز-٢: عدسةٌ على كيانٍ له موطنٌ آخر، لا نسخةٌ ثانية).
  canonicalHome: ["curriculumProgress"] as const,
  capabilities: ["circle.view", "circle.manage"] as const,
  dataSource: "education.circleLessons",
  emptyStates: { owner: "education.emptyOwner", viewer: "education.emptyViewer" } as const,
})

export function circleLessonsScreenNodes(caps: Caps, snapshot: EducationSnapshot): UiNode {
  if (!caps.has("circle.view")) return viewerEmpty()

  const blocks: UiNode[] = [
    statCard({
      sentenceKey: "education.lessonsSentence",
      valueAr: snapshot.lessonTotalAr,
      scopeNoteKey: "education.scopeNote",
      action: button({ labelKey: "education.heading", variant: "ghost", capability: "circle.view" }),
      tone: "brand",
    }),
    dataTable({
      columns: [
        { key: "session", labelKey: "education.session" },
        { key: "heldAt", labelKey: "education.heldAt" },
        { key: "duration", labelKey: "education.duration" },
        { key: "present", labelKey: "education.present" },
        { key: "photos", labelKey: "education.photos" },
        // **حالُ الاعتماد يُعرض ولا يُدار هنا**: البتُّ سطوحُه في المحرّك (G22).
        { key: "state", labelKey: "education.state" },
      ],
      rows: snapshot.lessonRows,
      state: snapshot.lessonRows.length === 0 ? "empty" : "data",
      capability: "circle.view",
      emptyState: caps.has("circle.manage")
        ? emptyState({
            audience: "owner",
            titleKey: "education.heading",
            actionKey: "education.emptyOwner",
            capability: "circle.manage",
          })
        : emptyState({
            audience: "viewer",
            titleKey: "education.heading",
            diagnosisKey: "education.emptyViewer",
          }),
    }),
    // **تقدّمُ المنهج مشتقٌّ** (ق-٩٢): يتغيّر باعتماد الدرس لا بتسجيله — ولا عدّادَ يُخزَّن.
    statCard({
      sentenceKey: "education.progressSentence",
      valueAr: snapshot.progressTotalAr,
      scopeNoteKey: "education.progressScopeNote",
      action: button({
        labelKey: "education.progressHeading",
        variant: "ghost",
        capability: "circle.view",
      }),
      tone: "brand",
    }),
    dataTable({
      columns: [
        { key: "student", labelKey: "education.student" },
        { key: "completed", labelKey: "education.progressCompleted" },
        { key: "total", labelKey: "education.progressTotal" },
      ],
      rows: snapshot.progressRows,
      state: snapshot.progressRows.length === 0 ? "empty" : "data",
      capability: "circle.view",
      emptyState: emptyState({
        audience: "viewer",
        titleKey: "education.progressHeading",
        diagnosisKey: "education.emptyProgress",
      }),
    }),
  ]

  // **ق-٨٤ الإدخالُ لمالكه**: المشرفُ والمديرُ يبلغان هنا **بلا نموذجٍ واحد** — ورفضُ الخادم
  // مقرونٌ بالغياب (مصفوفةُ الشاشات تُثبت الطبقتين معاً).
  if (caps.has("circle.manage")) {
    blocks.push(
      form({
        schema: "educationRecordLessonInput",
        fields: [
          field({ name: "sessionId", labelKey: "education.session", kind: "select", required: true }),
          field({ name: "heldAt", labelKey: "education.heldAt", kind: "date", required: true }),
          field({ name: "durationMinutes", labelKey: "education.duration", kind: "number", required: true }),
          field({ name: "venueAr", labelKey: "education.venue", kind: "text" }),
          field({ name: "presentEnrollmentIds", labelKey: "education.present", kind: "select" }),
        ],
        submit: button({
          labelKey: "education.record",
          variant: "primary",
          capability: "circle.manage",
        }),
      }),
      form({
        schema: "educationMarkProgressInput",
        fields: [
          field({ name: "enrollmentId", labelKey: "education.student", kind: "select", required: true }),
          field({ name: "sessionId", labelKey: "education.session", kind: "select", required: true }),
          field({ name: "completed", labelKey: "education.completed", kind: "select", required: true }),
          field({ name: "reasonAr", labelKey: "education.correctionReason", kind: "text", required: true }),
        ],
        submit: button({
          labelKey: "education.correct",
          variant: "primary",
          capability: "circle.manage",
        }),
      }),
    )
  }

  return shell(caps, snapshot, blocks, "education")
}

// ── ② شاشةُ «دروسي» — على سطح «حلقاتي» القائم ────────────────────────────────
export const MY_LESSONS_CONTRACT: ScreenContract = Object.freeze({
  route: "/my-circles/lessons",
  surface: "myCircles",
  lenses: ["teacher"] as const,
  // **عرضٌ منسوبٌ شخصيّ**: موطنُ الدرس `/mosque/circles/lessons` — لا موطنَ ثانٍ (IA ز-٢).
  canonicalHome: [] as const,
  capabilities: ["circle.teach"] as const,
  dataSource: "education.mineLessons",
  emptyStates: { owner: "education.emptyMine", viewer: "state.deniedTitle" } as const,
})

export function myLessonsScreenNodes(caps: Caps, snapshot: EducationSnapshot): UiNode {
  if (!caps.has("circle.teach")) return viewerEmpty()

  const blocks: UiNode[] = [
    statCard({
      sentenceKey: "education.mineSentence",
      valueAr: snapshot.mineTotalAr,
      scopeNoteKey: "education.mineScopeNote",
      action: button({
        labelKey: "education.mineHeading",
        variant: "ghost",
        capability: "circle.teach",
      }),
      tone: "brand",
    }),
    dataTable({
      columns: [
        { key: "session", labelKey: "education.session" },
        { key: "heldAt", labelKey: "education.heldAt" },
        { key: "present", labelKey: "education.present" },
        { key: "state", labelKey: "education.state" },
      ],
      rows: snapshot.mineRows,
      state: snapshot.mineRows.length === 0 ? "empty" : "data",
      capability: "circle.teach",
      emptyState: emptyState({
        audience: "owner",
        titleKey: "education.mineHeading",
        actionKey: "education.emptyMine",
        capability: "circle.teach",
      }),
    }),
    // **بابُ التسجيل للمعلّم المالك** (ق-٨٤) — وقدرتُه الشخصيةُ وحدها تفتحه.
    form({
      schema: "educationRecordLessonInput",
      fields: [
        field({ name: "sessionId", labelKey: "education.session", kind: "select", required: true }),
        field({ name: "heldAt", labelKey: "education.heldAt", kind: "date", required: true }),
        field({ name: "durationMinutes", labelKey: "education.duration", kind: "number", required: true }),
        field({ name: "venueAr", labelKey: "education.venue", kind: "text" }),
        field({ name: "presentEnrollmentIds", labelKey: "education.present", kind: "select" }),
      ],
      submit: button({
        labelKey: "education.record",
        variant: "primary",
        capability: "circle.teach",
      }),
    }),
  ]

  return shell(caps, snapshot, blocks, "myCircles")
}

// ── ③ شاشةُ «المنهاج» — بابٌ مرجعيٌّ في عدسة المدير (قب-٢٢) ──────────────────
export const MANHAJ_CONTRACT: ScreenContract = Object.freeze({
  route: "/admin/manhaj",
  surface: "admin",
  lenses: ["admin"] as const,
  // موطنُ «المنهاج العام» (IA §١ ك-٩) — يُدار مرجعياً من سطح الإدارة (قب-٢٢).
  canonicalHome: ["manhaj"] as const,
  capabilities: ["activityCatalog.manage"] as const,
  dataSource: "education.manhaj",
  emptyStates: { owner: "education.emptyManhaj", viewer: "state.deniedTitle" } as const,
})

export function manhajScreenNodes(caps: Caps, snapshot: EducationSnapshot): UiNode {
  if (!caps.has("activityCatalog.manage")) return viewerEmpty()

  const blocks: UiNode[] = [
    statCard({
      sentenceKey: "education.manhajSentence",
      valueAr: snapshot.manhajTotalAr,
      scopeNoteKey: "education.manhajScopeNote",
      action: button({
        labelKey: "education.manhajHeading",
        variant: "ghost",
        capability: "activityCatalog.manage",
      }),
      tone: "brand",
    }),
    dataTable({
      columns: [
        { key: "id", labelKey: "education.manhajId" },
        { key: "name", labelKey: "education.manhajName" },
        { key: "circleType", labelKey: "education.manhajCircleType" },
        { key: "sessions", labelKey: "education.progressTotal" },
      ],
      rows: snapshot.manhajRows,
      state: snapshot.manhajRows.length === 0 ? "empty" : "data",
      capability: "activityCatalog.manage",
      emptyState: emptyState({
        audience: "owner",
        titleKey: "education.manhajHeading",
        actionKey: "education.emptyManhaj",
        capability: "activityCatalog.manage",
      }),
    }),
    // **بندٌ يُضاف بياناً فيعمل بلا كود** (قب-٢٢): نموذجٌ واحدٌ بأربعة أشكالٍ مميَّزة.
    form({
      schema: "educationManhajUpsertInput",
      fields: [
        field({ name: "kind", labelKey: "education.manhajKind", kind: "select", required: true }),
        field({ name: "id", labelKey: "education.manhajId", kind: "text", required: true }),
        field({ name: "ar", labelKey: "education.manhajName", kind: "text", required: true }),
        field({ name: "parentId", labelKey: "education.manhajParent", kind: "select" }),
        field({ name: "ordinal", labelKey: "education.manhajOrdinal", kind: "number" }),
      ],
      submit: button({
        labelKey: "education.manhajUpsert",
        variant: "primary",
        capability: "activityCatalog.manage",
      }),
    }),
  ]

  return shell(caps, snapshot, blocks, "admin")
}

registerScreen({
  contract: CIRCLE_LESSONS_CONTRACT,
  preview: (caps) => circleLessonsScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT),
})
registerScreen({
  contract: MY_LESSONS_CONTRACT,
  preview: (caps) => myLessonsScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT),
})
registerScreen({
  contract: MANHAJ_CONTRACT,
  preview: (caps) => manhajScreenNodes(caps, EMPTY_EDUCATION_SNAPSHOT),
})
