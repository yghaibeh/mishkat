import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text-summary", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/generated/**", "src/routes/**"],
      thresholds: {
        // TESTING_POLICY §٣ — أرضية تصعد ولا تهبط
        lines: 85,
        branches: 85,
        "src/authorization/**": { lines: 100, branches: 100, functions: 100, statements: 100 },
        // **المال لا يُساهَل فيه** (T7): خدماتُ الدفتر عتبتُها ٩٥٪ أسطراً وأفرعاً.
        "src/features/ledger/services/**": {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
        // وطبقةُ بياناتِه معها — فثوابتُ الذرّية والتكامل المرجعيّ تعيش هناك.
        "src/features/ledger/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
      },
    },
  },
})
