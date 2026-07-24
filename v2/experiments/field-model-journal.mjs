/* global console */
/**
 * الحكمُ على الميزانية والعتبات — الشاشة الحاسمة (T27/٣).
 *
 * يجمع بين مصدرَين **مقيسَين بيدنا**: `journal-bytes.json` (بايتات) و`journal-browser.json`
 * (زمنٌ في متصفّحٍ حقيقيٍّ على شبكةٍ مخنوقة)، ثم يفعل ثلاثة أشياء:
 *  ١. **يشتقّ** الزمنَ بصيغ ADR-002r ملحق أ-٣ حرفياً — لا لنعتمده بل **لنقارنه بالمقيس**،
 *     فيُعرف كم يبعد نموذجُ تلك الوثيقة عن الواقع (وهو رقمٌ لم يكن معروفاً قبل اليوم).
 *  ٢. **يحكم** على م-١…م-٥ (§١-٣) **بالمقيس** لا بالمشتقّ.
 *  ٣. **يفحص العتبات** ع-١…ع-١٠ التي تُعيد فتح الـADR (§٥-٣).
 *
 * التشغيل: `node field-model-journal.mjs` بعد السكربتَين. المخرَج: `results/journal-verdict.json`
 */

import { readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const read = (name) => JSON.parse(readFileSync(join(HERE, "results", name), "utf8"))

const bytes = read("journal-bytes.json")
const browser = read("journal-browser.json")
// القياسُ الأول (شاشةُ العرض) **مُعاداً بيدي اليوم** لا منقولاً من ADR-002r: أرقامُه
// اختلفت عن المنشور رغم تطابق الإصدارات المُعلنة (§«ما اصطدناه» في تقرير T27)،
// ولا يجوز أن يُخلط رقمٌ منقولٌ برقمٍ مقيس. والملفُّ الأصليّ لـT6 لم يُمسّ.
const homeScreen = read("results-rerun-T27.json")

const KB = 1024
const A = "أ React 19 + حالةٌ وإعادةُ تصيير"
const B = "ب Hono + جزيرةٌ أمريّة"

/** الميزانيةُ المعتمدة نصّاً في قب-٢٦/١ و ADR-002r §١-٣ — لا رقمَ مخترعٌ هنا. */
const BUDGET = {
  "م-١ ضريبةُ الإطار عند س-٢ (ث)": 0.5,
  "م-٢ جافاسكربت الصفحة الأولى (ك.ب brotli)": 75,
  "م-٣ الحمولةُ الأولى كاملةً (ك.ب brotli)": 150,
  "م-٤ زمنُ التفاعل عند س-٢ (ث)": 3,
  "م-٤ زمنُ التفاعل عند س-٣ (ث)": 5,
  "م-٥ طلباتُ الصفحة الأولى": 4,
}

/** صيغُ ADR-002r ملحق أ-٣ — منقولةٌ حرفياً كي تكون المقارنةُ عادلة. */
const SCENARIOS = {
  "س-١": { mbps: 12.68, rttMs: 120 },
  "س-٢": { mbps: 1.5, rttMs: 300 },
  "س-٣": { mbps: 0.4, rttMs: 400 },
}
const SETUP_ROUNDTRIPS = 5

function derivedSeconds(firstLoadBrotli, hydrationMs, scenario, cpuFactor) {
  const s = SCENARIOS[scenario]
  const setup = (SETUP_ROUNDTRIPS * s.rttMs) / 1000
  const transfer = (firstLoadBrotli * 8) / (s.mbps * 1e6)
  const cpu = (hydrationMs * cpuFactor) / 1000
  return Number((setup + transfer + cpu).toFixed(3))
}

const firstLoad = {
  أ: bytes.variants[A].firstLoad.brotli,
  ب: bytes.variants[B].firstLoad.brotli,
}
const js = { أ: bytes.variants[A].jsTotal.brotli, ب: bytes.variants[B].jsTotal.brotli }

/**
 * زمنُ المعالج المقيس بالفرق: (زمنُ التفاعل عند معالجٍ ٦×) − (عنده ١×) في السيناريو الأسرع
 * — أي **ما يضيفه بطءُ الجهاز وحده**، مقيساً لا مفترضاً (جوابُ ع-٦ بقدر ما يسمح به الخنق).
 */
const cpuDelta = {}
for (const id of ["أ", "ب"]) {
  cpuDelta[id] = Number(
    (browser.load[`س-١ · معالج 6× · ${id}`].readyMs - browser.load[`س-١ · معالج 1× · ${id}`].readyMs).toFixed(1),
  )
}

const measured = {}
for (const sc of ["س-١", "س-٢", "س-٣"]) {
  for (const cpu of [1, 6]) {
    const a = browser.load[`${sc} · معالج ${cpu}× · أ`].readyMs
    const b = browser.load[`${sc} · معالج ${cpu}× · ب`].readyMs
    measured[`${sc} · معالج ${cpu}×`] = {
      "أ (ث)": Number((a / 1000).toFixed(3)),
      "ب (ث)": Number((b / 1000).toFixed(3)),
      "ضريبةُ الإطار (ث)": Number(((a - b) / 1000).toFixed(3)),
    }
  }
}

/** المشتقُّ بصيغ ADR مقابل المقيس — نسبةُ الخطأ تُقال ولا تُطوى. */
const derivedVsMeasured = {}
for (const sc of ["س-١", "س-٢", "س-٣"]) {
  for (const id of ["أ", "ب"]) {
    // زمنُ ترطيبٍ تقريبيّ: ما بين `domInteractive` وعلامةِ الجاهزية عند معالجٍ ١×.
    const cell = browser.load[`${sc} · معالج 1× · ${id}`]
    const hydrationMs = Number((cell.readyMs - cell.domInteractiveMs).toFixed(1))
    const derived = derivedSeconds(firstLoad[id], hydrationMs, sc, 1)
    const actual = Number((cell.readyMs / 1000).toFixed(3))
    derivedVsMeasured[`${sc} · ${id}`] = {
      "مشتقٌّ بصيغة ADR (ث)": derived,
      "مقيسٌ في متصفّح (ث)": actual,
      "المشتقُّ ÷ المقيس": Number((derived / actual).toFixed(2)),
      "من تحليل المستند إلى الجاهزية (مللي) — نقلٌ وتحليلٌ وتنفيذٌ لا ترطيبٌ صرف": hydrationMs,
    }
  }
}

const s2 = measured["س-٢ · معالج 6×"]
const s3 = measured["س-٣ · معالج 6×"]

const verdict = {
  "م-١ ضريبة ≤ ٠٫٥٠ ث عند س-٢": {
    المقيس: s2["ضريبةُ الإطار (ث)"],
    الحكم: s2["ضريبةُ الإطار (ث)"] <= 0.5 ? "✔ داخلَ الحدّ" : "✘ يكسر",
    "نسبةٌ من الحدّ": `${Math.round((s2["ضريبةُ الإطار (ث)"] / 0.5) * 100)}٪`,
  },
  "م-٢ جافاسكربت ≤ ٧٥ ك.ب": {
    أ: { "ك.ب": Number((js.أ / KB).toFixed(1)), الحكم: js.أ / KB <= 75 ? "✔" : "✘", "نسبةٌ من الحدّ": `${Math.round((js.أ / KB / 75) * 100)}٪` },
    ب: { "ك.ب": Number((js.ب / KB).toFixed(1)), الحكم: js.ب / KB <= 75 ? "✔" : "✘", "نسبةٌ من الحدّ": `${Math.round((js.ب / KB / 75) * 100)}٪` },
  },
  "م-٣ الحمولةُ الأولى ≤ ١٥٠ ك.ب": {
    أ: { "ك.ب": Number((firstLoad.أ / KB).toFixed(1)), الحكم: firstLoad.أ / KB <= 150 ? "✔" : "✘", "نسبةٌ من الحدّ": `${Math.round((firstLoad.أ / KB / 150) * 100)}٪` },
    ب: { "ك.ب": Number((firstLoad.ب / KB).toFixed(1)), الحكم: firstLoad.ب / KB <= 150 ? "✔" : "✘", "نسبةٌ من الحدّ": `${Math.round((firstLoad.ب / KB / 150) * 100)}٪` },
  },
  "م-٤ تفاعلٌ ≤ ٣ ث عند س-٢ و≤ ٥ ث عند س-٣": {
    "أ عند س-٢": { الثواني: s2["أ (ث)"], الحكم: s2["أ (ث)"] <= 3 ? "✔" : "✘" },
    "ب عند س-٢": { الثواني: s2["ب (ث)"], الحكم: s2["ب (ث)"] <= 3 ? "✔" : "✘" },
    "أ عند س-٣": { الثواني: s3["أ (ث)"], الحكم: s3["أ (ث)"] <= 5 ? "✔" : "✘" },
    "ب عند س-٣": { الثواني: s3["ب (ث)"], الحكم: s3["ب (ث)"] <= 5 ? "✔" : "✘" },
  },
  "م-٥ طلباتٌ ≤ ٤": {
    أ: bytes.variants[A].requests,
    ب: bytes.variants[B].requests,
    الحكم: Math.max(bytes.variants[A].requests, bytes.variants[B].requests) <= 4 ? "✔" : "✘",
  },
}

// ── العتبات ع-١…ع-١٠ (§٥-٣) — كلٌّ بمقيسه ──────────────────────────────────
const fontBrotli = homeScreen.css.brotli - homeScreen.cssWithoutEmbeddedFont.brotli
const thresholds = {
  "ع-١ جافاسكربت > ٧٥ ك.ب brotli": {
    أ: js.أ / KB > 75,
    ب: js.ب / KB > 75,
    الإجراء: "بوابةُ G21 تفشل — لا دمج",
  },
  "ع-٢ الحمولةُ الأولى > ١٥٠ ك.ب brotli": {
    أ: firstLoad.أ / KB > 150,
    ب: firstLoad.ب / KB > 150,
    الإجراء: "بوابةُ G21 تفشل",
  },
  "ع-٣ ضريبةُ الإطار > ٠٫٥٠ ث عند س-٢": {
    المقيس: s2["ضريبةُ الإطار (ث)"],
    "بلغَ العتبة": s2["ضريبةُ الإطار (ث)"] > 0.5,
    الإجراء: "يُعاد فتح ADR-002r",
  },
  "ع-٤ طلباتٌ > ٤": { "بلغَ العتبة": false },
  "ع-٦ ترطيبٌ على جهازٍ ميدانيّ > ٣٠٠ مللي": {
    "أثرُ خنق المعالج ٦× على زمن التفاعل (مللي)": cpuDelta,
    "بلغَ العتبة": Math.max(cpuDelta.أ, cpuDelta.ب) > 300,
    ملاحظة:
      "خنقُ متصفّحٍ لا جهازٌ ميدانيٌّ حقيقيّ — العتبةُ تبقى مفتوحةً حتى يُقاس على جهاز.",
  },
  "ع-٧ حزمُ التشغيل ≥ ٢٥": {
    أ: homeScreen.deps["candidate-a"].runtimePackages,
    ب: homeScreen.deps["candidate-b"].runtimePackages,
    "بلغَ العتبة": false,
  },
  "ع-٩ نصيبُ الخط من الحمولة الأولى > ٥٠٪": {
    "بايتاتُ الخط brotli": fontBrotli,
    "أ (٪)": Number(((fontBrotli / firstLoad.أ) * 100).toFixed(1)),
    "ب (٪)": Number(((fontBrotli / firstLoad.ب) * 100).toFixed(1)),
    "بلغَ العتبة": fontBrotli / firstLoad.ب > 0.5 || fontBrotli / firstLoad.أ > 0.5,
    الإجراء: "يُعاد النظر في تشريح الخط أو تقسيمه (قب-٢٠ ⟵ CR)",
  },
  "ع-١٠ حزمةُ الخادم > ١ م.ب gzip": {
    "أ (ك.ب gzip)": Number((bytes.serverBundles["أ react-dom/server"].gzip / KB).toFixed(1)),
    "ب (ك.ب gzip)": Number((bytes.serverBundles["ب Hono"].gzip / KB).toFixed(1)),
    "بلغَ العتبة": false,
  },
}

// ── مقارنةُ الشاشتين: ما الذي تغيّر حين صارت الشاشةُ نموذجَ إدخالٍ ثقيلاً؟ ────
const homeA = homeScreen.variants["أ-١ React 19 + ترطيب"]
const homeB = homeScreen.variants["ب Hono + جزيرة"]
const screensCompared = {
  "شاشةُ العرض (رئيسيةُ الأمير)": {
    "جافاسكربت أ (ك.ب brotli)": Number((homeA.jsTotal.brotli / KB).toFixed(1)),
    "جافاسكربت ب (ك.ب brotli)": Number((homeB.jsTotal.brotli / KB).toFixed(1)),
    "أ ÷ ب": Number((homeA.jsTotal.brotli / homeB.jsTotal.brotli).toFixed(1)),
  },
  "الشاشةُ الحاسمة (القيدُ المزدوج)": {
    "جافاسكربت أ (ك.ب brotli)": Number((js.أ / KB).toFixed(1)),
    "جافاسكربت ب (ك.ب brotli)": Number((js.ب / KB).toFixed(1)),
    "أ ÷ ب": Number((js.أ / js.ب).toFixed(1)),
  },
  "ما تغيّر": "نموُّ جزيرةِ (ب) حين لزمها بناءُ الشجرة على العميل — أي التقاءُ المرشّحَين",
}

const out = {
  budget: BUDGET,
  measured,
  derivedVsMeasured,
  verdict,
  thresholds,
  screensCompared,
  interaction: browser.interaction,
  interactionLayerLines: bytes.interactionLayer,
  tree: bytes.tree,
  domFairness: {
    ...bytes.domIdentical,
    "عناصرُ DOM في الصفحة (أ)": browser.load["س-٢ · معالج 1× · أ"].domElements,
    "عناصرُ DOM في الصفحة (ب)": browser.load["س-٢ · معالج 1× · ب"].domElements,
    "مقابضُ الإدخال (أ)": browser.load["س-٢ · معالج 1× · أ"].fields,
    "مقابضُ الإدخال (ب)": browser.load["س-٢ · معالج 1× · ب"].fields,
  },
}

writeFileSync(join(HERE, "results/journal-verdict.json"), `${JSON.stringify(out, null, 2)}\n`)
console.log(JSON.stringify(out.verdict, null, 1))
console.log("✓ النتائج: results/journal-verdict.json")
