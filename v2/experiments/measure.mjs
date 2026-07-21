/* global process, console, performance, Buffer, Request */
/**
 * منهجُ القياس المُعاد تشغيله — مهمة T6 §٢ (ADR-002r).
 *
 * يبني المرشّحَين من **نفس شجرة العرض** (`shared/tree.ts`) بإصداراتٍ مثبّتة، ثم يقيس:
 * الحمولة الأولى (خام/gzip/brotli) · عدد الطلبات · حجم شجرة التبعيات · حجم حزمة الخادم.
 *
 * التشغيل:  `node measure.mjs`  من `v2/experiments/`
 * المخرَج:  `results/results.json` (وناتجُ البناء في مجلدٍ مؤقت خارج الشجرة كي لا يدخل
 *           ملفٌّ مبنيٌّ بوابةَ eslint؛ يُضبط بـ`MISHKAT_EXP_OUT`).
 *
 * **حتميّة**: لا تاريخَ ولا عشوائية في الناتج المقيس؛ إعادةُ التشغيل تعطي البايتات نفسها.
 */

import { createRequire } from "node:module"
import { pathToFileURL, fileURLToPath } from "node:url"
import { dirname, join, basename } from "node:path"
import { mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"
import { gzipSync, brotliCompressSync, constants as zlibConstants } from "node:zlib"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"

const HERE = dirname(fileURLToPath(import.meta.url))
const V2 = join(HERE, "..")
const OUT = process.env.MISHKAT_EXP_OUT ?? join(tmpdir(), "mishkat-adr002r")

const GZIP_LEVEL = 9
const BROTLI_QUALITY = 11

// ── أدوات القياس ────────────────────────────────────────────────────────────

function sizes(buf) {
  const raw = buf.length
  const gzip = gzipSync(buf, { level: GZIP_LEVEL }).length
  const brotli = brotliCompressSync(buf, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY },
  }).length
  return { raw, gzip, brotli }
}

function sizeOfFile(path) {
  return sizes(readFileSync(path))
}

function sumSizes(list) {
  return list.reduce(
    (acc, s) => ({ raw: acc.raw + s.raw, gzip: acc.gzip + s.gzip, brotli: acc.brotli + s.brotli }),
    { raw: 0, gzip: 0, brotli: 0 },
  )
}

function loadVite(candidateDir) {
  const require = createRequire(join(candidateDir, "package.json"))
  return import(pathToFileURL(require.resolve("vite")).href)
}

function loadReactPlugin(candidateDir) {
  const require = createRequire(join(candidateDir, "package.json"))
  return import(pathToFileURL(require.resolve("@vitejs/plugin-react")).href)
}

function dirSizeKb(dir) {
  const out = execFileSync("du", ["-sk", dir], { encoding: "utf8" })
  return Number.parseInt(out.split("\t")[0], 10)
}

function packageCount(dir, omitDev) {
  const args = ["ls", "--all", "--parseable", omitDev ? "--omit=dev" : "--include=dev"]
  const out = execFileSync("npm", args, { cwd: dir, encoding: "utf8" })
  return out.trim().split("\n").filter((l) => l.includes("node_modules")).length
}

/** الوسيطُ لا المتوسّط: القياسُ الزمنيّ يحتمل شواذَّ الجدولة. */
function medianMs(fn, runs) {
  const samples = []
  for (let i = 0; i < runs; i += 1) {
    const t0 = performance.now()
    fn()
    samples.push(performance.now() - t0)
  }
  samples.sort((a, b) => a - b)
  return Number(samples[Math.floor(samples.length / 2)].toFixed(3))
}

function installedVersions(dir) {
  const out = execFileSync("npm", ["ls", "--depth=0", "--json"], { cwd: dir, encoding: "utf8" })
  const tree = JSON.parse(out)
  const deps = { ...(tree.dependencies ?? {}) }
  return Object.fromEntries(Object.entries(deps).map(([k, v]) => [k, v.version]))
}

function listBundles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...listBundles(full))
    else if (name.endsWith(".js")) out.push(full)
  }
  return out
}

// ── البناء ──────────────────────────────────────────────────────────────────

const SHARED_BUILD = {
  mode: "production",
  logLevel: "warn",
  build: {
    target: "es2022",
    minify: "esbuild",
    sourcemap: false,
    cssCodeSplit: false,
    reportCompressedSize: false,
    modulePreload: { polyfill: false },
  },
}

async function buildClient({ vite, dir, entry, outDir, plugins = [] }) {
  await vite.build({
    ...SHARED_BUILD,
    root: dir,
    plugins,
    build: {
      ...SHARED_BUILD.build,
      outDir,
      emptyOutDir: true,
      rollupOptions: { input: entry, output: { entryFileNames: "[name].js", chunkFileNames: "[name].js" } },
    },
  })
  return listBundles(outDir)
}

async function buildSsr({ vite, dir, entry, outDir, plugins = [] }) {
  await vite.build({
    ...SHARED_BUILD,
    root: dir,
    plugins,
    // حزمةُ الخادم **مبنيّةٌ بالكامل** (noExternal): هكذا تُنشر على Workers فعلاً،
    // وهكذا يصير رقمُها قابلاً للمقارنة بين المرشّحَين.
    ssr: { noExternal: true },
    build: {
      ...SHARED_BUILD.build,
      outDir,
      emptyOutDir: true,
      ssr: entry,
      rollupOptions: { output: { entryFileNames: "[name].js", chunkFileNames: "[name].js" } },
    },
  })
  return listBundles(outDir)
}

// ── التنفيذ ─────────────────────────────────────────────────────────────────

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const A_DIR = join(HERE, "candidate-a")
const B_DIR = join(HERE, "candidate-b")

const viteA = await loadVite(A_DIR)
const viteB = await loadVite(B_DIR)
const reactPlugin = (await loadReactPlugin(A_DIR)).default

console.log("… بناء المرشّح (أ-١): React 19 + ترطيب")
const a1 = await buildClient({
  vite: viteA,
  dir: A_DIR,
  entry: join(A_DIR, "entry-client.tsx"),
  outDir: join(OUT, "a1-client"),
  plugins: [reactPlugin()],
})

console.log("… بناء المرشّح (أ-٢): + موجّه TanStack Router")
const a2 = await buildClient({
  vite: viteA,
  dir: A_DIR,
  entry: join(A_DIR, "entry-client-router.tsx"),
  outDir: join(OUT, "a2-client"),
  plugins: [reactPlugin()],
})

console.log("… بناء خادم المرشّح (أ): react-dom/server")
const aServer = await buildSsr({
  vite: viteA,
  dir: A_DIR,
  entry: join(A_DIR, "entry-server.tsx"),
  outDir: join(OUT, "a-server"),
  plugins: [reactPlugin()],
})

console.log("… بناء المرشّح (ب): جزيرةٌ واحدة")
const bIsland = await buildClient({
  vite: viteB,
  dir: B_DIR,
  entry: join(B_DIR, "island.ts"),
  outDir: join(OUT, "b-island"),
})

console.log("… بناء خادم المرشّح (ب): Hono")
const bServer = await buildSsr({
  vite: viteB,
  dir: B_DIR,
  entry: join(B_DIR, "server.ts"),
  outDir: join(OUT, "b-server"),
})

// صفحتا HTML من الخادمَين — نفس الشجرة، فيُقارَن المستندان حرفياً.
const aRender = await import(pathToFileURL(aServer.find((f) => basename(f) === "entry-server.js")).href)
const htmlA1 = aRender.renderPage('<script type="module" src="entry-client.js"></script>')
const htmlA2 = aRender.renderPage('<script type="module" src="entry-client-router.js"></script>')

const bMod = await import(pathToFileURL(bServer.find((f) => basename(f) === "server.js")).href)
const bRenderPage = bMod.renderPage
const htmlB = await (await bMod.default.fetch(new Request("http://measure.local/"))).text()

// ورقةُ الرموز — أصلٌ مشترك بين المرشّحَين (تُنسخ كما هي من الشجرة).
const cssPath = join(V2, "src/ui/tokens/tokens.generated.css")
const cssBuf = readFileSync(cssPath)
writeFileSync(join(OUT, "tokens.css"), cssBuf)
const cssSizes = sizes(cssBuf)

// ── §١: أرقامُ السياج القائم ────────────────────────────────────────────────

const treeMod = await import(
  pathToFileURL(
    (
      await buildSsr({
        vite: viteB,
        dir: B_DIR,
        entry: join(HERE, "shared/tree-probe.ts"),
        outDir: join(OUT, "probe"),
      })
    ).find((f) => basename(f) === "tree-probe.js"),
  ).href
)

const fence = { ...treeMod.fenceFacts(), ...treeMod.offlinePrecacheFacts() }

// ── التجميع ─────────────────────────────────────────────────────────────────

function bundleReport(files) {
  return files.map((f) => ({ file: basename(f), ...sizeOfFile(f) }))
}

const a1Js = bundleReport(a1)
const a2Js = bundleReport(a2)
const bJs = bundleReport(bIsland)

const variants = {
  "أ-١ React 19 + ترطيب": {
    html: sizes(Buffer.from(htmlA1, "utf8")),
    js: a1Js,
    jsTotal: sumSizes(a1Js),
  },
  "أ-٢ React 19 + TanStack Router": {
    html: sizes(Buffer.from(htmlA2, "utf8")),
    js: a2Js,
    jsTotal: sumSizes(a2Js),
  },
  "ب Hono + جزيرة": {
    html: sizes(Buffer.from(htmlB, "utf8")),
    js: bJs,
    jsTotal: sumSizes(bJs),
  },
}

for (const v of Object.values(variants)) {
  v.css = cssSizes
  v.firstLoad = sumSizes([v.html, v.jsTotal, cssSizes])
  v.requests = 1 + 1 + v.js.length // مستند + ورقة رموز + ملفات سكربت (الخط مُضمَّن: صفر طلب)
}

const deps = {
  "candidate-a": {
    runtimePackages: packageCount(A_DIR, true),
    totalInstalledPackages: packageCount(A_DIR, false),
    nodeModulesKb: dirSizeKb(join(A_DIR, "node_modules")),
    versions: installedVersions(A_DIR),
  },
  "candidate-b": {
    runtimePackages: packageCount(B_DIR, true),
    totalInstalledPackages: packageCount(B_DIR, false),
    nodeModulesKb: dirSizeKb(join(B_DIR, "node_modules")),
    versions: installedVersions(B_DIR),
  },
}

// زمنُ التصيير على الخادم — كلفةُ وحدةِ المعالجة في Worker لكل طلب (وسيطُ ٢٠٠ تشغيلة).
const RENDER_RUNS = 200
const serverRenderMs = {
  "أ react-dom/server": medianMs(() => aRender.renderPage(""), RENDER_RUNS),
  "ب سلسلة HTML": medianMs(() => bRenderPage(""), RENDER_RUNS),
}

// ورقةُ الرموز بلا الخطّ المُضمَّن — لفصل حمولة الهوية عن حمولة النظام.
const cssNoFont = Buffer.from(
  cssBuf.toString("utf8").replace(/src: url\(data:font\/woff2;base64,[^)]*\)/, "src: url(#)"),
  "utf8",
)
const cssSizesNoFont = sizes(cssNoFont)

const serverBundles = {
  "أ react-dom/server": sumSizes(bundleReport(aServer).map(({ raw, gzip, brotli }) => ({ raw, gzip, brotli }))),
  "ب Hono": sumSizes(bundleReport(bServer).map(({ raw, gzip, brotli }) => ({ raw, gzip, brotli }))),
}

// ── مواقعُ ثابتةٌ للقياس في متصفحٍ حقيقيّ (زمنُ التحليل والتنفيذ) ────────────
function emitSite(name, html, bundles) {
  const dir = join(OUT, `site-${name}`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "index.html"), html)
  writeFileSync(join(dir, "tokens.css"), cssBuf)
  writeFileSync(join(dir, "manifest.webmanifest"), '{"name":"مشكاة","start_url":"/","display":"standalone"}')
  for (const f of bundles) writeFileSync(join(dir, basename(f)), readFileSync(f))
}
emitSite("a1", htmlA1, a1)
emitSite("a2", htmlA2, a2)
emitSite("b", htmlB, bIsland)

const report = {
  method: {
    tool: "vite build (esbuild minify)، mode=production، target=es2022، sourcemap=false",
    gzip: `zlib.gzipSync level=${GZIP_LEVEL}`,
    brotli: `zlib.brotliCompressSync quality=${BROTLI_QUALITY}`,
    screen: "رئيسية أمير المسجد — src/features/home/screens/screens.ts بقدرات الدور amir",
    sharedByBoth: "shared/tree.ts · shared/mapping.ts · shared/page.ts · shared/outbox.ts",
    note: "الخطّ مُضمَّن data: داخل ورقة الرموز ⟵ صفر طلب شبكيّ له (قب-٢٠).",
  },
  fence,
  css: cssSizes,
  cssWithoutEmbeddedFont: cssSizesNoFont,
  variants,
  serverBundles,
  serverRenderMs,
  deps,
  domIdentical: {
    a1VsB: htmlA1.replace(/<script[^>]*><\/script>/g, "") === htmlB.replace(/<script[^>]*><\/script>/g, ""),
    htmlBodyBytesA1: Buffer.byteLength(htmlA1, "utf8"),
    htmlBodyBytesB: Buffer.byteLength(htmlB, "utf8"),
  },
}

mkdirSync(join(HERE, "results"), { recursive: true })
writeFileSync(join(HERE, "results/results.json"), `${JSON.stringify(report, null, 2)}\n`)
console.log(`✓ النتائج: results/results.json · ناتج البناء: ${OUT}`)
