/**
 * ب-٣٢ — عددُ طلاب أسرة المسجد: **المُتحقَّقُ به** الذي تُقاس عليه عتبةُ المشاركة (ق-٤٠).
 *
 * قيمتُه `null` تعني **غيرَ مضبوطٍ**، وهي حالةٌ ذاتُ أثرٍ لا فراغٌ صامت: النشاطُ المشروط
 * لا نقاطَ له حتى يُضبط («نقطةٌ بلا تحقّقٍ نقطةٌ زائفة» — قرارُ مالكٍ مصادَق).
 */

import type { DailyLogStore } from "../data/store.js"
import type { DailyLogContext } from "./context.js"
import { dailyLogErr, dailyLogOk, type DailyLogResult, type FamilyRoster } from "../types.js"

export type FamilyRosterInput = {
  readonly unitId: string
  readonly studentCount: number | null
}

export function setFamilyRoster(
  store: DailyLogStore,
  ctx: DailyLogContext,
  input: FamilyRosterInput,
): DailyLogResult<FamilyRoster> {
  const unit = store.getUnit(input.unitId)
  if (unit === null) return dailyLogErr("UNKNOWN_UNIT", input.unitId)
  if (input.studentCount !== null && input.studentCount < 0) {
    return dailyLogErr("INVALID_STUDENT_COUNT", String(input.studentCount))
  }

  const roster: FamilyRoster = {
    tenantId: store.tenantId,
    unitPath: unit.path,
    studentCount: input.studentCount,
    setBy: ctx.actorPersonId,
    setAt: ctx.now,
  }
  store.saveRoster(roster)
  return dailyLogOk(roster)
}

export function familyRosterOf(store: DailyLogStore, unitPath: string): FamilyRoster | null {
  return store.getRoster(unitPath)
}
