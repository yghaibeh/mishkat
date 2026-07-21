/**
 * ق-١٠٧/ز-٤ — **«عُهدتي» في الإعلام ليست مرآةً لعُهد الشبكة** (عقدُ الوحدة §٠ و§٩).
 *
 * حسمُ IA (ز-٤) أن الازدواجَ يُقتل بالنفي لا بالتكرار: «عُهدتي» (`custody.own`) موطنُها
 * **السطحُ الشخصيّ**، وسلسلةُ الحيازة موطنُها **سطحُ العُهد** (ك-٣٠) — **ولا مرآةَ في
 * الإعلام**. فحدُّ هذه الوحدة **نفيٌ يُقاس**: حارسان، محتوائيٌّ يمسح سطحَ الوحدة كلَّه،
 * وعقديٌّ يفحص إعلانات الشاشتين — فلا يعود «لا مرآة» وعداً يُنقض بسطرٍ سهو.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, it, expect } from "vitest"
import {
  MEDIA_HUB_CONTRACT,
  MEDIA_COVERAGES_CONTRACT,
} from "../../../src/features/media/screens/screens.js"
import { SCREEN_SURFACE_CAPS } from "../../../src/features/media/screens/caps.js"
import { DOORS } from "../../../src/ui/screens/doors.js"

const UNIT_DIR = join(process.cwd(), "src/features/media")

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (full.endsWith(".ts")) out.push(full)
  }
  return out
}

/** الكودُ بلا تعليقات: العقدُ يشرح النفيَ نصاً، والحارسُ يقيس **الكودَ** لا الشرح. */
function codeOf(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
}

describe("ق-١٠٧ — صفر مرآةِ عُهدٍ في وحدة الإعلام", () => {
  it("**لا قدرةَ عُهدةٍ تُستهلَك** في أي سطرٍ من سطوح الوحدة", () => {
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      const code = codeOf(file)
      for (const cap of ["custody.view", "custody.grant", "custody.own", "asset.manage"]) {
        if (code.includes(`"${cap}"`)) offenders.push(`${file}: ${cap}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("**ولا حقلَ أصولٍ ولا حيازةٍ** في كيانات الوحدة ولا في نماذج عرضها", () => {
    const offenders: string[] = []
    for (const file of sourceFiles(UNIT_DIR)) {
      const code = codeOf(file)
      for (const token of ["custody", "asset", "holder", "Custody", "Asset", "Holder"]) {
        if (new RegExp(`\\b${token}\\w*\\s*:`).test(code)) offenders.push(`${file}: ${token}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it("وعقدا الشاشتين يعلنان قدرتَي الإعلام لا ثالثةَ لهما", () => {
    expect([...MEDIA_HUB_CONTRACT.capabilities]).toEqual(["media.hub"])
    expect([...MEDIA_COVERAGES_CONTRACT.capabilities]).toEqual(["media.post"])
    expect([...SCREEN_SURFACE_CAPS].sort()).toEqual(["media.hub", "media.post"])
  })

  it("**وبابُ «عُهدتي» موطنُه السطحُ الشخصيّ لا سطحُ الإعلام** (ز-٤ حرفياً)", () => {
    const personal = DOORS.find((d) => d.surface === "personal")
    const media = DOORS.find((d) => d.surface === "media")

    expect(personal?.capabilities).toContain("custody.own")
    expect(media?.capabilities).not.toContain("custody.own")
    expect([...(media?.capabilities ?? [])]).toEqual(["media.hub", "media.post"])
  })
})
