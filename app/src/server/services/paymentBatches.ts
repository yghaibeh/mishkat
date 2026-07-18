// المرحلة ٣ (متخصّص) — دفعاتُ الصرف المجمّعة: دفعةٌ تجمع بنودَ صرفٍ (أمراء/معلّمون) تُصرَف بقيدٍ واحدٍ متوازن.
// المستخدمُ يبني قائمةً ثمّ يضغط «صرف الدفعة» فيُرحَّل قيدٌ واحدٌ (Dr 5100 الرواتب / Cr 1110 النقد) بالإجماليّ.
import { eq, desc } from "drizzle-orm";
import { paymentBatches, paymentBatchItems } from "../database/schema";
import { postJournal, toCents } from "./ledger";
import { writeAudit } from "../utils/audit";
import type { Db } from "../utils/db";

const round2 = (n: number) => Math.round(n * 100) / 100;
const ACC = { cash: "1110", salaries: "5100" } as const;

export async function createBatch(db: Db, input: { title: string; period?: string; fundId?: string; createdBy?: string }): Promise<{ id: string }> {
  const title = input.title.trim();
  if (!title) throw new Error("عنوانُ الدفعة مطلوب");
  const id = crypto.randomUUID();
  await db.insert(paymentBatches).values({
    id, title, period: input.period?.trim() || null, fundId: input.fundId ?? "general",
    status: "open", createdBy: input.createdBy ?? null, createdAt: Date.now(), paidBy: null, paidAt: null,
  }).run();
  return { id };
}

export async function addBatchItem(db: Db, input: { batchId: string; personName: string; amount: number; note?: string }): Promise<{ id: string }> {
  const b = (await db.select().from(paymentBatches).where(eq(paymentBatches.id, input.batchId)).all())[0];
  if (!b) throw new Error("الدفعةُ غير موجودة");
  if (b.status !== "open") throw new Error("الدفعةُ مصروفةٌ — لا يُضاف إليها");
  const name = input.personName.trim();
  if (!name) throw new Error("اسمُ المستفيد مطلوب");
  const amount = round2(input.amount);
  if (!(amount > 0)) throw new Error("المبلغ يجب أن يكون موجبًا");
  const id = crypto.randomUUID();
  await db.insert(paymentBatchItems).values({ id, batchId: b.id, personName: name, amount, note: input.note?.trim() || null, createdAt: Date.now() }).run();
  return { id };
}

export async function removeBatchItem(db: Db, input: { itemId: string }): Promise<void> {
  const item = (await db.select().from(paymentBatchItems).where(eq(paymentBatchItems.id, input.itemId)).all())[0];
  if (!item) return;
  const b = (await db.select({ status: paymentBatches.status }).from(paymentBatches).where(eq(paymentBatches.id, item.batchId)).all())[0];
  if (b?.status !== "open") throw new Error("الدفعةُ مصروفةٌ — لا يُحذف منها");
  await db.delete(paymentBatchItems).where(eq(paymentBatchItems.id, input.itemId)).run();
}

// صرفُ الدفعة: قيدٌ واحدٌ متوازنٌ بالإجماليّ (Dr 5100 / Cr 1110). لا تُصرَف فارغةً ولا مرّتين.
export async function payBatch(db: Db, input: { batchId: string; createdBy?: string }): Promise<{ total: number; count: number }> {
  const b = (await db.select().from(paymentBatches).where(eq(paymentBatches.id, input.batchId)).all())[0];
  if (!b) throw new Error("الدفعةُ غير موجودة");
  if (b.status !== "open") throw new Error("الدفعةُ مصروفةٌ من قبل");
  const items = await db.select().from(paymentBatchItems).where(eq(paymentBatchItems.batchId, b.id)).all();
  if (items.length === 0) throw new Error("الدفعةُ فارغةٌ — أضف بنودًا أوّلًا");
  const total = round2(items.reduce((s, it) => s + it.amount, 0));
  const cents = toCents(total);
  await postJournal(db, { source: "payment_batch", sourceRef: b.id, memo: `دفعةُ صرف: ${b.title}`, createdBy: input.createdBy }, [
    { accountId: ACC.salaries, fundId: b.fundId, debit: cents },
    { accountId: ACC.cash, fundId: b.fundId, credit: cents },
  ]);
  await db.update(paymentBatches).set({ status: "paid", paidBy: input.createdBy ?? null, paidAt: Date.now() }).where(eq(paymentBatches.id, b.id)).run();
  await writeAudit(db, { actorUserId: input.createdBy ?? null, action: "pay_batch", entity: "payment_batch", entityId: b.id, after: { total, count: items.length } });
  return { total, count: items.length };
}

export async function batchDetail(db: Db, batchId: string): Promise<{ id: string; title: string; period: string | null; status: string; total: number; items: Array<{ id: string; personName: string; amount: number; note: string | null }>; paidAt: number | null }> {
  const b = (await db.select().from(paymentBatches).where(eq(paymentBatches.id, batchId)).all())[0];
  if (!b) throw new Error("الدفعةُ غير موجودة");
  const items = (await db.select().from(paymentBatchItems).where(eq(paymentBatchItems.batchId, b.id)).all())
    .map((it) => ({ id: it.id, personName: it.personName, amount: it.amount, note: it.note }));
  return { id: b.id, title: b.title, period: b.period, status: b.status, total: round2(items.reduce((s, it) => s + it.amount, 0)), items, paidAt: b.paidAt };
}

export async function listBatches(db: Db): Promise<Array<{ id: string; title: string; period: string | null; status: string; total: number; count: number; createdAt: number; paidAt: number | null }>> {
  const batches = await db.select().from(paymentBatches).orderBy(desc(paymentBatches.createdAt)).all();
  const out = [];
  for (const b of batches) {
    const items = await db.select({ a: paymentBatchItems.amount }).from(paymentBatchItems).where(eq(paymentBatchItems.batchId, b.id)).all();
    out.push({ id: b.id, title: b.title, period: b.period, status: b.status, total: round2(items.reduce((s, it) => s + it.a, 0)), count: items.length, createdAt: b.createdAt, paidAt: b.paidAt });
  }
  return out;
}
