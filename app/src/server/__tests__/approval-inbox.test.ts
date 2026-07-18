import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { pendingApprovalsData, rejectUnitPendingData } from "@/server/data.server";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const admin = makeUser("admin", "root", "/", { personId: "p-admin" });

// شجرة: منطقة حلب ← مربع المدينة ← مسجدان؛ ومنطقة إدلب ← مربع ← مسجد
beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  const now = 0;
  const units = [
    { id: "aleppo", parentId: null, path: "/men/aleppo/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة حلب", status: "active", createdAt: now },
    { id: "sq", parentId: "aleppo", path: "/men/aleppo/sq/", type: "square", section: "men", genderTrack: "male", name: "مربع المدينة", status: "active", createdAt: now },
    { id: "m1", parentId: "sq", path: "/men/aleppo/sq/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد النور", status: "active", createdAt: now },
    { id: "idlib", parentId: null, path: "/men/idlib/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة إدلب", status: "active", createdAt: now },
    { id: "m2", parentId: "idlib", path: "/men/idlib/m2/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد إدلب", status: "active", createdAt: now },
  ];
  await db.insert(schema.orgUnits).values(units).run();
  // تكليفاتٌ إشرافيّةٌ فعليّة (ق1-د: NESSA يُحسَب من الجدول): منطقة حلب + منطقة إدلب مُكلَّفتان؛
  // مربعُ حلب موجودٌ لكن بلا مُكلَّفٍ (شاغر) ⇒ NESSA لمسجد النور = منطقةُ حلب (الأقربُ المُكلَّف).
  await db.insert(schema.roleAssignments).values([
    { id: "ra-al", personId: "p-al", role: "rabita", orgUnitId: "aleppo", orgPath: "/men/aleppo/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "ra-id", personId: "p-id", role: "rabita", orgUnitId: "idlib", orgPath: "/men/idlib/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
  ]).run();
  // تقريرٌ مُقدَّم (amir_approved) لكلّ مسجد + تقريرٌ مسودة لا يظهر
  await db.insert(schema.weeklyRecords).values([
    { id: "wr1", mosqueId: "m1", mosquePath: "/men/aleppo/sq/m1/", unitId: "m1", unitPath: "/men/aleppo/sq/m1/", weekStart: "2026-06-27", hijriMonth: "1447-12", schemeId: "s1", totalPoints: 60, status: "amir_approved", locked: false, lastEntryAt: 10, createdAt: 0 },
    { id: "wr2", mosqueId: "m2", mosquePath: "/men/idlib/m2/", unitId: "m2", unitPath: "/men/idlib/m2/", weekStart: "2026-06-27", hijriMonth: "1447-12", schemeId: "s1", totalPoints: 40, status: "amir_approved", locked: false, lastEntryAt: 20, createdAt: 0 },
    { id: "wr3", mosqueId: "m1", mosquePath: "/men/aleppo/sq/m1/", unitId: "m1", unitPath: "/men/aleppo/sq/m1/", weekStart: "2026-07-04", hijriMonth: "1447-12", schemeId: "s1", totalPoints: 20, status: "draft", locked: false, lastEntryAt: 5, createdAt: 0 },
  ]).run();
});

describe("صندوق «بانتظار اعتمادك» (ق1-د: الطبقة الأقرب فقط)", () => {
  it("المدير العام لا يرى الصندوقَ الروتينيّ (اطّلاعٌ فقط) ما دامت الطبقاتُ مُكلَّفة", async () => {
    setUser(admin);
    const r = await pendingApprovalsData();
    expect(r.items).toEqual([]);
  });

  it("منطقةُ حلب هي الأقربُ لمسجدها (المربعُ شاغر) فتراه؛ ولا ترى إدلب", async () => {
    setUser(makeUser("rabita", "aleppo", "/men/aleppo/", { personId: "p-al" }));
    const r = await pendingApprovalsData();
    expect(r.items.map((x) => x.unitId)).toEqual(["m1"]);
    expect(r.items[0].weeks).toBe(1);        // المسودة لا تُحتسب
    expect(r.items[0].points).toBe(60);
  });

  it("حين يُكلَّف المربعُ يصير هو الأقرب: المربعُ يرى مسجده والمنطقةُ لا تراه في الصندوق الروتينيّ", async () => {
    await db.insert(schema.roleAssignments).values({ id: "ra-sq", personId: "p-sq", role: "square", orgUnitId: "sq", orgPath: "/men/aleppo/sq/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 }).run();
    setUser(makeUser("square", "sq", "/men/aleppo/sq/", { personId: "p-sq" }));
    expect((await pendingApprovalsData()).items.map((x) => x.unitId)).toEqual(["m1"]);
    // المنطقةُ لم تعُد الأقرب ⇒ صندوقُها الروتينيّ خالٍ (تتدخّل بالنزول عند الحاجة)
    setUser(makeUser("rabita", "aleppo", "/men/aleppo/", { personId: "p-al" }));
    expect((await pendingApprovalsData()).items).toEqual([]);
  });

  it("الأمير (لا طبقة إشراف) لا يرى صندوق اعتماد", async () => {
    setUser(makeUser("amir", "m1", "/men/aleppo/sq/m1/", { personId: "p-amir" }));
    const r = await pendingApprovalsData();
    expect(r.items).toEqual([]);
  });
});

describe("«لا يُعتمد — بالتعليل» من الصندوق", () => {
  it("يرفض كلَّ المُقدَّم للوحدة بسببٍ يعود مسودةً، ويُشعر أمير المسجد، ويختفي من الصندوق", async () => {
    // أمير المسجد m1 — ليتلقّى الإشعار
    await db.insert(schema.roleAssignments).values({ id: "ra-amir", personId: "p-amir-m1", role: "amir", orgUnitId: "m1", orgPath: "/men/aleppo/sq/m1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 }).run();
    setUser(makeUser("rabita", "aleppo", "/men/aleppo/", { personId: "p-al", userId: "u-al" }));
    const noReason = await rejectUnitPendingData("m1", "  ");
    expect("error" in noReason && noReason.error).toContain("إلزاميّ");
    const r = await rejectUnitPendingData("m1", "الأرقام لا تطابق كشف الحضور");
    expect("rejected" in r && r.rejected).toBe(1);
    // عاد مسودةً بسببه
    const rec = (await db.select().from(schema.weeklyRecords).where(eq(schema.weeklyRecords.id, "wr1")).all())[0];
    expect(rec.status).toBe("draft");
    expect(rec.rejectionReason).toBe("الأرقام لا تطابق كشف الحضور");
    // إشعار week_rejected للأمير
    const notifs = (await db.select().from(schema.notifications).all()).filter((n) => n.kind === "week_rejected");
    expect(notifs.length).toBe(1);
    expect(notifs[0].personId).toBe("p-amir-m1");
    // اختفى من الصندوق
    expect((await pendingApprovalsData()).items.map((x) => x.unitId)).toEqual([]);
  });

  it("مَن ليس الطبقةَ الأقرب لا يرفضها", async () => {
    setUser(makeUser("rabita", "idlib", "/men/idlib/", { personId: "p-id", userId: "u-id" }));
    const r = await rejectUnitPendingData("m1", "سبب");
    expect("error" in r && r.error).toContain("الأقرب");
  });
});
