/**
 * **حدُّ الوحدة عند المحرّك** — يُقاس بالمحتوى لا بالوعد (G22، عقدُ الرواتب §١/§٣).
 *
 * **ولماذا يعيش هذا الملفّ في اختبارات المحرّك لا في اختبارات الرواتب؟** لأنه يذكر **مفرداتِ
 * الاعتماد** بالضرورة — لا سبيل لأن تُثبت غيابَ شيءٍ دون أن تسمّيه. وG22 تحرس هذه المفردات
 * خارج مجلد المحرّك (`tests/features/approval/` من مجلده)، فوضعُه هنا **التزامٌ بالبوابة
 * لا التفافٌ عليها**: الحدُّ يُثبَت من الجهة التي تملكه — كما عاش `registered/payroll.ts`
 * و`server/payroll.ts` هنا للسبب نفسِه (`PARALLEL_WORK` §٨).
 *
 * **وهو حارسٌ دائم**: أوّلُ استيرادٍ من مجلد المحرّك في وحدة الرواتب، أو أوّلُ قدرةِ بتٍّ
 * تُستهلَك فيها، أو أوّلُ `submitForApproval` يُنادى منها — **يُسقط هذا الملفّ** قبل البوابة.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const MODULE_DIR = new URL("../../../src/features/payroll/", import.meta.url).pathname

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".ts") ? [full] : []
  })
}

/** يجرّد التعليقاتِ — **فالتوثيقُ لا يُدان**، والمقيسُ الكودُ وحده. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

const SOURCES = walk(MODULE_DIR).map((path) => ({
  rel: path.slice(MODULE_DIR.length),
  code: code(path),
}))

describe("**G22 — صفرُ منطقِ اعتمادٍ في الوحدة** (يُقاس بالمحتوى لا بالوعد)", () => {
  it("**لا استيرادَ واحدٌ من مجلد المحرّك** في كل مصدر الوحدة", () => {
    const offenders = SOURCES.filter((s) => /from "\.\.\/\.\.\/approval\//.test(s.code)).map(
      (s) => s.rel,
    )
    expect(offenders, "الوحدةُ تسأل «أمختومة؟» ولا تعرف مَن ختم").toEqual([])
  })

  it("**ولا قدرةَ بتٍّ تُستهلَك** خارج الشاشات (`payroll.approve` وأخواتُها)", () => {
    const offenders: string[] = []
    for (const source of SOURCES) {
      if (source.rel.startsWith("screens/")) continue
      for (const cap of ["payroll.approve", "report.approve", "approve.breakGlass"]) {
        if (source.code.includes(`"${cap}"`)) offenders.push(`${source.rel} ⟵ ${cap}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("**ولا فعلَ اعتمادٍ يُنفَّذ**: لا `submitForApproval` ولا `approveRequest` ولا نظائرُها", () => {
    const offenders = SOURCES.filter((s) =>
      /submitForApproval|approveRequest|rejectRequest|approverLayer|breakGlass|\bnessa\b/i.test(
        s.code,
      ),
    ).map((s) => s.rel)
    expect(offenders).toEqual([])
  })
})

