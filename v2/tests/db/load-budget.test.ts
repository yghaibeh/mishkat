/**
 * **ميزانيةُ التحميل** — G23 (CR-026 ب · قب-٤٨). القياسُ الذي تشغّله البوابة.
 *
 * الحارسُ يعيش في `UnitOfWork.hydrate`: يقيس ما يملكه كلُّ مصدرٍ **قبل أن يُبنى في
 * الذاكرة**، ويرمي برسالةٍ **تُعلّم** — أيُّ وحدة عملٍ، وكم حمّلت، وما سقفُها، وأيُّ جدولٍ
 * التهم النصيبَ الأكبر. حارسٌ يقول «تجاوزٌ» ولا يقول أين يُكلّف مطاردةً في غير موضعها.
 */

import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { postJournal } from "../../src/features/ledger/services/journal.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import { LoadBudgetExceededError, UnitOfWork } from "../../src/db/unitOfWork.js"
import { persistentOrg } from "../../src/db/repositories/orgRepository.js"
import { persistentLedger } from "../../src/db/repositories/ledgerRepository.js"
import { persistentAudit } from "../../src/db/repositories/auditRepository.js"
import type { Cents } from "../../src/features/ledger/types.js"
import { MAIN, NOW, freshDb, freshStores, seedSession, session, unitOfWorkFor } from "./_harness.js"

const c = (n: number): Cents => n as Cents
const CTX = { now: NOW, actorPersonId: "u-finance", settings: createSettingsResolver([]) }
const REPOSITORIES = join(dirname(fileURLToPath(import.meta.url)), "../../src/db/repositories")

/**
 * يلتقط الرميةَ **ويشترطها**: وعدٌ يفي حيث يجب أن يرمي **عطبٌ لا نجاح** — والالتقاطُ
 * بـ`catch` وحدَه كان يُمرّر ذلك صامتاً ثم يقيس على `undefined`.
 */
async function rejection<T>(promise: Promise<unknown>): Promise<T> {
  try {
    await promise
  } catch (e) {
    return e as T
  }
  throw new Error("توقّعنا رميةً فلم تقع — الحارسُ صامتٌ حيث يجب أن يتكلّم")
}

function donation(sourceId: string): Parameters<typeof postJournal>[2] {
  return {
    at: NOW,
    unitId: "m1",
    memoAr: "تبرعٌ نقديّ",
    sourceType: "donation" as const,
    sourceId,
    lines: [
      {
        accountId: "cash",
        unitId: "m1",
        currency: "USD",
        side: "debit" as const,
        amount: c(100),
        fundId: "general",
      },
      {
        accountId: "revenue.donations",
        unitId: "m1",
        currency: "USD",
        side: "credit" as const,
        amount: c(100),
        fundId: "general",
      },
    ],
  }
}

describe("كلُّ وحدة عملٍ تُعلن سقفَ صفوفها — والقائمةُ مشتقّة", () => {
  it("لا مستودعَ بلا سقف — والقائمةُ من **المجلد** لا من سردٍ في الاختبار", () => {
    const factories: string[] = []
    for (const file of readdirSync(REPOSITORIES).filter((f) => f.endsWith(".ts"))) {
      const source = readFileSync(join(REPOSITORIES, file), "utf8")
      for (const match of source.matchAll(/export function (persistent\w+)\s*\(/g)) {
        const body = source.slice(match.index!)
        factories.push(`${match[1]}:${/\n\s*rowBudget:\s*\w/.test(body)}`)
      }
    }
    expect(factories.length).toBeGreaterThan(0)
    expect(factories.filter((f) => f.endsWith(":false"))).toEqual([])
  })

  it("والسقوفُ موجبةٌ فعلاً — سقفٌ صفريٌّ يُعطّل النظام ولا يحرسه", async () => {
    const driver = await freshDb()
    const { org, ledger, audit } = freshStores(MAIN)
    const budgets = [persistentOrg(org), persistentLedger(ledger), persistentAudit(audit)].map(
      (store) => `${store.name}:${store.rowBudget > 0}`,
    )
    expect(budgets).toEqual(["org:true", "ledger:true", "audit:true"])
    driver.close()
  })
})

describe("الحارسُ يقيس ويرمي — والرسالةُ تُعلّم", () => {
  it("وحدةُ عملٍ تتجاوز سقفَها ⟵ رميةٌ **تُسمّيها** وتقول كم حمّلت وما سقفُها", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      for (const n of [1, 2, 3]) expect(postJournal(ledger, CTX, donation(`d-${n}`)).ok).toBe(true)
    })

    const { org, ledger, audit } = freshStores(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(persistentOrg(org))
    // سقفٌ ضيّقٌ عمداً: نحن نقيس **الحارس** لا الشبكة.
    uow.enlist({ ...persistentLedger(ledger), rowBudget: 3 })
    uow.enlist(persistentAudit(audit))

    await expect(uow.hydrate()).rejects.toThrow(LoadBudgetExceededError)
    const error = await rejection<LoadBudgetExceededError>(uow.hydrate())
    expect(error.source).toBe("ledger")
    expect(error.loaded).toBeGreaterThan(3)
    expect(error.budget).toBe(3)
    // الرسالةُ **تُسمّي**: الوحدةَ والعددَ والسقفَ والجدولَ الأكبر — لا «تجاوزٌ».
    expect(error.message).toContain("وحدةُ عمل «ledger»")
    expect(error.message).toContain(`حمّلت ${error.loaded} صفّاً وسقفُها 3`)
    expect(error.message).toContain("journal_lines=")
    driver.close()
  })

  it("والرسالةُ تحمل **الزناد** — فلا يبقى قب-٤٨ شفوياً في رأس أحد", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    const { org, ledger, audit } = freshStores(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist({ ...persistentOrg(org), rowBudget: 1 })
    uow.enlist(persistentLedger(ledger))
    uow.enlist(persistentAudit(audit))
    const error = await rejection<Error>(uow.hydrate())
    expect(error.message).toContain("CR-026")
    driver.close()
  })

  it("والقياسُ **قبل البناء**: المصدرُ المتجاوز لا يُحمَّل أصلاً — لا نصفَ حالةٍ في الذاكرة", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    let loaded = false
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist({
      name: "مصدرٌ ضيّقُ الميزانية",
      rowBudget: 1,
      tables: ["org_units"],
      project: () => new Map(),
      load: () => {
        loaded = true
      },
    })
    await expect(uow.hydrate()).rejects.toThrow(LoadBudgetExceededError)
    expect(loaded).toBe(false)
    driver.close()
  })
})

describe("والسقفُ يُقاس على الواقع في كل جلسة — لا على نيّةٍ حسنة", () => {
  it("عالمُ المرجع يُحمَّل **دون سقوفه** — والحارسُ صامتٌ حين لا موجبَ للكلام", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      for (const n of [1, 2, 3, 4, 5]) expect(postJournal(ledger, CTX, donation(`d-${n}`)).ok).toBe(true)
    })
    const stores = freshStores(MAIN)
    const uow = unitOfWorkFor(driver, stores, { tenantId: MAIN, scopePath: "/" })
    await expect(uow.hydrate()).resolves.toBeUndefined()
    driver.close()
  })

  it("وتضييقُ النطاق **يُنقص المحمول فعلاً** — فالعلاجُ الأول مقيسٌ لا مُدّعى", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      for (const n of [1, 2, 3]) expect(postJournal(ledger, CTX, donation(`d-${n}`)).ok).toBe(true)
    })

    const measure = async (scopePath: string): Promise<number> => {
      const { org, ledger, audit } = freshStores(MAIN)
      const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath })
      uow.enlist(persistentOrg(org))
      uow.enlist(persistentLedger(ledger))
      uow.enlist(persistentAudit(audit))
      // سقفٌ = ١ يجعل الحارسَ يُبلّغ العددَ المحمول بالضبط بدل أن نُخمّنه.
      const narrow = new UnitOfWork(driver, { tenantId: MAIN, scopePath })
      narrow.enlist({ ...persistentLedger(freshStores(MAIN).ledger), rowBudget: 1 })
      await uow.hydrate()
      return (await rejection<LoadBudgetExceededError>(narrow.hydrate())).loaded
    }

    // المسجدُ الثاني بلا قيود: نطاقُه يُحمِّل المراجعَ وحدَها، والأولُ يحمّل قيودَه معها.
    expect(await measure("/men/r1/m2/")).toBeLessThan(await measure("/men/r1/m1/"))
    driver.close()
  })
})
