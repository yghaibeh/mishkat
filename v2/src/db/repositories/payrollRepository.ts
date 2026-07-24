/**
 * مستودعُ الرواتب على D1 — **خلف العقد القائم بلا تغيير توقيعٍ واحد**.
 *
 * لا صنفَ جديدٌ ولا وكيلٌ ولا اعتراضُ نداءات: المستودعُ الذي تراه الخدمةُ هو `PayrollStore`
 * نفسُه حرفياً، وهذا الملفُّ **يُسقطه ويُحمّله** لا غير (`db/README.md` الحسم ١، الطبقة ٢).
 * ولذلك لم يُعدَّل في `services/*` ولا في `server/endpoints.ts` سطرٌ واحد.
 *
 * ---
 *
 * ## **مصنعٌ واحدٌ — والسؤالُ سُئل ولم يُفترض جوابُه** (وصفة §٤-٠)
 *
 * جداولُ الرواتب الستةُ **كلُّها من النمط (أ)**: تشغيليةٌ تسكن مسارَ وحدتها. **لا كتالوجَ
 * مرجعيّاً شبكيّاً في هذه الوحدة** — أسعارُ الساعة والراتب المقطوع **إعداداتٌ** يحلّها
 * `SettingsResolver` (ق-م-٢) لا صفوفٌ في مستودعٍ، وحساباتُ الرواتب الثلاثة تُمرَّر
 * `PayrollAccounts` من المُركِّب. فلا صنفَين يجتمعان ⟵ **لا موجبَ لفصل مصنعَين**، وفصلٌ
 * بلا موجبٍ يُنشئ مصدرَين ويُضاعف السقوف بلا مقابل.
 *
 * ---
 *
 * ### وأربعةُ فروقٍ عن سابقاتها تستحقّ أن تُقال
 *
 * ١. **«لا صرفَ مرتين» انتقل من الذاكرة إلى القاعدة** (ق-٦٥ · شرطٌ منصوصٌ في T31).
 *    كان الحارسُ `paidPersonIdsIn` في الذاكرة وحدَها، **ويكفي ما دام كلُّ شيءٍ محمَّلاً**.
 *    ويوم يصير النطاقُ جزئياً **ينكسر بلا صوت**: جلسةٌ بنطاق وحدةٍ لا تُحمّل صرفَ وحدةٍ
 *    أخرى ⟵ يمرّ الشخصُ من الحارس فيُصرف له مرّتين في فترةٍ واحدة. فصار «مَن صُرف له»
 *    **جدولاً مستقلاً** عليه **فهرسٌ فريد** `(tenant_id, period_id, person_id)`، والدفعةُ
 *    معاملةٌ ⟵ الازدواجُ **يرمي ويرتدّ كلُّ شيء**. *وحارسُ الذاكرة يبقى: يعطي رسالةً
 *    مفهومةً في المسار السعيد، وحارسُ القاعدة يمنع ما لا تراه الذاكرةُ أصلاً.*
 *
 * ٢. **مفتاحا توجيهٍ مشتقّان لا مخترعان** — القسطُ من سلفته، ومَن صُرف له من صرفه.
 *    وأصلٌ مجهولٌ ⟵ **رميةٌ** لا توجيهٌ إلى الجذر صامتاً (نظيرُ `requestPath` في `orgRepository`).
 *    > **وسؤالُ الوصفة (فخّ ٤): أيتحرّك مفتاحُ توجيه صفٍّ بعد كتابته؟** **لا، ومقيسٌ لا
 *    > مفترَض**: `Advance.unitPath` يُكتب عند المنح من وحدة **خروج النقد**، والكاتبُ الوحيدُ
 *    > بعده `recordInstalment` وهو يكتب `{ ...advance, closedAt }` — **لا يمسّ المسار**.
 *    > فالسلفةُ لا تتبع الشخصَ إن انتقل: **الذمّةُ حيث خرج المال**. ويُقاس ذلك سلوكياً في
 *    > `tests/db/payroll.test.ts` (منحٌ ⟵ قسطٌ ⟵ إقفال ⟵ `unit_path` لم يتغيّر).
 *
 * ٣. **التحميلُ حشوٌ لا إعادةُ تشغيل** (وصفة §٤-٥): دوالُّ الحفظ تستقبل الكيانَ **بمعرّفه**،
 *    فيكفي **استئنافُ العدّاد**. وعدّادُ هذه الوحدة **واحدٌ لخمس بادئات** (`adv`/`ins`/`pay`/
 *    `dist`/`inc`) ⟵ الاشتقاقُ يمسحها **كلَّها**: نسيانُ واحدةٍ يُنقص نبضةً فتُعاد في جلسةٍ
 *    لاحقة **فتدهس صفّاً محفوظاً**.
 *
 * ٤. **لا عدّادَ مشتقٌّ ولا رولّ-أب هنا، والقائمُ لا يُوازى.** «مدفوعٌ» **يُشتقّ من سجل
 *    الصرف** لا حقلٌ يُحدَّث (ق-٦٥)، و«المتبقي على سلفة» **يُشتقّ من أقساطها** لا حقلٌ
 *    يُنقَص، والمستحقُّ **يُشتقّ لحظةَ السؤال**. وأرصدةُ الصناديق رولّ-أبُ الدفتر (T26-أ)
 *    **تُقرأ ولا تُبنى ثانيةً هنا**: ليس في هذا الملفّ جدولُ رولّ-أبٍ ولا مسارُ كتابةٍ إليه.
 */

import {
  encodeDate,
  encodeNullable,
  readDate,
  readDateOrNull,
  readInt,
  readText,
} from "../encode.js"
import { tableSpec } from "../schema.js"
import type { SqlRow } from "../sql/driver.js"
import { naturalKey, primaryKeyOf, type PersistentStore, type RowSet } from "../unitOfWork.js"
import type { Cents } from "../../features/ledger/types.js"
import { PayrollStore } from "../../features/payroll/data/store.js"
import { sequenceRow, suffixOf } from "./shared.js"

const SOURCE = "payroll"
const SEQUENCE = "payroll.seq"

/**
 * سقفُ صفوف وحدة العمل (G23 · CR-026 ب · قب-٤٨) — **مشتقٌّ لا مُقدَّر، وبضعفٍ مُصرَّحٍ به**.
 *
 * > **والمرساةُ ما يُقرأ فعلاً لا ما يُتصوَّر** (CR-030): مُسحت `server/endpoints.ts` كلُّها،
 * > فسطوحُ هذه الوحدة **ستةٌ**: خمسةٌ نطاقُها `unitScope(input.unitPath)` وسادسٌ شخصيّ
 * > (`payroll.payslip.own`). **وأوسعُ نطاقٍ يقرؤه سطحٌ مُعلَنٌ فعلاً = وحدةُ قسم** (`/men/`)،
 * > ويبلغه **`payroll.distribution.view` باسمه** — فخريطةُ التوزيع تُقرأ من عقدةٍ عليا
 * > («المتبقي عند مسجد كذا» هابطاً)، وهي أوسعُ سطوح هذه الوحدة نطاقاً بلا منازع.
 * > فإن اتّسع سطحٌ يوماً إلى الشبكة حَمُر السقفُ وسُئل: **أيتّسع بدليلٍ أم يُضيَّق السطح؟**
 *
 * والمحمولُ **ستةُ جداولَ وعدّادُها**، وكلُّها **غيرُ مقيسة** — لا جدولَ رواتبٍ في جداول
 * ADR §١-١/§١-٣ المقيسة، فلا أدّعي رقماً لم يُقَس. وأقربُ إسنادٍ صادقٍ ملحقُ ADR أ: «باقي
 * الـ٩٥ جدولاً — تقديرٌ مجمَّع **١٠٪**» من ~١٫٩ مليون صفٍّ/سنة ⟵ ~٢٬٠٠٠ صفٍّ لكلِّ جدولٍ
 * في السنة على مستوى الشبكة. **ستةُ جداول** ⟵ ~١٢٬٠٠٠/سنة، وبالاحتفاظ **سنتين** (قب-٦)
 * ⟵ **~٢٤٬٠٠٠ للشبكة كلِّها**، والقسمُ ~نصفُها ⟵ **~١٢٬٠٠٠**.
 *
 * فالسقفُ **٤٠٬٠٠٠** = **~١٫٧×** حملَ الشبكة كلِّها و**~٣٫٣×** أوسعَ سطحٍ مُعلَن (القسم).
 * ولذلك **أوّلُ تجاوزٍ هنا ليس «تضخّمَ بيانات» بل «قراءةٌ وسّعت النطاق»**.
 *
 * > **والضعفُ يُقال لا يُجمَّل، وأخطرُ ضلعَين**: **(أ)** `payroll_payout_persons` **ينمو
 * > بعدد الأشخاص × الفترات** لا بعدد الأحداث — صفٌّ لكلِّ مستحقٍّ في كلِّ شهر، وهو **أسرعُ
 * > الستة نموّاً بفارق**؛ و**(ب)** أن تقدير «جدولٍ من الـ٩٥» **موحَّدٌ** فلا يميّز بينها.
 * > فإن قِيس كادرُ الشبكة يوماً **يُراجَع هذا السقف بالرقم المقيس**. وإن تجاوزته جلسةٌ
 * > مشروعة فأوّلُ الدواء **تضييقُ النطاق** — وهذه الجداولُ **كلُّها من النمط (أ)** فالتضييقُ
 * > بالمسار **يعمل فيها**، ولا يُسمّى ذلك «زنادَ CR-026» إلا إن تعذّر التضييقُ حقاً
 * > (قب-٤٨ · تصحيحُ CR-029: الزنادُ صمّامٌ لا يُحرق على حالةٍ لها علاجٌ أرخصُ وأصحّ).
 */
const ROW_BUDGET = 40_000

function table(rows: RowSet, name: string): ReadonlyMap<string, SqlRow> {
  return rows.get(name) ?? new Map<string, SqlRow>()
}

function collect(entries: readonly SqlRow[], name: string): [string, ReadonlyMap<string, SqlRow>] {
  const spec = tableSpec(name)
  return [name, new Map(entries.map((entry) => [primaryKeyOf(spec, entry), entry]))]
}

export function persistentPayroll(store: PayrollStore): PersistentStore {
  const tenantId = store.tenantId
  /** أعلى عدّادٍ رآه التحميل — يصون الحتميّة حين يكون النطاقُ جزئياً. */
  let hydratedSeq = 0

  /** مفتاحُ توجيه القسط **مشتقٌّ من سلفته** — ولا يُخترع (انظر الفرق ٢ أعلاه). */
  const instalmentPath = (advanceId: string, instalmentId: string): string => {
    const advance = store.getAdvance(advanceId)
    if (advance === null) {
      throw new Error(
        `مفتاحُ توجيهٍ لا يُشتقّ: قسطُ الرواتب ${instalmentId} يشير إلى سلفةٍ مجهولة ${advanceId}`,
      )
    }
    return advance.unitPath
  }

  /**
   * وعدّادُ هذه الوحدة **واحدٌ لخمس بادئات** (`adv`/`ins`/`pay`/`dist`/`inc`) — فالاشتقاقُ
   * يمسحها كلَّها. ونسيانُ بادئةٍ **يُنقص نبضةً** فتُعاد في جلسةٍ لاحقة فتدهس صفّاً محفوظاً.
   */
  const derivedSeq = (): number => {
    let max = hydratedSeq
    for (const advance of store.advances()) max = Math.max(max, suffixOf(advance.id))
    for (const instalment of store.instalments()) max = Math.max(max, suffixOf(instalment.id))
    for (const payout of store.payouts()) max = Math.max(max, suffixOf(payout.id))
    for (const distribution of store.distributions()) max = Math.max(max, suffixOf(distribution.id))
    for (const incentive of store.incentives()) max = Math.max(max, suffixOf(incentive.id))
    return max
  }

  return {
    name: SOURCE,
    rowBudget: ROW_BUDGET,
    tables: [
      "payroll_advances",
      "payroll_instalments",
      "payroll_payouts",
      "payroll_payout_persons",
      "payroll_distributions",
      "payroll_incentives",
      { table: "sequences", owns: (r) => r["name"] === SEQUENCE },
    ],

    project: () => {
      const instalments = store.instalments()
      return new Map([
        collect(
          store.advances().map((advance) => ({
            tenant_id: tenantId,
            unit_path: advance.unitPath,
            id: advance.id,
            person_id: advance.personId,
            entry_id: advance.entryId,
            principal_cents: advance.principalCents,
            instalment_cents: advance.instalmentCents,
            granted_at: encodeDate(advance.grantedAt),
            closed_at: encodeNullable(advance.closedAt, encodeDate),
          })),
          "payroll_advances",
        ),
        collect(
          instalments.map((instalment) => ({
            tenant_id: tenantId,
            unit_path: instalmentPath(instalment.advanceId, instalment.id),
            id: instalment.id,
            advance_id: instalment.advanceId,
            period_id: instalment.periodId,
            entry_id: instalment.entryId,
            amount_cents: instalment.amountCents,
          })),
          "payroll_instalments",
        ),
        collect(
          store.payouts().map((payout) => ({
            tenant_id: tenantId,
            unit_path: payout.payingUnitPath,
            id: payout.id,
            entry_id: payout.entryId,
            period_id: payout.periodId,
            paid_by: payout.paidBy,
            at: encodeDate(payout.at),
          })),
          "payroll_payouts",
        ),
        collect(
          store.payouts().flatMap((payout) =>
            payout.personIds.map((personId) => ({
              tenant_id: tenantId,
              // يرث مسارَ صرفه — نظيرُ القسط من سلفته.
              unit_path: payout.payingUnitPath,
              payout_id: payout.id,
              person_id: personId,
              period_id: payout.periodId,
            })),
          ),
          "payroll_payout_persons",
        ),
        collect(
          store.distributions().map((distribution) => ({
            tenant_id: tenantId,
            unit_path: distribution.toUnitPath,
            id: distribution.id,
            period_id: distribution.periodId,
            at: encodeDate(distribution.at),
          })),
          "payroll_distributions",
        ),
        collect(
          store.incentives().map((incentive) => ({
            tenant_id: tenantId,
            unit_path: incentive.unitPath,
            id: incentive.id,
            person_id: incentive.personId,
            entry_id: incentive.entryId,
            granted_by: incentive.grantedBy,
            at: encodeDate(incentive.at),
          })),
          "payroll_incentives",
        ),
        collect([sequenceRow(tenantId, SEQUENCE, derivedSeq())], "sequences"),
      ])
    },

    load: (rows) => {
      // **السلفُ أوّلاً**: أقساطُها تشتقّ مفتاحَ توجيهها منها، فلا يُسقَط قسطٌ قبل سلفته.
      for (const row of table(rows, "payroll_advances").values()) {
        store.saveAdvance({
          tenantId,
          id: readText(row, "id"),
          personId: readText(row, "person_id"),
          unitPath: readText(row, "unit_path"),
          entryId: readText(row, "entry_id"),
          principalCents: readInt(row, "principal_cents") as Cents,
          instalmentCents: readInt(row, "instalment_cents") as Cents,
          grantedAt: readDate(row, "granted_at"),
          closedAt: readDateOrNull(row, "closed_at"),
        })
      }
      // **بترتيب المعرّف**: القوائمُ ملحقةٌ وترتيبُ الإلحاق جزءٌ من قراءتها، والفرزُ على
      // لاحقة العدّاد لأنها ترتيبُ التخصيص نفسُه (`ins-2` قبل `ins-10` عدداً لا نصّاً).
      const byId = (a: SqlRow, b: SqlRow): number =>
        suffixOf(readText(a, "id")) - suffixOf(readText(b, "id"))

      for (const row of [...table(rows, "payroll_instalments").values()].sort(byId)) {
        store.appendInstalment({
          tenantId,
          id: readText(row, "id"),
          advanceId: readText(row, "advance_id"),
          periodId: readText(row, "period_id"),
          entryId: readText(row, "entry_id"),
          amountCents: readInt(row, "amount_cents") as Cents,
        })
      }

      // **مَن صُرف له يُجمَع بصرفه** قبل بناء سجلّ الصرف — فالكيانُ يُعاد كاملاً أو لا يُعاد.
      const personsOf = new Map<string, string[]>()
      for (const row of table(rows, "payroll_payout_persons").values()) {
        const payoutId = readText(row, "payout_id")
        const list = personsOf.get(payoutId) ?? []
        list.push(readText(row, "person_id"))
        personsOf.set(payoutId, list)
      }
      for (const row of [...table(rows, "payroll_payouts").values()].sort(byId)) {
        const id = readText(row, "id")
        const persons = personsOf.get(id)
        // **صرفٌ بلا مَن صُرف له يُرمى ولا يُقرأ فارغاً**: صفوفُ الأشخاص ترث مسارَ صرفها
        // حرفاً بحرف، فهي **محمَّلةٌ معه دائماً** في أيّ نطاق. وغيابُها ليس نطاقاً جزئياً بل
        // **فسادُ بيانات** — و`?? []` كانت ستُنتج دفعةً فارغةً تمرّ صامتةً في أخطر سجلٍّ
        // ماليٍّ عندنا، فتُسقط «مَن صُرف له» وتُبطل حارسَ «لا صرفَ مرتين» معها (ق-٦٥).
        if (persons === undefined || persons.length === 0) {
          throw new Error(
            `صرفٌ بلا مَن صُرف له: ${id} — صفوفُ الأشخاص ترث مسارَه فتُحمَّل معه، وغيابُها فسادُ بيانات`,
          )
        }
        store.appendPayout({
          tenantId,
          id,
          entryId: readText(row, "entry_id"),
          periodId: readText(row, "period_id"),
          payingUnitPath: readText(row, "unit_path"),
          // **مفروزةٌ حتماً** — كما تُكتب في `disburse` (`[...new Set(personIds)].sort()`).
          personIds: [...persons].sort(),
          paidBy: readText(row, "paid_by"),
          at: readDate(row, "at"),
        })
      }

      for (const row of [...table(rows, "payroll_distributions").values()].sort(byId)) {
        store.appendDistribution({
          tenantId,
          id: readText(row, "id"),
          periodId: readText(row, "period_id"),
          toUnitPath: readText(row, "unit_path"),
          at: readDate(row, "at"),
        })
      }

      for (const row of [...table(rows, "payroll_incentives").values()].sort(byId)) {
        store.appendIncentive({
          tenantId,
          id: readText(row, "id"),
          personId: readText(row, "person_id"),
          unitPath: readText(row, "unit_path"),
          entryId: readText(row, "entry_id"),
          grantedBy: readText(row, "granted_by"),
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
