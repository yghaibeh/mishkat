// حارسُ سجلّ الواجهات (الوثيقة ٣٧ §٥): لا شاشةَ بلا مواصفةٍ مكتوبة.
// كلُّ مسارٍ في src/routes يجب أن يملك ملفَّ مواصفةٍ في product/ui/ — والمعادُ بناؤه يجب ألّا يكون draft.
// LEGACY: شاشاتُ ما قبل إعادة البناء — تنكمشُ دفعةً بعد دفعة (الخطة ٣٢ م٦) حتى تفرغ.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = join(HERE, "..", "..", "routes");
const UI_DIR = join(HERE, "..", "..", "..", "..", "product", "ui");

// مساراتٌ تقنيّةٌ لا شاشات (غلاف/حراسة) — لا تحتاج مواصفة
const TECHNICAL = new Set(["__root", "no-access"]);

// شاشات ما قبل إعادة البناء (تُحذف من هنا عند إعادة بناء كلٍّ منها — بوابةُ دفعتها)
const LEGACY = new Set([
  "index", "login", "register", "manhaj", "student.$token",
  "network", "network.index", "network.$unitId", "mosque.$mosqueId",
  "finance", "admin", "ala-baseera", "competition", "duties",
  "library", "media-hub", "my-circles", "my-committee", "design-system",
]);

function routeNames(): string[] {
  return readdirSync(ROUTES_DIR)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(/\.tsx$/, ""))
    .filter((n) => !TECHNICAL.has(n));
}

function specFor(route: string): { file: string; status: string | null } | null {
  if (!existsSync(UI_DIR)) return null;
  for (const f of readdirSync(UI_DIR).filter((x) => x.endsWith(".md"))) {
    const body = readFileSync(join(UI_DIR, f), "utf8");
    const m = body.match(/^route:\s*(.+)$/m);
    const routePath = "/" + route.replace(/\.index$/, "").replace(/\./g, "/").replace(/\$/g, "$");
    if (m && m[1].trim() === (route === "index" ? "/" : routePath)) {
      const s = body.match(/^status:\s*(\S+)/m);
      return { file: f, status: s ? s[1] : null };
    }
  }
  return null;
}

describe("سجل الواجهات — البروتوكول ٣٧", () => {
  it("كل شاشة معاد بناؤها لها مواصفة معتمدة (غير draft)", () => {
    const missing: string[] = [];
    for (const r of routeNames()) {
      if (LEGACY.has(r)) continue;
      const spec = specFor(r);
      if (!spec) missing.push(`${r}: لا ملف مواصفة في product/ui/`);
      else if (spec.status === "draft") missing.push(`${r}: المواصفة ما تزال draft (${spec.file})`);
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("قائمة LEGACY لا تحوي مسارات غير موجودة (تنظّف مع كل دفعة)", () => {
    const names = new Set(routeNames());
    const stale = [...LEGACY].filter((l) => !names.has(l));
    expect(stale, `أزل من LEGACY: ${stale.join(", ")}`).toEqual([]);
  });

  it("كل ملف مواصفة له frontmatter صالح (id/route/roles/status)", () => {
    if (!existsSync(UI_DIR)) return;
    for (const f of readdirSync(UI_DIR).filter((x) => x.endsWith(".md"))) {
      const body = readFileSync(join(UI_DIR, f), "utf8");
      for (const key of ["id:", "route:", "roles:", "status:"]) {
        expect(body.includes(key), `${f} ينقصه ${key}`).toBe(true);
      }
    }
  });
});
