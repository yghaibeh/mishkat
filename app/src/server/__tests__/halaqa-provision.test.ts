// الأمير يُنشئ حلقةً ويُوفّر حسابَ معلّمٍ جديد (login+password) يُديرها بنفسه؛ والمعلّمُ لا يُنشئ من الـRPC. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import * as ala from "@/server/alaBaseera.server";
import { verifyPassword } from "@/server/utils/auth";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const MOSQUE_PATH = "/men/idlib/sq1/m1/";

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db; state.user = null;
  await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: MOSQUE_PATH, type: "mosque", section: "men", genderTrack: "male", name: "مسجد الفاروق", status: "active", createdAt: 0 }).run();
  await db.insert(schema.venues).values({ id: "v1", type: "mosque", name: "قاعة", orgUnitId: "m1", genderTrack: "male", createdAt: 0 }).run();
});

const amir = makeUser("amir", "m1", MOSQUE_PATH, { personId: "p-amir", userId: "u-amir" });

describe("الأمير: إنشاءُ حلقةٍ بحساب معلّمٍ جديد (TDD)", () => {
  it("newTeacher يوفّر حسابًا (اسم/دخول/كلمة مرور) + معلّمًا + حلقةً بالمنهج المختار", async () => {
    setUser(amir);
    const res = await ala.createHalaqaData({ name: "حلقة الفجر", venueId: "v1", genderTrack: "male", curriculum: "baseera", newTeacher: { fullName: "المعلّم سعيد", login: "saeed", password: "secret123" } }) as { ok?: boolean; id?: string; newAccount?: { login: string }; error?: string };
    expect(res.ok).toBe(true);
    expect(res.newAccount?.login).toBe("saeed");
    // حسابٌ مُنشأٌ بكلمة مرورٍ مُجزّأة
    const user = (await db.select().from(schema.users).where(eq(schema.users.login, "saeed")).all())[0];
    expect(user).toBeTruthy();
    expect(await verifyPassword("secret123", user.passwordHash)).toBe(true);
    // معلّمٌ مربوطٌ بالحلقة
    const halaqa = (await db.select().from(schema.halaqat).where(eq(schema.halaqat.id, res.id!)).all())[0];
    expect(halaqa.curriculum).toBe("baseera");
    const teacher = (await db.select().from(schema.teachers).where(eq(schema.teachers.personId, user.personId)).all())[0];
    expect(halaqa.teacherId).toBe(teacher.id);
    // دورُ teacher مُنطاقٌ بالمسجد
    const ra = (await db.select().from(schema.roleAssignments).where(eq(schema.roleAssignments.personId, user.personId)).all())[0];
    expect(ra.role).toBe("teacher");
    expect(ra.orgPath).toBe(MOSQUE_PATH);
  });

  it("المعلّمُ الجديد يرى الحلقةَ في «حلقاتي» ويُديرها", async () => {
    setUser(amir);
    await ala.createHalaqaData({ name: "حلقة العصر", venueId: "v1", curriculum: "tahfeez", newTeacher: { fullName: "المعلّم بلال", login: "bilal", password: "secret123" } });
    const user = (await db.select().from(schema.users).where(eq(schema.users.login, "bilal")).all())[0];
    // تسجيلُ دخول المعلّم الجديد (currentUser)
    setUser({ userId: user.id, personId: user.personId, fullName: "المعلّم بلال", assignments: [{ role: "teacher", orgUnitId: "m1", orgPath: MOSQUE_PATH, portfolio: null }] });
    const my = await ala.myCirclesData();
    expect(my.kpis.circles).toBe(1);
    expect(my.items[0].name).toBe("حلقة العصر");
  });

  it("اسمُ الدخول المكرّر يُرفَض برسالةٍ واضحة (لا تُنشأ الحلقة)", async () => {
    setUser(amir);
    await ala.createHalaqaData({ name: "ح١", venueId: "v1", newTeacher: { fullName: "معلّم أوّل", login: "dup", password: "secret123" } });
    const r = await ala.createHalaqaData({ name: "ح٢", venueId: "v1", newTeacher: { fullName: "معلّم ثانٍ", login: "dup", password: "secret123" } }) as { error?: string };
    expect(r.error).toContain("مستخدَم");
    expect((await db.select().from(schema.halaqat).all()).length).toBe(1); // لم تُنشأ الثانية
  });

  it("المعلّمُ لا يستطيع إنشاءَ حلقةٍ عبر مسار الأمير (requireAlaBáseeraManage)", async () => {
    setUser({ userId: "u-t", personId: "p-t", fullName: "معلّم", assignments: [{ role: "teacher", orgUnitId: "m1", orgPath: MOSQUE_PATH, portfolio: null }] });
    await expect(ala.createHalaqaData({ name: "ح", venueId: "v1", teacherId: "any" })).rejects.toThrow();
  });
});
