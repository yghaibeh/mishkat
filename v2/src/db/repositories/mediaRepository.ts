/**
 * مستودعا الإعلام على D1 — **خلف العقد القائم بلا تغيير توقيعٍ واحد**.
 *
 * لا صنفَ جديدٌ ولا وكيلٌ ولا اعتراضُ نداءات: المستودعُ الذي تراه الخدمةُ هو `MediaStore`
 * نفسُه حرفياً، وهذا الملفُّ **يُسقطه ويُحمّله** لا غير (`db/README.md` الحسم ١، الطبقة ٢).
 * ولذلك لم يُعدَّل في `services/*` ولا في `server/endpoints.ts` سطرٌ واحد.
 *
 * ---
 *
 * ## ⚠️ **مصنعان لا واحد** — شكلُ التوجيه واحدٌ لكلِّ مستودع (وصفة §٤-٠ · CR-029)
 *
 * جداولُ الإعلام **صنفان مختلفا شكلِ التوجيه**، فلا يجمعهما مستودعٌ واحد:
 *
 * | المصنع | جداولُه | شكلُ التوجيه |
 * |---|---|---|
 * | `persistentMediaCatalog` | `media_kinds` · `media_formats` | **الجذرُ `/`** — معجمان مرجعيّان شبكيّان |
 * | `persistentMediaEntries` | `media_units` · `media_coverages` · `media_photos` | **مسارُ الوحدة** — إسقاطٌ وبياناتٌ تشغيلية |
 *
 * **ولماذا الفصل؟** وحدةُ العمل تُحمَّل **بنطاقٍ واحد**، والمستودعُ يملك جداولَه كلَّها معاً.
 * فلو اجتمع المعجمان (الشبكيّان) مع التغطيات والصور (بالوحدة) في مصنعٍ واحد، لصارت **قراءةُ
 * المعجم بالجذر** تُحمّل `LIKE '/%'` ⟵ **كلَّ تغطيات الشبكة وصورَها**؛ أي **يفرض أضيقُهما
 * نطاقاً على أوسعِهما حملَه**. وهذا ما قِيس في `dailyLog` (~٨٣٢ ألف قيد) فاستُخرجت منه القاعدة.
 * والعلاجُ **فصلُ المصنعين لا رفعُ السقف** — فسقفٌ بحجم الشبكة لا يحرس شيئاً.
 *
 * > **وفي الإعلام العيبُ كان كامناً لا واقعاً**: لا سطحَ اليومَ يقرأ المعجمَ بالجذر (سطوحُ
 * > الوحدة الخمسة كلُّها بنطاق وحدةٍ أو ملكية — عقدُ الوحدة §٦). فالفصلُ هنا **بناءٌ صحيحٌ من
 * > أوّله** لا إصلاحُ عطبٍ واقع، وهو ما أرادته CR-029 حين بثّت القاعدةَ على الباقيات: *ما يُنسخ
 * > في موجةٍ متوازية يُصحَّح قبلها لا بعدها.*
 *
 * > و`sequences` يملكها مصنعُ القيود بـ`owns` — **صفٌّ واحدٌ بالجذر** لا كتالوجٌ ينمو، فلا
 * > يفرض على شيءٍ حملَه (وهو ما تفعله المستودعاتُ المهاجَرة كلُّها).
 *
 * ---
 *
 * ### وثلاثةُ فروقٍ عن العُهد تستحقّ أن تُقال — لأنها مواضعُ الاجتهاد في هذه الوحدة
 * ١. **مفتاحُ توجيه المادة ليس جذرَ الشبكة كما تُوقِّع.** توقّع تقريرُ العُهد «جمهوراً أوسعَ
 *    من وحدة ⟵ قد تحتاج الجذر». لكنّ المرآةَ الشبكية **خارجُ النطاق نصّاً** (ز-٤/ق-١٠٧):
 *    كلُّ تغطيةٍ لها **وحدةٌ بعينها**، فتوجيهُها مسارُ وحدتها. والصورةُ **تُشتقّ من تغطيتها**
 *    (نظيرُ حركةِ العُهد من أصلها)، وتغطيةٌ مجهولةٌ ⟵ **رميةٌ** لا توجيهٌ إلى الجذر صامتاً.
 *    والجذرُ `/` **للمعجمَين وحدهما** — وقد صارا مصنعَهما المستقلّ (أعلاه).
 * ٢. **العدّادُ يُستهلَك مرّتين لكلِّ صورة.** `addPhoto` تنادي `nextId` **مرّتين**: للمعرّف
 *    (`mp-N`) **ولمفتاح التخزين** (`media/<تغطية>-{N+1}`). فاشتقاقُ العدّاد من لواحق المعرّفات
 *    وحدها **يُنقص نبضةَ مفتاح التخزين** ⟵ جلسةٌ لاحقةٌ تُعيد استعمال رقمٍ فتدهس. فالاشتقاقُ
 *    هنا يقرأ العدّادَ من **معرّفات التغطيات ولواحق مفاتيح التخزين معاً** (الأخيرُ يحمل النبضةَ
 *    الأعلى)، والعدّادُ يُخزَّن في `sequences` ويُستأنف بالأعلى بين المشتقّ والمحفوظ.
 * ٣. **لا سجلَّ تدقيقٍ في هذه الوحدة.** العُهدُ حملت `CustodyAuditRecord` محلياً فوُحِّد
 *    (CR-027)؛ أمّا الإعلامُ فطبقةُ بياناته **لا تكتب قيدَ تدقيقٍ أصلاً** (لا `AuditJournal`
 *    في `MediaStore` ولا في خدماته) — فلا شيءَ يُوحَّد.
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
import { TENANT_ROOT_PATH, tableSpec } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"
import { naturalKey, primaryKeyOf, type PersistentStore, type RowSet } from "../unitOfWork.js"
import { MediaStore } from "../../features/media/data/store.js"
import { sequenceRow, suffixOf } from "./shared.js"

const CATALOG_SOURCE = "mediaCatalog"
const ENTRIES_SOURCE = "mediaEntries"
const SEQUENCE = "media.seq"

/**
 * سقفُ **المعجمَين** (G23) — معجمان يُداران باليد، لا ينموان بنمو العمل.
 *
 * `media_kinds` أنواعُ التغطية (ق-١٠٣) و`media_formats` صيغُ الرفع المقبولة (المادة ٨/٤):
 * **عشراتٌ لا مئات** — قائمتان يحرّرهما أدمنٌ، ونظيرُهما المقيس شجرةُ الحسابات (ADR §١-١:
 * عشراتُ الصفوف). فأقدّرهما بسخاءٍ **~٢٠٠** مجتمعَين، والسقفُ **١٬٠٠٠** هامشٌ ~٥×.
 *
 * > **والضعفُ يُقال**: الرقمُ **تقديرٌ لا قياس** — لا ADR يقيس معجمَي الإعلام. وسخاءُ الهامش
 * > هنا رخيصٌ (جدولان صغيران)، وبلوغُ ألفِ صنفٍ في معجمٍ يدويٍّ **عَرَضُ خطأٍ يستحقّ الحمرة**.
 */
const CATALOG_ROW_BUDGET = 1_000

/**
 * سقفُ **القيود** (G23 · CR-026 ب · قب-٤٨) — **مشتقٌّ لا مُقدَّر، وبضعفٍ مُصرَّحٍ به**.
 *
 * جلسةُ الإعلام الواقعيّة نطاقُها **وحدةٌ أو قسم** (المعرضُ الهابط · «تغطياتي» · رفعُ صورة).
 * والمحمولُ ثلاثةُ جداول:
 *  · **الوحدات**: ADR-001 §١-٥ يقيس **~٨٦٠** وحدةً للشبكة كلِّها اليوم.
 *  · **التغطياتُ وصورُها**: **غيرُ مقيسة** — `media_coverages` في v1 (هجرة `0075`) ليست ضمن
 *    جداول ADR §١-١/§١-٣ المقيسة، فلا أدّعي رقماً لم يُقَس. وأقربُ إسنادٍ صادق ملحقُ ADR أ:
 *    «باقي الـ٩٥ جدولاً — تقديرٌ مجمَّع **١٠٪**» ⟵ ~٢٬٠٠٠ صفٍّ لكلِّ جدولٍ منها في السنة على
 *    مستوى الشبكة، والجدولان (تغطيات + صور) بالاحتفاظ سنتين (قب-٦) ⟵ **~٨٬٠٠٠** مجتمعَين.
 *
 * فالسقفُ **١٥٬٠٠٠** يسع الشبكةَ كلَّها (~٨٬٩٠٠) بهامشٍ ~١.٧×، بينما الجلسةُ الواقعية **نطاقُ
 * وحدةٍ أو قسم** أي جزءٌ يسيرٌ منه. ولذلك **أوّلُ تجاوزٍ هنا ليس «تضخّمَ بيانات» بل «قراءةٌ
 * وسّعت النطاق»** إلى ما يقارب الشبكة.
 *
 * > **والضعفُ يُقال لا يُجمَّل**: أخطرُ ضلعٍ **كثافةُ الألبوم** — الصورُ لكلِّ تغطيةٍ قد تفوق
 * > تقديرَ «جدولٍ من الـ٩٥» الموحّد؛ فمصدرُ الرقم تقديرٌ مجمَّعٌ لا قياسٌ مباشر. فإن قِيست
 * > مادةُ الشبكة يوماً **يُراجَع هذا السقف بالرقم المقيس**. وإن تجاوزته جلسةٌ مشروعة فأوّلُ
 * > الدواء **تضييقُ النطاق** — ولا يُسمّى ذلك «زنادَ CR-026» إلا إن **تعذّر** التضييقُ حقاً
 * > (قب-٤٨ · تصحيحُ CR-029: الزنادُ صمّامٌ لا يُحرق على حالةٍ لها علاجٌ أرخص).
 */
const ENTRIES_ROW_BUDGET = 15_000

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

/**
 * **معجما الإعلام** — بياناتٌ مرجعيةٌ شبكيةٌ تسكن الجذر، ويُقرآن من كلِّ وحدة.
 * مصنعٌ مستقلٌّ عن القيود (وصفة §٤-٠): جلسةٌ تريد المعجمَ **لا تلمس تغطيةً ولا صورة**.
 */
export function persistentMediaCatalog(store: MediaStore): PersistentStore {
  const tenantId = store.tenantId

  return {
    name: CATALOG_SOURCE,
    rowBudget: CATALOG_ROW_BUDGET,
    tables: ["media_kinds", "media_formats"],

    project: () =>
      new Map([
        collect(
          store.kinds().map((kind) => ({
            tenant_id: tenantId,
            // المعجمُ نطاقُه الشبكةُ كلُّها — جذرٌ صادقٌ لا حشو (README الحسم ٢).
            unit_path: TENANT_ROOT_PATH,
            id: kind.id,
            ar: kind.ar,
            active: encodeBoolean(kind.active),
          })),
          "media_kinds",
        ),
        collect(
          store.formats().map((format) => ({
            tenant_id: tenantId,
            unit_path: TENANT_ROOT_PATH,
            id: format.id,
            content_type: format.contentType,
            active: encodeBoolean(format.active),
          })),
          "media_formats",
        ),
      ]),

    load: (rows) => {
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
    },
  }
}

/**
 * **قيودُ الإعلام** — إسقاطُ الوحدات والتغطياتُ وألبوماتُها، كلُّها **بمسار وحدتها**.
 * وهي الجداولُ التي تنمو بنمو العمل، فسقفُها مُسنَدٌ إلى حمولتها وحدَها.
 */
export function persistentMediaEntries(store: MediaStore): PersistentStore {
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
    name: ENTRIES_SOURCE,
    rowBudget: ENTRIES_ROW_BUDGET,
    tables: [
      "media_units",
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
