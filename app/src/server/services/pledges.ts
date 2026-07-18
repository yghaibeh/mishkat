// المرحلة ١ — التعهّدات: تعهّدُ مانحٍ بمبلغٍ لصندوق، ومتابعةُ الموفَى والمتبقّي.
// عند تبرّعِ المتعهِّد لنفس الصندوق يُطبَّق آليًّا على تعهّداته المفتوحة (الأقدمُ أوّلًا).
import { and, eq, asc } from "drizzle-orm";
import { pledges, donors } from "../database/schema";
import { writeAudit } from "../utils/audit";
import type { Db } from "../utils/db";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function recordPledge(db: Db, input: { donorId: string; amount: number; fund?: string; dueAt?: number; note?: string; createdBy?: string }): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await db.insert(pledges).values({
    id, donorId: input.donorId, fundId: input.fund ?? "general", amount: input.amount, fulfilled: 0,
    dueAt: input.dueAt ?? null, status: "open", note: input.note?.trim() || null, createdBy: input.createdBy ?? null, createdAt: Date.now(),
  }).run();
  await writeAudit(db, { actorUserId: input.createdBy ?? null, action: "record_pledge", entity: "pledge", entityId: id, after: { donorId: input.donorId, amount: input.amount, fund: input.fund ?? "general" } });
  return { id };
}

// يُطبّق مبلغَ وفاءٍ على تعهّدات المانح المفتوحة لنفس الصندوق (الأقدمُ أوّلًا). يُعيد المُطبَّقَ والفائض.
export async function applyToPledges(db: Db, input: { donorId: string; fund: string; amount: number }): Promise<{ applied: number; remainder: number }> {
  let remaining = input.amount;
  const open = await db.select().from(pledges).where(and(
    eq(pledges.donorId, input.donorId), eq(pledges.fundId, input.fund), eq(pledges.status, "open"),
  )).orderBy(asc(pledges.createdAt)).all();
  for (const p of open) {
    if (remaining <= 0) break;
    const need = round2(p.amount - p.fulfilled);
    if (need <= 0) continue;
    const pay = Math.min(need, remaining);
    const newFulfilled = round2(p.fulfilled + pay);
    const done = newFulfilled >= round2(p.amount);
    await db.update(pledges).set({ fulfilled: newFulfilled, status: done ? "fulfilled" : "open" }).where(eq(pledges.id, p.id)).run();
    remaining = round2(remaining - pay);
  }
  return { applied: round2(input.amount - remaining), remainder: round2(remaining) };
}

// التعهّداتُ المفتوحةُ مع المتبقّي (للتقرير والتذكير)
export async function openPledges(db: Db): Promise<Array<{ id: string; donorId: string; donorName: string; fund: string; amount: number; fulfilled: number; remaining: number; dueAt: number | null }>> {
  const rows = await db.select().from(pledges).where(eq(pledges.status, "open")).all();
  if (!rows.length) return [];
  const dn = new Map((await db.select({ id: donors.id, name: donors.name }).from(donors).all()).map((d) => [d.id, d.name]));
  return rows.map((p) => ({
    id: p.id, donorId: p.donorId, donorName: dn.get(p.donorId) ?? "—", fund: p.fundId,
    amount: p.amount, fulfilled: p.fulfilled, remaining: round2(p.amount - p.fulfilled), dueAt: p.dueAt,
  })).filter((p) => p.remaining > 0).sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity));
}
