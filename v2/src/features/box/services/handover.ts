/**
 * ق-٦١ — **التسليمُ النازل بطرفين: قيدٌ واحدٌ ذرّيّ + إقرارُ المستلِم وحده**
 * (عقدُ الوحدة §٢.٣/§٢.٤، ويقفل خ-٧).
 *
 * ثلاثةُ ثوابتٍ تعيش هنا:
 *  ١. **لا مالَ معلّقٌ بين طرفين**: القيدُ الواحدُ ينقص المصدرَ ويزيد الوجهةَ في اللحظة نفسِها
 *     (نقدٌ إلى نقد). والإقرارُ **توثيقُ بصمتين** لا خطوةَ تحريكِ مال — فلا يبقى مالٌ في
 *     الهواء بين وحدتين إن تأخّر الإقرار.
 *  ٢. **نازلٌ حصراً**: الوجهةُ محتواةٌ في المصدر احتواءً **صارماً** — الصعودُ العكسيّ
 *     والوحدةُ الغريبة والتسليمُ للنفس كلُّها مرفوضة (السلسلةُ تتبع الشجرة).
 *  ٣. **المستلِمُ أمينٌ فعلاً**: يُسأل المحرّكُ عنه بالقدرة لا بالدور (ق-٥٩/G6)، فلا يُصطنع
 *     مستلِمٌ بلا عهدة يقرّ عن الأمين.
 *
 * > **لماذا نقدٌ إلى نقدٍ لا حسابُ مقاصّة؟** حسابُ المقاصّة في النواة وجهُ المسؤول الماليّ
 * > بين دفترين؛ وق-٦١ يقول نصاً «ينقص الأول ويزيد الثاني بقيد واحد». الفارقُ **معلنٌ**
 * > في عقد الوحدة §٢.٣ لا صامتٌ في الكود.
 */

import { contains } from "../../../authorization/scope.js"
import { ACCOUNT_ROLES } from "../../ledger/services/simpleFace.js"
import type { LedgerStore } from "../../ledger/data/store.js"
import type { Cents, CurrencyCode } from "../../ledger/types.js"
import { atomically, type BoxStore, type BoxStores } from "../data/store.js"
import { postBoxEvent } from "./operations.js"
import type { BoxContext } from "./context.js"
import {
  boxErr,
  boxOk,
  type BoxHandover,
  type BoxPosting,
  type BoxResult,
} from "../types.js"

export type HandoverInput = {
  readonly fromUnitId: string
  readonly toUnitId: string
  /** أمينُ الوجهة: هو **وحده** مَن يقرّ لاحقاً (خ-٧). */
  readonly toCustodianPersonId: string
  readonly operationId: string
  readonly memoAr: string
  readonly currency: string
  readonly amount: Cents
  readonly at?: Date
}

export type HandoverDone = {
  readonly posting: BoxPosting
  readonly handover: BoxHandover
}

export type AcknowledgeInput = {
  readonly handoverId: string
  readonly personId: string
}

/** يُجهض المعاملةَ حاملاً خطأَ العمل — فيرتدّ المستودعان ثم يُعاد الخطأُ **قيمةً لا رمية**. */
class HandoverAbort extends Error {
  constructor(readonly failure: BoxResult<never>) {
    super("handover-abort")
    this.name = "HandoverAbort"
  }
}

export function handoverDown(
  stores: BoxStores,
  ctx: BoxContext,
  input: HandoverInput,
): BoxResult<HandoverDone> {
  const from = stores.ledger.getUnit(input.fromUnitId)
  if (from === null) return boxErr("UNKNOWN_BOX_UNIT", input.fromUnitId)
  const to = stores.ledger.getUnit(input.toUnitId)
  if (to === null) return boxErr("UNKNOWN_BOX_UNIT", input.toUnitId)

  if (from.path === to.path) return boxErr("SAME_UNIT_HANDOVER", to.path)
  // **نازلٌ حصراً** — الاحتواءُ بشرط الشرطة الختامية (§١.٥): فلا `/men/r1/` يبلغ `/men/r10/`.
  if (!contains(from.path, to.path)) return boxErr("NOT_DESCENDANT_UNIT", to.path)

  // ق-٥٩ بالقدرة لا بالدور: المستلِمُ أمينُ الوجهة، وإلا فلا تسليم.
  if (!ctx.custody(input.toCustodianPersonId, to.path)) {
    return boxErr("NOT_RECEIVING_CUSTODIAN", input.toCustodianPersonId)
  }

  const common = { currency: input.currency, amount: input.amount }
  const at = input.at ?? ctx.now

  try {
    return atomically(stores, () => {
      const posted = postBoxEvent(stores.ledger, ctx, {
        sourceType: "handover",
        sourceId: input.operationId,
        at,
        unitId: input.fromUnitId,
        memoAr: input.memoAr,
        lines: [
          // ينقص الأول ويزيد الثاني — **بقيدٍ واحد** (ق-٦١).
          { accountId: ACCOUNT_ROLES.cash, unitId: input.toUnitId, side: "debit", ...common },
          { accountId: ACCOUNT_ROLES.cash, unitId: input.fromUnitId, side: "credit", ...common },
        ],
      })
      if (!posted.ok) throw new HandoverAbort(posted)

      const id = stores.box.nextId("hnd")
      stores.box.saveHandover({
        tenantId: stores.box.tenantId,
        id,
        entryId: posted.value.entryId,
        fromUnitPath: from.path,
        toUnitPath: to.path,
        toCustodianPersonId: input.toCustodianPersonId,
        handedOverBy: ctx.actorPersonId,
        at,
        acknowledgedBy: null,
        acknowledgedAt: null,
      })
      stores.ledger.audit.append({
        at: ctx.now,
        actorPersonId: ctx.actorPersonId,
        action: "box.handover",
        // **هذا هو ما تنبّأت به CR-027**: هدفُه سجلُّ تسليمٍ لا يعرفه الدفتر، فكان اشتقاقُ
        // نطاقه مستحيلاً. وبعد التوحيد **يُقال**: نطاقُه الوحدةُ المستلِمة (بها يُقرّ).
        unitPath: to.path,
        capability: null,
        targetType: "boxHandover",
        targetId: id,
        reason: null,
        // **لا حائزَ قبله**: التسليمُ يُنشأ الآن بانتظار إقرار المستلِم.
        before: null,
        after: handoverLabel(stores.box.getHandover(id)!),
      })
      return boxOk({ posting: posted.value, handover: stores.box.getHandover(id)! })
    })
  } catch (e) {
    if (e instanceof HandoverAbort) return e.failure
    throw e
  }
}

/**
 * لقطةُ حالِ التسليم — **الحائزُ وحالُ إقراره** (ق-٨٣ · CR-028): *«من كان يحوزها لا يضيع»*.
 * ولا مبلغَ فيها ولا عملة: **القيدُ هو مصدرُ كلِّ رقم** (ق-٦٠)، ولقطةٌ تحمل مبلغاً نسخةٌ ثالثة.
 */
function handoverLabel(handover: BoxHandover): string {
  return `${handover.toCustodianPersonId} \u00b7 ${handover.acknowledgedBy === null ? "pending" : `acknowledgedBy:${handover.acknowledgedBy}`}`
}

/**
 * **الإقرارُ للمستلِم وحده** (خ-٧): الحارسُ الأول نطاقٌ **شخصيّ** على دالة الخادم، وهذا
 * حارسٌ ثانٍ في العمق — فلا يمرّ إقرارٌ بالنيابة من أيّ مسار، ولو عبر استدعاءٍ داخليّ.
 */
export function acknowledgeHandover(
  stores: BoxStores,
  ctx: BoxContext,
  input: AcknowledgeInput,
): BoxResult<BoxHandover> {
  const handover = stores.box.getHandover(input.handoverId)
  if (handover === null) return boxErr("HANDOVER_NOT_FOUND", input.handoverId)
  if (handover.acknowledgedBy !== null) return boxErr("ALREADY_ACKNOWLEDGED", input.handoverId)
  if (handover.toCustodianPersonId !== input.personId) {
    return boxErr("NOT_RECEIVING_CUSTODIAN", input.personId)
  }

  stores.box.saveHandover({
    ...handover,
    acknowledgedBy: input.personId,
    acknowledgedAt: ctx.now,
  })
  stores.ledger.audit.append({
    at: ctx.now,
    actorPersonId: input.personId,
    action: "box.handover.acknowledge",
    unitPath: handover.toUnitPath,
    capability: null,
    targetType: "boxHandover",
    targetId: handover.id,
    reason: null,
    // **انتقالُ حيازةٍ صريح** — وهو نصُّ ق-٨٣ حرفياً: بانتظارِ إقرارٍ ⟵ مُقَرٌّ بيدِ فلان.
    before: handoverLabel(handover),
    after: handoverLabel(stores.box.getHandover(handover.id)!),
  })
  return boxOk(stores.box.getHandover(handover.id)!)
}

/** «ما ينتظر إقراري» — تسليماتُ الشخص وحده، بالملكية لا بالنطاق (§١.١). */
export function pendingHandoversFor(store: BoxStore, personId: string): readonly BoxHandover[] {
  return store
    .handovers()
    .filter((h) => h.acknowledgedBy === null && h.toCustodianPersonId === personId)
}

/** تسليماتُ نطاقٍ (صادرةً أو واردة) — للعرض الهابط في سجلّ الوحدة. */
export function handoversIn(store: BoxStore, unitPath: string): readonly BoxHandover[] {
  return store
    .handovers()
    .filter((h) => contains(unitPath, h.fromUnitPath) || contains(unitPath, h.toUnitPath))
}

/**
 * مبلغُ التسليم **مقروءٌ من القيد** لا من سجلّه (ق-٦٠) — فلا نسخةَ مالٍ خارج الدفتر تنحرف.
 */
export function handoverAmount(
  ledger: LedgerStore,
  handover: BoxHandover,
): ReadonlyMap<CurrencyCode, Cents> {
  const out = new Map<CurrencyCode, Cents>()
  for (const line of ledger.linesOf(handover.entryId)) {
    if (line.accountId !== ACCOUNT_ROLES.cash) continue
    if (line.unitPath !== handover.toUnitPath) continue
    out.set(line.currency, line.debit)
  }
  return out
}
