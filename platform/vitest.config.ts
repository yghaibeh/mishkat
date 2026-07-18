import { defineConfig } from 'vitest/config'

// نتجاوز tsconfig المُولّد من Nuxt أثناء اختبارات الوحدة النقية
export default defineConfig({
  esbuild: { tsconfigRaw: '{}' },
  test: {
    include: ['test/**/*.test.ts'],
  },
})
