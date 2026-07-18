// منطق «الحوافز التشغيلية» (المادة 9-ب) — مبالغ تحفيزية اختيارية لمستفيدين، شهرياً (هجري).
// نطاق الإدارة العليا فقط (مالية الشبكة، حسّاسة للخصوصية) — اسم المستفيد نصّي حرّ.
import { desc, eq } from "drizzle-orm";
import { useDb } from "./utils/db";
import { incentives } from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";

async function requireFinanceAdmin() {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  if (!isGlobalAdmin(u)) throw new Error("الحوافز للإدارة العليا فقط");
  return u;
}

export async function incentivesData(month?: string) {
  await requireFinanceAdmin();
  const db = useDb();
  const base = db.select().from(incentives);
  const rows = month
    ? await base.where(eq(incentives.month, month)).orderBy(desc(incentives.createdAt)).all()
    : await base.orderBy(desc(incentives.createdAt)).all();
  const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
  return {
    total: Math.round(total * 100) / 100,
    items: rows.map((r) => ({ id: r.id, name: r.recipientName || "—", month: r.month, reason: r.reason, amount: r.amount })),
  };
}

export async function addIncentiveData(input: { recipientName: string; month: string; amount: number; reason?: string }) {
  const u = await requireFinanceAdmin();
  const db = useDb();
  const id = crypto.randomUUID();
  await db.insert(incentives).values({
    id, personId: "", recipientName: input.recipientName.trim(), month: input.month,
    amount: input.amount, reason: input.reason?.trim() || null, createdBy: u.userId, createdAt: Date.now(),
  }).run();
  return { ok: true as const, id };
}

export async function removeIncentiveData(input: { id: string }) {
  await requireFinanceAdmin();
  const db = useDb();
  await db.delete(incentives).where(eq(incentives.id, input.id)).run();
  return { ok: true as const };
}
