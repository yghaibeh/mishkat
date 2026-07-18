// شبكة الإدارة العليا: مبدّلُ القسمين على الجذر — قسمُ النساء يظهر بإنتاجه، ولا اختلاطَ بين القسمين. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { networkData } from "@/server/data.server";
import * as schema from "@/server/database/schema";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const admin = makeUser("admin", "root", "/");

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db; state.user = null;
  const units = [
    { id: "men", parentId: null, path: "/men/", type: "section", section: "men", genderTrack: "male", name: "قسم الذكور" },
    { id: "rm", parentId: "men", path: "/men/rm/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة إدلب" },
    { id: "sqm", parentId: "rm", path: "/men/rm/sqm/", type: "square", section: "men", genderTrack: "male", name: "مربع الرجال" },
    { id: "m1", parentId: "sqm", path: "/men/rm/sqm/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد الفاروق" },
    { id: "women", parentId: null, path: "/women/", type: "section", section: "women", genderTrack: "female", name: "قسم النساء" },
    { id: "rw", parentId: "women", path: "/women/rw/", type: "rabita", section: "women", genderTrack: "female", name: "منطقة حلب النسائية" },
    { id: "sqw", parentId: "rw", path: "/women/rw/sqw/", type: "square", section: "women", genderTrack: "female", name: "مربع النساء" },
    { id: "h1", parentId: "sqw", path: "/women/rw/sqw/h1/", type: "halaqa", section: "women", genderTrack: "female", name: "حلقة أم خالد" },
  ];
  for (const u of units) await db.insert(schema.orgUnits).values({ ...u, status: "active", createdAt: 0 } as never).run();
  // إنتاجُ النساء: سجلُّ أسبوعٍ لحلقة أم خالد بنقاط
  await db.insert(schema.weeklyRecords).values({ id: "wrw", mosqueId: "h1", mosquePath: "/women/rw/sqw/h1/", weekStart: "2026-07-11", schemeId: "s1", totalPoints: 55, createdAt: 0 } as never).run();
});

describe("مبدّلُ القسمين للإدارة على جذر الشبكة (TDD)", () => {
  it("الافتراضُ قسمُ الذكور: مناطقُ الرجال فقط بلا اختلاطٍ بمناطق النساء", async () => {
    setUser(admin);
    const d = await networkData();
    expect(d.leaf).toBe(false);
    if (d.leaf) return;
    expect(d.section).toBe("men");
    expect(d.children.map((c) => c.id)).toEqual(["rm"]); // لا rw
    expect(d.kpis.mosques).toBe(1); // مسجد الفاروق
  });

  it("section=women: مناطقُ النساء بحلقاتهنّ وإنتاجهنّ (النقاط تظهر)", async () => {
    setUser(admin);
    const d = await networkData(undefined, "women");
    if (d.leaf) return;
    expect(d.section).toBe("women");
    expect(d.children.map((c) => c.id)).toEqual(["rw"]); // لا rm
    expect(d.kpis.mosques).toBe(1);                      // حلقةٌ نسائيةٌ واحدة (الورقة)
    expect(d.children[0].mosques).toBe(1);               // تجميعُ المنطقة يلتقط الحلقة
    expect(d.kpis.avgPoints).toBe(55);                   // «إنتاجهم» مرئيّ
  });

  it("الهبوطُ داخل القسم النسائيّ يعمل: المنطقة ⇐ مربعات ⇐ حلقات", async () => {
    setUser(admin);
    const r = await networkData("rw");
    if (r.leaf) return;
    expect(r.section).toBe("women");
    expect(r.children.map((c) => c.id)).toEqual(["sqw"]);
    const s = await networkData("sqw");
    if (s.leaf) return;
    expect(s.children.map((c) => c.id)).toEqual(["h1"]);
    expect(s.children[0].type).toBe("halaqa");
  });

  it("غيرُ الإدارة لا يهرب من نطاقه عبر section: مشرفُ مربعِ رجالٍ يبقى في قسمه", async () => {
    setUser(makeUser("square", "sqm", "/men/rm/sqm/"));
    const d = await networkData(undefined, "women");
    if (d.leaf) return;
    expect(d.section).toBe("men");                       // القسمُ من نطاقه لا من المعامل
    expect(d.children.map((c) => c.id)).toEqual(["m1"]);
  });
});
