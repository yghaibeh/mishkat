// حارس قاموس فئات المكتبة (الحقيقة الواحدة): كل مفتاح تستعمله البذرة موجود في القاموس —
// يمنع عودة الأكواد الإنجليزية الخام (management/leadership — بلاغ المالك ٢٠٢٦-٠٧-١٨).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MATERIAL_CATEGORIES, materialCategoryLabel } from "@/lib/material-categories";

const HERE = dirname(fileURLToPath(import.meta.url));

describe("قاموس فئات المكتبة", () => {
  it("كل فئة في مولّد البذرة معرَّبة في القاموس", () => {
    const gen = readFileSync(join(HERE, "..", "..", "..", "scripts", "gen-seed.mjs"), "utf8");
    const mat = gen.match(/const MAT = \[[\s\S]*?\];/)?.[0] ?? "";
    const keys = [...mat.matchAll(/", "([a-z_]+)", "(?:pdf|link|audio)"/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(MATERIAL_CATEGORIES, `فئة «${k}» بلا تعريب`).toHaveProperty(k);
  });

  it("السقوط الآمن: مفتاح مجهول لا يظهر خاماً بل «أخرى»", () => {
    expect(materialCategoryLabel("some_unknown")).toBe("أخرى");
    expect(materialCategoryLabel("leadership")).toBe("قيادة وإمارة");
  });
});
