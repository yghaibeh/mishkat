/**
 * دليلُ الهوية (قب-٢٠) — يُولَّد من الرموز نفسها لا يُرسَم يدوياً.
 *
 * يُخرج شيئين في `evidence/`:
 *  ١. `IDENTITY-CONTRAST.txt` — نسبُ التباين **محسوبةً** لكل زوجٍ حرجٍ في الوضعين (§٤-٤).
 *  ٢. `identity-preview.html` — صفحةٌ **قائمةٌ بذاتها** (الخط مُضمَّنٌ، صفر طلبٍ شبكيّ)
 *     تعرض اللوحةَ والسلالم والمكوّناتِ في الوضعين جنباً إلى جنب — لقطةُ الهوية.
 *
 * دليلٌ لا بوابة: الحارسُ الحقيقيّ اختبارُ التباين في `tests/ui/tokens.test.ts` (يفشل البناء).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { ROOT } from "../gates/_lib.mjs"

const tokens = JSON.parse(readFileSync(join(ROOT, "src/ui/tokens/tokens.json"), "utf8"))
const css = readFileSync(join(ROOT, "src/ui/tokens/tokens.generated.css"), "utf8")

const lin = (c) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}
const lum = (hex) => {
  const h = hex.slice(1)
  return (
    0.2126 * lin(parseInt(h.slice(0, 2), 16)) +
    0.7152 * lin(parseInt(h.slice(2, 4), 16)) +
    0.0722 * lin(parseInt(h.slice(4, 6), 16))
  )
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const PAIRS = [
  ["text-primary", "surface-base", 4.5],
  ["text-secondary", "surface-base", 4.5],
  ["text-primary", "surface-raised", 4.5],
  ["text-secondary", "surface-raised", 4.5],
  ["text-primary", "surface-sunken", 4.5],
  ["text-on-accent", "brand", 4.5],
  ["text-on-accent", "brand-hover", 4.5],
  ["text-on-inverse", "surface-inverse", 4.5],
  ["success", "surface-base", 4.5],
  ["warning", "surface-base", 4.5],
  ["danger", "surface-base", 4.5],
  ["info", "surface-base", 4.5],
  ["neutral", "surface-base", 4.5],
  ["success", "success-muted", 4.5],
  ["warning", "warning-muted", 4.5],
  ["danger", "danger-muted", 4.5],
  ["info", "info-muted", 4.5],
  ["neutral", "neutral-muted", 4.5],
  ["brand", "surface-base", 3],
  ["border-strong", "surface-base", 3],
  ["border-focus", "surface-base", 3],
]

const lines = []
lines.push("دليل الهوية البصرية — قب-٢٠ (خُضرة مسجدية هادئة · خط عصري هندسي · أرقام ٤٥)")
lines.push("التباين محسوبٌ من الرموز في الوضعين (WCAG AA: نصٌّ ٤٫٥ · عنصرُ واجهة ٣)")
lines.push("")
let worst = Infinity
for (const mode of ["light", "dark"]) {
  lines.push(`── الوضع ${mode === "light" ? "الفاتح" : "الداكن"} ──`)
  for (const [fg, bg, min] of PAIRS) {
    const r = ratio(tokens.color[mode][fg], tokens.color[mode][bg])
    if (r / min < worst) worst = r / min
    lines.push(
      `${r >= min ? "✓" : "✗"} ${(fg + " على " + bg).padEnd(38)} ${r.toFixed(2)}:1  (المطلوب ${min})`,
    )
  }
  lines.push("")
}
lines.push(`أضيقُ هامشٍ عن العتبة: ×${worst.toFixed(2)} من المطلوب`)
lines.push(`الخط: ${JSON.parse(readFileSync(join(ROOT, "src/ui/tokens/font.embedded.json"), "utf8")).license} — مُضمَّنٌ data-URI، صفر طلبٍ شبكيّ`)

mkdirSync(join(ROOT, "evidence"), { recursive: true })
writeFileSync(join(ROOT, "evidence/IDENTITY-CONTRAST.txt"), lines.join("\n") + "\n", "utf8")

// ── لقطة الهوية: صفحةٌ قائمةٌ بذاتها بالوضعين ────────────────────────────────
const swatches = (mode) =>
  Object.entries(tokens.color[mode])
    .map(
      ([role, value]) =>
        `<div class="sw"><span class="chip" style="background:${value}"></span><code>${role}</code></div>`,
    )
    .join("")

const panel = (mode) => `
<section class="panel" data-theme="${mode}">
  <h2>الوضع ${mode === "light" ? "الفاتح" : "الداكن"}</h2>
  <div class="card">
    <p class="display">مِشكاة — المسجد المؤثر</p>
    <p class="title">أين أنا من هدف الأسبوع؟</p>
    <p class="body">أدخلتَ ٣ من ٢٠ مسجداً هذا الأسبوع · التاريخ الهجري ١٤٤٨ هـ · المبلغ ١٢٥٬٠٠٠ ل.س</p>
    <p class="caption">الأرقام عربية-هندية ٤٥ موحّدةً عبر النظام</p>
    <div class="row">
      <button class="btn primary">إدخال سجل اليوم</button>
      <button class="btn secondary">تقديم التقرير</button>
      <button class="btn ghost">تفاصيل</button>
      <button class="btn danger">حذف</button>
    </div>
    <div class="row">
      <span class="badge success">✔ معتمد</span>
      <span class="badge warning">⚠ بانتظار الاعتماد</span>
      <span class="badge danger">✖ مرفوض</span>
      <span class="badge info">ℹ اطّلاع</span>
      <span class="badge neutral">• مسودة</span>
    </div>
  </div>
  <div class="swatches">${swatches(mode)}</div>
</section>`

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><title>هوية مِشكاة — قب-٢٠</title>
<style>
${css}
body { margin: 0; padding: var(--mishkat-space-lg); background: #7d7d7d; font-family: var(--mishkat-font-family); }
.panel { padding: var(--mishkat-space-lg); border-radius: var(--mishkat-radius-lg); margin-block-end: var(--mishkat-space-lg);
  background: var(--mishkat-color-surface-base); color: var(--mishkat-color-text-primary); }
h2 { font-size: var(--mishkat-font-title-size); color: var(--mishkat-color-text-secondary); }
.card { background: var(--mishkat-color-surface-raised); border: 1px solid var(--mishkat-color-border-subtle);
  border-radius: var(--mishkat-radius-md); padding: var(--mishkat-space-lg); box-shadow: var(--mishkat-elevation-raised); }
.display { font-size: var(--mishkat-font-display-size); font-weight: var(--mishkat-font-display-weight); margin: 0 0 var(--mishkat-space-sm); }
.title { font-size: var(--mishkat-font-title-size); font-weight: var(--mishkat-font-title-weight); margin: 0 0 var(--mishkat-space-xs); }
.body { font-size: var(--mishkat-font-body-size); line-height: var(--mishkat-font-body-line-height); margin: 0 0 var(--mishkat-space-xs); }
.caption { font-size: var(--mishkat-font-caption-size); color: var(--mishkat-color-text-secondary); margin: 0 0 var(--mishkat-space-md); }
.row { display: flex; flex-wrap: wrap; gap: var(--mishkat-space-sm); margin-block-start: var(--mishkat-space-md); }
.btn { min-block-size: var(--mishkat-size-touch-min); padding-inline: var(--mishkat-space-md); border-radius: var(--mishkat-radius-md);
  font-family: inherit; font-size: var(--mishkat-font-body-size); border: 1px solid transparent; cursor: pointer;
  transition: background var(--mishkat-motion-duration-fast) var(--mishkat-motion-ease-standard); }
.btn.primary { background: var(--mishkat-color-brand); color: var(--mishkat-color-text-on-accent); }
.btn.secondary { background: var(--mishkat-color-surface-sunken); color: var(--mishkat-color-text-primary); border-color: var(--mishkat-color-border-strong); }
.btn.ghost { background: transparent; color: var(--mishkat-color-text-primary); }
.btn.danger { background: var(--mishkat-color-danger); color: var(--mishkat-color-text-on-accent); }
.badge { display: inline-flex; align-items: center; gap: var(--mishkat-space-2xs); padding: var(--mishkat-space-2xs) var(--mishkat-space-sm);
  border-radius: var(--mishkat-radius-pill); font-size: var(--mishkat-font-caption-size); }
.badge.success { background: var(--mishkat-color-success-muted); color: var(--mishkat-color-success); }
.badge.warning { background: var(--mishkat-color-warning-muted); color: var(--mishkat-color-warning); }
.badge.danger { background: var(--mishkat-color-danger-muted); color: var(--mishkat-color-danger); }
.badge.info { background: var(--mishkat-color-info-muted); color: var(--mishkat-color-info); }
.badge.neutral { background: var(--mishkat-color-neutral-muted); color: var(--mishkat-color-neutral); }
.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: var(--mishkat-space-xs); margin-block-start: var(--mishkat-space-lg); }
.sw { display: flex; align-items: center; gap: var(--mishkat-space-xs); font-size: var(--mishkat-font-caption-size); }
.chip { inline-size: var(--mishkat-size-icon-lg); block-size: var(--mishkat-size-icon-lg); border-radius: var(--mishkat-radius-sm); border: 1px solid var(--mishkat-color-border-subtle); }
code { font-family: inherit; color: var(--mishkat-color-text-secondary); }
</style></head>
<body>
${panel("light")}
${panel("dark")}
</body></html>
`
writeFileSync(join(ROOT, "evidence/identity-preview.html"), html, "utf8")
console.log("✓ دليل الهوية: evidence/IDENTITY-CONTRAST.txt · evidence/identity-preview.html")
