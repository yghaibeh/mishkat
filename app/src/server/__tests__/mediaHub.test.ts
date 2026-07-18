// مركزُ الإعلام: معرضُ الصور من المصدرين مربوطةً بالمسجد والمنطقة + عزلُ النطاق + العُهدُ النشطة. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { mediaGalleryData, mediaAssetsData } from "@/server/mediaHub.server";
import * as schema from "@/server/database/schema";

let db: TestDb;
const setUser = (u: FakeUser | null) => { state.user = u; };
const admin = makeUser("admin", "root", "/");
const mediaR1 = makeUser("media", "r1", "/men/r1/", { personId: "p-media" });
const mediaR2 = makeUser("media", "r2", "/men/r2/", { personId: "p-media2" });

beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db; state.user = null;
  const units = [
    { id: "r1", parentId: null, path: "/men/r1/", type: "rabita", name: "منطقة إدلب" },
    { id: "sq1", parentId: "r1", path: "/men/r1/sq1/", type: "square", name: "مربع الشمال" },
    { id: "m1", parentId: "sq1", path: "/men/r1/sq1/m1/", type: "mosque", name: "مسجد الفاروق" },
    { id: "r2", parentId: null, path: "/men/r2/", type: "rabita", name: "منطقة حلب" },
  ];
  for (const u of units) await db.insert(schema.orgUnits).values({ ...u, section: "men", genderTrack: "male", status: "active", createdAt: 0 } as never).run();

  // (أ) صورةُ سجلّ اليوم: سجلُّ أسبوعٍ للفاروق + مرفق
  await db.insert(schema.weeklyRecords).values({ id: "wr1", mosqueId: "m1", mosquePath: "/men/r1/sq1/m1/", weekStart: "2026-07-11", schemeId: "s1", totalPoints: 0, createdAt: 0 } as never).run();
  await db.insert(schema.attachments).values({ id: "att-d", scope: "daily_record", refId: "wr1", r2Key: "daily/1.jpg", caption: "توزيع سلال", uploadedBy: null, clientUuid: null, createdAt: 100 } as never).run();

  // (ب) صورةُ درسٍ: مكانٌ على المسجد ← حلقة ← جلسة ← مرفق
  await db.insert(schema.venues).values({ id: "v1", type: "mosque", name: "قاعة", orgUnitId: "m1", genderTrack: "male", createdAt: 0 }).run();
  await db.insert(schema.teachers).values({ id: "t1", personId: "p-t", createdAt: 0 } as never).run();
  await db.insert(schema.halaqat).values({ id: "h1", name: "حلقة الفجر", venueId: "v1", teacherId: "t1", createdAt: 0 } as never).run();
  await db.insert(schema.lessonSessions).values({ id: "ls1", halaqaId: "h1", teacherId: "t1", durationHours: 1, createdAt: 0 } as never).run();
  await db.insert(schema.lessonAttachments).values({ id: "att-l", lessonSessionId: "ls1", r2Key: "lessons/2.jpg", caption: "درس المجلس الأول", createdAt: 200 } as never).run();

  // العُهد: نشطةٌ + مُعادةٌ (لا تظهر)
  await db.insert(schema.assets).values({ id: "as1", kind: "vehicle", name: "دراجة نارية", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/", holderName: "أبو أحمد", status: "active", createdAt: 10, updatedAt: 10 } as never).run();
  await db.insert(schema.assets).values({ id: "as2", kind: "equipment", name: "كاميرا قديمة", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/", holderName: "أبو بكر", status: "returned", createdAt: 5, updatedAt: 5 } as never).run();
});

describe("مركزُ الإعلام (TDD)", () => {
  it("الإدارةُ ترى الصورَ من المصدرين مربوطةً بالمسجد والمنطقة (الأحدثُ أوّلًا)", async () => {
    setUser(admin);
    const g = await mediaGalleryData(0);
    expect(g.total).toBe(2);
    expect(g.items.map((i) => i.id)).toEqual(["att-l", "att-d"]); // 200 ثم 100
    const lesson = g.items[0], daily = g.items[1];
    expect(lesson.url).toBe("/media/lessons/2.jpg");
    expect(lesson.source).toBe("lesson");
    expect(lesson.mosqueName).toBe("مسجد الفاروق");
    expect(lesson.regionName).toBe("منطقة إدلب");
    expect(daily.source).toBe("daily");
    expect(daily.mosqueName).toBe("مسجد الفاروق");
    expect(daily.regionName).toBe("منطقة إدلب");
    expect(daily.caption).toBe("توزيع سلال");
  });

  it("مسؤولُ إعلام منطقةٍ يرى صورَ منطقته، وصاحبُ المنطقة الأخرى لا يرى شيئًا", async () => {
    setUser(mediaR1);
    const mine = await mediaGalleryData(0);
    expect(mine.total).toBe(2);
    setUser(mediaR2);
    const none = await mediaGalleryData(0);
    expect(none.total).toBe(0);
    expect(none.items.length).toBe(0);
  });

  it("مَن لا يملك media.hub (أمير) يُرفَض", async () => {
    setUser(makeUser("amir", "m1", "/men/r1/sq1/m1/"));
    await expect(mediaGalleryData(0)).rejects.toThrow();
  });

  it("العُهدُ في العمل: النشطةُ فقط بحاملها ووحدتها، والمُعادةُ لا تظهر", async () => {
    setUser(mediaR1);
    const a = await mediaAssetsData();
    expect(a.items.length).toBe(1);
    expect(a.items[0].name).toBe("دراجة نارية");
    expect(a.items[0].holderName).toBe("أبو أحمد");
    expect(a.items[0].unitName).toBe("مسجد الفاروق");
    setUser(mediaR2);
    expect((await mediaAssetsData()).items.length).toBe(0); // عزلُ النطاق
  });
});
