/**
 * ق-٤٢ — **مسارُ النساء مخطّطٌ مستقلٌّ بنفس الهدف، والعزلُ بالنطاق لا بفرعٍ جنسانيٍّ في الكود.**
 *
 * في v1 كان الاختيارُ يُشتقّ من «جنس الوحدة»؛ وفي v2 **لا يعرف الكودُ جنساً أصلاً**: المخطّطُ
 * كيانُ بياناتٍ له نطاق، ويُختار بأعمق نطاقٍ يحتوي الوحدة — فيكون مسارُ النساء **حالةً من
 * القاعدة العامة** لا استثناءً مفصَّلاً لها. ولذلك: إضافةُ قسمٍ ثالثٍ بمخطّطه **بياناً** تعمل
 * بلا سطرِ كود، وهو ما يثبته آخرُ اختبارٍ هنا.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { schemeForUnit } from "../../../src/features/dailyLog/services/catalog.js"
import { recordDailyEntry } from "../../../src/features/dailyLog/services/entries.js"
import { periodPoints, targetForSpan } from "../../../src/features/dailyLog/services/totals.js"
import {
  KHALID,
  KHALID_PATH,
  NOUR,
  NOUR_PATH,
  NOW,
  WEEK,
  dailyLogContext,
  seedDailyLogStore,
} from "./_seed.js"

const JULY = { fromDayKey: "2026-07-01", toDayKey: "2026-07-31" }
const MODULE_DIR = join(process.cwd(), "src/features/dailyLog")

/**
 * القياسُ على **الكود** بعد تجريد التعليقات (نظيرُ G6/G22): التوثيقُ الذي يشرح القاعدة
 * لا يُدان بها — المُدان هو **فرعٌ يُنفَّذ**، لا شرحٌ يُقرأ.
 */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) ?? []).length))
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

function sourcesOf(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...sourcesOf(full))
    else if (name.endsWith(".ts")) out.push(full)
  }
  return out
}

describe("ق-٤٢ — مسارٌ مستقلٌّ بمخطّطه، وهدفٌ واحدٌ للمسارين", () => {
  it("**المسجدُ النسائيُّ يُنقَّط بمخطّطه هو، والرجاليُّ بمخطّطه** — بلا سطرٍ يذكر جنساً", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-admin")

    const women = recordDailyEntry(store, ctx, {
      clientUuid: "w-1",
      unitId: NOUR,
      activityId: "dawah",
      count: 3,
      date: NOW,
    })
    const men = recordDailyEntry(store, ctx, {
      clientUuid: "m-1",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
    })

    expect(women.ok && women.value.points).toBe(6)
    expect(men.ok && men.value.points).toBe(5)
    expect(periodPoints(store, NOUR_PATH, WEEK)).toBe(6)
    expect(periodPoints(store, KHALID_PATH, WEEK)).toBe(5)
  })

  it("**والهدفُ نفسُه للمسارين** (ق-٤٢ نصاً: «مع الإبقاء على هدف الـ٧٠»)", () => {
    const ctx = dailyLogContext("u-admin")
    expect(targetForSpan(ctx, NOUR_PATH, JULY)).toBe(targetForSpan(ctx, KHALID_PATH, JULY))
  })

  it("**والعزلُ بالنطاق**: نشاطُ المخطّط الآخر مجهولٌ في هذا النطاق ولو كان معرّفُه معروفاً", () => {
    const store = seedDailyLogStore()
    const ctx = dailyLogContext("u-admin")
    const crossDown = recordDailyEntry(store, ctx, {
      clientUuid: "x-1",
      unitId: NOUR,
      activityId: "lesson",
      count: 1,
      date: NOW,
    })
    expect(!crossDown.ok && crossDown.error.code).toBe("UNKNOWN_ACTIVITY")
  })

  it("**وقسمٌ ثالثٌ بمخطّطه يعمل بياناً** — المسارُ النسائيُّ حالةٌ من القاعدة لا استثناء", () => {
    const store = seedDailyLogStore()
    store.saveUnit({ tenantId: store.tenantId, id: "guests", path: "/guests/" })
    store.saveUnit({ tenantId: store.tenantId, id: "g1", path: "/guests/g1/" })
    store.saveScheme({
      tenantId: store.tenantId,
      id: "scheme-guests",
      ar: "مخطّطُ قسمٍ ثالث",
      scopePath: "/guests/",
      active: true,
    })
    store.saveActivity({
      tenantId: store.tenantId,
      id: "g-a1",
      schemeId: "scheme-guests",
      activityId: "visit",
      ar: "زيارةٌ دعوية",
      weight: 7,
      maxPerDay: null,
      requiresParticipation: false,
      active: true,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
    })

    expect(schemeForUnit(store, "/guests/g1/")?.id).toBe("scheme-guests")
    const r = recordDailyEntry(store, dailyLogContext("u-admin"), {
      clientUuid: "g-1",
      unitId: "g1",
      activityId: "visit",
      count: 1,
      date: NOW,
    })
    expect(r.ok && r.value.points).toBe(7)
  })
})

describe("ق-٤٢ — الحارسُ البنيويّ: صفرُ فرعٍ جنسانيٍّ في مصدر الوحدة", () => {
  it("**لا مفردةَ جنسٍ ولا مسارَ قسمٍ مُصلَّبٍ في أيّ ملفٍّ من الوحدة**", () => {
    const forbidden = [
      /\bgender\b/i,
      /\bfemale\b/i,
      /\bmale\b/i,
      /\bwomen\b/i,
      /\bmen\b/i,
      /نساء|نسائي|رجالي/,
      /"\/women\/"|"\/men\/"/,
    ]
    const hits: string[] = []
    for (const file of sourcesOf(MODULE_DIR)) {
      const source = codeOnly(readFileSync(file, "utf8"))
      source.split("\n").forEach((line, i) => {
        for (const re of forbidden) {
          if (re.test(line)) hits.push(`${file}:${i + 1} — ${line.trim()}`)
        }
      })
    }
    expect(hits, `فرعٌ جنسانيٌّ في الكود: ${hits.join(" · ")}`).toEqual([])
  })
})
