import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, type TestDb } from "./helpers";

// حالة الكوكيّ + قاعدة البيانات قابلة للحقن
const cookies = vi.hoisted(() => ({ store: new Map<string, string>() }));
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({
  useDb: () => state.db,
  getCloudflareEnv: () => ({ JWT_SECRET: "test-secret" }),
  setCloudflareEnv: () => {},
}));
vi.mock("@tanstack/react-start/server", () => ({
  getCookie: (k: string) => cookies.store.get(k),
  setCookie: (k: string, v: string) => cookies.store.set(k, v),
  deleteCookie: (k: string) => cookies.store.delete(k),
}));

import { loginUser, meUser, TOKEN_COOKIE } from "@/server/auth.server";
import { hashPassword, signToken } from "@/server/utils/auth";
import * as schema from "@/server/database/schema";

let db: TestDb;
const PW = "s3cret-pass";

async function seedAccount(opts: { status?: string; withRole?: boolean; roleEnded?: boolean }) {
  const now = 0;
  await db.insert(schema.persons).values({ id: "p1", fullName: "أحمد", gender: "male", status: opts.status ?? "active", createdAt: now }).run();
  await db.insert(schema.users).values({ id: "u1", personId: "p1", login: "ahmad", passwordHash: await hashPassword(PW), createdAt: now }).run();
  if (opts.withRole) {
    await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: "/men/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد", status: "active", createdAt: now }).run();
    await db.insert(schema.roleAssignments).values({
      id: "ra1", personId: "p1", role: "amir", orgUnitId: "m1", orgPath: "/men/m1/",
      startDate: now, endDate: opts.roleEnded ? now : null, approvalStatus: "approved", createdAt: now,
    }).run();
  }
}
const token = (ep?: number) => signToken({ sub: "u1", pid: "p1", ...(ep !== undefined ? { ep } : {}) }, "test-secret");

beforeEach(async () => {
  db = (await createTestDb()).db;
  state.db = db;
  cookies.store.clear();
});

describe("دورة حياة الحساب: الدخول", () => {
  it("حسابٌ فعّال بدورٍ معتمد ⇒ يدخل ويُضبط الكوكيّ", async () => {
    await seedAccount({ withRole: true });
    const r = await loginUser({ login: "ahmad", password: PW });
    expect("ok" in r && r.ok).toBe(true);
    expect(cookies.store.has(TOKEN_COOKIE)).toBe(true);
  });

  it("فصل الحالة عن الصلاحيات: حسابٌ فعّال بلا أدوار ⇒ يدخل (يهبط لاحقًا على /no-access)", async () => {
    await seedAccount({ withRole: false });
    const r = await loginUser({ login: "ahmad", password: PW });
    expect("ok" in r && r.ok).toBe(true); // ليس موقوفًا — فقط بلا صلاحيات بعد
  });

  it("حسابٌ موقوف (disabled) ⇒ يُمنع الدخول برسالة «موقوف» + السبب", async () => {
    await seedAccount({ status: "disabled", withRole: true });
    await db.update(schema.persons).set({ statusReason: "مخالفة" }).where(eq(schema.persons.id, "p1")).run();
    const r = await loginUser({ login: "ahmad", password: PW });
    expect("error" in r && r.error).toContain("موقوف");
    expect("error" in r && r.error).toContain("مخالفة");
    expect(cookies.store.has(TOKEN_COOKIE)).toBe(false);
  });

  it("حسابٌ مُلغى (deleted) ⇒ يُمنع الدخول برسالة «مُلغى»", async () => {
    await seedAccount({ status: "deleted", withRole: true });
    const r = await loginUser({ login: "ahmad", password: PW });
    expect("error" in r && r.error).toContain("مُلغى");
  });

  it("كلمة مرورٍ خاطئة ⇒ رسالةٌ عامّة", async () => {
    await seedAccount({ withRole: true });
    const r = await loginUser({ login: "ahmad", password: "wrong" });
    expect("error" in r && r.error).toContain("غير صحيحة");
  });
});

describe("دورة حياة الحساب: الجلسة (meUser)", () => {
  it("حسابٌ فعّال ⇒ يُعيد الهوية ويُبقي الكوكيّ", async () => {
    await seedAccount({ withRole: true });
    cookies.store.set(TOKEN_COOKIE, await token());
    const me = await meUser();
    expect(me).not.toBeNull();
    expect(cookies.store.has(TOKEN_COOKIE)).toBe(true);
  });

  it("فعّالٌ بلا أدوار ⇒ يبقى مسجَّلًا (بلا صلاحيات) — لا يُطرد", async () => {
    await seedAccount({ withRole: false });
    cookies.store.set(TOKEN_COOKIE, await token());
    const me = await meUser();
    expect(me).not.toBeNull();
    expect(me!.caps.length).toBe(0);           // يهبط على /no-access لا حلقة
    expect(cookies.store.has(TOKEN_COOKIE)).toBe(true);
  });

  it("موقوفٌ أثناء جلسةٍ قائمة ⇒ خروجٌ تلقائيّ (يُحذف الكوكيّ ويُعاد null)", async () => {
    await seedAccount({ status: "disabled", withRole: true });
    cookies.store.set(TOKEN_COOKIE, await token());
    const me = await meUser();
    expect(me).toBeNull();
    expect(cookies.store.has(TOKEN_COOKIE)).toBe(false);
  });

  it("إبطالٌ لحظيّ بـ session_epoch: رفعُ الحقبة يُلغي الرموز القديمة فورًا", async () => {
    await seedAccount({ withRole: true });
    cookies.store.set(TOKEN_COOKIE, await token(0));      // رمزٌ بحقبة 0
    expect(await meUser()).not.toBeNull();
    await db.update(schema.users).set({ sessionEpoch: 1 }).where(eq(schema.users.id, "u1")).run(); // تجميد/تغيير كلمة مرور
    const me = await meUser();
    expect(me).toBeNull();                                 // الرمز القديم أُبطِل
    expect(cookies.store.has(TOKEN_COOKIE)).toBe(false);
  });
});
