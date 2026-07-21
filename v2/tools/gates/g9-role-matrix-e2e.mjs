/**
 * G9 — E2E مصفوفة الأدوار الكاملة (TESTING_POLICY §٤): ليلياً + قبل كل نشر.
 *
 * الطبقة الأولى (الخادم، ٨٧ قدرة × ١٠ أدوار) في `tests/generated/`.
 * الطبقة الثانية (كل دور × كل شاشة: حضورُ العنصر بعدسة الدور + غيابُه الصريح مقروناً برفض
 * الخادم) **فُعِّلت مع أول شاشة ميزة** (مهمة T4-A) وتعيش في `tests/screens/`. كلُّ وحدةِ
 * ميزةٍ لها `screens/` **يجب** أن تحمل مصفوفةَ شاشاتٍ حارسة — وإلا فالبوابة تفشل.
 *
 * ملاحظة صدق: لا إطار واجهةٍ بعد (ADR مؤجَّل)، فالطبقة الثانية على مستوى نموذج العرض +
 * رفض الخادم — لا متصفحٍ حيّ؛ Playwright يُضاف مع أول إطار، وحتى ذلك الحين هذه هي المفروضة.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { ROOT, fail, pass } from "./_lib.mjs"

function runVitest(dir, label) {
  try {
    execFileSync("npx", ["vitest", "run", dir], { cwd: ROOT, stdio: "pipe" })
  } catch (e) {
    const out = String(e.stdout ?? "") + String(e.stderr ?? "")
    fail("G9", label, out.trim().split("\n").filter((l) => /×|FAIL/.test(l)))
  }
}

// الطبقة الأولى — المصفوفة الذهبية على الخادم.
runVitest("tests/generated", "مصفوفة الأدوار — الطبقة الأولى")
// الطبقة الثانية — مصفوفة الشاشات لكل وحدة ميزة.
runVitest("tests/screens", "مصفوفة الأدوار — الطبقة الثانية (الشاشات)")

// كلُّ وحدة ميزةٍ لها شاشات يجب أن تحمل مصفوفةَ شاشاتٍ غير تافهة تحرسها.
const featuresDir = join(ROOT, "src/features")
const screensTestDir = join(ROOT, "tests/screens")
const mods = existsSync(featuresDir)
  ? readdirSync(featuresDir).filter((d) => statSync(join(featuresDir, d)).isDirectory())
  : []

const missing = []
for (const mod of mods) {
  const screensDir = join(featuresDir, mod, "screens")
  const hasScreens = existsSync(screensDir) && existsSync(join(screensDir, "screens.ts"))
  if (!hasScreens) continue
  const matrix = join(screensTestDir, `${mod}-screen-matrix.test.ts`)
  if (!existsSync(matrix)) {
    missing.push(`وحدة «${mod}» لها شاشات بلا مصفوفة شاشات (${mod}-screen-matrix.test.ts)`)
  } else if (readFileSync(matrix, "utf8").trim().length < 400) {
    missing.push(`مصفوفة شاشات «${mod}» أقصرُ من أن تحرس (< ٤٠٠ حرف)`)
  }
}
if (missing.length) fail("G9", "مصفوفة الأدوار — كل شاشةٍ محروسة", missing)

// شاشةٌ في `src/routes/` خارج شاشتَي الإقلاع بلا مصفوفة ⇒ فشل (يمنع شاشةً بلا حارس).
const routes = readdirSync(join(ROOT, "src/routes")).filter((f) => f.endsWith(".ts"))
const BOOTSTRAP_SCREENS = new Set(["login.ts", "dashboard.ts"])
const beyondBootstrap = routes.filter((s) => !BOOTSTRAP_SCREENS.has(s))
if (beyondBootstrap.length > 0) {
  fail("G9", "مصفوفة الأدوار — شاشةُ مسارٍ بلا مصفوفة", [
    `ظهرت شاشات في src/routes خارج الإقلاع (${beyondBootstrap.join("، ")}) بلا مصفوفة أدوار.`,
    "ضع منطق الشاشة في وحدة الميزة، ولها مصفوفةُ شاشاتٍ في tests/screens (TESTING_POLICY §٤).",
  ])
}

pass("G9", "مصفوفة الأدوار", `الطبقتان فعّالتان · وحدات ذات شاشات: ${mods.length ? mods.join("،") : "—"}`)
