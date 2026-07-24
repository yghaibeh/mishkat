/**
 * **حمولةُ «قبل/بعد» إلزاميّةٌ قابلةٌ للفراغ** — CR-028 مُنفَّذةً في T26-ج.
 *
 * العلّةُ مكتوبةٌ فلا تُنسى: `before?` **لا يفرّق** بين *«لا لقطةَ تنطبق هنا»* و*«نسيَها
 * الكاتب»* — وهما حالتان علاجُهما متعاكس. **والمجالُ هنا التدقيق**، الجدولُ الذي المادة ٤/٨
 * تقول عنه «لا يُمحى»: **وقيدٌ ناقصٌ صامتاً أسوأُ من قيدٍ غائبٍ صراحةً — الغائبُ يُبحَث عنه،
 * والناقصُ يُصدَّق.**
 *
 * وثلاثةُ حرّاسٍ هنا، ولا يُغني أحدُها عن الآخر:
 *  · **عقديّ**: `AuditAppend` لا يقبل الإغفال — فنداءٌ بلا تصريحٍ **لا يُترجم** (G1).
 *  · **بنيويّ**: مسحٌ **مشتقٌّ من الشجرة** يُثبت **صفرَ متخلّفٍ** بين المُستدعين.
 *  · **سلوكيّ**: «لا لقطةَ تنطبق» **تُقال بقيمةٍ معلنة** وتعبر القاعدةَ `NULL`اً صريحاً —
 *    ولقطةُ التغيير الحقيقيّ تعبرها **بقيمتين مختلفتين**.
 */

import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { postJournal, reverseEntry } from "../../src/features/ledger/services/journal.js"
import { createSettingsResolver } from "../../src/settings/resolver.js"
import type { Cents } from "../../src/features/ledger/types.js"
import { MAIN, NOW, freshDb, seedSession, session } from "./_harness.js"

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../../src")
const JOURNAL = join(SRC, "audit/journal.ts")

const c = (n: number): Cents => n as Cents
const CTX = { now: NOW, actorPersonId: "u-finance", settings: createSettingsResolver([]) }

function read(file: string): string {
  return readFileSync(file, "utf8")
}

/** يزيل التعليقات فلا يُحسب مثالٌ توثيقيٌّ نداءً (نظيرُ `stripCommentsOnly` في البوابات). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1")
}

/** كلُّ ملفات `src` — **مشتقّةٌ من الشجرة لا مسرودة** (CR-011: قائمةٌ تُسرد تتخلّف حتماً). */
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
 * كلُّ نداءِ إلحاقٍ بالسجلّ في الشجرة، **بجسمه**: يُقتطع بعدّ الأقواس لا بتعبيرٍ نمطيٍّ
 * يقف عند أول `}` — فحقلٌ داخل كائنٍ متداخلٍ لا يخدع العدّ.
 */
function appendCalls(): { at: string; body: string }[] {
  const calls: { at: string; body: string }[] = []
  for (const file of allSources()) {
    if (file === JOURNAL) continue
    const code = stripComments(read(file))
    const marker = /audit\.append\(\{/g
    for (const match of code.matchAll(marker)) {
      const open = match.index! + match[0].length - 1
      let depth = 0
      let end = open
      for (let i = open; i < code.length; i += 1) {
        if (code[i] === "{") depth += 1
        else if (code[i] === "}") {
          depth -= 1
          if (depth === 0) {
            end = i
            break
          }
        }
      }
      const line = code.slice(0, open).split("\n").length
      calls.push({ at: `${relative(SRC, file)}:${line}`, body: code.slice(open, end + 1) })
    }
  }
  return calls
}

// ═══ الحارسُ العقديّ — الإلزامُ في النوع نفسِه ═══════════════════════════════════

describe("العقد — «قبل/بعد» إلزاميّان قابلان للفراغ (CR-028)", () => {
  it("`AuditAppend` **يضمّ** `AuditPayload` ولا يجعله `Partial` — فالإغفالُ لا يُترجم", () => {
    const code = stripComments(read(JOURNAL))
    expect(code).toContain("export type AuditAppend = AuditPayload & {")
    // **والرجوعُ إلى الاختياريّ يحمرّ هنا** — وهو بعينه ما جاءت له CR-028.
    expect(code).not.toContain("Partial<AuditPayload>")
  })

  it("ولا حقلَ منهما اختياريٌّ في `AuditPayload` — `before?` هو العطبُ الذي عولج", () => {
    const code = stripComments(read(JOURNAL))
    const body = code.slice(code.indexOf("export type AuditPayload = {"))
    const declaration = body.slice(0, body.indexOf("\n}"))
    expect(declaration).toContain("readonly before: string | null")
    expect(declaration).toContain("readonly after: string | null")
    expect(/readonly (before|after)\?/.test(declaration)).toBe(false)
  })

  it("**ولا تطبيعَ يُخفي إغفالاً** بعد الإلزام: لا `?? null` على الحمولة عند الإلحاق", () => {
    const code = stripComments(read(JOURNAL))
    expect(/(before|after):\s*entry\.(before|after)\s*\?\?/.test(code)).toBe(false)
  })
})

// ═══ الحارسُ البنيويّ — صفرُ متخلّفٍ بين المُستدعين (مشتقٌّ لا مسرود) ═══════════════

describe("المُستدعون — كلُّهم صرّح، والقائمةُ تُشتقّ من الشجرة", () => {
  const calls = appendCalls()

  it("**والمسحُ يرى المُستدعين فعلاً** — حارسٌ لا يقرأ شيئاً ليس حارساً (فخّ ٦-ب)", () => {
    // **أرضيّةٌ لا سقف**: مُستدعٍ جديدٌ لا يُحمّر الحارس، وفراغُ المسح يُحمّره — وهو عطبُه.
    expect(calls.length).toBeGreaterThanOrEqual(18)
  })

  it("**صفرُ متخلّف**: كلُّ نداءٍ يُصرّح بالحقلين — لا إغفالَ ولا حذفَ حقل", () => {
    const silent = calls
      .filter((call) => !/\bbefore:/.test(call.body) || !/\bafter:/.test(call.body))
      .map((call) => call.at)
    expect(silent).toEqual([])
  })

  it("و**الفراغُ المزدوجُ استثناءٌ مُعلَنٌ لا عادة**: موضعٌ واحدٌ في الشجرة يقولهما `null` معاً", () => {
    const bothNull = calls
      .filter((call) => /\bbefore:\s*null\s*,/.test(call.body) && /\bafter:\s*null\s*,/.test(call.body))
      .map((call) => call.at.split(":")[0]!)
    // `ledger.post.failed` وحدَه: هدفُه **مفتاحُ ترحيلٍ لا كيان**، والترحيلُ لم يقع أصلاً —
    // وهو نفسُ الموضع المُستثنى في `AUDIT_ACTIONS_WITHOUT_SCOPE`. **الاستثناءُ المُعلَنُ ليس ثغرة.**
    expect(bothNull).toEqual(["features/ledger/services/posting.ts"])
  })
})

// ═══ الحارسُ السلوكيّ — الفراغُ يُقال، والتغييرُ يُقال، وكلاهما يعبر القاعدة ═════════

describe("السلوك على القاعدة — «لا لقطةَ تنطبق» تُقال ولا يُسكَت عنها", () => {
  function donation(sourceId: string): Parameters<typeof postJournal>[2] {
    return {
      at: NOW,
      unitId: "m1",
      memoAr: "تبرعٌ نقديّ",
      sourceType: "donation" as const,
      sourceId,
      lines: [
        { accountId: "cash", unitId: "m1", currency: "USD", side: "debit" as const, amount: c(10_000) },
        {
          accountId: "revenue.donations",
          unitId: "m1",
          currency: "USD",
          side: "credit" as const,
          amount: c(10_000),
        },
      ],
    }
  }

  it("**إنشاءٌ**: `before` يعبر القاعدةَ `NULL`اً صريحاً و`after` يحمل لقطةً — لا عمودٌ غائب", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    await session(driver, MAIN, ({ ledger }) => {
      expect(postJournal(ledger, CTX, donation("d-1")).ok).toBe(true)
    })

    const rows = (await driver.all({
      sql: `SELECT action, "before", "after" FROM audit_log ORDER BY seq`,
      params: [],
    })) as readonly Record<string, unknown>[]
    const posted = rows.find((r) => r["action"] === "ledger.post")!
    // **الفرقُ الذي جاءت له CR-028**: العمودُ موجودٌ وقيمتُه `NULL` **معلنة** — لا حقلٌ محذوف.
    expect("before" in posted).toBe(true)
    expect(posted["before"]).toBeNull()
    expect(String(posted["after"])).toContain("posted")
    driver.close()
  })

  it("**وانتقالُ حال**: العكسُ يكتب لقطتين **مختلفتين** — «من كان يحوزها لا يضيع» (ق-٨٣)", async () => {
    const driver = await freshDb()
    await seedSession(driver, MAIN)
    const entryId = await session(driver, MAIN, ({ ledger }) => {
      const posted = postJournal(ledger, CTX, donation("d-2"))
      if (!posted.ok) throw new Error("تعذّر الترحيل")
      return posted.value.id
    })
    await session(driver, MAIN, ({ ledger }) => {
      expect(reverseEntry(ledger, CTX, entryId, "تصحيحٌ").ok).toBe(true)
    })

    const rows = (await driver.all({
      sql: `SELECT "before", "after" FROM audit_log WHERE action = ? ORDER BY seq`,
      params: ["ledger.reverse"],
    })) as readonly Record<string, unknown>[]
    expect(rows).toHaveLength(1)
    const [before, after] = [String(rows[0]!["before"]), String(rows[0]!["after"])]
    expect(before).toContain("posted")
    expect(after).toContain("reversedBy:")
    // **لقطتان لا واحدة**: لو تساوتا لَما دلّ القيدُ على انتقالٍ أصلاً.
    expect(before === after).toBe(false)
    driver.close()
  })
})
