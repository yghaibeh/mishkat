/**
 * **الاشتقاقات** — عقدُ الوحدة §٧: *النقطةُ والرتبةُ **تُشتقّان لحظةَ السؤال**، وصفرُ عدّادٍ
 * مخزَّن* (ق-٩٢).
 *
 * v1 كانت لوحتُها تجلب **كلَّ** المشتركين و**كلَّ** نقاطهم إلى الذاكرة ثم تجمع وترتّب؛
 * والعلاجُ ليس عدّاداً مخزَّناً (فيتباعد عن واقعه كما تباعدت عدّاداتُ v1 في ع-١٩/ع-٢٩)، بل
 * **جمعٌ من الأحداث المخزَّنة** (ق-٤١) بمفتاحٍ طبيعيٍّ يمنع الازدواج. والرصيدُ المادّيُّ
 * قرارُ أداءٍ لطبقة D1 **ومعه مطابقتُه الليلية** — يلحق بموجة الهجرة، والعقدُ يشترط أصلاً
 * أنه «مشتقٌّ قابلٌ لإعادة البناء».
 *
 * كلُّ دالةٍ هنا **قراءةٌ محضة** — ولا تكتب حرفاً.
 */

import type { CompetitionStore } from "../data/store.js"
import { scopesIntersect } from "./shared.js"
import type { Competition, Contestant, ScoreEvent } from "../types.js"

/**
 * **قاعدةُ التقاطع** (§٦): تُعرض المسابقةُ للفاعل ⟺ **تشملني أو تحتي**. والفصلُ التامّ بين
 * القسمين (ق-٢٠) يسري بها **تلقائياً** — بلا فحصٍ جنسانيٍّ واحدٍ في الكود.
 */
export function visibleCompetitions(
  store: CompetitionStore,
  actorScopePath: string,
): readonly Competition[] {
  return store
    .competitions()
    .filter((c) => scopesIntersect(c.scopePath, actorScopePath))
    .sort((a, b) => a.scopePath.localeCompare(b.scopePath) || a.id.localeCompare(b.id))
}

/** أحداثُ متبارٍ — من المصدر الواحد، بلا تكرارٍ بنيوياً (مفتاحُ الخريطة هو الطبيعيّ). */
export function eventsOf(store: CompetitionStore, contestantId: string): readonly ScoreEvent[] {
  return store
    .scoreEvents()
    .filter((e) => e.contestantId === contestantId)
    .sort((a, b) => a.id.localeCompare(b.id))
}

/** متبارو مسابقةٍ داخل فئةٍ — **الترتيبُ يُحسب داخل الفئة دائماً**، والمنسحبُ يخرج منها. */
export function contestantsIn(
  store: CompetitionStore,
  competitionId: string,
  categoryId: string,
): readonly Contestant[] {
  return store
    .contestants()
    .filter(
      (c) =>
        c.competitionId === competitionId &&
        c.categoryId === categoryId &&
        (c.status === "active" || c.status === "advanced"),
    )
    .sort((a, b) => a.id.localeCompare(b.id))
}

/** رصيدٌ **محسوبٌ لا محفوظ** — ولذلك يعيش هنا بلا مقابلٍ في كيانٍ أو مستودع. */
export type Standing = {
  readonly contestantId: string
  readonly totalPoints: number
  /** رصيدُ الاختبارات — **كاسرُ التعادل الثاني** المعلن (§٧-٣). */
  readonly examPoints: number
  readonly excusedCount: number
  readonly joinedAt: Date
}

/**
 * **الرصيد = Σ (القيمة × وزنِ نسختها المثبَّتة)** — من الأحداث المخزَّنة لا من (عددٍ × وزنٍ
 * حاليّ) (ق-٤١). **والمعذورُ يُسجَّل ولا يُنقص**: عدُّه يظهر للشفافية ولا يُخصم من رصيده.
 */
export function standingOf(store: CompetitionStore, contestantId: string): Standing {
  const contestant = store.getContestant(contestantId)
  let totalPoints = 0
  let examPoints = 0
  let excusedCount = 0

  for (const event of eventsOf(store, contestantId)) {
    const version = store.getScoringType(event.typeVersionId)
    if (version === null) continue
    const points = event.value * version.weight
    totalPoints += points
    if (version.valueKind === "score") examPoints += points
    if (event.excuse === "excused") excusedCount += 1
  }

  return {
    contestantId,
    totalPoints,
    examPoints,
    excusedCount,
    joinedAt: contestant?.joinedAt ?? new Date(0),
  }
}

export type LeaderboardRow = {
  readonly contestantId: string
  readonly mosquePath: string
  readonly rank: number
  readonly points: number
  readonly examPoints: number
  readonly excusedCount: number
}

/**
 * **كاسراتُ التعادل معلنةٌ ومرتَّبة** (§٧-٣) — وآخرُها **المعرّف**، فلا تعادلَ يُحسم عشوائياً
 * أبداً (درسُ لا-حتمية `rateForMonth`، ق-٣٦): اللوحةُ نفسُها في كل تشغيلة.
 * الترتيب: الرصيد ← رصيدُ الاختبارات ← أقلُّ أعذار ← أسبقيةُ الالتحاق ← المعرّف.
 */
function compareStandings(a: Standing, b: Standing): number {
  if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints
  if (a.examPoints !== b.examPoints) return b.examPoints - a.examPoints
  if (a.excusedCount !== b.excusedCount) return a.excusedCount - b.excusedCount
  const byJoin = a.joinedAt.getTime() - b.joinedAt.getTime()
  if (byJoin !== 0) return byJoin
  return a.contestantId.localeCompare(b.contestantId)
}

/**
 * **لوحةُ الترتيب داخل الفئة** — والصفحةُ حجمُها إعدادٌ مسجَّل (`platform.page_size.default`)
 * لا رقمٌ صلب. والرتبةُ تُحسب على الترتيب المعلن لا على موضعٍ في مصفوفة.
 */
export function leaderboard(
  store: CompetitionStore,
  competitionId: string,
  categoryId: string,
  pageSize?: number,
): readonly LeaderboardRow[] {
  const ranked = contestantsIn(store, competitionId, categoryId)
    .map((c) => ({ contestant: c, standing: standingOf(store, c.id) }))
    .sort((a, b) => compareStandings(a.standing, b.standing))

  const rows = ranked.map((entry, index) => ({
    contestantId: entry.contestant.id,
    mosquePath: entry.contestant.mosquePath,
    rank: index + 1,
    points: entry.standing.totalPoints,
    examPoints: entry.standing.examPoints,
    excusedCount: entry.standing.excusedCount,
  }))
  return pageSize === undefined ? rows : rows.slice(0, pageSize)
}

/**
 * **رتبتي = عددُ مَن رصيدُهم أعلى منّي + ١** — لا تُحسب رتبُ الجميع (§٥-١): استعلامٌ عدّيٌّ
 * واحدٌ على الترتيب نفسِه، فكلفتُه لا تنمو بعدد المشتركين.
 */
export function rankOf(store: CompetitionStore, contestantId: string): number {
  const contestant = store.getContestant(contestantId)
  if (contestant === null) return 0
  const mine = standingOf(store, contestantId)
  const above = contestantsIn(store, contestant.competitionId, contestant.categoryId).filter(
    (other) => other.id !== contestantId && compareStandings(standingOf(store, other.id), mine) < 0,
  )
  return above.length + 1
}

/** نموذجُ صفٍّ في شاشة النطاق — **كلُّ رقمٍ فيه اشتقاقٌ** لا عدّادٌ يُقرأ (ق-١١١). */
export type CompetitionView = {
  readonly id: string
  readonly titleAr: string
  readonly scopePath: string
  readonly status: string
  readonly contestants: number
  readonly pendingEnrollments: number
}

export function viewOf(store: CompetitionStore, competition: Competition): CompetitionView {
  return {
    id: competition.id,
    titleAr: competition.titleAr,
    scopePath: competition.scopePath,
    status: competition.status,
    contestants: store.contestants().filter((c) => c.competitionId === competition.id).length,
    pendingEnrollments: store
      .enrollments()
      .filter((e) => e.competitionId === competition.id && e.state === "requested").length,
  }
}

export function viewsOf(
  store: CompetitionStore,
  competitions: readonly Competition[],
): readonly CompetitionView[] {
  return competitions.map((c) => viewOf(store, c))
}
