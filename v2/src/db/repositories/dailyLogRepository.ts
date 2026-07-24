/**
 * مستودعُ سجل اليوم على D1 — **خلف العقد القائم بلا تغيير توقيعٍ واحد**.
 *
 * لا صنفَ جديدٌ ولا وكيلٌ ولا اعتراضُ نداءات: المستودعُ الذي تراه الخدمةُ هو `DailyLogStore`
 * نفسُه حرفياً، وهذا الملفُّ **يُسقطه ويُحمّله** لا غير (`db/README.md` الحسم ١، الطبقة ٢).
 *
 * ---
 *
 * ## **مصدران لا واحد** — الوصفة §٤-٠ (القاعدةُ التي استُخرجت من هذه الوحدة · CR-029)
 *
 * *«المستودعُ يملك بياناتٍ ذاتَ شكلِ توجيهٍ واحد»*، وجداولُ سجل اليوم **صنفان**:
 *  · **كتالوجٌ مرجعيٌّ شبكيّ** (`daily_schemes`/`daily_activities`) — نطاقُه **الجذرُ `'/'`**،
 *    ويُقرأ من كلِّ وحدة.
 *  · **قيودٌ تشغيليةٌ بالوحدة** (`daily_units`/`daily_rosters`/`daily_entries`) — نطاقُها
 *    **مسارُ وحدتها**، و`daily_entries` **أضخمُ جدولِ عملياتٍ بعد التدقيق** (ملحق ADR أ).
 *
 * **ولمّا جمعهما مصدرٌ واحدٌ فَرَضَ أضيقُهما نطاقاً على أوسعِهما حملَه**: وحدةُ العمل تُحمَّل
 * **بنطاقٍ واحد**، فجلسةُ `activityCatalog.view` — ونطاقُها **الجذرُ صراحةً** — كانت تُحمّل
 * `LIKE '/%'` ⟵ **كلَّ قيود الشبكة** (~٨٣٢ ألفاً للسنتين) لا الكتالوجَ وحدَه. **والعلاجُ ليس
 * رفعَ السقف** (*سقفٌ بحجم الشبكة لا يحرس شيئاً* — درسُ `library`) **بل هذا الفصل**، فلكلِّ
 * مصدرٍ سقفُه المُسنَد إلى **حمولته الحقيقية**.
 *
 * > **ولم يُنقدح زنادُ CR-026**: نصُّه (قب-٤٨) *«إخفاقٌ **يتعذّر** إصلاحُه بتضييق النطاق»* —
 * > وهذا يُضيَّق بالفصل نفسِه. والزنادُ صمّامُ أمانٍ لا يُحرق على حالةٍ لها علاجٌ أرخصُ وأصحّ.
 * > **والثغرةُ كانت مُصرَّحةً لا واقعة** يومَ الدمج (لا سطحَ يُركَّب على وحدةِ عملٍ حقيقية بعد)،
 * > فنُفِّذ الفصلُ في T26-ج كما نصّ قرارُ CR-029 — **قبل** أن يُركَّب السطح لا بعده.
 *
 * ---
 *
 * ### وثلاثةُ فروقٍ أخرى عن نموذج العُهد تستحقّ أن تُقال — لأنها قرارٌ لا نسخ
 * ١. **الكتالوجُ شبكيٌّ فيُوجَّه إلى الجذر**. المخطّطُ يُختار بـ«أعمقُ نطاقٍ يحتوي الوحدة»
 *    (ق-٤٢)، فمسجدٌ في `/men/homs/sq2/khalid/` يحتاج مخطّطاً نطاقُه `/men/` — **سلفٌ لا خلَف**.
 *    والتحميلُ يجلب الأحفادَ والجذرَ لا الأسلاف، فلو وُجِّه المخطّطُ إلى نطاقه لَمَا حمّلته
 *    جلسةُ المسجد ⟵ `NO_SCHEME_FOR_SCOPE`. فيسكن الجذرَ صراحةً (نظيرُ `org_accounts` —
 *    README الحسم ٢)، ونطاقُ سريانه `scope_path` **عمودُ بيانات** يُقرأ بـ`contains`، لا مفتاحَ
 *    توجيه. **صفرُ توجيهٍ مشتقٍّ يرمي هنا**: الكتالوجُ ثابتُ الجذر، والقيدُ والعددُ يحملان
 *    مسارَهما المخزَّن (لا يُخترع ولا يُشتقّ).
 * ٢. **التحميلُ حشوٌ لا إعادةُ تشغيل.** المعرّفُ الوحيدُ من العدّاد `dle-N` للقيد، و`saveEntry`
 *    تستقبل القيدَ **بمعرّفه** — فلا إعادةَ تخصيصٍ (كالعُهد لا كالدفتر)، ويكفي استئنافُ العدّاد.
 *    ولذلك **`sequences` تسكن مصدرَ القيود** لا مصدرَ الكتالوج: معرّفاتُ الكتالوج خارجيّة.
 * ٣. **لا عدّادَ مشتقٌّ ولا سجلَّ تدقيقٍ محليّ.** النقاطُ **مخزَّنةٌ في القيد** (ق-٤١) لا رولّ-أب
 *    يُطابَق، والحائزُ لا وجودَ له هنا. **ولا تدقيقَ يملكه هذا المستودع**: تدقيقُ الوحدة
 *    يُعلَن في `defineServerFn` (طبقةُ السطوح) لا في المستودع — فلا `AuditRecord` يُوحَّد
 *    (CR-027)، وهذا فرقٌ **مُصرَّحٌ به** عن العُهد لا سهو (تفصيلُه في تقرير التسليم).
 */

import { encodeBoolean, encodeDate, readBoolean, readDate, readInt, readIntOrNull, readText, readTextOrNull } from "../encode.js"
import { TENANT_ROOT_PATH, tableSpec } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"
import { naturalKey, primaryKeyOf, type PersistentStore, type RowSet } from "../unitOfWork.js"
import { DailyLogStore } from "../../features/dailyLog/data/store.js"
import type { PointsBlock } from "../../features/dailyLog/types.js"
import { sequenceRow, suffixOf } from "./shared.js"

const CATALOG_SOURCE = "dailyLog.catalog"
const ENTRIES_SOURCE = "dailyLog.entries"
const SEQUENCE = "dailyLog.seq"

/**
 * سقفُ **الكتالوج** (G23 · CR-026 ب · CR-029/الوصفة §٤-٠) — حمولةٌ **مقيَّدةٌ بنيوياً لا مقدَّرة**.
 *
 * الكتالوجُ مخطّطاتٌ وأنشطتُها، و**لا ينمو مع الميدان**: لا مع عدد المساجد ولا الأشخاص ولا
 * الإدخالات. المخطّطُ يُختار لكلِّ نطاقٍ بـ«أعمقُ نطاقٍ يحتوي الوحدة» (ق-٤٢) ⟵ عددُه بعددِ
 * النطاقات التي تستحقّ منهجاً خاصّاً (قسمٌ أو منطقةٌ) لا بعدد المساجد، وأنشطةُ المخطّط
 * **سقفُها النظريُّ ثمانية أنواعٍ في اليوم** (ملحق ADR أ، ملاحظةُ الصدق ١). فالبذرةُ اليومَ
 * مخطّطان وأنشطتُهما، وأسخى تقديرٍ لشبكةٍ ناضجة **عشراتٌ**.
 *
 * فالسقفُ **١٬٠٠٠** هامشٌ ~١٠× على أسخى تقدير. **وهذا هو المقصودُ من الفصل**: جلسةُ
 * `activityCatalog.view` بالجذر تُحمّل **هذه الصفوفَ وحدَها** — لا قيدَ سجل يومٍ واحداً.
 */
const CATALOG_ROW_BUDGET = 1_000

/**
 * سقفُ **القيود** (G23 · CR-026 ب · قب-٤٨) — **مُسنَدٌ إلى أوسع وحدةٍ واقعية**، لا إلى حمل
 * الشبكة: *سقفٌ بحجم الشبكة لا يحرس شيئاً* (الوصفة §٤-٠). وهذه الوحدةُ هي التي حذّر ملفُّ
 * المهمة والوصفةُ من أنّ **أوّلَ إخفاقٍ لـG23 قد يقع فيها**.
 *
 * نطاقُ التحميل نطاقُ وحدة (مسجدٌ أو منطقة). والمحمولُ الأثقلُ `daily_entries`:
 *  · ADR-001 ملحق أ **يقيس** اشتقاقَه: ٤٠٠ مسجد × ٢٠ إدخالاً/أسبوع × ٥٢ = **~٤١٦٬٠٠٠ صفٍّ/سنة
 *    للشبكة**، أي **~١٬٠٤٠ إدخالاً للمسجد الواحد في السنة**.
 *  · وأوسعُ منطقةٍ في الشبكة اليوم **دون العشرين مسجداً** ⟵ ~٢٠٬٨٠٠ إدخالٍ في السنة، وبالاحتفاظ
 *    **سنتين** (قب-٦) ⟵ **~٤١٬٦٠٠**. ومعها إسقاطُ الوحدات (بضعُ عشرات) والأعدادُ (عددٌ لكل
 *    مسجد) — وكلاهما هامشٌ صغير.
 *
 * فالسقفُ **٦٠٬٠٠٠** يترك على أوسع منطقةٍ (~٤١٬٦٠٠ للسنتين) هامشاً ~١.٤×، ويبقى **دون سقف
 * الذاكرة بمراحل** (١٢٨ م.ب — ADR §١-٤). ولذلك **أوّلُ تجاوزٍ هنا ليس «تضخّمَ بيانات» بل
 * «قراءةٌ وسّعت النطاق»** — وهو بعينه ما أراد قب-٤٨ أن ينزع عنه الصمت.
 *
 * **وحملُ الشبكة كلِّها (~٨٣٢ ألفاً للسنتين) يتجاوزه عمداً**: تحميلُ القيود بالجذر **بناءٌ
 * أحمر** — وهو بعينه ما جاء له الفصل، إذ لم يعد لقراءة الكتالوج حاجةٌ إلى جرِّ هذا الجدول.
 * **ولا سطحَ اليومَ يقرأ القيودَ بالجذر**: سطوحُ القيد والأعداد كلُّها `unitScope`، والجذريُّ
 * منها اثنان — كلاهما كتالوج (`endpoints.ts`).
 */
const ENTRIES_ROW_BUDGET = 60_000

function table(rows: RowSet, name: string): ReadonlyMap<string, SqlRow> {
  return rows.get(name) ?? new Map<string, SqlRow>()
}

function collect(entries: readonly SqlRow[], name: string): [string, ReadonlyMap<string, SqlRow>] {
  const spec = tableSpec(name)
  return [name, new Map(entries.map((entry) => [primaryKeyOf(spec, entry), entry]))]
}

/** القائمةُ تعبر القاعدةَ **نصَّ JSON** (ع-٣: لا مزيةَ محرّك)، ويُعاد بناؤها صراحةً عند القراءة. */
function encodeIds(ids: readonly string[]): string {
  return JSON.stringify(ids)
}
function decodeIds(text: string): readonly string[] {
  return Object.freeze(JSON.parse(text) as string[])
}

/**
 * **كتالوجُ سجل اليوم** — مخطّطاتٌ وأنشطةٌ نطاقُها **جذرُ الشبكة**، تُقرأ من كلِّ وحدة.
 * مصدرٌ مستقلٌّ بحكم §٤-٠: قراءتُه لا تجرّ قيدَ سجل يومٍ ولا عددَ أُسرةٍ واحداً.
 */
export function persistentDailyCatalog(store: DailyLogStore): PersistentStore {
  const tenantId = store.tenantId
  return {
    name: CATALOG_SOURCE,
    rowBudget: CATALOG_ROW_BUDGET,
    tables: ["daily_schemes", "daily_activities"],

    project: () =>
      new Map([
        collect(
          // **الكتالوجُ يسكن الجذرَ** (فرق ١): `scope_path` بيانُ سريانه، و`unit_path` توجيهُه الشبكيّ.
          store.schemes().map((scheme) => ({
            tenant_id: tenantId,
            unit_path: TENANT_ROOT_PATH,
            id: scheme.id,
            ar: scheme.ar,
            scope_path: scheme.scopePath,
            active: encodeBoolean(scheme.active),
          })),
          "daily_schemes",
        ),
        collect(
          store.activities().map((activity) => ({
            tenant_id: tenantId,
            unit_path: TENANT_ROOT_PATH,
            id: activity.id,
            scheme_id: activity.schemeId,
            activity_id: activity.activityId,
            ar: activity.ar,
            weight: activity.weight,
            max_per_day: activity.maxPerDay,
            requires_participation: encodeBoolean(activity.requiresParticipation),
            active: encodeBoolean(activity.active),
            valid_from: encodeDate(activity.validFrom),
          })),
          "daily_activities",
        ),
      ]),

    load: (rows) => {
      for (const row of table(rows, "daily_schemes").values()) {
        store.saveScheme({
          tenantId,
          id: readText(row, "id"),
          ar: readText(row, "ar"),
          scopePath: readText(row, "scope_path"),
          active: readBoolean(row, "active"),
        })
      }
      for (const row of table(rows, "daily_activities").values()) {
        store.saveActivity({
          tenantId,
          id: readText(row, "id"),
          schemeId: readText(row, "scheme_id"),
          activityId: readText(row, "activity_id"),
          ar: readText(row, "ar"),
          weight: readInt(row, "weight"),
          maxPerDay: readIntOrNull(row, "max_per_day"),
          requiresParticipation: readBoolean(row, "requires_participation"),
          active: readBoolean(row, "active"),
          validFrom: readDate(row, "valid_from"),
        })
      }
    },
  }
}

/**
 * **القيودُ التشغيلية** — إسقاطُ الوحدات والأعدادُ والقيود، ونطاقُها **مسارُ الوحدة**.
 * ومعها عدّادُ المعرّفات (`sequences`) لأنه **يولّد معرّفاتِ القيود** لا معرّفاتِ الكتالوج.
 */
export function persistentDailyEntries(store: DailyLogStore): PersistentStore {
  const tenantId = store.tenantId
  /** أعلى عدّادٍ رآه التحميل — يصون الحتميّة حين يكون النطاقُ جزئياً. */
  let hydratedSeq = 0

  /** المعرّفُ الوحيدُ من العدّاد هو القيد `dle-N`؛ سائرُ المعرّفات خارجيّةٌ (مخطّط/نشاط/مسار). */
  const derivedSeq = (): number => {
    let max = hydratedSeq
    for (const entry of store.entries()) max = Math.max(max, suffixOf(entry.id))
    return max
  }

  return {
    name: ENTRIES_SOURCE,
    rowBudget: ENTRIES_ROW_BUDGET,
    tables: [
      "daily_units",
      "daily_rosters",
      "daily_entries",
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
          "daily_units",
        ),
        collect(
          store.rosters().map((roster) => ({
            tenant_id: tenantId,
            unit_path: roster.unitPath,
            student_count: roster.studentCount,
            set_by: roster.setBy,
            set_at: encodeDate(roster.setAt),
          })),
          "daily_rosters",
        ),
        collect(
          store.entries().map((entry) => ({
            tenant_id: tenantId,
            unit_path: entry.unitPath,
            id: entry.id,
            client_uuid: entry.clientUuid,
            activity_id: entry.activityId,
            free_text_ar: entry.freeTextAr,
            day_key: entry.dayKey,
            period_key: entry.periodKey,
            count: entry.count,
            credited_count: entry.creditedCount,
            points: entry.points,
            student_ids: encodeIds(entry.studentIds),
            credited_student_ids: encodeIds(entry.creditedStudentIds),
            block: entry.block,
            by_person_id: entry.byPersonId,
            at: encodeDate(entry.at),
          })),
          "daily_entries",
        ),
        collect([sequenceRow(tenantId, SEQUENCE, derivedSeq())], "sequences"),
      ]),

    load: (rows) => {
      for (const row of table(rows, "daily_units").values()) {
        store.saveUnit({ tenantId, id: readText(row, "id"), path: readText(row, "unit_path") })
      }
      for (const row of table(rows, "daily_rosters").values()) {
        store.saveRoster({
          tenantId,
          unitPath: readText(row, "unit_path"),
          studentCount: readIntOrNull(row, "student_count"),
          setBy: readText(row, "set_by"),
          setAt: readDate(row, "set_at"),
        })
      }
      for (const row of table(rows, "daily_entries").values()) {
        store.saveEntry({
          tenantId,
          id: readText(row, "id"),
          clientUuid: readText(row, "client_uuid"),
          unitPath: readText(row, "unit_path"),
          activityId: readTextOrNull(row, "activity_id"),
          freeTextAr: readTextOrNull(row, "free_text_ar"),
          dayKey: readText(row, "day_key"),
          periodKey: readText(row, "period_key"),
          count: readInt(row, "count"),
          creditedCount: readInt(row, "credited_count"),
          points: readInt(row, "points"),
          studentIds: decodeIds(readText(row, "student_ids")),
          creditedStudentIds: decodeIds(readText(row, "credited_student_ids")),
          block: readText(row, "block") as PointsBlock,
          byPersonId: readText(row, "by_person_id"),
          at: readDate(row, "at"),
        })
      }

      const stored = table(rows, "sequences").get(naturalKey(tenantId, SEQUENCE))
      hydratedSeq = Math.max(derivedSeq(), stored === undefined ? 0 : readInt(stored, "value"))
      // العدّادُ يُستأنف ولا يعود صفراً — وإلا دهس معرّفٌ جديدٌ معرّفاً محفوظاً خارج النطاق.
      for (let i = 0; i < hydratedSeq; i += 1) store.nextId("_hydrate")
    },
  }
}
