import js from "@eslint/js"
import tseslint from "typescript-eslint"
import { layersPlugin } from "./tools/eslint-layers.mjs"

export default tseslint.config(
  { ignores: ["node_modules/**", "coverage/**", "dist/**", "src/authorization/generated/**", "tools/gates/__violations__/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    plugins: { layers: layersPlugin },
    rules: {
      "layers/boundaries": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-console": ["error", { allow: ["error"] }],
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: { "no-console": "off" },
  },
  {
    // ملفات الأدوات تعمل على Node: تُعرَّف عولمياتها صراحةً بدل تعطيل القاعدة.
    files: ["tools/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", URL: "readonly" },
    },
    rules: { "no-console": "off" },
  },
)
