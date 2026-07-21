/**
 * ب-٢٩ — **البابُ الثاني مُغلقٌ بالبنية: `asset.manage` لا يمسّ حيازة** (عقدُ الوحدة §٢).
 *
 * في v1 كانت لوحةُ المالية **تنشئ أصلاً بحائزٍ وتغيّر حالتَه بلا حدثِ سلسلة** (ز-٣) — فوُلد
 * البابان اللذان لا يعرف أحدهما الآخر. وهنا:
 *  - `registerAsset` تُولد الأصلَ **بلا حائزٍ وبلا حالة** (كلاهما اشتقاقٌ ابتداءً).
 *  - `amendAsset` تعدّل **الحقولَ الوصفية بقائمةٍ بيضاء مغلقة**، وأيُّ مفتاحٍ سواها يُردّ
 *    **باسمه** (`FIELD_NOT_EDITABLE`) لا يُتجاهل بصمت — فالمحاولةُ تُرى ولا تُبتلع.
 */

import type { CustodyStore } from "../data/store.js"
import type { CustodyContext } from "./context.js"
import { assetStateOf } from "./derive.js"
import { custodyErr, custodyOk, type Asset, type CustodyResult } from "../types.js"

/**
 * **القائمةُ البيضاء وصفيّةٌ بحتة** — لا حائزَ ولا حالةَ فيها، ويحرسها اختبارٌ يقرأ هذه
 * القيمة نفسَها. توسيعُها تغييرٌ في عقد الوحدة يمرّ بالمواصفة لا باجتهادٍ في الكود.
 */
export const EDITABLE_ASSET_FIELDS = ["labelAr", "serialAr", "noteAr"] as const
export type EditableAssetField = (typeof EDITABLE_ASSET_FIELDS)[number]

export type RegisterAssetInput = {
  readonly unitId: string
  readonly labelAr: string
  readonly serialAr?: string | null
  readonly noteAr?: string | null
}

export type AmendAssetInput = {
  readonly assetId: string
  /** حقولٌ مفتوحةُ الشكل عمداً: **الحدُّ هو مَن يفحص** (المادة ٣/٣) فيُردّ المرفوضُ باسمه. */
  readonly fields: Readonly<Record<string, string | null>>
}

function isEditable(key: string): key is EditableAssetField {
  return (EDITABLE_ASSET_FIELDS as readonly string[]).includes(key)
}

/** وصفُ الأصل في قيد التدقيق — نصٌّ واحدٌ يقارَن قبل/بعد (ق-٨٣). */
function describe(asset: Asset): string {
  return `${asset.labelAr} · ${asset.serialAr ?? "—"} · ${asset.noteAr ?? "—"}`
}

export function registerAsset(
  store: CustodyStore,
  ctx: CustodyContext,
  input: RegisterAssetInput,
): CustodyResult<Asset> {
  const unit = store.getUnit(input.unitId)
  if (unit === null) return custodyErr("UNKNOWN_CUSTODY_UNIT", input.unitId)
  if (input.labelAr.trim().length === 0) return custodyErr("EMPTY_ASSET_LABEL", input.unitId)

  return store.transaction(() => {
    const id = store.nextId("as")
    store.saveAsset({
      tenantId: store.tenantId,
      id,
      unitPath: unit.path,
      labelAr: input.labelAr.trim(),
      serialAr: input.serialAr ?? null,
      noteAr: input.noteAr ?? null,
      registeredBy: ctx.actorPersonId,
      registeredAt: ctx.now,
    })
    const saved = store.getAsset(id)!
    store.appendAudit({
      at: ctx.now,
      actorPersonId: ctx.actorPersonId,
      action: "custody.asset.register",
      scopePath: unit.path,
      targetId: id,
      beforeAr: "—",
      afterAr: `${describe(saved)} · inUnit`,
    })
    return custodyOk(saved)
  })
}

export function amendAsset(
  store: CustodyStore,
  ctx: CustodyContext,
  input: AmendAssetInput,
): CustodyResult<Asset> {
  const asset = store.getAsset(input.assetId)
  if (asset === null) return custodyErr("UNKNOWN_ASSET", input.assetId)

  // **الردُّ باسمه**: محاولةُ تحرير الحائز أو الحالة تُسمّى ولا تُتجاهل (ب-٢٩) — والفحصُ
  // والتطبيقُ في مرّةٍ واحدة، فلا يبقى فرعٌ يفحص ما فُحص (ولا فرعٌ ميّتٌ يوهم بحراسة).
  const patch: Record<EditableAssetField, string | null> = {
    labelAr: asset.labelAr,
    serialAr: asset.serialAr,
    noteAr: asset.noteAr,
  }
  const rejected: string[] = []
  for (const [key, value] of Object.entries(input.fields)) {
    if (isEditable(key)) patch[key] = value
    else rejected.push(key)
  }
  if (rejected.length > 0) return custodyErr("FIELD_NOT_EDITABLE", rejected.join("، "))

  // التسميةُ **ركنُ الأصل**: تفريغُها بنصٍّ فارغٍ أو بـ`null` مرفوضٌ كما يُرفض التسجيلُ بلا اسم.
  const labelAr = (patch.labelAr ?? "").trim()
  if (labelAr.length === 0) return custodyErr("EMPTY_ASSET_LABEL", input.assetId)

  return store.transaction(() => {
    const before = describe(asset)
    store.saveAsset({ ...asset, labelAr, serialAr: patch.serialAr, noteAr: patch.noteAr })
    const saved = store.getAsset(asset.id)!
    // الحالةُ تُذكر في الطرفين **مشتقّةً** لا مُحرَّرة — فالقيدُ يشهد أنّها لم تتغيّر.
    const status = assetStateOf(store, asset.id)!.status
    store.appendAudit({
      at: ctx.now,
      actorPersonId: ctx.actorPersonId,
      action: "custody.asset.amend",
      scopePath: asset.unitPath,
      targetId: asset.id,
      beforeAr: `${before} · ${status}`,
      afterAr: `${describe(saved)} · ${status}`,
    })
    return custodyOk(saved)
  })
}
