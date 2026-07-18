import { eq } from 'drizzle-orm'
import { annualPlans, planItems } from '../database/schema'
import type { Db } from '../utils/db'

// خطط اللجان السنوية ومتابعة تنفيذها (المواد 21، 24–33)

export async function createPlan(db: Db, input: { orgUnitId: string; committee: string; yearHijri: string; title: string }) {
  const id = crypto.randomUUID()
  await db.insert(annualPlans).values({ id, ...input, createdAt: Date.now() }).run()
  return { id }
}

export async function addPlanItem(db: Db, planId: string, title: string, dueAt?: number) {
  const id = crypto.randomUUID()
  await db.insert(planItems).values({ id, planId, title, status: 'planned', dueAt: dueAt ?? null, doneAt: null }).run()
  return { id }
}

export async function setItemStatus(db: Db, itemId: string, status: 'planned' | 'in_progress' | 'done') {
  await db.update(planItems).set({ status, doneAt: status === 'done' ? Date.now() : null }).where(eq(planItems.id, itemId)).run()
  return { status }
}

// نسبة إنجاز الخطة
export async function planProgress(db: Db, planId: string) {
  const items = await db.select().from(planItems).where(eq(planItems.planId, planId)).all()
  const total = items.length
  const done = items.filter((i) => i.status === 'done').length
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
}
