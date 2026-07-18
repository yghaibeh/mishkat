import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// إعداد اختبارات منفصل عن vite.config (المُدار) — بيئة node + مسارات @/.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});
