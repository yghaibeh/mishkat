/**
 * ق-١٦/ق-١٠٠/ق-١٧ — **تسجيلُ الزيارة ومرساتُها** (عقدُ الوحدة §٣).
 *
 * **المرساةُ هي القاعدة كلُّها**: من زار يرفع زيارته فتظهر عند **الأقرب فوقه** (ق-١٦)، ولذلك
 * تُخزَّن الزيارةُ بمسار **وحدة الزائر** لا بمسار الحلقة المزورة. في v1 كان الخلطُ بينهما هو
 * ما جعل زيارةَ المربع تُعرض على المدير: مَن يعتمد يُشتقّ من مسارِ الطلب، فإن كان مسارُ الطلب
 * حلقةً صار «الأقربُ فوقها» أميرَ المسجد — وهو ليس مشرفاً على مَن زار.
 *
 * و**الاشتقاق بلا اسمِ دورٍ** (G6): أعمقُ مسارِ إسنادٍ للزائر يحتوي الهدفَ — مقارنةُ احتواءٍ
 * وطولِ مسارٍ، لا `role ===` ولا قائمةَ طبقات. وحين لا يحتوي أيُّ إسنادٍ الهدفَ فالزيارةُ
 * **مردودةٌ في الخدمة** كما ردّها `can()` في الخادم — **حارسان لا حارسٌ واحد**.
 */

import { contains } from "../../../authorization/scope.js"
import type { Assignment } from "../../../authorization/can.js"
import { dayKeyIn } from "../../dailyLog/services/time.js"
import type { SupervisionStore } from "../data/store.js"
import { settingText, type SupervisionContext } from "./context.js"
import { matchesForm } from "./forms.js"
import {
  supervisionErr,
  supervisionOk,
  type SupervisionResult,
  type SupervisionVisit,
  type VisitCore,
  type VisitDetails,
} from "../types.js"

/** حدُّ التقييم المئويّ — طرفا المدى المعلَن، لا مقياسٌ مخترع. */
const RATING_MIN = 0
const RATING_MAX = 100

export type RecordVisitInput = {
  readonly targetId: string
  readonly visitedAt: Date
  readonly core: VisitCore
  readonly details: VisitDetails
}

/**
 * مساراتُ إسنادٍ **فعّالةٌ معتمَدة** للفاعل — تُحسب في الخادم وتُمرَّر في السياق.
 * **مساراتٌ لا أدوار**: لا يُقرأ منها `roleId` إطلاقاً (G6).
 */
export function effectiveScopePathsOf(
  assignments: readonly Assignment[],
  now: Date,
): readonly string[] {
  return assignments
    .filter(
      (a) =>
        a.approvalStatus === "approved" &&
        !a.unitArchived &&
        a.startDate.getTime() <= now.getTime() &&
        (a.endDate === null || a.endDate.getTime() > now.getTime()),
    )
    .map((a) => a.scopePath)
}

/** عمقُ المسار — عددُ مقاطعه؛ به يُرجَّح الأعمقُ على الأعمّ (نظيرُ قاعدة سجل الإعدادات). */
function depth(path: string): number {
  return path.split("/").filter((segment) => segment.length > 0).length
}

/** ق-١٦: **أعمقُ إسنادٍ للزائر يحتوي الهدف** — وهي وحدتُه التي تصعد منها السلسلة. */
export function supervisorAnchorFor(
  scopePaths: readonly string[],
  targetPath: string,
): string | null {
  // مسارانِ بالعمق نفسِه لا يحتويان هدفاً واحداً إلا أن يتطابقا — فالأعمقُ وحدَه هو المرجِّح.
  const containing = scopePaths.filter((path) => contains(path, targetPath))
  return [...containing].sort((a, b) => depth(b) - depth(a))[0] ?? null
}

export function recordVisit(
  store: SupervisionStore,
  ctx: SupervisionContext,
  input: RecordVisitInput,
): SupervisionResult<SupervisionVisit> {
  const target = store.getTarget(input.targetId)
  if (target === null) return supervisionErr("UNKNOWN_TARGET", input.targetId)
  if (!target.active) return supervisionErr("TARGET_INACTIVE", target.id)

  // لا زيارةَ لم تقع بعد — الزيارةُ شهادةُ حضورٍ لا وعدٌ به.
  if (input.visitedAt.getTime() > ctx.now.getTime()) {
    return supervisionErr("FUTURE_DATED", target.id)
  }
  if (input.core.attendees <= 0) return supervisionErr("NON_POSITIVE_ATTENDEES", target.id)
  if (input.core.ratingPct < RATING_MIN || input.core.ratingPct > RATING_MAX) {
    return supervisionErr("INVALID_RATING", String(input.core.ratingPct))
  }

  // ق-١٠٠: مطابقةٌ تامّةُ الطرفين — نصفُ نموذجٍ لا يُخزَّن أصلاً.
  if (!matchesForm(target.curriculum, input.details)) {
    return supervisionErr("WRONG_FORM_FIELDS", target.curriculum)
  }

  // ق-١٦/ق-١٧: المرساةُ تُشتقّ — والزائرُ خارج شجرة الهدف مردودٌ هنا كما رُدّ في الخادم.
  if (ctx.actorScopePaths.length === 0) return supervisionErr("NO_SUPERVISION_SCOPE", target.path)
  const anchor = supervisorAnchorFor(ctx.actorScopePaths, target.path)
  if (anchor === null) return supervisionErr("OUT_OF_SUPERVISION_SCOPE", target.path)

  const zone = settingText(ctx, "time.zone", target.path)

  return store.transaction(() => {
    const id = store.nextId("vst")
    const visit: SupervisionVisit = {
      tenantId: store.tenantId,
      id,
      targetId: target.id,
      targetPath: target.path,
      curriculum: target.curriculum,
      supervisorPath: anchor,
      dayKey: dayKeyIn(input.visitedAt, zone),
      visitedAt: input.visitedAt,
      core: Object.freeze({ ...input.core }),
      details: Object.freeze({ ...input.details }),
      byPersonId: ctx.actorPersonId,
    }
    store.saveVisit(visit)
    return supervisionOk(store.getVisit(id)!)
  })
}
