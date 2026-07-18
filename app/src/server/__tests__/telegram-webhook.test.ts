import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { handleTelegramRequest } from "@/server/telegram.server";
import * as schema from "@/server/database/schema";

let db: TestDb;
const SECRET = "webhook-secret";
const req = (body: unknown, secret?: string) => new Request("http://x/api/telegram/webhook", {
  method: "POST",
  headers: secret ? { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret } : { "content-type": "application/json" },
  body: JSON.stringify(body),
});
// env بلا TELEGRAM_BOT_TOKEN ⇒ لا يُرسل عبر الشبكة (نختبر التقاط chat_id فقط)
const env = { TELEGRAM_WEBHOOK_SECRET: SECRET };

beforeEach(async () => {
  db = (await createTestDb()).db;
  state.db = db;
  await db.insert(schema.personContacts).values({ personId: "p1", linkToken: "tok-valid", linkExpires: Date.now() + 60_000 }).run();
  await db.insert(schema.personContacts).values({ personId: "p2", linkToken: "tok-expired", linkExpires: Date.now() - 1000 }).run();
});

describe("ويبهوك تيليغرام: التقاط chat_id بأمان", () => {
  it("سرّ خاطئ ⇒ 403 ولا تغيير", async () => {
    const res = await handleTelegramRequest(req({ message: { chat: { id: 999 }, text: "/start tok-valid" } }, "wrong"), env);
    expect(res?.status).toBe(403);
    const pc = await db.select().from(schema.personContacts).all();
    expect(pc.find((x) => x.personId === "p1")?.telegram).toBeFalsy();
  });

  it("مسارٌ غير الويبهوك ⇒ null (يكمل SSR)", async () => {
    const res = await handleTelegramRequest(new Request("http://x/other", { method: "POST" }), env);
    expect(res).toBeNull();
  });

  it("/start برمزٍ صحيح ⇒ يخزّن chat_id ويمسح الرمز", async () => {
    const res = await handleTelegramRequest(req({ message: { chat: { id: 12345 }, text: "/start tok-valid" } }, SECRET), env);
    expect(res?.status).toBe(200);
    const pc = (await db.select().from(schema.personContacts).all()).find((x) => x.personId === "p1")!;
    expect(pc.telegram).toBe("12345");
    expect(pc.linkToken).toBeNull();
  });

  it("رمزٌ منتهٍ ⇒ لا يُخزَّن chat_id", async () => {
    await handleTelegramRequest(req({ message: { chat: { id: 777 }, text: "/start tok-expired" } }, SECRET), env);
    const pc = (await db.select().from(schema.personContacts).all()).find((x) => x.personId === "p2")!;
    expect(pc.telegram).toBeFalsy();
  });
});
