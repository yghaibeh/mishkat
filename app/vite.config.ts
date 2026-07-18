// إعداد Vite قائمٌ بذاته لـ TanStack Start على Cloudflare (بلا أيّ اعتماد على Lovable).
// يكافئ ما كان يطبّقه غلاف Lovable في وضع الإنتاج: tailwindcss + tsConfigPaths + tanstackStart + viteReact
// + حقن VITE_* + alias «@» + dedupe لـ React/Query + محوّل CSS lightningcss (لتطابق البناء والمعاينة).
// ملاحظة: nitro يُدار داخليًّا عبر @tanstack/react-start، ويكتشف Cloudflare آليًّا من وجود wrangler.toml
// (المخرَج: dist/server/server.js + dist/client كما في wrangler.toml).
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  // حقن متغيّرات البيئة VITE_* في import.meta.env
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define,
    // محوّل CSS موحّد بين dev والبناء (يمنع اختلاف مخرجات مثل -webkit-backdrop-filter)
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: { host: "::", port: 8080 },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // حماية الاستيراد: يمنع كود العميل من استيراد src/server/** أو 'server-only'
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
        // توجيه دخول الخادم إلى src/server.ts (غلاف أخطاء SSR + مسارا الوسائط/الويبهوك)
        server: { entry: "server" },
      }),
      viteReact(),
    ],
  };
});
