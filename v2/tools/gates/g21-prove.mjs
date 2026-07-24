/**
 * إثباتُ G21 **بالفشل** — قب-١٥: بوابةٌ لا تفشل على مخالفة ليست بوابة بل ديكور.
 *
 * **مستقلٌّ عن `prove-all.mjs` عمداً**: G21 مقترحةٌ لم تُعتمد بعد (ADR-002r ملحق د)، فلا
 * تُدرَج في طقم الإثبات كأخواتها حتى يُدوَّن اعتمادُها. وهذا الملفّ يُشغَّل يدوياً ويُظهر
 * أن الحارسَ يحمرّ فعلاً على كل عتبةٍ يدّعي حراستَها، **وعلى بناءٍ حقيقيٍّ لا زرعٍ مصطنع**
 * حيثما أمكن.
 *
 * التشغيل: `node measure-journal.mjs` (من `experiments/`) ثم `node tools/gates/g21-prove.mjs`
 */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync, mkdtempSync, copyFileSync } from "node:fs"
import { join, basename } from "node:path"
import { tmpdir } from "node:os"
import { ROOT } from "./_lib.mjs"

const GATE = join(ROOT, "tools/gates/g21-ui-load-budget.mjs")
const OUT = process.env.MISHKAT_JOURNAL_OUT ?? join(tmpdir(), "mishkat-t27-journal")

function run(manifestPath) {
  try {
    const out = execFileSync("node", [GATE, ...(manifestPath === null ? [] : [manifestPath])], {
      encoding: "utf8",
      stdio: "pipe",
    })
    return { red: false, output: out.trim() }
  } catch (e) {
    return { red: true, output: `${String(e.stdout ?? "")}${String(e.stderr ?? "")}`.trim() }
  }
}

const manifest = (name) => join(OUT, `site-${name}`, "first-load.manifest.json")

if (!existsSync(manifest("a"))) {
  console.error(
    "لا نواتجَ بناءٍ تُقاس. شغّل أولاً:  cd v2/experiments && node measure-journal.mjs",
  )
  process.exit(2)
}

/** مخالفتا ع-٢/ع-٤ تُصطنعان **ببايتاتٍ حقيقيةٍ من البناء نفسه** لا بملفٍّ مختلَق. */
function syntheticManifest(kind) {
  const dir = mkdtempSync(join(tmpdir(), "mishkat-g21-"))
  const src = JSON.parse(readFileSync(manifest("a"), "utf8"))
  const copy = (p, tag) => {
    const dst = join(dir, `${tag}-${basename(p)}`)
    copyFileSync(p, dst)
    return dst
  }
  const scripts =
    kind === "ع-٤"
      ? [0, 1, 2, 3].map((i) => copy(src.scripts[0], `s${i}`))
      : [0, 1].map((i) => copy(src.scripts[0], `s${i}`))
  const out = {
    screen: src.screen,
    candidate: `زرعٌ لإثبات ${kind}`,
    document: copy(src.document, "doc"),
    styles: src.styles.map((p, i) => copy(p, `c${i}`)),
    scripts,
  }
  const path = join(dir, "first-load.manifest.json")
  writeFileSync(path, JSON.stringify(out, null, 2))
  return path
}

const CASES = [
  {
    what: "غموضٌ: لا بيانَ حمولةٍ أصلاً",
    manifest: null,
    expectRed: true,
    real: true,
  },
  { what: "بناءٌ حقيقيّ (ب) داخلَ الميزانية", manifest: manifest("b"), expectRed: false, real: true },
  {
    what: "بناءٌ حقيقيّ (أ) أرضيةً — داخلَ الميزانية",
    manifest: manifest("a"),
    expectRed: false,
    real: true,
  },
  {
    what: "بناءٌ حقيقيّ (أ+موجّه) — يكسر ع-١ (جافاسكربت > ٧٥ ك.ب)",
    manifest: manifest("a-router"),
    expectRed: true,
    real: true,
  },
  {
    what: "زرعٌ: سكربتان ⟵ يكسر ع-٢ (حمولةٌ أولى > ١٥٠ ك.ب)",
    manifest: syntheticManifest("ع-٢"),
    expectRed: true,
    real: false,
  },
  {
    what: "زرعٌ: أربعةُ سكربتاتٍ ⟵ يكسر ع-٤ (طلباتٌ > ٤)",
    manifest: syntheticManifest("ع-٤"),
    expectRed: true,
    real: false,
  },
]

let failures = 0
for (const c of CASES) {
  const got = run(c.manifest)
  const ok = got.red === c.expectRed
  if (!ok) failures += 1
  const mark = ok ? "✓" : "✗"
  const kind = c.real ? "بناءٌ حقيقيّ" : "زرعٌ ببايتاتٍ حقيقية"
  console.log(`${mark} [${kind}] ${c.what} ⟵ ${got.red ? "أحمر" : "أخضر"} (المتوقَّع: ${c.expectRed ? "أحمر" : "أخضر"})`)
  for (const line of got.output.split("\n")) if (line.trim()) console.log(`      ${line.trim()}`)
}

console.log("")
if (failures > 0) {
  console.error(`✗ إثباتُ G21 فشل في ${failures} حالة`)
  process.exit(1)
}
console.log(`✓ G21 مُثبَتةٌ بالفشل في ${CASES.length} حالة — وتبقى **مقترحةً غيرَ مُدرَجة**`)
