// ويبهوك تيليغرام — يلتقط chat_id للشخص عبر deep-link «/start <token>» ويخزّنه لإيصال الإشعارات.
import { eq } from "drizzle-orm";
import { useDb } from "./utils/db";
import { personContacts } from "./database/schema";
import { sendTelegram } from "./services/notifications";

type Env = { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_WEBHOOK_SECRET?: string };

// يُعالج POST /api/telegram/webhook؛ يُعيد Response أو null (ليكمل SSR)
export async function handleTelegramRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method !== "POST" || url.pathname !== "/api/telegram/webhook") return null;

  // تحقّق أمنيّ: رأس تيليغرام السرّيّ يجب أن يطابق السرّ المُسجَّل عند setWebhook
  if (!env.TELEGRAM_WEBHOOK_SECRET || request.headers.get("x-telegram-bot-api-secret-token") !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const update = (await request.json().catch(() => null)) as { message?: { chat?: { id: number }; text?: string } } | null;
  const msg = update?.message;
  const chatId = msg?.chat?.id;
  const text = (msg?.text ?? "").trim();

  if (chatId && text.startsWith("/start")) {
    const token = text.split(/\s+/)[1] ?? "";
    const db = useDb();
    const now = Date.now();
    const pc = token ? (await db.select().from(personContacts).where(eq(personContacts.linkToken, token)).all())[0] : undefined;
    const botToken = env.TELEGRAM_BOT_TOKEN ?? "";
    if (pc && (pc.linkExpires ?? 0) > now) {
      await db.update(personContacts)
        .set({ telegram: String(chatId), linkToken: null, linkExpires: null })
        .where(eq(personContacts.personId, pc.personId)).run();
      if (botToken) await sendTelegram(botToken, String(chatId), "تمّ ربط حسابك بمشكاة ✅ ستصلك الإشعارات هنا بإذن الله.");
    } else if (botToken) {
      await sendTelegram(botToken, String(chatId), "رابطٌ منتهٍ أو غير صحيح. أعد المحاولة من زرّ «ربط تيليغرام» في التطبيق.");
    }
  }
  return Response.json({ ok: true });
}
