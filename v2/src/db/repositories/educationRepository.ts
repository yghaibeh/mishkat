/**
 * مستودعُ منهاج «على بصيرة» على D1 — **خلف العقد القائم بلا تغيير توقيعٍ واحد**.
 *
 * لا صنفَ جديدٌ ولا وكيلٌ: المستودعُ الذي تراه الخدمةُ هو `EducationStore` نفسُه حرفياً،
 * وهذا الملفُّ **يُسقطه ويُحمّله** لا غير (`db/README.md` الحسم ١، الطبقة ٢).
 * **وتوقيعُ `approvedTeachingLoad` لم يُمسّ بحرف** (ق-٨٦ — شرطُ T31 نصّاً).
 *
 * ## **مصدران لا واحد** (§٤-٠)
 * · **كتالوجُ المنهاج** (منهاجٌ · مستوياتٌ · كتبٌ · مجالس) — مرجعيٌّ شبكيٌّ **بالجذر**.
 * · **بصماتُ التصحيح** — تشغيليةٌ **بالوحدة**، ونطاقُها **يُشتقّ من حلقتها**.
 *
 * **ولو جمعهما مصدرٌ واحدٌ لجرّت قراءةُ المنهاج بالجذر بصماتِ الشبكة كلَّها.**
 *
 * ### وثلاثةُ فروقٍ عن القالب
 * ١. **الوحدةُ تقرأ مستودعين** (الوصفة §٧ توقّعته): وحدةُ عملها في التركيب الحقيقيّ تضمّ
 *    **مصادرَها هذه ومصادرَ `circleLog`** — و**الميزانيةُ تُقاس لكلِّ مصدرٍ على حدة** فلا
 *    تُجمع ذهنياً: سقفُ الكتالوج هنا **لا يُخفّف** سقفَ سجلّ اليوم هناك ولا يُشدّده.
 * ٢. **مفتاحُ توجيه البصمة يُشتقّ من حلقتها** بقارئِ مسارٍ مُحقَن — كسجلّ اليوم حرفاً،
 *    ولنفس السبب: **لا كيانَ حلقةٍ في هذا المستودع** (ب-٢٨).
 * ٣. **لا سجلَّ تدقيقٍ محليّ ولا عدّادٌ مشتقّ**: التقدّمُ **يُبنى لحظةَ السؤال** (ق-٩٢)،
 *    و**صفرُ حالةٍ مخزَّنة أرخصُ من رولّ-أبٍ محروس** (README §٤).
 */

import { encodeBoolean, encodeDate, readBoolean, readDate, readInt, readText } from "../encode.js"
import { tableSpec, TENANT_ROOT_PATH } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"
import { naturalKey, primaryKeyOf, type PersistentStore, type RowSet } from "../unitOfWork.js"
import { EducationStore } from "../../features/education/data/store.js"
import { sequenceRow, suffixOf } from "./shared.js"

const CATALOG_SOURCE = "education.catalog"
const ENTRIES_SOURCE = "education.entries"
const SEQUENCE = "education.seq"

/**
 * سقفُ **كتالوج المنهاج** (G23 · §٤-٠) — **مقيسٌ لا مقدَّر**: ملحقُ ADR أ يقول عن جداول
 * المحتوى (`manhaj_*`) إنها **«ثابتٌ — لا ينمو مع الشبكة»** ويقيسها **١٤٥ صفّاً**.
 * فالسقفُ **١٬٠٠٠** هامشٌ ~٧× على رقمٍ **مقيسٍ في الوثيقة**، ولا ينمو بالمساجد ولا بالطلاب.
 */
const CATALOG_ROW_BUDGET = 1_000

/**
 * سقفُ **بصمات التصحيح** (G23 · CR-030) — والسطحُ **باسمه**: `education.progress.view`
 * و`education.progress.mark` نطاقُهما **حلقةٌ بعينها** (`circleScope`)، و`education.teacher.load`
 * نطاقُه **شخصيٌّ** — **فلا سطحَ مُعلَنٌ يقرأ بصماتِ نطاقٍ أوسعَ من وحدة**.
 *
 * **والبصمةُ استثناءٌ لا قاعدة** (ق-٩٢: «مع إمكان التعديل اليدويّ»): الأصلُ اشتقاقٌ، ولا
 * تُكتب بصمةٌ إلا حين يخالف الواقعُ الاشتقاق. فأسخى تقديرٍ **بصمةٌ لكلِّ (طالب × مجلس)** في
 * أوسع وحدةٍ واقعية: مسجدٌ ~٢.٤ حلقة × ١٥ طالباً × ~١٥ مجلساً ⟵ ~**٥٤٠**؛ وبنطاق مشرفٍ
 * (~١٠ مساجد) ⟵ ~**٥٬٤٠٠**. فالسقفُ **٢٠٬٠٠٠** هامشٌ ~٣.٧×.
 *
 * > **والضعفُ يُقال**: «بصمةٌ لكلِّ خليّة» **تقديرٌ أقصى لا قياس** — البصمةُ في الواقع نادرة.
 * > فإن قِيست يوماً **يُراجَع بالرقم المقيس**، وحتى ذلك الحين **السقفُ يُسمع النموَّ** لا يُسكته.
 */
const ENTRIES_ROW_BUDGET = 20_000

function table(rows: RowSet, name: string): ReadonlyMap<string, SqlRow> {
  return rows.get(name) ?? new Map<string, SqlRow>()
}

function collect(entries: readonly SqlRow[], name: string): [string, ReadonlyMap<string, SqlRow>] {
  const spec = tableSpec(name)
  return [name, new Map(entries.map((entry) => [primaryKeyOf(spec, entry), entry]))]
}

/** **كتالوجُ المنهاج** — أربعةُ صفوفٍ مرجعيةٍ نطاقُها **جذرُ الشبكة**؛ قراءتُه لا تجرّ بصمة. */
export function persistentEducationCatalog(store: EducationStore): PersistentStore {
  const tenantId = store.tenantId
  const root = { tenant_id: tenantId, unit_path: TENANT_ROOT_PATH }
  return {
    name: CATALOG_SOURCE,
    rowBudget: CATALOG_ROW_BUDGET,
    tables: ["education_curricula", "education_levels", "education_books", "education_sessions"],

    project: () =>
      new Map([
        collect(
          store.curricula().map((c) => ({ ...root, id: c.id, ar: c.ar, circle_type_id: c.circleTypeId })),
          "education_curricula",
        ),
        collect(
          store.levels().map((l) => ({
            ...root,
            id: l.id,
            curriculum_id: l.curriculumId,
            ar: l.ar,
            ordinal: l.ordinal,
          })),
          "education_levels",
        ),
        collect(
          store.books().map((b) => ({ ...root, id: b.id, level_id: b.levelId, ar: b.ar, ordinal: b.ordinal })),
          "education_books",
        ),
        collect(
          store.sessions().map((s) => ({ ...root, id: s.id, book_id: s.bookId, ar: s.ar, ordinal: s.ordinal })),
          "education_sessions",
        ),
      ]),

    load: (rows) => {
      for (const row of table(rows, "education_curricula").values()) {
        store.saveCurriculum({
          tenantId,
          id: readText(row, "id"),
          ar: readText(row, "ar"),
          circleTypeId: readText(row, "circle_type_id"),
        })
      }
      for (const row of table(rows, "education_levels").values()) {
        store.saveLevel({
          tenantId,
          id: readText(row, "id"),
          curriculumId: readText(row, "curriculum_id"),
          ar: readText(row, "ar"),
          ordinal: readInt(row, "ordinal"),
        })
      }
      for (const row of table(rows, "education_books").values()) {
        store.saveBook({
          tenantId,
          id: readText(row, "id"),
          levelId: readText(row, "level_id"),
          ar: readText(row, "ar"),
          ordinal: readInt(row, "ordinal"),
        })
      }
      for (const row of table(rows, "education_sessions").values()) {
        store.saveSession({
          tenantId,
          id: readText(row, "id"),
          bookId: readText(row, "book_id"),
          ar: readText(row, "ar"),
          ordinal: readInt(row, "ordinal"),
        })
      }
    },
  }
}

/** قارئُ مسار الحلقة — **أضيقُ عقدٍ يكفي طبقةَ البيانات** (كنظيره في `circleLogRepository`). */
export type CirclePathReader = (circleId: string) => string | null

/** **بصماتُ التصحيح** — تشغيليةٌ بالوحدة، ونطاقُها **يُشتقّ من حلقتها** ولا يُخترع. */
export function persistentEducationEntries(
  store: EducationStore,
  circlePathOf: CirclePathReader,
): PersistentStore {
  const tenantId = store.tenantId
  let hydratedSeq = 0

  const correctionPath = (circleId: string, id: string): string => {
    const path = circlePathOf(circleId)
    if (path === null) {
      throw new Error(`مفتاحُ توجيهٍ لا يُشتقّ: بصمةُ التصحيح ${id} تشير إلى حلقةٍ مجهولة ${circleId}`)
    }
    return path
  }

  const derivedSeq = (): number => {
    let max = hydratedSeq
    for (const correction of store.corrections()) max = Math.max(max, suffixOf(correction.id))
    return max
  }

  return {
    name: ENTRIES_SOURCE,
    rowBudget: ENTRIES_ROW_BUDGET,
    tables: [
      "education_progress_corrections",
      { table: "sequences", owns: (r) => r["name"] === SEQUENCE },
    ],

    project: () =>
      new Map([
        collect(
          store.corrections().map((c) => ({
            tenant_id: tenantId,
            unit_path: correctionPath(c.circleId, c.id),
            id: c.id,
            circle_id: c.circleId,
            enrollment_id: c.enrollmentId,
            session_id: c.sessionId,
            completed: encodeBoolean(c.completed),
            at: encodeDate(c.at),
            by_person_id: c.byPersonId,
            reason_ar: c.reasonAr,
          })),
          "education_progress_corrections",
        ),
        collect([sequenceRow(tenantId, SEQUENCE, derivedSeq())], "sequences"),
      ]),

    load: (rows) => {
      // **بترتيب المعرّف**: السجلُّ يُلحق، و«الأحدثُ يغلب» يُشتقّ بالوقت عند القراءة —
      // فالترتيبُ هنا صدقٌ لا اعتمادٌ عليه.
      const corrections = [...table(rows, "education_progress_corrections").values()].sort(
        (a, b) => suffixOf(readText(a, "id")) - suffixOf(readText(b, "id")),
      )
      for (const row of corrections) {
        store.saveCorrection({
          tenantId,
          id: readText(row, "id"),
          circleId: readText(row, "circle_id"),
          enrollmentId: readText(row, "enrollment_id"),
          sessionId: readText(row, "session_id"),
          completed: readBoolean(row, "completed"),
          at: readDate(row, "at"),
          byPersonId: readText(row, "by_person_id"),
          reasonAr: readText(row, "reason_ar"),
        })
      }

      const stored = table(rows, "sequences").get(naturalKey(tenantId, SEQUENCE))
      hydratedSeq = Math.max(derivedSeq(), stored === undefined ? 0 : readInt(stored, "value"))
      for (let i = 0; i < hydratedSeq; i += 1) store.nextId("_hydrate")
    },
  }
}
