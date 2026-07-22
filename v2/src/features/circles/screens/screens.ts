/**
 * شاشتا الحلقات — عقودُهما في `SPEC.md` §٨، وحاكمُهما G20.
 *
 * **طبقةُ عرضٍ نقيّة**: دالةٌ من (قشرةِ القدرات المحسوبة + لقطةِ الصفحة) إلى بنية عرض. لا
 * تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦)، **ولا تشتقّ رقماً**: السعةُ والملتحقون والمتبقّي
 * تصلها محسوبةً من `services/derive.ts` — **مصدرٌ واحدٌ للصفحة** (ق-١١١).
 *
 * **ومرشّحُ نوعٍ واحدٌ لا تبويبات** (ب-٢٨/ع-٦): حقلٌ من قائمةٍ مغلقة (ق-٨٩) فوق **جدولٍ
 * واحد**. والتبويبُ بالنوع هو بعينه «ثلاثةُ أنظمةٍ» في ثوب واجهة — ولذلك **صفر `Tabs` هنا**.
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

export type CircleRow = Readonly<Record<string, string>>

/** لقطةُ الصفحة — **مصدرُ بياناتٍ واحد** (ق-١١١)، منسّقةٌ في طبقةٍ واحدة قبل العرض. */
export type CirclesSnapshot = {
  readonly unitLabelAr: string
  readonly scopePath: string
  readonly circleRows: readonly CircleRow[]
  readonly mineRows: readonly CircleRow[]
  readonly totalAr: string
  readonly mineTotalAr: string
}

export const EMPTY_CIRCLES_SNAPSHOT: CirclesSnapshot = Object.freeze({
  unitLabelAr: ABSENT,
  scopePath: "/",
  circleRows: Object.freeze([]),
  mineRows: Object.freeze([]),
  totalAr: formatNumber(0),
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
  caps: Caps,
  snapshot: CirclesSnapshot,
  content: readonly UiNode[],
  surface: "education" | "myCircles",
): UiNode {
  return appShell({
    nav: navProjection({ caps, priority: null, currentSurface: surface }),
    scopePath: snapshot.scopePath,
    scopeLabelAr: snapshot.unitLabelAr,
    // البحثُ لمن يملك عرضَ الشبكة على نطاقه وحده — وليس من قدرات هذه الشاشة.
    showSearch: false,
    content,
  })
}

/**
 * **مرشّحُ النوع الواحد** — حقلٌ من قائمةٍ مغلقة يقرأ الكتالوجَ (ق-٨٩)، **لا تبويبٌ لكل نوع**.
 * وهو الفرقُ بين «الحلقةُ كيانٌ واحدٌ نوعُه صفة» و«ثلاثةُ أنظمةٍ لكلٍّ بابُه» (ب-٢٨).
 */
function typeFilter(): UiNode {
  return field({ name: "typeId", labelKey: "circles.typeFilter", kind: "select" })
}

// ── شاشةُ «حلقات مسجدي» ──────────────────────────────────────────────────────
export const CIRCLES_SCOPE_CONTRACT: ScreenContract = Object.freeze({
  route: "/mosque/circles",
  surface: "education",
  lenses: ["admin", "section_head", "rabita", "square", "amir"] as const,
  // موطنُ «الحلقة» و«الطالب/التسجيل» (IA §١ ك-١/ك-٢) — لا موطنَ ثانٍ لهما (يقتل ز-١/ز-٩).
  canonicalHome: ["circle", "enrollment"] as const,
  capabilities: ["circle.view", "circle.manage"] as const,
  dataSource: "circle.scopeView",
  emptyStates: { owner: "circles.emptyOwner", viewer: "state.deniedTitle" } as const,
})

export function circlesScopeScreenNodes(caps: Caps, snapshot: CirclesSnapshot): UiNode {
  if (!caps.has("circle.view")) return viewerEmpty()

  const blocks: UiNode[] = [
    // **الإحصاءُ يشمل الأنواعَ كلَّها** (ع-١٩)، ونطاقُه منطوقٌ على الصفحة (ق-١١٠).
    statCard({
      sentenceKey: "circles.statsSentence",
      valueAr: snapshot.totalAr,
      scopeNoteKey: "circles.statsScopeNote",
      action: button({ labelKey: "circles.heading", variant: "ghost", capability: "circle.view" }),
      tone: "brand",
    }),
    typeFilter(),
    dataTable({
      columns: [
        { key: "name", labelKey: "circles.nameLabel" },
        { key: "type", labelKey: "circles.typeLabel" },
        { key: "teacher", labelKey: "circles.teacher" },
        // **ع-٣**: السعةُ والملتحقون والمتبقّي في الصفّ نفسِه — لا رقمَ من مصدرٍ ثانٍ.
        { key: "capacity", labelKey: "circles.capacity" },
        { key: "enrolled", labelKey: "circles.enrolled" },
        { key: "remaining", labelKey: "circles.remaining" },
      ],
      rows: snapshot.circleRows,
      state: snapshot.circleRows.length === 0 ? "empty" : "data",
      capability: "circle.view",
      emptyState: caps.has("circle.manage")
        ? emptyState({
            audience: "owner",
            titleKey: "circles.heading",
            actionKey: "circles.emptyOwner",
            capability: "circle.manage",
          })
        : emptyState({
            audience: "viewer",
            titleKey: "circles.heading",
            diagnosisKey: "circles.emptyScope",
          }),
    }),
  ]

  // **ق-٨٤ الإدخالُ لمالكه**: المشرفُ والمديرُ يبلغان هنا **بلا نموذجٍ واحد** — ورفضُ الخادم
  // مقرونٌ بالغياب (مصفوفةُ الشاشات تُثبت الطبقتين معاً).
  if (caps.has("circle.manage")) {
    blocks.push(
      // **إنشاءٌ من أيّ نوعٍ قائم** (ع-٥/ع-٨): النوعُ حقلٌ من الكتالوج لا «قسمٌ يُفعَّل».
      form({
        schema: "circleCreateInput",
        fields: [
          field({ name: "nameAr", labelKey: "circles.nameLabel", kind: "text", required: true }),
          field({ name: "typeId", labelKey: "circles.typeLabel", kind: "select", required: true }),
          field({ name: "capacity", labelKey: "circles.capacity", kind: "number", required: true }),
        ],
        submit: button({
          labelKey: "circles.create",
          variant: "primary",
          capability: "circle.manage",
        }),
      }),
      form({
        schema: "circleAssignTeacherInput",
        fields: [
          field({ name: "circleId", labelKey: "circles.nameLabel", kind: "select", required: true }),
          field({ name: "teacherPersonId", labelKey: "circles.teacher", kind: "select" }),
        ],
        submit: button({
          labelKey: "circles.assignTeacher",
          variant: "primary",
          capability: "circle.manage",
        }),
      }),
      // **الطالبُ اسمٌ حرٌّ بلا هوية** (ق-٣١) في **موضعٍ واحد** لا سجلَّين (§٥).
      form({
        schema: "circleEnrollInput",
        fields: [
          field({ name: "circleId", labelKey: "circles.nameLabel", kind: "select", required: true }),
          field({ name: "nameAr", labelKey: "circles.studentName", kind: "text", required: true }),
        ],
        submit: button({
          labelKey: "circles.enroll",
          variant: "primary",
          capability: "circle.manage",
        }),
      }),
    )
  }

  return shell(caps, snapshot, blocks, "education")
}

// ── شاشةُ «حلقاتي» ───────────────────────────────────────────────────────────
export const MY_CIRCLES_CONTRACT: ScreenContract = Object.freeze({
  route: "/my-circles",
  surface: "myCircles",
  lenses: ["teacher"] as const,
  // **عرضٌ منسوبٌ شخصيّ**: موطنُ الحلقة `/mosque/circles` — لا موطنَ ثانٍ (IA ز-٢).
  canonicalHome: [] as const,
  capabilities: ["circle.teach"] as const,
  dataSource: "circle.mine",
  emptyStates: { owner: "circles.emptyMine", viewer: "state.deniedTitle" } as const,
})

export function myCirclesScreenNodes(caps: Caps, snapshot: CirclesSnapshot): UiNode {
  if (!caps.has("circle.teach")) return viewerEmpty()

  const blocks: UiNode[] = [
    // **ع-٢٩ على الشاشة**: العددُ مشتقٌّ من الإسناد لحظةَ السؤال — لا صفرٌ يخالف الواقع.
    statCard({
      sentenceKey: "circles.mineSentence",
      valueAr: snapshot.mineTotalAr,
      scopeNoteKey: "circles.mineScopeNote",
      action: button({
        labelKey: "circles.mineHeading",
        variant: "ghost",
        capability: "circle.teach",
      }),
      tone: "brand",
    }),
    dataTable({
      columns: [
        { key: "name", labelKey: "circles.nameLabel" },
        { key: "type", labelKey: "circles.typeLabel" },
        { key: "enrolled", labelKey: "circles.enrolled" },
      ],
      rows: snapshot.mineRows,
      state: snapshot.mineRows.length === 0 ? "empty" : "data",
      capability: "circle.teach",
      emptyState: emptyState({
        audience: "owner",
        titleKey: "circles.mineHeading",
        actionKey: "circles.emptyMine",
        capability: "circle.teach",
      }),
    }),
  ]

  return shell(caps, snapshot, blocks, "myCircles")
}

registerScreen({
  contract: CIRCLES_SCOPE_CONTRACT,
  preview: (caps) => circlesScopeScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT),
})
registerScreen({
  contract: MY_CIRCLES_CONTRACT,
  preview: (caps) => myCirclesScreenNodes(caps, EMPTY_CIRCLES_SNAPSHOT),
})
