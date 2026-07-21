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
        // **والصندوقُ مالٌ كذلك** (T8): خدماتُه عتبتُها ٩٥٪، وطبقةُ بياناته معها.
        "src/features/box/services/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
        "src/features/box/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        // **ومحرّكُ الاعتماد قلبُ النظام** (T9/قب-٢٩): كلُّ موافقةٍ تمرّ به ⇒ عتبتُه ٩٥٪.
        "src/features/approval/services/**": {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
        "src/features/approval/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        // **والنقاطُ مالٌ مباشرةً** (ق-٣٣، T10): خدماتُ سجل اليوم عتبتُها ٩٥٪، وطبقةُ بياناته معها.
        "src/features/dailyLog/services/**": {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
        "src/features/dailyLog/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        // **والمحتوى المنشور لا يُسترجَع بعد أن يُرى** (T13): خدماتُ الإعلام — النسبةُ والعزلُ
        // وتحقّقُ الرفع — عتبتُها ٩٥٪، وطبقةُ بياناتها معها.
        "src/features/media/services/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
        "src/features/media/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
      },
    },
  },
})
