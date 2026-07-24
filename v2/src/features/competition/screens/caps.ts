/**
 * قشرةُ القدرات المحسوبة على الخادم — `SPEC_authorization` §٤.٥ (**الواجهةُ تعرض ولا تقرر**).
 *
 * **خمسُ قدراتٍ لا سادسةَ لها** — وهي عينُ ما يعلنه عقدُ الوحدة §٢، ولا قدرةَ شخصيةَ فيها:
 * فالمسابقةُ **كيانُ وحدةٍ لا كيانُ شخص**، وكلُّ سؤالٍ هنا سؤالُ نطاقٍ للمحرّك.
 *
 * **وقدرتا «ذ» تُحسبان على مسجد الصفحة بعينه**: `enroll.approve` و`score.record` نطاقُهما
 * مطابقةٌ تامّة، فيُسألان بنطاق المسجد لا بنطاقٍ أعلى — ولو سُئلتا بنطاقٍ أوسع لأجاب المحرّك
 * «لا» لمالكهما الحقيقيّ، **ولاختفى بابُ الأمير عن صاحبه**.
 */

import { can, type Actor, type DecisionContext } from "../../../authorization/can.js"
import { unitScope } from "../../../authorization/scope.js"
import type { CapId } from "../../../authorization/generated/capabilities.generated.js"

export const SCREEN_SURFACE_CAPS: readonly CapId[] = Object.freeze([
  "competition.view",
  "competition.manage",
  "competition.enroll.approve",
  "competition.score.record",
  "competition.result.declare",
])

export function computeCompetitionCaps(
  actor: Actor,
  scopePath: string,
  ctx: DecisionContext,
): ReadonlySet<CapId> {
  const granted = new Set<CapId>()
  for (const cap of SCREEN_SURFACE_CAPS) {
    if (can(actor, cap, unitScope(scopePath), ctx).allowed) granted.add(cap)
  }
  return granted
}
