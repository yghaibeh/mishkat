// المرحلة ٣ (متخصّص) — الصندوقُ النثريّ بنظام السلفة المستديمة (imprest):
// سقفٌ ثابتٌ يُحوَّل من النقد (Dr 1130 / Cr 1110)، يُصرَف منه (Dr مصروف / Cr 1130)، ويُزوَّد دوريًّا ليعود للسقف.
// المستخدمُ يرى «رصيدًا وسقفًا وما صُرِف»؛ الدفترُ خلفه يوازن. الرصيدُ التشغيليُّ في السجلّ، والحقيقةُ في حساب 1130.
import { eq, desc, sql } from "drizzle-orm";
import { pettyCashBoxes, pettyCashTxns, persons } from "../database/schema";
import { postJournal, toCents } from "./ledger";
import { expenseAccount } from "./ledgerPost";
import { writeAudit } from "../utils/audit";
import type { Db } from "../utils/db";

const round2 = (n: number) => Math.round(n * 100) / 100;
const ACC = { cash: "1110", petty: "1130" } as const;

// فتحُ صندوقٍ نثريّ: النقدُ يتحوّل إلى نثريّة (صافي الأصول ثابت). الرصيدُ يبدأ بالسقف.
export async function openBox(db: Db, input: { name: string; floatAmount: number; custodianPersonId?: string; fundId?: string; note?: string; createdBy?: string }): Promise<{ id: string }> {
  const flt = round2(input.floatAmount);
  if (!(flt > 0)) throw new Error("سقفُ النثريّة يجب أن يكون موجبًا");
  const name = input.name.trim();
  if (!name) throw new Error("اسمُ الصندوق مطلوب");
  const id = crypto.randomUUID();
  const fundId = input.fundId ?? "general";
  let custodianName: string | null = null;
  if (input.custodianPersonId) {
    const p = (await db.select({ n: persons.fullName }).from(persons).where(eq(persons.id, input.custodianPersonId)).all())[0];
    custodianName = p?.n ?? null;
  }
  await db.insert(pettyCashBoxes).values({
    id, name, custodianPersonId: input.custodianPersonId ?? null, custodianName,
    floatAmount: flt, balance: flt, fundId, status: "active", createdBy: input.createdBy ?? null, createdAt: Date.now(),
  }).run();
  const cents = toCents(flt);
  await postJournal(db, { source: "petty_open", sourceRef: id, memo: `فتحُ نثريّة: ${name}`, createdBy: input.createdBy }, [
    { accountId: ACC.petty, fundId, debit: cents },
    { accountId: ACC.cash, fundId, credit: cents },
  ]);
  await db.insert(pettyCashTxns).values({ id: crypto.randomUUID(), boxId: id, kind: "open", amount: flt, category: null, note: input.note?.trim() || null, createdBy: input.createdBy ?? null, createdAt: Date.now() }).run();
  await writeAudit(db, { actorUserId: input.createdBy ?? null, action: "open_petty_box", entity: "petty_cash_box", entityId: id, after: { name, floatAmount: flt, fundId } });
  return { id };
}

// مصروفٌ نثريّ: يُنقص الرصيدَ ويُرحّل (Dr مصروف / Cr نثريّة). يمنع الصرفَ بأكثرَ من الرصيد.
export async function recordPettyExpense(db: Db, input: { boxId: string; amount: number; category?: string; note?: string; createdBy?: string }): Promise<{ balance: number }> {
  const box = (await db.select().from(pettyCashBoxes).where(eq(pettyCashBoxes.id, input.boxId)).all())[0];
  if (!box) throw new Error("الصندوقُ غير موجود");
  if (box.status !== "active") throw new Error("الصندوقُ مغلق");
  const amt = round2(input.amount);
  if (!(amt > 0)) throw new Error("المبلغ يجب أن يكون موجبًا");
  if (amt > box.balance + 1e-9) throw new Error("المبلغُ يتجاوز رصيدَ النثريّة المتاح");
  const newBalance = round2(box.balance - amt);
  await db.update(pettyCashBoxes).set({ balance: newBalance }).where(eq(pettyCashBoxes.id, box.id)).run();
  const cents = toCents(amt);
  const txnId = crypto.randomUUID();
  await postJournal(db, { source: "petty_expense", sourceRef: txnId, memo: input.category ?? "مصروفٌ نثريّ", createdBy: input.createdBy }, [
    { accountId: expenseAccount(input.category), fundId: box.fundId, debit: cents },
    { accountId: ACC.petty, fundId: box.fundId, credit: cents },
  ]);
  await db.insert(pettyCashTxns).values({ id: txnId, boxId: box.id, kind: "expense", amount: amt, category: input.category?.trim() || null, note: input.note?.trim() || null, createdBy: input.createdBy ?? null, createdAt: Date.now() }).run();
  return { balance: newBalance };
}

// تزويدُ الصندوق: يُعيد الرصيدَ إلى السقف بمقدار ما صُرِف (Dr نثريّة / Cr نقد). بلا صرفٍ لا حركة.
export async function replenishBox(db: Db, input: { boxId: string; createdBy?: string }): Promise<{ toppedUp: number; balance: number }> {
  const box = (await db.select().from(pettyCashBoxes).where(eq(pettyCashBoxes.id, input.boxId)).all())[0];
  if (!box) throw new Error("الصندوقُ غير موجود");
  const toppedUp = round2(box.floatAmount - box.balance);
  if (toppedUp <= 0) return { toppedUp: 0, balance: box.balance };
  await db.update(pettyCashBoxes).set({ balance: box.floatAmount }).where(eq(pettyCashBoxes.id, box.id)).run();
  const cents = toCents(toppedUp);
  const txnId = crypto.randomUUID();
  await postJournal(db, { source: "petty_replenish", sourceRef: txnId, memo: "تزويدُ نثريّة", createdBy: input.createdBy }, [
    { accountId: ACC.petty, fundId: box.fundId, debit: cents },
    { accountId: ACC.cash, fundId: box.fundId, credit: cents },
  ]);
  await db.insert(pettyCashTxns).values({ id: txnId, boxId: box.id, kind: "replenish", amount: toppedUp, category: null, note: null, createdBy: input.createdBy ?? null, createdAt: Date.now() }).run();
  await writeAudit(db, { actorUserId: input.createdBy ?? null, action: "replenish_petty_box", entity: "petty_cash_box", entityId: box.id, after: { toppedUp } });
  return { toppedUp, balance: box.floatAmount };
}

// حالةُ صندوقٍ: الرصيد/السقف/ما صُرِف + هل يحتاج تزويدًا (صُرِف نصفُ السقف فأكثر).
export async function boxStatus(db: Db, boxId: string): Promise<{ balance: number; floatAmount: number; spent: number; needsReplenish: boolean }> {
  const box = (await db.select().from(pettyCashBoxes).where(eq(pettyCashBoxes.id, boxId)).all())[0];
  if (!box) throw new Error("الصندوقُ غير موجود");
  const spent = round2(box.floatAmount - box.balance);
  return { balance: box.balance, floatAmount: box.floatAmount, spent, needsReplenish: spent >= box.floatAmount * 0.5 };
}

// قائمةُ الصناديق (للعرض) مع ما صُرِف وحاجةِ التزويد.
export async function listBoxes(db: Db): Promise<Array<{ id: string; name: string; custodianName: string | null; floatAmount: number; balance: number; spent: number; needsReplenish: boolean; status: string }>> {
  const rows = await db.select().from(pettyCashBoxes).orderBy(desc(pettyCashBoxes.createdAt)).all();
  return rows.map((b) => {
    const spent = round2(b.floatAmount - b.balance);
    return { id: b.id, name: b.name, custodianName: b.custodianName, floatAmount: b.floatAmount, balance: b.balance, spent, needsReplenish: spent >= b.floatAmount * 0.5, status: b.status };
  });
}

// سجلُّ حركاتِ صندوقٍ (الأحدثُ أولًا) — للمُطالعة والطباعة.
export async function boxTxns(db: Db, boxId: string): Promise<Array<{ id: string; kind: string; amount: number; category: string | null; note: string | null; createdAt: number }>> {
  return db.select({ id: pettyCashTxns.id, kind: pettyCashTxns.kind, amount: pettyCashTxns.amount, category: pettyCashTxns.category, note: pettyCashTxns.note, createdAt: pettyCashTxns.createdAt })
    // كاسرُ تعادلٍ حتميّ (rowid) — التساوي في createdAt (نفسُ الملّيثانية) كان يقلب الترتيب عشوائيًّا
    .from(pettyCashTxns).where(eq(pettyCashTxns.boxId, boxId)).orderBy(desc(pettyCashTxns.createdAt), desc(sql`rowid`)).all();
}
