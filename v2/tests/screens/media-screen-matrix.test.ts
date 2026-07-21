/**
 * الطبقةُ الثانية من E2E — **مصفوفةُ شاشات الإعلام**
 * (TESTING_POLICY §٤ الطبقة الثانية، G9) — الاختبارُ الإلزاميُّ الثامن في T13.
 *
 * لكل دورٍ حيّ × كل عنصر: يُبنى العرضُ بقشرة القدرات المحسوبة، ويُفحص **حضورُ العنصر بعدسة
 * الدور** و**غيابُه الصريح مقروناً برفض استدعاء الخادم المباشر** — الطبقتان معاً؛ إخفاءُ
 * الزر وحده ليس نجاحاً. وحالاتُ السلب أكثرُ من الإيجاب.
 *
 * **ملاحظةُ صدقٍ منهجيّة** (كما أعلنت مصفوفاتُ `org` و`ledger` و`box`): لا إطارَ واجهةٍ في
 * v2 بعد (قب-٢٦)، فهذه المصفوفة تُجسّد الطبقة الثانية على **مستوى شجرة العرض** + رفض الخادم،
 * لا على متصفحٍ حيّ.
 */
import { describe, it, expect } from "vitest"
import { makeMediaEndpoints } from "../../src/features/media/server/endpoints.js"
import { clearRegistryForTests } from "../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import { computeMediaCaps } from "../../src/features/media/screens/caps.js"
import {
  mediaHubScreenNodes,
  mediaCoveragesScreenNodes,
  EMPTY_MEDIA_SNAPSHOT,
} from "../../src/features/media/screens/screens.js"
import { screenContentNodes, walkNodes, type UiNode } from "../../src/ui/components/kernel.js"
import { createCoverage, addPhoto } from "../../src/features/media/services/coverages.js"
import type { CapId } from "../../src/authorization/generated/capabilities.generated.js"
import type { MediaStore } from "../../src/features/media/data/store.js"
import {
  canonicalActor,
  coverageInput,
  mediaContext,
  mediaDirectory,
  mediaPorts,
  seedMediaStore,
  DECISION,
  UPLOAD_LIMIT,
  WRITE,
  KHALID_PATH,
} from "../features/media/_seed.js"

/**
 * ما **يُرى فعلاً** في محتوى الشاشة: القدراتُ المُعلنةُ على العناصر التفاعلية **وحرّاسُ**
 * الجداول والأشجار (`guardedBy`). وتُستثنى القشرةُ فلها حارسُها المستقلّ (ق-١١٤).
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

/** مسؤولو الإعلام المُحصَون على النطاق — واجهةُ الإسناد المعلنة (عقدُ الوحدة §٥). */
const OFFICERS = ["u-media"]

type Ep = ReturnType<typeof makeMediaEndpoints>

type Affordance = {
  readonly screen: string
  readonly element: string
  readonly cap: CapId
  readonly shown: (caps: ReadonlySet<CapId>) => boolean
  readonly serverInvoke: (ep: Ep, f: RoleFixture) => Promise<{ ok: boolean }>
}

function seedWithCoverage(): { store: MediaStore; coverageId: string } {
  const store = seedMediaStore()
  const made = createCoverage(store, mediaContext("u-media"), coverageInput())
  if (!made.ok) throw new Error(made.error.code)
  const photo = addPhoto(store, mediaContext("u-media"), {
    coverageId: made.value.id,
    contentType: "image/jpeg",
    sizeBytes: 1_000,
  })
  if (!photo.ok) throw new Error(photo.error.code)
  return { store, coverageId: made.value.id }
}

/**
 * **الأفعالُ الشخصية تُستدعى بالنيابة عن مسؤول الإعلام** — وهو عينُ ما تمنعه ق-٢٧: مَن
 * لا يظهر له الزرُّ يحاول الفعلَ باسم صاحبه فيُردّ من الخادم.
 */
function affordances(coverageId: string): readonly Affordance[] {
  return [
    {
      screen: "/media",
      element: "المعرضُ الهابط بروافده الثلاثة",
      cap: "media.hub",
      shown: (caps) => visibleCaps(mediaHubScreenNodes(caps, EMPTY_MEDIA_SNAPSHOT)).includes("media.hub"),
      serverInvoke: (ep, f) => ep.hubView.invoke({ unitId: "khalid" }, canonicalActor(f.personId), DECISION),
    },
    {
      screen: "/media/coverages",
      element: "قائمةُ «تغطياتي»",
      cap: "media.post",
      shown: (caps) =>
        visibleCaps(mediaCoveragesScreenNodes(caps, EMPTY_MEDIA_SNAPSHOT)).includes("media.post"),
      serverInvoke: (ep, f) =>
        ep.myCoverages.invoke({ publisherPersonId: "u-media" }, canonicalActor(f.personId), DECISION),
    },
    {
      screen: "/media/coverages",
      element: "نموذجُ «أنشرُ تغطية»",
      cap: "media.post",
      shown: (caps) =>
        visibleCaps(mediaCoveragesScreenNodes(caps, EMPTY_MEDIA_SNAPSHOT)).includes("media.post"),
      serverInvoke: (ep, f) =>
        ep.createCoverage.invoke(coverageInput(), canonicalActor(f.personId), WRITE),
    },
    {
      screen: "/media/coverages",
      element: "لوحةُ رفع صور الألبوم",
      cap: "media.post",
      shown: (caps) =>
        visibleCaps(mediaCoveragesScreenNodes(caps, EMPTY_MEDIA_SNAPSHOT)).includes("media.post"),
      serverInvoke: (ep, f) =>
        ep.addPhoto.invoke(
          { coverageId, contentType: "image/jpeg", sizeBytes: 1_000 },
          canonicalActor(f.personId),
          WRITE,
        ),
    },
    {
      screen: "/media/coverages",
      element: "حوارُ «أحذفُ تغطيتي»",
      cap: "media.post",
      shown: (caps) =>
        visibleCaps(mediaCoveragesScreenNodes(caps, EMPTY_MEDIA_SNAPSHOT)).includes("media.post"),
      serverInvoke: (ep, f) =>
        ep.deleteCoverage.invoke({ coverageId }, canonicalActor(f.personId), WRITE),
    },
  ]
}

describe("مصفوفةُ شاشات الإعلام — حضورٌ بعدسة الدور، وغيابٌ مقرونٌ برفض الخادم", () => {
  it("لكل دورٍ × كل عنصر: الحضور = القدرة على نطاق الشاشة، والغياب مقرونٌ برفض الخادم", async () => {
    let positives = 0
    let negatives = 0

    for (const f of ROLE_FIXTURES) {
      for (const a of affordances("seed")) {
        clearRegistryForTests()
        const seeded = seedWithCoverage()
        const ep = makeMediaEndpoints(seeded.store, SETTINGS, mediaDirectory, mediaPorts())
        const caps = computeMediaCaps(canonicalActor(f.personId), KHALID_PATH, DECISION, () => OFFICERS)

        const allowed = caps.has(a.cap)
        expect(a.shown(caps), `${a.screen} · ${a.element} · ${f.label}`).toBe(allowed)
        if (allowed) {
          positives += 1
        } else {
          negatives += 1
          const probe = affordances(seeded.coverageId).find((x) => x.element === a.element)!
          const r = await probe.serverInvoke(ep, f)
          expect(r.ok, `استدعاء «${a.element}» المباشر نجح رغم غياب العنصر · ${f.label}`).toBe(false)
        }
      }
    }

    console.log(`[مصفوفة شاشات الإعلام] إيجاب=${positives} · سلب=${negatives}`)
    expect(negatives).toBeGreaterThan(positives)
  })

  it("**المديرُ يرى المعرضَ ولا ينشر**: `media.hub` حاضرةٌ و`media.post` غائبةٌ عنه (ق-٢٧)", async () => {
    clearRegistryForTests()
    const seeded = seedWithCoverage()
    const ep = makeMediaEndpoints(seeded.store, SETTINGS, mediaDirectory, mediaPorts())
    const caps = computeMediaCaps(canonicalActor("u-admin"), KHALID_PATH, DECISION, () => OFFICERS)

    expect(visibleCaps(mediaHubScreenNodes(caps, EMPTY_MEDIA_SNAPSHOT))).toContain("media.hub")
    expect(visibleCaps(mediaCoveragesScreenNodes(caps, EMPTY_MEDIA_SNAPSHOT))).not.toContain("media.post")

    const viewed = await ep.hubView.invoke({ unitId: "khalid" }, canonicalActor("u-admin"), DECISION)
    expect(viewed.ok).toBe(true)

    const published = await ep.createCoverage.invoke(
      coverageInput({ publisherPersonId: "u-media" }),
      canonicalActor("u-admin"),
      WRITE,
    )
    expect(published.ok).toBe(false)
  })

  it("**والمشرفون كلُّهم مطّلعون لا ناشرين** — جدولُ الغياب §٣ محروسٌ على كل شاشة", () => {
    for (const personId of ["u-section-head", "u-rabita", "u-square"]) {
      const caps = computeMediaCaps(canonicalActor(personId), KHALID_PATH, DECISION, () => OFFICERS)
      expect(visibleCaps(mediaHubScreenNodes(caps, EMPTY_MEDIA_SNAPSHOT))).toContain("media.hub")
      expect(caps.has("media.post"), personId).toBe(false)
    }
  })

  it("**ومسؤولُ الإعلام وحده يرى شاشةَ العمل** — قشرةُ القدرات تحصيه في نطاقه", () => {
    const caps = computeMediaCaps(canonicalActor("u-media"), KHALID_PATH, DECISION, () => OFFICERS)
    expect(caps.has("media.post")).toBe(true)
    expect(visibleCaps(mediaCoveragesScreenNodes(caps, EMPTY_MEDIA_SNAPSHOT))).toContain("media.post")
  })

  it("**والطالبُ لا يرى إعلاماً**: الشاشتان فراغٌ مُشخِّصٌ لا شاشةٌ بيضاء (ق-١١٢)", () => {
    const caps = computeMediaCaps(canonicalActor("u-student"), KHALID_PATH, DECISION, () => OFFICERS)
    for (const nodes of [
      mediaHubScreenNodes(caps, EMPTY_MEDIA_SNAPSHOT),
      mediaCoveragesScreenNodes(caps, EMPTY_MEDIA_SNAPSHOT),
    ]) {
      expect(nodes.component).toBe("EmptyState")
      expect(nodes.meta.diagnostic).toBe("true")
    }
  })

  it("**والفراغُ المُشخِّص يفرّق شاغراً من خامل على الشاشة نفسِها** (ق-١٠٦)", () => {
    const caps = computeMediaCaps(canonicalActor("u-media"), KHALID_PATH, DECISION, () => OFFICERS)
    const vacant = mediaHubScreenNodes(caps, { ...EMPTY_MEDIA_SNAPSHOT, emptiness: "vacant" })
    const idle = mediaHubScreenNodes(caps, { ...EMPTY_MEDIA_SNAPSHOT, emptiness: "idle" })

    const keysOf = (n: UiNode) => walkNodes(n).flatMap((x) => [...x.textKeys])
    expect(keysOf(vacant)).toContain("state.emptyViewerVacant")
    expect(keysOf(idle)).toContain("state.emptyViewerIdle")
    expect(keysOf(vacant)).not.toContain("state.emptyViewerIdle")
  })
})
