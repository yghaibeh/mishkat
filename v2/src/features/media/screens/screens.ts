/**
 * شاشتا الإعلام — عقداهما في `SPEC.md` §٩، وحاكمُهما G20.
 *
 * **طبقةُ عرضٍ نقيّة**: دالةٌ من (قشرةِ القدرات المحسوبة + لقطةِ الصفحة) إلى بنية عرض. لا
 * تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦)، ولا تحسب شيئاً: كلُّ قيمةٍ فيها مُسقَطةٌ من
 * **نموذج الصفحة الواحد** (`mediaHubView` / «تغطياتي») — ق-١١١.
 *
 * **والفصلُ بين الشاشتين هو ق-١٠٥ مرئيّة**: الاطّلاعُ الهابط شاشةٌ (`/media`)، والعملُ
 * الشخصيُّ شاشةٌ أخرى (`/media/coverages`) — فمن يرى المعرضَ لا يجد زرَّ نشرٍ يبحث عن سبب
 * رفضه، والمدير يرى ولا ينشر **تعريفاً لا استثناءً**.
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
import { formatHijri, formatNumber } from "../../../ui/text/format.js"
import type { CoverageSummary } from "../services/coverages.js"
import type { UploadLimits } from "../services/uploads.js"
import type { Emptiness, MediaHubView } from "../services/gallery.js"

type Caps = ReadonlySet<CapId>

/** قيمةٌ غائبةٌ في المعاينة — محرفٌ محايدٌ لا نصَّ فيه (لا حرفَ خارج طبقة النصوص). */
const ABSENT = "—"

export type MediaRow = Readonly<Record<string, string>>

/** لقطةُ الصفحة — **مصدرُ بياناتٍ واحد** (ق-١١١)، منسّقةٌ في طبقةٍ واحدة قبل العرض. */
export type MediaSnapshot = {
  readonly unitLabelAr: string
  readonly scopePath: string
  /** ق-١٠٦: سببُ الفراغ يصل الشاشةَ **قيمةً** لا استنتاجاً فيها. */
  readonly emptiness: Emptiness
  readonly officerCountAr: string
  readonly galleryCountAr: string
  readonly galleryRows: readonly MediaRow[]
  readonly coverageRows: readonly MediaRow[]
  /** حدودُ الرفع **من الخادم** (قاموسُ الصيغ + الإعدادُ الحيّ) — الواجهةُ ترشد ولا تحمي. */
  readonly acceptedTypes: readonly string[]
  readonly maxBytes: number
}

export const EMPTY_MEDIA_SNAPSHOT: MediaSnapshot = Object.freeze({
  unitLabelAr: ABSENT,
  scopePath: "/",
  emptiness: "idle" as Emptiness,
  officerCountAr: ABSENT,
  galleryCountAr: ABSENT,
  galleryRows: Object.freeze([]),
  coverageRows: Object.freeze([]),
  acceptedTypes: Object.freeze([]),
  // **صفرٌ يعني لا رفع** — نظيرُ «الحدُّ غيرُ المضبوط يُقفل ولا يُفتح» (عقدُ الوحدة §٧).
  maxBytes: 0,
})

/** النسبةُ المعروضة: اسمُ صاحبها أو «غير منسوبة» — لا فراغَ صامت (ق-١٠٤). */
export type DisplayNames = { readonly nameOf: (personId: string) => string; readonly unattributedAr: string }

/** إسقاطُ نموذج الصفحة إلى لقطةِ عرضٍ — **بلا حسابٍ جديد**، تنسيقٌ فقط. */
export function projectHubSnapshot(
  view: MediaHubView,
  display: { readonly unitLabelAr: string; readonly names: DisplayNames },
): MediaSnapshot {
  return {
    ...EMPTY_MEDIA_SNAPSHOT,
    unitLabelAr: display.unitLabelAr,
    scopePath: view.unitPath,
    emptiness: view.emptiness,
    officerCountAr: formatNumber(view.officerCount),
    galleryCountAr: formatNumber(view.items.length),
    galleryRows: view.items.map((item) => ({
      stream: item.stream,
      attribution:
        item.attributedTo === null
          ? display.names.unattributedAr
          : display.names.nameOf(item.attributedTo),
      occurredOn: formatHijri(item.occurredOn),
    })),
  }
}

/** إسقاطُ «تغطياتي» — نفسُ القاعدة: تنسيقٌ لا حساب. */
export function projectCoveragesSnapshot(
  coverages: readonly CoverageSummary[],
  display: {
    readonly unitLabelAr: string
    readonly scopePath: string
    /** حدودُ الرفع **من الخادم** — نسخةٌ واحدةٌ للحقيقة، فلا تدعو اللوحةُ إلى مرفوض. */
    readonly limits: UploadLimits
  },
): MediaSnapshot {
  return {
    ...EMPTY_MEDIA_SNAPSHOT,
    unitLabelAr: display.unitLabelAr,
    scopePath: display.scopePath,
    acceptedTypes: display.limits.acceptedTypes,
    maxBytes: display.limits.maxBytes,
    coverageRows: coverages.map((c) => ({
      title: c.titleAr,
      photoCount: formatNumber(c.photoCount),
      occurredOn: formatHijri(c.occurredOn),
    })),
  }
}

/** فراغُ المطّلع مُشخِّصٌ دائماً (ق-١١٢)، وبطابع المحراب (قب-٢٥ — من المكوّن نفسِه). */
function viewerEmpty(): UiNode {
  return emptyState({
    audience: "viewer",
    titleKey: "state.deniedTitle",
    diagnosisKey: "state.deniedHint",
  })
}

function shell(caps: Caps, snapshot: MediaSnapshot, content: readonly UiNode[]): UiNode {
  return appShell({
    nav: navProjection({ caps, priority: "media", currentSurface: "media" }),
    scopePath: snapshot.scopePath,
    scopeLabelAr: snapshot.unitLabelAr,
    // البحثُ لمن يملك عرضَ الشبكة على نطاقه وحده — وليس من قدرات هذه الشاشة.
    showSearch: false,
    content,
  })
}

// ── شاشةُ مركز الإعلام والمعرض ──────────────────────────────────────────────
export const MEDIA_HUB_CONTRACT: ScreenContract = Object.freeze({
  route: "/media",
  surface: "media",
  lenses: ["admin", "section_head", "rabita", "square", "media"] as const,
  // موطنُ «التغطية الإعلامية» (IA §١ ك-٣١) — لا موطنَ ثانٍ له.
  canonicalHome: ["mediaCoverage"] as const,
  capabilities: ["media.hub"] as const,
  dataSource: "media.hub.view",
  emptyStates: { owner: "media.emptyOwner", viewer: "state.deniedTitle" } as const,
})

export function mediaHubScreenNodes(caps: Caps, snapshot: MediaSnapshot): UiNode {
  if (!caps.has("media.hub")) return viewerEmpty()

  /**
   * **ق-١٠٦ في مكانٍ واحد**: الفراغُ يقول سببه — «شاغرٌ بلا مسؤول» أو «معيَّنٌ ولم يُنتج».
   * والمطّلعُ يرى تشخيصاً لا زرّاً (ق-١٠٩)، فالفراغُ هنا `viewer` دائماً: النشرُ شاشةٌ أخرى.
   */
  const galleryEmpty = emptyState({
    audience: "viewer",
    titleKey: "media.emptyGallery",
    diagnosisKey:
      snapshot.emptiness === "vacant" ? "state.emptyViewerVacant" : "state.emptyViewerIdle",
  })

  return shell(caps, snapshot, [
    statCard({
      sentenceKey: "media.galleryHeading",
      valueAr: snapshot.galleryCountAr,
      // النطاقُ منطوقٌ على الصفحة (ق-١١٠): معرضُ نطاقك وما تحته لا الشبكة.
      scopeNoteKey: "media.scopeNote",
      action: button({ labelKey: "media.heading", variant: "ghost", capability: "media.hub" }),
      tone: "brand",
    }),
    // **رافدُ كلِّ صورةٍ ونسبتُها عمودان ظاهران** (ق-١٠٤) — لا صورةٌ بلا سياقٍ في العرض.
    dataTable({
      columns: [
        { key: "stream", labelKey: "media.stream" },
        { key: "attribution", labelKey: "media.attribution" },
        { key: "occurredOn", labelKey: "media.occurredOn" },
      ],
      rows: snapshot.galleryRows,
      state: snapshot.galleryRows.length === 0 ? "empty" : "data",
      capability: "media.hub",
      emptyState: galleryEmpty,
    }),
  ])
}

// ── شاشةُ «تغطياتي»: النشرُ والألبومُ والحذف ────────────────────────────────
export const MEDIA_COVERAGES_CONTRACT: ScreenContract = Object.freeze({
  route: "/media/coverages",
  surface: "media",
  lenses: ["media"] as const,
  // عرضٌ منسوب: موطنُ التغطية شاشةُ `/media` — لا موطنَ ثانٍ (IA §١).
  canonicalHome: [] as const,
  capabilities: ["media.post"] as const,
  dataSource: "media.coverages.mine",
  emptyStates: { owner: "media.emptyOwner", viewer: "state.deniedTitle" } as const,
})

export function mediaCoveragesScreenNodes(caps: Caps, snapshot: MediaSnapshot): UiNode {
  // **العملُ الشخصيُّ لصاحبه وحده**: مَن لا يملك النشرَ يرى تشخيصاً لا نموذجاً معطَّلاً.
  if (!caps.has("media.post")) return viewerEmpty()

  return shell(caps, snapshot, [
    dataTable({
      columns: [
        { key: "title", labelKey: "media.title" },
        { key: "photoCount", labelKey: "media.photoCount" },
        { key: "occurredOn", labelKey: "media.occurredOn" },
      ],
      rows: snapshot.coverageRows,
      state: snapshot.coverageRows.length === 0 ? "empty" : "data",
      capability: "media.post",
      emptyState: emptyState({
        audience: "owner",
        titleKey: "media.emptyCoverages",
        actionKey: "media.emptyOwner",
        capability: "media.post",
      }),
    }),
    // **سجلُّ الحدث أوّلاً** (ق-١٠٣): أربعةُ حقولٍ إلزامية، والألبومُ يليه.
    form({
      schema: "mediaCoverageInput",
      fields: [
        field({ name: "titleAr", labelKey: "media.title", kind: "text", required: true }),
        field({ name: "kindId", labelKey: "media.kind", kind: "select", required: true }),
        field({ name: "unitId", labelKey: "media.unit", kind: "select", required: true }),
        field({ name: "occurredOn", labelKey: "media.occurredOn", kind: "date", required: true }),
      ],
      submit: button({ labelKey: "media.publish", variant: "primary", capability: "media.post" }),
    }),
    // **الرفعُ منسوبٌ دائماً** (ق-١٠٣): المكوّنُ نفسُه يرفض لوحةً بلا ماذا/أين/متى/مَن،
    // والحدودُ من الخادم — والواجهةُ ترشد ولا تحمي (المادة ٨/٤).
    uploader({
      capability: "media.post",
      acceptedTypes: snapshot.acceptedTypes,
      maxBytes: snapshot.maxBytes,
      attribution: ["what", "where", "when", "who"],
    }),
    // **الحذفُ فعلٌ هدّامٌ يقول أثرَه**: يأخذ صورَ التغطية معها (ق-١٠٥).
    dialog({
      titleKey: "media.delete",
      bodyKey: "media.deleteNote",
      confirm: button({ labelKey: "media.delete", variant: "danger", capability: "media.post" }),
      cancelKey: "common.cancel",
      destructive: true,
    }),
  ])
}

registerScreen({
  contract: MEDIA_HUB_CONTRACT,
  preview: (caps) => mediaHubScreenNodes(caps, EMPTY_MEDIA_SNAPSHOT),
})
registerScreen({
  contract: MEDIA_COVERAGES_CONTRACT,
  preview: (caps) => mediaCoveragesScreenNodes(caps, EMPTY_MEDIA_SNAPSHOT),
})
