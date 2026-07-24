/**
 * مستودعُ الزيارات الإشرافية على D1 — **خلف العقد القائم بلا تغيير توقيعٍ واحد**.
 *
 * لا صنفَ جديدٌ ولا وكيلٌ ولا اعتراضُ نداءات: المستودعُ الذي تراه الخدمةُ هو `SupervisionStore`
 * نفسُه حرفياً، وهذا الملفُّ **يُسقطه ويُحمّله** لا غير (`db/README.md` الحسم ١، الطبقة ٢).
 * ولذلك لم يُعدَّل في `services/*.ts` ولا في `server/endpoints.ts` سطرٌ واحد.
 *
 * ### ثلاثةُ فروقٍ عن نموذج العُهد (`custodyRepository`) تستحقّ أن تُقال — لأنها قرارُ الوحدة
 * ١. **مفتاحُ توجيه الزيارة مسارُ هدفها لا مسارُ زائرها، وهو مخزَّنٌ لا مشتقّ.** الزيارةُ
 *    تحمل مسارَين: `targetPath` (موطنُ الهدف — القراءةُ كلُّها بالاحتواء عليه) و
 *    `supervisorPath` (مرساةُ NESSA — ق-١٦). فمفتاحُ التوجيه **مسارُ الهدف**، وهو **مجمَّدٌ
 *    على الكيان لحظةَ الكتابة** (`visits.ts` يكتب `targetPath: target.path`) ⟵ **لا أشتقّه
 *    من الهدف الحيّ في `project`**: الزيارةُ ملحقٌ فقط، فاشتقاقُه من هدفٍ قد يكون انتقل في
 *    الشجرة كان **يُعيد كتابةَ صفٍّ ملحقٍ فقط بمفتاحٍ جديد** (فخّ ٤ · الوصفة). ولذلك **لا
 *    فرعَ رميةٍ لمفتاحٍ لا يُشتقّ** هنا خلافاً للعُهد — وهو **الأصوب**، وأُصرّح به في التقرير.
 * ٢. **لا سجلَّ تدقيقٍ في هذه الوحدة** (G22): الحُكمُ يصلها منفذاً محقوناً، وقيدُ التدقيق
 *    يُعلَن في `defineServerFn` ويكتبه الإطار عبر السجلّ الموحَّد — لا يملكه المستودع. ولذلك
 *    **لا `AuditJournal` يُحقن هنا**، وخطوةُ «توحيد التدقيق» (الوصفة هـ) غيرُ ذات موضوعٍ لها.
 * ٣. **التحميلُ حشوٌ لا إعادةُ تشغيل.** معرّفاتُ الزيارات من عدّادٍ متتابع (`vst-N`)، لكنّ
 *    `saveVisit` تستقبل الزيارةَ **بمعرّفها** — فيكفي **استئنافُ العدّاد** بالأعلى بين المشتقّ
 *    والمحفوظ. والوحداتُ والأهدافُ معرّفاتُها خارجية (وحدةٌ/حلقة) فلا تمسّ العدّاد.
 *
 * ### وجوابُ §٤-٠ (شكلُ التوجيه الواحد) — **مستودعٌ واحدٌ يكفي، والجوابُ محروسٌ لا مزعوم**
 * صنّفتُ الجداولَ الثلاثة قبل المخطط: **كلُّها تشغيليةٌ بمسار وحدة** — الوحدةُ بمسارها،
 * والهدفُ بموطن حلقته، والزيارةُ بمسار هدفها. **ولا كتالوجَ شبكياً يسكن الجذر** هنا: دورةُ
 * الزيارة **إعدادٌ** في سجلّ الإعدادات (ق-٩٩ · `visit_cadence_days`) لا جدولٌ في مخططي،
 * وحقولُ النموذج (ق-١٠٠) **بياناتٌ في `services/forms.ts`** لا صفوفٌ تُقرأ بالجذر. فلا
 * جلسةَ تُضطرّ إلى `LIKE '/%'` ⟵ **لا يفرض الأضيقُ على الأوسع حملَه**، ولا موجبَ لفصل
 * `Catalog`/`Entries` (وهو يخصّ `media`/`library`). ويحرس الجوابَ اختبارٌ يقيس **صفرَ صفٍّ
 * بالجذر في الأهداف والزيارات**، وأنّ إسقاطَ الوحدات **شجرةٌ لا كتالوج**: صفُّه الوحيدُ
 * بالجذر عقدةُ الجذر نفسُها (مسارُها `/` بحكم كونها الجذر — نظيرُ `custody_units`).
 *
 * > و`sequences` **مرفقُ طبقةٍ لا تملكه وحدة** (§٥-أ-٤) — يسكن الجذرَ كما في كلِّ مستودعٍ
 * > مهاجَر، ويُطالَب به بـ`owns` صفّاً واحداً؛ فليس صنفاً ثانياً من بيانات الوحدة.
 */

import {
  encodeBoolean,
  encodeDate,
  readBoolean,
  readDate,
  readInt,
  readText,
} from "../encode.js"
import { tableSpec } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"
import { naturalKey, primaryKeyOf, type PersistentStore, type RowSet } from "../unitOfWork.js"
import { SupervisionStore } from "../../features/supervision/data/store.js"
import type { VisitCurriculum, VisitDetails } from "../../features/supervision/types.js"
import { sequenceRow, suffixOf } from "./shared.js"

const SOURCE = "supervision"
const SEQUENCE = "supervision.seq"

/**
 * سقفُ صفوف وحدة العمل (G23 · CR-026 ب · قب-٤٨) — **مشتقٌّ لا مُقدَّر، وبضعفٍ مُصرَّحٍ به**.
 *
 * نطاقُ التحميل نطاقُ وحدة، والمحمولُ ثلاثةُ جداول: إسقاطُ الوحدات، والأهداف، والزيارات.
 *  · **الوحداتُ والأهداف**: مقيَّدان بعدد الوحدات والحلقات — ADR-001 §١-٥ يقيس **~٨٦٠**
 *    وحدةً تنظيمية للشبكة كلِّها اليوم، والحلقاتُ من رتبتها (كلُّ حلقةٍ تحت وحدة).
 *  · **الزياراتُ**: **غيرُ مقيسة مباشرةً** — `supervision_visits` في v1 ليس ضمن جداول ADR
 *    §١-١/§١-٣ المقيسة، فلا أدّعي رقماً لم يُقَس. وأقربُ إسنادٍ صادق: دورةُ الزيارة ٣٠ يوماً
 *    (ق-٩٩ · `visit_cadence_days`) ⟵ ~١٢ زيارةً لكلِّ حلقةٍ في السنة كحدٍّ أعلى؛ ومع
 *    ~٨٦٠ حلقةً وباحتفاظ **سنتين** (قب-٦) ⟵ ~٢٠٬٦٠٠ زيارة. ويُسند هذا كذلك ملحقُ ADR أ
 *    («باقي الجداول تقديرٌ مجمَّع») فيبقى في مرتبة الآلاف لا مئات الآلاف.
 *
 * فالسقفُ **٤٠٬٠٠٠** يسع الشبكةَ كلَّها (~٢٢٬٠٠٠ زيارةً + الوحداتِ والأهدافَ) بهامشٍ ~١.٨×،
 * بينما الجلسةُ الواقعية **نطاقُ وحدةٍ** أي جزءٌ يسيرٌ منه. ولذلك **أوّلُ تجاوزٍ هنا ليس
 * «تضخّمَ بيانات» بل «قراءةٌ وسّعت النطاق»** — وهو بعينه ما أراد قب-٤٨ أن ينزع عنه الصمت.
 *
 * > **والضعفُ يُقال لا يُجمَّل**: مصدرُ الرقم تقديرٌ مجمَّعٌ لا قياسٌ مباشر (زياراتُ الشبكة
 * > لم تُقَس في v1). فإن قِيست يوماً **يُراجَع هذا السقف بالرقم المقيس** — وهذا أصدقُ من رقمٍ
 * > يبدو دقيقاً بلا سند. والزيارةُ **ليست من أضخم الجداول** (خلافاً لـ`dailyLog`/`circleLog`):
 * > دورةُ الشهر تحدُّ عددَها بنيوياً، فلا أتوقّع أن يكون أوّلُ إخفاقِ G23 هنا.
 */
const ROW_BUDGET = 40_000

function table(rows: RowSet, name: string): ReadonlyMap<string, SqlRow> {
  return rows.get(name) ?? new Map<string, SqlRow>()
}

function collect(entries: readonly SqlRow[], name: string): [string, ReadonlyMap<string, SqlRow>] {
  const spec = tableSpec(name)
  return [name, new Map(entries.map((entry) => [primaryKeyOf(spec, entry), entry]))]
}

export function persistentSupervision(store: SupervisionStore): PersistentStore {
  const tenantId = store.tenantId
  /** أعلى عدّادٍ رآه التحميل — يصون الحتميّة حين يكون النطاقُ جزئياً. */
  let hydratedSeq = 0

  const derivedSeq = (): number => {
    let max = hydratedSeq
    for (const visit of store.visits()) max = Math.max(max, suffixOf(visit.id))
    return max
  }

  return {
    name: SOURCE,
    rowBudget: ROW_BUDGET,
    tables: [
      "supervision_units",
      "supervision_targets",
      "supervision_visits",
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
          "supervision_units",
        ),
        collect(
          store.targets().map((target) => ({
            tenant_id: tenantId,
            unit_path: target.path,
            id: target.id,
            curriculum: target.curriculum,
            active: encodeBoolean(target.active),
          })),
          "supervision_targets",
        ),
        collect(
          store.visits().map((visit) => ({
            tenant_id: tenantId,
            // مفتاحُ التوجيه **مسارُ الهدف المخزَّنُ على الزيارة** — لا يُشتقّ من الهدف الحيّ
            // (فرقٌ ١ أعلاه): الزيارةُ ملحقٌ فقط فمفتاحُها مجمَّدٌ لحظةَ الكتابة.
            unit_path: visit.targetPath,
            id: visit.id,
            target_id: visit.targetId,
            supervisor_path: visit.supervisorPath,
            curriculum: visit.curriculum,
            day_key: visit.dayKey,
            visited_at: encodeDate(visit.visitedAt),
            attendees: visit.core.attendees,
            rating_pct: visit.core.ratingPct,
            note_ar: visit.core.noteAr,
            details: JSON.stringify(visit.details),
            by_person_id: visit.byPersonId,
          })),
          "supervision_visits",
        ),
        collect([sequenceRow(tenantId, SEQUENCE, derivedSeq())], "sequences"),
      ]),

    load: (rows) => {
      for (const row of table(rows, "supervision_units").values()) {
        store.saveUnit({ tenantId, id: readText(row, "id"), path: readText(row, "unit_path") })
      }
      for (const row of table(rows, "supervision_targets").values()) {
        store.saveTarget({
          tenantId,
          id: readText(row, "id"),
          path: readText(row, "unit_path"),
          curriculum: readText(row, "curriculum") as VisitCurriculum,
          active: readBoolean(row, "active"),
        })
      }
      for (const row of table(rows, "supervision_visits").values()) {
        store.saveVisit({
          tenantId,
          id: readText(row, "id"),
          targetId: readText(row, "target_id"),
          targetPath: readText(row, "unit_path"),
          supervisorPath: readText(row, "supervisor_path"),
          curriculum: readText(row, "curriculum") as VisitCurriculum,
          dayKey: readText(row, "day_key"),
          visitedAt: readDate(row, "visited_at"),
          core: {
            attendees: readInt(row, "attendees"),
            ratingPct: readInt(row, "rating_pct"),
            noteAr: readText(row, "note_ar"),
          },
          details: JSON.parse(readText(row, "details")) as VisitDetails,
          byPersonId: readText(row, "by_person_id"),
        })
      }

      const stored = table(rows, "sequences").get(naturalKey(tenantId, SEQUENCE))
      hydratedSeq = Math.max(derivedSeq(), stored === undefined ? 0 : readInt(stored, "value"))
      // العدّادُ يُستأنف ولا يعود صفراً — وإلا دهس معرّفٌ جديدٌ معرّفاً محفوظاً خارج النطاق.
      for (let i = 0; i < hydratedSeq; i += 1) store.nextId("_hydrate")
    },
  }
}
