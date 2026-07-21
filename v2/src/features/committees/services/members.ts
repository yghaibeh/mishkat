/**
 * ق-٣١ + ب-٤٣ — **أعضاءُ اللجنة أسماءٌ حرّةٌ بلا حسابات** (عقدُ الوحدة §٢).
 *
 * القاعدةُ مدفوعةُ الثمن: في v1 كان تعيينُ مسؤولِ لجنةٍ **يبحث في كلّ أشخاص النظام**، فكشف
 * أسماءَ من لا شأنَ للجنة بهم (ملاحظاتُ الخصوصية، ق-٣١). وفي v2 **يستحيل ذلك بالنوع**:
 * كيانُ العضو `CommitteeMember` **لا يحمل معرّفَ شخصٍ أصلاً**، فليس في هذا الملفّ ما يُنشئ
 * حساباً ولا ما يربط بواحد — وليس فيه استيرادٌ لوحدة التوفير أو دليل الأشخاص.
 *
 * ومَن احتاج حساباً فمسارُه معلنٌ في مكانٍ آخر: **`users.provision` في وحدة `org`** (ع-١٧) —
 * تمكينٌ مقصودٌ بقدرةٍ ونطاقٍ وتدقيق، لا أثرٌ جانبيٌّ لإضافة اسمٍ في لجنة.
 */

import type { CommitteeStore } from "../data/store.js"
import { areCommitteesEnabled, type CommitteeContext } from "./context.js"
import { err, ok, type CommitteeMember, type Result } from "../types.js"

export type AddMemberInput = {
  readonly committeeId: string
  /** اسمٌ نصّيٌّ حرّ — **ولا شيءَ غيرُه** (ق-٣١). */
  readonly nameAr: string
}

export function addMember(
  store: CommitteeStore,
  ctx: CommitteeContext,
  input: AddMemberInput,
): Result<CommitteeMember> {
  const committee = store.getCommittee(input.committeeId)
  if (committee === null) return err("COMMITTEE_NOT_FOUND", input.committeeId)
  if (!areCommitteesEnabled(ctx, committee.mosquePath)) {
    return err("MODULE_DISABLED", "feature.committees")
  }
  if (!committee.active) return err("COMMITTEE_INACTIVE", committee.id)
  if (input.nameAr.trim().length === 0) return err("EMPTY_MEMBER_NAME", committee.id)

  return store.transaction(() => {
    const member: CommitteeMember = {
      tenantId: store.tenantId,
      id: store.nextId("cmm"),
      committeeId: committee.id,
      nameAr: input.nameAr.trim(),
    }
    store.saveMember(member)
    return ok(member)
  })
}

/** أعضاءُ لجنةٍ بعينها — مرتَّبون حتمياً من المستودع. */
export function membersOf(store: CommitteeStore, committeeId: string): readonly CommitteeMember[] {
  return store.members().filter((m) => m.committeeId === committeeId)
}
