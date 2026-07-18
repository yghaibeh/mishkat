// الجولة السادسة (س٢/الرصد) — حدُّ محاولات الدخول + ذرّيّة إنشاء الحساب في الاعتماد.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { isRateLimited, recordFailedAttempt, resetAttempts } from "@/server/services/authTokens";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;

beforeEach(async () => { db = (await createTestDb()).db; state.db = db; });

describe("س٢: حدُّ محاولات الدخول (٥ في ربع ساعة)", () => {
  it("خمسُ محاولاتٍ فاشلةٍ تُفعّل الحدّ، والتصفيرُ يرفعه", async () => {
    const key = "login:target";
    expect(await isRateLimited(db as never, key)).toBe(false);
    for (let i = 0; i < 5; i++) await recordFailedAttempt(db as never, key);
    expect(await isRateLimited(db as never, key)).toBe(true);
    await resetAttempts(db as never, key);
    expect(await isRateLimited(db as never, key)).toBe(false);
  });

  it("انتهاءُ النافذة (١٥ دقيقة) يرفع الحدّ تلقائيًّا", async () => {
    const key = "login:window";
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) await recordFailedAttempt(db as never, key, t0);
    expect(await isRateLimited(db as never, key, t0 + 60_000)).toBe(true); // خلال النافذة
    expect(await isRateLimited(db as never, key, t0 + 16 * 60_000)).toBe(false); // بعدها
  });
});

describe("الرصد: إنشاءُ الحساب في اعتماد التسجيل ذرّيٌّ (لا حسابَ يتيم)", () => {
  it("اعتمادُ طلبٍ يُنشئ الشخص والحساب والتكليف معًا", async () => {
    const admin = makeUser("admin", "root", "/", { personId: "p-admin", userId: "u-admin" });
    await db.insert(schema.orgUnits).values([
      { id: "men", parentId: null, path: "/men/", type: "section", section: "men", genderTrack: "male", name: "ذكور", status: "active", createdAt: 0 },
      { id: "m1", parentId: "men", path: "/men/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد", status: "active", createdAt: 0 },
    ]).run();
    await db.insert(schema.roleAssignments).values({ id: "ra-a", personId: "p-admin", role: "admin", orgUnitId: "root", orgPath: "/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 }).run();
    const { submitRegistrationData, approveRegistrationData } = await import("@/server/registration.server");
    state.user = admin as unknown as FakeUser;
    const r = await submitRegistrationData({ kind: "amir", fullName: "أميرُ الحيّ", gender: "male", login: "hay.amir", password: "P@ssw0rd123", targetUnitId: "m1" });
    const ok = await approveRegistrationData((r as { token: string }).token);
    expect("ok" in ok && ok.ok).toBe(true);
    const user = (await db.select().from(schema.users).where(eq(schema.users.login, "hay.amir")).all())[0];
    expect(user).toBeTruthy();
    const ra = (await db.select().from(schema.roleAssignments).where(eq(schema.roleAssignments.personId, user.personId)).all())[0];
    expect(ra.role).toBe("amir");
    const person = (await db.select().from(schema.persons).where(eq(schema.persons.id, user.personId)).all())[0];
    expect(person.fullName).toBe("أميرُ الحيّ");
  });
});
