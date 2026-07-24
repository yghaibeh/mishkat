/**
 * مستودعُ نموذج الحلقات على D1 — **خلف العقد القائم بلا تغيير توقيعٍ واحد**.
 *
 * لا صنفَ جديدٌ ولا وكيلٌ ولا اعتراضُ نداءات: المستودعُ الذي تراه الخدمةُ هو `CirclesStore`
 * نفسُه حرفياً، وهذا الملفُّ **يُسقطه ويُحمّله** لا غير (`db/README.md` الحسم ١، الطبقة ٢).
 * ولذلك لم يُعدَّل في `services/` ولا في `server/endpoints.ts` سطرٌ واحد.
 *
 * ---
 *
 * ## **مصدران لا واحد** — الوصفة §٤-٠ (القاعدةُ المستخرَجة من `dailyLog` · CR-029)
 *
 * جداولُ هذه الوحدة **صنفان**:
 *  · **كتالوجٌ مرجعيٌّ شبكيّ** (أنواعُ الحلقات) — نطاقُه **الجذرُ `'/'`**، ويُقرأ من كلِّ وحدة
 *    (قب-٢٢/ق-٨٩)، **ويقرؤه غيرُنا كذلك**: `circleLog` يسأل عنه في تحقّق المادة الإثرائية،
 *    و`education` يربط مناهجَه بأنواعه — فمعجمُ الأنواع **واحدٌ في النظام كلِّه** (CR-014).
 *  · **سجلٌّ تشغيليٌّ بالوحدة** (إسقاطُ الوحدات · الحلقاتُ · الالتحاقات) — نطاقُه **مسارُ
 *    وحدته**، وهو الضخم (الالتحاقُ ~١٥ صفّاً لكلِّ حلقة).
 *
 * **ولو جمعهما مصدرٌ واحدٌ لفَرَضَ أضيقُهما نطاقاً على أوسعِهما حملَه**: وحدةُ العمل تُحمَّل
 * **بنطاقٍ واحد**، فجلسةٌ تقرأ كتالوجَ الأنواع بالجذر كانت تُحمّل `LIKE '/%'` ⟵ **كلَّ حلقات
 * الشبكة والتحاقاتِها**، لا الكتالوجَ وحدَه. **والعلاجُ ليس رفعَ السقف** (سقفٌ بحجم الشبكة لا
 * يحرس شيئاً) **بل هذا الفصل** — ولذلك **لكلِّ مصدرٍ سقفُه المُسنَد إلى حمولته الحقيقية**.
 *
 * > **ولم يُنقدح زنادُ CR-026**: نصُّه (قب-٤٨) *«إخفاقٌ **يتعذّر** إصلاحُه بتضييق النطاق»* —
 * > وهذا يُضيَّق بالفصل نفسِه. والزنادُ صمّامُ أمانٍ لا يُحرق على حالةٍ لها علاجٌ أرخصُ وأصحّ.
 *
 * ---
 *
 * ### وثلاثةُ فروقٍ أخرى عن القالب (`custodyRepository`) — كلُّها مُصرَّحٌ بها في التقرير
 * ١. **لا سجلَّ تدقيقٍ يُوحَّد ولا يُقذف من هنا.** كحال المكتبة: **لم تحمل `circles` سجلاً
 *    محلياً قطّ** — تدقيقُها يُعلَن على **دالّة الخادم** (`defineServerFn.audit`) لا في
 *    المستودع ولا في الخدمة. فبند CR-027 **غيرُ ذي موضوعٍ هنا**.
 * ٢. **مفتاحُ توجيه الالتحاق مشتقٌّ من حلقته** — ولا يُخترع (نظيرُ حركةِ العُهد من أصلها
 *    وخطِّ زمن المكتبة من مادته): حلقةٌ مجهولةٌ ⟵ **رميةٌ** لا توجيهٌ إلى الجذر صامتاً.
 *    **وهذا آمنٌ بدليلٍ بنيويٍّ لا نصّيّ** (وهو أقوى من دليل العُهد): `UpdateCircleInput`
 *    **ليس فيه حقلُ وحدة** — فلا مقبضَ ينقل حلقةً بين وحدتين في السطح كلِّه، ومسارُ الحلقة
 *    **لا يتحرّك** ⟵ فلا يُعاد كتابةُ صفٍّ ملحقٍ فقط بمفتاحٍ جديد (الوصفة فخّ ٤).
 * ٣. **لا عدّادَ مشتقٌّ يُتحقَّق منه.** العددُ والسعةُ والمتبقّي اشتقاقٌ عند القراءة
 *    (`services/derive.ts`) لا رولّ-أب مخزَّن — **صفرُ حالةٍ مخزَّنة أرخصُ من رولّ-أبٍ محروس**
 *    (README §٤)، وهو بعينه ما يقتل ع-١٩/ع-٢٩ بالبناء.
 */

import { encodeDate, encodeNullable, readDate, readDateOrNull, readInt, readText, readTextOrNull } from "../encode.js"
import { tableSpec, TENANT_ROOT_PATH } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"
import { naturalKey, primaryKeyOf, type PersistentStore, type RowSet } from "../unitOfWork.js"
import { CirclesStore } from "../../features/circles/data/store.js"
import { sequenceRow, suffixOf } from "./shared.js"

const CATALOG_SOURCE = "circles.catalog"
const REGISTRY_SOURCE = "circles.registry"
const SEQUENCE = "circles.seq"

/**
 * سقفُ **الكتالوج** (G23 · CR-026 ب · CR-029/الوصفة §٤-٠) — حمولةٌ **مقيَّدةٌ بنيوياً لا مقدَّرة**.
 *
 * الكتالوجُ معجمٌ **مغلقٌ للشبكة** (قب-٢٢/ق-٨٩): أنواعُ الحلقات. وهو **لا ينمو مع الميدان** —
 * لا مع عدد المساجد ولا الحلقات ولا الطلاب؛ يُضاف صفّاً بقرارٍ إداريّ. فبذرةُ اليوم **أربعةُ
 * صفوف** (تحفيظ · على بصيرة · علمية · الرشيدي)، وأسخى تقديرٍ لشبكةٍ ناضجة **عشراتٌ**.
 *
 * فالسقفُ **١٬٠٠٠** هامشٌ ~١٠× على أسخى تقدير (ونظيرُ سقف كتالوج المكتبة حرفاً). **وهذا هو
 * المقصودُ من الفصل**: جلسةٌ تقرأ الأنواعَ بالجذر تُحمّل **هذه الصفوفَ وحدَها**.
 */
const CATALOG_ROW_BUDGET = 1_000

/**
 * سقفُ **السجلّ التشغيليّ** (G23 · CR-026 ب · قب-٤٨) — **مُسنَدٌ إلى أوسع نطاقٍ يقرؤه سطحٌ
 * مُعلَنٌ فعلاً** (CR-030)، والسطحُ يُذكر **باسمه** لا بوصفٍ عامّ:
 *
 * > **`circle.scope.view` و`circle.stats.view`** (`server/endpoints.ts`) — نطاقُ كلٍّ منهما
 * > `unitById(input.unitId)`: **أيُّ وحدةٍ بمعرّفها**، ومنها **عقدةُ الشبكة العليا**. فحاملُ
 * > `circle.view` على الجذر (المديرُ العامّ) يقرأ **حلقاتِ الشبكة كلِّها وإحصاءَها** في طلبٍ
 * > واحد — وهذا سطحٌ **مُعلَنٌ اليوم لا محتملٌ غداً**. فالسقفُ يُسنَد إلى **حمل الشبكة**،
 * > ولا يُدّعى تضييقٌ يُكذّبه هذا السطح (نظيرُ سقف `org` المُعلَن شبكياً صراحةً).
 *
 * والمحمولُ ثلاثةُ جداول، وكلُّها **مُسنَدٌ إلى أرقامٍ مقيسة في ADR-001** لا إلى تقديرٍ مجمَّع:
 *  · **الوحدات**: §١-٥ يقيس ~**٨٦٠** وحدةً تنظيمية للشبكة اليوم.
 *  · **الحلقات**: ملحقُ ADR أ يشتقّ `lesson_attendance` من «**٩٦٠ حلقة** × ١٥ طالباً × ٥٢
 *    جلسة» ⟵ **٩٦٠** حلقةً حيّةً للشبكة. والمؤرشفةُ **وسمٌ يبقى صفُّه**، فبالاحتفاظ سنتين
 *    (قب-٦) وبفرض دورانٍ ~٥٠٪ ⟵ ~**١٬٤٤٠**.
 *  · **الالتحاقات**: من المرساة نفسِها **٩٦٠ × ١٥ = ١٤٬٤٠٠** التحاقاً حيّاً؛ والخروجُ **وسمٌ
 *    يبقى صفُّه** (ملحقٌ فقط) ⟵ بدورانٍ ~١٠٠٪ على سنتين ~**٢٨٬٨٠٠**.
 *
 * فحملُ الشبكة كلِّها ~**٣١٬١٠٠** صفّاً، والسقفُ **٤٠٬٠٠٠** يتركه بهامشٍ ~١.٣×؛ بينما جلسةُ
 * مسجدٍ (حلقتان أو ثلاث × ١٥) **عشراتٌ قليلة**، وجلسةُ قسمٍ **آلافٌ**.
 *
 * > **والضعفُ يُقال لا يُجمَّل**: المقيسُ مرساتان (٨٦٠ وحدةً · ٩٦٠ حلقةً × ١٥)، **وما ليس
 * > مقيساً هو معاملا الدوران** (~٥٠٪ للحلقات و~١٠٠٪ للالتحاقات على سنتين) — تقديرٌ مني لا
 * > رقمٌ في وثيقة. وخطؤهما بمقدار ٢× يبلغ ~٤٦٬٠٠٠ ⟵ **يتجاوز السقفَ فيُسمَع** بدل أن يمرّ
 * > صامتاً، وذلك بعينه ما أراده قب-٤٨. فإن قِيس الدورانُ يوماً **يُراجَع هذا السقف**.
 */
const REGISTRY_ROW_BUDGET = 40_000

function table(rows: RowSet, name: string): ReadonlyMap<string, SqlRow> {
  return rows.get(name) ?? new Map<string, SqlRow>()
}

function collect(entries: readonly SqlRow[], name: string): [string, ReadonlyMap<string, SqlRow>] {
  const spec = tableSpec(name)
  return [name, new Map(entries.map((entry) => [primaryKeyOf(spec, entry), entry]))]
}

/**
 * **كتالوجُ أنواع الحلقات** — معجمٌ نطاقُه **جذرُ الشبكة**، يُقرأ من كلِّ وحدةٍ ومن وحدتين
 * أخريين (`circleLog`/`education`). مصدرٌ مستقلٌّ بحكم §٤-٠: قراءتُه لا تجرّ صفَّ حلقةٍ واحداً.
 */
export function persistentCirclesCatalog(store: CirclesStore): PersistentStore {
  const tenantId = store.tenantId
  return {
    name: CATALOG_SOURCE,
    rowBudget: CATALOG_ROW_BUDGET,
    tables: ["circles_types"],

    project: () =>
      new Map([
        collect(
          store.types().map((type) => ({
            tenant_id: tenantId,
            unit_path: TENANT_ROOT_PATH,
            id: type.id,
            ar: type.ar,
          })),
          "circles_types",
        ),
      ]),

    load: (rows) => {
      for (const row of table(rows, "circles_types").values()) {
        store.saveType({ tenantId, id: readText(row, "id"), ar: readText(row, "ar") })
      }
    },
  }
}

/**
 * **السجلُّ التشغيليّ** — إسقاطُ الوحدات والحلقاتُ والالتحاقات، ونطاقُها **مسارُ الوحدة**.
 * ومعه عدّادُ المعرّفات (`sequences`) لأنه **يولّد معرّفاتِ الحلقات والالتحاقات** لا الأنواع
 * (فمعرّفُ النوع **قيمةُ صفٍّ مرجعيّ** يُملى من المُدخِل لا نبضةُ عدّاد).
 */
export function persistentCirclesRegistry(store: CirclesStore): PersistentStore {
  const tenantId = store.tenantId
  /** أعلى عدّادٍ رآه التحميل — يصون الحتميّة حين يكون النطاقُ جزئياً. */
  let hydratedSeq = 0

  /** مفتاحُ توجيه الالتحاق **مشتقٌّ من حلقته** — ولا يُخترع (انظر الفرق ٢ أعلاه). */
  const enrollmentPath = (circleId: string, enrollmentId: string): string => {
    const circle = store.getCircle(circleId)
    if (circle === null) {
      throw new Error(
        `مفتاحُ توجيهٍ لا يُشتقّ: الالتحاقُ ${enrollmentId} يشير إلى حلقةٍ مجهولة ${circleId}`,
      )
    }
    return circle.unitPath
  }

  const derivedSeq = (): number => {
    let max = hydratedSeq
    for (const circle of store.circles()) max = Math.max(max, suffixOf(circle.id))
    for (const enrollment of store.enrollments()) max = Math.max(max, suffixOf(enrollment.id))
    return max
  }

  return {
    name: REGISTRY_SOURCE,
    rowBudget: REGISTRY_ROW_BUDGET,
    tables: [
      "circles_units",
      "circles_circles",
      "circles_enrollments",
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
          "circles_units",
        ),
        collect(
          store.circles().map((circle) => ({
            tenant_id: tenantId,
            unit_path: circle.unitPath,
            id: circle.id,
            type_id: circle.typeId,
            name_ar: circle.nameAr,
            capacity: circle.capacity,
            teacher_person_id: circle.teacherPersonId,
            archived_at: encodeNullable(circle.archivedAt, encodeDate),
            created_at: encodeDate(circle.createdAt),
          })),
          "circles_circles",
        ),
        collect(
          store.enrollments().map((enrollment) => ({
            tenant_id: tenantId,
            unit_path: enrollmentPath(enrollment.circleId, enrollment.id),
            id: enrollment.id,
            circle_id: enrollment.circleId,
            name_ar: enrollment.nameAr,
            joined_at: encodeDate(enrollment.joinedAt),
            left_at: encodeNullable(enrollment.leftAt, encodeDate),
          })),
          "circles_enrollments",
        ),
        collect([sequenceRow(tenantId, SEQUENCE, derivedSeq())], "sequences"),
      ]),

    load: (rows) => {
      for (const row of table(rows, "circles_units").values()) {
        store.saveUnit({ tenantId, id: readText(row, "id"), path: readText(row, "unit_path") })
      }
      for (const row of table(rows, "circles_circles").values()) {
        store.saveCircle({
          tenantId,
          id: readText(row, "id"),
          unitPath: readText(row, "unit_path"),
          typeId: readText(row, "type_id"),
          nameAr: readText(row, "name_ar"),
          capacity: readInt(row, "capacity"),
          teacherPersonId: readTextOrNull(row, "teacher_person_id"),
          archivedAt: readDateOrNull(row, "archived_at"),
          createdAt: readDate(row, "created_at"),
        })
      }
      // **بترتيب المعرّف**: `appendEnrollment` إلحاقٌ يرمي على المكرَّر، والاشتقاقُ يفرز
      // بالمعرّف على أي حال — فالترتيبُ هنا صدقٌ لا اعتمادٌ عليه.
      const enrollments = [...table(rows, "circles_enrollments").values()].sort(
        (a, b) => suffixOf(readText(a, "id")) - suffixOf(readText(b, "id")),
      )
      for (const row of enrollments) {
        store.appendEnrollment({
          tenantId,
          id: readText(row, "id"),
          circleId: readText(row, "circle_id"),
          nameAr: readText(row, "name_ar"),
          joinedAt: readDate(row, "joined_at"),
          leftAt: readDateOrNull(row, "left_at"),
        })
      }

      const stored = table(rows, "sequences").get(naturalKey(tenantId, SEQUENCE))
      hydratedSeq = Math.max(derivedSeq(), stored === undefined ? 0 : readInt(stored, "value"))
      // العدّادُ يُستأنف ولا يعود صفراً — وإلا دهس معرّفٌ جديدٌ معرّفاً محفوظاً خارج النطاق.
      for (let i = 0; i < hydratedSeq; i += 1) store.nextId("_hydrate")
    },
  }
}
