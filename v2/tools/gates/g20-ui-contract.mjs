/**
 * G20 — سياج الواجهة: «لا شاشة بلا عقد · كل عنصرٍ يعلن قدرته · لا دور يرى ما خارج عدسته»
 * (قب-١٧، IA §الحوكمة، SPEC_design_system §٦-١، SPEC_role_lenses §١.٣/§٣).
 *
 * وريثةُ `ui-registry` في v1. تعمل على بُعدين:
 *  **أ) بُعدٌ ساكن** (هذا الملفّ): يفحص المصدرَ نفسه — كلُّ شاشةٍ مسجَّلةٌ في معجم العقود ·
 *     لا قيمةَ بصرية خام خارج مِلفّ الرموز · لا نصَّ عربياً حرفياً خارج طبقة النصوص ·
 *     لا مكوّنَ خارج المكتبة المغلقة.
 *  **ب) بُعدٌ دلاليّ** (`tests/ui`): يبني كلَّ شاشةٍ بحزمة قدرات كل دورٍ حيّ ويحاكمها إلى
 *     المصفوفة الذهبية والعدستين (الجسر ثنائيُّ الاتجاه: لكل قدرةٍ باب، ولا بابَ بلا قدرة).
 *
 * **البوابةُ تُثبَت بالفشل لا تُدّعى** (قب-١٥): `npm run gates:prove G20` يزرع أربع مخالفاتٍ
 * مصطنعة — بُعداً بُعداً — ويتحقق أنها تُفشلها ثم تعود خضراء.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { walk, read, rel, fail, pass, ROOT, stripCommentsOnly } from "./_lib.mjs"

const violations = []

// ── ٠) المكتبةُ والمعجمُ موجودان أصلاً (وإلا فالسياجُ غائبٌ لا أخضر) ─────────────
const KERNEL = join(ROOT, "src/ui/components/kernel.ts")
const REGISTRY = join(ROOT, "src/ui/screens/registry.ts")
const SCREENS_INDEX = join(ROOT, "src/screens.ts")
for (const [path, what] of [
  [KERNEL, "نواة المكتبة (src/ui/components/kernel.ts)"],
  [REGISTRY, "معجم عقود الشاشات (src/ui/screens/registry.ts)"],
  [SCREENS_INDEX, "فهرس تسجيل الشاشات (src/screens.ts)"],
]) {
  if (!existsSync(path)) violations.push(`${what} غير موجود — لا سياجَ واجهةٍ بلا معجمه`)
}
if (violations.length) fail("G20", "سياج الواجهة", violations)

// معرّفات المكتبة المغلقة تُقرأ من النواة نفسها (مصدرٌ واحد — لا قائمةٌ ثانيةٌ في البوابة).
const kernelSrc = read(KERNEL)
const registryBlock = kernelSrc.slice(
  kernelSrc.indexOf("export const COMPONENTS"),
  kernelSrc.indexOf("export const COMPONENT_IDS"),
)
const LIBRARY = new Set([...registryBlock.matchAll(/^\s{2}(\w+): contract\(\{/gm)].map((m) => m[1]))
if (LIBRARY.size === 0) violations.push("تعذّرت قراءة سجل المكوّنات من النواة")

// ── ١) لا شاشة بلا عقد (ق-١١٣: قائمةُ LEGACY فارغةٌ وتبقى فارغة) ──────────────
const featuresDir = join(ROOT, "src/features")
const modules = existsSync(featuresDir)
  ? readdirSync(featuresDir).filter((d) => statSync(join(featuresDir, d)).isDirectory())
  : []

let screenFiles = 0
let contracts = 0
for (const mod of modules) {
  const screensDir = join(featuresDir, mod, "screens")
  if (!existsSync(screensDir)) continue
  for (const file of walk(screensDir)) {
    const src = read(file)
    const code = stripCommentsOnly(src)
    const exported = [...code.matchAll(/export function (\w+Screen(?:Nodes)?)\s*\(/g)].map((m) => m[1])
    if (exported.length === 0) continue
    screenFiles += 1
    const registered = [...code.matchAll(/registerScreen\s*\(/g)].length
    contracts += registered
    if (registered === 0) {
      violations.push(
        `${rel(file)} — شاشةٌ بلا عقدٍ مسجَّل (${exported.join("، ")}): registerScreen غائب (ق-١١٣)`,
      )
    }
    if (!read(SCREENS_INDEX).includes(`features/${mod}/screens/`)) {
      violations.push(`وحدة «${mod}» لها شاشاتٌ لا تصل من فهرس التسجيل src/screens.ts`)
    }
  }
}

// ── ٢) لا قيمة بصرية خام خارج مِلفّ الرموز (§١-٩ — نظيرُ G14 للأرقام التشغيلية) ──
// المسحُ على طبقة الواجهة وحدها؛ ومِلفّ الرموز مستثنىً بحكم التعريف (فيه تعيش القيم).
const UI_SCANNED = ["src/ui/components/", "src/ui/shell/", "src/ui/screens/"]
const RAW_VALUE_PATTERNS = [
  [/#[0-9a-fA-F]{3,8}\b/, "لونٌ سداسيٌّ خام"],
  [/\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|ms|s)\b/, "قياسٌ بوحدةٍ خام"],
  [/\brgba?\s*\(/, "لونٌ خام (rgb)"],
]
for (const file of walk(join(ROOT, "src"))) {
  const r = rel(file)
  const inUi = UI_SCANNED.some((p) => r.startsWith(p))
  const inScreens = /^src\/features\/[^/]+\/screens\//.test(r)
  if (!inUi && !inScreens) continue
  const code = stripCommentsOnly(read(file))
  code.split("\n").forEach((line, i) => {
    for (const [re, what] of RAW_VALUE_PATTERNS) {
      if (re.test(line)) {
        violations.push(`${r}:${i + 1} — ${what} خارج مِلفّ الرموز (§١-٩): كل قيمةٍ بصرية رمزٌ مسمّى`)
      }
    }
  })
}

// ── ٣) لا نصَّ عربياً حرفياً خارج طبقة النصوص (§٥-٣) ─────────────────────────
// المفحوص: **ما يُصيَّر** (بناةُ المكوّنات · القشرة · شاشات الميزات) — فهناك يتسرّب النصّ
// للمستخدم. المستثنى صراحةً: (أ) رسائلُ الأخطاء البرمجية (`throw new Error`) فمخاطبتُها
// للمطوّر، (ب) **كتالوجاتُ العقود** (سجل المكوّنات، تصنيف الكيانات، جدول الغياب، مُحقِّق
// العقد) فعربيّتُها **توثيقُ عقدٍ** لا نصَّ شاشةٍ — ولا تصل مستخدماً أبداً.
const ARABIC = /[؀-ۿ]/
const TEXT_SCANNED = ["src/ui/components/", "src/ui/shell/"]
const CONTRACT_CATALOGUES = ["src/ui/components/kernel.ts", "src/ui/components/limits.ts"]
for (const file of walk(join(ROOT, "src"))) {
  const r = rel(file)
  const inUi = TEXT_SCANNED.some((p) => r.startsWith(p)) && !CONTRACT_CATALOGUES.includes(r)
  const inScreens = /^src\/features\/[^/]+\/screens\//.test(r)
  if (!inUi && !inScreens) continue
  // تُزال كتلُ `throw new Error(...)` بكاملها (قد تمتدّ أسطراً) مع حفظ ترقيم الأسطر.
  const code = stripCommentsOnly(read(file)).replace(/throw new Error\([\s\S]*?\)\n/g, (m) =>
    "\n".repeat((m.match(/\n/g) ?? []).length),
  )
  code.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/"([^"\\]*)"|'([^'\\]*)'/g)) {
      const literal = m[1] ?? m[2] ?? ""
      if (ARABIC.test(literal)) {
        violations.push(
          `${r}:${i + 1} — نصٌّ عربيٌّ حرفيّ «${literal}» خارج طبقة النصوص (§٥-٣): المكوّنُ يستقبل مفتاحاً لا حرفاً`,
        )
      }
    }
  })
}

// ── ٤) لا مكوّنَ خارج المكتبة المغلقة (§٢/§٦-١) ─────────────────────────────
for (const file of walk(join(ROOT, "src"))) {
  const r = rel(file)
  if (r === "src/ui/components/kernel.ts") continue
  const code = stripCommentsOnly(read(file))
  code.split("\n").forEach((line, i) => {
    const m = /component:\s*"(\w+)"/.exec(line)
    if (m && !LIBRARY.has(m[1])) {
      violations.push(`${r}:${i + 1} — مكوّنٌ خارج المكتبة: «${m[1]}» (المكتبة مغلقة — §٦-١)`)
    }
  })
}

if (violations.length) fail("G20", "سياج الواجهة (عقد الشاشة والمكتبة والرموز والنصوص)", violations)

// ── ٥) البُعد الدلاليّ: الشاشات تُحاكَم إلى المصفوفة والعدسات ─────────────────
try {
  execFileSync("npx", ["vitest", "run", "tests/ui"], { cwd: ROOT, stdio: "pipe" })
} catch (e) {
  const out = String(e.stdout ?? "") + String(e.stderr ?? "")
  fail(
    "G20",
    "سياج الواجهة — محاكمةُ الشاشات إلى العدسات والمصفوفة",
    out.trim().split("\n").filter((l) => /×|FAIL|AssertionError/.test(l)).slice(0, 12),
  )
}

pass(
  "G20",
  "سياج الواجهة",
  `عقودٌ مسجَّلة: ${contracts} في ${screenFiles} مِلفّ شاشات · مكوّنات المكتبة: ${LIBRARY.size}`,
)
