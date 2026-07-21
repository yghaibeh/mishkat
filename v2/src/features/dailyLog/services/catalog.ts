/**
 * كتالوجُ الأنشطة ومخطّطاتُه — ب-٣٩ج/قب-١١ (كيانُ بياناتٍ بشاشةٍ مستقلة، IA ك-١٨)
 * وق-٤٢ (مخطّطٌ لكل نطاق) وق-٣٦ (النسخُ مؤرَّخةٌ بأثرٍ قادمٍ فقط).
 *
 * **معنى «منتج» هنا**: إضافةُ نشاطٍ أو تعطيلُه أو تغييرُ وزنه وسقفه **بيانٌ يُحفظ**، لا سطرَ
 * كودٍ يُنشر — فلا يحتاج المسجدُ مبرمجاً ليضيف نشاطاً. ولذلك ليس في هذا الملفّ **قائمةُ
 * أنشطةٍ ولا وزنٌ ولا سقف**: كلُّها صفوفٌ في المستودع.
 *
 * وق-٤٢ **حالةٌ من القاعدة لا استثناء**: المخطّطُ له `scopePath`، والأعمقُ يغلب الأعمّ —
 * فلا يعرف هذا الملفّ «قسماً» ولا «جنساً»، ويعمل قسمٌ ثالثٌ بمخطّطه بلا سطرِ كود.
 */

import { contains } from "../../../authorization/scope.js"
import type { DailyLogStore } from "../data/store.js"
import { dayKeyIn } from "./time.js"
import { settingText, type DailyLogContext } from "./context.js"
import {
  dailyLogErr,
  dailyLogOk,
  type ActivityDefinition,
  type ActivityScheme,
  type DailyLogResult,
} from "../types.js"

/** عمقُ النطاق: عدد مقاطعه. الأعمقُ أدقُّ، والأدقُّ يغلب الأعمّ (نظيرُ مُحلِّل الإعدادات). */
function depth(path: string): number {
  return path.split("/").filter((seg) => seg.length > 0).length
}

/**
 * ق-٤٢ — **المخطّطُ يُختار بالنطاق**: أعمقُ مخطّطٍ نشطٍ يحتوي مسارَ الوحدة.
 * ووحدةٌ خارج كل المخطّطات ⇒ `null` — **لا مخطّطَ افتراضيٌّ ضمنيّ** (لا احتسابَ بالظنّ).
 */
export function schemeForUnit(store: DailyLogStore, unitPath: string): ActivityScheme | null {
  const covering = store
    .schemes()
    .filter((s) => s.active && contains(s.scopePath, unitPath))
    .sort((a, b) => depth(b.scopePath) - depth(a.scopePath) || a.id.localeCompare(b.id))
  return covering[0] ?? null
}

/**
 * ق-٣٦ — **النسخةُ السارية عند تاريخٍ بعينه**: أحدثُ نسخةٍ بدأ سريانُها قبله أو عنده.
 * وتعادلُ التاريخ يُكسر بالمعرّف **حتمياً** (درسُ لا-حتميّة `rateForMonth` في v1).
 */
export function activityAt(
  store: DailyLogStore,
  schemeId: string,
  activityId: string,
  at: Date,
): ActivityDefinition | null {
  const versions = store
    .activities()
    .filter(
      (a) =>
        a.schemeId === schemeId &&
        a.activityId === activityId &&
        a.validFrom.getTime() <= at.getTime(),
    )
    .sort(
      (a, b) => b.validFrom.getTime() - a.validFrom.getTime() || a.id.localeCompare(b.id),
    )
  return versions[0] ?? null
}

export type CatalogView = {
  readonly schemes: readonly ActivityScheme[]
  readonly activities: readonly ActivityDefinition[]
}

/** معاينةُ الكتالوج لشاشة الإدارة — **مصدرُ بياناتٍ واحد** لتلك الشاشة (ق-١١١). */
export function catalogView(store: DailyLogStore): CatalogView {
  return {
    schemes: [...store.schemes()].sort((a, b) => a.id.localeCompare(b.id)),
    activities: [...store.activities()].sort(
      (a, b) =>
        a.schemeId.localeCompare(b.schemeId) ||
        a.activityId.localeCompare(b.activityId) ||
        a.validFrom.getTime() - b.validFrom.getTime(),
    ),
  }
}

export type UpsertActivityInput = {
  readonly schemeId: string
  readonly activityId: string
  readonly ar: string
  readonly weight: number
  readonly maxPerDay: number | null
  readonly requiresParticipation: boolean
  readonly active: boolean
  /** ق-٣٦: تاريخُ السريان — افتراضُه «الآن»، و**الماضي مرفوضٌ بنيوياً**. */
  readonly validFrom?: Date
}

/**
 * إضافةُ نشاطٍ أو تعديلُه — **نسخةٌ جديدةٌ بتاريخ سريانها** لا كتابةٌ فوق القديم:
 * فيبقى الماضي كما حُسم يوم إدخاله (ق-٤١)، ويسري الجديدُ على ما بعده (ق-٣٦).
 *
 * ومعرّفُ النسخة `مخطّط:نشاط:يومُ السريان` — فتعديلان في اليوم نفسِه **نسخةٌ واحدة**
 * لا نسختان متعادلتان تتنازعان (حتميّةٌ بالبناء لا بالترتيب).
 */
export function upsertActivity(
  store: DailyLogStore,
  ctx: DailyLogContext,
  input: UpsertActivityInput,
): DailyLogResult<ActivityDefinition> {
  const scheme = store.getScheme(input.schemeId)
  if (scheme === null) return dailyLogErr("UNKNOWN_SCHEME", input.schemeId)
  if (input.weight < 0) return dailyLogErr("INVALID_WEIGHT", String(input.weight))
  if (input.maxPerDay !== null && input.maxPerDay <= 0) {
    return dailyLogErr("INVALID_WEIGHT", String(input.maxPerDay))
  }

  const validFrom = input.validFrom ?? ctx.now
  // **بأثرٍ قادمٍ فقط** (ق-٣٦): سريانٌ في الماضي يعيد كتابةَ ما حُسم — مرفوضٌ بنيوياً.
  if (validFrom.getTime() < ctx.now.getTime()) {
    return dailyLogErr("BACKDATED_VERSION", validFrom.toISOString())
  }

  const zone = settingText(ctx, "time.zone", scheme.scopePath)
  const definition: ActivityDefinition = {
    tenantId: store.tenantId,
    id: `${input.schemeId}:${input.activityId}:${dayKeyIn(validFrom, zone)}`,
    schemeId: input.schemeId,
    activityId: input.activityId,
    ar: input.ar,
    weight: input.weight,
    maxPerDay: input.maxPerDay,
    requiresParticipation: input.requiresParticipation,
    active: input.active,
    validFrom,
  }
  store.saveActivity(definition)
  return dailyLogOk(definition)
}

export type SchemeInput = {
  readonly id: string
  readonly ar: string
  readonly scopePath: string
  readonly active: boolean
}

/** إضافةُ مخطّطٍ أو تعطيلُه — **بياناتٌ كذلك**: قسمٌ جديدٌ يعمل بلا سطرِ كود (ق-٤٢). */
export function upsertScheme(
  store: DailyLogStore,
  input: SchemeInput,
): DailyLogResult<ActivityScheme> {
  const scheme: ActivityScheme = { tenantId: store.tenantId, ...input }
  store.saveScheme(scheme)
  return dailyLogOk(scheme)
}
