// المالية الداخلية للمسجد (خادم فقط) — تبرعات/مصروفات/ميزان، مع عزل النطاق.
import { and, desc, eq, sql } from "drizzle-orm";
import { useDb } from "./utils/db";
import { donations, expenses, orgUnits } from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin, canAccessPath, type AuthUser } from "./utils/context";
import { addDonation, addExpense } from "./services/mosqueFinance";

function userMosqueId(u: AuthUser | null): string | null {
  if (!u) return null;
  const a = u.assignments.find((x) => x.role === "amir");
  return a?.orgUnitId ?? null;
}
const PAGE = 20;
async function num(query: { all: () => Promise<Array<Record<string, number>>> }, key: string) {
  return (await query.all())[0]?.[key] ?? 0;
}

export async function mosqueFinanceData(mosqueIdArg?: string) {
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const db = useDb();
  const mid = mosqueIdArg || userMosqueId(u);
  if (!mid) return { mosque: null };
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, mid)).all())[0];
  if (!mosque || mosque.type !== "mosque") return { mosque: null };
  if (!isGlobalAdmin(u) && !canAccessPath(u, mosque.path)) return { mosque: null };

  const donTotal = await num(db.select({ s: sql<number>`coalesce(sum(amount),0)` }).from(donations).where(eq(donations.mosqueId, mid)), "s");
  const donCount = await num(db.select({ c: sql<number>`count(*)` }).from(donations).where(eq(donations.mosqueId, mid)), "c");
  const expTotal = await num(db.select({ s: sql<number>`coalesce(sum(amount),0)` }).from(expenses).where(eq(expenses.mosqueId, mid)), "s");
  const expCount = await num(db.select({ c: sql<number>`count(*)` }).from(expenses).where(eq(expenses.mosqueId, mid)), "c");
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    mosque: { id: mosque.id, name: mosque.name },
    totals: { donations: r2(donTotal), expenses: r2(expTotal), balance: r2(donTotal - expTotal), donCount, expCount },
  };
}

export async function mosqueTxns(mosqueId: string, kind: "donation" | "expense", offset = 0) {
  const u = await currentUser();
  if (!u) return { items: [], total: 0, offset, pageSize: PAGE };
  const db = useDb();
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all())[0];
  if (!mosque || (!isGlobalAdmin(u) && !canAccessPath(u, mosque.path))) return { items: [], total: 0, offset, pageSize: PAGE };

  if (kind === "donation") {
    const rows = await db.select().from(donations).where(eq(donations.mosqueId, mosqueId)).orderBy(desc(donations.at)).limit(PAGE).offset(offset).all();
    const total = await num(db.select({ c: sql<number>`count(*)` }).from(donations).where(eq(donations.mosqueId, mosqueId)), "c");
    return { items: rows.map((d) => ({ id: d.id, label: d.donorName ?? "متبرّع", amount: d.amount, note: d.note, at: d.at })), total, offset, pageSize: PAGE };
  }
  const rows = await db.select().from(expenses).where(eq(expenses.mosqueId, mosqueId)).orderBy(desc(expenses.at)).limit(PAGE).offset(offset).all();
  const total = await num(db.select({ c: sql<number>`count(*)` }).from(expenses).where(eq(expenses.mosqueId, mosqueId)), "c");
  return { items: rows.map((e) => ({ id: e.id, label: e.category ?? "مصروف", amount: e.amount, note: e.note, at: e.at })), total, offset, pageSize: PAGE };
}

async function requireMosqueManage(mosqueId: string) {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const db = useDb();
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all())[0];
  if (!mosque || mosque.type !== "mosque") throw new Error("المسجد غير موجود");
  const isAdmin = isGlobalAdmin(u);
  const isAmir = u.assignments.some((a) => a.role === "amir" && a.orgUnitId === mosqueId);
  if (!isAdmin && !isAmir) throw new Error("يحتاج دور أمير المسجد");
  return u;
}

export async function addDonationData(input: { mosqueId: string; donorName?: string; amount: number; note?: string; fund?: string; currency?: string }) {
  const u = await requireMosqueManage(input.mosqueId);
  // الاعتمادُ الثنائيّ (الوثيقة ٢٨): مَن عليه سياسةٌ (المسؤول الماليّ) يُقترَح فعلُه — الأمراءُ مباشرون (قرار ٢)
  const { guardFinanceAction } = await import("./services/financeActions");
  const g = await guardFinanceAction(useDb(), u, {
    kind: "donation_add", payload: { ...input },
    summary: `تبرّعٌ ${input.amount.toLocaleString()} ${input.currency ?? "$"} لصندوق ${input.fund ?? "general"}${input.donorName ? ` من ${input.donorName}` : ""}`,
    amountUsd: !input.currency || input.currency === "USD" ? input.amount : 0, currency: input.currency,
  });
  if (g.queued) return { queued: true as const, actionId: g.id!, message: "أُرسل الاقتراحُ لاعتماد المدير" };
  // و١: تسجيلٌ كاملٌ — مانحٌ + صندوقٌ + سندُ قبضٍ مرقّم + ترحيلٌ للدفتر (بعملته الأصليّة)
  const { recordDonation } = await import("./services/donorsFinance");
  try {
    const res = await recordDonation(useDb(), { mosqueId: input.mosqueId, amount: input.amount, fund: input.fund, donorName: input.donorName, note: input.note, currency: input.currency, collectedBy: u.userId });
    return { ok: true as const, receiptNo: res.receiptNo };
  } catch (e) { return { error: (e as Error).message } as { error: string }; }
}

export async function addExpenseData(input: { mosqueId: string; category?: string; amount: number; note?: string; fund?: string; currency?: string }) {
  const u = await requireMosqueManage(input.mosqueId);
  const db = useDb();
  // تعدّدُ العملات: المبلغُ بعملته الأصليّة؛ نحوّله للدولار للتخزين وضبطِ الصندوق والدفتر
  const foreign = !!input.currency && input.currency !== "USD";
  let usd = input.amount;
  if (foreign) { try { const { convertToBase } = await import("./services/currencies"); usd = await convertToBase(db, input.currency!, input.amount); } catch (e) { return { error: (e as Error).message } as { error: string }; } }
  // الاعتمادُ الثنائيّ: الحمولةُ بالدولار + بيانُ العملة الأصليّة (نفسُ عقد enterExpense)
  const { guardFinanceAction } = await import("./services/financeActions");
  const g = await guardFinanceAction(db, u, {
    kind: "expense_add",
    payload: { mosqueId: input.mosqueId, category: input.category, amount: usd, note: input.note, fund: input.fund, currency: foreign ? input.currency : undefined, origAmount: foreign ? input.amount : undefined },
    summary: `مصروفُ «${input.category ?? "عام"}» $${usd} من صندوق ${input.fund ?? "general"}`, amountUsd: usd,
    currency: foreign ? input.currency : undefined, origAmount: foreign ? input.amount : undefined,
  });
  if (g.queued) return { queued: true as const, actionId: g.id!, message: "أُرسل الاقتراحُ لاعتماد المدير" };
  // التنفيذُ الموحَّد (خدمةُ financeEntry): حارسُ المقيَّد + الصفُّ + الترحيلُ + تحذيرُ الموازنة (ز٢)
  const { enterExpense } = await import("./services/financeEntry");
  try {
    const entered = await enterExpense(db, { mosqueId: input.mosqueId, category: input.category, amount: usd, note: input.note, fund: input.fund, currency: foreign ? input.currency : undefined, origAmount: foreign ? input.amount : undefined }, u.userId);
    return { ok: true as const, budgetWarning: entered.budgetWarning };
  } catch (e) { return { error: (e as Error).message } as const; }
}
