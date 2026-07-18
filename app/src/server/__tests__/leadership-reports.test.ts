import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

// حالة قابلة للحقن في useDb()/currentUser()
const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { networkRollupData, networkRollupCsv, auditLogData } from "@/server/data.server";
import * as schema from "@/server/database/schema";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const admin = makeUser("admin", "root", "/", { personId: "p-admin" });

beforeEach(async () => {
  const t = await createTestDb();
  db = t.db; state.db = db;
  const now = 0;
  await db.insert(schema.orgUnits).values([
    { id: "men", parentId: null, path: "/men/", type: "section", section: "men", genderTrack: "male", name: "قسم الذكور", status: "active", createdAt: now },
    { id: "men-reg", parentId: "men", path: "/men/men-reg/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة رجال", status: "active", createdAt: now },
    { id: "men-sq", parentId: "men-reg", path: "/men/men-reg/men-sq/", type: "square", section: "men", genderTrack: "male", name: "مربع رجال", status: "active", createdAt: now },
    { id: "men-mosque", parentId: "men-sq", path: "/men/men-reg/men-sq/men-mosque/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد النور", status: "active", createdAt: now },
    { id: "women", parentId: null, path: "/women/", type: "section", section: "women", genderTrack: "female", name: "قسم النساء", status: "active", createdAt: now },
    { id: "women-reg", parentId: "women", path: "/women/women-reg/", type: "rabita", section: "women", genderTrack: "female", name: "منطقة نساء", status: "active", createdAt: now },
    { id: "women-sq", parentId: "women-reg", path: "/women/women-reg/women-sq/", type: "square", section: "women", genderTrack: "female", name: "مربع نساء", status: "active", createdAt: now },
    { id: "women-halaqa", parentId: "women-sq", path: "/women/women-reg/women-sq/women-halaqa/", type: "halaqa", section: "women", genderTrack: "female", name: "حلقة أم إبراهيم", status: "active", createdAt: now },
  ]).run();
  // سجل أسبوعيّ للحلقة النسائية (مفهرس بوحدة الحلقة كما يفعل getOrCreateWeeklyRecord)
  await db.insert(schema.weeklyRecords).values([
    { id: "wr-w", mosqueId: "women-halaqa", mosquePath: "/women/women-reg/women-sq/women-halaqa/", unitId: "women-halaqa", unitPath: "/women/women-reg/women-sq/women-halaqa/", weekStart: "2026-06-27", schemeId: "s1", totalPoints: 40, status: "draft", locked: false, lastEntryAt: now, createdAt: now },
    { id: "wr-m", mosqueId: "men-mosque", mosquePath: "/men/men-reg/men-sq/men-mosque/", unitId: "men-mosque", unitPath: "/men/men-reg/men-sq/men-mosque/", weekStart: "2026-06-27", schemeId: "s1", totalPoints: 60, status: "draft", locked: false, lastEntryAt: now, createdAt: now },
  ]).run();
});

describe("ر.١ الرولّ-أب القياديّ", () => {
  it("قسم النساء يعدّ الحلقات النسائية (لا «٠ مسجد») بمفردةٍ مُجنَّسة", async () => {
    setUser(admin);
    const r = await networkRollupData({ section: "women" });
    expect(r.section).toBe("women");
    expect(r.leafNoun).toBe("حلقة نسائية");
    expect(r.totals.mosques).toBe(1); // حلقةٌ نسائية واحدة ضمن النطاق
    expect(r.rows.some((x) => x.name === "منطقة نساء")).toBe(true);
  });

  it("قسم الرجال يعدّ المساجد", async () => {
    setUser(admin);
    const r = await networkRollupData({ section: "men" });
    expect(r.leafNoun).toBe("مسجد");
    expect(r.totals.mosques).toBe(1);
  });

  it("CSV يحوي ترويسةً ومجموعًا", async () => {
    setUser(admin);
    const csv = networkRollupCsv(await networkRollupData({ section: "men" }));
    expect(csv).toContain("الوحدة");
    expect(csv).toContain("الإجمالي");
  });
});

describe("ر.٢ عزل سجلّ التدقيق", () => {
  beforeEach(async () => {
    const now = 0;
    // فاعلان: أميرٌ رجاليّ وأميرةٌ نسائية — لكلٍّ حساب/شخص/تكليف ضمن قسمه
    await db.insert(schema.persons).values([
      { id: "p-am", fullName: "أمير النور", gender: "male", createdAt: now },
      { id: "p-aw", fullName: "مشرفة الحلقة", gender: "female", createdAt: now },
    ]).run();
    await db.insert(schema.users).values([
      { id: "u-am", personId: "p-am", login: "am", passwordHash: "x", createdAt: now },
      { id: "u-aw", personId: "p-aw", login: "aw", passwordHash: "x", createdAt: now },
    ]).run();
    await db.insert(schema.roleAssignments).values([
      { id: "ra-am", personId: "p-am", role: "amir", orgUnitId: "men-mosque", orgPath: "/men/men-reg/men-sq/men-mosque/", createdAt: now },
      { id: "ra-aw", personId: "p-aw", role: "amir", orgUnitId: "women-halaqa", orgPath: "/women/women-reg/women-sq/women-halaqa/", createdAt: now },
    ]).run();
    await db.insert(schema.auditLog).values([
      { id: "a1", actorUserId: "u-am", action: "approve", entity: "weekly_record", entityId: "wr-m", before: null, after: null, at: 10 },
      { id: "a2", actorUserId: "u-aw", action: "approve", entity: "weekly_record", entityId: "wr-w", before: null, after: null, at: 20 },
      { id: "a3", actorUserId: null, action: "create", entity: "org_unit", entityId: "men", before: null, after: null, at: 30 },
    ]).run();
  });

  it("الإدارة ترى كل القيود (بما فيها قيود النظام)", async () => {
    setUser(admin);
    const r = await auditLogData({});
    const items = "items" in r ? (r.items ?? []) : [];
    expect(items.length).toBe(3);
  });

  it("مسؤول منطقة الرجال يرى قيود قسمه فقط (لا قيود النساء)", async () => {
    setUser(makeUser("rabita", "men-reg", "/men/men-reg/", { personId: "p-mr" }));
    const r = await auditLogData({});
    const items = "items" in r ? (r.items ?? []) : [];
    const ids = items.map((x) => x.id);
    expect(ids).toContain("a1");       // فاعلٌ ضمن نطاقه
    expect(ids).not.toContain("a2");   // فاعلةٌ في قسم النساء — محجوبة
    expect(ids).not.toContain("a3");   // قيد نظام بلا فاعل — لا يظهر لغير الإدارة
  });

  it("من لا نطاق إشرافيّ له لا يرى شيئًا (لا صلاحية)", async () => {
    setUser(makeUser("amir", "men-mosque", "/men/men-reg/men-sq/men-mosque/", { personId: "p-am2" }));
    const r = await auditLogData({});
    expect("error" in r).toBe(true);
  });
});
