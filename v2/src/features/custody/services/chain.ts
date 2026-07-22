/**
 * ق-٧٨/ق-٧٩/ق-٨٠/ق-٨١ — **سلسلةُ الحيازة: الكاتبُ الوحيد** (عقدُ الوحدة §١).
 *
 * `recordCustodyMove` هي **الدالةُ الوحيدة في الوحدة كلِّها التي تكتب حدثاً في السلسلة**،
 * وبالتالي **الوحيدةُ التي تُغيّر حائزاً أو حالة** — لأنّ كليهما اشتقاقٌ منها لا حقلٌ يُحرَّر.
 * وهذا هو تنفيذُ ب-٢٩ حرفياً: «كلُّ تغيير حيازةٍ يمرّ بالسلسلة حصراً». يحرسه اختبارٌ
 * محتوائيٌّ يمسح الوحدة فيفشل عند ثاني مستدعٍ لـ`appendMove`.
 *
 * وثلاثةُ ثوابتٍ تُفرَض هنا:
 *  ١. **الاسمُ يُشتقّ لا يُملى**: الأولى `handover` وما بعدها `transfer` — من طول السلسلة.
 *  ٢. **الحركةُ وقيدُ تدقيقها في معاملةٍ واحدة** (ق-٨٣): فحركةٌ بلا تدقيقٍ مستحيلة،
 *     ومحاولةٌ مرفوضةٌ لا تترك أثراً.
 *  ٣. **«من نفّذ» من الجلسة** (`ctx.actorPersonId`) لا من المدخل — فلا يُنسب فعلٌ لغير فاعله.
 */

import type { CustodyStore } from "../data/store.js"
import type { CustodyContext } from "./context.js"
import { assetStateOf, chainOf, isClosedStatus, isHoldingStatus, lastMoveOf } from "./derive.js"
import {
  custodyErr,
  custodyOk,
  type CustodyAction,
  type CustodyMove,
  type CustodyMoveKind,
  type CustodyResult,
} from "../types.js"

export type CustodyMoveInput = {
  readonly assetId: string
  readonly action: CustodyAction
  /** «إلى مَن» — إلزاميٌّ لفعل التسليم وحده، ويُفحص بلوغُه للنطاق (ق-٨١). */
  readonly toPersonId?: string
  /** «بأيّ حال» (ق-٧٨) — إلزاميّ في كل حركة. */
  readonly conditionAr: string
  readonly noteAr?: string | null
  readonly at?: Date
}

export type AcknowledgeReceiptInput = {
  readonly moveId: string
  readonly personId: string
}

/**
 * وصفُ الحيازة في قيد التدقيق — **صياغةٌ واحدةٌ** لطرفَي «قبل/بعد» في المسارين معاً
 * (ق-٨٣)، فلا يُقرأ القيدُ بلسانين ولا يُنسى محرفُ الغياب في أحدهما.
 */
function holdingLabel(state: { holderPersonId: string | null; status: string }): string {
  return `${state.holderPersonId ?? "—"} · ${state.status}`
}

/** الأفعالُ التي تُفرِّغ اليد ولا تنقلها — لكلٍّ حالتُه الصريحة (ق-٨٠). */
const CLOSING_KIND: Readonly<Record<Exclude<CustodyAction, "hand">, CustodyMoveKind>> =
  Object.freeze({
    return: "return",
    damage: "damage",
    loss: "loss",
    decommission: "decommission",
  })

export function recordCustodyMove(
  store: CustodyStore,
  ctx: CustodyContext,
  input: CustodyMoveInput,
): CustodyResult<CustodyMove> {
  const asset = store.getAsset(input.assetId)
  if (asset === null) return custodyErr("UNKNOWN_ASSET", input.assetId)

  const state = assetStateOf(store, input.assetId)!
  // **الحالةُ الخاتمةُ تُقفل السلسلة**: عودةُ أصلٍ للخدمة حركةٌ لا تذكرها ق-٧٨…ق-٨٣ فلا تُخترع.
  if (isClosedStatus(state.status)) return custodyErr("ASSET_CLOSED", state.status)

  const holder = isHoldingStatus(state.status) ? state.holderPersonId : null
  const previous = chainOf(store, input.assetId).length

  let kind: CustodyMoveKind
  let toPersonId: string | null

  if (input.action === "hand") {
    const recipient = input.toPersonId ?? ""
    // «ولا لشخصٍ خارج نطاقك» (ق-٨١): يُقاس بمسار التكليف لا بمسمّى الدور (G6).
    if (!ctx.reaches(recipient, asset.unitPath)) {
      return custodyErr("RECIPIENT_OUT_OF_SCOPE", recipient)
    }
    if (recipient === holder) return custodyErr("SAME_HOLDER", recipient)
    // **الاسمُ يُشتقّ**: أوّلُ تسليمٍ «تسليم» وما بعده «نقلُ عهدة» (ق-٧٨).
    kind = previous === 0 ? "handover" : "transfer"
    toPersonId = recipient
  } else {
    if (input.action === "return" && holder === null) {
      return custodyErr("NO_CURRENT_HOLDER", input.assetId)
    }
    kind = CLOSING_KIND[input.action]
    toPersonId = null
  }

  const at = input.at ?? ctx.now

  return store.transaction(() => {
    const id = store.nextId("mv")
    store.appendMove({
      tenantId: store.tenantId,
      id,
      assetId: asset.id,
      seq: previous + 1,
      kind,
      fromPersonId: holder,
      toPersonId,
      conditionAr: input.conditionAr,
      noteAr: input.noteAr ?? null,
      at,
      byPersonId: ctx.actorPersonId,
      acknowledgedBy: null,
      acknowledgedAt: null,
    })
    const after = assetStateOf(store, asset.id)!
    store.audit.append({
      at: ctx.now,
      actorPersonId: ctx.actorPersonId,
      action: "custody.move.record",
      // **النطاقُ يُقال ولا يُشتقّ** (CR-027): موطنُ الأصل التنظيميّ — ومَن يكتب القيدَ
      // يعرف على أيِّ وحدةٍ وقع الحدث. ولا يبلغ الجذرَ أبداً فلا يقترب من الحَجْر المعلن.
      unitPath: asset.unitPath,
      capability: null,
      targetType: "asset",
      targetId: asset.id,
      reason: null,
      // **قبل/بعد** بالحائز والحالة معاً — «من كان يحوزها» لا يضيع (ق-٨٣).
      before: holdingLabel(state),
      after: holdingLabel(after),
    })
    return custodyOk(store.getMove(id)!)
  })
}

/**
 * ق-٧٩ — **الإقرارُ بيد المستلِم وحده**. الحارسُ الأول نطاقٌ شخصيٌّ على دالة الخادم؛ وهذا
 * حارسٌ ثانٍ **في العمق** فلا يمرّ إقرارٌ بالنيابة من أيّ مسارٍ ولو داخليّ.
 */
export function acknowledgeReceipt(
  store: CustodyStore,
  ctx: CustodyContext,
  input: AcknowledgeReceiptInput,
): CustodyResult<CustodyMove> {
  const move = store.getMove(input.moveId)
  if (move === null) return custodyErr("MOVE_NOT_FOUND", input.moveId)
  if (move.kind !== "handover" && move.kind !== "transfer") {
    return custodyErr("NOT_ACKNOWLEDGEABLE", move.kind)
  }
  if (move.acknowledgedBy !== null) return custodyErr("ALREADY_ACKNOWLEDGED", move.id)
  // **الإقرارُ لِما هو قائمٌ الآن**: حركةٌ نسختها حركةٌ بعدها لا تُقرّ بأثرٍ رجعيّ.
  if (lastMoveOf(store, move.assetId)?.id !== move.id) {
    return custodyErr("MOVE_SUPERSEDED", move.id)
  }
  if (move.toPersonId !== input.personId) return custodyErr("NOT_RECEIVING_HOLDER", input.personId)

  return store.transaction(() => {
    const before = assetStateOf(store, move.assetId)!
    store.stampReceipt(move.id, input.personId, ctx.now)
    const after = assetStateOf(store, move.assetId)!
    store.audit.append({
      at: ctx.now,
      actorPersonId: input.personId,
      action: "custody.receipt.acknowledge",
      unitPath: before.unitPath,
      capability: null,
      targetType: "asset",
      targetId: move.assetId,
      reason: null,
      before: holdingLabel(before),
      after: holdingLabel(after),
    })
    return custodyOk(store.getMove(move.id)!)
  })
}
