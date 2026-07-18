// مسؤولُ اللجنة: إسنادٌ بحساب دخولٍ (login+password) + إدارةُ خطّته + عزلُ النطاق عن لجانٍ أخرى. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import * as cm from "@/server/committees.server";
import { verifyPassword } from "@/server/utils/auth";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const PATH = "/men/idlib/sq1/m1/";
const amir = makeUser("amir", "m1", PATH, { personId: "p-amir", userId: "u-amir" });

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db; state.user = null;
  await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: PATH, type: "mosque", section: "men", genderTrack: "male", name: "الفاروق", status: "active", createdAt: 0 }).run();
  await db.insert(schema.committees).values({ id: "c1", mosqueId: "m1", name: "لجنة الدعوة", type: "main", status: "active", createdAt: 0 }).run();
  await db.insert(schema.committees).values({ id: "c2", mosqueId: "m1", name: "لجنة الإغاثة", type: "main", status: "active", createdAt: 0 }).run();
});

describe("مسؤولُ اللجنة (TDD)", () => {
  it("الأميرُ يُسند مسؤولًا بحساب دخولٍ جديد (يُربَط باللجنة)", async () => {
    setUser(amir);
    const r = await cm.assignCommitteeHeadData({ committeeId: "c1", newHead: { fullName: "المسؤول زيد", login: "zaid", password: "secret123" } }) as { ok?: boolean; newAccount?: { login: string }; error?: string };
    expect(r.ok).toBe(true);
    expect(r.newAccount?.login).toBe("zaid");
    const user = (await db.select().from(schema.users).where(eq(schema.users.login, "zaid")).all())[0];
    expect(await verifyPassword("secret123", user.passwordHash)).toBe(true);
    const c = (await db.select().from(schema.committees).where(eq(schema.committees.id, "c1")).all())[0];
    expect(c.headPersonId).toBe(user.personId);
    expect(c.headName).toBe("المسؤول زيد");
    const ra = (await db.select().from(schema.roleAssignments).where(eq(schema.roleAssignments.personId, user.personId)).all())[0];
    expect(ra.role).toBe("committee_head");
    expect(ra.portfolio).toBe("c1");
  });

  it("مسؤولُ اللجنة يرى لجنتَه ويُدير خطّتها، ولا يمسّ لجنةً أخرى", async () => {
    setUser(amir);
    await cm.assignCommitteeHeadData({ committeeId: "c1", newHead: { fullName: "زيد", login: "zaid", password: "secret123" } });
    const head = (await db.select().from(schema.users).where(eq(schema.users.login, "zaid")).all())[0];
    const headUser: FakeUser = { userId: head.id, personId: head.personId, fullName: "زيد", assignments: [{ role: "committee_head", orgUnitId: "m1", orgPath: PATH, portfolio: "c1" }] };

    setUser(headUser);
    // «لجنتي» تُظهر لجنتَه وحدها
    const mine = await cm.myCommitteesData();
    expect(mine.items.length).toBe(1);
    expect(mine.items[0].id).toBe("c1");
    // يضيف بندَ خطّةٍ للجنته
    const p = await cm.addCommitteePlanData({ committeeId: "c1", title: "حملة دعوية", recurring: true }) as { ok?: boolean; id?: string };
    expect(p.ok).toBe(true);
    // لا يستطيع إضافةَ بندٍ للجنة أخرى (ليس مسؤولها)
    await expect(cm.addCommitteePlanData({ committeeId: "c2", title: "تسلّل" })).rejects.toThrow();
    // يُبدّل حالةَ بندِ خطّته
    const s = await cm.setCommitteePlanStatusData({ planId: p.id!, status: "done" }) as { ok?: boolean };
    expect(s.ok).toBe(true);
  });

  it("اسمٌ نصّيٌّ بلا حساب: يُحفَظ headName دون إنشاء مستخدم", async () => {
    setUser(amir);
    await cm.assignCommitteeHeadData({ committeeId: "c2", headName: "أبو محمد" });
    const c = (await db.select().from(schema.committees).where(eq(schema.committees.id, "c2")).all())[0];
    expect(c.headName).toBe("أبو محمد");
    expect(c.headPersonId).toBeNull();
    expect((await db.select().from(schema.users).all()).length).toBe(0);
  });
});
