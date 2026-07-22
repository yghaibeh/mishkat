/**
 * بذرةُ عالم المكتبة — مشتقّةٌ من **العالم القانونيّ الواحد** (TESTING_POLICY §٥) فلا عالمَ
 * ثانٍ يتباعد. تُضيف ما تحتاجه هذه الوحدة وحدها **بياناتٍ مرجعية** (قب-٢٢): فئاتٍ وجماهيرَ
 * وصيغَ رفعٍ — ولا رقمَ ولا دورَ في الكود.
 *
 * **وجماهيرُ ق-٩٦ الأربعة تُبذَر بقدراتها لا بأسماء أدوارها** (عقدُ الوحدة §٢): وهذه البذرةُ
 * وحدَها موضعُ الربط، فالوحدةُ لا تعرف أيَّ قدرةٍ يحمل صفٌّ. والمطابقةُ مع v1 تامّة:
 * `visit.conduct` يحملها **مشرفو المربع والمنطقة والقسم** حصراً — وهي `SUPERVISOR_ROLES`
 * نفسُها بلا قائمةِ أدوارٍ مُصلَّبة.
 */

import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import { LibraryStore } from "../../../src/features/library/data/store.js"
import { makeAudienceMembership } from "../../../src/features/library/services/audience.js"
import { makeScopeReach } from "../../../src/features/library/services/directory.js"
import type { LibraryContext } from "../../../src/features/library/services/context.js"
import type { LibraryPorts } from "../../../src/features/library/services/ports.js"
import type { CreateMaterialInput } from "../../../src/features/library/services/materials.js"
import { createSettingsResolver, type SettingOverride } from "../../../src/settings/resolver.js"
import { contains } from "../../../src/authorization/scope.js"
import type { Actor, DecisionContext } from "../../../src/authorization/can.js"

export const NOW = new Date("2026-07-20T00:00:00.000Z")
export const MAIN_TENANT_ID = "t-main"
/** الشبكةُ الثانية — بنفس المسارات النسبيّة عمداً، فيثبت العزلُ أنّ التطابق لا يسرّب (قب-١٨). */
export const SECOND_TENANT_ID = "t-aleppo"

export const DECISION: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
export const WRITE: DecisionContext = { ...DECISION, intent: "write" }

/** أقصى حجمِ ملفٍ مضبوطٌ للاختبار — الإعدادُ مسجَّلٌ بلا افتراضيٍّ عمداً (ق-م-٢). */
export const MAX_BYTES = 5_000_000
export const UPLOAD_LIMIT: SettingOverride = {
  settingId: "platform.upload.max_bytes",
  scopePath: "/",
  value: MAX_BYTES,
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
}

/** فئاتُ المكتبة (ق-١١٧/ق-٨٩) — **ثلاثةُ حقولٍ بلا مفتاح تفعيل** (عقدُ الوحدة §٢). */
export const CATEGORIES = [
  { id: "aqeedah", ar: "عقيدة" },
  { id: "admin_training", ar: "تدريبٌ إداريّ" },
  { id: "other", ar: "أخرى" },
]

/** جماهيرُ ق-٩٦ الأربعة — **كلُّ جمهورٍ قدرةٌ من الكتالوج الذهبيّ**، لا اسمُ دور. */
export const AUDIENCES = [
  { id: "all", ar: "الجميع", capabilityId: "library.own" as const },
  { id: "amirs", ar: "مسؤولو المساجد", capabilityId: "circle.manage" as const },
  { id: "teachers", ar: "المعلّمون", capabilityId: "circle.teach" as const },
  { id: "supervisors", ar: "المشرفون", capabilityId: "visit.conduct" as const },
]

/** قاموسُ الصيغ المقبولة (المادة ٨/٤) — بياناتٌ مرجعية كذلك. */
export const FORMATS = [
  { id: "pdf", contentType: "application/pdf", active: true },
  { id: "audio", contentType: "audio/mpeg", active: true },
  { id: "epub", contentType: "application/epub+zip", active: false },
]

export function seedLibraryStore(tenantId: string = MAIN_TENANT_ID): LibraryStore {
  const store = new LibraryStore(tenantId)
  for (const u of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId, id: u.id, ar: u.ar, path: u.path })
  }
  for (const c of CATEGORIES) store.saveCategory({ tenantId, ...c })
  for (const a of AUDIENCES) store.saveAudience({ tenantId, ...a })
  for (const f of FORMATS) store.saveFormat({ tenantId, ...f })
  return store
}

/** فاعلٌ من العالم القانونيّ بمعرّفه — بلا نسخٍ لتعريفه هنا. */
export function canonicalActor(personId: string): Actor {
  const person = buildCanonicalWorld().people.find((p) => p.personId === personId)
  if (person === undefined) throw new Error(`لا شخص بهذا المعرّف في العالم القانوني: ${personId}`)
  return person
}

/** دليلُ الفاعلين: العالمُ القانونيّ وحده — لا نسخةَ أشخاصٍ ثانية. */
export function libraryDirectory(personId: string): Actor | null {
  return buildCanonicalWorld().people.find((p) => p.personId === personId) ?? null
}

/**
 * منفذُ «مَن في هذا النطاق؟» — سؤالُ **إسنادٍ** موطنُه وحدةُ التنظيم (ك-١٣)، يُحقن هنا
 * ويُقاس **بمسار التكليف لا بالمسمّى** (G6). ومَن لا تكليفَ فعّالاً له لا يدخل المصفوفة.
 */
export function peopleIn(unitPath: string): readonly string[] {
  return buildCanonicalWorld()
    .people.filter((p) =>
      p.assignments.some(
        (a) =>
          a.approvalStatus === "approved" &&
          !a.unitArchived &&
          (a.endDate === null || a.endDate.getTime() > NOW.getTime()) &&
          contains(unitPath, a.scopePath),
      ),
    )
    .map((p) => p.personId)
}

export function libraryPorts(over: Partial<LibraryPorts> = {}): LibraryPorts {
  return { peopleIn, ...over }
}

export function libraryContext(
  actorPersonId: string,
  over: {
    readonly settings?: readonly SettingOverride[]
    readonly now?: Date
    readonly ports?: Partial<LibraryPorts>
    readonly directory?: (personId: string) => Actor | null
  } = {},
): LibraryContext {
  const now = over.now ?? NOW
  const directory = over.directory ?? libraryDirectory
  return {
    now,
    actorPersonId,
    settings: createSettingsResolver(over.settings ?? [UPLOAD_LIMIT]),
    inAudience: makeAudienceMembership(directory, { ...DECISION, now }),
    reaches: makeScopeReach(directory, now),
    ports: libraryPorts(over.ports ?? {}),
  }
}

/** مساراتٌ من العالم القانونيّ — تُستعمل نصّاً في التوكيدات فلا تُشتقّ في كل ملفّ. */
export const ROOT_PATH = "/"
export const MEN_PATH = "/men/"
export const WOMEN_PATH = "/women/"
export const KHALID_PATH = "/men/homs/sq2/khalid/"
export const OMAR_PATH = "/men/homs/sq7/omar/"

/** مدخلُ إنشاءٍ صحيحٌ كاملُ السياق — الاختباراتُ تكسر منه حقلاً واحداً فتُظهر الحارس. */
export function materialInput(over: Partial<CreateMaterialInput> = {}): CreateMaterialInput {
  return {
    titleAr: "دليلُ أمير المسجد",
    categoryId: "admin_training",
    audienceId: "all",
    kind: "pdf",
    unitId: "root",
    mandatory: false,
    contentType: "application/pdf",
    sizeBytes: 1_000,
    ...over,
  }
}

/** مدخلُ مادةِ **رابط** — لا مفتاحَ تخزينٍ لها ولا حجم (عقدُ الوحدة §٧). */
export function linkMaterialInput(over: Partial<CreateMaterialInput> = {}): CreateMaterialInput {
  return {
    titleAr: "تسجيلُ اللقاء التدريبيّ",
    categoryId: "admin_training",
    audienceId: "all",
    kind: "link",
    unitId: "root",
    mandatory: false,
    externalUrl: "https://example.org/guide",
    ...over,
  }
}

/** مدخلُ مادةِ ملفٍّ **بلا محتوىً مرفوع** — يُظهر حارسَ `FILE_REQUIRED`. */
export function filelessMaterialInput(over: Partial<CreateMaterialInput> = {}): CreateMaterialInput {
  return {
    titleAr: "دليلٌ بلا ملفّ",
    categoryId: "admin_training",
    audienceId: "all",
    kind: "pdf",
    unitId: "root",
    mandatory: false,
    ...over,
  }
}
