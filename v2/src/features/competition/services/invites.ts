/**
 * **رمزُ الدعوة** — القناةُ الثانية للالتحاق (قب-١٣ §٨، عقدُ الوحدة §٥-٢).
 *
 * **الرمزُ هو الهوية**: حاملُ الرابط **مصادَقٌ بالرمز** لا مجهولٌ على الإنترنت — فالقناةُ
 * **خارج القائمة البيضاء للمسارات العامة**، ولا تُعدّ في سقف G16، ولا تخضع لضوابط المجهول
 * في §٤-٣ بل **لضوابط الرمز** الأربعة: منسوبٌ لمُصدِره · منتهي الصلاحية · قابلٌ للإبطال ·
 * **أحاديُّ الاستعمال** (الاستهلاكُ في `enrollment.addByInvite`).
 *
 * **ومدةُ الصلاحية بيانٌ من المُصدِر لا عتبةٌ تشغيلية**: القائدُ يختار متى ينتهي رمزُه، فلا
 * يُخترع لها إعدادٌ في سجلٍّ مُجمَّد ولا رقمٌ صلبٌ في الكود (قب-٦، G14).
 */

import type { CompetitionStore } from "../data/store.js"
import type { CompetitionContext } from "./context.js"
import { scopesIntersect } from "./shared.js"
import { writableCompetition } from "./competitions.js"
import { competitionErr, competitionOk, type CompetitionResult, type Invite } from "../types.js"

export type IssueInviteInput = {
  readonly competitionId: string
  readonly mosquePath: string
  readonly expiresAt: Date
}

/**
 * **الإصدارُ فعلُ مَن يملك بتَّ الالتحاق على نطاقه** — تفرضه قدرةُ دالة الخادم ونطاقُها «ذ»؛
 * وهنا يُفرض ما بعدها: **مسجدُ الرمز داخل نطاق المسابقة** (والنطاقُ من الوحدة المخزَّنة).
 */
export function issueInvite(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: IssueInviteInput,
): CompetitionResult<Invite> {
  const found = writableCompetition(store, input.competitionId)
  if (!found.ok) return found
  const competition = found.value

  const unit = store.getUnitByPath(input.mosquePath)
  if (
    unit === null ||
    !scopesIntersect(competition.scopePath, unit.path) ||
    !unit.path.startsWith(competition.scopePath)
  ) {
    return competitionErr("MOSQUE_OUT_OF_COMPETITION_SCOPE", input.mosquePath)
  }
  // **رمزٌ وُلد منتهياً ليس رمزاً** — يُردّ عند الإصدار لا عند الاستعمال.
  if (input.expiresAt.getTime() <= ctx.now.getTime()) {
    return competitionErr("INVITE_EXPIRED", "صلاحيةٌ في الماضي")
  }

  const invite: Invite = {
    tenantId: store.tenantId,
    id: store.nextId("inv"),
    competitionId: competition.id,
    mosquePath: unit.path,
    issuedBy: ctx.actorPersonId,
    issuedAt: ctx.now,
    expiresAt: input.expiresAt,
    revokedAt: null,
    usedAt: null,
    usedByEnrollmentId: null,
  }
  store.saveInvite(invite)
  return competitionOk(invite)
}

/**
 * **الإبطال** — قابليةُ الإبطال شرطُ الرمز لا زينتُه (نظيرُ رمز وليّ الأمر). والإبطالُ
 * **لا يعكس أثراً وقع**: مَن التحق برمزٍ قبل إبطاله يبقى مشاركاً، فالأثرُ لا يُمحى.
 */
export function revokeInvite(
  store: CompetitionStore,
  ctx: CompetitionContext,
  input: { readonly inviteId: string },
): CompetitionResult<Invite> {
  const invite = store.getInvite(input.inviteId)
  if (invite === null) return competitionErr("UNKNOWN_INVITE", input.inviteId)
  if (invite.revokedAt !== null) return competitionErr("INVITE_REVOKED", invite.id)

  const revoked: Invite = { ...invite, revokedAt: ctx.now }
  store.saveInvite(revoked)
  return competitionOk(revoked)
}
