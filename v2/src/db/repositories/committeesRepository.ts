/**
 * مستودعُ اللجان والاجتماعات على D1 — **خلف العقد القائم بلا تغيير توقيعٍ واحد**.
 *
 * لا صنفَ جديدٌ ولا وكيلٌ ولا اعتراضُ نداءات: المستودعُ الذي تراه الخدمةُ هو `CommitteeStore`
 * نفسُه، وهذا الملفُّ **يُسقطه ويُحمّله** لا غير (`db/README.md` الحسم ١، الطبقة ٢). ولذلك
 * لم يُعدَّل في `services/*` ولا في `server/endpoints.ts` سطرٌ واحد.
 *
 * ### أربعةُ فروقٍ عن العُهد تستحقّ أن تُقال — والأولُ هو المفاجأةُ التي وعدت بها الوصفةُ نصّاً
 * ١. **مفتاحُ توجيه اللجنة مسارُها هي** (`committee.path`) لا مسجدُها: اللجنةُ عقدةٌ حقيقيةٌ
 *    في شجرة النطاق (ت-٢ · ق-١٣)، وقراءاتُها كلُّها `contains(scope, committee.path)`.
 *    والعضوُ والنشاطُ يرثان مفتاحَ **لجنتهما** (اشتقاقٌ من المستودع لا اختراع، ولجنةٌ مجهولةٌ
 *    **تُرمى**)؛ والمحضرُ مفتاحَ **مسجده** (`mosquePath`).
 * ٢. **لا سجلَّ تدقيقٍ في هذه الوحدة أصلاً**: `CommitteeStore` لا يملك `AuditJournal`، وحقولُ
 *    `audit:` في `endpoints.ts` **أسماءُ أفعالٍ لطبقة الخادم** لا كتابةٌ في السجلّ. فليس
 *    ثَمَّ سجلٌّ محليٌّ يُوحَّد (خلافاً للعُهد)، ووحدةُ العمل تُدرج **هذا المصدرَ وحدَه** بلا
 *    `persistentAudit`. (وإضافةُ تدقيقٍ لم يكن = ميزةٌ لا هجرة — تُرفع بـCR لا تُهرَّب هنا.)
 * ٣. **التحميلُ حشوٌ لا إعادةُ تشغيل**: `saveMember`/`saveActivity`/`saveMeeting` تستقبل
 *    الكيانَ **بمعرّفه**، فيكفي **استئنافُ العدّاد** بالأعلى بين المشتقّ والمحفوظ.
 * ٤. **العدّادُ يعدّه ثلاثةٌ لا الخمسة**: معرّفاتُ الأعضاء (`cmm-N`) والأنشطة (`cma-N`)
 *    والمحاضر (`mtg-N`) من عدّاد المستودع؛ أمّا **اللجنةُ فمعرّفُها حرٌّ** (`cm-relief`) لا
 *    من العدّاد — فلا تدخل اشتقاقَ التسلسل، وإلا قفز العدّادُ على اسمٍ لم يولّده.
 *    ولا عدّادَ مشتقٌّ (رولّ-أب): المساهمةُ في سجل المسجد **اشتقاقٌ لحظتَه** لا رقمٌ مخزَّن
 *    (نظيرُ ق-٦٠) — فلا شيء يُزوَّر ولا مطابقةَ تُبنى.
 */

import { encodeBoolean, encodeDate, readBoolean, readDate, readInt, readText, readTextOrNull } from "../encode.js"
import { tableSpec } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"
import { naturalKey, primaryKeyOf, type PersistentStore, type RowSet } from "../unitOfWork.js"
import { CommitteeStore } from "../../features/committees/data/store.js"
import { sequenceRow, suffixOf } from "./shared.js"

const SOURCE = "committees"
const SEQUENCE = "committees.seq"

/**
 * سقفُ صفوف وحدة العمل (G23 · CR-026 ب · قب-٤٨) — **مشتقٌّ لا مُقدَّر، وبضعفٍ مُصرَّحٍ به**.
 *
 * نطاقُ التحميل نطاقُ وحدة، والمحمولُ خمسةُ جداول: إسقاطُ الوحدات، واللجان، وأعضاؤها،
 * وأنشطتها، ومحاضرُ اجتماعات المسجد.
 *  · **الوحدات**: ADR-001 §١-٥ يقيس **~٨٦٠** وحدةً تنظيمية للشبكة كلِّها اليوم.
 *  · **الأربعةُ الباقية**: **غيرُ مقيسة** — جداولُ اللجان ليست ضمن ما قِيس في ADR §١-١/§١-٣.
 *    فأقربُ إسنادٍ صادقٍ ملحقُ ADR أ: «باقي الـ٩٥ جدولاً — تقديرٌ مجمَّع **١٠٪**» من ~١.٩
 *    مليون صفٍّ/سنة ⟵ ~٢٬٠٠٠ صفٍّ لكلِّ جدولٍ منها في السنة على مستوى الشبكة، وجداولُ اللجان
 *    **أربعة** ⟵ ~٨٬٠٠٠/سنة، وبالاحتفاظ سنتين (قب-٦) ⟵ **~١٦٬٠٠٠** للشبكة كلِّها.
 *
 * فالسقفُ **٢٥٬٠٠٠** يسع الشبكةَ كلَّها (~١٦٬٨٦٠ بالوحدات) بهامشٍ ~١.٥×، بينما الجلسةُ
 * الواقعية **نطاقُ وحدةٍ** أي جزءٌ يسيرٌ منه. ولذلك **أوّلُ تجاوزٍ هنا ليس «تضخّمَ بيانات»
 * بل «قراءةٌ وسّعت النطاق»** — وهو بعينه ما أراد قب-٤٨ أن ينزع عنه الصمت.
 *
 * > **والضعفُ يُقال لا يُجمَّل**: مصدرُ الرقم تقديرٌ مجمَّعٌ لا قياسٌ مباشر — كحال حمولة
 * > `audit_log` التي وصفها ADR بأنها «أضعفُ رقمٍ في الوثيقة». فإن قِيست جداولُ اللجان يوماً
 * > **يُراجَع هذا السقف بالرقم المقيس**، وهذا أصدقُ من رقمٍ يبدو دقيقاً ولا سند له.
 */
const ROW_BUDGET = 25_000

function table(rows: RowSet, name: string): ReadonlyMap<string, SqlRow> {
  return rows.get(name) ?? new Map<string, SqlRow>()
}

function collect(entries: readonly SqlRow[], name: string): [string, ReadonlyMap<string, SqlRow>] {
  const spec = tableSpec(name)
  return [name, new Map(entries.map((entry) => [primaryKeyOf(spec, entry), entry]))]
}

/** قائمةُ نصوصٍ ⟵ JSON نصّ (ع-٣: لا JSONB) — والقراءةُ **مُتحقَّقٌ منها** (المادة ٣/٣). */
function encodeStrings(values: readonly string[]): string {
  return JSON.stringify(values)
}

function readStrings(row: SqlRow, column: string): readonly string[] {
  const parsed: unknown = JSON.parse(readText(row, column))
  if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== "string")) {
    throw new Error(`العمود ${column} ليس قائمةَ نصوص`)
  }
  return Object.freeze(parsed as string[])
}

export function persistentCommittee(store: CommitteeStore): PersistentStore {
  const tenantId = store.tenantId

  /** أعلى عدّادٍ رآه التحميل — يصون الحتميّة حين يكون النطاقُ جزئياً. */
  let hydratedSeq = 0

  /**
   * مفتاحُ توجيه العضو/النشاط **مشتقٌّ من لجنته** — ولا يُخترع. ولجنةٌ مجهولةٌ **تُرمى**
   * ولا تُوجَّه إلى الجذر صامتاً (نظيرُ حركة العُهد من أصلها · `requestPath` في `orgRepository`).
   */
  const committeePathOf = (committeeId: string, ownerLabel: string): string => {
    const committee = store.getCommittee(committeeId)
    if (committee === null) {
      throw new Error(
        `مفتاحُ توجيهٍ لا يُشتقّ: ${ownerLabel} يشير إلى لجنةٍ مجهولة ${committeeId}`,
      )
    }
    return committee.path
  }

  /** التسلسلُ يعدّه الأعضاءُ والأنشطةُ والمحاضرُ فقط — لا اللجانُ (معرّفُها حرٌّ لا من العدّاد). */
  const derivedSeq = (): number => {
    let max = hydratedSeq
    for (const member of store.members()) max = Math.max(max, suffixOf(member.id))
    for (const activity of store.activities()) max = Math.max(max, suffixOf(activity.id))
    for (const meeting of store.meetings()) max = Math.max(max, suffixOf(meeting.id))
    return max
  }

  return {
    name: SOURCE,
    rowBudget: ROW_BUDGET,
    tables: [
      "committee_units",
      "committees",
      "committee_members",
      "committee_activities",
      "committee_meetings",
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
          "committee_units",
        ),
        collect(
          store.committees().map((committee) => ({
            tenant_id: tenantId,
            // مفتاحُ التوجيه = مسارُ اللجنة هي (المفاجأة — انظر رأس الملف الفرق ١).
            unit_path: committee.path,
            id: committee.id,
            mosque_unit_id: committee.mosqueUnitId,
            mosque_path: committee.mosquePath,
            label_ar: committee.labelAr,
            head_person_id: committee.headPersonId,
            head_name_ar: committee.headNameAr,
            active: encodeBoolean(committee.active),
          })),
          "committees",
        ),
        collect(
          store.members().map((member) => ({
            tenant_id: tenantId,
            unit_path: committeePathOf(member.committeeId, `عضوُ اللجنة ${member.id}`),
            id: member.id,
            committee_id: member.committeeId,
            name_ar: member.nameAr,
          })),
          "committee_members",
        ),
        collect(
          store.activities().map((activity) => ({
            tenant_id: tenantId,
            unit_path: committeePathOf(activity.committeeId, `نشاطُ اللجنة ${activity.id}`),
            id: activity.id,
            committee_id: activity.committeeId,
            period_id: activity.periodId,
            title_ar: activity.titleAr,
            participant_count: activity.participantCount,
            participant_names_ar: encodeStrings(activity.participantNamesAr),
            completed_at: encodeDate(activity.completedAt),
          })),
          "committee_activities",
        ),
        collect(
          store.meetings().map((meeting) => ({
            tenant_id: tenantId,
            // المحضرُ حدثٌ في المسجد ⟵ مفتاحُه مسارُ مسجده.
            unit_path: meeting.mosquePath,
            id: meeting.id,
            mosque_unit_id: meeting.mosqueUnitId,
            held_at: encodeDate(meeting.heldAt),
            minutes_ar: meeting.minutesAr,
            decisions_ar: encodeStrings(meeting.decisionsAr),
          })),
          "committee_meetings",
        ),
        collect([sequenceRow(tenantId, SEQUENCE, derivedSeq())], "sequences"),
      ]),

    load: (rows) => {
      for (const row of table(rows, "committee_units").values()) {
        store.saveUnit({ tenantId, id: readText(row, "id"), path: readText(row, "unit_path") })
      }
      for (const row of table(rows, "committees").values()) {
        store.saveCommittee({
          tenantId,
          id: readText(row, "id"),
          mosqueUnitId: readText(row, "mosque_unit_id"),
          mosquePath: readText(row, "mosque_path"),
          // مسارُ اللجنة هو مفتاحُ توجيهها — يُقرأ منه لا يُشتقّ عكسياً.
          path: readText(row, "unit_path"),
          labelAr: readText(row, "label_ar"),
          headPersonId: readTextOrNull(row, "head_person_id"),
          headNameAr: readText(row, "head_name_ar"),
          active: readBoolean(row, "active"),
        })
      }
      for (const row of table(rows, "committee_members").values()) {
        store.saveMember({
          tenantId,
          id: readText(row, "id"),
          committeeId: readText(row, "committee_id"),
          nameAr: readText(row, "name_ar"),
        })
      }
      for (const row of table(rows, "committee_activities").values()) {
        store.saveActivity({
          tenantId,
          id: readText(row, "id"),
          committeeId: readText(row, "committee_id"),
          periodId: readText(row, "period_id"),
          titleAr: readText(row, "title_ar"),
          participantCount: readInt(row, "participant_count"),
          participantNamesAr: readStrings(row, "participant_names_ar"),
          completedAt: readDate(row, "completed_at"),
        })
      }
      for (const row of table(rows, "committee_meetings").values()) {
        store.saveMeeting({
          tenantId,
          id: readText(row, "id"),
          mosqueUnitId: readText(row, "mosque_unit_id"),
          mosquePath: readText(row, "unit_path"),
          heldAt: readDate(row, "held_at"),
          minutesAr: readText(row, "minutes_ar"),
          decisionsAr: readStrings(row, "decisions_ar"),
        })
      }

      const stored = table(rows, "sequences").get(naturalKey(tenantId, SEQUENCE))
      hydratedSeq = Math.max(derivedSeq(), stored === undefined ? 0 : readInt(stored, "value"))
      // العدّادُ يُستأنف ولا يعود صفراً — وإلا دهس معرّفٌ جديدٌ معرّفاً محفوظاً خارج النطاق.
      for (let i = 0; i < hydratedSeq; i += 1) store.nextId("_hydrate")
    },
  }
}
