import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { saveAssetData, assetsData, saveAssetExpenseData, setAssetStatusData } from "@/server/assets.server";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const admin = makeUser("admin", "root", "/", { personId: "p-admin", userId: "u-admin", fullName: "المدير" });
const student = { userId: "u-s", personId: "p-s", fullName: "طالب", assignments: [{ role: "student", orgUnitId: "m1", orgPath: "/men/a/m1/", portfolio: null }] } as FakeUser;

beforeEach(async () => { db = (await createTestDb()).db; state.db = db; });

describe("ع — العُهدة والأصول", () => {
  it("الإدارة تضيف مركبةً وتسجّل محروقاتها شهريًّا (upsert)، والطالب ممنوع", async () => {
    setUser(student);
    const denied = await saveAssetData({ kind: "vehicle", name: "سيارة" });
    expect("error" in denied && denied.error).toBeTruthy();
    setUser(admin);
    const c = await saveAssetData({ kind: "vehicle", name: "هيونداي H1", details: "لوحة 12345" });
    expect("ok" in c && c.ok).toBe(true);
    const id = (c as { id: string }).id;
    expect((await saveAssetExpenseData({ assetId: id, month: "2026-07", fuelAmount: 150 }) as { ok?: boolean }).ok).toBe(true);
    // upsert نفس الشهر
    expect((await saveAssetExpenseData({ assetId: id, month: "2026-07", fuelAmount: 200, otherAmount: 50 }) as { ok?: boolean }).ok).toBe(true);
    const d = await assetsData();
    if ("error" in d) throw new Error(d.error);
    expect(d.items.length).toBe(1);
    expect(d.items[0].expenses.length).toBe(1);
    expect(d.items[0].expenses[0].fuelAmount).toBe(200);
    expect(d.items[0].totalFuel).toBe(200);
  });

  it("عُهدةٌ شخصيّةٌ بحوزة شخصٍ ثم تُعاد؛ وصيغة الشهر تُفحص", async () => {
    setUser(admin);
    const c = await saveAssetData({ kind: "personal_custody", name: "لابتوب Dell", holderName: "أخ يوسف" });
    const id = (c as { id: string }).id;
    const bad = await saveAssetExpenseData({ assetId: id, month: "07-2026", fuelAmount: 1 });
    expect("error" in bad && bad.error).toContain("YYYY-MM");
    expect((await setAssetStatusData({ id, status: "returned" }) as { ok?: boolean }).ok).toBe(true);
    const d = await assetsData();
    if ("error" in d) throw new Error(d.error);
    expect(d.items[0].status).toBe("returned");
    expect(d.items[0].holderName).toBe("أخ يوسف");
  });
});
