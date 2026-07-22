/**
 * G23 — **ميزانيةُ التحميل** (CR-026 ب · قب-٤٨).
 *
 * ### لماذا وُجدت
 * العقودُ متزامنة، فكلُّ ما يقرؤه المنطق يجب أن يكون **محمَّلاً سلفاً**. وثمنُ ذلك — بنصّ
 * مسوّدة CR-026 — أن *«كلَّ قراءةٍ جديدةٍ في خدمةٍ ما قد توسّع النطاق **صامتاً** حتى يُبلَغ
 * سقفُ الذاكرة **في الميدان لا في CI**»*. ورفض المدير قلبَ المعمار وقال: **يُنزع الصمت**.
 * فهذه البوابةُ هي نزعُ الصمت: «مفاجأةٌ بعد سنة» تصير **بناءً أحمرَ في الدقيقة**.
 *
 * ### ثلاثةُ أوجهٍ لا وجهٌ واحد
 *  ١. **كلُّ وحدة عملٍ تُعلن سقفَها** — والقائمةُ **مشتقّةٌ من مجلد المستودعات** لا مسرودةٍ
 *     هنا (CR-011/قب-٣٦: *بوابةٌ تُسرد لها الحقيقةُ تتخلّف عن الواقع حتماً*). مستودعٌ جديد
 *     في T26-ب بلا سقف ⟵ **أحمر**، ولا ينتظر أحدٌ أن يتذكّر تحديثَ قائمة.
 *  ٢. **السقفُ ثابتٌ مُسنَدٌ لا رقمٌ في مكانه**: قيمةٌ حرفيةٌ في جسم المصنع رقمٌ بلا مسوّغ،
 *     ومَن لا يعرف من أين جاء السقفُ لا يستطيع أن يقرّر عند بلوغه (نظيرُ إسناد G13).
 *  ٣. **والقياسُ يجري فعلاً**: تُشغَّل `tests/db/load-budget.test.ts` — فلا تكون البوابةُ
 *     إحصاءَ نصوص. الحارسُ في `UnitOfWork.hydrate` يرمي، والاختبارُ يُثبت أنه يرمي
 *     **ويُسمّي** الوحدةَ والعددَ والسقف.
 *
 * **والزنادُ مكتوبٌ لا شفويّ** (قب-٤٨ · `db/README.md`): أولُ إخفاقٍ يتعذّر إصلاحُه بتضييق
 * النطاق ⟵ CR-026 يُعاد فتحه والتحويلُ إلى عقودٍ غيرِ متزامنة يُنفَّذ.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT, fail, pass, rel, stripCommentsOnly } from "./_lib.mjs"

const repositoriesDir = join(ROOT, "src/db/repositories")
const budgetTest = join(ROOT, "tests/db/load-budget.test.ts")
const violations = []

if (!existsSync(repositoriesDir)) {
  fail("G23", "ميزانية التحميل", ["لا مجلدَ مستودعاتٍ يُقرأ — والحارسُ يحمرّ عند الغموض"])
}

// ── ١) القائمةُ تُشتقّ من المجلد ولا تُسرد ────────────────────────────────────
const files = readdirSync(repositoriesDir).filter((f) => f.endsWith(".ts"))
const factories = []
for (const file of files) {
  const path = join(repositoriesDir, file)
  const source = readFileSync(path, "utf8")
  const code = stripCommentsOnly(source)
  for (const match of code.matchAll(/export function (persistent\w+)\s*\(/g)) {
    factories.push({ name: match[1], file, path, source, code, at: match.index })
  }
}

if (factories.length === 0) {
  violations.push("لا مصنعَ مستودعٍ واحدٍ يُقرأ — تعذّر اشتقاق القائمة، والحارسُ يحمرّ عند الغموض")
}

for (const factory of factories) {
  const body = factory.code.slice(factory.at)
  const declared = /\n\s*rowBudget:\s*([\w.]+)\s*,/.exec(body)
  if (declared === null) {
    violations.push(
      `${rel(factory.path)} — «${factory.name}» لا يُعلن \`rowBudget\`: ` +
        `كلُّ وحدة عملٍ تُعلن سقفَ صفوفها (CR-026 ب)`,
    )
    continue
  }
  const value = declared[1]

  // ٢) السقفُ ثابتٌ مسمّى — لا قيمةً حرفيةً في جسم المصنع.
  if (/^\d/.test(value)) {
    violations.push(
      `${rel(factory.path)} — «${factory.name}» يُعلن سقفاً حرفياً «${value}»: ` +
        `السقفُ يُعلَن ثابتاً مسمّى في موضعٍ واحد (قاعدة §١٠/CR-011)`,
    )
    continue
  }

  // ٢ب) وللثابت **إسنادٌ** يشرح من أين جاء الرقم — فمن لا يعرف مصدرَه لا يقرّر عند بلوغه.
  const constant = new RegExp(`(/\\*\\*[\\s\\S]*?\\*/\\s*)?const ${value}\\s*=\\s*([\\d_]+)`).exec(
    factory.source,
  )
  if (constant === null) {
    violations.push(
      `${rel(factory.path)} — سقفُ «${factory.name}» (${value}) ليس ثابتاً عددياً معلناً في ملفّه`,
    )
    continue
  }
  const doc = constant[1] ?? ""
  if (!/ADR|CR-\d|قب-\d|§/.test(doc)) {
    violations.push(
      `${rel(factory.path)} — سقفُ «${factory.name}» (${value} = ${constant[2]}) ` +
        `بلا إسناد: يُشتقّ من رقمٍ مقيس (ADR/CR/قب-) لا يُقدَّر`,
    )
  }
}

if (!existsSync(budgetTest)) {
  violations.push("لا اختبارَ للميزانية — بوابةٌ تُحصي نصوصاً ولا تقيس تحميلاً ليست بوابة")
}

if (violations.length) fail("G23", "ميزانية التحميل", violations)

// ── ٣) القياسُ يجري فعلاً ─────────────────────────────────────────────────────
try {
  execFileSync("npx", ["vitest", "run", "tests/db/load-budget.test.ts"], {
    cwd: ROOT,
    stdio: "pipe",
  })
} catch (e) {
  const out = String(e.stdout ?? "") + String(e.stderr ?? "")
  fail(
    "G23",
    "ميزانية التحميل",
    out
      .trim()
      .split("\n")
      .filter((l) => /×|FAIL|Error|ميزانيةُ التحميل/.test(l))
      .slice(0, 8),
  )
}

pass("G23", "ميزانية التحميل", `${factories.length} وحدةَ عملٍ كلُّها تُعلن سقفَها ومقيسةٌ عليه`)
