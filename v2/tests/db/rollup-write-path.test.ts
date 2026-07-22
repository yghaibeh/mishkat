/**
 * **مسارُ كتابةٍ واحد** — القيدُ الأول من قيود الرولّ-أب الثلاثة (README «الرولّ-أب»).
 *
 * *«مَن يستطيع كتابةَ الرقم يستطيع تزويرَه.»* فالمطلوب ليس أن نمنع التزوير بانضباطٍ بشريّ،
 * بل أن **لا يوجد مِقبضٌ يكتب الرقم أصلاً** إلا كتابةُ السطر نفسِه. وهذا **قياسٌ بنيويّ**
 * على المصدر — لا يقيس سلوكاً يمكن أن يتغيّر، بل يقيس **غيابَ الباب**.
 *
 * وهو نظيرُ ما تفعله البوابات: قاعدةٌ بلا حارسٍ آليّ تُخالَف يوماً (المادة ٠). والفرقُ أن
 * هذا الحارس **اختبارٌ في الطقم** لأن الثابتَ داخليٌّ في وحدةِ ميزةٍ لا في حدودِ المستودع.
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { readdirSync, statSync } from "node:fs"

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../../src")
const STORE = join(SRC, "features/ledger/data/store.ts")

/** حقلُ الرولّ-أب — اسمُه مقصودٌ ومقاسٌ عليه؛ تغييرُه يُسقط هذا الحارس فيُنتبه له. */
const FIELD = "fundRollup"
/** **السطحُ المعلن الوحيد** الذي يخرج منه الرقم إلى أي مستهلك. */
const READER = "fundRollupRows()"

function read(file: string): string {
  return readFileSync(file, "utf8")
}

/** يزيل التعليقات فلا يُحسب مثالٌ توثيقيٌّ كتابةً (نظيرُ `stripCommentsOnly` في البوابات). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1")
}

/** كلُّ ملفات `src` — مشتقّةٌ من الشجرة لا مسرودة (CR-011: بوابةٌ تُسرد لها الحقيقة تتخلّف). */
function allSources(dir: string = SRC): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...allSources(full))
    else if (full.endsWith(".ts")) out.push(full)
  }
  return out
}

/**
 * يقسّم جسمَ الصنف إلى دوالَّه بأسمائها — فيُنسب كلُّ سطرٍ إلى الدالّة التي يسكنها،
 * ويصير السؤالُ «أيُّ دالّةٍ تكتب الرقم؟» قابلاً للقياس لا للتخمين.
 */
function methodsOf(source: string, className: string): Map<string, string> {
  const start = source.indexOf(`class ${className}`)
  expect(start).toBeGreaterThan(-1)
  const body = source.slice(start)
  // إزاحةُ سطرين = دالّةُ الصنف (لا كتلةٌ داخلها) — `{2}` لا مسافتان: الفراغُ لا يُعدّ بالعين.
  const header = /\n {2}(?:private |public |protected )?(?:readonly )?([A-Za-z_]\w*)\s*(?:<[^>]*>)?\(/g
  const found: { name: string; at: number }[] = []
  for (const match of body.matchAll(header)) {
    if (match[1] === "constructor") continue
    found.push({ name: match[1]!, at: match.index! })
  }
  const methods = new Map<string, string>()
  for (const [i, entry] of found.entries()) {
    const end = i + 1 < found.length ? found[i + 1]!.at : body.length
    methods.set(entry.name, body.slice(entry.at, end))
  }
  return methods
}

describe("مسارُ كتابةٍ واحد للرولّ-أب — لا مِقبضَ يكتب الرقم", () => {
  const source = stripComments(read(STORE))
  const methods = methodsOf(source, "LedgerStore")

  it("**كتابةُ السطر وحدَها** تُغيّر الرولّ-أب — لا دالّةَ تُحدّثه على حدة", () => {
    const mutators = [...methods]
      .filter(([, body]) => new RegExp(`this\\.${FIELD}[\\s\\S]{0,80}?\\.set\\(`).test(body))
      .map(([name]) => name)
    expect(mutators).toEqual(["appendLine"])
  })

  it("ولا دالّةَ تُسنِد الحقلَ كلَّه إلا **استرجاعُ اللقطة** (حاملُ الذرّية لا مِقبضُ كتابة)", () => {
    const assigners = [...methods]
      .filter(([, body]) => new RegExp(`this\\.${FIELD}\\s*=`).test(body))
      .map(([name]) => name)
    expect(assigners).toEqual(["restore"])
  })

  it("ولا مُستدعٍ يمرّر رقماً: لا دالّةَ عامّةٍ تأخذ رصيداً — القراءةُ فقط مكشوفة", () => {
    const publicSurface = [...methods].filter(([name]) => !/^(snapshot|restore)$/.test(name))
    const takesBalance = publicSurface
      .filter(([, body]) => /\(([^)]*)\)/.exec(body)?.[1]?.match(/balance|rollup/i))
      .map(([name]) => name)
    expect(takesBalance).toEqual([])
  })

  it("والحقلُ لا يُذكر خارج مستودعه إلا **قراءةً معلنة** — لا مِقبضَ ثانٍ في الشجرة كلِّها", () => {
    const elsewhere = allSources()
      .filter((file) => file !== STORE)
      .filter((file) => stripComments(read(file)).includes(FIELD))
      .map((file) => relative(SRC, file))
    // القائمةُ **مشتقّةٌ من الشجرة** لا مسرودة: ملفٌّ جديدٌ يلمس الرولّ-أب يدخل الفحصَ تلقائياً.
    expect(elsewhere.length).toBeGreaterThan(0)
    for (const file of elsewhere) {
      const code = stripComments(read(join(SRC, file)))
      // كلُّ ذِكرٍ للحقل خارج مستودعه هو **نداءُ القراءة المعلن** ولا شيء سواه.
      const mentions = [...code.matchAll(new RegExp(FIELD, "g"))].length
      const reads = [...code.matchAll(new RegExp(READER.replace("()", "\\(\\)"), "g"))].length
      expect(`${file}: ${mentions}=${reads}`).toBe(`${file}: ${reads}=${reads}`)
      expect(`${file}: ${new RegExp(`${FIELD}\\s*=|${FIELD}\\.set`).test(code)}`).toBe(
        `${file}: false`,
      )
    }
  })

  it("والمطابقةُ **لا تُصلح**: لا `UPDATE` ولا `INSERT` على جدول الرولّ-أب في المطابق", () => {
    const code = stripComments(read(join(SRC, "db/reconcile.ts")))
    expect(/UPDATE|INSERT|DELETE/.test(code)).toBe(false)
    expect(code.includes("SELECT")).toBe(true)
  })

  it("وطبقةُ الاستمرار **تنقل الرقم ولا تصنعه**: لا حسابَ بين القراءة والصفّ", () => {
    const repository = stripComments(read(join(SRC, "db/repositories/ledgerRepository.ts")))
    const from = repository.indexOf(`store.${READER}`)
    expect(from).toBeGreaterThan(-1)
    // من القراءة المعلنة إلى وسم الجدول: نقلٌ حرفيٌّ للحقول، بلا جمعٍ ولا تجميع.
    const block = repository.slice(from, repository.indexOf(`"fund_balances"`, from))
    expect(block.includes("balance: row.balance")).toBe(true)
    expect(/[+\-*/]|reduce|SUM/.test(block)).toBe(false)
  })
})
