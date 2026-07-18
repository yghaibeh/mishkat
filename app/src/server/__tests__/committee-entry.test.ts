// إدخال أنشطة اللجنة (ق1 — العدسة ع٧): اللجنة تُدخل فتُحتسب في سجل المسجد بانتظار إقرار الأمير.
// كانت الفجوة: لا مسار إدخال لمسؤول اللجنة (تدقيق ٣٣ ج-٣). القاعدة الحرجة: معرّفات = مقاطع المسار.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { submitCommitteeActivityData, myCommitteeWeekData } from "@/server/committees.server";
import { approveRecord } from "@/server/services/records";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const head = makeUser("committee_head", "m1", "/men/r1/m1/", { personId: "p-head", userId: "u-head" });

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: "/men/r1/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد النور", status: "active", createdAt: 0 }).run();
  await db.insert(schema.activityTypes).values([
    { id: "a-dawah", code: "dawah_visit", name: "زيارة دعوية", genderTrack: "male", category: "social", active: true, sortOrder: 1, maxPerDay: null, minParticipationPct: null },
  ]).run();
  await db.insert(schema.pointsSchemes).values({ id: "s-m", genderTrack: "male", weeklyTarget: 70, validFrom: 0, active: true }).run();
  await db.insert(schema.pointsSchemeItems).values([{ id: "i1", schemeId: "s-m", activityTypeId: "a-dawah", points: 1 }]).run();
  await db.insert(schema.committees).values({ id: "c1", mosqueId: "m1", name: "الدعوة", type: "main", headPersonId: "p-head", status: "active", createdAt: 0 }).run();
});

describe("إدخال أنشطة اللجنة", () => {
  it("مسؤول اللجنة يسجّل نشاطاً ⇒ قيدٌ باسم لجنته في سجل المسجد (مسودة بانتظار الأمير)", async () => {
    setUser(head);
    const r = await submitCommitteeActivityData({ activityTypeId: "a-dawah", count: 3 });
    expect(r.ok).toBe(true);

    const entries = await db.select().from(schema.dailyEntries).where(eq(schema.dailyEntries.mosqueId, "m1")).all();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ enteredByCommittee: "الدعوة", count: 3, points: 3, shuraConfirmed: false });

    let rec = (await db.select().from(schema.weeklyRecords).where(eq(schema.weeklyRecords.mosqueId, "m1")).all())[0];
    expect(rec.status).toBe("draft"); // بانتظار إقرار الأمير ضمن سجله (ق1)
    expect(rec.totalPoints).toBe(0);  // لا تُحتسب قبل إقرار الأمير (قاعدة الشورى)

    const week = await myCommitteeWeekData();
    expect(week).toMatchObject({ committeeName: "الدعوة", recordStatus: "draft", points: 3 });
    expect(week.items[0]).toMatchObject({ activity: "زيارة دعوية", count: 3 });
    expect(week.activities.map((a) => a.id)).toContain("a-dawah");

    // إقرارُ الأمير يشمل بيانات اللجان (ق1) ⇒ تُثبَّت شوراها وتدخل المجموع
    const r2 = await approveRecord(db as never, rec as never, { isAmir: true, isLayer: false, isAdmin: false, userId: "u-amir" });
    expect(r2.status).toBe("amir_approved");
    rec = (await db.select().from(schema.weeklyRecords).where(eq(schema.weeklyRecords.mosqueId, "m1")).all())[0];
    expect(rec.totalPoints).toBe(3);
    const entry = (await db.select().from(schema.dailyEntries).where(eq(schema.dailyEntries.mosqueId, "m1")).all())[0];
    expect(entry.shuraConfirmed).toBe(true);
  });

  it("من لا لجنة له يُرفض", async () => {
    setUser(makeUser("committee_head", "m1", "/men/r1/m1/", { personId: "p-other" }));
    await expect(submitCommitteeActivityData({ activityTypeId: "a-dawah", count: 1 })).rejects.toThrow(/لا لجنة/);
  });

  it("عددٌ غير صالح يُرفض", async () => {
    setUser(head);
    await expect(submitCommitteeActivityData({ activityTypeId: "a-dawah", count: 0 })).rejects.toThrow(/غير صالح/);
  });
});
