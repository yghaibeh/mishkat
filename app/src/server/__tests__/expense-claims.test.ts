// المرحلة ٣ — مطالباتُ الصرف باعتمادٍ متدرّج (فصلُ المهامّ). TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { submitClaim, approveClaim, rejectClaim, listClaims } from "@/server/services/expenseClaims";
import { postDonation } from "@/server/services/ledgerPost";
import { fundBalances, toCents } from "@/server/services/ledger";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
beforeEach(async () => { db = (await createTestDb()).db; state.db = db; });

describe("مطالباتُ الصرف (TDD)", () => {
  it("تقديمُ مطالبةٍ يبدؤها «معلّقة» بلا تحريكِ مال", async () => {
    const { id } = await submitClaim(db as never, { fundId: "general", category: "كهرباء", amount: 80, requestedBy: "u-entry" });
    const c = (await db.select().from(schema.expenseClaims).where(eq(schema.expenseClaims.id, id)).all())[0];
    expect(c.status).toBe("pending");
    expect(c.amount).toBe(80);
    // لا قيدَ في الدفتر بعد
    expect((await db.select().from(schema.journalEntries).all()).length).toBe(0);
  });

  it("اعتمادُ المطالبة يُرحّلها للدفتر (مصروف) ويُغيّر حالتَها", async () => {
    const { id } = await submitClaim(db as never, { fundId: "general", category: "صيانة", amount: 120, requestedBy: "u-entry" });
    const r = await approveClaim(db as never, { claimId: id, decidedBy: "u-approver" });
    expect("ok" in r && r.ok).toBe(true);
    const c = (await db.select().from(schema.expenseClaims).where(eq(schema.expenseClaims.id, id)).all())[0];
    expect(c.status).toBe("approved");
    expect(c.decidedBy).toBe("u-approver");
    // قيدُ مصروفٍ في الدفتر (مدين المصروف / دائن النقد) ⇒ رصيدُ العامّ −١٢٠
    const gen = (await fundBalances(db as never)).find((f) => f.fundId === "general")!;
    expect(gen.balance).toBe(toCents(-120));
  });

  it("فصلُ المهامّ: لا يعتمد المطالبةَ طالبُها", async () => {
    const { id } = await submitClaim(db as never, { fundId: "general", amount: 50, requestedBy: "u-same" });
    const r = await approveClaim(db as never, { claimId: id, decidedBy: "u-same" });
    expect("error" in r && r.error).toContain("طالب");
  });

  it("رفضٌ بسببٍ يُغلق المطالبةَ بلا صرف", async () => {
    const { id } = await submitClaim(db as never, { fundId: "general", amount: 50, requestedBy: "u-entry" });
    await rejectClaim(db as never, { claimId: id, decidedBy: "u-approver", reason: "بلا فاتورة" });
    const c = (await db.select().from(schema.expenseClaims).where(eq(schema.expenseClaims.id, id)).all())[0];
    expect(c.status).toBe("rejected");
    expect(c.rejectReason).toBe("بلا فاتورة");
    expect((await db.select().from(schema.journalEntries).all()).length).toBe(0);
  });

  it("ضبطُ المقيّد: اعتمادُ صرفٍ من الزكاة يتجاوز رصيدَها يُرفض", async () => {
    await postDonation(db as never, { id: "d", amount: 100, fundId: "zakat" }); // رصيد الزكاة ١٠٠
    const { id } = await submitClaim(db as never, { fundId: "zakat", amount: 150, requestedBy: "u-entry" });
    const r = await approveClaim(db as never, { claimId: id, decidedBy: "u-approver" });
    expect("error" in r && r.error).toContain("لا يكفي");
    const c = (await db.select().from(schema.expenseClaims).where(eq(schema.expenseClaims.id, id)).all())[0];
    expect(c.status).toBe("pending"); // لم تُعتمد
  });

  it("قائمةُ المعلّقة فقط", async () => {
    const a = await submitClaim(db as never, { fundId: "general", amount: 10, requestedBy: "u1" });
    await submitClaim(db as never, { fundId: "general", amount: 20, requestedBy: "u2" });
    await approveClaim(db as never, { claimId: a.id, decidedBy: "u-approver" });
    const open = await listClaims(db as never, "pending");
    expect(open.length).toBe(1);
    expect(open[0].amount).toBe(20);
  });

  it("لا يُعتمد ما بُتَّ فيه مرّتين (idempotency)", async () => {
    const { id } = await submitClaim(db as never, { fundId: "general", amount: 30, requestedBy: "u-entry" });
    await approveClaim(db as never, { claimId: id, decidedBy: "u-approver" });
    const again = await approveClaim(db as never, { claimId: id, decidedBy: "u-approver" });
    expect("error" in again && again.error).toBeTruthy();
    expect((await db.select().from(schema.journalEntries).all()).length).toBe(1); // قيدٌ واحد
  });
});
