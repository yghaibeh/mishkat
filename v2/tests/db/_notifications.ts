/**
 * مِشْجَبُ استمرارِ الإشعارات — **ملفٌّ جديدٌ لا تعديلٌ في `_harness.ts`** (فخّ ٣ من الوصفة).
 *
 * الموجةُ الأولى ستُّ وحداتٍ تتوازى؛ ولو وسّع كلُّ وكيلٍ `Stores` في المِشْجَب المشترك لصار
 * تعارضُ دمجٍ حتماً. فالنمطُ المُقرَّر: **بدائيّاتُ المِشْجَب المشترك تُستهلك ولا تُعدَّل**
 * (`freshDb` والهجراتُ المشحونة والشبكتان)، ووحدةُ العمل الخاصةُ تُبنى هنا.
 *
 * **وسجلٌّ لا يُحقن هنا**: مستودعُ الإشعارات **لا يحمل تدقيقاً** — فوحدةُ العمل تُدرِج
 * مستودعَ الإشعارات وحدَه (بخلاف العُهد التي تُدرِج سجلاً مشتركاً).
 *
 * **حتميّ** (TESTING_POLICY §٥): لحظةُ العالم القانونيّ مثبَّتة، والمعرّفاتُ من عدّاد المستودع.
 */

import { persistentNotifications } from "../../src/db/repositories/notificationsRepository.js"
import type { SqliteDriver } from "../../src/db/sql/sqliteDriver.js"
import { UnitOfWork, type Scope } from "../../src/db/unitOfWork.js"
import { NotificationStore } from "../../src/features/notifications/data/store.js"
import { makeIntake, type NotificationEvent } from "../../src/features/notifications/services/intake.js"
import { buildCanonicalWorld } from "../fixtures/canonical-world.js"

/** الشبكتان و`freshDb` من المِشْجَب المشترك — **تُستهلك ولا تُنسخ** (المادة ١/٢). */
export { MAIN, OTHER, freshDb, rowsOf } from "./_harness.js"
/** بذرةُ عالم الإشعارات ولحظتُه من بذرة الوحدة القائمة — لا عالمَ ثانياً يتباعد. */
export {
  NOW,
  KINDS,
  KHALID_PATH,
  BILAL_PATH,
  SQUARE_PATH,
  SECTION_PATH,
  REGION_PATH,
  OMAR_PATH,
  LINK_TTL,
  TTL_MINUTES,
  channelsOverride,
  notificationContext,
  notificationPorts,
  payload,
  submissionEvent,
  personEvent,
  SQUARE_LAYER_TARGETS,
} from "../features/notifications/_seed.js"

import { KINDS, channelsOverride, LINK_TTL, notificationContext } from "../features/notifications/_seed.js"
import type { NotificationContext } from "../../src/features/notifications/services/context.js"

/** سياقٌ للجلسات: القنواتُ مفعّلةٌ (الجرسُ وتيليغرام) وعمرُ الرمز مضبوطٌ — فتُنشأ سطورُ التسليم. */
export function notifyCtx(actorPersonId: string, over: Record<string, unknown> = {}): NotificationContext {
  return notificationContext(actorPersonId, {
    settings: [LINK_TTL, channelsOverride(["bell", "telegram"])],
    ...over,
  })
}

export function freshNotificationStore(tenantId: string): NotificationStore {
  return new NotificationStore(tenantId)
}

export function notificationsUnitOfWork(
  driver: SqliteDriver,
  store: NotificationStore,
  scope: Scope,
): UnitOfWork {
  const uow = new UnitOfWork(driver, scope)
  uow.enlist(persistentNotifications(store))
  return uow
}

/**
 * **جلسةُ D1 واحدة**: تحميلٌ ⟵ مقطعٌ متزامنٌ يعمل عليه المنطقُ كما هو ⟵ قذفةٌ واحدة.
 * الاختباراتُ **تستهلك** طبقةَ الاستمرار كما تُشحن ولا تحاكيها.
 */
export async function notificationsSession<T>(
  driver: SqliteDriver,
  tenantId: string,
  fn: (store: NotificationStore) => T,
  scopePath = "/",
): Promise<T> {
  const store = freshNotificationStore(tenantId)
  const uow = notificationsUnitOfWork(driver, store, { tenantId, scopePath })
  await uow.hydrate()
  const value = fn(store)
  await uow.flush()
  return value
}

/** يبذر المراجعَ (الوحداتِ والأنواعَ) في مستودعٍ طازج — الوحداتُ من العالم القانونيّ. */
export function seedNotificationRefs(store: NotificationStore): void {
  for (const unit of buildCanonicalWorld().units) {
    store.saveUnit({ tenantId: store.tenantId, id: unit.id, ar: unit.ar, path: unit.path })
  }
  for (const kind of KINDS) store.saveKind({ tenantId: store.tenantId, ...kind })
}

/** بذرُ المراجع **بطريق الكتابة نفسِه** (`flush`) — فلا يُختبر مسارٌ لا يُشحن. */
export async function seedNotificationsSession(driver: SqliteDriver, tenantId: string): Promise<void> {
  await notificationsSession(driver, tenantId, (store) => seedNotificationRefs(store))
}

/** إدراجُ حدثٍ عبر البابِ المعلن (`makeIntake`) — لا حقنٌ في المستودع. */
export function intake(store: NotificationStore, ctx: NotificationContext, event: NotificationEvent) {
  return makeIntake(store, ctx)(event)
}
