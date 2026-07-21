/**
 * ق-٨٠ — **الحالةُ مصدرُ الحقيقة، والاشتقاقُ في موضعٍ واحد** (عقدُ الوحدة §٣).
 *
 * كلُّ ما ههنا **دوالُّ اشتقاقٍ نقيّة** على أحداث السلسلة: لا حقلَ حالةٍ يُقرأ ولا حائزَ
 * يُخزَّن. ولذلك يستحيل التناقضُ الذي كُشف حيّاً في v1 («بعهدة فلان» و«في الوحدة» في السطر
 * نفسه): **الحائزُ فرعٌ عن الحالة، والحالةُ فرعٌ عن الحركة الأخيرة**، فمصدرُهما واحد.
 */

import { contains } from "../../../authorization/scope.js"
import type { CustodyStore } from "../data/store.js"
import type { Asset, CustodyMove } from "../types.js"

/**
 * الحالةُ المشتقّة (ق-٨٠) — **موطنُها هنا لا في `types.ts`**: فذاك ملفُّ الكيانات المخزَّنة،
 * وهذه مخرجُ حساب. والفصلُ هو ما يجعل «صفر حالةٍ مخزَّنة» **قابلاً للقياس** بحارسٍ محتوائيّ.
 */
export type CustodyStatus = "inUnit" | "pendingAck" | "held" | "damaged" | "lost" | "retired"

/** الحالاتُ التي «تُفرِّغ اليد» — فلا يُعرض معها حائزٌ أبداً (قاتلُ تناقضِ v1). */
export const HOLDING_STATUSES: readonly CustodyStatus[] = Object.freeze(["pendingAck", "held"])

/** الحالاتُ الخاتمةُ التي تُقفل السلسلة — أيُّ حركةٍ بعدها ⇒ `ASSET_CLOSED`. */
export const CLOSED_STATUSES: readonly CustodyStatus[] = Object.freeze([
  "damaged",
  "lost",
  "retired",
])

/** لقطةُ أصلٍ بحالته المشتقّة — مخرجُ الاشتقاق لا كيانٌ مخزَّن. */
export type AssetState = {
  readonly assetId: string
  readonly labelAr: string
  readonly unitPath: string
  readonly status: CustodyStatus
  readonly holderPersonId: string | null
  readonly acknowledged: boolean
  readonly lastMoveId: string | null
}

/** ما بيد شخصٍ الآن — مدخلُ تحقّق ق-٨٢ ووجهُ شاشة «عُهدتي». */
export type OpenCustody = {
  readonly assetId: string
  readonly labelAr: string
  readonly unitPath: string
  readonly status: CustodyStatus
  readonly sinceMoveId: string
}

/** سلسلةُ الأصل مرتَّبةً بترتيبها الحتميّ — لا تُمحى ولا يُعاد ترتيبُها (ق-٧٨). */
export function chainOf(store: CustodyStore, assetId: string): readonly CustodyMove[] {
  return store
    .moves()
    .filter((m) => m.assetId === assetId)
    .sort((a, b) => a.seq - b.seq)
}

/** آخرُ حركةٍ في السلسلة — أو `null` لأصلٍ لم يتحرّك بعد. */
export function lastMoveOf(store: CustodyStore, assetId: string): CustodyMove | null {
  const chain = chainOf(store, assetId)
  return chain[chain.length - 1] ?? null
}

/** الحالةُ من نوع الحركة الأخيرة — **الجدولُ كلُّه في دالةٍ واحدة**، فلا فرعَ يُنسى. */
function statusOf(move: CustodyMove | null): CustodyStatus {
  if (move === null) return "inUnit"
  switch (move.kind) {
    case "handover":
    case "transfer":
      return move.acknowledgedBy === null ? "pendingAck" : "held"
    case "return":
      return "inUnit"
    case "damage":
      return "damaged"
    case "loss":
      return "lost"
    case "decommission":
      return "retired"
  }
}

export function isHoldingStatus(status: CustodyStatus): boolean {
  return HOLDING_STATUSES.includes(status)
}

export function isClosedStatus(status: CustodyStatus): boolean {
  return CLOSED_STATUSES.includes(status)
}

/**
 * لقطةُ أصلٍ **موجودٍ** بحالته المشتقّة — تأخذ الكيانَ نفسَه لا معرّفَه، فلا فرعَ «أصلٌ
 * مجهول» يتكرّر في كل عابرٍ على القائمة (ولا فرعٌ ميّتٌ يدّعي حراسةً لا يحرسها).
 *
 * **والحائزُ يُعرض مع الحالات الحائزة وحدها** — فاسمُ حائزٍ قديمٍ مع «معادة» لا يظهر
 * حائزاً، لأنّه لا يُقرأ من حقلٍ باقٍ بل يُشتقّ من الحالة (ق-٨٠).
 */
function stateOf(store: CustodyStore, asset: Asset): AssetState {
  const last = lastMoveOf(store, asset.id)
  const status = statusOf(last)
  return {
    assetId: asset.id,
    labelAr: asset.labelAr,
    unitPath: asset.unitPath,
    status,
    holderPersonId: last !== null && isHoldingStatus(status) ? last.toPersonId : null,
    acknowledged: status === "held",
    lastMoveId: last === null ? null : last.id,
  }
}

/** لقطةُ أصلٍ بمعرّفه — و`null` لأصلٍ مجهول: لا حالةَ مُختلَقة لِما لا وجود له. */
export function assetStateOf(store: CustodyStore, assetId: string): AssetState | null {
  const asset = store.getAsset(assetId)
  return asset === null ? null : stateOf(store, asset)
}

/** أصولُ نطاقٍ بحالاتها — بالاحتواء بشرط الشرطة الختامية (§١.٥)، فلا تسريبَ جوارٍ (ق-٨١). */
export function assetsInScope(store: CustodyStore, scopePath: string): readonly AssetState[] {
  const out: AssetState[] = []
  for (const asset of store.assets()) {
    if (contains(scopePath, asset.unitPath)) out.push(stateOf(store, asset))
  }
  return Object.freeze(out)
}

/**
 * ق-٨٢ — **ما بيد شخصٍ الآن**: مُقرّاً أو بانتظار إقراره معاً. **التأخّرُ في الإقرار ليس
 * مخرجاً** من العهدة؛ فمن سُلّم إليه محسوبٌ عليه حتى تُفرَّغ يدُه بحركةٍ مسجَّلة.
 */
export function openCustodyOf(store: CustodyStore, personId: string): readonly OpenCustody[] {
  const out: OpenCustody[] = []
  for (const asset of store.assets()) {
    const last = lastMoveOf(store, asset.id)
    if (last === null || last.toPersonId !== personId) continue
    const status = statusOf(last)
    if (!isHoldingStatus(status)) continue
    out.push({
      assetId: asset.id,
      labelAr: asset.labelAr,
      unitPath: asset.unitPath,
      status,
      sinceMoveId: last.id,
    })
  }
  return Object.freeze(out)
}

/** ق-٧٩ — ما **ينتظر إقرارَ** شخصٍ بعينه: بالملكية لا بالنطاق (قدرةٌ شخصية). */
export function pendingReceiptsFor(store: CustodyStore, personId: string): readonly CustodyMove[] {
  const out: CustodyMove[] = []
  for (const asset of store.assets()) {
    const last = lastMoveOf(store, asset.id)
    if (last === null || last.toPersonId !== personId) continue
    if (statusOf(last) !== "pendingAck") continue
    out.push(last)
  }
  return Object.freeze(out)
}
