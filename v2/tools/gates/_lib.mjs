/** أدوات مشتركة للبوابات — المادة ٠: لا قاعدة بلا بوابة. */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, extname } from "node:path"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

const SKIP_DIRS = new Set(["node_modules", "coverage", ".git", "dist", "__violations__"])

export function walk(dir, exts = [".ts", ".tsx", ".mjs", ".js"]) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full, exts))
    else if (exts.includes(extname(full))) out.push(full)
  }
  return out
}

export function read(file) {
  return readFileSync(file, "utf8")
}

export function rel(file) {
  return relative(ROOT, file)
}

/**
 * **ثابتُ التجريد — عددُ الأسطر محفوظ** (CR-023/قب-٤٦ §٣).
 *
 * كانت الكتلةُ متعددةُ الأسطر تُستبدل بـ**مسافةٍ واحدة**، فتنهار مطابقةُ أرقام الأسطر بين
 * الكود المُجرَّد والملفّ الأصليّ. وأثرُ ذلك **عطبان لا واحد**:
 *  ١. **مخرجُ G14 لا يُبلَغ أبداً**: يقرأ الملفَّ الأصليَّ بفهرسٍ من الكود المُجرَّد.
 *  ٢. **والأخطر — التبليغُ كاذب**: كلُّ بوابةٍ تبلّغ `${i + 1}` تدلّ على **سطرٍ خاطئ** في
 *     كل ملفٍّ فيه كتلةُ توثيق — **وهذا المستودع موثَّقٌ كلُّه**. وحارسٌ يُصيب في الحكم
 *     ويُضلّ في العلاج قريبٌ من المادة ٠: يُكلّف كلَّ مخالفةٍ مستقبليةٍ مطاردةً في غير موضعها.
 *
 * **والعلاجُ إصلاحٌ لا تخفيف**: تُستبدل الكتلةُ بأسطرٍ فارغةٍ **بعددها**، فتبقى المخالفةُ
 * مرئيةً كما كانت **ويصير موضعُها صحيحاً**. الحارسُ بعده يمسك ما كان يمسكه **وزيادة**.
 */
function blankKeepingLines(match, filler = " ") {
  return `${filler}${"\n".repeat((match.match(/\n/g) ?? []).length)}`
}

/**
 * يزيل التعليقات والسلاسل النصية حتى لا تُحسب أمثلةُ التوثيق مخالفاتٍ.
 * **والسلسلةُ القالبية متعددةُ الأسطر تُعامَل معاملةَ الكتلة** — فهي مصدرُ الانهيار نفسِه.
 */
export function stripCommentsAndStrings(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => blankKeepingLines(m))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/`(?:\\.|[^`\\])*`/g, (m) => blankKeepingLines(m, '""'))
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

/**
 * يزيل التعليقات **ويُبقي السلاسل** — لازمٌ لبوابات تفحص مسار الاستيراد أو نص SQL،
 * فتلك تعيش داخل سلاسل نصية أصلاً؛ وإزالتها كانت تُعمي البوابة عن المخالفة نفسها.
 *
 * **وتحفظ عددَ الأسطر كذلك** (CR-023): العطبُ كان في الدالّتين — نصُّ القرار سمّى إحداهما،
 * والجذرُ واحد («كتلةٌ تُستبدل بمسافة»). و**هذه أوسعُ أثراً**: تستعملها G12 وG13 وG17 وG18
 * وG20 وG22، وأربعٌ منها تبلّغ بأرقام أسطر. **فإصلاحُ إحداهما دون أختها ترقيعٌ** (المادة ١/١)،
 * ويترك خمسَ بواباتٍ تدلّ على الموضع الخطأ. **أُعلن هذا التوسيع ولا أُخفيه.**
 */
export function stripCommentsOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => blankKeepingLines(m))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
}

export function fail(gate, title, violations) {
  console.error(`\n✗ ${gate} — ${title}`)
  for (const v of violations) console.error(`   • ${v}`)
  console.error(`\n   المخالفات: ${violations.length}\n`)
  process.exit(1)
}

export function pass(gate, title, note = "") {
  console.log(`✓ ${gate} — ${title}${note ? ` (${note})` : ""}`)
}
