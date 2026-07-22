/**
 * **الاختبارُ الإلزاميُّ السادس (ج)** — الطبقةُ الثانية من E2E: **مصفوفةُ شاشات المكتبة**
 * (TESTING_POLICY §٤، G9).
 *
 * لكل دورٍ حيّ × كل عنصر: يُبنى العرضُ بقشرة القدرات المحسوبة، ويُفحص **حضورُ العنصر بعدسة
 * الدور** و**غيابُه الصريح مقروناً برفض استدعاء الخادم المباشر** — الطبقتان معاً؛ إخفاءُ
 * الزر وحده ليس نجاحاً. وحالاتُ السلب أكثرُ من الإيجاب.
 *
 * **ملاحظةُ صدقٍ منهجيّة** (كما أعلنت مصفوفاتُ `org` و`box` و`media`): لا إطارَ واجهةٍ في
 * v2 بعد (قب-٢٦)، فهذه المصفوفة تُجسّد الطبقة الثانية على **مستوى شجرة العرض** + رفض الخادم،
 * لا على متصفحٍ حيّ.
 */
import { describe, it, expect } from "vitest"
import { makeLibraryEndpoints } from "../../src/features/library/server/endpoints.js"
import { clearRegistryForTests } from "../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import { computeLibraryCaps } from "../../src/features/library/screens/caps.js"
import {
  EMPTY_LIBRARY_SNAPSHOT,
  libraryMaterialsScreenNodes,
  libraryMineScreenNodes,
} from "../../src/features/library/screens/screens.js"
import { screenContentNodes, walkNodes, type UiNode } from "../../src/ui/components/kernel.js"
import { createMaterial } from "../../src/features/library/services/materials.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import type { LibraryStore } from "../../src/features/library/data/store.js"
import {
  DECISION,
  KHALID_PATH,
  UPLOAD_LIMIT,
  WRITE,
  canonicalActor,
  libraryContext,
  libraryDirectory,
  libraryPorts,
  materialInput,
  seedLibraryStore,
} from "../features/library/_seed.js"

/**
 * ما **يُرى فعلاً** في محتوى الشاشة: القدراتُ المُعلنةُ على العناصر التفاعلية **وحرّاسُ**
 * الجداول (`guardedBy`). وتُستثنى القشرةُ فلها حارسُها المستقلّ (ق-١١٤).
 */
function visibleCaps(root: UiNode): readonly string[] {
  const out = new Set<string>()
  for (const block of screenContentNodes(root)) {
    for (const n of walkNodes(block)) {
      if (n.capability !== null && n.capability !== "derived") out.add(n.capability)
      const guarded = n.meta.guardedBy
      if (guarded !== undefined) for (const cap of guarded.split(",")) out.add(cap)
    }
  }
  return [...out]
}

const SETTINGS = createSettingsResolver([UPLOAD_LIMIT])

type RoleFixture = { readonly label: string; readonly personId: string }

/** مستخدمٌ قانونيٌّ لكل دورٍ حيّ من العشرة — من العالم القانونيّ لا من عالمٍ ثانٍ. */
const ROLE_FIXTURES: readonly RoleFixture[] = [
  { label: "admin", personId: "u-admin" },
  { label: "section_head", personId: "u-section-head" },
  { label: "rabita", personId: "u-rabita" },
  { label: "square", personId: "u-square" },
  { label: "amir", personId: "u-amir" },
  { label: "teacher", personId: "u-teacher" },
  { label: "committee_head", personId: "u-committee-head" },
  { label: "media", personId: "u-media" },
  { label: "finance_officer", personId: "u-finance" },
  { label: "student", personId: "u-student" },
]

type Ep = ReturnType<typeof makeLibraryEndpoints>

type Affordance = {
  readonly screen: string
  readonly element: string
  readonly cap: CapId
  readonly shown: (caps: ReadonlySet<CapId>) => boolean
  readonly serverInvoke: (ep: Ep, f: RoleFixture, materialId: string) => Promise<{ ok: boolean }>
}

function seedWithMaterial(): { store: LibraryStore; materialId: string } {
  const store = seedLibraryStore()
  const made = createMaterial(
    store,
    libraryContext("u-admin"),
    materialInput({ unitId: "khalid", mandatory: true }),
  )
  if (!made.ok) throw new Error(made.error.code)
  return { store, materialId: made.value.id }
}

const AFFORDANCES: readonly Affordance[] = [
  {
    screen: "/library",
    element: "قائمةُ «مكتبتي» بحالاتها",
    cap: "library.own",
    shown: (caps) => visibleCaps(libraryMineScreenNodes(caps, EMPTY_LIBRARY_SNAPSHOT)).includes("library.own"),
    serverInvoke: (ep, f) => ep.mine.invoke({ personId: f.personId }, canonicalActor(f.personId), WRITE),
  },
  {
    screen: "/library",
    element: "إقرارُ الإنجاز",
    cap: "library.own",
    shown: (caps) => visibleCaps(libraryMineScreenNodes(caps, EMPTY_LIBRARY_SNAPSHOT)).includes("library.own"),
    serverInvoke: (ep, f, materialId) =>
      ep.complete.invoke({ personId: f.personId, materialId }, canonicalActor(f.personId), WRITE),
  },
  {
    screen: "/library/materials",
    element: "كتالوجُ موادّ النطاق",
    cap: "library.manage",
    shown: (caps) =>
      visibleCaps(libraryMaterialsScreenNodes(caps, EMPTY_LIBRARY_SNAPSHOT)).includes("library.manage"),
    serverInvoke: (ep, f) =>
      ep.manageView.invoke({ unitId: "khalid" }, canonicalActor(f.personId), DECISION),
  },
  {
    screen: "/library/materials",
    element: "نموذجُ «أضيف مادة»",
    cap: "library.manage",
    shown: (caps) =>
      visibleCaps(libraryMaterialsScreenNodes(caps, EMPTY_LIBRARY_SNAPSHOT)).includes("library.manage"),
    serverInvoke: (ep, f) =>
      ep.createMaterial.invoke(materialInput({ unitId: "khalid" }), canonicalActor(f.personId), WRITE),
  },
  {
    screen: "/library/materials",
    element: "لوحةُ رفع الملفّ",
    cap: "library.manage",
    shown: (caps) =>
      visibleCaps(libraryMaterialsScreenNodes(caps, EMPTY_LIBRARY_SNAPSHOT)).includes("library.manage"),
    serverInvoke: (ep, f, materialId) =>
      ep.updateMaterial.invoke(
        { materialId, titleAr: "عنوانٌ من غير مالك" },
        canonicalActor(f.personId),
        WRITE,
      ),
  },
  {
    screen: "/library/materials",
    element: "حوارُ الأرشفة",
    cap: "library.manage",
    shown: (caps) =>
      visibleCaps(libraryMaterialsScreenNodes(caps, EMPTY_LIBRARY_SNAPSHOT)).includes("library.manage"),
    serverInvoke: (ep, f, materialId) =>
      ep.archiveMaterial.invoke({ materialId }, canonicalActor(f.personId), WRITE),
  },
  {
    screen: "/library/materials",
    element: "مصفوفةُ متابعة الإنجاز",
    cap: "library.manage",
    shown: (caps) =>
      visibleCaps(libraryMaterialsScreenNodes(caps, EMPTY_LIBRARY_SNAPSHOT)).includes("library.manage"),
    serverInvoke: (ep, f) =>
      ep.overdue.invoke({ unitId: "khalid" }, canonicalActor(f.personId), DECISION),
  },
]

describe("مصفوفةُ شاشات المكتبة — حضورٌ بعدسة الدور، وغيابٌ مقرونٌ برفض الخادم", () => {
  it("لكل دورٍ × كل عنصر: الحضور = القدرة على نطاق الشاشة، والغياب مقرونٌ برفض الخادم", async () => {
    let positives = 0
    let negatives = 0

    for (const f of ROLE_FIXTURES) {
      for (const a of AFFORDANCES) {
        clearRegistryForTests()
        const seeded = seedWithMaterial()
        const ep = makeLibraryEndpoints(seeded.store, SETTINGS, libraryDirectory, libraryPorts())
        const caps = computeLibraryCaps(canonicalActor(f.personId), KHALID_PATH, DECISION)

        const allowed = caps.has(a.cap)
        expect(a.shown(caps), `${a.screen} · ${a.element} · ${f.label}`).toBe(allowed)
        if (allowed) {
          positives += 1
        } else {
          negatives += 1
          const r = await a.serverInvoke(ep, f, seeded.materialId)
          expect(r.ok, `استدعاء «${a.element}» المباشر نجح رغم غياب العنصر · ${f.label}`).toBe(false)
        }
      }
    }

    console.log(`[مصفوفة شاشات المكتبة] إيجاب=${positives} · سلب=${negatives}`)
    expect(negatives).toBeGreaterThan(positives)
  })

  it("**الإدارةُ ورأسُ القسم وحدهما يريان «إدارة الموادّ»** — وجدولُ الغياب §٣ يحرس المنطقة", () => {
    for (const personId of ["u-admin", "u-section-head"]) {
      const caps = computeLibraryCaps(canonicalActor(personId), KHALID_PATH, DECISION)
      expect(caps.has("library.manage"), personId).toBe(true)
    }
    // `rabita` **محظورةٌ نصّاً** من `library.manage` في جدول الغياب (SPEC_role_lenses §٣).
    for (const personId of ["u-rabita", "u-square", "u-amir", "u-teacher", "u-student"]) {
      const caps = computeLibraryCaps(canonicalActor(personId), KHALID_PATH, DECISION)
      expect(caps.has("library.manage"), personId).toBe(false)
      const nodes = libraryMaterialsScreenNodes(caps, EMPTY_LIBRARY_SNAPSHOT)
      expect(nodes.component).toBe("EmptyState")
      expect(nodes.meta.diagnostic).toBe("true")
    }
  })

  it("**ورأسُ القسم لا يرى الإدارةَ خارج قسمه** — القشرةُ تتبع النطاق لا الاسم", () => {
    const outside = computeLibraryCaps(canonicalActor("u-section-head"), "/women/", DECISION)
    expect(outside.has("library.manage")).toBe(false)
  })

  it("**و«مكتبتي» لكل دورٍ حيّ** — السطحُ الشخصيّ المشترك (SPEC_role_lenses §٢)", () => {
    for (const f of ROLE_FIXTURES) {
      const caps = computeLibraryCaps(canonicalActor(f.personId), KHALID_PATH, DECISION)
      expect(caps.has("library.own"), f.label).toBe(true)
      expect(visibleCaps(libraryMineScreenNodes(caps, EMPTY_LIBRARY_SNAPSHOT))).toContain("library.own")
    }
  })

  it("**والفراغُ مُشخِّصٌ يفرّق شاغراً من خامل على الشاشة نفسِها** (ق-١٠٦/ق-١١٢)", () => {
    const caps = computeLibraryCaps(canonicalActor("u-admin"), KHALID_PATH, DECISION)
    const keysOf = (n: UiNode) => walkNodes(n).flatMap((x) => [...x.textKeys])

    const vacant = libraryMaterialsScreenNodes(caps, {
      ...EMPTY_LIBRARY_SNAPSHOT,
      emptiness: "vacant",
    })
    const idle = libraryMaterialsScreenNodes(caps, { ...EMPTY_LIBRARY_SNAPSHOT, emptiness: "idle" })
    expect(keysOf(vacant)).toContain("state.emptyViewerVacant")
    expect(keysOf(idle)).toContain("state.emptyViewerIdle")
    expect(keysOf(vacant)).not.toContain("state.emptyViewerIdle")
  })

  it("**ولوحةُ الرفع تعلن حدودَ الخادم** — لا قائمةَ صيغٍ ثانيةً في الواجهة (المادة ١/٢)", () => {
    const caps = computeLibraryCaps(canonicalActor("u-admin"), KHALID_PATH, DECISION)
    const nodes = libraryMaterialsScreenNodes(caps, {
      ...EMPTY_LIBRARY_SNAPSHOT,
      acceptedTypes: ["application/pdf"],
      maxBytes: 5_000_000,
    })
    const uploader = walkNodes(nodes).find((n) => n.component === "Uploader")
    expect(uploader?.meta.acceptedTypes).toBe("application/pdf")
    expect(uploader?.meta.maxBytes).toBe("5000000")
    expect(uploader?.meta.serverValidated).toBe("true")
  })
})
