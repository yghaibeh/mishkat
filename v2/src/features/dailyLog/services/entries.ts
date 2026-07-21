/**
 * نزاهةُ الإدخال اليوميّ — ق-٤٥ (upsert بمفتاحٍ طبيعيٍّ و`client_uuid`، ولا تأريخَ مستقبلياً،
 * والتوقيتُ من الإعداد) · ق-٤٦ (لا ازدواجَ عبر جهتين) · ق-٨ (لا كتابةَ على فترةٍ مقفلة).
 *
 * كلُّ قاعدةٍ هنا **ثمنُ خطأٍ ميدانيٍّ مدفوع**: مضاعفةُ نقاط الأسبوع بالمزامنة المتزامنة،
 * ونافذةُ ما بعد منتصف الليل الدمشقيّ التي كانت تنسب عملَ اليوم إلى أمس.
 *
 * **والنقاطُ تُخزَّن مع القيد** (ق-٤١): تُحسب مرةً واحدةً بأهليّتها ووزنِها **يومَ الإدخال**،
 * فيبقى الماضي كما حُسم مهما تغيّر الكتالوجُ بعده.
 */

import type { DailyLogStore } from "../data/store.js"
import { naturalKeyOf } from "../data/store.js"
import { activityAt, schemeForUnit } from "./catalog.js"
import { awardFor, freeActivityAward } from "./eligibility.js"
import { dayKeyIn, weekKeyOf } from "./time.js"
import { settingBoolean, settingText, type DailyLogContext } from "./context.js"
import {
  dailyLogErr,
  dailyLogOk,
  type DailyEntry,
  type DailyLogResult,
} from "../types.js"

export type RecordEntryInput = {
  /** بصمةُ العميل — تخدم الأوفلاين (ت-٨) فلا تُضاعف المزامنةُ نقاطاً. */
  readonly clientUuid: string
  readonly unitId: string
  readonly activityId?: string
  /** ب-٤٢/ع-١٥: «اكتب ما هو هذا النشاط» — توثيقٌ بلا نقاطٍ آلية. */
  readonly freeTextAr?: string
  readonly count: number
  readonly date: Date
  /** عددُ الحاضرين — تُحسب منه النسبةُ في الخادم، فلا نسبةَ يرسلها العميل (ق-٤٠). */
  readonly attendees?: number
  /** ق-٤٦: أسماءُ الطلاب المشاركين — بها يُمنع احتسابُ الواحد عبر جهتين. */
  readonly studentIds?: readonly string[]
}

/** قيودُ فترةٍ لوحدة — أساسُ الجمع والحمولة (ق-٤١). */
export function entriesOfPeriod(
  store: DailyLogStore,
  unitPath: string,
  periodKey: string,
): readonly DailyEntry[] {
  return store
    .entries()
    .filter((e) => e.unitPath === unitPath && e.periodKey === periodKey)
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.id.localeCompare(b.id))
}

/**
 * ق-٤٦ — مَن **احتُسب فعلاً** في جهةٍ أخرى لنفس النشاط في اليوم نفسِه.
 * القياسُ على `creditedStudentIds` لا على المُدخَل: فمَن دخل ولم يُحتسب لا يحجب غيرَه.
 */
function creditedElsewhere(
  store: DailyLogStore,
  activityId: string,
  dayKey: string,
  excludeEntryId: string | null,
): ReadonlySet<string> {
  const out = new Set<string>()
  for (const e of store.entries()) {
    if (e.activityId !== activityId || e.dayKey !== dayKey) continue
    if (excludeEntryId !== null && e.id === excludeEntryId) continue
    for (const s of e.creditedStudentIds) out.add(s)
  }
  return out
}

export function recordDailyEntry(
  store: DailyLogStore,
  ctx: DailyLogContext,
  input: RecordEntryInput,
): DailyLogResult<DailyEntry> {
  const unit = store.getUnit(input.unitId)
  if (unit === null) return dailyLogErr("UNKNOWN_UNIT", input.unitId)

  // ق-٤٥: حدودُ اليوم والأسبوع **من الإعداد** — تبديلُ المنطقة يبدّل اليومَ بلا سطرِ كود.
  const zone = settingText(ctx, "time.zone", unit.path)
  const weekStart = settingText(ctx, "time.week_start_day", unit.path)
  const dayKey = dayKeyIn(input.date, zone)
  const todayKey = dayKeyIn(ctx.now, zone)
  if (dayKey > todayKey && !settingBoolean(ctx, "records.allow_future_dating", unit.path)) {
    return dailyLogErr("FUTURE_DATED", dayKey)
  }
  const periodKey = weekKeyOf(dayKey, weekStart)

  // ق-٨: الفترةُ المقفلةُ ترفض **كل** كتابة — والقفلُ يُسأل ولا يُستنتج (منفذٌ محقون).
  if (ctx.isPeriodLocked(unit.path, periodKey)) return dailyLogErr("PERIOD_LOCKED", periodKey)

  if (input.count <= 0) return dailyLogErr("NON_POSITIVE_COUNT", String(input.count))

  const freeText = input.freeTextAr === undefined ? null : input.freeTextAr.trim()
  if (input.activityId === undefined && freeText === null) {
    return dailyLogErr("ACTIVITY_OR_FREE_TEXT_REQUIRED", input.clientUuid)
  }
  if (input.activityId === undefined && freeText !== null && freeText.length === 0) {
    return dailyLogErr("EMPTY_FREE_TEXT", input.clientUuid)
  }

  const activityId = input.activityId ?? null
  const naturalKey = naturalKeyOf(unit.path, activityId, dayKey)
  // ق-٤٥: **فهرسان فريدان** — البصمةُ أولاً ثم المفتاحُ الطبيعيّ؛ والموجودُ يُحدَّث لا يُضاف.
  const existing =
    store.findByClientUuid(input.clientUuid) ??
    (naturalKey === null ? null : store.findByNaturalKey(naturalKey))

  let award = freeActivityAward(input.count)
  let credited: readonly string[] = input.studentIds ?? []

  if (activityId !== null) {
    const scheme = schemeForUnit(store, unit.path)
    if (scheme === null) return dailyLogErr("NO_SCHEME_FOR_SCOPE", unit.path)
    const definition = activityAt(store, scheme.id, activityId, input.date)
    if (definition === null) return dailyLogErr("UNKNOWN_ACTIVITY", activityId)
    if (!definition.active) return dailyLogErr("ACTIVITY_INACTIVE", activityId)

    const declared = input.studentIds ?? []
    let deduplicated = false
    let requested = input.count
    if (declared.length > 0) {
      const taken = creditedElsewhere(store, activityId, dayKey, existing?.id ?? null)
      credited = declared.filter((s) => !taken.has(s))
      deduplicated = credited.length < declared.length
      requested = credited.length
    }

    award = awardFor(ctx, {
      definition,
      unitPath: unit.path,
      requestedCount: requested,
      deduplicated,
      attendees: input.attendees ?? null,
      roster: store.getRoster(unit.path),
    })
    // ما لم يُحتسب لا يُسجَّل محتسَباً — فلا يحجب الطالبُ نفسَه في جهةٍ ثالثة.
    if (award.points === 0) credited = []
  }

  return store.transaction(() => {
    const entry: DailyEntry = {
      tenantId: store.tenantId,
      id: existing?.id ?? store.nextId("dle"),
      clientUuid: input.clientUuid,
      unitPath: unit.path,
      activityId,
      freeTextAr: freeText,
      dayKey,
      periodKey,
      count: input.count,
      creditedCount: award.creditedCount,
      points: award.points,
      studentIds: Object.freeze([...(input.studentIds ?? [])]),
      creditedStudentIds: Object.freeze([...credited]),
      block: award.block,
      byPersonId: ctx.actorPersonId,
      at: ctx.now,
    }
    store.saveEntry(entry)
    return dailyLogOk(store.getEntry(entry.id)!)
  })
}
