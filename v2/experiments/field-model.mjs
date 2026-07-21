/* global console */
/**
 * نموذجُ الميدان — يحوّل بايتاتِ `results.json` إلى **زمنٍ** بسيناريوهاتٍ معلنة،
 * ويحاكم كلَّ مرشّحٍ إلى الميزانية المقترحة. كلُّ رقمٍ هنا مشتقٌّ بصيغةٍ ظاهرة لا مُقدَّر.
 *
 * التشغيل: `node field-model.mjs` بعد `node measure.mjs`.
 * المخرَج: `results/field-model.json`.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const results = JSON.parse(readFileSync(join(HERE, "results/results.json"), "utf8"))
const timings = JSON.parse(readFileSync(join(HERE, "results/browser-timings.json"), "utf8"))

/** سيناريوهاتُ الشبكة — الأول منشورٌ بمصدر، والآخران افتراضان معلنان مشتقّان منه. */
const SCENARIOS = {
  "س-١ الوسيط المنشور (Ookla/DataReportal يناير ٢٠٢٥)": { mbps: 12.68, rttMs: 120, published: true },
  "س-٢ ميدانٌ ضعيف (افتراض معلن ≈١٢٪ من الوسيط)": { mbps: 1.5, rttMs: 300, published: false },
  "س-٣ أسوأ حالة (افتراض معلن ≈٣٪ من الوسيط)": { mbps: 0.4, rttMs: 400, published: false },
}

/**
 * زمنُ الإقامة الثابت: فتحُ الاتصال (DNS+TCP+TLS ≈ ٣ ذهابٍ وإياب) + طلبُ المستند +
 * طلبُ الأصول على نفس الاتصال (HTTP/2). **ثابتٌ للمرشّحَين** لتساوي عدد الطلبات (٣)،
 * فلا يفرّق بينهما — وهذا بذاته نتيجة تُقال.
 */
const SETUP_RTTS = 5

/** معاملُ بطء جهاز الميدان مقابل جهاز القياس — **افتراضٌ معلن** لا قياس. */
const DEVICE_FACTOR = { min: 5, max: 8 }

const s = (n) => Number(n.toFixed(3))

const rows = {}
for (const [name, variant] of Object.entries(results.variants)) {
  const bytes = variant.firstLoad.brotli
  const cpuMs = timings["النتائج_مللي_ثانية"][name].hydrated
  const perScenario = {}
  for (const [label, sc] of Object.entries(SCENARIOS)) {
    const setupS = (SETUP_RTTS * sc.rttMs) / 1000
    const transferS = (bytes * 8) / (sc.mbps * 1e6)
    perScenario[label] = {
      إقامةُ_الاتصال_ث: s(setupS),
      نقلُ_الحمولة_ث: s(transferS),
      معالجٌ_ميدانيّ_ث: { أدنى: s((cpuMs * DEVICE_FACTOR.min) / 1000), أقصى: s((cpuMs * DEVICE_FACTOR.max) / 1000) },
      زمنُ_التفاعل_التقريبيّ_ث: {
        أدنى: s(setupS + transferS + (cpuMs * DEVICE_FACTOR.min) / 1000),
        أقصى: s(setupS + transferS + (cpuMs * DEVICE_FACTOR.max) / 1000),
      },
    }
  }
  rows[name] = {
    حمولةٌ_أولى_brotli_بايت: bytes,
    حمولةٌ_أولى_brotli_كب: s(bytes / 1024),
    جافاسكربت_brotli_كب: s(variant.jsTotal.brotli / 1024),
    طلبات: variant.requests,
    ترطيبٌ_مقيسٌ_مللي: cpuMs,
    سيناريوهات: perScenario,
  }
}

// ── ضريبةُ الإطار: ما يدفعه الميدان مقابلَ الإطار وحده عند السيناريو المرجعيّ (س-٢) ──
const REF = "س-٢ ميدانٌ ضعيف (افتراض معلن ≈١٢٪ من الوسيط)"
const baseline = "ب Hono + جزيرة"
const frameworkTax = {}
for (const [name, row] of Object.entries(rows)) {
  const dBytes = row.حمولةٌ_أولى_brotli_بايت - rows[baseline].حمولةٌ_أولى_brotli_بايت
  const dCpuMs = row.ترطيبٌ_مقيسٌ_مللي - rows[baseline].ترطيبٌ_مقيسٌ_مللي
  const transferS = (dBytes * 8) / (SCENARIOS[REF].mbps * 1e6)
  frameworkTax[name] = {
    زيادةُ_البايتات: dBytes,
    نقلٌ_إضافيٌّ_ث: s(transferS),
    معالجٌ_إضافيٌّ_ث: { أدنى: s((dCpuMs * DEVICE_FACTOR.min) / 1000), أقصى: s((dCpuMs * DEVICE_FACTOR.max) / 1000) },
    الضريبةُ_الكليّة_ث: {
      أدنى: s(transferS + (dCpuMs * DEVICE_FACTOR.min) / 1000),
      أقصى: s(transferS + (dCpuMs * DEVICE_FACTOR.max) / 1000),
    },
  }
}

// ── الميزانيةُ المقترحة والحكم ───────────────────────────────────────────────
const BUDGET = {
  ضريبةُ_الإطار_ث: 0.5,
  جافاسكربت_brotli_كب: 75,
  حمولةٌ_أولى_brotli_كب: 150,
  زمنُ_تفاعلٍ_عند_س٢_ث: 3,
  زمنُ_تفاعلٍ_عند_س٣_ث: 5,
}

const verdict = {}
for (const [name, row] of Object.entries(rows)) {
  verdict[name] = {
    "ضريبة الإطار ≤ ٠٫٥ ث": frameworkTax[name].الضريبةُ_الكليّة_ث.أقصى <= BUDGET.ضريبةُ_الإطار_ث,
    "جافاسكربت ≤ ٧٥ ك.ب": row.جافاسكربت_brotli_كب <= BUDGET.جافاسكربت_brotli_كب,
    "حمولة أولى ≤ ١٥٠ ك.ب": row.حمولةٌ_أولى_brotli_كب <= BUDGET.حمولةٌ_أولى_brotli_كب,
    "تفاعل ≤ ٣ ث عند س-٢": row.سيناريوهات[REF].زمنُ_التفاعل_التقريبيّ_ث.أقصى <= BUDGET.زمنُ_تفاعلٍ_عند_س٢_ث,
  }
}

const model = {
  مصادر: {
    "سرعة الشبكة": "DataReportal — Digital 2025: Syria (بيانات Ookla، يناير ٢٠٢٥): وسيطُ التنزيل الخلويّ ١٢٫٦٨ م.ب/ث، والثابت ٣٫٤٠ م.ب/ث · مستخدمو الإنترنت ٩٫٠١ مليون (٣٥٫٨٪) · اشتراكات خلوية ١٩٫٥ مليون. https://datareportal.com/reports/digital-2025-syria — تاريخ الاطلاع ٢٠٢٦-٠٧-٢١",
    "قيدُ صدقٍ على المصدر": "وسيطُ Speedtest عيّنةٌ تختار نفسَها (من يقيس سرعته يملك اتصالاً عاملاً) ⟵ **متفائل** بالنسبة لعامل ميدانٍ في قرية. لذلك السيناريو المرجعيّ للقرار هو س-٢ لا س-١.",
    "جهاز الميدان": "لم يُعثر على مصدرٍ منشورٍ لتوزيع أجهزة سوريا ⟵ معامل البطء ٥×–٨× **افتراضٌ معلن** لا قياس.",
  },
  ثوابتُ_النموذج: { إقامةُ_الاتصال_بعدد_الذهاب_والإياب: SETUP_RTTS, معاملُ_الجهاز: DEVICE_FACTOR },
  السيناريوهات: SCENARIOS,
  المرشّحون: rows,
  ضريبةُ_الإطار_عند_س٢: frameworkTax,
  الميزانيةُ_المقترحة: BUDGET,
  اشتقاقُ_الميزانية: {
    "ضريبة الإطار ≤ ٠٫٥ ث": "ثلثُ زمنِ إقامةِ الاتصال الثابت (١٫٥ ث عند س-٢) — أي: لا يجوز أن يكلّف اختيارُ الإطار الميدانَ أكثرَ من ثلثِ ما يكلّفه فتحُ الاتصال أصلاً.",
    "جافاسكربت ≤ ٧٥ ك.ب brotli": "ترجمةُ الحدّ السابق بايتاتٍ عند س-٢ بعد خصم زمنِ المعالج المقيس: ٠٫٥ ث − ٠٫١٦ ث معالجاً ≈ ٠٫٣٤ ث نقلاً × ١٫٥ م.ب/ث ≈ ٦٤ ك.ب، ويُدوَّر صعوداً إلى ٧٥ بهامشِ ١٧٪.",
    "حمولة أولى ≤ ١٥٠ ك.ب brotli": "من هدف ≤ ٥ ث عند س-٣: ٥ − ١٫٥ إقامةً − ٠٫١٥ معالجاً = ٣٫٣٥ ث نقلاً × ٠٫٤ م.ب/ث ≈ ١٦٧ ك.ب، ويُشدَّد إلى ١٥٠ احتياطاً.",
    "ما يستهلكه الأساس اليوم": `${s(results.css.brotli / 1024)} ك.ب ورقةَ رموزٍ (منها ${s((results.css.brotli - results.cssWithoutEmbeddedFont.brotli) / 1024)} ك.ب خطّاً مُضمَّناً) + ${s(results.variants["ب Hono + جزيرة"].html.brotli / 1024)} ك.ب مستنداً — قبل أي إطارٍ وقبل أي CSS تخطيط.`,
  },
  الحكم: verdict,
}

writeFileSync(join(HERE, "results/field-model.json"), `${JSON.stringify(model, null, 2)}\n`)
console.log("✓ results/field-model.json")
