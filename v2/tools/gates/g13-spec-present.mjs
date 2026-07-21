/**
 * G13 — «المواصفة عقدُ الميزة، وتُقاس بالتغطية لا بوقت التعديل» (المادة ١/٣، CR-007/قب-٢٣).
 *
 * **لماذا أُعيد تصميمها**: قياسُها السابق قارن `mtimeMs` للكود بمواصفة وحدته. وgit **لا يحفظ
 * أوقات التعديل**، فنسخةٌ جديدة (clone/checkout) تضع الملفات كلَّها على وقتٍ واحد ⇒ الفارق صفر
 * ⇒ **البوابة خضراء دائماً في البيئة التي تحرسنا فيها فعلاً** = لا حارس. ومحلياً كانت تُرضى
 * بلمسة ملف — فوُلد طقسٌ يُخضِعها بلا كتابة عقد. **الطقس كان دليل العطب** (CR-007 §٢).
 *
 * **القياس الجديد — محتوائيٌّ بحت**: يقرأ محتوى الملفات ولا شيء سواه. لا `mtime` ولا
 * `birthtime` ولا حالةَ جهازٍ ولا ترتيبَ تنفيذ ⇒ **النتيجة نفسها على نسخةٍ جديدة**.
 * تفشل الوحدةُ عند أيٍّ من ثلاثٍ:
 *  ١. **وحدةُ ميزةٍ بلا مواصفة**: مجلدٌ تحت `src/features/` بلا `SPEC.md` (أو أقصرَ من عقد).
 *  ٢. **مواصفةٌ لا تغطّي سطوح وحدتها**: سطحٌ مُعلَنٌ في الكود وغيرُ مذكورٍ نصاً في عقده —
 *     كلُّ دالةِ خادمٍ (`defineServerFn`) باسمها **وقدرتها** · كلُّ شاشةٍ مسجَّلةٍ بمسارها
 *     (نظيرُ معجم G20) · كلُّ قدرةٍ تستهلكها الوحدة من الكتالوج الذهبي.
 *  ٣. **مواصفةٌ بلا إسناد قرار**: لا `قب-` ولا `CR-` ولا مواصفةٌ حاكمة (`SPEC_*`) تستند إليها.
 *
 * **القاعدة الدائمة** (قب-٢٣): تُسأل كل بوابة «هل تعمل في CI حيث لا حالة محلية؟».
 * وتُثبَت بالفشل لا تُدّعى: `npm run gates:prove G13` يزرع المخالفات الثلاث ويتحقق منها.
 */
import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { walk, read, rel, ROOT, fail, pass, stripCommentsOnly } from "./_lib.mjs"

/** حدُّ «أقصر من أن تكون عقداً» — نصٌّ دون هذا سردٌ لا عقد. */
const MIN_SPEC_CHARS = 200

/** كتالوج القدرات المعتمد يُقرأ من المشتقّ الذهبي — لا قائمةَ ثانيةً في البوابة (G5 يحرسه). */
const CAPS_FILE = join(ROOT, "src/authorization/generated/capabilities.generated.ts")
const capsSrc = existsSync(CAPS_FILE) ? read(CAPS_FILE) : ""
// يُقرأ من سجلّ `CAPS` نفسه (مصدرُ `CAP_IDS`) لا من اتحاد `CapId` — فبعده اتحاداتٌ أخرى
// (`CapType`/`CapScopeKind`) كانت قِيَمُها تتسرّب إلى الكتالوج فتُحسب «قدراتٍ» وهماً.
const capsBlock = capsSrc.slice(capsSrc.indexOf("export const CAPS"), capsSrc.indexOf("export const CAP_IDS"))
const CATALOGUE = new Set([...capsBlock.matchAll(/^\s*"([\w.]+)":\s*\{/gm)].map((m) => m[1]))

/**
 * هل ذُكر الرمزُ نصاً في المواصفة؟ — ذكرٌ **بحدٍّ**: `report.approve` لا يُرضيه
 * `report.approve.override`، وإلا لَغطّت قدرةٌ أختَها الأطول وتسلّلت غيرُ مذكورة.
 */
function mentions(spec, token) {
  let from = 0
  for (;;) {
    const at = spec.indexOf(token, from)
    if (at === -1) return false
    const next = spec[at + token.length] ?? ""
    if (!/[\w.\-ء-ي]/.test(next)) return true
    from = at + 1
  }
}

/** إسنادُ القرار: قرارٌ (`قب-`) أو طلبُ تغييرٍ (`CR-`) أو مواصفةٌ حاكمة. */
function hasAttribution(spec) {
  return /قب-\S|CR-\d|SPEC_[A-Za-z_]+|rebuild\/specs\//.test(spec)
}

/**
 * سطوحُ الوحدة **مستخرجةٌ من الكود** (بعد إزالة التعليقات كي لا يُحسب مثالٌ توثيقيٌّ سطحاً):
 * دوالُ الخادم المعلنة · مساراتُ الشاشات المسجَّلة · القدرات المستهلَكة.
 */
function surfacesOf(dir) {
  const serverFns = new Map() // الاسم ⟵ القدرة (أو null للمسار العام المعلن)
  const routes = new Set()
  const capabilities = new Set()

  for (const file of walk(dir)) {
    const code = stripCommentsOnly(read(file))

    for (const block of code.matchAll(/defineServerFn\s*\(\s*\{([\s\S]*?)\n\s*\}\s*\)/g)) {
      const body = block[1]
      const name = /\bname:\s*"([^"]+)"/.exec(body)
      if (name === null) continue
      const cap = /\bcapability:\s*"([^"]+)"/.exec(body)
      serverFns.set(name[1], cap === null ? null : cap[1])
    }

    for (const m of code.matchAll(/\broute:\s*"([^"]+)"/g)) routes.add(m[1])

    for (const m of code.matchAll(/"([\w.]+)"/g)) {
      if (CATALOGUE.has(m[1])) capabilities.add(m[1])
    }
  }
  return { serverFns, routes, capabilities }
}

const featuresDir = join(ROOT, "src/features")
const violations = []
let checkedModules = 0
let checkedSurfaces = 0

if (CATALOGUE.size === 0) {
  violations.push("تعذّرت قراءة كتالوج القدرات المشتقّ — لا قياسَ تغطيةٍ بلا كتالوج")
}

const modules = existsSync(featuresDir)
  ? readdirSync(featuresDir).filter((d) => statSync(join(featuresDir, d)).isDirectory())
  : []

for (const mod of modules) {
  checkedModules++
  const dir = join(featuresDir, mod)
  const specPath = join(dir, "SPEC.md")

  // ── ١) وحدةٌ بلا مواصفة ────────────────────────────────────────────────
  if (!existsSync(specPath)) {
    violations.push(`وحدة الميزة «${mod}» بلا SPEC.md — الميزة بلا عقد (المادة ١/٣)`)
    continue
  }
  const spec = read(specPath)
  if (spec.trim().length < MIN_SPEC_CHARS) {
    violations.push(`مواصفة «${mod}» أقصر من أن تكون عقداً (< ${MIN_SPEC_CHARS} حرف)`)
    continue
  }

  // ── ٢) تغطيةُ السطوح المُعلَنة في الكود ──────────────────────────────────
  const { serverFns, routes, capabilities } = surfacesOf(dir)

  for (const [name, cap] of serverFns) {
    checkedSurfaces++
    if (!mentions(spec, name)) {
      violations.push(
        `${mod}/SPEC.md لا تذكر دالة الخادم المعلنة «${name}» — سطحٌ في الكود خارج عقده`,
      )
    }
    if (cap !== null && !mentions(spec, cap)) {
      violations.push(
        `${mod}/SPEC.md لا تذكر قدرة دالة الخادم «${name}» (${cap}) — الدالة بلا قدرتها في العقد`,
      )
    }
  }

  for (const route of routes) {
    checkedSurfaces++
    if (!mentions(spec, route)) {
      violations.push(`${mod}/SPEC.md لا تذكر شاشةَ المسار «${route}» — شاشةٌ خارج عقد وحدتها`)
    }
  }

  for (const cap of capabilities) {
    checkedSurfaces++
    if (!mentions(spec, cap)) {
      violations.push(`${mod}/SPEC.md لا تذكر القدرة المستهلَكة «${cap}» — قدرةٌ بلا ذكرٍ في العقد`)
    }
  }

  // ── ٣) إسنادُ القرار ────────────────────────────────────────────────────
  if (!hasAttribution(spec)) {
    violations.push(
      `${rel(specPath)} بلا إسنادِ قرارٍ (قب-) أو طلبِ تغييرٍ (CR-) أو مواصفةٍ حاكمة — عقدٌ بلا سند`,
    )
  }
}

if (violations.length) fail("G13", "المواصفة تغطّي سطوح وحدتها وتُسنِد قرارها", violations)
pass(
  "G13",
  "المواصفة تغطّي سطوح وحدتها وتُسنِد قرارها",
  modules.length === 0
    ? "لا وحدة ميزة بعد — البوابة بلا موضوع اليوم"
    : `${checkedModules} وحدة ميزة · ${checkedSurfaces} سطحاً مُعلَناً مُطابَقاً بالمحتوى (صفر mtime)`,
)
