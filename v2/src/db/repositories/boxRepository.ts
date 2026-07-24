/**
 * مستودعا الصندوق على D1 — **خلف العقد القائم بلا تغيير توقيعٍ واحد**.
 *
 * لا صنفَ جديدٌ ولا وكيلٌ ولا اعتراضُ نداءات: المستودعُ الذي تراه الخدمةُ هو `BoxStore`
 * نفسُه حرفياً، وهذا الملفُّ **يُسقطه ويُحمّله** لا غير (`db/README.md` الحسم ١، الطبقة ٢).
 * ولذلك لم يُعدَّل في `services/*` ولا في `server/endpoints.ts` سطرٌ واحد.
 *
 * ---
 *
 * ## ⚠️ **مصنعان لا واحد** — شكلُ التوجيه واحدٌ لكلِّ مستودع (وصفة §٤-٠ · CR-029)
 *
 * | المصنع | جدولُه | شكلُ التوجيه |
 * |---|---|---|
 * | `persistentBoxCatalog` | `box_categories` | **الجذرُ `/`** — قاموسٌ مرجعيٌّ شبكيّ (النمط ب) |
 * | `persistentBoxHandovers` | `box_handovers` | **مسارُ وحدة الوجهة** — تشغيليٌّ بالوحدة (النمط أ) |
 *
 * **ولماذا الفصل؟** وحدةُ العمل تُحمَّل **بنطاقٍ واحد**، والمستودعُ يملك جداولَه كلَّها معاً.
 * فلو اجتمع القاموسُ (الشبكيّ) مع التسليمات (بالوحدة) في مصنعٍ واحد، لصارت **قراءةُ القاموس
 * بالجذر** تُحمّل `LIKE '/%'` ⟵ **كلَّ تسليمات الشبكة**؛ أي **يفرض أضيقُهما نطاقاً على
 * أوسعِهما حملَه**. وهذا ما قِيس في `dailyLog` (~٨٣٢ ألف قيد) فاستُخرجت منه القاعدة،
 * **والعلاجُ فصلُ المصنعين لا رفعُ السقف** — فسقفٌ بحجم الشبكة لا يحرس شيئاً.
 *
 * > **وهنا — كما في `media` — العيبُ كامنٌ لا واقع**: لا سطحَ اليوم يقرأ القاموسَ بالجذر
 * > (سطوحُ الوحدة الثمانية كلُّها `unitScope` أو `selfScope` — `server/endpoints.ts`).
 * > فالفصلُ **بناءٌ صحيحٌ من أوّله** لا إصلاحُ عطبٍ واقع: *ما يُنسخ في موجةٍ يُصحَّح قبلها.*
 *
 * ---
 *
 * ### وثلاثةُ فروقٍ عن العُهد تستحقّ أن تُقال — لأنها مواضعُ الاجتهاد في هذه الوحدة
 * ١. **مفتاحُ توجيه التسليم لا يُشتقّ من كيانٍ آخر بل يُقرأ من الكيان نفسِه — ومسوَّغٌ بنصّ.**
 *    التسليمُ يحمل مسارين (`fromUnitPath`/`toUnitPath`)، والاختيارُ بينهما **قرارٌ لا نسخ**:
 *    ق-٦١ يوجب أن تكون الوجهةُ **محتواةً في المصدر احتواءً صارماً** (`contains(from, to)`
 *    في `handoverDown`)، فالوجهةُ **أعمقُ المسارين دائماً** ⟵ كلُّ نطاقٍ يحوي المصدرَ يحوي
 *    الوجهةَ ولا عكس. فالتوجيهُ بالوجهة **أضيقُ مفتاحٍ صادقٍ يُبقي الطرفين قارئَين**، وهو
 *    نفسُه نطاقُ قيد تدقيق التسليم (`box.handover` ⟵ `to.path`) فلا يُقرأ الحدثُ بلسانين.
 *    > **وسؤالُ الوصفة (فخّ ٤): أيتحرّك مفتاحُ توجيه صفٍّ بعد كتابته؟** **لا، بدليلٍ منصوص**:
 *    > الجدولُ ملحقٌ فقط، والكاتبُ الوحيدُ بعد الإنشاء هو `acknowledgeHandover` وهو **لا
 *    > يمسّ المسارين** (`{ ...handover, acknowledgedBy, acknowledgedAt }`). فلا يُعاد كتابةُ
 *    > صفٍّ ملحقٍ فقط بمفتاحٍ جديد — وهو العطبُ الذي لا يظهر إلا يوم تُنقل وحدةٌ في الشجرة.
 * ٢. **التحميلُ حشوٌ لا إعادةُ تشغيل** (وصفة §٤-٥): `saveCategory`/`saveHandover` تستقبلان
 *    الكيانَ **بمعرّفه**، فيكفي **استئنافُ العدّاد** بالأعلى بين المشتقّ والمحفوظ. والعدّادُ
 *    يُشتقّ من **معرّفات التسليمات وحدها** (`hnd-N`): معرّفاتُ الفئات **يضعها مديرُ القاموس**
 *    (`fuel`/`transport`) ولا تخرج من عدّاد المستودع — فاشتقاقُها منها كان سيقيس ما لا يُقاس.
 * ٣. **لا عدّادَ مشتقٌّ في هذه الوحدة، والرولّ-أب القائمُ لا يُوازى.** رصيدُ الصندوق
 *    `fundBalance` **يعيش في الدفتر** رولّ-أباً مبنيّاً في T26-أ (`fund_balances` — README §٤)،
 *    وهذه الوحدةُ **تقرؤه ولا تكتبه ولا تبني ثانياً**: ليس في `BoxStore` حقلُ رصيدٍ ولا مجموع
 *    (ق-٦٠)، ولا في هذا الملفّ جدولُ رولّ-أب. **مسارُ الكتابة الوحيد يبقى `appendLine`.**
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
import { BoxStore } from "../../features/box/data/store.js"
import { sequenceRow, suffixOf } from "./shared.js"

const CATALOG_SOURCE = "boxCatalog"
const HANDOVERS_SOURCE = "boxHandovers"
const SEQUENCE = "box.seq"

/**
 * سقفُ **القاموس** (G23) — قاموسٌ مغلقٌ مركزيٌّ يُدار باليد (ق-٦٤)، لا ينمو بنمو العمل.
 *
 * فئاتُ الصرف **عشراتٌ لا مئات**: قائمةٌ يحرّرها أدمنٌ، ونظيرُها المقيس شجرةُ الحسابات
 * (ADR §١-١: عشراتُ الصفوف). فأقدّرها بسخاءٍ **~٢٠٠**، والسقفُ **١٬٠٠٠** هامشٌ ~٥×.
 *
 * > **والضعفُ يُقال**: الرقمُ **تقديرٌ لا قياس** — لا ADR يقيس قاموسَ فئات الصرف. وسخاءُ
 * > الهامش هنا رخيصٌ (جدولٌ صغيرٌ واحد)، وبلوغُ ألفِ فئةٍ في قاموسٍ يدويٍّ **عَرَضُ خطأٍ
 * > يستحقّ الحمرة** لا نموٌّ مشروع.
 */
const CATALOG_ROW_BUDGET = 1_000

/**
 * سقفُ **التسليمات** (G23 · CR-026 ب · قب-٤٨) — **مشتقٌّ لا مُقدَّر، وبضعفٍ مُصرَّحٍ به**.
 *
 * > **والمرساةُ ما يُقرأ فعلاً لا ما يُتصوَّر** (CR-030): مُسحت `server/endpoints.ts` كلُّها،
 * > فسطوحُ هذه الوحدة **ثمانيةٌ** لا تاسعَ لها: سبعةٌ `unitScope(unit.path)` وواحدةٌ
 * > `selfScope`. **وأوسعُ نطاقٍ يقرؤه سطحٌ مُعلَنٌ فعلاً = وحدةُ قسم** (`/men/`)، ويبلغه
 * > **`box.handovers.view` باسمه** (ومعه `box.unit.view` و`mosqueFinance.view`) — إذ يقبل
 * > `unitId` أيَّ وحدةٍ في الدفتر بما فيها عقدةُ القسم. فإن اتّسع سطحٌ يوماً إلى الشبكة
 * > حَمُر السقفُ وسُئل السؤالُ الصحيح: **أيتّسع بدليلٍ أم يُضيَّق السطح؟**
 *
 * والمحمولُ لهذا المصدر جدولٌ واحدٌ وعدّادُه:
 *  · **التسليمات**: **غيرُ مقيسة** — `box_handovers` ليست ضمن جداول ADR §١-١/§١-٣ المقيسة،
 *    فلا أدّعي رقماً لم يُقَس. وأقربُ إسنادٍ صادقٍ ملحقُ ADR أ: «باقي الـ٩٥ جدولاً — تقديرٌ
 *    مجمَّع **١٠٪**» من ~١٫٩ مليون صفٍّ/سنة ⟵ ~٢٬٠٠٠ صفٍّ للجدول في السنة على مستوى الشبكة،
 *    وبالاحتفاظ **سنتين** (قب-٦) ⟵ **~٤٬٠٠٠ للشبكة كلِّها**، والقسمُ ~نصفُها ⟵ **~٢٬٠٠٠**.
 *  · **العدّاد**: صفٌّ واحدٌ بالجذر.
 *
 * فالسقفُ **٨٬٠٠٠** = **٢×** حملَ الشبكة كلِّها و**~٤×** أوسعَ سطحٍ مُعلَن (القسم). ولذلك
 * **أوّلُ تجاوزٍ هنا ليس «تضخّمَ بيانات» بل «قراءةٌ وسّعت النطاق»** — وهو بعينه ما أراد
 * قب-٤٨ أن ينزع عنه الصمت.
 *
 * > **والضعفُ يُقال لا يُجمَّل**: مصدرُ الرقم **تقديرٌ مجمَّعٌ لا قياسٌ مباشر**، وأخطرُ ضلعٍ
 * > فيه أن التسليمَ النازل **حدثٌ إداريٌّ متكرّرٌ شهرياً** قد يفوق تقديرَ «جدولٍ من الـ٩٥»
 * > الموحّد. فإن قِيست تسليماتُ الشبكة يوماً **يُراجَع هذا السقف بالرقم المقيس**. وإن تجاوزته
 * > جلسةٌ مشروعة فأوّلُ الدواء **تضييقُ النطاق** — ولا يُسمّى ذلك «زنادَ CR-026» إلا إن
 * > **تعذّر** التضييقُ حقاً (قب-٤٨ · تصحيحُ CR-029: الزنادُ صمّامٌ لا يُحرق على حالةٍ لها
 * > علاجٌ أرخصُ وأصحّ — وهذا الجدولُ من النمط (أ)، فالتضييقُ بالمسار **يعمل فيه**).
 */
const HANDOVERS_ROW_BUDGET = 8_000

function table(rows: RowSet, name: string): ReadonlyMap<string, SqlRow> {
  return rows.get(name) ?? new Map<string, SqlRow>()
}

function collect(entries: readonly SqlRow[], name: string): [string, ReadonlyMap<string, SqlRow>] {
  const spec = tableSpec(name)
  return [name, new Map(entries.map((entry) => [primaryKeyOf(spec, entry), entry]))]
}

/**
 * **قاموسُ فئات الصرف** — بياناتٌ مرجعيةٌ شبكيةٌ تسكن الجذر، تُقرأ من كلِّ وحدة.
 * مصنعٌ مستقلٌّ عن التسليمات (وصفة §٤-٠): جلسةٌ تريد القاموسَ **لا تلمس تسليماً واحداً**.
 */
export function persistentBoxCatalog(store: BoxStore): PersistentStore {
  const tenantId = store.tenantId

  return {
    name: CATALOG_SOURCE,
    rowBudget: CATALOG_ROW_BUDGET,
    tables: [
      "box_categories",
    ],

    project: () =>
      new Map([
        collect(
          store.categories().map((category) => ({
            tenant_id: tenantId,
            // القاموسُ نطاقُه الشبكةُ كلُّها — جذرٌ **صادقٌ لا حشو** (README الحسم ٢).
            unit_path: TENANT_ROOT_PATH,
            id: category.id,
            ar: category.ar,
            account_id: category.accountId,
            active: encodeBoolean(category.active),
          })),
          "box_categories",
        ),
      ]),

    load: (rows) => {
      for (const row of table(rows, "box_categories").values()) {
        store.saveCategory({
          tenantId,
          id: readText(row, "id"),
          ar: readText(row, "ar"),
          accountId: readText(row, "account_id"),
          active: readBoolean(row, "active"),
        })
      }
    },
  }
}

/**
 * **تسليماتُ الصندوق** — الجدولُ الذي ينمو بنمو العمل، وتوجيهُه **مسارُ وحدة الوجهة**.
 * وهو صاحبُ عدّاد المستودع (`hnd-N`) — فالعدّادُ يُخزَّن هنا ويُستأنف هنا.
 */
export function persistentBoxHandovers(store: BoxStore): PersistentStore {
  const tenantId = store.tenantId
  /** أعلى عدّادٍ رآه التحميل — يصون الحتميّة حين يكون النطاقُ جزئياً. */
  let hydratedSeq = 0

  const derivedSeq = (): number => {
    let max = hydratedSeq
    // **التسليماتُ وحدَها**: معرّفاتُ الفئات يضعها مديرُ القاموس ولا تخرج من هذا العدّاد.
    for (const handover of store.handovers()) max = Math.max(max, suffixOf(handover.id))
    return max
  }

  return {
    name: HANDOVERS_SOURCE,
    rowBudget: HANDOVERS_ROW_BUDGET,
    tables: [
      "box_handovers",
      { table: "sequences", owns: (r) => r["name"] === SEQUENCE },
    ],

    project: () =>
      new Map([
        collect(
          store.handovers().map((handover) => ({
            tenant_id: tenantId,
            // **وحدةُ الوجهة** — أعمقُ المسارين بحكم ق-٦١، ولا عمودَ ثانياً يكرّرها.
            unit_path: handover.toUnitPath,
            id: handover.id,
            entry_id: handover.entryId,
            from_unit_path: handover.fromUnitPath,
            to_custodian_person_id: handover.toCustodianPersonId,
            handed_over_by: handover.handedOverBy,
            at: encodeDate(handover.at),
            acknowledged_by: handover.acknowledgedBy,
            acknowledged_at: encodeNullable(handover.acknowledgedAt, encodeDate),
          })),
          "box_handovers",
        ),
        collect([sequenceRow(tenantId, SEQUENCE, derivedSeq())], "sequences"),
      ]),

    load: (rows) => {
      // **بترتيب المعرّف**: السجلُّ ملحقٌ فقط، وترتيبُ الإلحاق جزءٌ من قراءته — والفرزُ
      // على لاحقة العدّاد لأنها ترتيبُ التخصيص نفسُه (`hnd-2` قبل `hnd-10` عدداً لا نصّاً).
      const handovers = [...table(rows, "box_handovers").values()].sort(
        (a, b) => suffixOf(readText(a, "id")) - suffixOf(readText(b, "id")),
      )
      for (const row of handovers) {
        store.saveHandover({
          tenantId,
          id: readText(row, "id"),
          entryId: readText(row, "entry_id"),
          fromUnitPath: readText(row, "from_unit_path"),
          toUnitPath: readText(row, "unit_path"),
          toCustodianPersonId: readText(row, "to_custodian_person_id"),
          handedOverBy: readText(row, "handed_over_by"),
          at: readDate(row, "at"),
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
