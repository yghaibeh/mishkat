// مركزُ الإعلام: معرضُ الصور من المصدرين مربوطةً بالمسجد والمنطقة + عزلُ النطاق + العُهدُ النشطة. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, makeUser, type TestDb, type FakeUser } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown, user: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));
vi.mock("@/server/auth.server", () => ({ currentUser: async () => state.user }));

import { mediaGalleryData, mediaAssetsData, createCoverageData, coverageDetailData, deleteCoverageData } from "@/server/mediaHub.server";
import { eq } from "drizzle-orm";
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

  // أشخاصٌ وحسابات: نسبةُ كلّ صورةٍ لصاحبها تُحلّ من users → persons
  await db.insert(schema.persons).values([
    { id: "p-media", fullName: "مسؤول الإعلام", gender: "male", createdAt: 0 },
    { id: "p-amir-m1", fullName: "أمير الفاروق", gender: "male", createdAt: 0 },
    { id: "p-t", fullName: "الأستاذ عمر", gender: "male", createdAt: 0 },
  ] as never).run();
  await db.insert(schema.users).values([
    { id: "u-media-r1", personId: "p-media", login: "media", passwordHash: "x", createdAt: 0 },
    { id: "u-amir", personId: "p-amir-m1", login: "amir", passwordHash: "x", createdAt: 0 },
  ] as never).run();

  // (أ) صورةُ سجلّ اليوم: سجلُّ أسبوعٍ للفاروق + مرفق
  await db.insert(schema.weeklyRecords).values({ id: "wr1", mosqueId: "m1", mosquePath: "/men/r1/sq1/m1/", weekStart: "2026-07-11", schemeId: "s1", totalPoints: 0, createdAt: 0 } as never).run();
  await db.insert(schema.attachments).values({ id: "att-d", scope: "daily_record", refId: "wr1", r2Key: "daily/1.jpg", caption: "توزيع سلال", uploadedBy: "u-amir", clientUuid: null, createdAt: 100 } as never).run();

  // (ب) صورةُ درسٍ: مكانٌ على المسجد ← حلقة ← جلسة ← مرفق
  await db.insert(schema.venues).values({ id: "v1", type: "mosque", name: "قاعة", orgUnitId: "m1", genderTrack: "male", createdAt: 0 }).run();
  await db.insert(schema.teachers).values({ id: "t1", personId: "p-t", createdAt: 0 } as never).run();
  await db.insert(schema.halaqat).values({ id: "h1", name: "حلقة الفجر", venueId: "v1", teacherId: "t1", createdAt: 0 } as never).run();
  await db.insert(schema.lessonSessions).values({ id: "ls1", halaqaId: "h1", teacherId: "t1", durationHours: 1, createdAt: 0 } as never).run();
  await db.insert(schema.lessonAttachments).values({ id: "att-l", lessonSessionId: "ls1", r2Key: "lessons/2.jpg", caption: "درس المجلس الأول", createdAt: 200 } as never).run();

  // العُهد: بعُهدتي نشطة + بعُهدتي مُعادة (لا تظهر) + نشطةٌ بعُهدة غيري في نطاقي (لا تظهر)
  await db.insert(schema.assets).values({ id: "as1", kind: "equipment", name: "كاميرا التغطية", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/", holderPersonId: "p-media", holderName: "مسؤول الإعلام", status: "active", createdAt: 10, updatedAt: 10 } as never).run();
  await db.insert(schema.assets).values({ id: "as2", kind: "equipment", name: "كاميرا قديمة", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/", holderPersonId: "p-media", holderName: "مسؤول الإعلام", status: "returned", createdAt: 5, updatedAt: 5 } as never).run();
  await db.insert(schema.assets).values({ id: "as3", kind: "vehicle", name: "دراجة الأمير", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/", holderPersonId: "p-amir", holderName: "أبو أحمد", status: "active", createdAt: 8, updatedAt: 8 } as never).run();
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

  // النسبةُ لا تسقط إلى «غير منسوبة» ما دام المسؤولُ معلومًا (احتياطُ أمير الوحدة)
  it("صورةُ سجلّ يومٍ بلا حسابِ رافعٍ تُنسب لأمير مسجدها", async () => {
    await db.update(schema.attachments).set({ uploadedBy: null }).where(eq(schema.attachments.id, "att-d")).run();
    await db.insert(schema.roleAssignments).values({
      id: "ra-amir-m1", personId: "p-amir-m1", role: "amir", orgUnitId: "m1", orgPath: "/men/r1/sq1/m1/",
      startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0,
    } as never).run();
    setUser(admin);
    const daily = (await mediaGalleryData(0)).items.find((i) => i.source === "daily")!;
    expect(daily.byName).toBe("أمير الفاروق");
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

  // «عُهدتي» شخصيّةٌ لا مرآةَ لعُهد الشبكة (بلاغ المالك ٢٠٢٦-٠٧-١٨: ما علاقةُ عُهد غيري بالإعلام؟)
  it("عُهدتي: النشطةُ التي باسمي وحدَها — لا المُعادة ولا التي بعُهدة غيري في نطاقي", async () => {
    setUser(mediaR1);
    const a = await mediaAssetsData();
    expect(a.items.map((i) => i.name)).toEqual(["كاميرا التغطية"]);
    expect(a.items[0].unitName).toBe("مسجد الفاروق");
    setUser(mediaR2);
    expect((await mediaAssetsData()).items.length).toBe(0);
    setUser(admin); // المديرُ لا عُهدةَ باسمه ⇒ لا تبويبَ له أصلًا
    expect((await mediaAssetsData()).items.length).toBe(0);
  });

  // ===== التغطية الإعلاميّة: سجلُّ حدثٍ لا صورةٌ عائمة (بلاغ المالك: «ما سياقها؟ من قام بها؟») =====
  it("التغطيةُ تُنشأ بعنوانها ونوعها ووحدتها وتاريخِ وقوعها، وتظهر في المعرض منسوبةً لناشرها بألبومها", async () => {
    setUser(mediaR1);
    const r = await createCoverageData({ title: "افتتاحُ حلقة التحفيظ", kind: "opening", orgUnitId: "m1", occurredAt: 5000, body: "بحضور الأهالي" });
    expect("id" in r && r.id).toBeTruthy();
    const covId = (r as { id: string }).id;
    // صورتان في ألبومٍ واحد
    await db.insert(schema.attachments).values([
      { id: "att-p1", scope: "media_post", refId: covId, r2Key: "media-posts/a.jpg", caption: null, uploadedBy: "u-media-r1", clientUuid: null, createdAt: 5001 },
      { id: "att-p2", scope: "media_post", refId: covId, r2Key: "media-posts/b.jpg", caption: null, uploadedBy: "u-media-r1", clientUuid: null, createdAt: 5002 },
    ] as never).run();

    const g = await mediaGalleryData(0);
    const post = g.items.find((i) => i.source === "post")!;
    expect(post.title).toBe("افتتاحُ حلقة التحفيظ");     // ماذا
    expect(post.kind).toBe("opening");                    // نوعُ الحدث
    expect(post.mosqueName).toBe("مسجد الفاروق");         // أين
    expect(post.regionName).toBe("منطقة إدلب");
    expect(post.createdAt).toBe(5000);                    // متى وقع (لا متى رُفع)
    expect(post.byName).toBe("مسؤول الإعلام");            // مَن
    expect(post.photoCount).toBe(2);                      // ألبومٌ لا صورة
    expect(post.url).toBe("/media/media-posts/a.jpg");

    const d = await coverageDetailData(covId);
    expect(d.photos.length).toBe(2);
    expect(d.body).toBe("بحضور الأهالي");
    expect(d.mine).toBe(true);
  });

  it("تغطيةٌ بلا صورةٍ لا تُعرض في المعرض (فلا بطاقةَ فارغة)", async () => {
    setUser(mediaR1);
    await createCoverageData({ title: "بلا صور", kind: "event", orgUnitId: "m1", occurredAt: 9000 });
    const g = await mediaGalleryData(0);
    expect(g.items.some((i) => i.title === "بلا صور")).toBe(false);
  });

  it("النشرُ قدرةٌ شخصيّة: الأميرُ يُرفض، والمديرُ يُرفض رغم «*» (قاعدة المالك الواحد)", async () => {
    setUser(makeUser("amir", "m1", "/men/r1/sq1/m1/"));
    expect(await createCoverageData({ title: "ت", kind: "event", orgUnitId: "m1", occurredAt: 1 })).toHaveProperty("error");
    setUser(admin);
    expect(await createCoverageData({ title: "ت", kind: "event", orgUnitId: "m1", occurredAt: 1 })).toHaveProperty("error");
  });

  it("التغطيةُ معزولةٌ بالنطاق كسائر الروافد: لا تغطّي وحدةً خارج نطاقك ولا ترى تغطيةَ غيرك", async () => {
    setUser(mediaR2); // مسؤول إعلام منطقة حلب
    expect(await createCoverageData({ title: "تعدٍّ", kind: "event", orgUnitId: "m1", occurredAt: 1 })).toHaveProperty("error", "الوحدة خارج نطاقك");
    setUser(mediaR1);
    const c = await createCoverageData({ title: "لقاءُ إدلب", kind: "event", orgUnitId: "m1", occurredAt: 7000 }) as { id: string };
    await db.insert(schema.attachments).values({ id: "att-p3", scope: "media_post", refId: c.id, r2Key: "media-posts/c.jpg", caption: null, uploadedBy: "u-media-r1", clientUuid: null, createdAt: 7001 } as never).run();
    setUser(mediaR2);
    expect((await mediaGalleryData(0)).items.length).toBe(0);
    await expect(coverageDetailData(c.id)).rejects.toThrow("خارج نطاقك");
  });

  it("الحذفُ لناشر التغطية وحدَه، ويأخذ معه صورَها", async () => {
    setUser(mediaR1);
    const c = await createCoverageData({ title: "حدثٌ يُحذف", kind: "visit", orgUnitId: "m1", occurredAt: 8000 }) as { id: string };
    await db.insert(schema.attachments).values({ id: "att-p9", scope: "media_post", refId: c.id, r2Key: "media-posts/z.jpg", caption: null, uploadedBy: "u-media-r1", clientUuid: null, createdAt: 8001 } as never).run();
    setUser(mediaR2);
    expect(await deleteCoverageData(c.id)).toHaveProperty("error");
    setUser(mediaR1);
    expect(await deleteCoverageData(c.id)).toHaveProperty("ok", true);
    const left = await db.select().from(schema.attachments).where(eq(schema.attachments.refId, c.id)).all();
    expect(left.length).toBe(0);
  });

  // تشخيصُ الفراغ: «لا صور» تُفرَّق عن «لا مسؤولَ إعلامٍ معيَّن» (قاعدة السطر المفهوم ٣٤)
  it("المعرضُ يُعيد عددَ مسؤولي الإعلام المعتمَدين ليُشخَّص الفراغُ لا ليُعتذَر عنه", async () => {
    setUser(admin);
    expect((await mediaGalleryData(0)).mediaOfficers).toBe(0);
    await db.insert(schema.roleAssignments).values({
      id: "ra-media", personId: "p-media", role: "media", orgUnitId: "r1", orgPath: "/men/r1/",
      startDate: 0, endDate: null, termNumber: 1, approvalStatus: "approved", createdAt: 0,
    } as never).run();
    expect((await mediaGalleryData(0)).mediaOfficers).toBe(1);
  });
});
