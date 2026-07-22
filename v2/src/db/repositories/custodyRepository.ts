/**
 * مستودعُ العُهد على D1 — **خلف العقد القائم بلا تغيير توقيعٍ واحد**.
 *
 * لا صنفَ جديدٌ ولا وكيلٌ ولا اعتراضُ نداءات: المستودعُ الذي تراه الخدمةُ هو `CustodyStore`
 * نفسُه حرفياً، وهذا الملفُّ **يُسقطه ويُحمّله** لا غير (`db/README.md` الحسم ١، الطبقة ٢).
 * ولذلك لم يُعدَّل في `services/derive.ts` ولا في `server/endpoints.ts` سطرٌ واحد.
 *
 * ### وثلاثةُ فروقٍ عن مستودعَي الريادة تستحقّ أن تُقال — لأنها تتكرّر في السبع الباقية
 * ١. **مفتاحُ توجيه الحركة يُشتقّ من أصلها ولا يُخترع.** الحركةُ ليست كياناً ذا موطنٍ
 *    تنظيميّ؛ موطنُها موطنُ أصلها. وأصلٌ مجهولٌ ⟵ **رميةٌ** لا توجيهٌ إلى الجذر صامتاً
 *    (نظيرُ `requestPath` في `orgRepository`). وهذا **آمنٌ هنا بدليل**: ق-٨٠ ينصّ على أن
 *    «الإعادةَ تفرّغ اليدَ **وتُبقي الأصلَ في وحدته**» — فمسارُ الأصل **لا يتحرّك**، فلا
 *    يُعاد كتابةُ صفٍّ ملحقٍ فقط بمفتاحٍ جديد.
 * ٢. **التحميلُ حشوٌ لا إعادةُ تشغيل.** معرّفاتُ العُهد تأتي من عدّادٍ متتابع كالدفتر،
 *    لكنّ `saveAsset`/`appendMove` تستقبلان الكيانَ **بمعرّفه** — فلا حاجةَ لإعادة تشغيل
 *    التخصيص (وهي أصعبُ ما في `ledgerRepository`)، ويكفي **استئنافُ العدّاد** بالأعلى بين
 *    المشتقّ والمحفوظ.
 * ٣. **لا عدّادَ مشتقٌّ يُتحقَّق منه** (البند ٤ من بنود ناقل الوحدة): الحائزُ والحالةُ
 *    اشتقاقٌ **في الذاكرة عند القراءة** لا رولّ-أب مخزَّن — فلا رقمَ يمكن تزويرُه أصلاً،
 *    ولا مطابقةَ تُبنى. **صفرُ حالةٍ مخزَّنة أرخصُ من رولّ-أبٍ محروس.**
 */

import {
  encodeDate,
  encodeNullable,
  readDate,
  readDateOrNull,
  readInt,
  readText,
  readTextOrNull,
} from "../encode.js"
import { tableSpec } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"
import { naturalKey, primaryKeyOf, type PersistentStore, type RowSet } from "../unitOfWork.js"
import { CustodyStore } from "../../features/custody/data/store.js"
import type { CustodyMoveKind } from "../../features/custody/types.js"
import { sequenceRow, suffixOf } from "./shared.js"

const SOURCE = "custody"
const SEQUENCE = "custody.seq"

/**
 * سقفُ صفوف وحدة العمل (G23 · CR-026 ب · قب-٤٨) — **مشتقٌّ لا مُقدَّر، وبضعفٍ مُصرَّحٍ به**.
 *
 * نطاقُ التحميل نطاقُ وحدة (مسجدٌ أو مربعٌ أو منطقة)، والمحمولُ ثلاثةُ جداول: إسقاطُ
 * الوحدات، والأصول، وسلسلتها.
 *  · **الوحدات**: ADR-001 §١-٥ يقيس **~٨٦٠** وحدةً تنظيمية للشبكة كلِّها اليوم.
 *  · **الأصولُ وسلسلتُها**: **غيرُ مقيسة** — `asset_custody` في v1 (هجرة `0076`) ليس ضمن
 *    الجداول التي قِيست في ADR §١-١/§١-٣، فلا أدّعي رقماً لم يُقَس. وأقربُ إسنادٍ صادقٍ
 *    ملحقُ ADR أ: «باقي الـ٩٥ جدولاً — تقديرٌ مجمَّع **١٠٪**» من ~١.٩ مليون صفٍّ/سنة ⟵
 *    ~٢٬٠٠٠ صفٍّ لكلِّ جدولٍ منها في السنة على مستوى الشبكة، وجداولُ العُهد **ثلاثة** ⟵
 *    ~٦٬٠٠٠/سنة، وبالاحتفاظ سنتين (قب-٦) ⟵ **~١٢٬٠٠٠** للشبكة كلِّها.
 *
 * فالسقفُ **٢٠٬٠٠٠** يسع الشبكةَ كلَّها (~١٣٬٠٠٠ بالوحدات) بهامشٍ ~١.٥×، بينما الجلسةُ
 * الواقعية **نطاقُ وحدةٍ** أي جزءٌ يسيرٌ منه. ولذلك **أوّلُ تجاوزٍ هنا ليس «تضخّمَ بيانات»
 * بل «قراءةٌ وسّعت النطاق»** — وهو بعينه ما أراد قب-٤٨ أن ينزع عنه الصمت.
 *
 * > **والضعفُ يُقال لا يُجمَّل**: مصدرُ الرقم تقديرٌ مجمَّعٌ لا قياسٌ مباشر — كحال حمولة
 * > `audit_log` التي وصفها ADR بأنها «أضعفُ رقمٍ في الوثيقة». فإن قِيست أصولُ الشبكة يوماً
 * > **يُراجَع هذا السقف بالرقم المقيس**، وهذا أصدقُ من رقمٍ يبدو دقيقاً ولا سند له.
 */
const ROW_BUDGET = 20_000

function table(rows: RowSet, name: string): ReadonlyMap<string, SqlRow> {
  return rows.get(name) ?? new Map<string, SqlRow>()
}

function collect(entries: readonly SqlRow[], name: string): [string, ReadonlyMap<string, SqlRow>] {
  const spec = tableSpec(name)
  return [name, new Map(entries.map((entry) => [primaryKeyOf(spec, entry), entry]))]
}

export function persistentCustody(store: CustodyStore): PersistentStore {
  const tenantId = store.tenantId
  /** أعلى عدّادٍ رآه التحميل — يصون الحتميّة حين يكون النطاقُ جزئياً. */
  let hydratedSeq = 0

  /** مفتاحُ توجيه الحركة **مشتقٌّ من أصلها** — ولا يُخترع (انظر الفرق ١ أعلاه). */
  const movePath = (assetId: string, moveId: string): string => {
    const asset = store.getAsset(assetId)
    if (asset === null) {
      throw new Error(
        `مفتاحُ توجيهٍ لا يُشتقّ: حركةُ العهدة ${moveId} تشير إلى أصلٍ مجهول ${assetId}`,
      )
    }
    return asset.unitPath
  }

  const derivedSeq = (): number => {
    let max = hydratedSeq
    for (const asset of store.assets()) max = Math.max(max, suffixOf(asset.id))
    for (const move of store.moves()) max = Math.max(max, suffixOf(move.id))
    return max
  }

  return {
    name: SOURCE,
    rowBudget: ROW_BUDGET,
    tables: [
      "custody_units",
      "custody_assets",
      "custody_moves",
      { table: "sequences", owns: (r) => r["name"] === SEQUENCE },
    ],

    project: () =>
      new Map([
        collect(
          store.units().map((unit) => ({
            tenant_id: tenantId,
            unit_path: unit.path,
            id: unit.id,
          })),
          "custody_units",
        ),
        collect(
          store.assets().map((asset) => ({
            tenant_id: tenantId,
            unit_path: asset.unitPath,
            id: asset.id,
            label_ar: asset.labelAr,
            serial_ar: asset.serialAr,
            note_ar: asset.noteAr,
            registered_by: asset.registeredBy,
            registered_at: encodeDate(asset.registeredAt),
          })),
          "custody_assets",
        ),
        collect(
          store.moves().map((move) => ({
            tenant_id: tenantId,
            unit_path: movePath(move.assetId, move.id),
            id: move.id,
            asset_id: move.assetId,
            seq: move.seq,
            kind: move.kind,
            from_person_id: move.fromPersonId,
            to_person_id: move.toPersonId,
            condition_ar: move.conditionAr,
            note_ar: move.noteAr,
            at: encodeDate(move.at),
            by_person_id: move.byPersonId,
            acknowledged_by: move.acknowledgedBy,
            acknowledged_at: encodeNullable(move.acknowledgedAt, encodeDate),
          })),
          "custody_moves",
        ),
        collect([sequenceRow(tenantId, SEQUENCE, derivedSeq())], "sequences"),
      ]),

    load: (rows) => {
      for (const row of table(rows, "custody_units").values()) {
        store.saveUnit({ tenantId, id: readText(row, "id"), path: readText(row, "unit_path") })
      }
      for (const row of table(rows, "custody_assets").values()) {
        store.saveAsset({
          tenantId,
          id: readText(row, "id"),
          unitPath: readText(row, "unit_path"),
          labelAr: readText(row, "label_ar"),
          serialAr: readTextOrNull(row, "serial_ar"),
          noteAr: readTextOrNull(row, "note_ar"),
          registeredBy: readText(row, "registered_by"),
          registeredAt: readDate(row, "registered_at"),
        })
      }
      // **بترتيب السلسلة**: `appendMove` إلحاقٌ، وترتيبُ الإلحاق جزءٌ من معنى السلسلة —
      // والاشتقاقُ يفرزها بـ`seq` على أي حال، فالترتيبُ هنا صدقٌ لا اعتمادٌ عليه.
      const moves = [...table(rows, "custody_moves").values()].sort(
        (a, b) => readInt(a, "seq") - readInt(b, "seq") || suffixOf(readText(a, "id")) - suffixOf(readText(b, "id")),
      )
      for (const row of moves) {
        store.appendMove({
          tenantId,
          id: readText(row, "id"),
          assetId: readText(row, "asset_id"),
          seq: readInt(row, "seq"),
          kind: readText(row, "kind") as CustodyMoveKind,
          fromPersonId: readTextOrNull(row, "from_person_id"),
          toPersonId: readTextOrNull(row, "to_person_id"),
          conditionAr: readText(row, "condition_ar"),
          noteAr: readTextOrNull(row, "note_ar"),
          at: readDate(row, "at"),
          byPersonId: readText(row, "by_person_id"),
          acknowledgedBy: readTextOrNull(row, "acknowledged_by"),
          acknowledgedAt: readDateOrNull(row, "acknowledged_at"),
        })
      }

      const stored = table(rows, "sequences").get(naturalKey(tenantId, SEQUENCE))
      hydratedSeq = Math.max(derivedSeq(), stored === undefined ? 0 : readInt(stored, "value"))
      // العدّادُ يُستأنف ولا يعود صفراً — وإلا دهس معرّفٌ جديدٌ معرّفاً محفوظاً خارج النطاق.
      for (let i = 0; i < hydratedSeq; i += 1) store.nextId("_hydrate")
    },
  }
}
