/**
 * **مطابقةُ الرولّ-أب** — القيدان الثاني والثالث من قيود ع-٦ (`db/README.md` «الرولّ-أب»).
 *
 *  ٢. **مطابقةٌ مستمرة**: دالّةٌ تحسب المجموعَ من الأسطر وتقارنه بالرولّ-أب. تُستدعى في
 *     الاختبارات بعد كل خطوة، وفي التحميل على كل جلسة، وفي المطابقة الليلية على القاعدة.
 *  ٣. **الاختلافُ يُرمى ولا يُصلَح صامتاً**: **ليس في هذا الملف مسارُ إصلاح** — لا دالّةَ
 *     تُعيد بناء الرقم ولا تكتبه. تصحيحٌ صامتٌ يعني أننا **لن نعلم أبداً** أن مصدراً ما
 *     كان يُفسد الرقم؛ والرميةُ تُوقف النظام حيث يُرى العطبُ لا حيث يُدفَن.
 *
 * ورسالتُها **تُعلّم**: تُسمّي المفتاح، وما تقوله الأسطر، وما يقوله الرولّ-أب، والفارق.
 */

import type { LedgerStore } from "./store.js"
import type { FundRollupRow } from "../types.js"

/** تفاوتٌ واحد — بمفتاحه وبالرقمين، فلا يُطارَد العطبُ في غير موضعه. */
export type RollupMismatch = {
  readonly unitPath: string
  readonly fundId: string
  readonly currency: string
  /** ما تقوله **الأسطر** — مرجعُ الحقيقة. */
  readonly fromLines: number
  /** ما يقوله **الرولّ-أب** المخزَّن. */
  readonly fromRollup: number
}

/**
 * رميةُ التفاوت — **صنفٌ مستقلّ** كي يُميَّز في التشغيل الدوريّ عن أي عطبٍ آخر،
 * فيُرفَع إنذارُ «تفاوت الرصيد المسبق عن إعادة البناء» (ADR §٧-٣) بلا لبس.
 */
export class FundRollupMismatchError extends Error {
  constructor(
    readonly where: string,
    readonly mismatches: readonly RollupMismatch[],
  ) {
    super(
      `تفاوتُ الرولّ-أب (${where}) — الرولّ-أب لا يساوي مجموعَ الأسطر، والنظامُ يتوقّف ولا يُصحّح نفسَه:\n` +
        mismatches
          .map(
            (m) =>
              `   • ${m.unitPath} · ${m.fundId} · ${m.currency}: الأسطر ${m.fromLines} · ` +
              `الرولّ-أب ${m.fromRollup} (فارقٌ ${m.fromRollup - m.fromLines})`,
          )
          .join("\n"),
    )
    this.name = "FundRollupMismatchError"
  }
}

/** فاصلُ المفتاح — محرفٌ لا يظهر في مسارٍ ولا معرّفٍ ولا رمز عملة (نظيرُ `naturalKey`). */
const KEY_SEPARATOR = "\u0000"

/**
 * مفتاحُ الصفّ — **يُبنى بدالّةٍ واحدة** يستعملها كلُّ من يقارن (الذاكرةُ والقاعدة).
 * فاصلان مختلفان في موضعين يُنتجان تفاوتاً وهمياً يُتَّهم به الرولّ-أب وهو بريء.
 */
export function rollupKeyOf(unitPath: string, fundId: string, currency: string): string {
  return [unitPath, fundId, currency].join(KEY_SEPARATOR)
}

function keyOf(row: { unitPath: string; fundId: string; currency: string }): string {
  return rollupKeyOf(row.unitPath, row.fundId, row.currency)
}

/**
 * يقارن مجموعَين بمفتاحٍ واحد ويعيد التفاوتات — **الاتجاهان معاً**: صفٌّ زائدٌ في الرولّ-أب
 * (رقمٌ لا يقابله سطر) خطرٌ كخطر صفٍّ ناقص، بل أخطر: يُجيز صرفاً لا يجوز شرعاً (ق-٥٥).
 */
export function compareRollups(
  fromLines: ReadonlyMap<string, number>,
  fromRollup: ReadonlyMap<string, number>,
): readonly RollupMismatch[] {
  const mismatches: RollupMismatch[] = []
  for (const key of new Set([...fromLines.keys(), ...fromRollup.keys()])) {
    const lines = fromLines.get(key) ?? 0
    const rollup = fromRollup.get(key) ?? 0
    if (lines === rollup) continue
    const [unitPath, fundId, currency] = key.split(KEY_SEPARATOR)
    mismatches.push({
      unitPath: unitPath!,
      fundId: fundId!,
      currency: currency!,
      fromLines: lines,
      fromRollup: rollup,
    })
  }
  return mismatches.sort((a, b) => keyOf(a).localeCompare(keyOf(b)))
}

/** إعادةُ بناء الرصيد **من الأسطر** — مرجعُ الحقيقة، ولا يُكتب إلى أي مكان. */
export function rebuildFromLines(store: LedgerStore): ReadonlyMap<string, number> {
  const totals = new Map<string, number>()
  for (const line of store.lines()) {
    if (line.fundId === null) continue
    if (store.getAccount(line.accountId)?.kind !== "asset") continue
    const key = keyOf({ unitPath: line.unitPath, fundId: line.fundId, currency: line.currency })
    totals.set(key, (totals.get(key) ?? 0) + line.debit - line.credit)
  }
  return totals
}

function asMap(rows: readonly FundRollupRow[]): ReadonlyMap<string, number> {
  return new Map(rows.map((row) => [keyOf(row), row.balance as number]))
}

/**
 * **المطابقةُ في الذاكرة** — الرولّ-أب مقابل الأسطر في المستودع نفسِه.
 * تُستدعى بعد كل خطوةٍ في الاختبارات؛ وتُرمى ولا تُصلح.
 */
export function reconcileFundRollup(store: LedgerStore): void {
  const mismatches = compareRollups(rebuildFromLines(store), asMap(store.fundRollupRows()))
  if (mismatches.length > 0) throw new FundRollupMismatchError("في الذاكرة", mismatches)
}

/**
 * **المطابقةُ عند التحميل** — ما **أضافته** إعادةُ تشغيل الأسطر المحمَّلة، مقابل صفوف
 * الرولّ-أب المحمَّلة معها.
 *
 * وهذا موضعُ القيد الأول: التحميلُ **لا يكتب الرقم** بل **يتحقّق منه**. فلو حُمِّل الرقمُ
 * حَملاً لصار للقاعدة مِقبضٌ يكتب الرصيدَ في الذاكرة — ومن يكتب الرقم يزوّره.
 *
 * **ولماذا الفارقُ لا الحصيلة؟** لأن التحميل قد يقع على مستودعٍ **فيه أثرٌ سابق** لم يُقذف
 * بعدُ (نقلُ بيانات v1 يبني المستودعَ ثم يُحمِّل ليؤسّس خطَّ الأساس). فمقارنةُ الحصيلة
 * كانت ستتّهم رولّ-أباً سليماً بفارقٍ صنعه **ما لم يأتِ من القاعدة أصلاً**.
 * والقياسُ الصحيح: **أثرُ التحميل وحدَه** — وهو ما تقابله صفوفُ القاعدة حرفياً.
 */
export function verifyLoadedRollup(
  before: readonly FundRollupRow[],
  after: readonly FundRollupRow[],
  stored: readonly FundRollupRow[],
): void {
  const baseline = asMap(before)
  const loaded = new Map<string, number>()
  for (const [key, value] of asMap(after)) {
    const delta = value - (baseline.get(key) ?? 0)
    if (delta !== 0 || baseline.get(key) === undefined) loaded.set(key, delta)
  }
  const mismatches = compareRollups(loaded, asMap(stored))
  if (mismatches.length > 0) {
    throw new FundRollupMismatchError("عند التحميل من القاعدة", mismatches)
  }
}
