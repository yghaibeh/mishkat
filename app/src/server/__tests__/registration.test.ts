import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import {
  submitRegistrationData, registrationStatusData, pendingRegistrationsData,
  approveRegistrationData, rejectRegistrationData, publicOrgTreeData,
} from "@/server/registration.server";
import { verifyPassword } from "@/server/utils/auth";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const admin = makeUser("admin", "root", "/", { personId: "p-admin", userId: "u-admin", fullName: "المدير العام" });
const squareSup = makeUser("square", "sq", "/men/aleppo/sq/", { personId: "p-sq", userId: "u-sq", fullName: "مسؤول المربع" });
const rabitaSup = makeUser("rabita", "aleppo", "/men/aleppo/", { personId: "p-rab", userId: "u-rab", fullName: "مسؤول حلب" });
const amirFarouq = makeUser("amir", "m-farouq", "/men/aleppo/sq/m-farouq/", { personId: "p-amir", userId: "u-amir", fullName: "أمير الفاروق" });
const amirOther = makeUser("amir", "m-other", "/men/aleppo/sq/m-other/", { personId: "p-amir2", userId: "u-amir2", fullName: "أمير آخر" });

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  const now = 0;
  await db.insert(schema.orgUnits).values([
    { id: "men", parentId: null, path: "/men/", type: "section", section: "men", genderTrack: "male", name: "قسم الذكور", status: "active", createdAt: now },
    { id: "aleppo", parentId: "men", path: "/men/aleppo/", type: "rabita", section: "men", genderTrack: "male", name: "منطقة حلب", status: "active", createdAt: now },
    { id: "sq", parentId: "aleppo", path: "/men/aleppo/sq/", type: "square", section: "men", genderTrack: "male", name: "مربع المدينة", status: "active", createdAt: now },
    { id: "m-farouq", parentId: "sq", path: "/men/aleppo/sq/m-farouq/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد الفاروق", status: "active", createdAt: now },
    { id: "m-other", parentId: "sq", path: "/men/aleppo/sq/m-other/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد آخر", status: "active", createdAt: now },
  ]).run();
  await db.insert(schema.circles).values({ id: "c1", mosqueId: "m-farouq", type: "tahfeez", genderTrack: "male", name: "حلقة الفجر", teacherPersonId: null, capacity: null, notes: null, status: "active", createdAt: now }).run();
  // مكلَّفون معتمَدون — لاختبار توجيه الإشعارات
  await db.insert(schema.roleAssignments).values([
    { id: "ra-admin", personId: "p-admin", role: "admin", orgUnitId: "root", orgPath: "/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: now },
    { id: "ra-sq", personId: "p-sq", role: "square", orgUnitId: "sq", orgPath: "/men/aleppo/sq/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: now },
    { id: "ra-rab", personId: "p-rab", role: "rabita", orgUnitId: "aleppo", orgPath: "/men/aleppo/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: now },
    { id: "ra-amir", personId: "p-amir", role: "amir", orgUnitId: "m-farouq", orgPath: "/men/aleppo/sq/m-farouq/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: now },
  ]).run();
});

const submitStudent = () => submitRegistrationData({
  kind: "student", fullName: "أحمد الطالب النجيب", gender: "male",
  login: "ahmad.student", password: "P@ssw0rd123", phone: "0999",
  targetUnitId: "m-farouq", circleId: "c1",
});

describe("ر — التسجيل الذاتيّ الهرميّ", () => {
  it("الشجرة العامّة: وحداتٌ نشطةٌ وحلقات، بلا أشخاص", async () => {
    const t = await publicOrgTreeData();
    expect(t.units.map((u) => u.id)).toContain("m-farouq");
    expect(t.circles.map((c) => c.id)).toContain("c1");
  });

  it("طالبٌ في الفاروق ⇒ pending، يظهر لأمير الفاروق ولا يظهر لأميرٍ آخر، ويُشعَر الأمير", async () => {
    const r = await submitStudent();
    expect("ok" in r && r.ok).toBe(true);
    setUser(amirFarouq);
    expect((await pendingRegistrationsData()).items.length).toBe(1);
    setUser(amirOther);
    expect((await pendingRegistrationsData()).items.length).toBe(0);
    const notifs = await db.select().from(schema.notifications).all();
    const reg = notifs.filter((n) => n.kind === "registration_pending");
    expect(reg.length).toBe(1);
    expect(reg[0].personId).toBe("p-amir"); // الأقرب: أمير المسجد لا المربع
  });

  it("اعتماد الطالب ⇒ person+user+عضوية حلقةٍ موصولة، وكلمة المرور تعمل", async () => {
    const r = await submitStudent();
    const token = (r as { token: string }).token;
    setUser(amirFarouq);
    const ok = await approveRegistrationData(token);
    expect("ok" in ok && ok.ok).toBe(true);
    const user = (await db.select().from(schema.users).where(eq(schema.users.login, "ahmad.student")).all())[0];
    expect(user).toBeTruthy();
    expect(await verifyPassword("P@ssw0rd123", user.passwordHash)).toBe(true);
    const cs = (await db.select().from(schema.circleStudents).all())[0];
    expect(cs.personId).toBe(user.personId);
    // الطالب له دور student (يدخل «المطلوب منّي» ومكتبته — §ن)
    const ras = await db.select().from(schema.roleAssignments).where(eq(schema.roleAssignments.personId, user.personId)).all();
    expect(ras.map((x) => x.role)).toEqual(["student"]);
    expect(ras[0].approvalStatus).toBe("approved");
    expect((await registrationStatusData(token)).status).toBe("approved");
  });

  it("«المسجد يُضاف حين الاعتماد»: أمير مسجدٍ غير مدرجٍ ⇒ تُنشأ الهيكلية كاملةً", async () => {
    const r = await submitRegistrationData({
      kind: "amir", fullName: "مدير مسجد الأمة", gender: "male",
      login: "umma.amir", password: "P@ssw0rd123",
      proposedUnitName: "مسجد الأمة", proposedParentId: "sq",
    });
    const token = (r as { token: string }).token;
    // أمير مسجدٍ لا يعتمد أميرًا — المربع يعتمد
    setUser(amirFarouq);
    expect((await pendingRegistrationsData()).items.length).toBe(0);
    setUser(squareSup);
    const items = (await pendingRegistrationsData()).items;
    expect(items.length).toBe(1);
    expect(items[0].proposedUnitName).toBe("مسجد الأمة");
    const ok = await approveRegistrationData(token);
    expect("ok" in ok && ok.ok).toBe(true);
    const mosque = (await db.select().from(schema.orgUnits).where(eq(schema.orgUnits.name, "مسجد الأمة")).all())[0];
    expect(mosque).toBeTruthy();
    expect(mosque.type).toBe("mosque");
    expect(mosque.path.startsWith("/men/aleppo/sq/")).toBe(true);
    const user = (await db.select().from(schema.users).where(eq(schema.users.login, "umma.amir")).all())[0];
    const ra = (await db.select().from(schema.roleAssignments).where(eq(schema.roleAssignments.personId, user.personId)).all())[0];
    expect(ra.role).toBe("amir");
    expect(ra.orgUnitId).toBe(mosque.id);
    expect(ra.approvalStatus).toBe("approved");
  });

  it("مسؤول مربعٍ يعتمده مسؤول المنطقة، ورفضٌ بسببٍ يظهر بالاستعلام", async () => {
    const r = await submitRegistrationData({
      kind: "square", fullName: "مرشح مسؤول المربع", gender: "male",
      login: "sq.cand", password: "P@ssw0rd123", targetUnitId: "sq",
    });
    const token = (r as { token: string }).token;
    setUser(squareSup); // نفس الرتبة لا يعتمد
    expect((await pendingRegistrationsData()).items.length).toBe(0);
    setUser(rabitaSup);
    expect((await pendingRegistrationsData()).items.length).toBe(1);
    const rej = await rejectRegistrationData(token, "لا نعرفه");
    expect("ok" in rej && rej.ok).toBe(true);
    const st = await registrationStatusData(token);
    expect(st.status).toBe("rejected");
    expect(st.rejectReason).toBe("لا نعرفه");
  });

  it("login محجوز (قائم أو معلّق) يُرفض تقديمُه، وسباقُه يفشل بأمانٍ عند الاعتماد", async () => {
    await submitStudent();
    const dup = await submitRegistrationData({
      kind: "student", fullName: "طالبٌ آخر تمامًا", gender: "male",
      login: "AHMAD.STUDENT", password: "P@ssw0rd123", targetUnitId: "m-farouq",
    });
    expect("error" in dup && dup.error).toContain("غير متاح");
    // سباق: حسابٌ أُنشئ بنفس الاسم قبل الاعتماد
    const r2 = await submitRegistrationData({
      kind: "student", fullName: "طالبٌ ثالثٌ صابر", gender: "male",
      login: "race.login", password: "P@ssw0rd123", targetUnitId: "m-farouq",
    });
    await db.insert(schema.persons).values({ id: "p-x", fullName: "س", gender: "male", status: "active", createdAt: 0 }).run();
    await db.insert(schema.users).values({ id: "u-x", personId: "p-x", login: "race.login", passwordHash: "h", createdAt: 0 }).run();
    setUser(amirFarouq);
    const res = await approveRegistrationData((r2 as { token: string }).token);
    expect("error" in res && res.error).toContain("حُجز");
  });

  it("اعتماد معلّمٍ اختار حلقةً بلا معلّم ⇒ يُسنَد وتُزامَن توائمُها عبر الجسر (غ٨)", async () => {
    // توأم التحفيظ موجودٌ سلفًا (كما تُنشئه bridgeCircle) لكن بلا معلّم
    await db.insert(schema.tahfeezCircles).values({ id: "tc-c1", mosqueId: "m-farouq", name: "حلقة الفجر", teacherPersonId: null, status: "active", createdAt: 0 }).run();
    const r = await submitRegistrationData({
      kind: "teacher", fullName: "معلّم الفجر الجديد", gender: "male",
      login: "fajr.teacher", password: "P@ssw0rd123", targetUnitId: "m-farouq", circleId: "c1",
    });
    setUser(amirFarouq);
    const ok = await approveRegistrationData((r as { token: string }).token);
    expect("ok" in ok && ok.ok).toBe(true);
    const user = (await db.select().from(schema.users).where(eq(schema.users.login, "fajr.teacher")).all())[0];
    const c = (await db.select().from(schema.circles).where(eq(schema.circles.id, "c1")).all())[0];
    expect(c.teacherPersonId).toBe(user.personId);
    // التوأم أخذ المعلّمَ نفسَه ⇒ الحلقة تظهر في «حلقاتي» عنده فورًا
    const twin = (await db.select().from(schema.tahfeezCircles).where(eq(schema.tahfeezCircles.id, "tc-c1")).all())[0];
    expect(twin.teacherPersonId).toBe(user.personId);
  });

  it("honeypot يبتلع الطلب صامتًا", async () => {
    const r = await submitRegistrationData({
      kind: "student", fullName: "روبوتٌ خبيثٌ جدًّا", gender: "male",
      login: "bot.login", password: "P@ssw0rd123", targetUnitId: "m-farouq", website: "spam.com",
    });
    expect("ok" in r && r.ok).toBe(true);
    expect((await db.select().from(schema.registrationRequests).all()).length).toBe(0);
  });
});

describe("قاعدة المالك الواحد في التسجيل — الطلب للطبقة الأقرب المؤهلة حصراً", () => {
  it("طلب طالبٍ لمسجدٍ له أمير: يظهر للأمير وحده — لا للمربع ولا للمنطقة ولا للمدير", async () => {
    await submitStudent(); // targetUnitId = m-farouq وله أمير مكلّف
    setUser(amirFarouq);
    expect((await pendingRegistrationsData()).items.length).toBe(1);
    setUser(squareSup);
    expect((await pendingRegistrationsData()).items.length).toBe(0); // كان يراه أيضاً (قناة مكررة)
    setUser(makeUser("rabita", "aleppo", "/men/aleppo/", { personId: "p-rab" }));
    expect((await pendingRegistrationsData()).items.length).toBe(0);
    setUser(admin);
    expect((await pendingRegistrationsData()).items.length).toBe(0); // الإدارة: الشاغر فقط
  });

  it("سلطة البتّ للطبقة الأعلى تبقى قائمة عند القصد (canApprove) وإن لم يُوجَّه إليها", async () => {
    const r = await submitStudent();
    const token = (r as { token: string }).token;
    setUser(squareSup); // المربع فوق الأمير — يستطيع البتّ قصداً وإن لم يظهر في صندوقه
    const ok = await approveRegistrationData(token);
    expect("ok" in ok && ok.ok).toBe(true);
  });
});

describe("حلقة الإشعارات كاملة (سؤال المالك ٢٠٢٦-٠٧-١٨)", () => {
  it("التقديم يُشعر الأقرب عبر تيليغرام (تصل الجرس أيضاً)، والاعتماد يرحّب بالمعتمَد في جرسه", async () => {
    const r = await submitStudent();
    const token = (r as { token: string }).token;
    const pend = await db.select().from(schema.notifications).all();
    const toApprover = pend.filter((n) => n.kind === "registration_pending");
    expect(toApprover.length).toBeGreaterThan(0);
    expect(toApprover[0].channel).toBe("telegram"); // قناة الإرسال — والجرس يقرأ كل القنوات
    expect(toApprover[0].personId).toBe("p-amir");  // الأقرب: أمير المسجد لا كل الطبقات

    setUser(amirFarouq);
    await approveRegistrationData(token);
    const welcome = (await db.select().from(schema.notifications).all()).filter((n) => n.kind === "registration_approved");
    expect(welcome.length).toBe(1);
    const newPerson = (await db.select().from(schema.registrationRequests).all()).find((x) => x.id === token)!.createdPersonId;
    expect(welcome[0].personId).toBe(newPerson); // الترحيب للمعتمَد نفسه
  });
});
