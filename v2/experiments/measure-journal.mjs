/* global process, console, performance, Buffer, Request */
/**
 * القياسُ الثاني — **الشاشة الحاسمة** `/finance/journal/new` (مهمة T27 · ADR-002r §٥-١/٣).
 *
 * نفسُ منهج `measure.mjs` حرفياً (vite build · esbuild · gzip 9 · brotli 11 · إصداراتٌ مثبّتة)
 * مطبَّقاً على أثقلِ شاشةٍ تفاعلاً بدل شاشة العرض. الفارقُ الوحيد أن **طبقة التفاعل** هنا
 * حقيقية: أسطرٌ تُضاف وتُحذف، وحسابٌ حيٌّ لكل عملة، وأربعُ طبقات تحقّق.
 *
 * التشغيل:  `node measure-journal.mjs`  من `v2/experiments/`
 * المخرَج:  `results/journal-bytes.json` + بيانَا حمولةٍ لبوابة G21 + موقعَا قياسٍ للمتصفح.
 */

import { createRequire } from "node:module"
import { pathToFileURL, fileURLToPath } from "node:url"
import { dirname, join, basename } from "node:path"
import { mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"
import { gzipSync, brotliCompressSync, constants as zlibConstants } from "node:zlib"
import { tmpdir } from "node:os"

const HERE = dirname(fileURLToPath(import.meta.url))
const V2 = join(HERE, "..")
const OUT = process.env.MISHKAT_JOURNAL_OUT ?? join(tmpdir(), "mishkat-t27-journal")

const GZIP_LEVEL = 9
const BROTLI_QUALITY = 11

function sizes(buf) {
  return {
    raw: buf.length,
    gzip: gzipSync(buf, { level: GZIP_LEVEL }).length,
    brotli: brotliCompressSync(buf, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY },
    }).length,
  }
}

function sumSizes(list) {
  return list.reduce(
    (a, s) => ({ raw: a.raw + s.raw, gzip: a.gzip + s.gzip, brotli: a.brotli + s.brotli }),
    { raw: 0, gzip: 0, brotli: 0 },
  )
}

function loadFrom(dir, spec) {
  const require = createRequire(join(dir, "package.json"))
  return import(pathToFileURL(require.resolve(spec)).href)
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

/** الوسيطُ لا المتوسّط — القياسُ الزمنيّ يحتمل شواذَّ الجدولة. */
function medianMs(fn, runs) {
  const s = []
  for (let i = 0; i < runs; i += 1) {
    const t0 = performance.now()
    fn()
    s.push(performance.now() - t0)
  }
  s.sort((a, b) => a - b)
  return Number(s[Math.floor(s.length / 2)].toFixed(4))
}

/**
 * أسطرُ الكود المفيدة في **طبقة التفاعل وحدها** — بلا تعليقٍ ولا سطرٍ فارغ.
 * هذا **أقربُ بديلٍ قابلٍ للقياس** عن «كلفة الهندسة» التي عدّها ADR-002r ملحق ج/٦ غيرَ
 * مقيسة. وهو **بديلٌ لا مقياسٌ تامّ** — يُقال بصفته (تقريرُ T27، ما لم يُقس).
 */
function usefulLines(path) {
  const src = readFileSync(path, "utf8")
  let inBlock = false
  let count = 0
  for (const raw of src.split("\n")) {
    const line = raw.trim()
    if (inBlock) {
      if (line.includes("*/")) inBlock = false
      continue
    }
    if (line.startsWith("/*")) {
      if (!line.includes("*/")) inBlock = true
      continue
    }
    if (line.length === 0 || line.startsWith("//")) continue
    count += 1
  }
  return count
}

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
      rollupOptions: {
        input: entry,
        output: { entryFileNames: "[name].js", chunkFileNames: "[name].js" },
      },
    },
  })
  return listBundles(outDir)
}

async function buildSsr({ vite, dir, entry, outDir, plugins = [] }) {
  await vite.build({
    ...SHARED_BUILD,
    root: dir,
    plugins,
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

const viteA = await loadFrom(A_DIR, "vite")
const viteB = await loadFrom(B_DIR, "vite")
const reactPlugin = (await loadFrom(A_DIR, "@vitejs/plugin-react")).default

console.log("… بناء (أ) على الشاشة الحاسمة: React 19 + حالةٌ + ترطيب")
const aClient = await buildClient({
  vite: viteA,
  dir: A_DIR,
  entry: join(A_DIR, "entry-client-journal.tsx"),
  outDir: join(OUT, "a-client"),
  plugins: [reactPlugin()],
})

console.log("… بناء (أ+موجّه) على الشاشة الحاسمة: الشكلُ الواقعيّ للخيار (أ)")
const aRouterClient = await buildClient({
  vite: viteA,
  dir: A_DIR,
  entry: join(A_DIR, "entry-client-journal-router.tsx"),
  outDir: join(OUT, "a-router-client"),
  plugins: [reactPlugin()],
})

console.log("… بناء خادم (أ): react-dom/server")
const aServer = await buildSsr({
  vite: viteA,
  dir: A_DIR,
  entry: join(A_DIR, "entry-server-journal.tsx"),
  outDir: join(OUT, "a-server"),
  plugins: [reactPlugin()],
})

console.log("… بناء (ب) على الشاشة الحاسمة: جزيرةٌ أمريّةٌ تُرقّع")
const bIsland = await buildClient({
  vite: viteB,
  dir: B_DIR,
  entry: join(B_DIR, "journal-island.ts"),
  outDir: join(OUT, "b-island"),
})

console.log("… بناء خادم (ب): Hono")
const bServer = await buildSsr({
  vite: viteB,
  dir: B_DIR,
  entry: join(B_DIR, "journal-server.ts"),
  outDir: join(OUT, "b-server"),
})

const aRender = await import(
  pathToFileURL(aServer.find((f) => basename(f) === "entry-server-journal.js")).href
)
const htmlA = aRender.renderPage('<script type="module" src="entry-client-journal.js"></script>')

const bMod = await import(pathToFileURL(bServer.find((f) => basename(f) === "journal-server.js")).href)
const htmlB = await (await bMod.default.fetch(new Request("http://measure.local/"))).text()

// ورقةُ الرموز — أصلٌ مشتركٌ يُنسخ كما هو من الشجرة.
const cssBuf = readFileSync(join(V2, "src/ui/tokens/tokens.generated.css"))
const cssSizes = sizes(cssBuf)

// ── حجمُ حمولة الطابور (ت-٨ · `SPEC_finance_ledger` §٩-٤) ────────────────────
const probeOut = await buildSsr({
  vite: viteB,
  dir: B_DIR,
  entry: join(HERE, "shared/journal-probe.ts"),
  outDir: join(OUT, "probe"),
})
const probe = await import(
  pathToFileURL(probeOut.find((f) => basename(f) === "journal-probe.js")).href
)
const treeFacts = probe.journalFacts()

// ── التجميع ─────────────────────────────────────────────────────────────────

const report = (name, files) => files.map((f) => ({ file: basename(f), ...sizes(readFileSync(f)) }))

const htmlARouter = aRender.renderPage(
  '<script type="module" src="entry-client-journal-router.js"></script>',
)

const variants = {
  "أ React 19 + حالةٌ وإعادةُ تصيير": { html: sizes(Buffer.from(htmlA, "utf8")), js: report("a", aClient) },
  "أ+موجّه (الشكلُ الواقعيّ)": {
    html: sizes(Buffer.from(htmlARouter, "utf8")),
    js: report("ar", aRouterClient),
  },
  "ب Hono + جزيرةٌ أمريّة": { html: sizes(Buffer.from(htmlB, "utf8")), js: report("b", bIsland) },
}
for (const v of Object.values(variants)) {
  v.jsTotal = sumSizes(v.js)
  v.css = cssSizes
  v.firstLoad = sumSizes([v.html, v.jsTotal, cssSizes])
  v.requests = 1 + 1 + v.js.length // مستند + ورقةُ رموز + سكربتات (الخطّ مُضمَّن: صفر طلب)
}

const serverBundles = {
  "أ react-dom/server": sumSizes(report("as", aServer)),
  "ب Hono": sumSizes(report("bs", bServer)),
}

const RENDER_RUNS = 200
const serverRenderMs = {
  "أ react-dom/server": medianMs(() => aRender.renderPage(""), RENDER_RUNS),
  "ب سلسلة HTML": medianMs(() => bMod.renderPage(""), RENDER_RUNS),
}

const interactionLayer = {
  "أ candidate-a/journal-app.tsx": usefulLines(join(A_DIR, "journal-app.tsx")),
  "ب candidate-b/journal-island.ts": usefulLines(join(B_DIR, "journal-island.ts")),
  مشترك: {
    "shared/journal-model.ts": usefulLines(join(HERE, "shared/journal-model.ts")),
    "shared/journal-tree.ts": usefulLines(join(HERE, "shared/journal-tree.ts")),
  },
}

// ── مواقعُ القياس في متصفّحٍ حقيقيّ + بيانَا الحمولة لبوابة G21 ──────────────
function emitSite(name, html, bundles) {
  const dir = join(OUT, `site-${name}`)
  mkdirSync(dir, { recursive: true })
  const docPath = join(dir, "index.html")
  writeFileSync(docPath, html)
  writeFileSync(join(dir, "tokens.css"), cssBuf)
  writeFileSync(
    join(dir, "manifest.webmanifest"),
    '{"name":"مشكاة","start_url":"/","display":"standalone"}',
  )
  const scripts = bundles.map((f) => {
    writeFileSync(join(dir, basename(f)), readFileSync(f))
    return join(dir, basename(f))
  })
  // بيانُ الحمولة الأولى: **ما يُنزَّل قبل أول تفاعل** — مدخلُ G21 (ADR-002r §٥-٤/١).
  writeFileSync(
    join(dir, "first-load.manifest.json"),
    `${JSON.stringify(
      {
        screen: "/finance/journal/new",
        candidate: name,
        document: docPath,
        styles: [join(dir, "tokens.css")],
        scripts,
      },
      null,
      2,
    )}\n`,
  )
  return join(dir, "first-load.manifest.json")
}

const manifests = {
  أ: emitSite("a", htmlA, aClient),
  "أ+موجّه": emitSite("a-router", htmlARouter, aRouterClient),
  ب: emitSite("b", htmlB, bIsland),
}

const stripScripts = (s) => s.replace(/<script[^>]*><\/script>/g, "")

/**
 * تسويةٌ دلاليّة قبل المقارنة: `react-dom/server` يُرتّب السماتِ بترتيبه ويكتب السمةَ
 * المنطقية `required=""` ويغلق الوسمَ الفارغ بـ`/>`؛ ومُصيِّرُ السلسلة يكتبها `required="true"`
 * ويغلق بـ`>`. **فرقُ تسلسلٍ لا فرقُ مستند** — ويُثبَت هنا بالتسوية لا بالدعوى.
 */
function normalizeDoc(html) {
  return stripScripts(html)
    .replace(/<([a-z]+)((?:\s+[a-z-]+(?::[^\s"=]+)?="[^"]*")*)\s*\/?>/g, (_m, tag, attrs) => {
      const pairs = [...attrs.matchAll(/([a-z-]+(?::[^\s"=]+)?)="([^"]*)"/g)]
        .map(([, k, v]) => `${k}="${v === "" ? "true" : v}"`)
        .sort()
      return `<${tag}${pairs.length ? ` ${pairs.join(" ")}` : ""}>`
    })
}

const out = {
  method: {
    tool: "vite build (esbuild minify)، mode=production، target=es2022، sourcemap=false",
    gzip: `zlib.gzipSync level=${GZIP_LEVEL}`,
    brotli: `zlib.brotliCompressSync quality=${BROTLI_QUALITY}`,
    screen: "‏/finance/journal/new — قب-٢٦ · SPEC_finance_ledger §٩",
    sharedByBoth:
      "shared/journal-tree.ts · shared/journal-model.ts · shared/mapping.ts · shared/page.ts · shared/outbox.ts",
    note: "الخطّ مُضمَّن data: داخل ورقة الرموز ⟵ صفر طلب شبكيّ له (قب-٢٠).",
  },
  tree: treeFacts,
  css: cssSizes,
  variants,
  serverBundles,
  serverRenderMs,
  interactionLayer,
  manifests,
  domIdentical: {
    /** بايتاً ببايت — يُتوقَّع **لا**، والسببُ مُقاسٌ أدناه لا مُدَّعى. */
    aVsBBytes: stripScripts(htmlA) === stripScripts(htmlB),
    /** بعد تسوية ترتيب السمات والسمة المنطقية وإغلاق الوسم الفارغ. */
    aVsBNormalized: normalizeDoc(htmlA) === normalizeDoc(htmlB),
    htmlBytesA: Buffer.byteLength(htmlA, "utf8"),
    htmlBytesB: Buffer.byteLength(htmlB, "utf8"),
    deltaBytes: Buffer.byteLength(htmlB, "utf8") - Buffer.byteLength(htmlA, "utf8"),
  },
  outDir: OUT,
}

mkdirSync(join(HERE, "results"), { recursive: true })
writeFileSync(join(HERE, "results/journal-bytes.json"), `${JSON.stringify(out, null, 2)}\n`)
console.log(`✓ النتائج: results/journal-bytes.json · ناتج البناء: ${OUT}`)
