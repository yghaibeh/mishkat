/**
 * **التأهيلُ والإعلانُ المختوم** — عقدُ الوحدة §٨ (قب-٤٥: «يُنشَر ولا يُكشَف»).
 *
 * **الإعلانُ دفعٌ باتجاهٍ واحد**: يُنتج **مقتطفاً مجمَّداً نسخةً لا مرجعاً**، ويُغلق المسابقة،
 * ويُرفق الجوائزَ المعلنة — **بلا مستحقٍّ ولا قيدٍ ولا قدرةٍ مالية**. ولا يوجد في النظام
 * **منفذُ قراءةٍ عامٌّ** له: القائمةُ البيضاء عضوان وكلاهما كاتب ⇒ **الطريقُ غيرُ موجود لا
 * محروس**، وهو أقوى من أيّ حارس.
 *
 * **والفائزُ نتيجةٌ لا اختيار**: يُشتقّ من الترتيب النهائيّ داخل كل فئة. ولا تأهيلَ يدويٌّ
 * بلا معيار — ولو أراد قائدٌ استثناءً فبمسار `records.correct` المدقَّق الظاهر (قب-٩).
 *
 * **والمقتطفُ هو الرقمُ الوحيدُ المحفوظُ في الوحدة** — استثناءٌ **يوجبه** قب-٤٥ لا يخالفه:
 * فبلا تجميدٍ يتغيّر جدولُ الفائزين بأيّ إعادة حساب، وهو عينُ ما جاء المبدأُ ليمنعه.
 */

import type { CompetitionStore } from "../data/store.js"
import type { CompetitionContext } from "./context.js"
import { liveCompetition } from "./competitions.js"
import { categoriesOf } from "./enrollment.js"
import { leaderboard } from "./derive.js"
import {
  competitionErr,
  competitionOk,
  type Award,
  type CompetitionResult,
  type Contestant,
  type Stage,
} from "../types.js"

/** صفٌّ **مجمَّدٌ** في المقتطف — نسخةُ رقمٍ لا مرجعٌ يُعاد حسابه. */
export type SealedRow = {
  readonly contestantId: string
  readonly categoryId: string
  readonly mosquePath: string
  readonly rank: number
  readonly points: number
}

/** المقتطفُ المختوم — **يُكتب مرّةً ولا يُمسّ**، ولا دالةَ تُحدِّثه بعد ختمه. */
export type ResultAnnouncement = {
  readonly tenantId: string
  readonly competitionId: string
  readonly declaredBy: string
  readonly declaredAt: Date
  readonly rows: readonly SealedRow[]
  readonly awards: readonly Award[]
}

/** كم يصعد من فئةٍ عدُّها كذا؟ — **المعيارُ بياناتٌ**، وحسابُه هنا بلا فرعٍ لكل نوع نشاط. */
function takeCount(stage: Stage, total: number): number {
  const take = stage.advancement.take
  if ("topN" in take) return Math.min(take.topN, total)
  if ("topPercent" in take) return Math.min(Math.ceil((total * take.topPercent) / 100), total)
  return total
}

/**
 * **تنفيذُ معيار الصعود المعلَن** — فعلٌ واحدٌ ذرّيٌّ يُنتج قائمةَ الصاعدين ويُثبِّتها،
 * و**تنفيذُه مرّتين ممنوع** بوسم `executedAt` (فلا تُبنى قائمتان لمرحلةٍ واحدة).
 *
 * و`minScore` معيارٌ **بالرصيد لا بالعدد**، و`perMosqueCap` **عدالةٌ جغرافية** اختياريّة:
 * بلا سقفٍ قد تحتكر نهائيَّ الشبكة مساجدُ ثلاثة فينسحب الباقون (ق-م-٩).
 */
export function runAdvancement(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: { readonly stageId: string },
): CompetitionResult<readonly Contestant[]> {
  const stage = store.getStage(input.stageId)
  if (stage === null) return competitionErr("UNKNOWN_STAGE", input.stageId)
  if (stage.executedAt !== null) return competitionErr("ALREADY_DECIDED", stage.id)

  const found = liveCompetition(store, stage.competitionId)
  if (!found.ok) return found
  const competition = found.value
  if (competition.status === "closed" || competition.status === "cancelled") {
    return competitionErr("COMPETITION_CLOSED", competition.status)
  }

  const advanced: Contestant[] = []
  const take = stage.advancement.take
  for (const category of categoriesOf(store, competition.id)) {
    const rows = leaderboard(store, competition.id, category.id)
    const eligible =
      "minScore" in take ? rows.filter((r) => r.points >= take.minScore) : rows
    const limit = "minScore" in take ? eligible.length : takeCount(stage, eligible.length)

    const perMosque = new Map<string, number>()
    for (const row of eligible) {
      if (advancedCountFor(category.id, advanced, store) >= limit) break
      const cap = stage.advancement.perMosqueCap
      if (cap !== undefined) {
        const used = perMosque.get(row.mosquePath) ?? 0
        if (used >= cap) continue
        perMosque.set(row.mosquePath, used + 1)
      }
      const contestant = store.getContestant(row.contestantId)
      if (contestant === null) continue
      const promoted: Contestant = { ...contestant, status: "advanced" }
      store.saveContestant(promoted)
      advanced.push(promoted)
    }
  }

  store.saveStage({ ...stage, executedAt: ctx.now })
  return competitionOk(advanced)
}

function advancedCountFor(
  categoryId: string,
  advanced: readonly Contestant[],
  store: CompetitionStore,
): number {
  void store
  return advanced.filter((c) => c.categoryId === categoryId).length
}

/**
 * **الإعلانُ المختوم** — أثرُه ثلاثة: مقتطفٌ مجمَّد · إغلاقُ المسابقة · إرفاقُ الجوائز.
 * **ولا رجعةَ فيه**: إعلانٌ ثانٍ يُردّ، والرصدُ بعده مرفوضٌ لأنّ المسابقةَ صارت مغلقة —
 * والتصحيحُ بمسار `records.correct` المدقَّق **خارج هذه الوحدة** (قب-٩) لا بفتحٍ خلفيّ.
 */
export function declareResults(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: { readonly competitionId: string },
): CompetitionResult<ResultAnnouncement> {
  const found = liveCompetition(store, input.competitionId)
  if (!found.ok) return found
  const competition = found.value

  if (store.getAnnouncement(competition.id) !== null) {
    return competitionErr("ALREADY_DECLARED", competition.id)
  }
  // **لا يُعلَن على مسودةٍ ولا ملغاةٍ ولا مغلقة** — الإعلانُ يُتوِّج برنامجاً جرى فعلاً.
  if (competition.status !== "running" && competition.status !== "qualifying") {
    return competitionErr("NOT_QUALIFYING", competition.status)
  }

  const rows: SealedRow[] = []
  for (const category of categoriesOf(store, competition.id)) {
    for (const row of leaderboard(store, competition.id, category.id)) {
      rows.push({
        contestantId: row.contestantId,
        categoryId: category.id,
        mosquePath: row.mosquePath,
        rank: row.rank,
        points: row.points,
      })
    }
  }

  const announcement: ResultAnnouncement = {
    tenantId: store.tenantId,
    competitionId: competition.id,
    declaredBy: ctx.actorPersonId,
    declaredAt: ctx.now,
    // **نسخةٌ مجمَّدة**: صفوفٌ محسوبةٌ الآن ومحفوظةٌ كما هي — لا مراجعُ تُقرأ لاحقاً.
    rows: Object.freeze([...rows]),
    awards: Object.freeze(store.awards().filter((a) => a.competitionId === competition.id)),
  }
  store.sealAnnouncement(announcement)
  store.saveCompetition({ ...competition, status: "closed" })
  return competitionOk(announcement)
}
