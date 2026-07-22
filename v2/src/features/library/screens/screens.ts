/**
 * شاشتا المكتبة — عقداهما في `SPEC.md` §١٠، وحاكمُهما G20.
 *
 * **طبقةُ عرضٍ نقيّة**: دالةٌ من (قشرةِ القدرات المحسوبة + لقطةِ الصفحة) إلى بنية عرض. لا
 * تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦)، ولا تحسب شيئاً: كلُّ قيمةٍ فيها مُسقَطةٌ من
 * **نموذج الصفحة الواحد** (`myLibrary` / `manageView`) — ق-١١١.
 *
 * **والفصلُ بين الشاشتين هو ق-٨٤ مرئيّةً**: العملُ الشخصيُّ شاشةٌ (`/library`)، والإدارةُ
 * المنطاقة شاشةٌ أخرى (`/library/materials`) — فمن يقرأ مكتبتَه لا يجد نموذجَ إضافةٍ يبحث
 * عن سبب رفضه، ومسؤولُ المنطقة يرى مكتبتَه ولا يرى الإدارة **تعريفاً لا استثناءً**
 * (جدولُ الغياب §٣ ينصّ على حرمانه من `library.manage`).
 *
 * **والطابعُ قب-٢٥**: الفراغُ مِحرابٌ ينتظر (من مكوّن `EmptyState` نفسِه) و**صفر صورة**؛
 * والفراغُ **يقول سببه** (ق-١٠٦): شاغرٌ أم خامل.
 */

import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import { appShell, navProjection } from "../../../ui/shell/shell.js"
import { button } from "../../../ui/components/atoms.js"
import { field, form, statCard } from "../../../ui/components/molecules.js"
import { dataTable, dialog, emptyState, uploader } from "../../../ui/components/organisms.js"
import type { UiNode } from "../../../ui/components/kernel.js"
import { registerScreen } from "../../../ui/screens/registry.js"
import type { ScreenContract } from "../../../ui/screens/contract.js"
import { formatNumber } from "../../../ui/text/format.js"
import type { Emptiness } from "../services/tracking.js"

type Caps = ReadonlySet<CapId>

/** قيمةٌ غائبةٌ في المعاينة — محرفٌ محايدٌ لا نصَّ فيه (لا حرفَ خارج طبقة النصوص). */
const ABSENT = "—"

export type LibraryRow = Readonly<Record<string, string>>

/** لقطةُ الصفحة — **مصدرُ بياناتٍ واحد** (ق-١١١)، منسّقةٌ في طبقةٍ واحدة قبل العرض. */
export type LibrarySnapshot = {
  readonly scopeLabelAr: string
  readonly scopePath: string
  /** ق-١٠٦: سببُ الفراغ يصل الشاشةَ **قيمةً** لا استنتاجاً فيها. */
  readonly emptiness: Emptiness
  readonly mandatoryProgressAr: string
  readonly mineRows: readonly LibraryRow[]
  readonly catalogRows: readonly LibraryRow[]
  readonly trackingRows: readonly LibraryRow[]
  /** حدودُ الرفع **من الخادم** (قاموسُ الصيغ + الإعدادُ الحيّ) — الواجهةُ ترشد ولا تحمي. */
  readonly acceptedTypes: readonly string[]
  readonly maxBytes: number
}

export const EMPTY_LIBRARY_SNAPSHOT: LibrarySnapshot = Object.freeze({
  scopeLabelAr: ABSENT,
  scopePath: "/",
  emptiness: "idle" as Emptiness,
  mandatoryProgressAr: ABSENT,
  mineRows: Object.freeze([]),
  catalogRows: Object.freeze([]),
  trackingRows: Object.freeze([]),
  acceptedTypes: Object.freeze([]),
  // **صفرٌ يعني لا رفع** — نظيرُ «الحدُّ غيرُ المضبوط يُقفل ولا يُفتح» (عقدُ الوحدة §٧).
  maxBytes: 0,
})

/** فراغُ المطّلع مُشخِّصٌ دائماً (ق-١١٢)، وبطابع المحراب (قب-٢٥ — من المكوّن نفسِه). */
function viewerEmpty(): UiNode {
  return emptyState({
    audience: "viewer",
    titleKey: "state.deniedTitle",
    diagnosisKey: "state.deniedHint",
  })
}

function shell(caps: Caps, snapshot: LibrarySnapshot, content: readonly UiNode[]): UiNode {
  return appShell({
    nav: navProjection({ caps, priority: "library", currentSurface: "library" }),
    scopePath: snapshot.scopePath,
    scopeLabelAr: snapshot.scopeLabelAr,
    // البحثُ لمن يملك عرضَ الشبكة على نطاقه وحده — وليس من قدرات هذه الشاشة.
    showSearch: false,
    content,
  })
}

// ── شاشةُ «مكتبتي» ───────────────────────────────────────────────────────────
export const LIBRARY_MINE_CONTRACT: ScreenContract = Object.freeze({
  route: "/library",
  surface: "library",
  // السطحُ الشخصيّ المشترك: `library.own` في حزمة كل دورٍ حيّ (SPEC_role_lenses §٢).
  lenses: [
    "admin",
    "section_head",
    "rabita",
    "square",
    "amir",
    "teacher",
    "committee_head",
    "media",
    "finance_officer",
    "student",
  ] as const,
  // عرضٌ منسوبٌ شخصيّ: موطنُ المادة شاشةُ الإدارة (IA ك-٨) — لا موطنَ ثانٍ.
  canonicalHome: [] as const,
  capabilities: ["library.own"] as const,
  dataSource: "library.mine.view",
  emptyStates: { owner: "library.emptyMineOwner", viewer: "state.deniedTitle" } as const,
})

export function libraryMineScreenNodes(caps: Caps, snapshot: LibrarySnapshot): UiNode {
  if (!caps.has("library.own")) return viewerEmpty()

  return shell(caps, snapshot, [
    // **الإلزاميُّ في صدر الصفحة بعدّاده** (ق-٩٦) — ورقمٌ يقود إلى فعلٍ (ق-١٠٨).
    statCard({
      sentenceKey: "library.mandatoryHeading",
      valueAr: snapshot.mandatoryProgressAr,
      // النطاقُ منطوقٌ على الصفحة (ق-١١٠): ما وُجِّه إليك أنت لا ما في الشبكة.
      scopeNoteKey: "library.mineScopeNote",
      action: button({ labelKey: "library.open", variant: "ghost", capability: "library.own" }),
      tone: "brand",
    }),
    dataTable({
      columns: [
        { key: "title", labelKey: "library.title" },
        { key: "category", labelKey: "library.category" },
        { key: "mandatory", labelKey: "library.mandatory" },
        { key: "state", labelKey: "library.state" },
      ],
      rows: snapshot.mineRows,
      state: snapshot.mineRows.length === 0 ? "empty" : "data",
      capability: "library.own",
      emptyState: emptyState({
        audience: "owner",
        titleKey: "library.emptyMine",
        actionKey: "library.emptyMineOwner",
        capability: "library.own",
      }),
    }),
    // **الإنجازُ إقرارٌ صريح** (ق-٩٦): حوارُ تأكيدٍ يقول أنّه أمانةٌ ولا يُقبل قبل الفتح.
    dialog({
      titleKey: "library.complete",
      bodyKey: "library.completeNote",
      confirm: button({
        labelKey: "library.complete",
        variant: "primary",
        capability: "library.own",
      }),
      cancelKey: "common.cancel",
    }),
  ])
}

// ── شاشةُ «إدارة الموادّ ومتابعة الإنجاز» ────────────────────────────────────
export const LIBRARY_MATERIALS_CONTRACT: ScreenContract = Object.freeze({
  route: "/library/materials",
  surface: "library",
  // `library.manage` في حزمتَي الإدارة ورأس القسم وحدهما (الملفّ الذهبيّ).
  lenses: ["admin", "section_head"] as const,
  // موطنُ «المادة المكتبية» (IA §١ ك-٨) — لا موطنَ ثانٍ له.
  canonicalHome: ["libraryItem"] as const,
  capabilities: ["library.manage"] as const,
  dataSource: "library.manage.view",
  emptyStates: { owner: "library.emptyCatalogOwner", viewer: "state.emptyViewerIdle" } as const,
})

export function libraryMaterialsScreenNodes(caps: Caps, snapshot: LibrarySnapshot): UiNode {
  if (!caps.has("library.manage")) return viewerEmpty()

  return shell(caps, snapshot, [
    dataTable({
      columns: [
        { key: "title", labelKey: "library.title" },
        { key: "audience", labelKey: "library.audience" },
        { key: "unit", labelKey: "library.unit" },
        { key: "mandatory", labelKey: "library.mandatory" },
      ],
      rows: snapshot.catalogRows,
      state: snapshot.catalogRows.length === 0 ? "empty" : "data",
      capability: "library.manage",
      emptyState: emptyState({
        audience: "owner",
        titleKey: "library.emptyCatalog",
        actionKey: "library.emptyCatalogOwner",
        capability: "library.manage",
      }),
    }),
    // **المادةُ تُوجَّه دائماً**: الجمهورُ والفئةُ والوحدةُ حقولٌ إلزامية (ق-٩٦/ق-٨٩).
    form({
      schema: "libraryMaterialInput",
      fields: [
        field({ name: "titleAr", labelKey: "library.title", kind: "text", required: true }),
        field({ name: "categoryId", labelKey: "library.category", kind: "select", required: true }),
        field({ name: "audienceId", labelKey: "library.audience", kind: "select", required: true }),
        field({ name: "unitId", labelKey: "library.unit", kind: "select", required: true }),
        field({ name: "kind", labelKey: "library.kind", kind: "select", required: true }),
      ],
      submit: button({ labelKey: "library.add", variant: "primary", capability: "library.manage" }),
    }),
    // **الرفعُ منسوبٌ دائماً**، وحدودُه من الخادم — والواجهةُ ترشد ولا تحمي (المادة ٨/٤).
    uploader({
      capability: "library.manage",
      acceptedTypes: snapshot.acceptedTypes,
      maxBytes: snapshot.maxBytes,
      attribution: ["what", "where", "when", "who"],
    }),
    // **مصفوفةُ المتابعة**: فراغُها **مُشخِّصٌ** يفرّق الشاغرَ من الخامل (ق-١٠٦).
    dataTable({
      columns: [
        { key: "person", labelKey: "library.person" },
        { key: "completed", labelKey: "library.completedOfTotal" },
      ],
      rows: snapshot.trackingRows,
      state: snapshot.trackingRows.length === 0 ? "empty" : "data",
      capability: "library.manage",
      emptyState: emptyState({
        audience: "viewer",
        titleKey: "library.trackingHeading",
        diagnosisKey:
          snapshot.emptiness === "vacant" ? "state.emptyViewerVacant" : "state.emptyViewerIdle",
      }),
    }),
    // **الأرشفةُ فعلٌ هدّامُ الأثر يقول أثرَه**: تُخفي ولا تمحو (المادة ٧/٤).
    dialog({
      titleKey: "library.archive",
      bodyKey: "library.archiveNote",
      confirm: button({
        labelKey: "library.archive",
        variant: "danger",
        capability: "library.manage",
      }),
      cancelKey: "common.cancel",
      destructive: true,
    }),
  ])
}

/** إسقاطُ عدّادَي الإلزاميّ نصّاً — **تنسيقٌ لا حساب** (الأرقامُ عربية-هندية، قب-٢٠). */
export function formatMandatoryProgress(completed: number, total: number): string {
  return `${formatNumber(completed)}/${formatNumber(total)}`
}

registerScreen({
  contract: LIBRARY_MINE_CONTRACT,
  preview: (caps) => libraryMineScreenNodes(caps, EMPTY_LIBRARY_SNAPSHOT),
})
registerScreen({
  contract: LIBRARY_MATERIALS_CONTRACT,
  preview: (caps) => libraryMaterialsScreenNodes(caps, EMPTY_LIBRARY_SNAPSHOT),
})
