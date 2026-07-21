/**
 * ب-١٨ + **ب-٢ مدفونٌ بقرار المالك** — الاجتماعُ **محضرٌ وقرارات فقط**.
 *
 * ب-٢ («نصابُ ٥٠٪+١ وصوتُ الأمير المرجِّح وتسجيلُ حضور كل عضو») **دُفن** في جلسة المالك
 * (قب-٥/دفتر القرارات): «برهانُ الموت: لا يستورد الملفَ أحد… ولا بلاغَ ميدانياً طلب تصويتاً.
 * v2 ينقل الاجتماعات محضراً وقرارات (ب-١٨)». فهذا الملفّ يختبر **الوجودَ والغياب معاً**:
 * المحضرُ والقراراتُ يعملان، و**لا مفردةَ نصابٍ أو تصويتٍ أو حضورٍ في شجرة الوحدة أصلاً**.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import {
  recordMeeting,
  meetingsWithin,
} from "../../../src/features/committees/services/meetings.js"
import {
  BILAL,
  BILAL_PATH,
  HOMS_PATH,
  KHALID,
  KHALID_PATH,
  NOW,
  committeeContext,
  seedCommitteeStore,
} from "./_seed.js"

const HELD_AT = new Date("2026-07-18T00:00:00.000Z")

function record(
  store: ReturnType<typeof seedCommitteeStore>,
  over: Partial<{
    mosqueUnitId: string
    heldAt: Date
    minutesAr: string
    decisionsAr: readonly string[]
  }> = {},
) {
  return recordMeeting(store, committeeContext("u-amir"), {
    mosqueUnitId: KHALID,
    heldAt: HELD_AT,
    minutesAr: "اجتمعت أسرةُ المسجد وتُلي محضرُ الجلسة السابقة",
    decisionsAr: ["تكليفُ لجنة الإغاثة بجولةٍ أسبوعية", "رفعُ تقرير الشهر"],
    ...over,
  })
}

describe("ب-١٨ — الاجتماعُ محضرٌ وقرارات، ولا شيءَ سواهما", () => {
  it("يُسجَّل المحضرُ بقراراته في نطاق مسجده", () => {
    const store = seedCommitteeStore()
    const done = record(store)
    if (!done.ok) throw new Error(done.error.code)
    expect(done.value.mosquePath).toBe(KHALID_PATH)
    expect(done.value.minutesAr.length).toBeGreaterThan(0)
    expect(done.value.decisionsAr).toHaveLength(2)
    expect(done.value.heldAt).toEqual(HELD_AT)
  })

  it("**وكيانُ الاجتماع لا يحمل نصاباً ولا أصواتاً ولا حضوراً** (ب-٢ مدفون)", () => {
    const store = seedCommitteeStore()
    const done = record(store)
    if (!done.ok) throw new Error(done.error.code)
    expect(Object.keys(done.value)).toEqual([
      "tenantId",
      "id",
      "mosqueUnitId",
      "mosquePath",
      "heldAt",
      "minutesAr",
      "decisionsAr",
    ])
  })

  it("ومحضرٌ فارغٌ مردود — اجتماعٌ بلا محضرٍ لا أثرَ له", () => {
    const store = seedCommitteeStore()
    const done = record(store, { minutesAr: "   " })
    expect(done.ok).toBe(false)
    if (!done.ok) expect(done.error.code).toBe("EMPTY_MINUTES")
  })

  it("واجتماعٌ بلا قرارٍ واحدٍ مردود — القراراتُ هي أثرُه في العمل (ب-١٨)", () => {
    const store = seedCommitteeStore()
    const done = record(store, { decisionsAr: [] })
    expect(done.ok).toBe(false)
    if (!done.ok) expect(done.error.code).toBe("NO_DECISIONS")
  })

  it("وقراراتٌ كلُّها فراغٌ مردودة — النصُّ الفارغ ليس قراراً", () => {
    const store = seedCommitteeStore()
    const done = record(store, { decisionsAr: ["  ", ""] })
    expect(done.ok).toBe(false)
    if (!done.ok) expect(done.error.code).toBe("NO_DECISIONS")
  })

  it("ووحدةٌ مجهولةٌ مردودة — يُقفل ولا يُفتح", () => {
    const store = seedCommitteeStore()
    const done = record(store, { mosqueUnitId: "لا-وحدة" })
    expect(done.ok).toBe(false)
    if (!done.ok) expect(done.error.code).toBe("UNKNOWN_MOSQUE_UNIT")
  })

  it("**واجتماعٌ مؤرَّخٌ في المستقبل يُردّ بإعدادٍ حيّ** (ق-٤٥/قب-٦)", () => {
    const store = seedCommitteeStore()
    const done = record(store, { heldAt: new Date("2026-07-21T00:00:00.000Z") })
    expect(done.ok).toBe(false)
    if (!done.ok) expect(done.error.code).toBe("FUTURE_COMPLETION_DATE")
    expect(NOW.getTime()).toBeLessThan(new Date("2026-07-21T00:00:00.000Z").getTime())
  })

  it("**والوحدةُ خلف مفتاحها** (قب-٧): تعطيلُ `feature.meetings` يمنع التسجيل ولا يمحو", () => {
    const store = seedCommitteeStore()
    record(store)
    const off = recordMeeting(
      store,
      committeeContext("u-amir", [
        {
          settingId: "feature.meetings",
          scopePath: "/",
          value: false,
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]),
      {
        mosqueUnitId: KHALID,
        heldAt: HELD_AT,
        minutesAr: "محضرٌ بعد التعطيل",
        decisionsAr: ["قرار"],
      },
    )
    expect(off.ok).toBe(false)
    if (!off.ok) expect(off.error.code).toBe("MODULE_DISABLED")
    expect(meetingsWithin(store, KHALID_PATH)).toHaveLength(1)
  })
})

describe("عزلُ نطاق الاجتماعات — كلُّ محضرٍ في مسجده، والمشرفُ فوقهما يراهما (ق-١٧)", () => {
  function two() {
    const store = seedCommitteeStore()
    record(store)
    record(store, { mosqueUnitId: BILAL, minutesAr: "محضرُ مسجد بلال" })
    return store
  }

  it("مسجدُ خالد يرى محضرَه وحده", () => {
    expect(meetingsWithin(two(), KHALID_PATH)).toHaveLength(1)
  })

  it("ومسجدُ بلال يرى محضرَه وحده", () => {
    const found = meetingsWithin(two(), BILAL_PATH)
    expect(found).toHaveLength(1)
    expect(found[0]!.mosquePath).toBe(BILAL_PATH)
  })

  it("**والمنطقةُ فوقهما ترى الاثنين** (الاطّلاعُ الهابط — ق-١٧)", () => {
    expect(meetingsWithin(two(), HOMS_PATH)).toHaveLength(2)
  })
})

describe("**ب-٢ مدفونٌ في الشجرة نفسِها** — فحصٌ صريحٌ على المصدر", () => {
  /** يمسح شجرةَ الوحدة كلَّها — البرهانُ **محتوائيّ** لا وعدٌ في تعليق (قب-٢٣). */
  function sourceFiles(dir: string): readonly string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
      else if (full.endsWith(".ts")) out.push(full)
    }
    return out
  }

  const MODULE_DIR = new URL("../../../src/features/committees/", import.meta.url).pathname

  /**
   * القياسُ على **الكود** بعد إزالة التعليقات (مع حفظ ترقيم الأسطر) — نظيرُ منهج البوابات:
   * فتوثيقُ الدفن لا يُدان، والسلاسلُ النصّية **تبقى** فلا يتسلّل المفهومُ في نصِّ واجهة.
   */
  function codeOf(file: string): string {
    return readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) ?? []).length))
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
  }

  /** مفرداتُ ب-٢ المدفونة — بالعربية والإنكليزية معاً، فلا يتسلّل المفهومُ بلغةٍ ثانية. */
  const BURIED = [
    /\bquorum\b/i,
    /\bvotes?For\b/i,
    /\bvotes?Against\b/i,
    /\bvoteCount\b/i,
    /\bcastVote\b/i,
    /\battendance\b/i,
    /\battendees\b/i,
    /\btieBreak\w*/i,
    /نصاب/,
    /تصويت|الأصوات|صوّت/,
  ]

  it("لا مفردةَ نصابٍ ولا تصويتٍ ولا حضورٍ مفصَّلٍ في أيّ ملفٍّ من ملفّات الوحدة", () => {
    const offenders: string[] = []
    for (const file of sourceFiles(MODULE_DIR)) {
      codeOf(file).split("\n").forEach((line, i) => {
        for (const pattern of BURIED) {
          if (pattern.test(line)) offenders.push(`${file}:${i + 1} — ${pattern}`)
        }
      })
    }
    expect(offenders, `مفرداتُ ب-٢ المدفونة عادت: ${offenders.join(" · ")}`).toEqual([])
  })

  it("والمسحُ له موضوعٌ فعليّ — الوحدةُ فيها ملفّاتٌ تُمسح (وإلا فالفحصُ أخضرُ بلا حراسة)", () => {
    expect(sourceFiles(MODULE_DIR).length).toBeGreaterThan(5)
  })
})
