/**
 * §٨ — **التذكيرُ واجهةٌ معلنةٌ لا مُجدوِل** (عقدُ الوحدة §٨، ذيلُ ق-٩٦).
 *
 * **لا مُجدوِلَ في v2 بعد** — فبناؤه هنا يُنشئ الثانيَ من صنفه (عينُ مرض v1: المنطق مبعثر).
 * والمُصدَّرُ **الاشتقاق** وحده: «ما هو إلزاميٌّ ومتأخّر ولمن». والدعوى تُقاس **بالمحتوى**
 * لا بالسلوك (قب-٤٠): حارسٌ يمسح سطحَ الوحدة فيفشل عند أيّ مفردةِ جدولة، وعند قراءة إعداد
 * الدورية الذي **ليس من شأن هذه الوحدة**.
 */
import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { createMaterial } from "../../../src/features/library/services/materials.js"
import { myLibrary } from "../../../src/features/library/services/mine.js"
import { completeMaterial, openMaterial } from "../../../src/features/library/services/timeline.js"
import {
  OVERDUE_SETTING,
  overdueMandatory,
} from "../../../src/features/library/services/reminders.js"
import { libraryContext, materialInput, seedLibraryStore, KHALID_PATH, ROOT_PATH } from "./_seed.js"
import type { SettingOverride } from "../../../src/settings/resolver.js"
import type { LibraryStore } from "../../../src/features/library/data/store.js"

const MODULE_DIR = new URL("../../../src/features/library/", import.meta.url).pathname

function sourceFiles(dir: string): readonly string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path))
    else if (entry.endsWith(".ts")) out.push(path)
  }
  return out
}

const UPLOAD: SettingOverride = {
  settingId: "platform.upload.max_bytes",
  scopePath: "/",
  value: 5_000_000,
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
}

/** عتبةُ التأخّر مضبوطةً صراحةً — الافتراضيُّ في السجل، والاختبارُ لا يعتمد عليه. */
function overdueAfter(days: number): readonly SettingOverride[] {
  return [
    UPLOAD,
    {
      settingId: OVERDUE_SETTING,
      scopePath: "/",
      value: days,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
    },
  ]
}

function seedDelivered(store: LibraryStore, mandatory: boolean): string {
  const made = createMaterial(
    store,
    libraryContext("u-admin"),
    materialInput({ unitId: "khalid", mandatory }),
  )
  if (!made.ok) throw new Error(made.error.code)
  myLibrary(store, libraryContext("u-amir", { settings: overdueAfter(14) }))
  return made.value.id
}

const LATER = new Date("2026-08-10T00:00:00.000Z")

describe("§٨ — الواجهةُ المعلنة: «ما هو إلزاميٌّ ومتأخّر»", () => {
  it("مادةٌ إلزاميةٌ لم تُنجَز بعد انقضاء العتبة ⇒ تظهر بمن تأخّر عنها وبعدد أيامه", () => {
    const store = seedLibraryStore()
    const id = seedDelivered(store, true)

    const ctx = libraryContext("u-admin", { settings: overdueAfter(14), now: LATER })
    const rows = overdueMandatory(store, ctx, KHALID_PATH)
    const mine = rows.filter((r) => r.personId === "u-amir")
    expect(mine).toHaveLength(1)
    expect(mine[0]?.materialId).toBe(id)
    expect(mine[0]?.daysSinceDelivered).toBeGreaterThan(14)
    expect(mine[0]?.unitPath).toBe(KHALID_PATH)
  })

  it("**والعتبةُ إعدادٌ حيّ**: رفعُها يُخرج المتأخّرَ من القائمة بلا سطرِ كود (قب-٦/G14)", () => {
    const store = seedLibraryStore()
    seedDelivered(store, true)

    const wide = libraryContext("u-admin", { settings: overdueAfter(365), now: LATER })
    expect(overdueMandatory(store, wide, KHALID_PATH)).toHaveLength(0)
  })

  it("وعند الحدّ تماماً لم تنقضِ العتبةُ بعد — التأخّرُ ما **جاوزها**", () => {
    const store = seedLibraryStore()
    seedDelivered(store, true)

    // بين الاستلام (٢٠ تموز) و١٠ آب واحدٌ وعشرون يوماً.
    const atLimit = libraryContext("u-admin", { settings: overdueAfter(21), now: LATER })
    expect(overdueMandatory(store, atLimit, KHALID_PATH)).toHaveLength(0)
    const past = libraryContext("u-admin", { settings: overdueAfter(20), now: LATER })
    expect(overdueMandatory(store, past, KHALID_PATH).length).toBeGreaterThan(0)
  })

  it("**والاختياريُّ لا يُذكَّر به أبداً** — التذكيرُ للإلزاميّ وحده (ق-٩٦)", () => {
    const store = seedLibraryStore()
    seedDelivered(store, false)

    const ctx = libraryContext("u-admin", { settings: overdueAfter(1), now: LATER })
    expect(overdueMandatory(store, ctx, KHALID_PATH)).toHaveLength(0)
  })

  it("**والمُنجِزُ يخرج من القائمة، والفاتحُ لا يخرج** — الإنجازُ وحده يُسقط التذكير", () => {
    const store = seedLibraryStore()
    const id = seedDelivered(store, true)
    const amir = libraryContext("u-amir", { settings: overdueAfter(14) })

    openMaterial(store, amir, { materialId: id })
    const afterOpen = libraryContext("u-admin", { settings: overdueAfter(14), now: LATER })
    expect(overdueMandatory(store, afterOpen, KHALID_PATH).some((r) => r.personId === "u-amir")).toBe(
      true,
    )

    completeMaterial(store, amir, { materialId: id })
    expect(overdueMandatory(store, afterOpen, KHALID_PATH).some((r) => r.personId === "u-amir")).toBe(
      false,
    )
  })

  it("والاشتقاقُ معزولٌ بالنطاق كغيره — لا يعبر إلى مَن هو خارجه", () => {
    const store = seedLibraryStore()
    seedDelivered(store, true)
    const ctx = libraryContext("u-admin", { settings: overdueAfter(14), now: LATER })

    expect(overdueMandatory(store, ctx, ROOT_PATH).length).toBeGreaterThan(0)
    expect(overdueMandatory(store, ctx, "/men/homs/sq7/omar/")).toHaveLength(0)
  })

  it("والترتيبُ حتميّ: الأطولُ تأخّراً أولاً ثم المعرّف — قائمةُ عملٍ لا جدولُ أرقام", () => {
    const store = seedLibraryStore()
    seedDelivered(store, true)
    const ctx = libraryContext("u-admin", { settings: overdueAfter(1), now: LATER })

    const rows = overdueMandatory(store, ctx, KHALID_PATH)
    const sorted = [...rows].sort(
      (a, b) =>
        b.daysSinceDelivered - a.daysSinceDelivered ||
        a.personId.localeCompare(b.personId) ||
        a.materialId.localeCompare(b.materialId),
    )
    expect(rows).toEqual(sorted)
  })

  it("**وحدٌّ مُعلَن**: مَن لم يفتح مكتبتَه قطُّ لم يُستلِم — فلا يُعدّ «متأخراً» بل «لم يستلم»", () => {
    const store = seedLibraryStore()
    seedDelivered(store, true) // الأميرُ وحدَه عُرضت له مكتبتُه
    const ctx = libraryContext("u-admin", { settings: overdueAfter(1), now: LATER })

    const rows = overdueMandatory(store, ctx, KHALID_PATH)
    expect(rows.some((r) => r.personId === "u-amir")).toBe(true)
    // `u-teacher` في النطاق وفي الجمهور، ولم يُعرض له شيءٌ ⇒ لا خَتمَ استلامٍ ⇒ لا تأخّر.
    expect(rows.some((r) => r.personId === "u-teacher")).toBe(false)
    expect(store.getProgress(rows[0]!.materialId, "u-teacher")).toBeNull()
  })
})

describe("§٨ — **حارسٌ محتوائيّ: لا مُجدوِلَ مبنيّ في هذه الوحدة** (قب-٤٠)", () => {
  const SCHEDULER_MARKERS = [
    /\bsetTimeout\b/,
    /\bsetInterval\b/,
    /\bcron\b/i,
    /\bscheduler?\b/i,
    /\benqueue\b/i,
    /\bnotify\b/i,
    /\bsendReminder\b/i,
  ]

  it("صفرُ مفردةِ جدولةٍ أو إيصالٍ في مصدر الوحدة كلِّه", () => {
    const offenders: string[] = []
    for (const file of sourceFiles(MODULE_DIR)) {
      const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
      code.split("\n").forEach((line, i) => {
        for (const re of SCHEDULER_MARKERS) {
          if (re.test(line)) offenders.push(`${file.slice(MODULE_DIR.length)}:${i + 1}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })

  it("**ولا تقرأ الوحدةُ إعدادَ الدورية** — `materials.reminder_interval_days` شأنُ المستهلِك", () => {
    const readers = sourceFiles(MODULE_DIR).filter((file) =>
      readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
        .includes("materials.reminder_interval_days"),
    )
    expect(readers).toEqual([])
  })

  it("والعتبةُ التي **تقرؤها** معرّفٌ واحدٌ مُعلَنٌ في السجل المركزيّ", () => {
    expect(OVERDUE_SETTING).toBe("materials.mandatory_overdue_days")
  })
})