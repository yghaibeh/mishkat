/**
 * ق-٥٠ — الترحيل الآلي للأحداث: **idempotent · واعٍ بالعكس · غير حرج**
 * (`SPEC_finance_ledger` §٣).
 *
 * الوحدةُ صاحبةُ الحدث **لا تكتب في الدفتر**: تسلّم النواةَ حدثاً، والنواةُ تُنتج القيد —
 * فمصدرُ الحقيقة واحد. ومفتاحُ التكرار **طبيعيٌّ معلَن** (`النوع:المعرّف`) لا رقمٌ عشوائيّ.
 */

import { ROOT_PATH } from "../../../authorization/scope.js"
import { postJournal, reverseEntry, type LedgerContext } from "./journal.js"
import { ok } from "../types.js"
import type {
  JournalEntry,
  LedgerError,
  LedgerErrorCode,
  LineInput,
  Result,
  SourceType,
} from "../types.js"
import type { LedgerStore } from "../data/store.js"

export type LedgerEvent = {
  readonly sourceType: SourceType
  readonly sourceId: string
  readonly at: Date
  readonly unitId: string
  readonly memoAr: string
  readonly lines: readonly LineInput[]
}

export type PostedEvent = { readonly entry: JournalEntry; readonly duplicated: boolean }

export type SafePosting =
  | { readonly posted: true; readonly entry: JournalEntry }
  | { readonly posted: false; readonly code: LedgerErrorCode }

/** سببُ العكس عند إعادة الترحيل — يدخل سجل التدقيق فيُقرأ لاحقاً ولا يُخمَّن. */
const REPOST_REASON = "تعديلُ الحدث الأصليّ — عكسٌ ثم ترحيلٌ بنفس المفتاح (ق-٥٠)"

/** **تعريفُ مفتاح التكرار صراحةً** (§٣.٢): معرّفُ الحدث في وحدته، لا طابعٌ زمنيّ ولا عشوائيّ. */
export function postingKeyOf(event: LedgerEvent): string {
  return `${event.sourceType}:${event.sourceId}`
}

/** يُجهض المعاملةَ حاملاً خطأَ العمل — فيرتدّ كلُّ شيء ثم يُعاد الخطأ **قيمةً لا رمية**. */
class RepostAbort extends Error {
  constructor(readonly failure: LedgerError) {
    super(failure.code)
    this.name = "RepostAbort"
  }
}

/**
 * idempotent: تكرارُ الحدث نفسه **لا يزدوج** — يعيد القيدَ القائم موسوماً بالتكرار.
 * والفرضُ الحقيقيّ في طبقة البيانات (`DUPLICATE_POSTING_KEY`)، فالسباقُ لا يفلت.
 */
export function postEvent(
  store: LedgerStore,
  ctx: LedgerContext,
  event: LedgerEvent,
): Result<PostedEvent> {
  const key = postingKeyOf(event)
  const activeId = store.activePostingEntryId(key)
  if (activeId !== null) {
    const existing = store.getEntry(activeId)
    if (existing !== null) return ok({ entry: existing, duplicated: true })
  }
  const posted = postJournal(store, ctx, { ...event, postingKey: key })
  if (!posted.ok) return posted
  return ok({ entry: posted.value, duplicated: false })
}

/**
 * الوعيُ بالعكس (§٣.٣): تعديلُ حدثٍ = **عكسُ القديم ثم ترحيلُ الجديد بنفس المفتاح** —
 * **ذرّيةً واحدة**: فشلُ الجديد لا يترك القديمَ معكوساً.
 */
export function repostEvent(
  store: LedgerStore,
  ctx: LedgerContext,
  event: LedgerEvent,
): Result<JournalEntry> {
  const key = postingKeyOf(event)
  try {
    return store.transaction(() => {
      const activeId = store.activePostingEntryId(key)
      if (activeId !== null) {
        const reversed = reverseEntry(store, ctx, activeId, REPOST_REASON)
        if (!reversed.ok) throw new RepostAbort(reversed.error)
      }
      const posted = postJournal(store, ctx, { ...event, postingKey: key })
      if (!posted.ok) throw new RepostAbort(posted.error)
      return ok(posted.value)
    })
  } catch (e) {
    if (e instanceof RepostAbort) return { ok: false, error: e.failure }
    throw e
  }
}

/**
 * **غيرُ حرج** (§٣.٤): الترحيلُ التابع لحدثٍ سُجِّل أصلاً **لا يرمي أبداً** — فشلُه يُدوَّن
 * ولا يُفشل الحدث. والدفترُ يُصلَّح لاحقاً بردمٍ **بنفس المفتاح** فلا يزدوج.
 */
export function postEventSafely(
  store: LedgerStore,
  ctx: LedgerContext,
  event: LedgerEvent,
): SafePosting {
  let code: LedgerErrorCode = "POSTING_FAILED"
  try {
    const posted = postEvent(store, ctx, event)
    if (posted.ok) return { posted: true, entry: posted.value.entry }
    code = posted.error.code
  } catch {
    // حتى الخطأ البرمجيّ لا يُسقط العملية الأصلية — يُدوَّن ويمضي الحدث.
    code = "POSTING_FAILED"
  }
  try {
    store.audit.append({
      at: ctx.now,
      actorPersonId: ctx.actorPersonId,
      action: "ledger.post.failed",
      // **الاستثناءُ المُعلَنُ الوحيد**: هدفُه مفتاحُ ترحيلٍ لا كيان، والترحيلُ لم يقع
      // فلا وحدةَ تُقال (§٣.٤). يُوجَّه إلى جذر الشبكة **موسوماً** لا مُموَّهاً، وقائمتُه
      // محروسةٌ بـ`toEqual` فلا تنمو صامتةً — والصمتُ هو الثغرة لا الاستثناء.
      unitPath: ROOT_PATH,
      capability: null,
      targetType: "postingKey",
      targetId: postingKeyOf(event),
      reason: code,
    })
  } catch {
    // التدوينُ نفسُه لا يُسقط العملية الأصلية.
  }
  return { posted: false, code }
}
