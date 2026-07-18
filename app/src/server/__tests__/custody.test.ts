// «العُهد»: سلسلةُ الحيازة، وإقرارُ المستلم بنفسه، والعزلُ بالنطاق. TDD.
// القاعدة الحرجة: معرّفات fixtures = مقاطع المسار.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import {
  scopeCustodyData, myCustodyData, custodyTimelineData, assignCustodyData,
  acknowledgeCustodyData, returnCustodyData, reportCustodyData, openCustodyOf,
} from "@/server/custody.server";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const amir = makeUser("amir", "m1", "/men/r1/sq1/m1/", { personId: "p-amir", userId: "u-amir" });
const otherAmir = makeUser("amir", "m2", "/men/r2/m2/", { personId: "p-amir2", userId: "u-amir2" });
const teacher = makeUser("teacher", "m1", "/men/r1/sq1/m1/", { personId: "p-teacher", userId: "u-teacher" });
const admin = makeUser("admin", "root", "/", { personId: "p-admin", userId: "u-admin" });

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db; state.user = null;
  await db.insert(schema.orgUnits).values([
    { id: "r1", parentId: null, path: "/men/r1/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة", status: "active", createdAt: 0 },
    { id: "sq1", parentId: "r1", path: "/men/r1/sq1/", type: "square", section: "men", genderTrack: "male", name: "مربع", status: "active", createdAt: 0 },
    { id: "m1", parentId: "sq1", path: "/men/r1/sq1/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد الفاروق", status: "active", createdAt: 0 },
    { id: "r2", parentId: null, path: "/men/r2/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة أخرى", status: "active", createdAt: 0 },
    { id: "m2", parentId: "r2", path: "/men/r2/m2/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد آخر", status: "active", createdAt: 0 },
  ] as never).run();
  await db.insert(schema.persons).values([
    { id: "p-amir", fullName: "الأمير", gender: "male", status: "active", createdAt: 0 },
    { id: "p-teacher", fullName: "المعلّم عمر", gender: "male", status: "active", createdAt: 0 },
    { id: "p-other", fullName: "معلّمٌ آخر", gender: "male", status: "active", createdAt: 0 },
  ] as never).run();
  await db.insert(schema.roleAssignments).values([
    { id: "ra-a", personId: "p-amir", role: "amir", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "ra-t", personId: "p-teacher", role: "teacher", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "ra-o", personId: "p-other", role: "teacher", orgUnitId: "m2", orgPath: "/men/r2/m2/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
  ] as never).run();
  await db.insert(schema.assets).values({
    id: "as1", kind: "equipment", name: "جهاز عرض", details: "مع الكابلات", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/",
    holderPersonId: null, holderName: null, status: "returned", createdBy: "u-amir", createdAt: 10, updatedAt: 10,
  } as never).run();
});

describe("العُهد — سلسلةُ الحيازة والإقرار", () => {
  it("التسليمُ يُسجَّل حدثاً وينتظر إقرارَ المستلم، والحائزُ يتبدّل على الأصل", async () => {
    setUser(amir);
    const r = await assignCustodyData({ assetId: "as1", toPersonId: "p-teacher", condition: "good", note: "للدروس" });
    expect(r).toHaveProperty("ok", true);

    const scope = await scopeCustodyData();
    const it0 = scope.items[0];
    expect(it0.holderName).toBe("المعلّم عمر");
    expect(it0.status).toBe("active");
    expect(it0.awaitingAck).toBe(true);            // لم يقرّ بعد
    expect(it0.conditionLabel).toBe("سليمة");

    // المستلمُ يراها في «عُهدتي» بانتظار إقراره
    setUser(teacher);
    const mine = await myCustodyData();
    expect(mine.items.map((i) => i.name)).toEqual(["جهاز عرض"]);
    expect(mine.pending.length).toBe(1);
    expect(mine.pending[0].fromName).toBe(null);   // أوّلُ تسليمٍ من الوحدة
  });

  it("الإقرارُ لمن استلم وحدَه — لا المدير ولا المسلِّم يقرّ عنه", async () => {
    setUser(amir);
    await assignCustodyData({ assetId: "as1", toPersonId: "p-teacher", condition: "good" });
    setUser(teacher);
    const ev = (await myCustodyData()).pending[0].eventId;

    setUser(amir);
    expect(await acknowledgeCustodyData(ev)).toHaveProperty("error");   // المسلِّم لا يقرّ
    setUser(admin);
    expect(await acknowledgeCustodyData(ev)).toHaveProperty("error");   // ولا المدير رغم «*»
    setUser(teacher);
    expect(await acknowledgeCustodyData(ev)).toHaveProperty("ok", true);

    setUser(amir);
    expect((await scopeCustodyData()).items[0].awaitingAck).toBe(false);
  });

  it("النقلُ من يدٍ إلى يدٍ يُسمّى نقلاً ويحفظ السابقَ في السلسلة", async () => {
    setUser(amir);
    await assignCustodyData({ assetId: "as1", toPersonId: "p-teacher", condition: "new" });
    await assignCustodyData({ assetId: "as1", toPersonId: "p-amir", condition: "fair", note: "استُرجع لتبديل الكابل" });
    const t = await custodyTimelineData("as1");
    expect(t.events.map((e) => e.action)).toEqual(["transfer", "assign"]);   // الأحدثُ أوّلاً
    expect(t.events[0].fromName).toBe("المعلّم عمر");
    expect(t.events[0].toName).toBe("الأمير");
    expect(t.events[1].toName).toBe("المعلّم عمر");
    expect(t.asset.holderName).toBe("الأمير");
  });

  it("الإعادةُ تُفرّغ اليدَ وتُبقي الأصلَ في وحدته، والتلفُ حالةٌ صريحةٌ لا حذفٌ صامت", async () => {
    setUser(amir);
    await assignCustodyData({ assetId: "as1", toPersonId: "p-teacher" });
    expect(await returnCustodyData({ assetId: "as1", condition: "fair" })).toHaveProperty("ok", true);
    let s = await scopeCustodyData();
    expect(s.items[0].holderName).toBe(null);
    expect(s.items[0].status).toBe("returned");

    expect(await reportCustodyData({ assetId: "as1", state: "damaged", note: "سقط" })).toHaveProperty("ok", true);
    s = await scopeCustodyData();
    expect(s.items[0].status).toBe("damaged");
    const t = await custodyTimelineData("as1");
    expect(t.events.map((e) => e.action)).toEqual(["damaged", "return", "assign"]);
  });

  it("العزلُ بالنطاق: لا تُسلّم عهدةَ غيرك ولا تراها، ولا تُسلَّم لمن خارج نطاقك", async () => {
    setUser(otherAmir);
    expect(await assignCustodyData({ assetId: "as1", toPersonId: "p-other" })).toHaveProperty("error", "الأصل خارج نطاقك");
    expect((await scopeCustodyData()).items.length).toBe(0);
    // مرشّحو التسليم عند أمير الفاروق: أهلُ نطاقه لا أهلُ الشبكة
    setUser(amir);
    const people = (await scopeCustodyData()).people.map((p) => p.name);
    expect(people).toContain("المعلّم عمر");
    expect(people).not.toContain("معلّمٌ آخر");
  });

  it("المعلّمُ لا يُسلّم عُهداً (لا يملك assets.manage) لكنّه يرى عُهدته", async () => {
    setUser(amir);
    await assignCustodyData({ assetId: "as1", toPersonId: "p-teacher" });
    setUser(teacher);
    expect(await assignCustodyData({ assetId: "as1", toPersonId: "p-amir" })).toHaveProperty("error");
    expect((await myCustodyData()).items.length).toBe(1);
    // ويرى سلسلةَ ما بيده (لا تُخفى عن صاحبها)
    expect((await custodyTimelineData("as1")).events.length).toBe(1);
  });

  // صفوفٌ قديمةٌ (قبل 0076) تحمل اسمَ حائزٍ وحالتُها «مُعادة»: الحالةُ هي الحقيقة
  it("الحالةُ مصدرُ الحقيقة: اسمُ حائزٍ قديمٌ مع حالة «مُعادة» لا يُعرض حائزاً", async () => {
    await db.update(schema.assets).set({ holderName: "حائزٌ قديم", holderPersonId: "p-teacher", status: "returned" })
      .where(eq(schema.assets.id, "as1")).run();
    setUser(amir);
    const s = await scopeCustodyData();
    expect(s.items[0].holderName).toBe(null);          // لا «بعهدة فلان» مع «في الوحدة»
    expect(await openCustodyOf("p-teacher")).toEqual([]);
    // والتسليمُ بعدها يُسمّى تسليماً أوّلَ مرّةٍ لا نقلاً من الشبح
    expect(await assignCustodyData({ assetId: "as1", toPersonId: "p-teacher" })).toHaveProperty("ok", true);
    expect((await custodyTimelineData("as1")).events[0].action).toBe("assign");
  });

  it("تكاملُ الاستقالة: مَن بيده عهدةٌ يُكشف قبل طيّ صفحته", async () => {
    setUser(amir);
    await assignCustodyData({ assetId: "as1", toPersonId: "p-teacher" });
    expect((await openCustodyOf("p-teacher")).map((a) => a.name)).toEqual(["جهاز عرض"]);
    await returnCustodyData({ assetId: "as1" });
    expect(await openCustodyOf("p-teacher")).toEqual([]);
  });
});
