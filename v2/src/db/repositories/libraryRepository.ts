/**
 * مستودعُ المكتبة على D1 — **خلف العقد القائم بلا تغيير توقيعٍ واحد**.
 *
 * لا صنفَ جديدٌ ولا وكيلٌ ولا اعتراضُ نداءات: المستودعُ الذي تراه الخدمةُ هو `LibraryStore`
 * نفسُه حرفياً، وهذا الملفُّ **يُسقطه ويُحمّله** لا غير (`db/README.md` الحسم ١، الطبقة ٢).
 *
 * ### ثلاثةُ فروقٍ عن القالب (`custodyRepository`) تستحقّ أن تُقال — وكلُّها مُصرَّحٌ بها
 * ١. **لا سجلَّ تدقيقٍ يُوحَّد ولا يُقذف من هنا.** خلافاً للعُهد (وorg/ledger)، **لم تحمل
 *    المكتبةُ سجلاً محلياً قطّ**: تدقيقُها يُعلَن على **دالّة الخادم** (`defineServerFn.audit`)
 *    لا في المستودع ولا في الخدمة. فبند CR-027 (إلغاءُ السجلّ المحليّ وحقنُ `AuditJournal`)
 *    **غيرُ ذي موضوعٍ هنا**، ووحدةُ عملها تُنجِز مستودعاً واحداً بلا مِرفق تدقيق. (تفصيلُه في
 *    تقرير التسليم — وهو أوّلُ مخالفةٍ للوصفة، مُعلَنةٌ لا مدفونة.)
 * ٢. **مفتاحُ توجيه خطِّ الزمن مشتقٌّ من مادته** — ولا يُخترع (نظيرُ حركةِ العُهد من أصلها):
 *    خطُّ الزمن ليس كياناً ذا موطنٍ خاصّ؛ موطنُه موطنُ **مادته**. ومادةٌ مجهولةٌ ⟵ **رميةٌ**
 *    لا توجيهٌ إلى الجذر صامتاً. وهذا **آمنٌ بدليلٍ منصوص**: `services/materials.ts` ينصّ على
 *    أن نقلَ المادة إلى وحدةٍ أخرى **إنشاءٌ جديد** لا تعديل ⟵ موطنُ المادة **لا يتحرّك**،
 *    فلا يُعاد كتابةُ صفٍّ ملحقٍ فقط بمفتاحٍ جديد.
 * ٣. **لا عدّادَ مشتقٌّ يُتحقَّق منه.** «الخَتَماتُ الثلاث» اشتقاقٌ عند القراءة (`stateOf`) لا
 *    رولّ-أب مخزَّن — فلا رقمَ يمكن تزويرُه، ولا مطابقةَ تُبنى. **صفرُ حالةٍ مخزَّنة أرخصُ من
 *    رولّ-أبٍ محروس** (README §٤).
 */

import {
  encodeBoolean,
  encodeDate,
  encodeNullable,
  readBoolean,
  readDate,
  readDateOrNull,
  readInt,
  readIntOrNull,
  readText,
  readTextOrNull,
} from "../encode.js"
import { tableSpec, TENANT_ROOT_PATH } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"
import { naturalKey, primaryKeyOf, type PersistentStore, type RowSet } from "../unitOfWork.js"
import { LibraryStore } from "../../features/library/data/store.js"
import type { CapId } from "../../authorization/generated/capabilities.generated.js"
import type { MaterialKind } from "../../features/library/types.js"
import { sequenceRow, suffixOf } from "./shared.js"

const SOURCE = "library"
const SEQUENCE = "library.seq"

/**
 * سقفُ صفوف وحدة العمل (G23 · CR-026 ب · قب-٤٨) — **مشتقٌّ لا مُقدَّر، وبضعفٍ مُصرَّحٍ به**،
 * ومُصدَرُ ضعفِه (خطُّ الزمن) **مُسمّىً** لا مدفونٌ في رقمٍ يبدو دقيقاً.
 *
 * نطاقُ التحميل نطاقُ وحدة، والمحمولُ ستةُ جداول: الوحداتُ والمعاجمُ الثلاثةُ والمادةُ وخطُّ
 * زمنها. مصادرُ الإسناد، الأقوى فالأضعف:
 *  · **الوحدات**: ADR-001 §١-٥ يقيس **~٨٦٠** وحدةً للشبكة كلِّها اليوم.
 *  · **المعاجمُ الثلاثة** (فئة/جمهور/صيغة): قواميسُ مغلقةٌ للشبكة (قب-٢٢) — عشراتٌ لا تنمو
 *    مع الميدان، فأهملُها ~١٠٠ صفٍّ مجتمعةً.
 *  · **المادة**: **غيرُ مقيسة** — ليست في جداول ADR §١-١/§١-٣ المقيسة. فأقربُ إسنادٍ صادقٍ
 *    ملحقُ ADR أ: «باقي الـ٩٥ جدولاً — تقديرٌ مجمَّع **١٠٪**» ⟵ ~٢٬٠٠٠ صفٍّ/سنة للجدول على
 *    مستوى الشبكة، وبالاحتفاظ سنتين (قب-٦) ⟵ **~٤٬٠٠٠**.
 *  · **خطُّ الزمن**: **البندُ المهيمنُ الضعيف** — جدولُ ربطٍ `(شخص × مادةٍ تبلغه)` لا يقيسه
 *    الملحقُ كجدولٍ مفرد. أشتقُّه من مرساتين مقيستين: ~**٢٠٬٠٠٠** شخصٍ اليوم (§١-٥) ×
 *    ~**٢** مادةٍ إلزاميةٍ تبلغ الفردَ في سنتين ⟵ **~٤٠٬٠٠٠**. والمضروبُ «٢» **تقديرٌ لا
 *    قياسٌ** — وهو نظيرُ حمولة `audit_log` التي سمّاها ADR «أضعفَ رقمٍ في الوثيقة».
 *
 * فالمجموعُ للشبكة كلِّها ~٤٥٬٠٠٠، والسقفُ **٥٠٬٠٠٠** يتركه بهامشٍ ~١.١× **على نطاق الشبكة
 * كلِّها**، بينما الجلسةُ الواقعية نطاقُ مسجدٍ (~٥٠ فرداً × ~٢ إلزاميّ + حفنةُ موادّ = مئاتٌ
 * قليلة). **فأوّلُ تجاوزٍ هنا ليس «تضخّمَ بيانات» بل «قراءةٌ وسّعت النطاق»** — وهو بعينه ما
 * أراد قب-٤٨ أن ينزع عنه الصمت: يُضيَّق النطاقُ، وإن تعذّر فهذا **زنادُ CR-026** لا رفعٌ صامت.
 *
 * > **والضعفُ يُقال لا يُجمَّل**: البندُ المهيمنُ (خطُّ الزمن) تقديرٌ مجمَّعٌ لا قياس، وهو
 * > **جدولُ ربطٍ** قد تتجاوز ذروتُه هذا الرقم يوم يُقاس فعلاً. فإن قِيست المكتبةُ يوماً
 * > **يُراجَع هذا السقف بالرقم المقيس** — ورقمٌ يبدو دقيقاً بلا سندٍ أسوأُ من مُعلَنِ الضعف.
 */
const ROW_BUDGET = 50_000

function table(rows: RowSet, name: string): ReadonlyMap<string, SqlRow> {
  return rows.get(name) ?? new Map<string, SqlRow>()
}

function collect(entries: readonly SqlRow[], name: string): [string, ReadonlyMap<string, SqlRow>] {
  const spec = tableSpec(name)
  return [name, new Map(entries.map((entry) => [primaryKeyOf(spec, entry), entry]))]
}

export function persistentLibrary(store: LibraryStore): PersistentStore {
  const tenantId = store.tenantId
  /** أعلى عدّادٍ رآه التحميل — يصون الحتميّة حين يكون النطاقُ جزئياً. */
  let hydratedSeq = 0

  /** مفتاحُ توجيه خطِّ الزمن **مشتقٌّ من مادته** — ولا يُخترع (انظر الفرق ٢ أعلاه). */
  const progressPath = (materialId: string, personId: string): string => {
    const material = store.getMaterial(materialId)
    if (material === null) {
      throw new Error(
        `مفتاحُ توجيهٍ لا يُشتقّ: خطُّ زمنِ ${personId} يشير إلى مادةٍ مجهولة ${materialId}`,
      )
    }
    return material.unitPath
  }

  const derivedSeq = (): number => {
    let max = hydratedSeq
    for (const material of store.materials()) max = Math.max(max, suffixOf(material.id))
    return max
  }

  return {
    name: SOURCE,
    rowBudget: ROW_BUDGET,
    tables: [
      "library_units",
      "library_categories",
      "library_audiences",
      "library_formats",
      "library_materials",
      "library_progress",
      { table: "sequences", owns: (r) => r["name"] === SEQUENCE },
    ],

    project: () =>
      new Map([
        collect(
          store.units().map((unit) => ({
            tenant_id: tenantId,
            unit_path: unit.path,
            id: unit.id,
            ar: unit.ar,
          })),
          "library_units",
        ),
        collect(
          store.categories().map((category) => ({
            tenant_id: tenantId,
            unit_path: TENANT_ROOT_PATH,
            id: category.id,
            ar: category.ar,
          })),
          "library_categories",
        ),
        collect(
          store.audiences().map((audience) => ({
            tenant_id: tenantId,
            unit_path: TENANT_ROOT_PATH,
            id: audience.id,
            ar: audience.ar,
            capability_id: audience.capabilityId,
          })),
          "library_audiences",
        ),
        collect(
          store.formats().map((format) => ({
            tenant_id: tenantId,
            unit_path: TENANT_ROOT_PATH,
            id: format.id,
            content_type: format.contentType,
            active: encodeBoolean(format.active),
          })),
          "library_formats",
        ),
        collect(
          store.materials().map((material) => ({
            tenant_id: tenantId,
            unit_path: material.unitPath,
            id: material.id,
            title_ar: material.titleAr,
            category_id: material.categoryId,
            audience_id: material.audienceId,
            kind: material.kind,
            unit_id: material.unitId,
            mandatory: encodeBoolean(material.mandatory),
            storage_key: material.storageKey,
            content_type: material.contentType,
            size_bytes: material.sizeBytes,
            external_url: material.externalUrl,
            created_by: material.createdBy,
            created_at: encodeDate(material.createdAt),
            archived_at: encodeNullable(material.archivedAt, encodeDate),
            archived_by: material.archivedBy,
          })),
          "library_materials",
        ),
        collect(
          store.progress().map((progress) => ({
            tenant_id: tenantId,
            unit_path: progressPath(progress.materialId, progress.personId),
            material_id: progress.materialId,
            person_id: progress.personId,
            delivered_at: encodeDate(progress.deliveredAt),
            opened_at: encodeNullable(progress.openedAt, encodeDate),
            completed_at: encodeNullable(progress.completedAt, encodeDate),
          })),
          "library_progress",
        ),
        collect([sequenceRow(tenantId, SEQUENCE, derivedSeq())], "sequences"),
      ]),

    load: (rows) => {
      for (const row of table(rows, "library_units").values()) {
        store.saveUnit({
          tenantId,
          id: readText(row, "id"),
          ar: readText(row, "ar"),
          path: readText(row, "unit_path"),
        })
      }
      for (const row of table(rows, "library_categories").values()) {
        store.saveCategory({ tenantId, id: readText(row, "id"), ar: readText(row, "ar") })
      }
      for (const row of table(rows, "library_audiences").values()) {
        store.saveAudience({
          tenantId,
          id: readText(row, "id"),
          ar: readText(row, "ar"),
          capabilityId: readText(row, "capability_id") as CapId,
        })
      }
      for (const row of table(rows, "library_formats").values()) {
        store.saveFormat({
          tenantId,
          id: readText(row, "id"),
          contentType: readText(row, "content_type"),
          active: readBoolean(row, "active"),
        })
      }
      for (const row of table(rows, "library_materials").values()) {
        store.saveMaterial({
          tenantId,
          id: readText(row, "id"),
          titleAr: readText(row, "title_ar"),
          categoryId: readText(row, "category_id"),
          audienceId: readText(row, "audience_id"),
          kind: readText(row, "kind") as MaterialKind,
          unitId: readText(row, "unit_id"),
          unitPath: readText(row, "unit_path"),
          mandatory: readBoolean(row, "mandatory"),
          storageKey: readTextOrNull(row, "storage_key"),
          contentType: readTextOrNull(row, "content_type"),
          sizeBytes: readIntOrNull(row, "size_bytes"),
          externalUrl: readTextOrNull(row, "external_url"),
          createdBy: readText(row, "created_by"),
          createdAt: readDate(row, "created_at"),
          archivedAt: readDateOrNull(row, "archived_at"),
          archivedBy: readTextOrNull(row, "archived_by"),
        })
      }
      for (const row of table(rows, "library_progress").values()) {
        store.saveProgress({
          tenantId,
          materialId: readText(row, "material_id"),
          personId: readText(row, "person_id"),
          deliveredAt: readDate(row, "delivered_at"),
          openedAt: readDateOrNull(row, "opened_at"),
          completedAt: readDateOrNull(row, "completed_at"),
        })
      }

      const stored = table(rows, "sequences").get(naturalKey(tenantId, SEQUENCE))
      hydratedSeq = Math.max(derivedSeq(), stored === undefined ? 0 : readInt(stored, "value"))
      // العدّادُ يُستأنف ولا يعود صفراً — وإلا دهس معرّفٌ جديدٌ معرّفاً محفوظاً خارج النطاق.
      for (let i = 0; i < hydratedSeq; i += 1) store.nextId("_hydrate")
    },
  }
}
