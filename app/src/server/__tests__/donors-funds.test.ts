// المرحلة ١ — المانحون + وسمُ الصندوق + سنداتُ القبض المرقّمة + ضبطُ صرف المقيّد. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { nextReceiptNo, recordDonation, assertFundCanSpend, donorStatement } from "@/server/services/donorsFinance";
import { fundBalances, toCents } from "@/server/services/ledger";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.orgUnits).values({ id: "m1", parentId: null, path: "/men/m1/", type: "mosque", section: "men", genderTrack: "male", name: "مسجد", status: "active", createdAt: 0 }).run();
});

describe("سنداتُ القبض المرقّمة (TDD)", () => {
  it("متسلسلةٌ بلا فجوات وبصيغةٍ موحّدة", async () => {
    const r1 = await nextReceiptNo(db as never);
    const r2 = await nextReceiptNo(db as never);
    const r3 = await nextReceiptNo(db as never);
    expect(r1).toBe("R-000001");
    expect(r2).toBe("R-000002");
    expect(r3).toBe("R-000003");
  });
});

describe("تسجيلُ التبرّع بصندوقٍ ومانحٍ وسند (TDD)", () => {
  it("تبرّعٌ للزكاة ⇒ سندٌ مرقّم + وسمُ الصندوق + ترحيلٌ للدفتر", async () => {
    const res = await recordDonation(db as never, { mosqueId: "m1", amount: 500, fund: "zakat", donorName: "أبو بكر", collectedBy: "u" });
    expect(res.receiptNo).toBe("R-000001");
    const don = (await db.select().from(schema.donations).where(eq(schema.donations.id, res.id)).all())[0];
    expect(don.fundId).toBe("zakat");
    expect(don.receiptNo).toBe("R-000001");
    expect(don.donorId).toBeTruthy(); // أُنشئ المانحُ تلقائيًّا
    // انعكس في رصيد صندوق الزكاة
    const zakat = (await fundBalances(db as never)).find((f) => f.fundId === "zakat")!;
    expect(zakat.balance).toBe(toCents(500));
  });

  it("مانحان بنفس الاسم لا يتكرّران", async () => {
    await recordDonation(db as never, { mosqueId: "m1", amount: 100, fund: "general", donorName: "خالد", collectedBy: "u" });
    await recordDonation(db as never, { mosqueId: "m1", amount: 200, fund: "general", donorName: "خالد", collectedBy: "u" });
    expect((await db.select().from(schema.donors).where(eq(schema.donors.name, "خالد")).all()).length).toBe(1);
  });
});

describe("ضبطُ صرف الأموال المقيّدة (TDD)", () => {
  it("لا يُصرَف من الزكاة أكثرُ من رصيدها (منعٌ برسالةٍ بشريّة)", async () => {
    await recordDonation(db as never, { mosqueId: "m1", amount: 100, fund: "zakat", collectedBy: "u" });
    // صرفُ ٦٠ مقبول
    await expect(assertFundCanSpend(db as never, "zakat", toCents(60))).resolves.toBeUndefined();
    // صرفُ ١٥٠ يتجاوز الرصيد ⇒ يُرفض
    await expect(assertFundCanSpend(db as never, "zakat", toCents(150))).rejects.toThrow(/الزكاة|لا يكفي/);
  });

  it("الصندوقُ الحرّ (العامّ) لا يُقيَّد بالرصيد", async () => {
    await expect(assertFundCanSpend(db as never, "general", toCents(9999))).resolves.toBeUndefined();
  });
});

describe("كشفُ المانح (TDD)", () => {
  it("يجمع تبرّعاتِ المانح بصناديقها", async () => {
    const r = await recordDonation(db as never, { mosqueId: "m1", amount: 100, fund: "zakat", donorName: "عثمان", collectedBy: "u" });
    await recordDonation(db as never, { mosqueId: "m1", amount: 50, fund: "sadaqah", donorName: "عثمان", collectedBy: "u" });
    const st = await donorStatement(db as never, r.donorId);
    expect(st.total).toBe(150);
    expect(st.items.length).toBe(2);
    expect(st.donorName).toBe("عثمان");
  });
});
