/**
 * ق-١٠١/ق-١٠٢ — **عدستان لا شاشةٌ واحدة** (عقدُ الوحدة §٤).
 *
 * سؤالُ القائد ليس سؤالَ المكلَّف: القائدُ يسأل «**كيف تقوم لي منطقتي؟**» فيُجاب بتجميعٍ
 * **بالوحدة التالية** مرتَّبٍ بالأسوأ ومعه **المسؤول باسمه**؛ والمكلَّفُ يسأل «مَن أزور اليوم؟»
 * فيُجاب بقائمة عملٍ مرتَّبةٍ بالحاجة. خلطُهما في شاشةٍ واحدةٍ بأرقامٍ خام هو ما رفضه المالك.
 *
 * و**قاعدةٌ واحدةٌ لا حالتان** («هل أصلحتَها للمدير فقط أم على جميع المستويات؟»): «الوحدةُ
 * التالية» تُشتقّ من المسار — مقطعٌ واحدٌ تحت نطاق الناظر — فيعمل التجميعُ من الجذر ومن القسم
 * ومن المنطقة بالشيفرة نفسِها، بلا فرعٍ لمستوىً بعينه.
 *
 * و**ق-١٠٢ بنيويّ**: كلُّ زيارةٍ تُعرض تخرج من هنا **مقرونةً بحُكمها** — الحقلُ يأتي من منفذ
 * الحكم لا من إدخالٍ يُنسى، فالمعتمَدُ بلا اسمِ معتمِدٍ **مستحيلٌ في هذه الطبقة**.
 */

import { ROOT_PATH, contains } from "../../../authorization/scope.js"
import type { SupervisionStore } from "../data/store.js"
import { targetStatuses } from "./cadence.js"
import type { SupervisionContext } from "./context.js"
import type {
  OverviewRow,
  SupervisionBoard,
  SupervisionVisit,
  TargetStatus,
  VisitRecord,
} from "../types.js"

/** النسبةُ المئوية — بقاعدة الصفر (ق-١١٢): لا قسمةَ على صفرٍ تُنتج «متميّزاً» وهماً. */
function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100)
}

/** عمقُ المسار — عددُ مقاطعه. */
function depth(path: string): number {
  return path.split("/").filter((segment) => segment.length > 0).length
}

/**
 * **الوحدةُ التالية** تحت نطاق الناظر: مقطعٌ واحدٌ لا أكثر.
 * `(/men/homs/, /men/homs/sq2/khalid/c1/)` ⟵ `/men/homs/sq2/`
 */
export function nextUnitUnder(scopePath: string, targetPath: string): string | null {
  if (!contains(scopePath, targetPath)) return null
  const base = scopePath === ROOT_PATH ? ROOT_PATH : scopePath
  const rest = targetPath.slice(base.length)
  const segment = rest.split("/").filter((s) => s.length > 0)[0]
  return segment === undefined ? null : `${base}${segment}/`
}

/** زياراتُ نطاقٍ **بالاحتواء** (ق-١٧) بالأحدث أولاً، كلٌّ بحُكمها (ق-١٠٢). */
export function visitsInScope(
  store: SupervisionStore,
  ctx: SupervisionContext,
  scopePath: string,
): readonly VisitRecord[] {
  const within = store.visits().filter((v) => contains(scopePath, v.targetPath))
  const ordered = [...within].sort((a: SupervisionVisit, b: SupervisionVisit) =>
    a.dayKey === b.dayKey ? b.id.localeCompare(a.id) : b.dayKey.localeCompare(a.dayKey),
  )
  return Object.freeze(ordered.map((visit) => ({ visit, verdict: ctx.verdictOf(visit.id) })))
}

/** **لوحةُ المكلَّف** (ق-١٠١): ما يستحقّ زيارةً مرتَّباً بالحاجة، وما زاره بحُكمه. */
export function supervisionBoard(
  store: SupervisionStore,
  ctx: SupervisionContext,
  scopePath: string,
): SupervisionBoard {
  return {
    scopePath,
    targets: targetStatuses(store, ctx, scopePath),
    recentVisits: visitsInScope(store, ctx, scopePath),
  }
}

/**
 * **العرضُ القياديّ** (ق-١٠١): «زار مشرفوها ن من م ضمن الدورة · المسؤول فلان» — والترتيبُ
 * **بالأسوأ** فيقرأ القائدُ أولَ سطرٍ فيعرف أين يتدخّل.
 */
export function supervisionOverview(
  store: SupervisionStore,
  ctx: SupervisionContext,
  scopePath: string,
): readonly OverviewRow[] {
  // **الوحدةُ الخاليةُ تظهر صفراً ولا تختفي** (ق-١١٢): «ما لم يُدخَل لا يُرى» مرضُ v1 — فوحدةٌ
  // لم تُسنَد إليها حلقةٌ أصلاً هي **أسوأُ الحالات** لا حالةٌ غيرُ موجودة. ولذلك تُبنى الصناديقُ
  // من **دليل الوحدات** أولاً ثم تُملأ بالأهداف.
  const groups = new Map<string, TargetStatus[]>()
  for (const unit of store.units()) {
    if (unit.path === scopePath) continue
    if (!contains(scopePath, unit.path)) continue
    if (depth(unit.path) !== depth(scopePath) + 1) continue
    groups.set(unit.path, [])
  }

  for (const status of targetStatuses(store, ctx, scopePath)) {
    const unitPath = nextUnitUnder(scopePath, status.path)
    if (unitPath === null) continue
    const bucket = groups.get(unitPath)
    if (bucket === undefined) groups.set(unitPath, [status])
    else bucket.push(status)
  }

  const rows: OverviewRow[] = []
  for (const [unitPath, statuses] of groups) {
    // «ضمن الدورة» لا مطلقاً: ما جاوز دورتَه ليس تغطيةً وإن زُوِّر يوماً.
    const visitedInCycle = statuses.filter((s) => s.status === "recent").length
    rows.push({
      unitPath,
      responsiblePersonId: ctx.responsibleOf(unitPath),
      targetCount: statuses.length,
      visitedInCycle,
      coveragePct: percent(visitedInCycle, statuses.length),
    })
  }

  return Object.freeze(
    rows.sort((a, b) => a.coveragePct - b.coveragePct || a.unitPath.localeCompare(b.unitPath)),
  )
}
