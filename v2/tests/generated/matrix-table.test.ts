/**
 * TDD مولّد جدول المصفوفة §٣.٣ — CR-005 / قب-١٦ (المخرَج المتوقع أولاً، ثم الأداة).
 * لا يُكتب جدولٌ يدوياً هنا: الأداة تشتقّه من الملف الذهبي، والاختبار يثبّت **بنيته**
 * و**الخلايا الخمس المصحَّحة** ثم يتحقق أن المواصفة مطابقةٌ بايتاً للمخرَج (نظير G19 داخل الطقم).
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// @ts-expect-error — أداة توليد بصيغة mjs بلا تعريفات أنواع؛ منطقها المفحوص هنا نقيّ
import { generateMatrixTable, extractGeneratedBlock } from "../../tools/generate/matrix-table.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..", "..")
const matrix = JSON.parse(
  readFileSync(join(root, "src/authorization/matrix/authorization.matrix.json"), "utf8"),
)
const specPath = join(root, "..", "rebuild", "specs", "SPEC_authorization.md")

const block: string = generateMatrixTable(matrix)
const lines = block.split("\n")

const HEADER =
  "| # | القدرة | نطاق | admin | section_head | rabita | square | amir | teacher | committee_head | media | finance_officer | student |"
const SEPARATOR = "|---|---|---|---|---|---|---|---|---|---|---|---|---|"

describe("مولّد جدول §٣.٣ — البنية مطابقةٌ للجدول الأصلي", () => {
  it("العنوان: عشرة أدوار حيّة أعمدةً بترتيب الرتبة", () => {
    expect(lines).toContain(HEADER)
  })

  it("سطر الفصل: ثلاثة عشر عموداً (# · القدرة · نطاق · ١٠ أدوار)", () => {
    expect(lines).toContain(SEPARATOR)
  })

  it("صفٌّ لكلّ قدرةٍ في الكتالوج — ٨٧ صفاً", () => {
    const dataRows = lines.filter((l) => /^\| [٠-٩]+ \| `/.test(l))
    expect(dataRows.length).toBe(matrix.capabilities.length)
    expect(dataRows.length).toBe(87)
  })

  it("الأرقام هندية عربية والقدرة بين علامتَي شرطة مائلة عكسية", () => {
    expect(lines).toContain("| ١ | `network.view` | و | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · |")
  })
})

describe("الخلايا الخمس المصحَّحة — انحراف الأدوار الخمسة صار مطابقاً (CR-005)", () => {
  it("section_head بلا finance.entry (ق-م٥) — الخلية `·` لا `✓`", () => {
    expect(lines).toContain("| ٣٦ | `finance.entry` | و | · | · | · | · | · | · | · | · | ✓ | · |")
  })

  it("competition.manage منطاقة للأدوار الخمسة (CR-001/ت-١)", () => {
    expect(lines).toContain(
      "| ٦٦ | `competition.manage` | و | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · |",
    )
  })

  it("competition.result.declare قدرةٌ مستقلة صفاً ٨٧ (CR-001/ت-٢)", () => {
    expect(lines).toContain(
      "| ٨٧ | `competition.result.declare` | و | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · |",
    )
  })

  it("العدّ النافذ مشتقٌّ من الخلايا — الأدوار العشرة", () => {
    // بترتيب الأعمدة: admin · section_head · rabita · square · amir · teacher · committee_head · media · finance_officer · student
    const expected = [
      ["admin", "٤٧"],
      ["section_head", "٤٧"],
      ["rabita", "٤٥"],
      ["square", "٣٧"],
      ["amir", "٤٢"],
      ["teacher", "٩"],
      ["committee_head", "٦"],
      ["media", "٧"],
      ["finance_officer", "١٩"],
      ["student", "٤"],
    ]
    for (const [role, count] of expected) {
      expect(lines, `عدّ ${role}`).toContain(`| \`${role}\` | ${count} |`)
    }
  })
})

describe("G19 داخل الطقم — المواصفة مطابقةٌ بايتاً لمخرَج المولّد", () => {
  it("كتلة §٣.٣ المولَّدة في المواصفة تساوي المخرَج حرفاً بحرف", () => {
    const spec = readFileSync(specPath, "utf8")
    const inSpec = extractGeneratedBlock(spec)
    expect(inSpec, "علامتا التوليد غائبتان عن SPEC_authorization §٣.٣").not.toBeNull()
    expect(inSpec).toBe(block)
  })
})
