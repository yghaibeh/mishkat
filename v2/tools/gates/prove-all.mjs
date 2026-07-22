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
    /**
     * **نقطةُ اللاعودة الأولى** (ADR-001 §٦-١): جدولُ بياناتٍ يدخل المخطط بلا مفتاح توجيه.
     * إن مرّ هذا صامتاً صار إصلاحُه لاحقاً **هجرةَ بياناتٍ على جداول العمليات كلِّها**.
     * والقائمةُ **مشتقّةٌ من المخطط** (CR-011): الجدولُ المزروع لم يكن معروفاً للبوابة.
     */
    gate: "G10", script: "g10-migrations.mjs",
    what: "**جدولُ بياناتٍ بلا مفتاح توجيه** يدخل المخطط (ع-٥ — نقطةُ اللاعودة)",
    file: "src/db/migrations/9002_violation.sql",
    content:
      `CREATE TABLE IF NOT EXISTS box_handovers (\n` +
      `  tenant_id TEXT NOT NULL,\n` +
      `  id        TEXT NOT NULL,\n` +
      `  entry_id  TEXT NOT NULL,\n` +
      `  PRIMARY KEY (tenant_id, id)\n` +
      `);\n`,
    evidenceMustMatch: /box_handovers ينقصه unit_path/,
  },
  {
    // لا يكفي وجودُ العمود: استعلامُ «كلُّ ما تحت هذه العقدة» أشيعُ استعلامٍ في النظام،
    // وبلا فهرسٍ مركّبٍ يصير مسحاً كاملاً — والحارسُ يقيس الفهرسَ لا النيّة.
    gate: "G10", script: "g10-migrations.mjs",
    what: "مفتاحُ توجيهٍ **بلا فهرسه** — عمودٌ يُرضي الحرفَ ويخون الغرض",
    file: "src/db/migrations/9003_violation.sql",
    content:
      `CREATE TABLE IF NOT EXISTS box_categories (\n` +
      `  tenant_id TEXT NOT NULL,\n` +
      `  unit_path TEXT NOT NULL,\n` +
      `  id        TEXT NOT NULL,\n` +
      `  PRIMARY KEY (tenant_id, id)\n` +
      `);\n`,
    evidenceMustMatch: /box_categories ينقصه فهرسٌ/,
  },
  {
    gate: "G10", script: "g10-migrations.mjs",
    what: "**مزيةُ محرّكٍ خاصة** في الهجرة (`JSONB`) — تنقض لهجةَ القاسم المشترك (ع-٣)",
    file: "src/db/migrations/9004_violation.sql",
    content:
      `CREATE TABLE IF NOT EXISTS box_payloads (\n` +
      `  tenant_id TEXT NOT NULL,\n` +
      `  unit_path TEXT NOT NULL,\n` +
      `  id        TEXT NOT NULL,\n` +
      `  body      JSONB NOT NULL,\n` +
      `  PRIMARY KEY (tenant_id, id)\n` +
      `);\n` +
      `CREATE INDEX IF NOT EXISTS idx_box_payloads_routing ON box_payloads (tenant_id, unit_path);\n`,
    evidenceMustMatch: /JSONB/,
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
    gate: "G13", script: "g13-spec-present.mjs",
    what: "**دالة خادم مُعلَنة غير مذكورة في مواصفة وحدتها** (سطحٌ خارج عقده — CR-007)",
    file: "src/features/org/server/__violation__.server.ts",
    content: `import { defineServerFn } from "../../../server/defineServerFn.js"\n\nexport const ghostFn = defineServerFn({\n  name: "orgUnit.ghost",\n  capability: "orgUnit.manage",\n  intent: "write",\n  audit: "orgUnit.ghost",\n  handler: async () => undefined,\n})\n`,
  },
  {
    gate: "G13", script: "g13-spec-present.mjs",
    what: "**مواصفةٌ بلا إسناد قرار** (لا قب- ولا CR- ولا مواصفةٌ حاكمة — CR-007)",
    file: "src/features/points/SPEC.md",
    content: `# وحدة الميزة: النقاط (points)\n\nوحدةٌ تحسب نقاط الأسبوع وتعرضها. تصف نفسها سرداً حسناً وتُطيل، لكنها **لا تستند إلى أي قرارٍ**\nولا إلى أي طلب تغييرٍ ولا إلى عقدٍ حاكمٍ في دليل المواصفات — فهي وصفٌ لا عقد.\n\n## ما تفعله الوحدة\n\nتجمع مدخلات السجل اليومي وتحوّلها نقاطاً، ثم تعرض حصيلة الأسبوع في بطاقةٍ واحدة.\nهذا النصّ طويلٌ بما يكفي لتجاوز حدّ «أقصر من أن تكون عقداً»، وهذا مقصودٌ في الزرع:\nالمخالفةُ المطلوب اصطيادها هي **غياب الإسناد** لا قِصَر النصّ.\n`,
  },
  {
    gate: "G14", script: "g14-no-hard-numbers.mjs",
    what: "رقم تشغيلي صلب في طبقة الخدمات",
    file: "src/services/__violation__.ts",
    content: `export function meetsTarget(score: number): boolean {\n  return score >= 70\n}\n`,
  },
  {
    /**
     * **CR-023/قب-٤٦ §٣ — البوابةُ تدلّ على الموضع الحقيقيّ.**
     *
     * لا يكفي أن تحمرّ: **حارسٌ يُصيب في الحكم ويُضلّ في العلاج** يُكلّف كلَّ مخالفةٍ
     * مطاردةً في غير موضعها. فالزرعُ هنا **مخالفةٌ تسبقها كتلةُ توثيقٍ متعددةُ الأسطر**،
     * والمطلوب أن تُبلَّغ **بسطرها الحقيقيّ** — وهو ما كان مستحيلاً قبل الإصلاح.
     */
    gate: "G14", script: "g14-no-hard-numbers.mjs",
    what: "**التبليغُ بالسطر الحقيقيّ** بعد كتلة توثيقٍ متعددة الأسطر (CR-023)",
    file: "src/services/__violation__.ts",
    content:
      `/**\n * كتلةُ توثيقٍ متعددةُ الأسطر — ثمانيةُ أسطرٍ عمداً.\n *\n * قبل CR-023 كانت تُستبدل بمسافةٍ واحدة، فتنهار أرقامُ الأسطر\n * ويصير التبليغُ عن السطر الخطأ. وهذا الزرعُ يقيس ذلك بالضبط:\n * المخالفةُ في السطر التاسع، والبوابةُ يجب أن تقول «التاسع».\n */\n` +
      `export function meetsTarget(score: number): boolean {\n` +
      `  return score >= 70\n` +
      `}\n`,
    // ٧ أسطرِ توثيق + سطرُ التعريف ⇒ **`return score >= 70` في السطر ٩**.
    evidenceMustMatch: /__violation__\.ts:9 —/,
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
  {
    gate: "G20", script: "g20-ui-contract.mjs",
    what: "شاشةُ ميزةٍ بلا عقدٍ مسجَّل (وريثُ ui-registry — ق-١١٣)",
    file: "src/features/points/screens/screens.ts",
    content: `export function pointsScreen(): string {\n  return "x"\n}\n`,
  },
  {
    gate: "G20", script: "g20-ui-contract.mjs",
    what: "قيمةٌ بصرية خام في مكوّن (خارج مِلفّ الرموز — §١-٩)",
    file: "src/ui/components/__violation__.ts",
    content: `export const style = { color: "#2E6B4F", padding: "13px" }\n`,
  },
  {
    gate: "G20", script: "g20-ui-contract.mjs",
    what: "نصٌّ عربيٌّ حرفيٌّ في القشرة (خارج طبقة النصوص — §٥-٣)",
    file: "src/ui/shell/__violation__.ts",
    content: `export const heading = "الرئيسية"\n`,
  },
  {
    gate: "G20", script: "g20-ui-contract.mjs",
    what: "**دورٌ يرى ما خارج عدسته**: عنصرٌ يُعرَض بلا شرط قدرته (البُعد الدلاليّ)",
    patch: {
      file: "src/features/home/screens/screens.ts",
      // إزالةُ الشرط تجعل بطاقةَ «هدف الأسبوع» تظهر لكل دورٍ — فيرى المعلّمُ والطالبُ
      // فعلاً بقدرة `dailyLog.edit` ليست لهما: تسريبُ عدسةٍ يجب أن تمسكه G20.
      apply: (src) => src.replace('if (caps.has("dailyLog.edit")) {', "if (true) {"),
    },
  },
  {
    gate: "G20", script: "g20-ui-contract.mjs",
    what: "مكوّنٌ خارج المكتبة المغلقة (§٦-١)",
    file: "src/ui/components/__violation2__.ts",
    content: `export const banner = { component: "FancyCarousel", capability: "network.view" }\n`,
  },
  {
    gate: "G22", script: "g22-approval-engine-only.mjs",
    what: "**فحصُ «من يعتمد؟» في وحدة ميزة** (وريثُ `approvalRouting` المبعثر في v1 — ق-١)",
    file: "src/features/box/services/__violation__.ts",
    content: `export function approverLayerFor(unitPath: string): string {\n  return unitPath.split("/").slice(0, -2).join("/") + "/"\n}\n`,
  },
  {
    gate: "G22", script: "g22-approval-engine-only.mjs",
    what: "**حالةُ اعتمادٍ تُدار خارج المحرّك** (آلةُ حالاتٍ ثانية — ق-٥)",
    file: "src/features/ledger/services/__violation__.ts",
    content: `export type ClosingRow = {\n  readonly id: string\n  readonly approvalState: "draft" | "submitted" | "approved"\n}\n`,
  },
  {
    gate: "G22", script: "g22-approval-engine-only.mjs",
    what: "**استهلاكُ قدرةِ اعتمادٍ خارج المحرّك** (قرارٌ في غير موطنه — §٤.٢)",
    file: "src/features/org/services/__violation__.ts",
    content: `export const requiredCapability = "box.closing.approve"\n`,
  },
  {
    gate: "G22", script: "g22-approval-engine-only.mjs",
    // **إثباتُ CR-011**: لا يكفي أن تحمرّ البوابةُ على قدرةٍ يعرفها كاتبُها سلفاً؛ المطلوب
    // أن تحمرّ على قدرةِ **نوعٍ سُجِّل بعدها** — فتثبت أن الحراسة **تتبع النمو تلقائياً**
    // ولا تنتظر أن يتذكّر أحدٌ تحديثَ قائمة. يُزرع نوعٌ جديد في موضع التسجيل المعلن،
    // وتُستهلَك قدرتُه في وحدة ميزة: قبل الاشتقاق كانت البوابةُ **خضراء** على هذا الزرع.
    what: "**قدرةُ اعتمادٍ لنوعٍ سُجِّل حديثاً** تُستهلَك خارج المحرّك (CR-011: الحراسةُ تتبع النمو)",
    files: [
      {
        path: "src/features/approval/registered/__violation__.ts",
        content: `import { defineApprovalType } from "../registry.js"\n\nexport const PLANTED = defineApprovalType({\n  id: "planted.payout",\n  entityAr: "نوعٌ مزروعٌ للإثبات",\n  scopeKind: "unit",\n  submitCapability: "finance.payout",\n  approveCapability: "finance.approve",\n  overrideCapability: null,\n  retractCapability: null,\n  uniquePerPeriod: true,\n  payloadRequired: true,\n  approvalLocks: true,\n  rejectionReturnsToDraft: true,\n  rejectionRequiresReason: true,\n})\n`,
      },
      {
        path: "src/features/org/services/__violation2__.ts",
        content: `export const requiredCapability = "finance.approve"\n`,
      },
    ],
  },
  {
    /**
     * **الوجهُ الأول لـG23**: السقفُ يُقاس على تحميلٍ حقيقيّ لا يُدَّعى. يُضيَّق سقفُ الشجرة
     * إلى صفٍّ واحد، فيجب أن تحمرّ البوابةُ **مسمّيةً وحدةَ العمل** — لا «تجاوزٌ» مجهول.
     */
    gate: "G23", script: "g23-load-budget.mjs",
    what: "**وحدةُ عملٍ تتجاوز سقفَها** ⟵ بناءٌ أحمر يُسمّيها ويقول كم حمّلت (CR-026 ب)",
    patch: {
      file: "src/db/repositories/orgRepository.ts",
      apply: (src) => src.replace("const ROW_BUDGET = 20_000", "const ROW_BUDGET = 1"),
    },
    evidenceMustMatch: /وحدةُ عمل «org»/,
  },
  {
    /**
     * **الوجهُ الثاني — CR-011 مطبَّقاً**: القائمةُ **مشتقّةٌ من مجلد المستودعات**، فمستودعٌ
     * جديد (وهو ما ستفعله T26-ب **ثلاث عشرة مرّة**) بلا سقفٍ يحمرّ **بلا أن يتذكّر أحدٌ
     * تحديثَ قائمة**. وقبل الاشتقاق كانت البوابةُ ستخضرّ على هذا الزرع.
     */
    gate: "G23", script: "g23-load-budget.mjs",
    what: "**مستودعٌ سُجِّل حديثاً بلا سقف** ⟵ تحمرّ تلقائياً (CR-011: الحراسةُ تتبع النمو)",
    file: "src/db/repositories/__violation__.ts",
    content:
      `import type { PersistentStore } from "../unitOfWork.js"\n\n` +
      `export function persistentPlanted(): Omit<PersistentStore, "rowBudget"> {\n` +
      `  return {\n` +
      `    name: "planted",\n` +
      `    tables: ["org_units"],\n` +
      `    project: () => new Map(),\n` +
      `    load: () => undefined,\n` +
      `  }\n` +
      `}\n`,
    evidenceMustMatch: /«persistentPlanted» لا يُعلن/,
  },
  {
    /**
     * **الوجهُ الثالث**: سقفٌ بلا إسنادٍ رقمٌ مُقدَّر لا مقيس — ومَن لا يعرف من أين جاء
     * السقفُ لا يستطيع أن يقرّر عند بلوغه (نظيرُ «مواصفةٌ بلا إسناد قرار» في G13).
     */
    gate: "G23", script: "g23-load-budget.mjs",
    what: "**سقفٌ بلا إسناد** — رقمٌ مُقدَّرٌ لا مشتقٌّ من قياس (ADR/CR/قب-)",
    patch: {
      file: "src/db/repositories/orgRepository.ts",
      apply: (src) =>
        src.replace(
          /\/\*\*[\s\S]*?\*\/\nconst ROW_BUDGET = 20_000/,
          "const ROW_BUDGET = 20_000",
        ),
    },
    evidenceMustMatch: /بلا إسناد/,
  },
  {
    gate: "G22", script: "g22-approval-engine-only.mjs",
    // **الوجهُ الثاني لـCR-011**: بوابةٌ تشتقّ قائمتَها صارت تعتمد على الكود الذي تحرسه —
    // فالضمانةُ أن **تحمرّ عند الغموض** لا أن تخضرّ. يُغمَّض حقلُ قدرةٍ في إعلان نوعٍ
    // مسجَّل (لا يبقى نصّاً يُقرأ) ⇒ يجب أن تفشل البوابةُ معلنةً أن الاشتقاق أعمى.
    what: "**اشتقاقٌ أعمى**: حقلُ قدرةِ بتٍّ لا يُقرأ نصّاً ⇒ تحمرّ ولا تخضرّ عند الغموض (CR-011)",
    patch: {
      file: "src/features/approval/registered/supervisionVisit.ts",
      apply: (src) => src.replace('approveCapability: "visit.approve"', "approveCapability: HIDDEN"),
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
  if (p.files) {
    // زرعٌ بأكثر من ملف: المخالفةُ نفسُها قد تحتاج **سياقاً** (نوعٌ يُسجَّل ثم يُستهلَك).
    const paths = p.files.map((f) => join(ROOT, f.path))
    for (const [i, f] of p.files.entries()) {
      mkdirSync(dirname(paths[i]), { recursive: true })
      writeFileSync(paths[i], f.content, "utf8")
    }
    restore = () => {
      for (const abs of paths) if (existsSync(abs)) unlinkSync(abs)
    }
  } else if (p.patch) {
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
      // **لا يُمحى مجلدُ الهجرات**: كان يُمحى كلُّه عند الاسترجاع لأنه كان فارغاً يوم كُتب
      // هذا الهيكل — ومنذ T25 فيه هجرةٌ مشحونة، فمحوُه كان سيحذف المخطط نفسَه.
      // إزالةُ الملفّ المزروع وحدَه تكفي، وخُضرةُ «بعد الإزالة» تُثبت ذلك.
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
    // **ولا يكفي أن تحمرّ**: بندٌ يشترط نصّاً في التبليغ يُقاس عليه (CR-023).
    evidenceOk: p.evidenceMustMatch === undefined || p.evidenceMustMatch.test(during.output),
    evidenceExpected: p.evidenceMustMatch === undefined ? null : String(p.evidenceMustMatch),
    evidence: during.output.split("\n").filter((l) => l.includes("•") || l.includes("✗")).slice(0, 3),
  })
}

let bad = 0
console.log("\n═══ إثبات البوابات بالفشل ═══\n")
for (const r of results) {
  const ok = r.greenBefore && r.redOnViolation && r.greenAfter && r.evidenceOk
  if (!ok) bad++
  console.log(`${ok ? "✓" : "✗"} ${r.gate} — ${r.what}`)
  console.log(`    خضراء قبل: ${r.greenBefore ? "نعم" : "لا"} · فشلت على المخالفة: ${r.redOnViolation ? "نعم" : "لا"} · خضراء بعد الإزالة: ${r.greenAfter ? "نعم" : "لا"}`)
  if (r.evidenceExpected !== null) {
    console.log(`    ودلّت على الموضع الصحيح: ${r.evidenceOk ? "نعم" : `لا — المطلوب ${r.evidenceExpected}`}`)
  }
  for (const e of r.evidence) console.log(`    ${e.trim()}`)
  console.log("")
}
if (bad) {
  console.error(`✗ ${bad} بوابة لم تُثبت حراستها`)
  process.exit(1)
}
console.log(`✓ ${results.length} بوابة أثبتت الفشل على مخالفة مصطنعة ثم عادت خضراء`)
