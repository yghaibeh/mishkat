// و٢ — كشوفُ المانحين وتقاريرُهم (قراءة). أرقامٌ نهائيّةٌ تُقرأ وتُطبَع.
import { eq, like } from "drizzle-orm";
import { donors, donations } from "../database/schema";
import type { Db } from "../utils/db";

const round2 = (n: number) => Math.round(n * 100) / 100;

// قائمةُ المانحين بإجماليّ تبرّعاتهم وعددها — الأعلى أوّلًا، مع بحثٍ بالاسم.
export async function donorsList(db: Db, q?: string): Promise<Array<{ id: string; name: string; total: number; count: number }>> {
  const term = (q ?? "").trim();
  const ds = term
    ? await db.select().from(donors).where(like(donors.name, `%${term}%`)).all()
    : await db.select().from(donors).all();
  if (!ds.length) return [];
  const allDon = await db.select({ donorId: donations.donorId, amount: donations.amount }).from(donations).all();
  return ds.map((d) => {
    const mine = allDon.filter((x) => x.donorId === d.id);
    return { id: d.id, name: d.name, total: round2(mine.reduce((s, x) => s + x.amount, 0)), count: mine.length };
  }).sort((a, b) => b.total - a.total);
}

// كشفٌ كاملٌ لمانح: بياناتُه + تبرّعاتُه بسنداتها + تجميعٌ بالصندوق.
export async function donorFullStatement(db: Db, donorId: string): Promise<{
  donor: { id: string; name: string; phone: string | null };
  total: number;
  items: Array<{ receiptNo: string | null; fund: string; amount: number; at: number; note: string | null }>;
  byFund: Array<{ fund: string; amount: number }>;
}> {
  const d = (await db.select().from(donors).where(eq(donors.id, donorId)).all())[0];
  const rows = await db.select().from(donations).where(eq(donations.donorId, donorId)).all();
  const items = rows.map((r) => ({ receiptNo: r.receiptNo, fund: r.fundId, amount: r.amount, at: r.at, note: r.note }))
    .sort((a, b) => b.at - a.at);
  const fundMap = new Map<string, number>();
  for (const i of items) fundMap.set(i.fund, (fundMap.get(i.fund) ?? 0) + i.amount);
  return {
    donor: { id: d?.id ?? donorId, name: d?.name ?? "—", phone: d?.phone ?? null },
    total: round2(items.reduce((s, i) => s + i.amount, 0)),
    items,
    byFund: [...fundMap.entries()].map(([fund, amount]) => ({ fund, amount: round2(amount) })).sort((a, b) => b.amount - a.amount),
  };
}
