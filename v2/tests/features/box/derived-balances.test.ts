/**
 * ق-٦٠ — **الرصيدُ مشتقٌّ من الدفتر: صفر حقلِ رصيدٍ مخزَّن**.
 *
 * الاختبارُ الأول من العشرة الإلزامية، وله **حارسان**: سلوكيٌّ (قيدٌ في النواة ينعكس فوراً
 * في كل عروض الصندوق) و**محتوائيٌّ** (مسحُ مصدرِ الوحدة: لا حقلَ مالٍ مخزَّنٍ في كيانٍ ولا
 * مستودع) — فالادّعاءُ يُقاس لا يُوعَد به.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"
import { BoxStore } from "../../../src/features/box/data/store.js"
import {
  boxFlow,
  boxMovements,
  childBoxSummaries,
  ownBoxBalances,
  subtreeBoxBalances,
} from "../../../src/features/box/services/boxBalances.js"
import { unitBoxView } from "../../../src/features/box/services/boxViews.js"
import { receiveIntoBox, spendFromBox } from "../../../src/features/box/services/operations.js"
import { postJournal } from "../../../src/features/ledger/services/journal.js"
import { boxContext, c, seedBoxStores } from "./_seed.js"

const KHALID = "khalid"
const KHALID_PATH = "/men/homs/sq2/khalid/"
const SQ2_PATH = "/men/homs/sq2/"
const CTX = () => boxContext("u-amir")

describe("ق-٦٠/١ — قيدٌ في النواة ينعكس **فوراً** في كل عروض الصندوق", () => {
  it("قيدٌ يُرحَّل من النواة مباشرةً (لا من خدمة الصندوق) ⇒ تراه كلُّ العروض", () => {
    const stores = seedBoxStores()
    const before = ownBoxBalances(stores.ledger, KHALID_PATH).get("USD")?.net ?? 0
    expect(before).toBe(0)

    // **الكتابةُ من النواة والقراءةُ من الصندوق**: لو كان ثمّة دفترٌ موازٍ لَما ظهر شيء.
    const posted = postJournal(stores.ledger, CTX(), {
      at: CTX().now,
      unitId: KHALID,
      memoAr: "قيدٌ مباشرٌ في النواة",
      sourceType: "manualJournal",
      sourceId: "je-direct",
      lines: [
        { accountId: "cash", unitId: KHALID, currency: "USD", side: "debit", amount: c(4_200) },
        {
          accountId: "revenue.donations",
          unitId: KHALID,
          currency: "USD",
          side: "credit",
          amount: c(4_200),
        },
      ],
    })
    expect(posted.ok).toBe(true)

    expect(ownBoxBalances(stores.ledger, KHALID_PATH).get("USD")?.net).toBe(4_200)
    expect(subtreeBoxBalances(stores.ledger, SQ2_PATH).get("USD")?.net).toBe(4_200)
    expect(boxFlow(stores.ledger, KHALID_PATH, "own").get("USD")?.incoming).toBe(4_200)
    expect(boxMovements(stores.ledger, KHALID_PATH)).toHaveLength(1)
    expect(
      childBoxSummaries(stores.ledger, SQ2_PATH).find((c2) => c2.unitId === KHALID)?.balances.get("USD")
        ?.net,
    ).toBe(4_200)
    expect(unitBoxView(stores, KHALID_PATH).own.get("USD")?.net).toBe(4_200)
  })

  it("والصرفُ ينعكس في **الصناديق الثلاثة** بنفس اللحظة (وارد · صادر · رصيد)", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "rcv-1",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(10_000) }],
    })
    spendFromBox(stores, CTX(), {
      unitId: KHALID,
      operationId: "spd-1",
      memoAr: "صرفتُ",
      categoryId: "fuel",
      currency: "USD",
      amount: c(3_000),
    })
    const flow = boxFlow(stores.ledger, KHALID_PATH, "own").get("USD")
    expect(flow).toEqual({ incoming: 10_000, outgoing: 3_000, net: 7_000 })
  })
})

describe("ق-٦٠/٢ — **صفر حقلِ رصيدٍ مخزَّن**: يُقاس بالمحتوى لا بالوعد", () => {
  const MODULE_ROOT = join(process.cwd(), "src/features/box")

  function walk(dir: string): readonly string[] {
    const out: string[] = []
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) out.push(...walk(path))
      else if (path.endsWith(".ts")) out.push(path)
    }
    return out
  }

  /** يُزال التعليقُ كي لا يُحسب شرحٌ مخالفةً؛ والقياسُ على الكود وحده. */
  function code(path: string): string {
    return readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
  }

  it("لا حقلَ مالٍ مخزَّنٍ في كياناتِ الوحدة ولا في مستودعها (الكيانُ يحمل معرّفَ القيد لا مبلغَه)", () => {
    const STORED = [join(MODULE_ROOT, "types.ts"), ...walk(join(MODULE_ROOT, "data"))]
    const FORBIDDEN = /^\s*(?:readonly\s+)?(\w*(?:balance|total|amount|net|sum)\w*)\s*[?]?\s*:/i
    const offenders: string[] = []
    for (const file of STORED) {
      code(file)
        .split("\n")
        .forEach((line, i) => {
          const m = FORBIDDEN.exec(line)
          if (m) offenders.push(`${file}:${i + 1} — «${m[1]}»`)
        })
    }
    expect(offenders, `حقلُ مالٍ مخزَّنٌ ينقض ق-٦٠: ${offenders.join(" · ")}`).toEqual([])
  })

  it("ولا في مستودع الصندوق دالةُ رصيدٍ أصلاً — لا مِقبضَ يُغري بتخزينه", () => {
    const surface = Object.getOwnPropertyNames(BoxStore.prototype)
    expect(surface.filter((n) => /balance|total|sum/i.test(n))).toEqual([])
  })

  it("وكلُّ دوالّ الأرصدة تقرأ من أسطر الدفتر: مستودعٌ فارغٌ ⇒ صفرٌ صريحٌ لا رقمٌ محفوظ", () => {
    const stores = seedBoxStores()
    expect(ownBoxBalances(stores.ledger, KHALID_PATH).size).toBe(0)
    expect(boxMovements(stores.ledger, SQ2_PATH)).toEqual([])
    // ومع ذلك تظهر الصناديقُ السُّفلية **بصفرها** ولا تختفي (ق-١١٢).
    expect(childBoxSummaries(stores.ledger, SQ2_PATH).map((s) => s.unitId).sort()).toEqual([
      "bilal",
      "khalid",
    ])
  })
})
