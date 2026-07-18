// المرحلة ٠ (تكملة) — ردمُ الدفتر من الحركات التاريخيّة القائمة قبل تفعيل المولِّد.
// يُرحّل كلَّ تبرّعٍ/مصروفٍ/راتبٍ/محروقاتٍ سابقٍ (بالسنتات، الافتراض general) — idempotent فالإعادةُ آمنة.
import { donations, expenses, payouts, assetExpenses } from "../database/schema";
import { postDonation, postExpense, postPayout, postFuel } from "./ledgerPost";
import type { Db } from "../utils/db";

export async function backfillLedger(db: Db, actorUserId?: string): Promise<{ donations: number; expenses: number; payouts: number; fuel: number }> {
  let dCount = 0, eCount = 0, pCount = 0, fCount = 0;

  for (const d of await db.select().from(donations).all()) {
    const r = await postDonation(db, { id: d.id, amount: d.amount, fundId: "general", memo: d.donorName ? `تبرّعُ ${d.donorName}` : "تبرّع", createdBy: actorUserId });
    if (!r.skipped) dCount++;
  }
  for (const e of await db.select().from(expenses).all()) {
    const r = await postExpense(db, { id: e.id, amount: e.amount, fundId: "general", category: e.category ?? undefined, createdBy: actorUserId });
    if (!r.skipped) eCount++;
  }
  for (const p of await db.select().from(payouts).all()) {
    const r = await postPayout(db, { id: p.id, amount: p.paidAmount, createdBy: actorUserId });
    if (!r.skipped) pCount++;
  }
  for (const x of await db.select().from(assetExpenses).all()) {
    const total = x.fuelAmount + x.otherAmount;
    if (total <= 0) continue;
    const r = await postFuel(db, { id: x.id, amount: total, createdBy: actorUserId });
    if (!r.skipped) fCount++;
  }
  return { donations: dCount, expenses: eCount, payouts: pCount, fuel: fCount };
}
