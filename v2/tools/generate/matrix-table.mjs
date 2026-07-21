#!/usr/bin/env node
/**
 * مولّد جدول المصفوفة §٣.٣ من الملف الذهبي — CR-005 / قب-١٦.
 * «المصفوفة مصدرُ حقيقةٍ واحد»: جدول §٣.٣ في `SPEC_authorization.md` **يُشتقّ** من
 * `authorization.matrix.json` ولا يُحرَّر يدوياً. تحرس **G19** أن الجدول في المواصفة
 * مطابقٌ بايتاً لمخرَج هذا المولّد — نظيرُ G5 للكود، لكن للوثيقة (المادة ١/٢).
 *
 * منطق التوليد نقيٌّ (`generateMatrixTable`) كي يُختبَر ويُثبَت بلا سباكة ملفات.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..", "..")
const repoRoot = join(root, "..")
const matrixPath = join(root, "src", "authorization", "matrix", "authorization.matrix.json")
const specPath = join(repoRoot, "rebuild", "specs", "SPEC_authorization.md")

export const MARKER_START =
  "<!-- ⚙️ GENERATED:matrix-table START — لا يُحرَّر يدوياً (CR-005/قب-١٦) -->"
export const MARKER_END = "<!-- ⚙️ GENERATED:matrix-table END -->"

/** أرقام هندية عربية — كأرقام الجدول الحالي (١، ٢، … ٨٧). */
function toArabicDigits(n) {
  return String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)])
}

/**
 * يبني جدول §٣.٣ (Markdown) من المصفوفة الذهبية — بنيةٌ مطابقةٌ للجدول الأصلي:
 * أدوارٌ حيّة أعمدةً بترتيب المصفوفة · قدراتٌ صفوفاً بترتيب `no` · `✓`/`·` · عمود نوع النطاق.
 * @param {any} matrix محتوى `authorization.matrix.json` مُحلَّلاً.
 * @returns {string} كتلةٌ نصيّة كاملة محاطةٌ بعلامتَي التوليد (START/END).
 */
export function generateMatrixTable(matrix) {
  // الأعمدة: الأدوار الحيّة فقط، بترتيب ظهورها في الملف الذهبي (= ترتيب الرتبة).
  const activeRoles = matrix.roles.filter((r) => r.state === "active").map((r) => r.id)

  // حرف نوع النطاق يُشتقّ من الملف الذهبي نفسه (أول محرف من وصف `scopeKinds`) — لا يُثبَّت هنا.
  const scopeLetter = (scopeKind) => matrix.scopeKinds[scopeKind].trim()[0]

  const bundles = Object.fromEntries(
    activeRoles.map((r) => [r, new Set(matrix.matrix[r] ?? [])]),
  )

  const headerCells = ["#", "القدرة", "نطاق", ...activeRoles]
  const header = `| ${headerCells.join(" | ")} |`
  const separator = `|${"---|".repeat(headerCells.length)}`

  const rows = matrix.capabilities.map((c) => {
    const marks = activeRoles.map((r) => (bundles[r].has(c.id) ? "✓" : "·"))
    return `| ${toArabicDigits(c.no)} | \`${c.id}\` | ${scopeLetter(c.scopeKind)} | ${marks.join(" | ")} |`
  })

  const counts = activeRoles.map(
    (r) => `| \`${r}\` | ${toArabicDigits(bundles[r].size)} |`,
  )

  return [
    MARKER_START,
    "> ⚙️ **مولَّد آلياً من الملف الذهبي `authorization.matrix.json` — لا يُحرَّر يدوياً** (CR-005/قب-١٦).",
    "> يُعاد توليده بـ`npm run gen:matrix-table`، وبوابة **G19** تفشل عند أي تباعدٍ بينه وبين الملف الذهبي.",
    "",
    header,
    separator,
    ...rows,
    "",
    "**عدد قدرات كل دور (مشتقٌّ آلياً من خلايا الجدول أعلاه):**",
    "",
    "| الدور | عدد القدرات |",
    "|---|---|",
    ...counts,
    MARKER_END,
  ].join("\n")
}

/** يستخرج الكتلة المولَّدة (شاملةً العلامتين) من نصّ المواصفة، أو `null` إن غابت العلامتان. */
export function extractGeneratedBlock(specText) {
  const start = specText.indexOf(MARKER_START)
  const end = specText.indexOf(MARKER_END)
  if (start === -1 || end === -1 || end < start) return null
  return specText.slice(start, end + MARKER_END.length)
}

// ─── واجهة سطر الأوامر ───────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const matrix = JSON.parse(readFileSync(matrixPath, "utf8"))
  const block = generateMatrixTable(matrix)
  const mode = process.argv.includes("--check")
    ? "check"
    : process.argv.includes("--print")
      ? "print"
      : "write"

  if (mode === "print") {
    process.stdout.write(block + "\n")
  } else {
    const spec = readFileSync(specPath, "utf8")
    const current = extractGeneratedBlock(spec)
    if (current === null) {
      console.error(
        "✗ لم تُوجد علامتا التوليد في SPEC_authorization §٣.٣ — ضَعْ MARKER_START/END حول الجدول أولاً.",
      )
      process.exit(1)
    }
    if (mode === "check") {
      if (current !== block) {
        console.error("✗ جدول §٣.٣ في المواصفة منحرفٌ عن الملف الذهبي (أعِد التوليد).")
        process.exit(1)
      }
      console.log("✓ جدول §٣.٣ مطابقٌ للملف الذهبي")
    } else {
      if (current === block) {
        console.log("لا تغيير — جدول §٣.٣ مطابقٌ أصلاً")
      } else {
        writeFileSync(specPath, spec.replace(current, block), "utf8")
        console.log("✓ أُعيد توليد جدول §٣.٣ في SPEC_authorization")
      }
    }
  }
}
