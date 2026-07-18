import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { setCloudflareEnv } from "./server/utils/db";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// س٣ (أمن): ترويساتُ حمايةٍ على كلّ استجابة SSR — منعُ التأطير (clickjacking)، ومنعُ استنشاق النوع،
// وتقييدُ المُحيل، وفرضُ HTTPS. (CSP مؤجّلٌ لأنّ التطبيق يستخدم سكربتاتٍ مضمّنةً تحتاج ضبطًا دقيقًا.)
function withSecurityHeaders(res: Response): Response {
  const h = new Headers(res.headers);
  h.set("X-Frame-Options", "DENY");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // حقن ربط Cloudflare (D1 وغيره) ليقرأه خادم البيانات عبر useDb()
      if (env && typeof env === "object") setCloudflareEnv(env as Record<string, unknown>);
      // مساري الوسائط (رفع/خدمة مرفقات الدروس على R2) قبل تسليم SSR
      const { handleMediaRequest } = await import("./server/media.server");
      const media = await handleMediaRequest(request, env as { MEDIA?: never; JWT_SECRET?: string });
      if (media) return media;
      // ويبهوك تيليغرام (التقاط chat_id للإشعارات)
      const { handleTelegramRequest } = await import("./server/telegram.server");
      const tg = await handleTelegramRequest(request, env as { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_WEBHOOK_SECRET?: string });
      if (tg) return tg;
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }));
    }
  },

  // مُشغّل Cloudflare Cron (F2): تذكيرات الإدخال + تصعيد الاعتماد المتأخّر.
  // يُجدول في wrangler.toml ([triggers] crons). إدراجٌ مُتكرّر بلا تكرار (idempotent).
  async scheduled(_event: unknown, env: unknown, _ctx: unknown) {
    try {
      if (env && typeof env === "object") setCloudflareEnv(env as Record<string, unknown>);
      const { runDueTasksData } = await import("./server/scheduled.server");
      const res = await runDueTasksData();
      console.log("[cron] runDueTasks", JSON.stringify(res));
    } catch (error) {
      console.error("[cron] failed", error);
    }
  },
};
