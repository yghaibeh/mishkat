/**
 * إثبات البوابات بالفشل — لا بالادعاء.
 *
 * لكل بوابة: يُزرع كودٌ مخالفٌ مصطنع في الشجرة، وتُشغَّل البوابة، ويُتحقق أنها **فشلت**،
 * ثم يُزال الزرع ويُتحقق أنها **رجعت خضراء**. بوابةٌ لا تفشل على مخالفة ليست بوابة —
 * بل ديكور. (المادة ٠: لا قاعدة بلا بوابة… والبوابة تُثبت لا تُدّعى.)
 */
import { execFileSync } from "node:child_process"
import { writeFileSync, unlinkSync, existsSync, readFileSync, mkdirSync, rmSync } from "node:fs"
import { join, dirname } from "node:path"
import { ROOT } from "./_lib.mjs"

const only = process.argv[2] ?? null

/** كل زرع: ملفٌ يُكتب مؤقتاً، أو تعديلٌ يُطبَّق ويُسترجع. */
const PROOFS = [
  {
    gate: "G1", script: "g1-tsc.mjs",
    what: "نوعٌ مخالف: إسناد نص إلى رقم",
    file: "src/shared/__violation__.ts",
    content: `export const target: number = "سبعون"\n`,
  },
  {
    gate: "G2", script: "g2-eslint.mjs",
    what: "قفز طبقات: route يستورد من db مباشرة",
    file: "src/routes/__violation__.ts",
    content: `import type { OrgUnitRepository } from "../db/repositories/contracts.js"\nexport type X = OrgUnitRepository\n`,
  },
  {
    gate: "G3", script: "g3-any-tsignore.mjs",
    what: "استعمال any وتعطيل فحص الأنواع",
    file: "src/shared/__violation__.ts",
    content: `// @ts-ignore\nexport function f(x: any) {\n  return x\n}\n`,
  },
  {
    gate: "G4", script: "g4-tests-coverage.mjs",
    what: "اختبار فاشل في الطقم",
    file: "tests/engine/__violation__.test.ts",
    content: `import { describe, it, expect } from "vitest"\nimport { contains } from "../../src/authorization/scope.js"\ndescribe("زرعٌ مخالف", () => {\n  it("يدّعي أن المنطقة ١ تحتوي المنطقة ١٠", () => {\n    expect(contains("/men/r1/", "/men/r10/")).toBe(true)\n  })\n})\n`,
  },
  {
    gate: "G5", script: "g5-golden-matrix.mjs",
    what: "تحرير خلية في المصفوفة الذهبية بلا اعتماد",
    patch: {
      file: "src/authorization/matrix/authorization.matrix.json",
      apply: (src) => {
        const m = JSON.parse(src)
        m.matrix.amir.push("finance.supervise")
        return JSON.stringify(m, null, 2)
      },
    },
  },
  {
    gate: "G6", script: "g6-no-role-checks.mjs",
    what: "فحص دور خارج المحرك",
    file: "src/services/__violation__.ts",
    content: `export function guard(role: string): boolean {\n  return role === "admin"\n}\n`,
  },
  {
    gate: "G7", script: "g7-declared-serverfns.mjs",
    what: "دالة خادم بلا إعلان قدرة",
    file: "src/server/__violation__.server.ts",
    content: `export async function deleteEverything(): Promise<void> {\n  return undefined\n}\n`,
  },
  {
    gate: "G8", script: "g8-smoke.mjs",
    what: "كسر رحلة الدخان",
    patch: {
      file: "src/routes/login.ts",
      apply: (src) => src.replace('submitLabelAr: "دخول"', 'submitLabelAr: "Login"'),
    },
  },
  {
    gate: "G9", script: "g9-role-matrix-e2e.mjs",
    what: "شاشة جديدة بلا مصفوفة متصفح",
    file: "src/routes/__violation__.ts",
    content: `export const finance = "شاشة مالية بلا مصفوفة أدوار"\n`,
  },
  {
    gate: "G10", script: "g10-migrations.mjs",
    what: "هجرة غير مرقّمة وبلا اختبار",
    file: "src/db/migrations/create_tables.sql",
    content: `CREATE TABLE x (id TEXT);\n`,
  },
  {
    gate: "G11", script: "g11-secrets.mjs",
    what: "سرّ مكتوب نصاً في الكود",
    file: "src/shared/__violation__.ts",
    // يُبنى بالتركيب كي لا يُطابق ملفُ الإثبات نفسَه نمطَ البوابة (وإلا صار خط الأساس أحمر).
    content: `export const ${"JWT"}_SECRET = "${"s3cr3t"}-value-committed-by-mistake"\n`,
  },
  {
    gate: "G12", script: "g12-bundle-guard.mjs",
    what: "استيراد ديناميكي للمخطط (وريث ns=0)",
    file: "src/shared/__violation__.ts",
    content: `export async function load() {\n  return await import("../db/schema.js")\n}\n`,
  },
  {
    gate: "G13", script: "g13-spec-present.mjs",
    what: "وحدة ميزة بلا مواصفة",
    file: "src/features/points/points.ts",
    content: `export const points = 1\n`,
  },
  {
    gate: "G14", script: "g14-no-hard-numbers.mjs",
    what: "رقم تشغيلي صلب في طبقة الخدمات",
    file: "src/services/__violation__.ts",
    content: `export function meetsTarget(score: number): boolean {\n  return score >= 70\n}\n`,
  },
  {
    gate: "G15", script: "g4-tests-coverage.mjs",
    what: "منطق تصنيف التسليم الجوهري (يُثبت باختبارٍ نقيّ لا بالتزامٍ مصطنع في المستودع)",
    patch: {
      file: "tools/gates/g15-classify.mjs",
      apply: (src) => src.replace('"v2/src/authorization/matrix/",', ""),
    },
  },
  {
    gate: "G16", script: "g16-public-routes-ceiling.mjs",
    what: "مسار عام ثالث خارج القائمة البيضاء",
    patch: {
      file: "src/server/publicRoutes.ts",
      apply: (src) => src.replace('"registration.publicRequest",', '"registration.publicRequest",\n  "search.publicEverything",'),
    },
  },
  {
    gate: "G17", script: "g17-db-import-boundary.mjs",
    what: "استيراد Drizzle خارج طبقة البيانات",
    file: "src/services/__violation__.ts",
    content: `import { eq } from "drizzle-orm"\nexport const op = eq\n`,
  },
  {
    gate: "G18", script: "g18-query-params-ceiling.mjs",
    what: "استعلام بأكثر من ٨٠ معاملاً مربوطاً",
    file: "src/db/__violation__.ts",
    content: `export const sql = "SELECT * FROM t WHERE id IN (${Array(95).fill("?").join(",")})"\n`,
  },
  {
    gate: "G19", script: "g19-spec-matrix-table.mjs",
    what: "تحريف جدول §٣.٣ في المواصفة: إعادةُ finance.entry لـ section_head (الانحراف الذي قتله CR-005)",
    patch: {
      file: "../rebuild/specs/SPEC_authorization.md",
      apply: (src) =>
        src.replace(
          "| ٣٦ | `finance.entry` | و | · | · | · | · | · | · | · | · | ✓ | · |",
          "| ٣٦ | `finance.entry` | و | · | ✓ | · | · | · | · | · | · | ✓ | · |",
        ),
    },
  },
]

function runGate(script) {
  try {
    execFileSync("node", [join(ROOT, "tools/gates", script)], { cwd: ROOT, stdio: "pipe" })
    return { failed: false, output: "" }
  } catch (e) {
    return { failed: true, output: (String(e.stdout ?? "") + String(e.stderr ?? "")).trim() }
  }
}

const results = []
for (const p of PROOFS) {
  if (only && p.gate !== only) continue

  // خط الأساس: البوابة خضراء قبل الزرع.
  const before = runGate(p.script)

  let restore = null
  if (p.patch) {
    const abs = join(ROOT, p.patch.file)
    const original = readFileSync(abs, "utf8")
    writeFileSync(abs, p.patch.apply(original), "utf8")
    restore = () => writeFileSync(abs, original, "utf8")
  } else {
    const abs = join(ROOT, p.file)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, p.content, "utf8")
    restore = () => {
      if (existsSync(abs)) unlinkSync(abs)
      if (p.file.startsWith("src/features/")) rmSync(join(ROOT, "src/features/points"), { recursive: true, force: true })
      if (p.file.startsWith("src/db/migrations/")) rmSync(join(ROOT, "src/db/migrations"), { recursive: true, force: true })
    }
  }

  const during = runGate(p.script)
  restore()
  // المصفوفة تولّد مشتقات: استرجاعُ الملف وحده لا يكفي — تُعاد المزامنة قبل قياس «خضراء بعد».
  try {
    execFileSync("node", [join(ROOT, "tools/generate/emit-derived.mjs")], { cwd: ROOT, stdio: "pipe" })
  } catch { /* لا مولّد لهذه البوابة */ }
  const after = runGate(p.script)

  results.push({
    gate: p.gate,
    what: p.what,
    greenBefore: !before.failed,
    redOnViolation: during.failed,
    greenAfter: !after.failed,
    evidence: during.output.split("\n").filter((l) => l.includes("•") || l.includes("✗")).slice(0, 3),
  })
}

let bad = 0
console.log("\n═══ إثبات البوابات بالفشل ═══\n")
for (const r of results) {
  const ok = r.greenBefore && r.redOnViolation && r.greenAfter
  if (!ok) bad++
  console.log(`${ok ? "✓" : "✗"} ${r.gate} — ${r.what}`)
  console.log(`    خضراء قبل: ${r.greenBefore ? "نعم" : "لا"} · فشلت على المخالفة: ${r.redOnViolation ? "نعم" : "لا"} · خضراء بعد الإزالة: ${r.greenAfter ? "نعم" : "لا"}`)
  for (const e of r.evidence) console.log(`    ${e.trim()}`)
  console.log("")
}
if (bad) {
  console.error(`✗ ${bad} بوابة لم تُثبت حراستها`)
  process.exit(1)
}
console.log(`✓ ${results.length} بوابة أثبتت الفشل على مخالفة مصطنعة ثم عادت خضراء`)
