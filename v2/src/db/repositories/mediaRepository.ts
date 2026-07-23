/**
 * مستودعُ الإعلام على D1 — **خلف العقد القائم بلا تغيير توقيعٍ واحد**.
 *
 * لا صنفَ جديدٌ ولا وكيلٌ ولا اعتراضُ نداءات: المستودعُ الذي تراه الخدمةُ هو `MediaStore`
 * نفسُه حرفياً، وهذا الملفُّ **يُسقطه ويُحمّله** لا غير (`db/README.md` الحسم ١، الطبقة ٢).
 * ولذلك لم يُعدَّل في `services/*` ولا في `server/endpoints.ts` سطرٌ واحد.
 *
 * ### ثلاثةُ فروقٍ عن العُهد تستحقّ أن تُقال — لأنها مواضعُ الاجتهاد في هذه الوحدة
 * ١. **مفتاحُ توجيه المادة ليس جذرَ الشبكة كما تُوقِّع.** توقّع تقريرُ العُهد «جمهوراً أوسعَ
 *    من وحدة ⟵ قد تحتاج الجذر». لكنّ المرآةَ الشبكية **خارجُ النطاق نصّاً** (ز-٤/ق-١٠٧):
 *    كلُّ تغطيةٍ لها **وحدةٌ بعينها**، فتوجيهُها مسارُ وحدتها. والصورةُ **تُشتقّ من تغطيتها**
 *    (نظيرُ حركةِ العُهد من أصلها)، وتغطيةٌ مجهولةٌ ⟵ **رميةٌ** لا توجيهٌ إلى الجذر صامتاً.
 *    والجذرُ `/` **للمعجمَين وحدهما** — بياناتٌ مرجعيةٌ نطاقُها الشبكةُ كلُّها صدقاً لا حشواً.
 * ٢. **العدّادُ يُستهلَك مرّتين لكلِّ صورة.** `addPhoto` تنادي `nextId` **مرّتين**: للمعرّف
 *    (`mp-N`) **ولمفتاح التخزين** (`media/<تغطية>-{N+1}`). فاشتقاقُ العدّاد من لواحق المعرّفات
 *    وحدها **يُنقص نبضةَ مفتاح التخزين** ⟵ جلسةٌ لاحقةٌ تُعيد استعمال رقمٍ فتدهس. فالاشتقاقُ
 *    هنا يقرأ العدّادَ من **معرّفات التغطيات ولواحق مفاتيح التخزين معاً** (الأخيرُ يحمل النبضةَ
 *    الأعلى)، والعدّادُ يُخزَّن في `sequences` ويُستأنف بالأعلى بين المشتقّ والمحفوظ.
 * ٣. **لا سجلَّ تدقيقٍ في هذه الوحدة.** العُهدُ حملت `CustodyAuditRecord` محلياً فوُحِّد
 *    (CR-027)؛ أمّا الإعلامُ فطبقةُ بياناته **لا تكتب قيدَ تدقيقٍ أصلاً** (لا `AuditJournal`
 *    في `MediaStore` ولا في خدماته) — فلا شيءَ يُوحَّد، ووحدةُ العمل هنا **مصدرٌ واحد**.
 */

import {
  encodeBoolean,
  encodeDate,
  encodeNullable,
  readBoolean,
  readDate,
  readDateOrNull,
  readInt,
  readText,
  readTextOrNull,
} from "../encode.js"
import { tableSpec } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"
import { naturalKey, primaryKeyOf, type PersistentStore, type RowSet } from "../unitOfWork.js"
import { MediaStore } from "../../features/media/data/store.js"
import { sequenceRow, suffixOf } from "./shared.js"

const SOURCE = "media"
const SEQUENCE = "media.seq"

/**
 * سقفُ صفوف وحدة العمل (G23 · CR-026 ب · قب-٤٨) — **مشتقٌّ لا مُقدَّر، وبضعفٍ مُصرَّحٍ به**.
 *
 * جلسةُ الإعلام الواقعيّة نطاقُها **وحدةٌ أو قسم** (المعرضُ الهابط · «تغطياتي» · رفعُ صورة)،
 * لا الشبكةُ كلُّها. والمحمولُ خمسةُ جداول:
 *  · **الوحدات**: ADR-001 §١-٥ يقيس **~٨٦٠** وحدةً للشبكة كلِّها اليوم.
 *  · **المعجمان** (`media_kinds`/`media_formats`): بجذر الشبكة فيُحمَّلان دائماً — **عشراتٌ**
 *    لا مئات (قواميسُ مُدارةٌ باليد)، فأقدّرهما بسخاءٍ **~٢٠٠** مجتمعَين.
 *  · **التغطياتُ وصورُها**: **غيرُ مقيسة** — `media_coverages` في v1 (هجرة `0075`) ليست ضمن
 *    جداول ADR §١-١/§١-٣ المقيسة، فلا أدّعي رقماً لم يُقَس. وأقربُ إسنادٍ صادق ملحقُ ADR أ:
 *    «باقي الـ٩٥ جدولاً — تقديرٌ مجمَّع **١٠٪**» ⟵ ~٢٬٠٠٠ صفٍّ لكلِّ جدولٍ منها في السنة على
 *    مستوى الشبكة، والجدولان (تغطيات + صور) بالاحتفاظ سنتين (قب-٦) ⟵ **~٨٬٠٠٠** مجتمعَين.
 *
 * فالسقفُ **١٥٬٠٠٠** يسع الشبكةَ كلَّها (~٩٬٠٠٠) بهامشٍ ~١.٦×، بينما الجلسةُ الواقعية **نطاقُ
 * وحدةٍ أو قسم** أي جزءٌ يسيرٌ منه. ولذلك **أوّلُ تجاوزٍ هنا ليس «تضخّمَ بيانات» بل «قراءةٌ
 * وسّعت النطاق»** إلى ما يقارب الشبكة — وهو بعينه ما أراد قب-٤٨ أن ينزع عنه الصمت.
 *
 * > **والضعفُ يُقال لا يُجمَّل**: أخطرُ ضلعٍ **كثافةُ الألبوم** — الصورُ لكلِّ تغطيةٍ قد تفوق
 * > تقديرَ «جدولٍ من الـ٩٥» الموحّد؛ فمصدرُ الرقم تقديرٌ مجمَّعٌ لا قياسٌ مباشر. فإن قِيست
 * > مادةُ الشبكة يوماً **يُراجَع هذا السقف بالرقم المقيس**، وهذا أصدقُ من رقمٍ يبدو دقيقاً
 * > بلا سند. وإن تعذّر تضييقُ نطاقِ جلسةٍ مشروعةٍ تجاوزته فذلك **زنادُ CR-026** (قب-٤٨).
 */
const ROW_BUDGET = 15_000

function table(rows: RowSet, name: string): ReadonlyMap<string, SqlRow> {
  return rows.get(name) ?? new Map<string, SqlRow>()
}

function collect(entries: readonly SqlRow[], name: string): [string, ReadonlyMap<string, SqlRow>] {
  const spec = tableSpec(name)
  return [name, new Map(entries.map((entry) => [primaryKeyOf(spec, entry), entry]))]
}

/** لاحقةُ رقمٍ في ذيل مفتاح التخزين (`media/mc-1-3` ⟵ ٣) — نبضةُ العدّاد الأعلى للصورة. */
function trailingSeq(value: string): number {
  const match = /-(\d+)$/.exec(value)
  return match === null ? 0 : Number(match[1])
}

export function persistentMedia(store: MediaStore): PersistentStore {
  const tenantId = store.tenantId
  /** أعلى عدّادٍ رآه التحميل — يصون الحتميّة حين يكون النطاقُ جزئياً. */
  let hydratedSeq = 0

  /** مفتاحُ توجيه الصورة **مشتقٌّ من تغطيتها** — ولا يُخترع (انظر الفرق ١ أعلاه). */
  const photoPath = (coverageId: string, photoId: string): string => {
    const coverage = store.getCoverage(coverageId)
    if (coverage === null) {
      throw new Error(
        `مفتاحُ توجيهٍ لا يُشتقّ: صورةُ الإعلام ${photoId} تشير إلى تغطيةٍ مجهولة ${coverageId}`,
      )
    }
    return coverage.unitPath
  }

  const derivedSeq = (): number => {
    let max = hydratedSeq
    for (const coverage of store.coverages()) max = Math.max(max, suffixOf(coverage.id))
    // الصورةُ تحمل نبضتين: معرّفُها ومفتاحُ تخزينها — والأخيرُ أعلى، فيُقرأ منه أيضاً.
    for (const photo of store.photos()) {
      max = Math.max(max, suffixOf(photo.id), trailingSeq(photo.storageKey))
    }
    return max
  }

  return {
    name: SOURCE,
    rowBudget: ROW_BUDGET,
    tables: [
      "media_units",
      "media_kinds",
      "media_formats",
      "media_coverages",
      "media_photos",
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
          "media_units",
        ),
        collect(
          store.kinds().map((kind) => ({
            tenant_id: tenantId,
            // المعجمُ نطاقُه الشبكةُ كلُّها — جذرٌ صادقٌ لا حشو (README الحسم ٢).
            unit_path: "/",
            id: kind.id,
            ar: kind.ar,
            active: encodeBoolean(kind.active),
          })),
          "media_kinds",
        ),
        collect(
          store.formats().map((format) => ({
            tenant_id: tenantId,
            unit_path: "/",
            id: format.id,
            content_type: format.contentType,
            active: encodeBoolean(format.active),
          })),
          "media_formats",
        ),
        collect(
          store.coverages().map((coverage) => ({
            tenant_id: tenantId,
            unit_path: coverage.unitPath,
            id: coverage.id,
            title_ar: coverage.titleAr,
            kind_id: coverage.kindId,
            unit_id: coverage.unitId,
            occurred_on: encodeDate(coverage.occurredOn),
            publisher_person_id: coverage.publisherPersonId,
            created_at: encodeDate(coverage.createdAt),
            // «سحبُ المنشور» حالةٌ لا حذف: الحقلان يعبران القاعدةَ على الصفّ نفسِه.
            deleted_at: encodeNullable(coverage.deletedAt, encodeDate),
            deleted_by: coverage.deletedBy,
          })),
          "media_coverages",
        ),
        collect(
          store.photos().map((photo) => ({
            tenant_id: tenantId,
            unit_path: photoPath(photo.coverageId, photo.id),
            id: photo.id,
            coverage_id: photo.coverageId,
            storage_key: photo.storageKey,
            content_type: photo.contentType,
            size_bytes: photo.sizeBytes,
            uploaded_by: photo.uploadedBy,
            uploaded_at: encodeDate(photo.uploadedAt),
          })),
          "media_photos",
        ),
        collect([sequenceRow(tenantId, SEQUENCE, derivedSeq())], "sequences"),
      ]),

    load: (rows) => {
      for (const row of table(rows, "media_units").values()) {
        store.saveUnit({
          tenantId,
          id: readText(row, "id"),
          ar: readText(row, "ar"),
          path: readText(row, "unit_path"),
        })
      }
      for (const row of table(rows, "media_kinds").values()) {
        store.saveKind({
          tenantId,
          id: readText(row, "id"),
          ar: readText(row, "ar"),
          active: readBoolean(row, "active"),
        })
      }
      for (const row of table(rows, "media_formats").values()) {
        store.saveFormat({
          tenantId,
          id: readText(row, "id"),
          contentType: readText(row, "content_type"),
          active: readBoolean(row, "active"),
        })
      }
      for (const row of table(rows, "media_coverages").values()) {
        store.saveCoverage({
          tenantId,
          id: readText(row, "id"),
          titleAr: readText(row, "title_ar"),
          kindId: readText(row, "kind_id"),
          unitId: readText(row, "unit_id"),
          unitPath: readText(row, "unit_path"),
          occurredOn: readDate(row, "occurred_on"),
          publisherPersonId: readText(row, "publisher_person_id"),
          createdAt: readDate(row, "created_at"),
          deletedAt: readDateOrNull(row, "deleted_at"),
          deletedBy: readTextOrNull(row, "deleted_by"),
        })
      }
      for (const row of table(rows, "media_photos").values()) {
        store.savePhoto({
          tenantId,
          id: readText(row, "id"),
          coverageId: readText(row, "coverage_id"),
          storageKey: readText(row, "storage_key"),
          contentType: readText(row, "content_type"),
          sizeBytes: readInt(row, "size_bytes"),
          uploadedBy: readText(row, "uploaded_by"),
          uploadedAt: readDate(row, "uploaded_at"),
        })
      }

      const stored = table(rows, "sequences").get(naturalKey(tenantId, SEQUENCE))
      hydratedSeq = Math.max(derivedSeq(), stored === undefined ? 0 : readInt(stored, "value"))
      // العدّادُ يُستأنف ولا يعود صفراً — وإلا دهس معرّفٌ جديدٌ معرّفاً محفوظاً خارج النطاق.
      for (let i = 0; i < hydratedSeq; i += 1) store.nextId("_hydrate")
    },
  }
}
