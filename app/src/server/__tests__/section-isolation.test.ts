import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

// حالة قابلة للحقن في useDb()/currentUser()
const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import * as ala from "@/server/alaBaseera.server";
import * as schema from "@/server/database/schema";
import { createOrgUnit } from "@/server/services/orgUnits";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };

// الفصل التام: قسمان معزولان — رجالٌ (مسجد+حلقة) ونساءٌ (حلقة تتبع المربع)
const menRabita = makeUser("rabita", "men-reg", "/men/men-reg/", { personId: "p-mr" });
const womenRabita = makeUser("rabita", "women-reg", "/women/women-reg/", { personId: "p-wr" });
const admin = makeUser("admin", "root", "/", { personId: "p-admin" });

beforeEach(async () => {
  const t = await createTestDb();
  db = t.db;
  state.db = db;
  const now = 0;
  // شجرة القسمين
  await db.insert(schema.orgUnits).values([
    { id: "men", parentId: null, path: "/men/", type: "section", section: "men", genderTrack: "male", name: "قسم الذكور", status: "active", createdAt: now },
    { id: "men-reg", parentId: "men", path: "/men/men-reg/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة رجال", status: "active", createdAt: now },
    { id: "men-sq", parentId: "men-reg", path: "/men/men-reg/men-sq/", type: "square", section: "men", genderTrack: "male", name: "مربع رجال", status: "active", createdAt: now },
    { id: "men-mosque", parentId: "men-sq", path: "/men/men-reg/men-sq/men-mosque/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد", status: "active", createdAt: now },
    { id: "women", parentId: null, path: "/women/", type: "section", section: "women", genderTrack: "female", name: "قسم النساء", status: "active", createdAt: now },
    { id: "women-reg", parentId: "women", path: "/women/women-reg/", type: "rabita", section: "women", genderTrack: "female", name: "منطقة نساء", status: "active", createdAt: now },
    { id: "women-sq", parentId: "women-reg", path: "/women/women-reg/women-sq/", type: "square", section: "women", genderTrack: "female", name: "مربع نساء", status: "active", createdAt: now },
    { id: "women-halaqa", parentId: "women-sq", path: "/women/women-reg/women-sq/women-halaqa/", type: "halaqa", section: "women", genderTrack: "female", name: "حلقة أم إبراهيم", status: "active", createdAt: now },
  ]).run();
  // أماكن + معلّمون + حلقات (رجال على المسجد، نساء على وحدة الحلقة)
  await db.insert(schema.venues).values([
    { id: "v-men", type: "mosque", name: "مكان رجال", orgUnitId: "men-mosque", genderTrack: "male", createdAt: now },
    { id: "v-women", type: "home", name: "بيت", orgUnitId: "women-halaqa", genderTrack: "female", createdAt: now },
  ]).run();
  await db.insert(schema.teachers).values([
    { id: "t-men", personId: "p-tm", active: true, createdAt: now },
    { id: "t-women", personId: "p-tw", active: true, createdAt: now },
  ]).run();
  await db.insert(schema.halaqat).values([
    { id: "h-men", name: "حلقة رجال", venueId: "v-men", teacherId: "t-men", genderTrack: "male", curriculum: "baseera", capacity: 20, status: "active", createdAt: now },
    { id: "h-women", name: "حلقة أم إبراهيم", venueId: "v-women", teacherId: "t-women", genderTrack: "female", curriculum: "baseera", capacity: 15, status: "active", createdAt: now },
  ]).run();
});

describe("الفصل التام: عزل حلقات «على بصيرة» بين القسمين (سدّ الثغرة)", () => {
  it("مسؤول قسم الذكور يرى حلقات الرجال فقط — لا حلقات النساء", async () => {
    setUser(menRabita);
    const list = await ala.listHalaqat();
    expect(list.items.map((h) => h.id)).toEqual(["h-men"]);
    const kpis = (await ala.alaBaseeraData()).kpis;
    expect(kpis.halaqat).toBe(1);
  });

  it("مسؤولة قسم النساء ترى حلقات النساء فقط — لا حلقات الرجال", async () => {
    setUser(womenRabita);
    const list = await ala.listHalaqat();
    expect(list.items.map((h) => h.id)).toEqual(["h-women"]);
    expect((await ala.alaBaseeraData()).kpis.halaqat).toBe(1);
  });

  it("الإدارة العليا ترى القسم المختار عبر مبدِّل القسم (لا خلط)", async () => {
    setUser(admin);
    expect((await ala.listHalaqat(undefined, 0, "men")).items.map((h) => h.id)).toEqual(["h-men"]);
    expect((await ala.listHalaqat(undefined, 0, "women")).items.map((h) => h.id)).toEqual(["h-women"]);
    expect((await ala.alaBaseeraData("women")).kpis.halaqat).toBe(1);
  });
});

describe("الإنشاء: القسم يُورَّث من الأب ويُمنع الخلط بين القسمين", () => {
  it("إنشاء «حلقة نسائية» تحت مربع نساء ⇒ يرث القسم women", async () => {
    const res = await createOrgUnit(db, { parentId: "women-sq", type: "halaqa", genderTrack: "female", name: "حلقة نسائية — أم زيد" });
    expect(res.section).toBe("women");
  });
  it("إنشاء «مسجد» تحت قسم النساء ⇒ مرفوض", async () => {
    await expect(createOrgUnit(db, { parentId: "women-sq", type: "mosque", genderTrack: "female", name: "مسجد" })).rejects.toThrow();
  });
  it("إنشاء «حلقة نسائية» تحت قسم الذكور ⇒ مرفوض", async () => {
    await expect(createOrgUnit(db, { parentId: "men-sq", type: "halaqa", genderTrack: "male", name: "حلقة" })).rejects.toThrow();
  });
  it("إنشاء «مسجد» تحت مربع ذكور ⇒ يرث القسم men", async () => {
    const res = await createOrgUnit(db, { parentId: "men-sq", type: "mosque", genderTrack: "male", name: "مسجد جديد" });
    expect(res.section).toBe("men");
  });
});
