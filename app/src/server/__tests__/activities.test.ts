import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { createActivityData, myDutiesData, respondActivityData, myActivitiesData, reviewResponseData } from "@/server/activities.server";
import * as schema from "@/server/database/schema";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const teacher = { userId: "u-teacher", personId: "p-teacher", fullName: "الشيخ محمود", assignments: [{ role: "teacher", orgUnitId: "m1", orgPath: "/men/aleppo/sq/m1/", portfolio: null }] };
const amir = makeUser("amir", "m1", "/men/aleppo/sq/m1/", { personId: "p-amir", userId: "u-amir", fullName: "أمير النور" });
const student = { userId: "u-st", personId: "p-st", fullName: "أحمد الطالب", assignments: [{ role: "student", orgUnitId: "m1", orgPath: "/men/aleppo/sq/m1/", portfolio: null }] };
const stranger = { userId: "u-x", personId: "p-x", fullName: "غريب", assignments: [{ role: "student", orgUnitId: "m2", orgPath: "/men/idlib/m2/", portfolio: null }] };

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values([
    { id: "m1", parentId: null, path: "/men/aleppo/sq/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد النور", status: "active", createdAt: 0 },
  ]).run();
  await db.insert(schema.circles).values({ id: "c1", mosqueId: "m1", type: "tahfeez", genderTrack: "male", name: "حلقة الفجر", teacherPersonId: "p-teacher", capacity: null, notes: null, status: "active", createdAt: 0 }).run();
  await db.insert(schema.circleStudents).values([
    { id: "cs1", circleId: "c1", name: "أحمد الطالب", personId: "p-st", notes: null, status: "active", createdAt: 0 },
    { id: "cs2", circleId: "c1", name: "طالبٌ بلا حساب", personId: null, notes: null, status: "active", createdAt: 0 },
  ]).run();
});

describe("ن — النشاطات والمتابعة (المطلوب منّي)", () => {
  it("المعلّم يُنشئ نشاطًا لحلقته ويُشعَر طلابها المعروفون؛ والغريب لا يُنشئ", async () => {
    setUser(stranger as FakeUser);
    const denied = await createActivityData({ scopeKind: "circle", scopeId: "c1", title: "نشاط" });
    expect("error" in denied && denied.error).toBeTruthy();
    setUser(teacher as FakeUser);
    const ok = await createActivityData({ scopeKind: "circle", scopeId: "c1", title: "احفظ سورة الملك" });
    expect("ok" in ok && ok.ok).toBe(true);
    expect((ok as { notified: number }).notified).toBe(1); // الموصول بهويّةٍ فقط
    const notifs = (await db.select().from(schema.notifications).all()).filter((n) => n.kind === "activity_new");
    expect(notifs.length).toBe(1);
    expect(notifs[0].personId).toBe("p-st");
  });

  it("الطالب يرى «المطلوب منّي» ويردّ فيُشعَر المنشئ؛ وغير المنتسب لا يردّ", async () => {
    setUser(teacher as FakeUser);
    const c = await createActivityData({ scopeKind: "circle", scopeId: "c1", title: "احفظ سورة الملك" });
    const actId = (c as { id: string }).id;
    setUser(student as FakeUser);
    const duties = await myDutiesData();
    expect(duties.items.length).toBe(1);
    expect(duties.items[0].myResponse).toBeNull();
    const r = await respondActivityData({ activityId: actId, body: "حفظتُها والحمد لله" });
    expect("ok" in r && r.ok).toBe(true);
    expect((await myDutiesData()).items[0].myResponse?.body).toBe("حفظتُها والحمد لله");
    const notif = (await db.select().from(schema.notifications).all()).filter((n) => n.kind === "activity_response");
    expect(notif.length).toBe(1);
    expect(notif[0].personId).toBe("p-teacher");
    setUser(stranger as FakeUser);
    const denied = await respondActivityData({ activityId: actId, body: "أنا دخيل" });
    expect("error" in denied && denied.error).toBeTruthy();
  });

  it("المنشئ يتابع الردود (أجاب س من ص) ويقبلها؛ والأمير يغطّي حلقات مسجده", async () => {
    setUser(teacher as FakeUser);
    const c = await createActivityData({ scopeKind: "circle", scopeId: "c1", title: "راجع جزء عمّ" });
    setUser(student as FakeUser);
    await respondActivityData({ activityId: (c as { id: string }).id, body: "راجعتُه" });
    setUser(teacher as FakeUser);
    const mine = await myActivitiesData();
    expect(mine.items.length).toBe(1);
    expect(mine.items[0].expected).toBe(1);
    expect(mine.items[0].responses.length).toBe(1);
    // الأمير (ليس المنشئ) يقبل الردّ لأنّ الحلقة في مسجده
    setUser(amir);
    const rev = await reviewResponseData({ responseId: mine.items[0].responses[0].id, status: "accepted" });
    expect("ok" in rev && rev.ok).toBe(true);
    setUser(student as FakeUser);
    expect((await myDutiesData()).items[0].myResponse?.reviewStatus).toBe("accepted");
  });
});
