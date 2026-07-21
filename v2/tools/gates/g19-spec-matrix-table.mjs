/**
 * G19 — جدول المصفوفة §٣.٣ في المواصفة مطابقٌ للملف الذهبي (المادة ١/٢، قب-١٦).
 *
 * نظيرُ G5 لكن للوثيقة لا للكود: G5 تحرس أن **الكود** لا ينحرف عن الملف الذهبي،
 * وG19 تحرس أن **جدول §٣.٣ في `SPEC_authorization.md`** لا ينحرف عنه — فلا يبقى للمصفوفة
 * تمثيلان يتناقضان (كان انحرافُ خمسة أدوار سببَ CR-005). الملف الذهبي وحده يُحرَّر، وبـCR فقط.
 *
 * لا تعارض بين G5 وG19: كلاهما يقيس ضد **المصدر نفسه** (`authorization.matrix.json`)؛
 * فمتى تغيّر الملف الذهبي بطلبٍ معتمد، أُعيد توليد الكود (G5) والجدول (G19) معاً، فيخضرّان معاً.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT, fail, pass } from "./_lib.mjs"
import {
  generateMatrixTable,
  extractGeneratedBlock,
  MARKER_START,
  MARKER_END,
} from "../generate/matrix-table.mjs"

const violations = []

const matrix = JSON.parse(
  readFileSync(join(ROOT, "src/authorization/matrix/authorization.matrix.json"), "utf8"),
)
const specPath = join(ROOT, "..", "rebuild", "specs", "SPEC_authorization.md")
const spec = readFileSync(specPath, "utf8")

const expected = generateMatrixTable(matrix)
const actual = extractGeneratedBlock(spec)

if (actual === null) {
  violations.push(
    `علامتا التوليد غائبتان عن SPEC_authorization §٣.٣ (${MARKER_START} … ${MARKER_END}).`,
  )
} else if (actual !== expected) {
  // أوّلُ سطرٍ مختلف دليلاً للمحرِّر.
  const a = actual.split("\n")
  const e = expected.split("\n")
  const i = a.findIndex((l, k) => l !== e[k])
  violations.push(
    "جدول §٣.٣ في المواصفة منحرفٌ عن الملف الذهبي — أعِد التوليد بـ`npm run gen:matrix-table`.",
    i >= 0 ? `أوّل اختلاف عند السطر ${i + 1}:` : "اختلافٌ في الطول.",
    i >= 0 ? `  المواصفة: ${a[i] ?? "(غائب)"}` : "",
    i >= 0 ? `  المتوقَّع: ${e[i] ?? "(غائب)"}` : "",
  )
}

if (violations.length) fail("G19", "جدول المصفوفة في المواصفة", violations.filter(Boolean))
pass("G19", "جدول المصفوفة في المواصفة", `${matrix.capabilities.length} قدرة مطابقة`)
