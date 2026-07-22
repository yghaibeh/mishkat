/**
 * ق-٩٣ + ب-٣٦أ — **رابطُ وليّ الأمر** (عقدُ الوحدة §٨).
 *
 * أربعةُ ثوابتٍ يفرضها هذا الملفّ، كلٌّ يقفل عطباً موثّقاً:
 *  ١. **لا يكشف إلا طالبَه**: الحلُّ يعيد **سجلَّ ذلك التسجيل وحده** — لا زملاءَ ولا إحصاءَ
 *     حلقةٍ ولا اسمَ معلّم. وهو مِقبضٌ يفتح بيانات **قاصر** بلا جلسةٍ ولا دور، فضيقُه شرط.
 *  ٢. **يموت بالأرشفة** (ق-٩٣ نصاً) — **بنيوياً**: يُسأل نموذجُ الحلقة لحظةَ الحلّ، فلا حقلَ
 *     حالةٍ يُنسى تحديثُه ولا مهمّةٌ مجدوَلة تتأخّر.
 *  ٣. **عمرٌ معلن وتجديدٌ بزرّ** (ب-٣٦أ) — يقفل م-١٢ («رمزٌ بلا انتهاءٍ ولا تدوير»)،
 *     والعمرُ والإتاحةُ **إعدادان حيّان** لا رقمان صلبان (قب-٦/G14).
 *  ٤. **الإلغاءُ وسمٌ لا محو** (المادة ٧/٤) — فالتاريخُ يبقى ويُقرأ.
 *
 * **وقب-١٩ محفوظ**: تأجيلُ سياسة بيانات القُصَّر تأجيلٌ واعٍ مسجَّل — وهذه الوحدةُ لا توسّع
 * السطحَ المكشوف: ما يُرى بالرمز **أضيقُ** مما كان في v1، ولا يُضاف إليه شيء.
 */

import type { CircleLogStore } from "../data/store.js"
import { settingBoolean, settingNumber, type CircleLogContext } from "./context.js"
import { studentRecordView, type StudentRecordView } from "./derive.js"
import { logErr, logOk, type GuardianLink, type DayLogResult } from "../types.js"

/** انقضاءُ العمر **بحساب التقويم** لا بضرب ميلي ثانية — فيسلم من الصيف والكبس. */
function expiryFrom(at: Date, days: number): Date {
  const end = new Date(at.getTime())
  end.setUTCDate(end.getUTCDate() + days)
  return end
}

function ttlDays(ctx: CircleLogContext, unitPath: string): number {
  return settingNumber(ctx, "edu.guardian_token.ttl_days", unitPath)
}

/** الحالةُ **مشتقّةٌ لا مخزَّنة**: ملغىً أوّلاً (قرارٌ)، ثم منتهٍ (زمن) — والترتيبُ مقصود. */
function statusOf(link: GuardianLink, now: Date): "revoked" | "expired" | "active" {
  if (link.revokedAt !== null) return "revoked"
  return link.expiresAt.getTime() <= now.getTime() ? "expired" : "active"
}

export type IssueLinkInput = {
  readonly circleId: string
  readonly enrollmentId: string
}

/** **رابطٌ حيٌّ واحدٌ لكل تسجيل** — والثاني يُردّ بسببٍ مميِّز، فلا يتكاثر مِقبضٌ مكشوف. */
export function issueLink(
  store: CircleLogStore,
  ctx: CircleLogContext,
  input: IssueLinkInput,
): DayLogResult<GuardianLink> {
  const circle = ctx.circles.circleOf(input.circleId)
  if (circle === null) return logErr("UNKNOWN_CIRCLE", input.circleId)
  if (circle.archived) return logErr("CIRCLE_ARCHIVED", input.circleId)
  const enrolled = ctx.circles.enrollmentsOf(circle.id).some((e) => e.id === input.enrollmentId)
  if (!enrolled) return logErr("ENROLLMENT_NOT_IN_CIRCLE", input.enrollmentId)

  const live = store
    .links()
    .find((l) => l.enrollmentId === input.enrollmentId && statusOf(l, ctx.now) === "active")
  if (live !== undefined) return logErr("LINK_ALREADY_ACTIVE", live.id)

  const link: GuardianLink = {
    tenantId: store.tenantId,
    id: store.nextId("glink"),
    token: ctx.newToken(),
    enrollmentId: input.enrollmentId,
    circleId: circle.id,
    issuedAt: ctx.now,
    expiresAt: expiryFrom(ctx.now, ttlDays(ctx, circle.unitPath)),
    revokedAt: null,
  }
  store.saveLink(link)
  return logOk(link)
}

/**
 * **زرُّ التجديد** (ب-٣٦أ) — يمدّ العمرَ **من لحظته** فيُحيي منتهياً؛ ولا يُحيي **ملغىً**:
 * الإلغاءُ قرارٌ لا انقضاءُ زمن، ونقضُه بابُه إصدارٌ جديد لا تجديد.
 */
export function renewLink(
  store: CircleLogStore,
  ctx: CircleLogContext,
  input: { readonly linkId: string },
): DayLogResult<GuardianLink> {
  const link = store.getLink(input.linkId)
  if (link === null) return logErr("UNKNOWN_LINK", input.linkId)
  if (link.revokedAt !== null) return logErr("LINK_REVOKED", input.linkId)

  const circle = ctx.circles.circleOf(link.circleId)
  if (circle === null) return logErr("UNKNOWN_CIRCLE", link.circleId)
  if (!settingBoolean(ctx, "edu.guardian_token.renewable", circle.unitPath)) {
    return logErr("RENEWAL_DISABLED", input.linkId)
  }

  const renewed: GuardianLink = {
    ...link,
    expiresAt: expiryFrom(ctx.now, ttlDays(ctx, circle.unitPath)),
  }
  store.saveLink(renewed)
  return logOk(renewed)
}

/** **الإلغاءُ وسمٌ لا محو** — والملغى مرةً لا يُلغى ثانية. */
export function revokeLink(
  store: CircleLogStore,
  ctx: CircleLogContext,
  input: { readonly linkId: string },
): DayLogResult<GuardianLink> {
  const link = store.getLink(input.linkId)
  if (link === null) return logErr("UNKNOWN_LINK", input.linkId)
  if (link.revokedAt !== null) return logErr("LINK_REVOKED", input.linkId)

  const revoked: GuardianLink = { ...link, revokedAt: ctx.now }
  store.saveLink(revoked)
  return logOk(revoked)
}

/** ملخّصُ رابطٍ للعرض — **بلا الرمز نفسِه**: يُسلَّم مرةً عند الإصدار ولا يُعاد كشفُه. */
export type LinkSummary = {
  readonly id: string
  readonly enrollmentId: string
  readonly circleId: string
  readonly issuedAt: Date
  readonly expiresAt: Date
  readonly active: boolean
  readonly expired: boolean
  readonly revoked: boolean
}

export function linksOfCircle(
  store: CircleLogStore,
  ctx: CircleLogContext,
  circleId: string,
): readonly LinkSummary[] {
  return store
    .links()
    .filter((l) => l.circleId === circleId)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((l) => {
      const status = statusOf(l, ctx.now)
      return {
        id: l.id,
        enrollmentId: l.enrollmentId,
        circleId: l.circleId,
        issuedAt: l.issuedAt,
        expiresAt: l.expiresAt,
        active: status === "active",
        expired: status === "expired",
        revoked: status === "revoked",
      }
    })
}

/** ما يراه وليُّ الأمر — **طالبُه وحده**، سجلاً مشتقّاً لحظةَ السؤال (§٩). */
export type GuardianStudentView = {
  readonly enrollmentId: string
  readonly nameAr: string
  readonly record: StudentRecordView
}

/**
 * **حلُّ الرمز** — أضيقُ سطحٍ في الوحدة، وترتيبُ حرّاسه ملزم:
 * مجهولٌ ⟵ ملغىً ⟵ منتهٍ ⟵ **حلقةٌ مؤرشفةٌ (موتٌ بنيويّ)** ⟵ ثم السجلُّ نفسُه.
 */
export function resolveGuardianToken(
  store: CircleLogStore,
  ctx: CircleLogContext,
  token: string,
): DayLogResult<GuardianStudentView> {
  const link = store.linkByToken(token)
  if (link === null) return logErr("UNKNOWN_LINK")

  const status = statusOf(link, ctx.now)
  if (status === "revoked") return logErr("LINK_REVOKED", link.id)
  if (status === "expired") return logErr("LINK_EXPIRED", link.id)

  const circle = ctx.circles.circleOf(link.circleId)
  if (circle === null || circle.archived) return logErr("LINK_DEAD", link.id)

  const record = studentRecordView(store, ctx, {
    circleId: link.circleId,
    enrollmentId: link.enrollmentId,
  })
  if (!record.ok) return record

  return logOk({
    enrollmentId: record.value.enrollmentId,
    nameAr: record.value.nameAr,
    record: record.value,
  })
}
