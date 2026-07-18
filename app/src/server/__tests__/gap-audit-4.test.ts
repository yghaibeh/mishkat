// الجولة الرابعة (ق٣/ق٤/ق٥) — الحقن، النزاهة ضدّ السباقات، التفويض، الماليّة، والتوقيت.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";
import { escapeHtml } from "@/lib/escape-html";
import { applyActivityRules } from "@/server/utils/points";
import { weekStartSaturday, hijriDateStr } from "@/server/utils/week";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import * as schema from "@/server/database/schema";
import { and, eq } from "drizzle-orm";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const admin = makeUser("admin", "root", "/", { personId: "p-admin", userId: "u-admin" });
const amir = makeUser("amir", "m1", "/men/aleppo/sq/m1/", { personId: "p-amir", userId: "u-amir" });

describe("ق٤: تهريب HTML يُبطل الحقن", () => {
  it("اسمٌ خبيثٌ يُهرَّب فلا يُنفَّذ في نافذة الطباعة", () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe("&lt;img src=x onerror=alert(1)&gt;");
    expect(escapeHtml('علي & "عمر"')).toBe("علي &amp; &quot;عمر&quot;");
    expect(escapeHtml(null)).toBe("");
  });
});

describe("ق٣: التوقيت الدمشقيّ (UTC+3) لحدود اليوم/الأسبوع", () => {
  it("لحظةٌ بعد منتصف الليل الدمشقيّ تُنسب لليوم الصحيح لا لأمسِ", () => {
    // ٢٠٢٦-٠٧-١٠ ٢٣:٠٠ UTC = ٢٠٢٦-٠٧-١١ ٠٢:٠٠ دمشق ⇒ يومٌ (وربّما أسبوعٌ) مختلف
    const utcLateNight = new Date("2026-07-10T23:00:00Z");
    const utcMidday = new Date("2026-07-11T09:00:00Z");
    expect(hijriDateStr(utcLateNight)).toBe(hijriDateStr(utcMidday)); // كلاهما ١١ يوليو دمشقيًّا
    // السبت ٢٠٢٦-٠٧-١١ ٠٠:٣٠ دمشق (= ٢١:٣٠ UTC الجمعة) ينتمي لأسبوع السبت لا الجمعة السابقة
    const satEarly = new Date("2026-07-10T21:30:00Z");
    expect(weekStartSaturday(satEarly)).toBe("2026-07-11");
  });
});

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values([
    { id: "men", parentId: null, path: "/men/", type: "section", section: "men", genderTrack: "male", name: "الذكور", status: "active", createdAt: 0 },
    { id: "women", parentId: null, path: "/women/", type: "section", section: "women", genderTrack: "female", name: "الإناث", status: "active", createdAt: 0 },
    { id: "aleppo", parentId: "men", path: "/men/aleppo/", type: "rabita", section: "men", genderTrack: "male", name: "حلب", status: "active", createdAt: 0 },
    { id: "sq", parentId: "aleppo", path: "/men/aleppo/sq/", type: "square", section: "men", genderTrack: "male", name: "مربع", status: "active", createdAt: 0 },
    { id: "m1", parentId: "sq", path: "/men/aleppo/sq/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد ١", status: "active", createdAt: 0 },
    { id: "m2", parentId: "sq", path: "/men/aleppo/sq/m2/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد ٢", status: "active", createdAt: 0 },
  ]).run();
  await db.insert(schema.roleAssignments).values([
    { id: "ra-admin", personId: "p-admin", role: "admin", orgUnitId: "root", orgPath: "/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
    { id: "ra-amir", personId: "p-amir", role: "amir", orgUnitId: "m1", orgPath: "/men/aleppo/sq/m1/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 },
  ]).run();
});

describe("ق٣: اعتماد التسجيل مُحكَمٌ ضدّ السباق (لا شخصَ ولا حسابَ مكرَّر)", () => {
  it("اعتمادان متتاليان لنفس الطلب: الأوّل ينجح، والثاني يُصدّ بلا تكرار", async () => {
    const { submitRegistrationData, approveRegistrationData } = await import("@/server/registration.server");
    await db.insert(schema.circles).values({ id: "c1", mosqueId: "m1", type: "tahfeez", genderTrack: "male", name: "الفجر", teacherPersonId: null, capacity: null, notes: null, status: "active", createdAt: 0 }).run();
    const r = await submitRegistrationData({ kind: "student", fullName: "طالبٌ نجيبٌ جدًّا", gender: "male", login: "race.student", password: "P@ssw0rd123", targetUnitId: "m1", circleId: "c1" });
    const token = (r as { token: string }).token;
    setUser(admin);
    const first = await approveRegistrationData(token);
    expect("ok" in first && first.ok).toBe(true);
    const second = await approveRegistrationData(token);
    expect("error" in second && second.error).toBeTruthy(); // بُتَّ فيه
    expect((await db.select().from(schema.users).where(eq(schema.users.login, "race.student")).all()).length).toBe(1);
    expect((await db.select().from(schema.persons).where(eq(schema.persons.fullName, "طالبٌ نجيبٌ جدًّا")).all()).length).toBe(1);
  });
});

describe("ق٣: نزاهة السجلّ اليوميّ", () => {
  async function seedScheme() {
    await db.insert(schema.activityTypes).values({ id: "a-meet", code: "family_meeting", name: "اجتماع", genderTrack: "male", category: "meeting", active: true, sortOrder: 1, maxPerDay: null, minParticipationPct: null }).run();
    await db.insert(schema.pointsSchemes).values({ id: "s-m", genderTrack: "male", weeklyTarget: 70, validFrom: 0, active: true }).run();
    await db.insert(schema.pointsSchemeItems).values({ id: "i1", schemeId: "s-m", activityTypeId: "a-meet", points: 1 }).run();
  }

  it("إعادةُ إدخالٍ بنفس المفتاح الطبيعيّ تُحدِّث لا تُضاعف (upsert)", async () => {
    await seedScheme();
    setUser(amir);
    const { saveDailyLogData } = await import("@/server/data.server");
    await saveDailyLogData({ track: "male", entries: [{ activityTypeId: "a-meet", count: 3, participantCount: 1, clientUuid: "u-a", recordedAt: 1000 }], shura: true });
    // نفس (الأسبوع، اليوم، النشاط) بعميلٍ مختلفٍ وطابعٍ زمنيٍّ أحدث ⇒ صفٌّ واحدٌ محدَّث
    await saveDailyLogData({ track: "male", entries: [{ activityTypeId: "a-meet", count: 5, participantCount: 1, clientUuid: "u-b", recordedAt: 2000 }], shura: true });
    const rows = await db.select().from(schema.dailyEntries).where(eq(schema.dailyEntries.activityTypeId, "a-meet")).all();
    expect(rows.length).toBe(1);
    expect(rows[0].count).toBe(5);
  });

  it("أسبوعٌ مقفلٌ (معتمَدٌ نهائيًّا) يرفض قيدًا جديدًا — لا يرفع المجموع المعتمَد", async () => {
    await seedScheme();
    setUser(amir);
    const { saveDailyLogData } = await import("@/server/data.server");
    const { syncEntries } = await import("@/server/services/records");
    await saveDailyLogData({ track: "male", entries: [{ activityTypeId: "a-meet", count: 2, participantCount: 1, clientUuid: "u-1", recordedAt: 1000 }], shura: true });
    const rec = (await db.select().from(schema.weeklyRecords).all())[0];
    // نقفل الأسبوع (اعتمادٌ نهائيّ)
    await db.update(schema.weeklyRecords).set({ status: "layer_approved", locked: true, lockedAt: Date.now() }).run();
    const before = rec.totalPoints;
    // قيدٌ جديدٌ بيومٍ مختلفٍ عبر syncEntries مباشرةً (saveDailyLog يُثبّت السبت) ⇒ يجب رفضُه
    const mosque = { id: "m1", genderTrack: "male", path: "/men/aleppo/sq/m1/" };
    const r = await syncEntries(db as never, mosque as never, { userId: "u-amir", canEditLocked: false, committee: null }, [
      { clientUuid: "u-2", weekStart: rec.weekStart, day: "wed", activityTypeId: "a-meet", count: 9, participantCount: 1, shuraConfirmed: true, recordedAt: 3000 } as never,
    ]);
    expect(r.applied).toBe(0); // لم يُطبَّق
    expect(r.rejected.length).toBe(1);
    const after = (await db.select().from(schema.weeklyRecords).all())[0];
    expect(after.locked).toBe(true);
    expect((await db.select().from(schema.dailyEntries).all()).length).toBe(1); // لم يُضَف قيد
    expect(after.totalPoints).toBe(before);
  });
});

describe("ق٣: تفويض إنشاء «على بصيرة» بالنطاق", () => {
  it("أميرٌ لا يُنشئ مكانًا لوحدةٍ خارج نطاقه", async () => {
    setUser(amir);
    const { createVenueData } = await import("@/server/alaBaseera.server");
    const ok = await createVenueData({ type: "mosque", name: "مكانٌ لي", orgUnitId: "m1" });
    expect("ok" in ok && ok.ok).toBe(true);
    const bad = await createVenueData({ type: "mosque", name: "مكانٌ لغيري", orgUnitId: "m2" });
    expect("error" in bad && bad.error).toBeTruthy();
  });
});

describe("ق٣: منح رأس القسم للإدارة العليا فقط", () => {
  it("رابطةٌ تملك user.manage لا تمنح section_head", async () => {
    await db.insert(schema.roleAssignments).values({ id: "ra-rab", personId: "p-rab", role: "rabita", orgUnitId: "aleppo", orgPath: "/men/aleppo/", startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0 }).run();
    setUser(makeUser("rabita", "aleppo", "/men/aleppo/", { personId: "p-rab", userId: "u-rab" }));
    const { adminCreateUserWithRole } = await import("@/server/admin.server");
    const res = await adminCreateUserWithRole({ fullName: "مرشّحٌ لرأس القسم", login: "sh.cand", password: "P@ssw0rd123", gender: "male", role: "section_head", orgUnitId: "aleppo" });
    expect("error" in res && res.error).toContain("العليا");
  });
});

describe("ق٣: الماليّة — الاعتماد لا يُمحى بإعادة الحساب", () => {
  it("مستحقٌّ معتمَدٌ يبقى معتمَدًا بعد recompute", async () => {
    const { computeMonthlyEntitlement } = await import("@/server/services/finance");
    // مستحقٌّ معتمَدٌ قائمٌ للأمير عن شهرٍ ما
    await db.insert(schema.monthlyEntitlements).values({ id: "ent-1", personId: "p-amir", month: "1447-12", grossAmount: 100, status: "approved", createdAt: 0 } as never).run();
    const res = await computeMonthlyEntitlement(db as never, "p-amir", "1447-12", "u-admin");
    expect(res.status).toBe("approved");
    const row = (await db.select().from(schema.monthlyEntitlements).where(eq(schema.monthlyEntitlements.id, "ent-1")).all())[0];
    expect(row.status).toBe("approved"); // لم يُمحَ ولم يرتدّ proposed
  });
});

describe("ق٣: تبديل حائز العُهدة يُدوَّن", () => {
  it("تعديلُ أصلٍ بتغيير الحائز يكتب قيدَ تدقيق", async () => {
    setUser(admin);
    const { saveAssetData } = await import("@/server/assets.server");
    const created = await saveAssetData({ kind: "vehicle", name: "سيّارة", orgUnitId: "m1", holderPersonId: "p-amir" } as never);
    const id = (created as { id: string }).id;
    await saveAssetData({ id, kind: "vehicle", name: "سيّارة", orgUnitId: "m1", holderPersonId: "p-admin" } as never);
    const audits = (await db.select().from(schema.auditLog).all()).filter((a) => a.action === "update_asset");
    expect(audits.length).toBe(1);
  });
});
