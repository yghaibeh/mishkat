/**
 * ب-١٨ — **الاجتماعُ محضرٌ وقرارات** (عقدُ الوحدة §٤).
 *
 * **وب-٢ مدفونٌ بقرار المالك**: «النصابُ والتصويتُ وحضورُ الاجتماعات» بُنيت في v1 كاملةً
 * **ولم تُوصل بشاشةٍ قط** (`meetings.server.ts` كان يثبّت الأصوات صفراً، وجدولُ الحضور بلا
 * قارئ)، فقرّر المالكُ دفنَها: «v2 ينقل الاجتماعات محضراً وقرارات؛ إن احتاج الميدانُ تصويتاً
 * يوماً فميزةٌ جديدةٌ بمواصفة». ولذلك **لا حقلَ ولا دالةَ ولا مفردةَ** لها في هذه الوحدة —
 * والدفنُ **يُقاس على الشجرة** لا يُوعَد به في تعليق (اختبارٌ يمسح المصدر ويفشل عند عودتها).
 *
 * و**صفر فحصِ دور** (G6): القدرةُ (`meetings.manage`/`meetings.view`) تُفرَض عند حدّ الخادم.
 */

import type { CommitteeStore } from "../data/store.js"
import { contains } from "../../../authorization/scope.js"
import { areMeetingsEnabled, isFutureDatingAllowed, type CommitteeContext } from "./context.js"
import { err, ok, type Meeting, type Result } from "../types.js"

export type RecordMeetingInput = {
  readonly mosqueUnitId: string
  readonly heldAt: Date
  readonly minutesAr: string
  /** القراراتُ **أثرُ الاجتماع في العمل** — اجتماعٌ بلا قرارٍ لا يُسجَّل (ب-١٨). */
  readonly decisionsAr: readonly string[]
}

export function recordMeeting(
  store: CommitteeStore,
  ctx: CommitteeContext,
  input: RecordMeetingInput,
): Result<Meeting> {
  const mosque = store.getUnit(input.mosqueUnitId)
  if (mosque === null) return err("UNKNOWN_MOSQUE_UNIT", input.mosqueUnitId)
  if (!areMeetingsEnabled(ctx, mosque.path)) return err("MODULE_DISABLED", "feature.meetings")
  if (input.minutesAr.trim().length === 0) return err("EMPTY_MINUTES", mosque.id)

  const decisions = input.decisionsAr.map((d) => d.trim()).filter((d) => d.length > 0)
  if (decisions.length === 0) return err("NO_DECISIONS", mosque.id)

  // ق-٤٥/قب-٦: التأريخُ المستقبليّ يخضع للإعداد الحيّ نفسِه الذي يخضع له النشاط.
  if (input.heldAt.getTime() > ctx.now.getTime() && !isFutureDatingAllowed(ctx, mosque.path)) {
    return err("FUTURE_COMPLETION_DATE", mosque.id)
  }

  return store.transaction(() => {
    const meeting: Meeting = {
      tenantId: store.tenantId,
      id: store.nextId("mtg"),
      mosqueUnitId: mosque.id,
      mosquePath: mosque.path,
      heldAt: input.heldAt,
      minutesAr: input.minutesAr.trim(),
      decisionsAr: Object.freeze(decisions),
    }
    store.saveMeeting(meeting)
    return ok(meeting)
  })
}

/** ق-١٧ — الاطّلاعُ الهابط بالاحتواء: محاضرُ النطاق وما تحته، بلا سطرٍ يذكر دوراً (G6). */
export function meetingsWithin(store: CommitteeStore, scopePath: string): readonly Meeting[] {
  return store.meetings().filter((m) => contains(scopePath, m.mosquePath))
}
