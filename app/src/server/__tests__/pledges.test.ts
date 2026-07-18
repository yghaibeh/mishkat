// المرحلة ١ — التعهّدات. TDD.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, type TestDb } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/utils/db", () => ({ useDb: () => state.db, getCloudflareEnv: () => ({}), setCloudflareEnv: () => {} }));

import { recordPledge, applyToPledges, openPledges } from "@/server/services/pledges";
import * as schema from "@/server/database/schema";
import { eq } from "drizzle-orm";

let db: TestDb;
beforeEach(async () => {
  db = (await createTestDb()).db; state.db = db;
  await db.insert(schema.donors).values({ id: "dn1", name: "المتعهِّد", phone: null, note: null, createdAt: 0 }).run();
});

describe("التعهّدات (TDD)", () => {
  it("تسجيلُ تعهّدٍ يبدأ مفتوحًا بلا وفاء", async () => {
    const { id } = await recordPledge(db as never, { donorId: "dn1", amount: 1000, fund: "projects", note: "لبناء مصلّى" });
    const p = (await db.select().from(schema.pledges).where(eq(schema.pledges.id, id)).all())[0];
    expect(p.amount).toBe(1000);
    expect(p.fulfilled).toBe(0);
    expect(p.status).toBe("open");
    expect(p.fundId).toBe("projects");
  });

  it("وفاءٌ جزئيٌّ ثمّ كاملٌ يُغلق التعهّد", async () => {
    const { id } = await recordPledge(db as never, { donorId: "dn1", amount: 500, fund: "general" });
    // وفاءٌ ٢٠٠ ⇒ يبقى مفتوحًا (متبقٍّ ٣٠٠)
    let r = await applyToPledges(db as never, { donorId: "dn1", fund: "general", amount: 200 });
    expect(r.applied).toBe(200);
    let p = (await db.select().from(schema.pledges).where(eq(schema.pledges.id, id)).all())[0];
    expect(p.fulfilled).toBe(200); expect(p.status).toBe("open");
    // وفاءٌ ٣٠٠ ⇒ يكتمل ويُغلق
    r = await applyToPledges(db as never, { donorId: "dn1", fund: "general", amount: 300 });
    p = (await db.select().from(schema.pledges).where(eq(schema.pledges.id, id)).all())[0];
    expect(p.fulfilled).toBe(500); expect(p.status).toBe("fulfilled");
  });

  it("الفائضُ عن التعهّد لا يُطبَّق (لا وفاءٌ يتجاوز المتعهَّد)", async () => {
    await recordPledge(db as never, { donorId: "dn1", amount: 100, fund: "zakat" });
    const r = await applyToPledges(db as never, { donorId: "dn1", fund: "zakat", amount: 250 });
    expect(r.applied).toBe(100); // طُبِّق ١٠٠ فقط، والباقي تبرّعٌ حرّ
    expect(r.remainder).toBe(150);
  });

  it("تقريرُ المتعهَّدات المفتوحة يعرض المتبقّي فقط", async () => {
    const a = await recordPledge(db as never, { donorId: "dn1", amount: 800, fund: "general" });
    await applyToPledges(db as never, { donorId: "dn1", fund: "general", amount: 300 });
    await recordPledge(db as never, { donorId: "dn1", amount: 200, fund: "waqf" });
    const open = await openPledges(db as never);
    const g = open.find((p) => p.id === a.id)!;
    expect(g.remaining).toBe(500); // ٨٠٠ − ٣٠٠
    expect(open.every((p) => p.remaining > 0)).toBe(true);
    expect(open.length).toBe(2);
  });
});
