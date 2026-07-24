/**
 * G21 — **حارسُ ميزانية الواجهة** (ADR-002r §٥-٣/§٥-٤/١ · قب-٢٦/١).
 *
 * ### ⚠ الحالة: **مقترحةٌ — تُعرَض ولا تُدرَج صامتةً**
 * ADR-002r ملحق د نصّاً: «إضافةٌ تحتاج اعتماداً صريحاً: **G21** — تُعرض ولا تُدرَج صامتةً».
 * ولذلك **لم تُضَف إلى `run-all.mjs` ولا إلى `prove-all.mjs`**، ولا يتغيّر عددُ البوابات
 * حتى يعتمدها المدير. تُشغَّل يدوياً: `node tools/gates/g21-ui-load-budget.mjs <بيان>`.
 *
 * ### ماذا تحرس
 * الميزانيةُ المعتمدة في قب-٢٦/١ **ملزمةٌ ومستقلةٌ عن الإطار**، لكنها اليوم **رقمٌ في وثيقة**
 * لا حارسَ له: كلُّ كيلوبايتٍ يُضاف يمرّ صامتاً حتى يكتشفه الميدانُ على شبكةٍ ضعيفة. هذه
 * البوابةُ هي نزعُ الصمت (نظيرُ منطق G23): «مفاجأةٌ في الميدان» تصير **بناءً أحمرَ في الدقيقة**.
 *
 *  - **ع-١**: جافاسكربت الصفحة الأولى **> ٧٥ ك.ب brotli** ⟵ أحمر، لا دمج.
 *  - **ع-٢**: الحمولةُ الأولى كاملةً **> ١٥٠ ك.ب brotli** ⟵ أحمر.
 *  - **ع-٤**: طلباتُ الصفحة الأولى **> ٤** ⟵ أحمر.
 *
 * ### ثلاثةُ قراراتٍ في تصميمها
 *  ١. **قياسٌ محتوائيٌّ بحتٌ على ناتج بناء** — فتعمل في CI حيث لا حالةَ محلية (سؤالُ قب-٢٣).
 *  ٢. **القائمةُ تُشتقّ من بيانِ بناءٍ لا تُسرد هنا** (CR-011/قب-٣٦: بوابةٌ تُسرد لها الحقيقةُ
 *     تتخلّف عن الواقع حتماً). أصلٌ جديدٌ في الصفحة الأولى يدخل الحسابَ بلا تعديل هذا الملفّ.
 *  ٣. **الغموضُ أحمر**: بيانٌ مفقودٌ أو أصلٌ مذكورٌ غيرُ موجود ⟵ فشل. بوابةٌ تُعلن الخضرةَ
 *     حين لا تجد ما تقيسه هي عينُ عطب G13 الذي أُصلح (قب-٢٣/CR-007) — **ديكورٌ لا حارس**.
 *
 * ### الحدودُ ثابتةٌ مُسنَدةٌ لا أرقامٌ في مكانها
 * قيمةُ ٧٥/١٥٠/٤ ليست اجتهادَ هذا الملفّ: هي م-٢/م-٣/م-٥ المشتقّةُ في ADR-002r §١-٣
 * والمعتمدةُ في قب-٢٦/١. ومَن لا يعرف من أين جاء السقفُ لا يستطيع أن يقرّر عند بلوغه.
 */
import { existsSync, readFileSync } from "node:fs"
import { join, isAbsolute } from "node:path"
import { brotliCompressSync, constants as zlibConstants } from "node:zlib"
import { ROOT, fail, pass } from "./_lib.mjs"

/** م-٢/م-٣/م-٥ — ADR-002r §١-٣، معتمدةٌ في قب-٢٦/١. لا رقمَ بلا مسوّغٍ منشور. */
const LIMITS = Object.freeze({
  jsKb: { id: "ع-١", value: 75, whatAr: "جافاسكربت الصفحة الأولى" },
  firstLoadKb: { id: "ع-٢", value: 150, whatAr: "الحمولةُ الأولى كاملةً" },
  requests: { id: "ع-٤", value: 4, whatAr: "طلباتُ الصفحة الأولى" },
})

const BROTLI_QUALITY = 11
const KB = 1024

/**
 * بيانُ الحمولة الأولى — **ما يُنزَّل قبل أول تفاعل**، يكتبه بناءُ الواجهة.
 * يُمرَّر بوسيطٍ أو بـ`MISHKAT_FIRST_LOAD_MANIFEST`، وإلا فالموضعُ المتّفق عليه.
 */
const DEFAULT_MANIFEST = join(ROOT, "build/first-load.manifest.json")
const manifestPath =
  process.argv[2] ?? process.env.MISHKAT_FIRST_LOAD_MANIFEST ?? DEFAULT_MANIFEST

const TITLE = "ميزانيةُ حمولة الواجهة"

if (!existsSync(manifestPath)) {
  fail("G21", TITLE, [
    `لا بيانَ حمولةٍ أولى في: ${manifestPath}`,
    "الحارسُ يحمرّ عند الغموض: بوابةٌ لا تجد ما تقيسه لا تُعلن الخضرة (نظيرُ عطب G13، قب-٢٣).",
    "يكتب هذا البيانَ بناءُ الواجهة، ويحمل: document · styles[] · scripts[].",
  ])
}

let manifest
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
} catch (e) {
  fail("G21", TITLE, [`بيانُ الحمولة غيرُ صالح (${manifestPath}): ${String(e.message)}`])
}

const resolve = (p) => (isAbsolute(p) ? p : join(ROOT, p))

const document = manifest.document
const styles = Array.isArray(manifest.styles) ? manifest.styles : []
const scripts = Array.isArray(manifest.scripts) ? manifest.scripts : []

const shapeViolations = []
if (typeof document !== "string" || document.length === 0) {
  shapeViolations.push("البيانُ بلا `document` — لا صفحةَ أولى تُقاس")
}
if (scripts.length === 0 && styles.length === 0) {
  shapeViolations.push("البيانُ بلا `scripts` ولا `styles` — بيانٌ فارغٌ لا يُحرَس")
}
for (const p of [document, ...styles, ...scripts]) {
  if (typeof p === "string" && p.length > 0 && !existsSync(resolve(p))) {
    shapeViolations.push(`أصلٌ مذكورٌ في البيان وغيرُ موجود: ${p}`)
  }
}
if (shapeViolations.length > 0) fail("G21", TITLE, shapeViolations)

const brotli = (p) =>
  brotliCompressSync(readFileSync(resolve(p)), {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY },
  }).length

const documentBytes = brotli(document)
const styleBytes = styles.reduce((a, p) => a + brotli(p), 0)
const scriptBytes = scripts.reduce((a, p) => a + brotli(p), 0)
const firstLoadBytes = documentBytes + styleBytes + scriptBytes
// المستندُ طلبٌ، وكلُّ ورقةٍ وسكربتٍ طلب. (الخطُّ مُضمَّنٌ في الورقة: صفرُ طلبٍ له — قب-٢٠.)
const requestCount = 1 + styles.length + scripts.length

const kb = (n) => Number((n / KB).toFixed(1))
const violations = []

if (scriptBytes / KB > LIMITS.jsKb.value) {
  violations.push(
    `${LIMITS.jsKb.id} — ${LIMITS.jsKb.whatAr}: ${kb(scriptBytes)} ك.ب brotli > ${LIMITS.jsKb.value} ك.ب (م-٢)`,
  )
}
if (firstLoadBytes / KB > LIMITS.firstLoadKb.value) {
  violations.push(
    `${LIMITS.firstLoadKb.id} — ${LIMITS.firstLoadKb.whatAr}: ${kb(firstLoadBytes)} ك.ب brotli > ${LIMITS.firstLoadKb.value} ك.ب (م-٣)`,
  )
}
if (requestCount > LIMITS.requests.value) {
  violations.push(
    `${LIMITS.requests.id} — ${LIMITS.requests.whatAr}: ${requestCount} > ${LIMITS.requests.value} (م-٥)`,
  )
}

const summary =
  `${manifest.screen ?? "الصفحة الأولى"}` +
  `${manifest.candidate === undefined ? "" : ` · مرشّح ${manifest.candidate}`}` +
  ` · مستند ${kb(documentBytes)} + رموز ${kb(styleBytes)} + سكربت ${kb(scriptBytes)}` +
  ` = ${kb(firstLoadBytes)} ك.ب brotli · ${requestCount} طلبات`

if (violations.length > 0) {
  fail("G21", TITLE, [...violations, summary])
}

pass("G21", TITLE, summary)
