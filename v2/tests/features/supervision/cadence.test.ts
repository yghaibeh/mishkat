/**
 * ق-٩٩ — **دورةُ الزيارة إعدادٌ حيّ لا رقمٌ صلب** (عقدُ الوحدة §١، قب-٦/G14).
 *
 * هنا يُقاس ثابتُ المهمة الثالث: **تغييرُ الإعداد يغيّر تصنيف «متأخرة»** — الزيارةُ نفسُها
 * واليومُ نفسُه، ولا سطرَ كودٍ يتغيّر. والقائمةُ **قائمةُ عملٍ مرتَّبةٌ بالحاجة** لا جدولُ
 * أرقام (ق-١٠٨): ما لم يُزَر قطُّ أولاً، ثم الأطولُ إهمالاً.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { recordVisit } from "../../../src/features/supervision/services/visits.js"
import { targetStatuses } from "../../../src/features/supervision/services/cadence.js"
import type { SettingOverride } from "../../../src/settings/resolver.js"
import {
  C1,
  C1B,
  C3,
  CORE,
  MEN_PATH,
  NOW,
  SQ2_PATH,
  TAHFEEZ_DETAILS,
  BASEERA_DETAILS,
  seedSupervisionStore,
  supervisionContext,
} from "./_seed.js"

const DAY_MS = 24 * 60 * 60 * 1000
const daysBefore = (days: number): Date => new Date(NOW.getTime() - days * DAY_MS)

/** ضبطُ الدورة عند القسم — مستواها «قسم» في السجل، فلا تُضبط أعمقَ منه. */
function cadence(days: number): readonly SettingOverride[] {
  return [
    {
      settingId: "supervision.visit_cadence_days",
      scopePath: MEN_PATH,
      value: days,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      id: "ov-cadence",
    },
  ]
}

/** زيارةٌ مسجَّلةٌ قبل `days` يوماً — تُسجَّل بالمسار المشروع لا بحقنٍ في المستودع. */
function visitedDaysAgo(store: ReturnType<typeof seedSupervisionStore>, targetId: string, days: number): void {
  const details = targetId === C1B ? BASEERA_DETAILS : TAHFEEZ_DETAILS
  const result = recordVisit(store, supervisionContext("u-square", { now: daysBefore(days) }), {
    targetId,
    visitedAt: daysBefore(days),
    core: CORE,
    details,
  })
  if (!result.ok) throw new Error(`تعذّر تسجيلُ زيارةِ البذرة: ${result.error.code}`)
}

describe("ق-٩٩ — تصنيفُ الهدف: لم يُزَر · متأخر · حديث", () => {
  it("هدفٌ لم تُسجَّل له زيارةٌ قطُّ ⇒ «لم يُزَر» بلا عددِ أيام", () => {
    const store = seedSupervisionStore()
    const rows = targetStatuses(store, supervisionContext("u-square"), SQ2_PATH)
    const c1 = rows.find((r) => r.targetId === C1)

    expect(c1?.status).toBe("notVisited")
    expect(c1?.daysSinceLastVisit).toBeNull()
  })

  it("وزيارةٌ داخل الدورة ⇒ «حديث»", () => {
    const store = seedSupervisionStore()
    visitedDaysAgo(store, C1, 3)
    const rows = targetStatuses(store, supervisionContext("u-square"), SQ2_PATH)

    expect(rows.find((r) => r.targetId === C1)?.status).toBe("recent")
    expect(rows.find((r) => r.targetId === C1)?.daysSinceLastVisit).toBe(3)
  })

  it("وزيارةٌ أقدمُ من الدورة ⇒ «متأخر»", () => {
    const store = seedSupervisionStore()
    visitedDaysAgo(store, C1, 45)
    const rows = targetStatuses(store, supervisionContext("u-square"), SQ2_PATH)

    expect(rows.find((r) => r.targetId === C1)?.status).toBe("late")
  })

  it("**والحدُّ بالضبط ليس تأخراً**: عند الدورة تماماً يبقى «حديثاً» (التأخرُ ما جاوزها)", () => {
    const store = seedSupervisionStore()
    visitedDaysAgo(store, C1, 30)
    const rows = targetStatuses(store, supervisionContext("u-square"), SQ2_PATH)

    expect(rows.find((r) => r.targetId === C1)?.status).toBe("recent")
    expect(rows.find((r) => r.targetId === C1)?.cadenceDays).toBe(30)
  })
})

describe("**الإعدادُ يقلب التصنيف بلا سطرِ كود** (الاختبار الثالث الإلزاميّ — قب-٦)", () => {
  it("نفسُ الزيارة: بدورة الافتراض «حديثة»، وبدورةٍ أقصر «متأخرة»", () => {
    const store = seedSupervisionStore()
    visitedDaysAgo(store, C1, 10)

    const byDefault = targetStatuses(store, supervisionContext("u-square"), SQ2_PATH)
    expect(byDefault.find((r) => r.targetId === C1)?.status).toBe("recent")

    const tightened = targetStatuses(
      store,
      supervisionContext("u-square", { settings: cadence(7) }),
      SQ2_PATH,
    )
    expect(tightened.find((r) => r.targetId === C1)?.status).toBe("late")
    expect(tightened.find((r) => r.targetId === C1)?.cadenceDays).toBe(7)
  })

  it("والعكسُ صحيح: توسيعُ الدورة يعيد المتأخرَ حديثاً", () => {
    const store = seedSupervisionStore()
    visitedDaysAgo(store, C1, 45)

    expect(
      targetStatuses(store, supervisionContext("u-square"), SQ2_PATH).find((r) => r.targetId === C1)
        ?.status,
    ).toBe("late")

    const widened = targetStatuses(
      store,
      supervisionContext("u-square", { settings: cadence(60) }),
      SQ2_PATH,
    )
    expect(widened.find((r) => r.targetId === C1)?.status).toBe("recent")
  })

  it("**ولا رقمَ دورةٍ صلبٌ في شجرة الوحدة** — المصدرُ يُمسح كما يُمسح مقياسُ ٥٦/٤٠", () => {
    const dir = join(process.cwd(), "src/features/supervision")
    const files: string[] = []
    const walk = (d: string): void => {
      for (const name of readdirSync(d)) {
        const full = join(d, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (name.endsWith(".ts")) files.push(full)
      }
    }
    walk(dir)

    const hits: string[] = []
    for (const file of files) {
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1")
      if (/(?<![\w.])30(?![\w.])/.test(code)) hits.push(file)
    }
    expect(hits, `دورةٌ مصلَّبة: ${hits.join(" · ")}`).toEqual([])
  })
})

describe("الترتيبُ بالحاجة — اللوحةُ قائمةُ عملٍ لا جدولُ أرقام (ق-١٠٨)", () => {
  it("ما لم يُزَر أولاً، ثم الأطولُ إهمالاً", () => {
    const store = seedSupervisionStore()
    visitedDaysAgo(store, C1, 5)
    visitedDaysAgo(store, C3, 40)
    // `c1b` بلا زيارةٍ قطّ.

    const rows = targetStatuses(store, supervisionContext("u-square"), SQ2_PATH)
    expect(rows.map((r) => r.targetId)).toEqual([C1B, C3, C1])
  })

  it("والهدفُ الموقوفُ لا يدخل اللوحة أصلاً", () => {
    const store = seedSupervisionStore()
    const rows = targetStatuses(store, supervisionContext("u-square"), SQ2_PATH)

    expect(rows.map((r) => r.targetId)).not.toContain("c-retired")
  })

  it("**والعزلُ بالنطاق في القراءة**: لوحةُ المربع الثاني لا تُظهر أهدافَ السابع", () => {
    const store = seedSupervisionStore()
    const rows = targetStatuses(store, supervisionContext("u-square"), SQ2_PATH)

    expect(rows.map((r) => r.targetId).sort()).toEqual([C1, C1B, C3].sort())
  })
})
