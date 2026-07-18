// و٢ — كشوفُ المانحين وتقاريرُ الصناديق. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { donorsList, donorFullStatement } from "@/server/services/donorsReport";
import { recordDonation } from "@/server/services/donorsFinance";
import * as schema from "@/server/database/schema";

let db: TestDb;
beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: "/men/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد", status: "active", createdAt: 0 }).run();
});

describe("قائمةُ المانحين (TDD)", () => {
  it("تجمع كلَّ مانحٍ بإجماليّ تبرّعاته وعددها، الأعلى أوّلًا", async () => {
    await recordDonation(db as never, { mosqueId: "m1", amount: 300, fund: "zakat", donorName: "أحمد", collectedBy: "u" });
    await recordDonation(db as never, { mosqueId: "m1", amount: 200, fund: "general", donorName: "أحمد", collectedBy: "u" });
    await recordDonation(db as never, { mosqueId: "m1", amount: 100, fund: "sadaqah", donorName: "بلال", collectedBy: "u" });
    const list = await donorsList(db as never);
    expect(list.length).toBe(2);
    expect(list[0].name).toBe("أحمد");
    expect(list[0].total).toBe(500);
    expect(list[0].count).toBe(2);
    expect(list[1].name).toBe("بلال");
  });

  it("البحثُ بالاسم يُرشّح", async () => {
    await recordDonation(db as never, { mosqueId: "m1", amount: 50, fund: "general", donorName: "عمر الفاروق", collectedBy: "u" });
    await recordDonation(db as never, { mosqueId: "m1", amount: 50, fund: "general", donorName: "خالد", collectedBy: "u" });
    const list = await donorsList(db as never, "عمر");
    expect(list.length).toBe(1);
    expect(list[0].name).toBe("عمر الفاروق");
  });
});

describe("كشفُ المانح الكامل (TDD)", () => {
  it("يضمّ بياناتِ المانح وتبرّعاتِه بصناديقها وسنداتِها", async () => {
    const r = await recordDonation(db as never, { mosqueId: "m1", amount: 400, fund: "waqf", donorName: "عثمان", collectedBy: "u" });
    const st = await donorFullStatement(db as never, r.donorId!);
    expect(st.donor.name).toBe("عثمان");
    expect(st.total).toBe(400);
    expect(st.items[0].receiptNo).toBe(r.receiptNo);
    expect(st.items[0].fund).toBe("waqf");
    expect(st.byFund.find((f) => f.fund === "waqf")!.amount).toBe(400);
  });
});
