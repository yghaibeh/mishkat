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
      },
    },
  },
})
