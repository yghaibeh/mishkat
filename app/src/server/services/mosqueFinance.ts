import { eq } from 'drizzle-orm'
import { donations, expenses } from '../database/schema'
import { writeAudit } from '../utils/audit'
import type { Db } from '../utils/db'

// المالية الداخلية للمسجد (المواد 23/35/36) — تبرعات وميزانية، منفصلة عن مستحقات المشروع.

export async function addDonation(db: Db, input: {
  mosqueId: string; donorName?: string; amount: number; collectedBy?: string; approvedByAmir?: boolean; note?: string
}, actorUserId?: string) {
  const id = crypto.randomUUID()
  await db.insert(donations).values({
    id, mosqueId: input.mosqueId, donorName: input.donorName ?? null, amount: input.amount,
    collectedBy: input.collectedBy ?? null, approvedByAmir: input.approvedByAmir ?? true,
    note: input.note ?? null, at: Date.now(),
  }).run()
  await writeAudit(db, { actorUserId: actorUserId ?? null, action: 'add_donation', entity: 'donation', entityId: id, after: { mosqueId: input.mosqueId, amount: input.amount } })
  return { id }
}

export async function addExpense(db: Db, input: {
  mosqueId: string; category?: string; amount: number; spentBy?: string; note?: string; fund?: string; currency?: string; origAmount?: number
}, actorUserId?: string) {
  const id = crypto.randomUUID()
  await db.insert(expenses).values({
    id, mosqueId: input.mosqueId, category: input.category ?? null, amount: input.amount,
    spentBy: input.spentBy ?? null, note: input.note ?? null, fundId: input.fund ?? 'general',
    currency: input.currency && input.currency !== 'USD' ? input.currency : null, origAmount: input.origAmount ?? null, at: Date.now(),
  }).run()
  await writeAudit(db, { actorUserId: actorUserId ?? null, action: 'add_expense', entity: 'expense', entityId: id, after: { mosqueId: input.mosqueId, amount: input.amount, currency: input.currency ?? 'USD' } })
  return { id }
}

// ميزان المسجد: مجموع التبرعات − مجموع المصروفات
export async function mosqueBalance(db: Db, mosqueId: string) {
  const dons = await db.select().from(donations).where(eq(donations.mosqueId, mosqueId)).all()
  const exps = await db.select().from(expenses).where(eq(expenses.mosqueId, mosqueId)).all()
  const totalDonations = Math.round(dons.reduce((s, d) => s + d.amount, 0) * 100) / 100
  const totalExpenses = Math.round(exps.reduce((s, e) => s + e.amount, 0) * 100) / 100
  return { totalDonations, totalExpenses, balance: Math.round((totalDonations - totalExpenses) * 100) / 100 }
}
