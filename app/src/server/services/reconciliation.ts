// المطابقةُ البنكيّة/النقديّة: يوسَم كلُّ قيدٍ يمسّ حسابَ نقدٍ بأنّه «طُوبِق» (ظهر في كشف البنك/الجرد).
// التقريرُ يقابل رصيدَ الدفتر: المُطابَق + غيرُ المُطابَق = رصيدُ الدفتر. الهدفُ أن يساوي المُطابَقُ كشفَ البنك.
import { and, eq, desc } from "drizzle-orm";
import { journalEntries, journalLines, reconciliations } from "../database/schema";
import { fromCents } from "./ledger";
import type { Db } from "../utils/db";

const round2 = (n: number) => Math.round(n * 100) / 100;

// أحدثُ قيودِ حسابٍ (للعرض والوسم) مع علمِ المطابقة — بحدٍّ أعلى لتفادي حدود المتغيّرات.
export async function reconcilableEntries(db: Db, accountId: string, limit = 200): Promise<Array<{ entryId: string; date: number; memo: string | null; amount: number; reconciled: boolean }>> {
  const rows = await db.select({ entryId: journalEntries.id, date: journalEntries.entryDate, memo: journalEntries.memo, d: journalLines.debitCents, c: journalLines.creditCents })
    .from(journalLines).innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .where(eq(journalLines.accountId, accountId)).orderBy(desc(journalEntries.entryDate)).limit(limit).all();
  const net = new Map<string, { date: number; memo: string | null; amount: number }>();
  for (const r of rows) {
    const e = net.get(r.entryId) ?? { date: r.date, memo: r.memo, amount: 0 };
    e.amount += r.d - r.c;
    net.set(r.entryId, e);
  }
  const recSet = new Set((await db.select({ e: reconciliations.entryId }).from(reconciliations).where(eq(reconciliations.accountId, accountId)).all()).map((r) => r.e));
  return [...net.entries()].map(([entryId, v]) => ({ entryId, date: v.date, memo: v.memo, amount: round2(fromCents(v.amount)), reconciled: recSet.has(entryId) }))
    .sort((a, b) => b.date - a.date);
}

// وسمٌ/إلغاءُ وسمٍ لقيدٍ في حسابٍ (idempotent).
export async function setReconciled(db: Db, input: { entryId: string; accountId: string; reconciled: boolean; reconciledBy?: string; note?: string }): Promise<void> {
  const existing = (await db.select().from(reconciliations).where(and(eq(reconciliations.entryId, input.entryId), eq(reconciliations.accountId, input.accountId))).all())[0];
  if (input.reconciled && !existing) {
    await db.insert(reconciliations).values({ id: crypto.randomUUID(), entryId: input.entryId, accountId: input.accountId, reconciledBy: input.reconciledBy ?? null, reconciledAt: Date.now(), note: input.note?.trim() || null }).run();
  } else if (!input.reconciled && existing) {
    await db.delete(reconciliations).where(eq(reconciliations.id, existing.id)).run();
  }
}

// ملخّصُ المطابقة: رصيدُ الدفتر (كلُّ الحركات) + المُطابَق + غيرُ المُطابَق (فرقُهما).
export async function reconciliationSummary(db: Db, accountId: string): Promise<{ bookBalance: number; cleared: number; uncleared: number; unclearedCount: number }> {
  const all = await db.select({ d: journalLines.debitCents, c: journalLines.creditCents }).from(journalLines).where(eq(journalLines.accountId, accountId)).all();
  const bookCents = all.reduce((s, r) => s + (r.d - r.c), 0);
  const clearedRows = await db.select({ d: journalLines.debitCents, c: journalLines.creditCents })
    .from(reconciliations).innerJoin(journalLines, and(eq(journalLines.entryId, reconciliations.entryId), eq(journalLines.accountId, reconciliations.accountId)))
    .where(eq(reconciliations.accountId, accountId)).all();
  const clearedCents = clearedRows.reduce((s, r) => s + (r.d - r.c), 0);
  const clearedEntries = (await db.select({ e: reconciliations.entryId }).from(reconciliations).where(eq(reconciliations.accountId, accountId)).all()).length;
  const totalEntries = new Set(all.length ? (await db.select({ e: journalLines.entryId }).from(journalLines).where(eq(journalLines.accountId, accountId)).all()).map((r) => r.e) : []).size;
  return { bookBalance: round2(fromCents(bookCents)), cleared: round2(fromCents(clearedCents)), uncleared: round2(fromCents(bookCents - clearedCents)), unclearedCount: totalEntries - clearedEntries };
}
