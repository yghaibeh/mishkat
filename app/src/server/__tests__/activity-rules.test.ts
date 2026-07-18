import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";
import { applyActivityRules } from "@/server/utils/points";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { saveDailyLogData, setFamilyStudentsData } from "@/server/data.server";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

describe("قواعد اللجنة (0047) — الدالة النقيّة", () => {
  it("السقف اليوميّ يقصّ العدد (الصلوات ١٠ ⇒ ١)", () => {
    const r = applyActivityRules(10, 8, { maxPerDay: 1, minParticipationPct: null }, null);
    expect(r.count).toBe(1);
    expect(r.eligible).toBe(true);
  });
  it("عتبة ٧٠٪: ٦ من ١٠ لا تُحسب، و٧ من ١٠ تُحسب", () => {
    const below = applyActivityRules(1, 6, { maxPerDay: 1, minParticipationPct: 70 }, 10);
    expect(below.eligible).toBe(false);
    expect(below.requiredParticipants).toBe(7);
    const ok = applyActivityRules(1, 7, { maxPerDay: 1, minParticipationPct: 70 }, 10);
    expect(ok.eligible).toBe(true);
  });
  it("بلا عدد أسرةٍ مضبوطٍ لا تُطبَّق العتبة (تُحسب) — وبلا قاعدةٍ يمرّ العدد كما هو", () => {
    // ق١ (تشديد): بلا عدد طلاب الأسرة لا تأهُّل — كان fail-open فتمرّ الصلوات بلا تحقّق
    expect(applyActivityRules(1, 1, { maxPerDay: 1, minParticipationPct: 70 }, null).eligible).toBe(false);
    expect(applyActivityRules(1, 1, { maxPerDay: 1, minParticipationPct: 70 }, 0).eligible).toBe(false);
    expect(applyActivityRules(5, 1, undefined, 10).count).toBe(5);
  });
});

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const amir = makeUser("amir", "m1", "/men/a/m1/", { personId: "p-amir", userId: "u-amir", fullName: "الأمير" });

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: "/men/a/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد", status: "active", familyStudents: 10, createdAt: 0 }).run();
  // مخطط نقاطٍ مصغّر: نشاط الصلوات (بقاعدة 0047 من الهجرة) + اجتماع أسرة بلا قاعدة
  await db.insert(schema.activityTypes).values([
    { id: "a-prayer", code: "prayer", name: "الصلوات الخمس", genderTrack: "male", category: "prayer", active: true, sortOrder: 1, maxPerDay: 1, minParticipationPct: 70 },
    { id: "a-meet", code: "family_meeting", name: "اجتماع أسرة", genderTrack: "male", category: "meeting", active: true, sortOrder: 2, maxPerDay: null, minParticipationPct: null },
  ]).run();
  await db.insert(schema.pointsSchemes).values({ id: "s-m", genderTrack: "male", weeklyTarget: 70, validFrom: 0, active: true }).run();
  await db.insert(schema.pointsSchemeItems).values([
    { id: "i1", schemeId: "s-m", activityTypeId: "a-prayer", points: 1 },
    { id: "i2", schemeId: "s-m", activityTypeId: "a-meet", points: 1 },
  ]).run();
});

describe("قواعد اللجنة (0047) — عبر سجلّ اليوم الفعليّ", () => {
  it("صلاةٌ بعشر مرّاتٍ و٨ مصلّين من ١٠ ⇒ نقطةٌ واحدة؛ و٦ مصلّين ⇒ صفر", async () => {
    setUser(amir);
    const r = await saveDailyLogData({ track: "male", entries: [{ activityTypeId: "a-prayer", count: 10, participantCount: 8 }], shura: true });
    expect(r.totalPoints).toBe(1); // السقف قصّ ١٠ إلى ١
    const rows = await db.select().from(schema.dailyEntries).where(eq(schema.dailyEntries.activityTypeId, "a-prayer")).all();
    expect(rows[0].count).toBe(1);
    // تعديلٌ لاحقٌ بمشاركةٍ دون العتبة ⇒ صفر نقاط
    const r2 = await saveDailyLogData({ track: "male", entries: [{ activityTypeId: "a-prayer", count: 1, participantCount: 6, recordedAt: Date.now() + 1000, clientUuid: "edit-below-threshold" }], shura: true });
    expect(r2.totalPoints).toBe(0);
  });

  it("نشاطٌ بلا قاعدةٍ يبقى بالعدد×الوزن، وضبط طلاب الأسرة محميٌّ بالصلاحية", async () => {
    setUser(amir);
    const r = await saveDailyLogData({ track: "male", entries: [{ activityTypeId: "a-meet", count: 3, participantCount: 5 }], shura: true });
    expect(r.totalPoints).toBe(3);
    expect((await setFamilyStudentsData(12, "m1") as { ok?: boolean }).ok).toBe(true);
    setUser(makeUser("amir", "m2", "/men/b/m2/", { personId: "p-x", userId: "u-x" }));
    const denied = await setFamilyStudentsData(5, "m1");
    expect("error" in denied && denied.error).toBeTruthy();
  });
});
