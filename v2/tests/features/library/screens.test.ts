/**
 * عقودُ شاشتَي المكتبة — عقدُ الوحدة §١٠ (وحاكمُهما G20).
 *
 * **طبقةُ عرضٍ نقيّة**: تُبنى الشاشةُ من (قدراتٍ محسوبة + لقطة) فتُفحص بنيتُها بلا متصفح.
 * وهنا **العقدُ نفسُه** يُحاكَم: المسارُ والسطحُ والموطنُ ومصدرُ البيانات والفراغان.
 */
import { describe, it, expect } from "vitest"
import {
  EMPTY_LIBRARY_SNAPSHOT,
  LIBRARY_MATERIALS_CONTRACT,
  LIBRARY_MINE_CONTRACT,
  formatMandatoryProgress,
  libraryMaterialsScreenNodes,
  libraryMineScreenNodes,
} from "../../../src/features/library/screens/screens.js"
import { validateContract } from "../../../src/ui/screens/contract.js"
import { walkNodes } from "../../../src/ui/components/kernel.js"
import type { CapId } from "../../../src/authorization/generated/capabilities.generated.js"

const caps = (...ids: CapId[]): ReadonlySet<CapId> => new Set(ids)

describe("§١٠ — عقدا الشاشتين صالحان ومتمايزان", () => {
  it("العقدان صالحان بلا مخالفة، ومصدرُ بيانات كلٍّ **واحد** (ق-١١١)", () => {
    for (const contract of [LIBRARY_MINE_CONTRACT, LIBRARY_MATERIALS_CONTRACT]) {
      expect(validateContract(contract)).toEqual([])
    }
    expect(LIBRARY_MINE_CONTRACT.dataSource).toBe("library.mine.view")
    expect(LIBRARY_MATERIALS_CONTRACT.dataSource).toBe("library.manage.view")
  })

  it("**وموطنُ «المادة المكتبية» شاشةُ الإدارة وحدها** (IA ك-٨) — و«مكتبتي» عرضٌ منسوب", () => {
    expect(LIBRARY_MATERIALS_CONTRACT.canonicalHome).toEqual(["libraryItem"])
    expect(LIBRARY_MINE_CONTRACT.canonicalHome).toEqual([])
  })

  it("**ومن لا قدرةَ له يرى تشخيصاً لا شاشةً بيضاء** (ق-١١٢) — في الشاشتين معاً", () => {
    for (const nodes of [
      libraryMineScreenNodes(caps(), EMPTY_LIBRARY_SNAPSHOT),
      libraryMaterialsScreenNodes(caps(), EMPTY_LIBRARY_SNAPSHOT),
    ]) {
      expect(nodes.component).toBe("EmptyState")
      expect(nodes.meta.audience).toBe("viewer")
      expect([...nodes.textKeys]).toContain("state.deniedHint")
    }
  })

  it("والجدولُ يعلن حالتَه: فارغٌ بلا صفوف، وذو بياناتٍ بها", () => {
    const empty = libraryMineScreenNodes(caps("library.own"), EMPTY_LIBRARY_SNAPSHOT)
    const emptyTable = walkNodes(empty).find((n) => n.component === "DataTable")
    expect(emptyTable?.meta.state).toBe("empty")

    const filled = libraryMineScreenNodes(caps("library.own"), {
      ...EMPTY_LIBRARY_SNAPSHOT,
      mineRows: [{ title: "دليل", category: "عقيدة", mandatory: "نعم", state: "مستلمة" }],
    })
    const table = walkNodes(filled).find((n) => n.component === "DataTable")
    expect(table?.meta.state).toBe("data")
    expect(table?.meta.rows).toBe("1")
  })

  it("**وكتالوجُ الإدارة ومصفوفتُها يُعلنان حالتيهما بلقطةٍ واحدة** (ق-١١١)", () => {
    const filled = libraryMaterialsScreenNodes(caps("library.manage"), {
      ...EMPTY_LIBRARY_SNAPSHOT,
      catalogRows: [{ title: "دليل", audience: "الجميع", unit: "الشبكة", mandatory: "نعم" }],
      trackingRows: [{ person: "أمير خالد", completed: "٠/١" }],
      acceptedTypes: ["application/pdf"],
      maxBytes: 1_000,
    })
    const tables = walkNodes(filled).filter((n) => n.component === "DataTable")
    expect(tables).toHaveLength(2)
    for (const table of tables) expect(table.meta.state).toBe("data")
  })

  it("وعدّادُ الإلزاميّ يُنسَّق بأرقامٍ عربية-هندية (قب-٢٠) — تنسيقٌ لا حساب", () => {
    expect(formatMandatoryProgress(1, 3)).toBe("١/٣")
  })
})
