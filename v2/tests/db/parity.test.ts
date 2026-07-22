/**
 * **تطابقُ البديلين** (الاختبار الإلزاميّ ٦): السيناريو نفسُه يمرّ على المستودع في الذاكرة
 * وعلى D1 **بنفس النتائج** — فالخدمةُ لا تعلم بمن تتكلّم.
 *
 * وهذا أقوى برهانٍ على أن العزل حقيقيّ: **الخدماتُ لا تُستورَد مرتين ولا تُفرَّع بشرط**؛
 * السيناريو دالّةٌ واحدة، والمُشغِّلُ وحده يختلف.
 */

import { describe, expect, it } from "vitest"
import { postJournal, reverseEntry, balanceProof } from "../../src/features/ledger/services/journal.js"
import { postEvent, postEventSafely } from "../../src/features/ledger/services/posting.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import type { Cents } from "../../src/features/ledger/types.js"
import { MAIN, NOW, freshDb, seedStores, seedSession, session, type Stores } from "./_harness.js"

const c = (n: number): Cents => n as Cents
const CTX = { now: NOW, actorPersonId: "u-finance", settings: createSettingsResolver([]) }

function donation(sourceId: string, amount: number): Parameters<typeof postJournal>[2] {
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
        amount: c(amount),
        fundId: "general",
      },
      {
        accountId: "revenue.donations",
        unitId: "m1",
        currency: "USD",
        side: "credit" as const,
        amount: c(amount),
      },
    ],
  }
}

/** لقطةُ ما تراه الخدمة — كلُّ ما يخرج من المستودع، لا ما يدخل القاعدة. */
type Observation = {
  readonly entryIds: readonly string[]
  readonly vouchers: readonly string[]
  readonly lineIds: readonly string[]
  readonly balance: string
  readonly fundGeneral: number
  readonly activeKeys: readonly string[]
  readonly auditActions: readonly string[]
  readonly reversedBy: readonly string[]
  readonly unitIds: readonly string[]
}

function observe(stores: Stores): Observation {
  const proof = balanceProof(stores.ledger)
  return {
    entryIds: stores.ledger.entries().map((e) => e.id),
    vouchers: stores.ledger.entries().map((e) => e.voucherNo),
    lineIds: stores.ledger.lines().map((l) => l.id),
    balance: [...proof.byCurrency]
      .map(([cur, t]) => `${cur}:${t.debit}/${t.credit}`)
      .sort()
      .join("،"),
    fundGeneral: stores.ledger.fundBalance("general", "USD"),
    activeKeys: ["donation:d-1", "donation:d-2", "donation:d-3"].map(
      (k) => `${k}=${stores.ledger.activePostingEntryId(k) ?? "لا"}`,
    ),
    auditActions: stores.audit.all().map((a) => a.action),
    reversedBy: stores.ledger.entries().map((e) => `${e.id}⟵${e.reversedBy ?? "لا"}`),
    unitIds: [...stores.org.units.values()].map((u) => u.id).sort(),
  }
}

/** خطواتُ السيناريو — كلُّ خطوةٍ متزامنةٌ بحتة، تُشغَّل حرفياً على البديلين. */
const STEPS: readonly ((stores: Stores) => void)[] = [
  ({ ledger }) => {
    expect(postJournal(ledger, CTX, donation("d-1", 10_000)).ok).toBe(true)
  },
  ({ ledger }) => {
    const posted = postEvent(ledger, CTX, {
      sourceType: "donation",
      sourceId: "d-2",
      at: NOW,
      unitId: "m1",
      memoAr: "تبرعٌ ثانٍ",
      lines: donation("d-2", 2_500).lines,
    })
    expect(posted.ok).toBe(true)
  },
  ({ ledger }) => {
    // تكرارُ الحدث نفسِه **لا يزدوج** (ق-٥٠) — على البديلين سواءً.
    const again = postEvent(ledger, CTX, {
      sourceType: "donation",
      sourceId: "d-2",
      at: NOW,
      unitId: "m1",
      memoAr: "تبرعٌ ثانٍ",
      lines: donation("d-2", 2_500).lines,
    })
    expect(again.ok && again.value.duplicated).toBe(true)
  },
  ({ ledger }) => {
    const first = ledger.entries()[0]!
    expect(reverseEntry(ledger, CTX, first.id, "تصحيحُ مبلغ").ok).toBe(true)
  },
  ({ ledger }) => {
    // فشلٌ لا يُسقط الحدث الأصليّ (§٣.٤) — ويُدوَّن في التدقيق.
    const failed = postEventSafely(ledger, CTX, {
      sourceType: "donation",
      sourceId: "d-3",
      at: NOW,
      unitId: "لا-وجود-لها",
      memoAr: "وحدةٌ مجهولة",
      lines: donation("d-3", 100).lines,
    })
    expect(failed.posted).toBe(false)
  },
  ({ org }) => {
    org.saveUnit({
      tenantId: org.tenantId,
      id: "m3",
      type: "mosque" as never,
      labelAr: "مسجدٌ ثالث",
      parentId: "r1",
      path: "/men/r1/m3/",
      section: "men",
      archived: false,
    })
  },
]

describe("تطابقُ البديلين — المستودع في الذاكرة وعلى D1", () => {
  it("السيناريو نفسُه يعطي النتائج نفسَها على البديلين خطوةً خطوة", async () => {
    const memory = seedStores(MAIN)
    const driver = await freshDb()
    await seedSession(driver, MAIN)

    for (const [index, step] of STEPS.entries()) {
      step(memory)
      const inMemory = observe(memory)
      const onD1 = await session(driver, MAIN, (stores) => {
        step(stores)
        return observe(stores)
      })
      expect(`الخطوة ${index + 1}: ${JSON.stringify(onD1)}`).toBe(
        `الخطوة ${index + 1}: ${JSON.stringify(inMemory)}`,
      )
    }
    driver.close()
  })

  it("الحالةُ الدائمة تُقرأ بعد الجلسة كما تُركت — التحميلُ والإسقاطُ متعاكسان", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    for (const step of STEPS) await session(driver, MAIN, step)

    const first = await session(driver, MAIN, observe)
    const second = await session(driver, MAIN, observe)
    expect(second).toEqual(first)
    driver.close()
  })

  it("قراءةٌ بلا كتابة لا تُنتج عبارةً واحدة — فالتحميلُ لا يُلوّث", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1", 10_000)).ok).toBe(true)
    })
    const before = await driver.all({ sql: "SELECT * FROM journal_lines", params: [] })
    await session(driver, MAIN, ({ ledger }) => ledger.entries().length)
    const after = await driver.all({ sql: "SELECT * FROM journal_lines", params: [] })
    expect(after).toEqual(before)
    driver.close()
  })
})
