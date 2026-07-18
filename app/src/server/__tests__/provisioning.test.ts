// توفيرُ الحسابات: إنشاءُ مستخدمٍ بدخولٍ وكلمة مرور ودورٍ مُنطاق + معلّم حلقة + مسؤول لجنة. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { provisionUser, provisionTeacher, provisionCommitteeHead } from "@/server/services/provisioning";
import { verifyPassword } from "@/server/utils/auth";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: "/men/idlib/sq1/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد الفاروق", status: "active", createdAt: 0 }).run();
});

describe("توفيرُ الحسابات (TDD)", () => {
  it("إنشاءُ مستخدمٍ يُنشئ شخصًا + دخولًا مُجزّأً + تكليفَ دورٍ مُنطاق", async () => {
    const r = await provisionUser(db as never, { fullName: "المعلّم أحمد", gender: "male", login: "Ahmad.T", password: "secret123", role: "teacher", orgUnitId: "m1" });
    expect(r.login).toBe("ahmad.t"); // يُخفَّض حرفيًّا
    const user = (await db.select().from(schema.users).where(eq(schema.users.id, r.userId)).all())[0];
    expect(user.login).toBe("ahmad.t");
    expect(await verifyPassword("secret123", user.passwordHash)).toBe(true); // كلمةُ المرور مُجزّأةٌ لا نصّيّة
    const person = (await db.select().from(schema.persons).where(eq(schema.persons.id, r.personId)).all())[0];
    expect(person.fullName).toBe("المعلّم أحمد");
    const ra = (await db.select().from(schema.roleAssignments).where(eq(schema.roleAssignments.personId, r.personId)).all())[0];
    expect(ra.role).toBe("teacher");
    expect(ra.orgPath).toBe("/men/idlib/sq1/m1/");
    expect(ra.approvalStatus).toBe("approved");
  });

  it("يرفض دخولًا مكرّرًا أو قصيرًا أو بكلمة مرورٍ ضعيفة أو وحدةٍ مجهولة", async () => {
    await provisionUser(db as never, { fullName: "أحمد الأوّل", gender: "male", login: "taken", password: "secret123", role: "teacher", orgUnitId: "m1" });
    await expect(provisionUser(db as never, { fullName: "أحمد الثاني", gender: "male", login: "taken", password: "secret123", role: "teacher", orgUnitId: "m1" })).rejects.toThrow(); // مكرّر
    await expect(provisionUser(db as never, { fullName: "أحمد الثالث", gender: "male", login: "ab", password: "secret123", role: "teacher", orgUnitId: "m1" })).rejects.toThrow(); // قصير
    await expect(provisionUser(db as never, { fullName: "أحمد الرابع", gender: "male", login: "okname", password: "123", role: "teacher", orgUnitId: "m1" })).rejects.toThrow(); // كلمة مرور ضعيفة
    await expect(provisionUser(db as never, { fullName: "أحمد الخامس", gender: "male", login: "okname2", password: "secret123", role: "teacher", orgUnitId: "ghost" })).rejects.toThrow(); // وحدة مجهولة
  });

  it("معلّمُ حلقةٍ جديد: حسابٌ بدور teacher + سجلُّ معلّمٍ يُسنَد للحلقة", async () => {
    const r = await provisionTeacher(db as never, { mosqueOrgUnitId: "m1", fullName: "المعلّم خالد", gender: "male", login: "khaled", password: "secret123" });
    const teacher = (await db.select().from(schema.teachers).where(eq(schema.teachers.id, r.teacherId)).all())[0];
    expect(teacher.personId).toBe(r.personId);
    expect(teacher.active).toBe(true);
    const ra = (await db.select().from(schema.roleAssignments).where(eq(schema.roleAssignments.personId, r.personId)).all())[0];
    expect(ra.role).toBe("teacher");
  });

  it("مسؤولُ لجنةٍ جديد: حسابٌ بدور committee_head + ربطُ اللجنة به", async () => {
    await db.insert(schema.committees).values({ id: "c1", mosqueId: "m1", name: "لجنة الدعوة", type: "main", status: "active", createdAt: 0 }).run();
    const r = await provisionCommitteeHead(db as never, { committeeId: "c1", mosqueOrgUnitId: "m1", fullName: "المسؤول عمر", gender: "male", login: "omar", password: "secret123" });
    const committee = (await db.select().from(schema.committees).where(eq(schema.committees.id, "c1")).all())[0];
    expect(committee.headPersonId).toBe(r.personId);
    expect(committee.headName).toBe("المسؤول عمر");
    const ra = (await db.select().from(schema.roleAssignments).where(eq(schema.roleAssignments.personId, r.personId)).all())[0];
    expect(ra.role).toBe("committee_head");
    expect(ra.portfolio).toBe("c1"); // مُنطاقٌ باللجنة
  });
});
