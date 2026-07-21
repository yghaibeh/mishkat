/**
 * ب-٤٣/ع-١٨ — **إدارةُ لجنةٍ أغنى**، وق-١٣ في شقّه الاشتقاقيّ (عقدُ الوحدة §٣).
 *
 * طلبُ الميدان نصاً (ع-١٨): «داخل صفحة لجنتي المفروض تكون الإدارة أكثر من هيك: يكتب **عدد
 * الشباب المشاركين معه، وأسماءهم، وتاريخ إنجاز النشاط**». والأسماءُ **حرّةٌ** حفاظاً على
 * الخصوصية (ق-٣١) — فلا معرّفَ شخصٍ في النشاط ولا حسابَ يُنشأ له.
 *
 * **وحدُّ هذا الملفّ من ق-١٣ هو الاشتقاق وحده**: `mosqueRecordContribution` تُخبر «كم أضافت
 * لجانُ هذا المسجد في هذه الفترة» بشرط أن تكون اللجنةُ ضمن **المُقرّ**؛ و«ما أُقرّ» يصلها
 * **مُعطىً من خارج الوحدة** (سلسلةُ محرّك الاعتماد). فليس هنا حالةُ اعتمادٍ ولا فحصُ
 * «مَن يعتمد؟» ولا قدرةُ اعتمادٍ — **صفر منطق اعتماد** (G22)، والقاعدةُ الواحدة في موضعها.
 *
 * **وصفر رقمٍ مخزَّن**: المساهمةُ **حسابٌ على الأنشطة لحظتَه** لا حقلُ مجموعٍ يُحدَّث (نظيرُ
 * ق-٦٠ في الصندوق) — فلا يتباعد رقمٌ عن مصدره أبداً (ج٥: انفصامُ الكتابة عن القراءة).
 */

import type { CommitteeStore } from "../data/store.js"
import { contains } from "../../../authorization/scope.js"
import { areCommitteesEnabled, isFutureDatingAllowed, type CommitteeContext } from "./context.js"
import { err, ok, type CommitteeActivity, type Result } from "../types.js"

export type RecordActivityInput = {
  readonly committeeId: string
  readonly periodId: string
  readonly titleAr: string
  /** عددُ الشباب المشاركين (ع-١٨) — إلزاميّ. */
  readonly participantCount: number
  /** أسماؤهم **حرّةً** واختياريةً (ق-٣١): الخصوصيةُ تسمح بالعدد بلا أسماء، لا بالعكس. */
  readonly participantNamesAr: readonly string[]
  readonly completedAt: Date
}

export function recordActivity(
  store: CommitteeStore,
  ctx: CommitteeContext,
  input: RecordActivityInput,
): Result<CommitteeActivity> {
  const committee = store.getCommittee(input.committeeId)
  if (committee === null) return err("COMMITTEE_NOT_FOUND", input.committeeId)
  if (!areCommitteesEnabled(ctx, committee.mosquePath)) {
    return err("MODULE_DISABLED", "feature.committees")
  }
  if (!committee.active) return err("COMMITTEE_INACTIVE", committee.id)
  if (input.titleAr.trim().length === 0) return err("EMPTY_ACTIVITY_TITLE", committee.id)
  if (input.participantCount < 0) return err("NEGATIVE_PARTICIPANTS", committee.id)

  const names = input.participantNamesAr.map((n) => n.trim()).filter((n) => n.length > 0)
  // **لا يتناقض سطران**: الأسماءُ إن ذُكرت وجب أن تطابق العدد — وإلا فرقمٌ يكذّب قائمة (ج٧).
  if (names.length > 0 && names.length !== input.participantCount) {
    return err("PARTICIPANT_COUNT_MISMATCH", committee.id)
  }

  // ق-٤٥/قب-٦: قبولُ التأريخ المستقبليّ **إعدادٌ حيّ** — لا حكمَ صلبٌ في الكود.
  if (
    input.completedAt.getTime() > ctx.now.getTime() &&
    !isFutureDatingAllowed(ctx, committee.mosquePath)
  ) {
    return err("FUTURE_COMPLETION_DATE", committee.id)
  }

  return store.transaction(() => {
    const activity: CommitteeActivity = {
      tenantId: store.tenantId,
      id: store.nextId("cma"),
      committeeId: committee.id,
      periodId: input.periodId,
      titleAr: input.titleAr.trim(),
      participantCount: input.participantCount,
      participantNamesAr: Object.freeze([...names]),
      completedAt: input.completedAt,
    }
    store.saveActivity(activity)
    return ok(store.getActivity(activity.id)!)
  })
}

/** أنشطةُ لجنةٍ في فترةٍ — مرتَّبةٌ حتمياً من المستودع. */
export function activitiesOf(
  store: CommitteeStore,
  committeeId: string,
  periodId: string,
): readonly CommitteeActivity[] {
  return store
    .activities()
    .filter((a) => a.committeeId === committeeId && a.periodId === periodId)
}

/** مساهمةُ لجان المسجد في سجلّه — **اشتقاقٌ** لا حقلٌ مخزَّن. */
export type CommitteeContribution = {
  readonly activityCount: number
  readonly participantCount: number
  /** اللجانُ التي دخلت فعلاً — بيانٌ ظاهرٌ لا رقمٌ صامت. */
  readonly committeeIds: readonly string[]
}

export type ContributionInput = {
  readonly mosquePath: string
  readonly periodId: string
  /**
   * اللجانُ **المُقرَّةُ** لهذه الفترة — تصل مُعطىً من سلسلة الاعتماد خارج الوحدة (ق-١٣).
   * الوحدةُ لا تعرف ما معنى «أُقرّ» ولا مَن يُقرّ: تعرف فقط **ما وصلها**.
   */
  readonly confirmedCommitteeIds: ReadonlySet<string>
}

export function mosqueRecordContribution(
  store: CommitteeStore,
  input: ContributionInput,
): CommitteeContribution {
  const eligible = store
    .committees()
    // عزلُ النطاق بالاحتواء (ق-١٧) — لا لجنةَ مسجدٍ آخر تدخل سجلَّ هذا المسجد.
    .filter((c) => contains(input.mosquePath, c.path))
    .filter((c) => input.confirmedCommitteeIds.has(c.id))
    .map((c) => c.id)

  const counted = store
    .activities()
    .filter((a) => a.periodId === input.periodId && eligible.includes(a.committeeId))

  return Object.freeze({
    activityCount: counted.length,
    participantCount: counted.reduce((sum, a) => sum + a.participantCount, 0),
    committeeIds: Object.freeze([...new Set(counted.map((a) => a.committeeId))].sort()),
  })
}
