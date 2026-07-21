/**
 * الجمعُ والهدفُ والتصنيف — ق-٤١ · ق-٤٣ · ق-٤٤/قب-١١ · ق-١٠ · ق-١١١.
 *
 * **ق-٤١ في سطرٍ واحد**: `periodPoints` تجمع `points` **المخزَّنة** في القيود، ولا تعيد
 * الاشتقاق من العدد×الوزن — وإلا ضاعت الأهليةُ التي حُسمت يوم الإدخال وتغيّر الماضي كلَّما
 * لمس أحدٌ الكتالوج. وهذا الفارقُ بعينه كان «إصلاحاً جوهرياً مكتشَفاً» في v1.
 *
 * **وق-٤٣**: الهدفُ يتبع **التقويم** (عددَ أيام بدء الأسبوع في المدى) لا عددَ السجلات
 * المُدخَلة — فالأسبوعُ الذي لم يُدخَل فيه شيءٌ يبقى في المقام، ولا يُكافأ التقصيرُ بهدفٍ أقلّ.
 *
 * **وق-٤٤ (قب-١١)**: التصنيفُ **نسبةٌ من الهدف** بعتبتين من سجل الإعدادات —
 * ومقياسُ ٥٦/٤٠ الصلبُ **ساقطٌ ولا أثرَ له في الشجرة**.
 */

import type { DailyLogStore } from "../data/store.js"
import { entriesOfPeriod } from "./entries.js"
import { familyRosterOf } from "./roster.js"
import { weekStartsInSpan } from "./time.js"
import { settingNumber, settingText, type DailyLogContext } from "./context.js"
import type { DailyEntry, DaySpan, InfluenceTier } from "../types.js"

/** ق-٤١ — **الجمعُ من القيود المخزَّنة**: نقطةٌ واحدةٌ لكل ما احتُسب يومَ إدخاله. */
export function periodPoints(
  store: DailyLogStore,
  unitPath: string,
  periodKey: string,
): number {
  return entriesOfPeriod(store, unitPath, periodKey).reduce((sum, e) => sum + e.points, 0)
}

/** ق-٤٣ — هدفُ المدى = الهدفُ الأسبوعيّ × **عددُ أيام بدء الأسبوع فيه**. */
export function targetForSpan(ctx: DailyLogContext, unitPath: string, span: DaySpan): number {
  const weekly = settingNumber(ctx, "points.weekly_target", unitPath)
  const weekStart = settingText(ctx, "time.week_start_day", unitPath)
  return weekly * weekStartsInSpan(span.fromDayKey, span.toDayKey, weekStart)
}

/**
 * ق-٤٤/قب-١١ — التصنيفُ **نسبةً من الهدف**: بلوغُ عتبة «متميّز» فما فوق، ثم «دون الهدف»،
 * ثم «متعثّر». وهدفٌ صفريٌّ لا يُصنَّف متميّزاً بالقسمة على صفر — **قاعدةُ الصفر** (ق-١١٢).
 */
export function tierOf(
  ctx: DailyLogContext,
  unitPath: string,
  points: number,
  target: number,
): InfluenceTier {
  if (target <= 0) return "struggling"
  const excellent = settingNumber(ctx, "points.tier.excellent_pct", unitPath)
  const below = settingNumber(ctx, "points.tier.below_pct", unitPath)
  const pct = (points * 100) / target
  if (pct >= excellent) return "excellent"
  if (pct >= below) return "below"
  return "struggling"
}

/** لقطةُ الصفحة — **مصدرُ بياناتٍ واحد** لشاشة سجل اليوم (ق-١١١). */
export type DailyLogView = {
  readonly unitPath: string
  readonly periodKey: string
  readonly points: number
  readonly target: number
  readonly tier: InfluenceTier
  readonly entries: readonly DailyEntry[]
  /** ب-٤٢: النشاطُ الحرّ يُفرَز ليراه معتمِدُ السجل ويقرّر. */
  readonly freeEntries: readonly DailyEntry[]
  readonly familyStudentCount: number | null
  /** ق-١٠: **لا تقديمَ فوق حصيلةٍ صفرية** — الشاشةُ تقرأ هذا ولا تجتهد. */
  readonly submittable: boolean
}

export function unitDailyLogView(
  store: DailyLogStore,
  ctx: DailyLogContext,
  unitPath: string,
  window: { readonly periodKey: string; readonly span: DaySpan },
): DailyLogView {
  const entries = entriesOfPeriod(store, unitPath, window.periodKey)
  const points = entries.reduce((sum, e) => sum + e.points, 0)
  const target = targetForSpan(ctx, unitPath, window.span)
  return {
    unitPath,
    periodKey: window.periodKey,
    points,
    target,
    tier: tierOf(ctx, unitPath, points, target),
    entries,
    freeEntries: entries.filter((e) => e.activityId === null),
    familyStudentCount: familyRosterOf(store, unitPath)?.studentCount ?? null,
    submittable: entries.length > 0,
  }
}
