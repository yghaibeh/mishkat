/**
 * بذرةُ عالم الإعلام — مشتقّةٌ من **العالم القانونيّ الواحد** (TESTING_POLICY §٥) فلا عالمَ
 * ثانٍ يتباعد. تُضيف ما تحتاجه هذه الوحدة وحدها: معجمَ أنواع التغطية وقاموسَ صيغ الرفع
 * (**بياناتٌ مرجعية** لا أرقامَ في الكود — قب-٦)، وواجهاتِ الروافد المستعارة (عقدُ الوحدة §٥).
 *
 * **الفاعلون كلُّهم من العالم القانونيّ**؛ والوحيدُ المشتقّ هو **مسؤولُ إعلامٍ منطاقٌ على
 * قسم**: العالمُ القانونيّ لا يحمل إلا مسؤولَ إعلامٍ على الجذر، ولا يُثبَت عزلُ النشر
 * بالنطاق (ق-١٠٥) بمن نطاقُه الجذرُ كلُّه. الاشتقاقُ **لا يخترع دوراً**: نفسُ فاعل العالم
 * بنفس دوره، ولا يتغيّر إلا **مسارُ إسناده** (وهو مسموحٌ لهذا الدور: `allowedUnitTypes`
 * تشمل القسم).
 */

import { buildCanonicalWorld } from "../../fixtures/canonical-world.js"
import { MediaStore } from "../../../src/features/media/data/store.js"
import { makePublishingScopeCheck } from "../../../src/features/media/services/scope.js"
import type { MediaContext } from "../../../src/features/media/services/context.js"
import type { FeedPhoto, MediaPorts } from "../../../src/features/media/services/ports.js"
import { createSettingsResolver, type SettingOverride } from "../../../src/settings/resolver.js"
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

/** معجمُ أنواع التغطية (ق-١٠٣ «نوعٌ من معجم») — **بياناتٌ مرجعية** تُبذَر ولا تُصلَّب. */
export const KINDS = [
  { id: "event", ar: "تغطيةُ فعالية", active: true },
  { id: "lesson", ar: "تغطيةُ درس", active: true },
  { id: "retired", ar: "نوعٌ أُوقف", active: false },
]

/** قاموسُ الصيغ المقبولة (المادة ٨/٤) — بياناتٌ مرجعية كذلك. */
export const FORMATS = [
  { id: "jpeg", contentType: "image/jpeg", active: true },
  { id: "png", contentType: "image/png", active: true },
  { id: "heic", contentType: "image/heic", active: false },
]

export function seedMediaStore(tenantId: string = MAIN_TENANT_ID): MediaStore {
  const store = new MediaStore(tenantId)
  for (const u of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId, id: u.id, ar: u.ar, path: u.path })
  }
  for (const k of KINDS) store.saveKind({ tenantId, ...k })
  for (const f of FORMATS) store.saveFormat({ tenantId, ...f })
  return store
}

/** فاعلٌ من العالم القانونيّ بمعرّفه — بلا نسخٍ لتعريفه هنا. */
export function canonicalActor(personId: string): Actor {
  const person = buildCanonicalWorld().people.find((p) => p.personId === personId)
  if (person === undefined) throw new Error(`لا شخص بهذا المعرّف في العالم القانوني: ${personId}`)
  return person
}

/** مسؤولُ الإعلام مُنزَلاً إلى نطاقٍ أضيق — نفسُ الفاعل ونفسُ دوره، ومسارُ الإسناد وحده يتغيّر. */
export const MEDIA_OF_MEN = "u-media-men"
export function scopedMediaOfficer(
  personId: string = MEDIA_OF_MEN,
  scopePath: string = "/men/",
): Actor {
  const base = canonicalActor("u-media")
  return {
    ...base,
    personId,
    assignments: base.assignments.map((a) => ({ ...a, scopePath })),
  }
}

/** دليلُ الفاعلين: العالمُ القانونيّ + المشتقُّ الواحد — لا نسخةَ أشخاصٍ ثانية. */
export function mediaDirectory(personId: string): Actor | null {
  if (personId === MEDIA_OF_MEN) return scopedMediaOfficer()
  return buildCanonicalWorld().people.find((p) => p.personId === personId) ?? null
}

/** صورةٌ من رافدٍ خارجيّ — بنيةُ الواجهة المعلنة (عقدُ الوحدة §٥). */
export function feedPhoto(over: Partial<FeedPhoto> & { id: string; unitPath: string }): FeedPhoto {
  return {
    titleAr: "صورةٌ من الميدان",
    occurredOn: NOW,
    uploaderPersonId: null,
    ...over,
  }
}

export type PortOverrides = Partial<MediaPorts>

/**
 * واجهاتُ الروافد الافتراضية: مسؤولُ إعلامٍ على الجذر (فالنطاقُ كلُّه مغطّى)، ومسؤولُ وحدةٍ
 * معروف، وحساباتُ العالم القانونيّ — ورافدان فارغان ما لم يُمرَّرا.
 */
export function mediaPorts(over: PortOverrides = {}): MediaPorts {
  return {
    officersIn: () => ["u-media"],
    responsibleFor: () => null,
    hasAccount: (personId) => mediaDirectory(personId) !== null,
    dailyLogPhotos: () => [],
    lessonPhotos: () => [],
    ...over,
  }
}

export function mediaContext(
  actorPersonId: string,
  over: {
    readonly ports?: PortOverrides
    readonly settings?: readonly SettingOverride[]
    readonly now?: Date
  } = {},
): MediaContext {
  return {
    now: over.now ?? NOW,
    actorPersonId,
    settings: createSettingsResolver(over.settings ?? [UPLOAD_LIMIT]),
    publishingScope: makePublishingScopeCheck(mediaDirectory, DECISION),
    ports: mediaPorts(over.ports ?? {}),
  }
}

/** مدخلٌ صحيحٌ كاملُ السياق — الاختباراتُ تكسر منه حقلاً واحداً فتُظهر الحارس. */
export const KHALID_PATH = "/men/homs/sq2/khalid/"
export const OMAR_PATH = "/men/homs/sq7/omar/"

export function coverageInput(over: Record<string, unknown> = {}) {
  return {
    publisherPersonId: "u-media",
    titleAr: "افتتاحُ دورةِ الحفظ",
    kindId: "event",
    unitId: "khalid",
    occurredOn: new Date("2026-07-18T00:00:00.000Z"),
    ...over,
  }
}
