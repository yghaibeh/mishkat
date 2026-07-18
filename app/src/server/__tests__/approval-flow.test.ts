import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, type TestDb } from "./helpers";
import { approveRecord, rejectRecord } from "@/server/services/records";
import * as schema from "@/server/database/schema";

// سلسلة الاعتماد (§11/ق-16): مسودة → اعتمده الأمير → معتمد نهائياً من أعلى طبقة.
let db: TestDb;
const REC = { id: "wr1", mosqueId: "m1", mosquePath: "/idlib/sq-1/m1/", weekStart: "2026-06-27", schemeId: "s1", totalPoints: 60, status: "draft", locked: false, createdAt: 0 };
const fetchRec = async () => (await db.select().from(schema.weeklyRecords).where(eq(schema.weeklyRecords.id, "wr1")).all())[0];

beforeEach(async () => {
  db = (await createTestDb()).db;
  await db.insert(schema.weeklyRecords).values(REC).run();
});

describe("سلسلة الاعتماد", () => {
  it("الأمير يعتمد المسودة ⇒ amir_approved + ختم زمني", async () => {
    const rec = await fetchRec();
    const r = await approveRecord(db, rec, { isAmir: true, isLayer: false, isAdmin: false, userId: "uAmir" });
    expect(r.status).toBe("amir_approved");
    const after = await fetchRec();
    expect(after.status).toBe("amir_approved");
    expect(after.amirApprovedAt).toBeTruthy();
    expect(after.approvedByAmir).toBe("uAmir");
  });

  it("من لا يملك صلاحية لا يعتمد المسودة", async () => {
    const rec = await fetchRec();
    const r = await approveRecord(db, rec, { isAmir: false, isLayer: false, isAdmin: false, userId: "uNone" });
    expect(r.error).toBeTruthy();
    expect((await fetchRec()).status).toBe("draft");
  });

  it("ق1 المُحدَّث: جهةٌ أعلى تعتمد المسودة نهائياً مباشرةً (دون انتظار إقرار الأمير)", async () => {
    const rec = await fetchRec();
    const r = await approveRecord(db, rec, { isAmir: false, isLayer: true, isAdmin: false, userId: "uLayer" });
    expect(r.status).toBe("layer_approved");
    const after = await fetchRec();
    expect(after.status).toBe("layer_approved");
    expect(after.locked).toBe(true);
    expect(after.approvedByLayer).toBe("uLayer");
  });

  it("ق-16: الأمير وحده لا يُتمّ الاعتماد النهائي (يلزم أعلى طبقة)", async () => {
    await db.update(schema.weeklyRecords).set({ status: "amir_approved" }).where(eq(schema.weeklyRecords.id, "wr1")).run();
    const rec = await fetchRec();
    const r = await approveRecord(db, rec, { isAmir: true, isLayer: false, isAdmin: false, userId: "uAmir" });
    expect(r.error).toBeTruthy();
    expect((await fetchRec()).status).toBe("amir_approved");
  });

  it("الطبقة تعتمد نهائياً ⇒ layer_approved + قفل", async () => {
    await db.update(schema.weeklyRecords).set({ status: "amir_approved" }).where(eq(schema.weeklyRecords.id, "wr1")).run();
    const rec = await fetchRec();
    const r = await approveRecord(db, rec, { isAmir: false, isLayer: true, isAdmin: false, userId: "uSquare" });
    expect(r.status).toBe("layer_approved");
    const after = await fetchRec();
    expect(after.locked).toBe(true);
    expect(after.approvedByLayer).toBe("uSquare");
  });

  it("الرفض يُعيد الأسبوع مسودةً مع سبب ويمسح ختم الأمير", async () => {
    await db.update(schema.weeklyRecords).set({ status: "amir_approved", amirApprovedAt: 123 }).where(eq(schema.weeklyRecords.id, "wr1")).run();
    const rec = await fetchRec();
    await rejectRecord(db, rec, { userId: "uSquare" }, "نقاط غير مكتملة");
    const after = await fetchRec();
    expect(after.status).toBe("draft");
    expect(after.rejectionReason).toBe("نقاط غير مكتملة");
    expect(after.amirApprovedAt).toBeNull();
  });
});
