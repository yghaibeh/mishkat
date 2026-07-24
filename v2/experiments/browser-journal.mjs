/* global process, console, WebSocket, fetch, URL, setTimeout */
/**
 * القياسُ في متصفّحٍ حقيقيّ **على شبكةٍ مخنوقةٍ فعلاً** — مهمة T27/٢.
 *
 * ADR-002r **اشتقّ** زمنَ التفاعل من البايتات بصيغةٍ معلنة (ملحق أ-٣) ولم يخنق شبكةً قط
 * (ملحق ج/٢). هنا يُقاس بالقيادة: Chromium حقيقيّ، و`Network.emulateNetworkConditions`
 * يفرض نطاقَ السيناريو وذهابَه وإيابَه، و`Emulation.setCPUThrottlingRate` يفرض بطءَ الجهاز
 * الذي كان **افتراضاً معلناً** (ع-٦: أضعفُ رقمٍ في تلك الوثيقة).
 *
 * **ما يزال غيرَ مقيس**: جهازٌ ميدانيٌّ حقيقيّ وشبكةٌ حقيقية. خنقُ المتصفّح **محاكاةٌ
 * مضبوطةٌ لا ميدان** — يُقال ولا يُطوى (تقرير T27، ما لم يُقس).
 *
 * التشغيل: `node browser-journal.mjs` بعد `node measure-journal.mjs`.
 * المخرَج: `results/journal-browser.json`
 */

import { createServer } from "node:http"
import { spawn } from "node:child_process"
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join, extname, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { tmpdir } from "node:os"
import { brotliCompressSync, constants as zlibConstants } from "node:zlib"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.MISHKAT_JOURNAL_OUT ?? join(tmpdir(), "mishkat-t27-journal")
const CHROME =
  process.env.MISHKAT_CHROME ??
  join(
    process.env.HOME ?? "",
    "Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  )

const PORT = 4291
const CDP_PORT = 9333
const RUNS = 7 // نفسُ عدد ADR-002r، والمعتمدُ **الوسيط**
const TARGET_LINES = 50 // `SPEC_finance_ledger` §٩-٤: زمنُ إعادة التصيير عند السطر الخمسين

/** السيناريوهاتُ الثلاثة كما أعلنها ADR-002r §١-٢ — لا سيناريو مخترعٌ هنا. */
const SCENARIOS = [
  { id: "س-١", label: "الوسيط المنشور", mbps: 12.68, rttMs: 120 },
  { id: "س-٢", label: "ميدانٌ ضعيف (المرجع)", mbps: 1.5, rttMs: 300 },
  { id: "س-٣", label: "أسوأ حالة", mbps: 0.4, rttMs: 400 },
]

/** معامل بطء الجهاز — طرفا المدى المُعلن في ADR-002r §١-٢ (٥×–٨×) ووسطُهما. */
const CPU_RATES = [1, 6]

const SITES = [
  { id: "أ", path: "/site-a/" },
  { id: "ب", path: "/site-b/" },
]

// ── خادمُ ملفاتٍ ثابت ────────────────────────────────────────────────────────

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
}

/**
 * **يُخدَم brotli لا خاماً**: الميزانيةُ المعتمدة (قب-٢٦/١) مقوَّمةٌ بالـbrotli، فخدمةُ
 * الخام تقيس شبكةً لا تشبه الإنتاج وتظلم المرشّحَين بقدرٍ غير متساوٍ. (اصطدناها في تشغيلةٍ
 * أولى: نُقلت ٣٢٩ ك.ب لـ(أ) بدل ١٠٣، فتضخّم زمنُها ٣ أضعاف.)
 */
const brotliCache = new Map()
function brotliOf(path) {
  const hit = brotliCache.get(path)
  if (hit !== undefined) return hit
  const buf = brotliCompressSync(readFileSync(path), {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
  })
  brotliCache.set(path, buf)
  return buf
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost")
  let path = join(ROOT, decodeURIComponent(url.pathname))
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html")
  if (!existsSync(path) || statSync(path).isDirectory()) {
    res.writeHead(404)
    res.end("not found")
    return
  }
  const body = brotliOf(path)
  res.writeHead(200, {
    "content-type": TYPES[extname(path)] ?? "application/octet-stream",
    "content-encoding": "br",
    "content-length": String(body.length),
    "cache-control": "no-store",
  })
  res.end(body)
})
await new Promise((r) => server.listen(PORT, "127.0.0.1", r))

// ── قيادةُ Chromium عبر بروتوكول DevTools ────────────────────────────────────

if (!existsSync(CHROME)) {
  console.error(`لا متصفّحَ في: ${CHROME}\nاضبط MISHKAT_CHROME على مسار Chromium.`)
  process.exit(2)
}

const profile = join(tmpdir(), "mishkat-t27-profile")
rmSync(profile, { recursive: true, force: true })
mkdirSync(profile, { recursive: true })

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-gpu",
    "about:blank",
  ],
  { stdio: "ignore" },
)

async function waitForCdp() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
      if (r.ok) return (await r.json()).webSocketDebuggerUrl
    } catch {
      /* لم يُقلع بعد */
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error("تعذّر الاتصال ببروتوكول DevTools")
}

const wsUrl = await waitForCdp()
const ws = new WebSocket(wsUrl)
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true })
  ws.addEventListener("error", reject, { once: true })
})

let nextId = 0
const pending = new Map()
const waiters = []

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id !== undefined) {
    const p = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) p?.reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error)})`))
    else p?.resolve(msg.result)
    return
  }
  for (let i = waiters.length - 1; i >= 0; i -= 1) {
    if (waiters[i].method === msg.method) {
      waiters[i].resolve(msg.params)
      waiters.splice(i, 1)
    }
  }
})

function send(method, params = {}, sessionId = undefined) {
  const id = (nextId += 1)
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
  })
}

const { targetId } = await send("Target.createTarget", { url: "about:blank" })
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true })

await send("Page.enable", {}, sessionId)
await send("Network.enable", {}, sessionId)
await send("Runtime.enable", {}, sessionId)

async function evaluate(expression, awaitPromise = false) {
  const r = await send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise },
    sessionId,
  )
  if (r.exceptionDetails) {
    throw new Error(`خطأ في الصفحة: ${JSON.stringify(r.exceptionDetails.exception?.description)}`)
  }
  return r.result.value
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return Number(s[Math.floor(s.length / 2)].toFixed(2))
}

/**
 * لحظةُ صيرورة الصفحة تفاعليةً فعلاً — العلامةُ `mishkat-hydrated` التي يضعها كلُّ مرشّحٍ
 * **آخرَ سطرٍ في مدخله**: بعد الترطيب في (أ)، وبعد ربط الجزيرة في (ب). مقيسةٌ من بدء
 * الملاحة، فتشمل الإقامةَ والنقلَ والتحليلَ والتنفيذ.
 */
const READY_EXPR = `(() => {
  const m = performance.getEntriesByName('mishkat-hydrated')[0]
  const nav = performance.getEntriesByType('navigation')[0]
  const res = performance.getEntriesByType('resource')
  return {
    ready: m ? m.startTime : null,
    domInteractive: nav ? nav.domInteractive : null,
    domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
    loadEnd: nav ? nav.loadEventEnd : null,
    docTransfer: nav ? nav.transferSize : 0,
    resTransfer: res.reduce((a, r) => a + (r.transferSize || 0), 0),
    domElements: document.querySelectorAll('#journal-root *').length,
    fields: document.querySelectorAll('[data-field]').length,
    lines: document.querySelectorAll("[data-component='EntityCard']").length,
  }
})()`

async function loadOnce(path, scenario, cpuRate) {
  await send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId)
  await send(
    "Network.emulateNetworkConditions",
    {
      offline: false,
      latency: scenario.rttMs,
      downloadThroughput: (scenario.mbps * 1e6) / 8,
      uploadThroughput: (scenario.mbps * 1e6) / 8,
    },
    sessionId,
  )
  await send("Emulation.setCPUThrottlingRate", { rate: cpuRate }, sessionId)
  await send("Page.navigate", { url: `http://127.0.0.1:${PORT}${path}` }, sessionId)
  // **شرطٌ صريحٌ لا نومٌ ثابت** (TESTING_POLICY §٧/٢): يُنتظر تمامُ `load` **و** وضعُ علامة
  // الجاهزية معاً. والانتظارُ باستجوابٍ لا بحدثٍ، فحدثُ تشغيلةٍ سابقةٍ لا يُستهلك لهذه.
  for (let i = 0; i < 1200; i += 1) {
    const ready = await evaluate(`(() => {
      const nav = performance.getEntriesByType('navigation')[0]
      return Boolean(nav && nav.loadEventEnd > 0
        && performance.getEntriesByName('mishkat-hydrated').length > 0)
    })()`)
    if (ready === true) return evaluate(READY_EXPR)
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(`لم تبلغ الصفحةُ الجاهزيةَ: ${path} · ${scenario.id} · معالج ${cpuRate}×`)
}

/**
 * زمنُ دورة التحديث: من التقاط الحدث إلى **تثبيت التغيير في المستند**.
 * كلُّ مرشّحٍ يختمها بنفسه في `globalThis.__mkUpdateMs` — (أ) في `useLayoutEffect` بعد
 * التثبيت، و(ب) بعد آخر رقعة. فالمقيسُ واحدٌ لا اثنان.
 */
/**
 * **إطارٌ يُنتظر بين كل فعلٍ وفعل** — لا لتجميل الرقم بل لصحّته: React ١٩ يجمع تحديثاتِ
 * حلقةٍ متزامنةٍ ويثبّتها بعدها، فقراءةُ المستند عقب النقر مباشرةً تقرأ ما قبل التثبيت
 * (اصطدناها: مئتا نقرةٍ والبطاقاتُ ثمانٍ). والزمنُ المُبلَّغ **ليس** زمنَ هذا الانتظار:
 * كلُّ مرشّحٍ يختم دورتَه بنفسه في `__mkUpdateMs` (أ: بعد التثبيت · ب: بعد آخر رقعة).
 */
const FRAME = `await new Promise((r) => requestAnimationFrame(() => r()))`

const typeInto = (pick, seed) => `(async () => {
  const els = document.querySelectorAll("[data-field^='amount:']")
  const el = ${pick}
  if (!el) return null
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  const out = []
  for (let i = 0; i < 10; i += 1) {
    setter.call(el, String(${seed} + i))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    ${FRAME}
    out.push(globalThis.__mkUpdateMs)
  }
  return out
})()`

const TYPE_EXPR = typeInto("els[0]", 125000)
const TYPE_AT_EXPR = typeInto("els[els.length - 1]", 9000)

const ADD_LINES_EXPR = (target) => `(async () => {
  const count = () => document.querySelectorAll("[data-component='EntityCard']").length
  const samples = []
  let guard = 0
  while (count() < ${target} && guard < 400) {
    guard += 1
    const b = document.querySelector("[data-icon='plus']")
    if (!b) break
    b.click()
    ${FRAME}
    samples.push({ lines: count(), ms: globalThis.__mkUpdateMs })
  }
  return samples
})()`

// ── التشغيل ─────────────────────────────────────────────────────────────────

const results = { method: {}, load: {}, interaction: {} }

results.method = {
  browser: CHROME,
  runsPerCell: RUNS,
  aggregate: "الوسيط",
  network: "CDP Network.emulateNetworkConditions (نطاقٌ وذهابٌ وإياب)، والكاش مُعطَّل في كل تشغيلة",
  cpu: "CDP Emulation.setCPUThrottlingRate — ١× جهازُ القياس، ٦× وسطُ مدى ADR-002r المعلن (٥×–٨×)",
  targetLines: TARGET_LINES,
  scenarios: SCENARIOS,
}

for (const scenario of SCENARIOS) {
  for (const cpuRate of CPU_RATES) {
    for (const site of SITES) {
      const key = `${scenario.id} · معالج ${cpuRate}× · ${site.id}`
      const samples = []
      let last = null
      for (let i = 0; i < RUNS; i += 1) {
        last = await loadOnce(site.path, scenario, cpuRate)
        samples.push(last)
      }
      results.load[key] = {
        readyMs: median(samples.map((s) => s.ready)),
        domInteractiveMs: median(samples.map((s) => s.domInteractive)),
        loadEndMs: median(samples.map((s) => s.loadEnd)),
        transferBytes: last.docTransfer + last.resTransfer,
        domElements: last.domElements,
        fields: last.fields,
        lines: last.lines,
      }
      console.log(`✓ ${key}: تفاعلٌ ${results.load[key].readyMs} مللي`)
    }
  }
}

// التفاعلُ يُقاس **بلا خنق شبكة** (لا شبكةَ فيه أصلاً) وبخنق المعالج وحده.
for (const cpuRate of CPU_RATES) {
  for (const site of SITES) {
    const key = `معالج ${cpuRate}× · ${site.id}`
    const at8 = []
    const at50 = []
    const growth = []
    for (let i = 0; i < RUNS; i += 1) {
      await loadOnce(site.path, SCENARIOS[0], cpuRate)
      const first = await evaluate(TYPE_EXPR, true)
      if (first !== null) at8.push(median(first.filter((x) => typeof x === "number")))
      const added = await evaluate(ADD_LINES_EXPR(TARGET_LINES), true)
      const fiftieth = added.find((s) => s.lines === TARGET_LINES)
      if (fiftieth !== undefined) growth.push(fiftieth.ms)
      const later = await evaluate(TYPE_AT_EXPR, true)
      if (later !== null) at50.push(median(later.filter((x) => typeof x === "number")))
    }
    results.interaction[key] = {
      keystrokeAt8LinesMs: median(at8),
      addFiftiethLineMs: median(growth),
      keystrokeAt50LinesMs: median(at50),
    }
    console.log(`✓ ${key}: ضغطةٌ عند ٨ أسطر ${results.interaction[key].keystrokeAt8LinesMs} مللي · `
      + `إضافةُ السطر ٥٠ ${results.interaction[key].addFiftiethLineMs} مللي · `
      + `ضغطةٌ عند ٥٠ سطراً ${results.interaction[key].keystrokeAt50LinesMs} مللي`)
  }
}

mkdirSync(join(HERE, "results"), { recursive: true })
writeFileSync(join(HERE, "results/journal-browser.json"), `${JSON.stringify(results, null, 2)}\n`)
console.log("✓ النتائج: results/journal-browser.json")

ws.close()
chrome.kill()
server.close()
process.exit(0)
