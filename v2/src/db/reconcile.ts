/**
 * **المطابقةُ الدورية** (ADR-001 ع-٦: «جدول رصيد + **مطابقة ليلية** لكل رولّ-أب»؛
 * §٧-٣: مؤشرُ «تفاوت الرصيد المسبق عن إعادة البناء» يُقاس **ليلياً** وينذر عند **أي تفاوت**).
 *
 * تُعيد بناءَ الرصيد **من الأسطر في القاعدة نفسِها** وتقارنه بجدول الرولّ-أب. وهي **جاهزةٌ
 * للتشغيل الدوريّ**: لا تحمّل مستودعاً ولا تبني ذاكرة — استعلامان مجمَّعان وحسب، فتصلح
 * لشبكةٍ لا تسعها ذاكرةُ الـWorker (١٢٨ م.ب) وهو بعينه ما يحمينا منه ع-٦.
 *
 * **ولا تُصلح**: ليس في هذا الملفّ عبارةُ كتابةٍ واحدة — لا `INSERT` ولا `UPDATE` ولا
 * `DELETE`. *تصحيحٌ صامتٌ يعني أننا لن نعلم أبداً أن مصدراً ما كان يُفسد الرقم.*
 * (يحرس هذا `tests/db/rollup-write-path.test.ts` مسحاً بنيوياً على هذا الملفّ.)
 */

import {
  compareRollups,
  FundRollupMismatchError,
  rollupKeyOf,
  type RollupMismatch,
} from "../features/ledger/data/rollup.js"
import { readInt, readText } from "./encode.js"
import type { SqlDriver } from "./sql/driver.js"
import { scopeParams, scopePredicate, type Scope } from "./unitOfWork.js"

/**
 * صنفُ الحساب الذي يحمل مالَ الصندوق فعلاً — **الأصول**. يُمرَّر معاملاً مربوطاً لا نصّاً
 * في العبارة (المادة ٨/٢)، ويُطابق حرفياً ما يفلتره `appendLine` عند الكتابة: مصدرُ
 * الحقيقة واحدٌ للكتابة والمطابقة، وإلا اتُّهم الرولّ-أب بفارقٍ صنعه تعريفان.
 */
const ASSET_KIND = "asset"

/**
 * إعادةُ البناء من الأسطر — **تجميعٌ في القاعدة** لا تحميلٌ إلى الذاكرة.
 * الوصلُ على شجرة الحسابات لأن «أيُّ سطرٍ يحمل مالاً» صفةُ حسابه لا صفةُ سطره.
 */
async function rebuildFromLines(
  driver: SqlDriver,
  scope: Scope,
): Promise<ReadonlyMap<string, number>> {
  const rows = await driver.all({
    sql:
      "SELECT l.unit_path AS unit_path, l.fund_id AS fund_id, l.currency AS currency, " +
      "SUM(l.debit - l.credit) AS balance " +
      "FROM journal_lines l " +
      "JOIN ledger_accounts a ON a.tenant_id = l.tenant_id AND a.id = l.account_id " +
      `WHERE ${scopePredicate("l")} AND a.kind = ? AND l.fund_id IS NOT NULL ` +
      "GROUP BY l.unit_path, l.fund_id, l.currency",
    params: [...scopeParams(scope), ASSET_KIND],
  })
  return new Map(
    rows.map((row) => [
      rollupKeyOf(readText(row, "unit_path"), readText(row, "fund_id"), readText(row, "currency")),
      readInt(row, "balance"),
    ]),
  )
}

async function storedRollup(
  driver: SqlDriver,
  scope: Scope,
): Promise<ReadonlyMap<string, number>> {
  const rows = await driver.all({
    sql: `SELECT unit_path, fund_id, currency, balance FROM fund_balances WHERE ${scopePredicate()}`,
    params: scopeParams(scope),
  })
  return new Map(
    rows.map((row) => [
      rollupKeyOf(readText(row, "unit_path"), readText(row, "fund_id"), readText(row, "currency")),
      readInt(row, "balance"),
    ]),
  )
}

/** التفاوتاتُ كما هي — لِمن أراد أن يُنذر ويُبلّغ بدل أن يرمي (المراقبة، ADR §٧-٣). */
export async function fundBalanceMismatches(
  driver: SqlDriver,
  scope: Scope,
): Promise<readonly RollupMismatch[]> {
  return compareRollups(await rebuildFromLines(driver, scope), await storedRollup(driver, scope))
}

/**
 * المطابقةُ الليلية — **ترمي على أي تفاوت** (ADR §٧-٣: «ينذر عند **أي تفاوت**»).
 * ولا تُصلح: النظامُ يتوقّف ويُبلّغ، فيُبحث عن المصدر لا عن الرقم.
 */
export async function reconcileFundBalances(driver: SqlDriver, scope: Scope): Promise<void> {
  const mismatches = await fundBalanceMismatches(driver, scope)
  if (mismatches.length > 0) {
    throw new FundRollupMismatchError(`المطابقةُ الدورية · ${scope.tenantId}${scope.scopePath}`, mismatches)
  }
}
