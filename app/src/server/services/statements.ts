// القوائم الماليّة — قراءةٌ صرفةٌ من الدفتر (لا حالةَ جديدة). المخرجاتُ بالدولار، تُقرأ وتُطبَع.
// قائمةُ النشاط: إيرادٌ − مصروفٌ لكلّ صندوقٍ في فترة. المركزُ الماليّ: أصول = خصوم + صافي أصول.
import { eq } from "drizzle-orm";
import { funds, accounts, journalEntries, journalLines } from "../database/schema";
import { fromCents } from "./ledger";
import { hijriMonthKey } from "../utils/week";
import type { Db } from "../utils/db";

const round2 = (n: number) => Math.round(n * 100) / 100;

type LineRow = { fundId: string; accountId: string; type: string; debit: number; credit: number; entryDate: number; dateHijri: string | null; source: string | null };

async function ledgerLines(db: Db): Promise<LineRow[]> {
  const accType = new Map((await db.select({ id: accounts.id, type: accounts.type }).from(accounts).all()).map((a) => [a.id, a.type]));
  const rows = await db.select({
    fundId: journalLines.fundId, accountId: journalLines.accountId, debit: journalLines.debitCents, credit: journalLines.creditCents,
    entryDate: journalEntries.entryDate, dateHijri: journalEntries.dateHijri, source: journalEntries.source,
  }).from(journalLines).innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId)).all();
  return rows.map((r) => ({ ...r, type: accType.get(r.accountId) ?? "" }));
}

async function fundNames(db: Db): Promise<Array<{ id: string; name: string }>> {
  return db.select({ id: funds.id, name: funds.name }).from(funds).all();
}

// قائمةُ النشاط لفترةٍ (سنة '1447' أو شهر '1447-12'): إيرادٌ ومصروفٌ وصافٍ لكلّ صندوق.
export async function statementOfActivities(db: Db, period: string): Promise<{
  period: string;
  funds: Array<{ fundId: string; fundName: string; income: number; expense: number; net: number }>;
  totals: { income: number; expense: number; net: number };
}> {
  const lines = await ledgerLines(db);
  const fn = await fundNames(db);
  const incCents = new Map<string, number>(), expCents = new Map<string, number>();
  for (const l of lines) {
    const hp = l.dateHijri || hijriMonthKey(new Date(l.entryDate));
    if (!hp.startsWith(period)) continue;
    if (l.type === "income") incCents.set(l.fundId, (incCents.get(l.fundId) ?? 0) + (l.credit - l.debit));
    else if (l.type === "expense") expCents.set(l.fundId, (expCents.get(l.fundId) ?? 0) + (l.debit - l.credit));
  }
  const rows = fn.map((f) => {
    const income = round2(fromCents(incCents.get(f.id) ?? 0));
    const expense = round2(fromCents(expCents.get(f.id) ?? 0));
    return { fundId: f.id, fundName: f.name, income, expense, net: round2(income - expense) };
  }).filter((r) => r.income !== 0 || r.expense !== 0);
  return {
    period,
    funds: rows,
    totals: {
      income: round2(rows.reduce((s, r) => s + r.income, 0)),
      expense: round2(rows.reduce((s, r) => s + r.expense, 0)),
      net: round2(rows.reduce((s, r) => s + r.net, 0)),
    },
  };
}

// بيانُ التدفّق النقديّ (Cash Flow) — الطريقةُ المباشرة: حركةُ مجمّع النقد ومكافئاته مصنّفةً بمصدر القيد.
// مجمّعُ النقد ومكافئاته = كلُّ أبناء «النقد والصناديق» (1100): نقدٌ محلّيّ/أجنبيّ + بنك + نثريّة. التحويلاتُ الداخليّةُ صفريّةُ الأثر.
async function cashAccountSet(db: Db): Promise<Set<string>> {
  const rows = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.parentId, "1100")).all();
  return new Set(rows.map((r) => r.id));
}
const CF_LABEL: Record<string, string> = {
  donation: "تبرّعات", expense: "مصروفاتٌ تشغيليّة", payout: "رواتبُ مصروفة", fuel: "محروقاتٌ وصيانة",
  petty_expense: "مصروفاتٌ نثريّة", capitalize: "شراءُ أصولٍ ثابتة", dispose: "بيعُ أصول",
  advance: "سُلَفٌ ممنوحة", advance_repay: "استردادُ سُلَف",
};
const CF_CATEGORY: Record<string, "operating" | "investing" | "financing"> = {
  donation: "operating", expense: "operating", payout: "operating", fuel: "operating", petty_expense: "operating",
  capitalize: "investing", dispose: "investing",
  advance: "financing", advance_repay: "financing",
};

export async function cashFlowStatement(db: Db, period?: string): Promise<{
  period: string;
  operating: { lines: Array<{ source: string; label: string; amount: number }>; net: number };
  investing: { lines: Array<{ source: string; label: string; amount: number }>; net: number };
  financing: { lines: Array<{ source: string; label: string; amount: number }>; net: number };
  netChange: number;
  cashBalance: number;
}> {
  const CASH_ACCOUNTS = await cashAccountSet(db);
  const rows = await db.select({
    entryId: journalLines.entryId, accountId: journalLines.accountId, debit: journalLines.debitCents, credit: journalLines.creditCents,
    entryDate: journalEntries.entryDate, dateHijri: journalEntries.dateHijri, source: journalEntries.source,
  }).from(journalLines).innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId)).all();

  // صافي أثرِ كلّ قيدٍ على مجمّع النقد (Σ مدين−دائن على حسابات النقد) — التحويلُ الداخليّ يساوي صفرًا.
  const perEntry = new Map<string, { delta: number; source: string; hp: string }>();
  let cashBalance = 0;
  for (const r of rows) {
    if (!CASH_ACCOUNTS.has(r.accountId)) continue;
    const d = r.debit - r.credit;
    cashBalance += d;
    const hp = r.dateHijri || hijriMonthKey(new Date(r.entryDate));
    const e = perEntry.get(r.entryId) ?? { delta: 0, source: r.source ?? "other", hp };
    e.delta += d;
    perEntry.set(r.entryId, e);
  }

  const cats: Record<"operating" | "investing" | "financing", Map<string, number>> = { operating: new Map(), investing: new Map(), financing: new Map() };
  for (const e of perEntry.values()) {
    if (e.delta === 0) continue;                       // تحويلٌ داخليٌّ أو غيرُ نقديّ
    if (period && !e.hp.startsWith(period)) continue;   // خارجَ الفترة المطلوبة
    const cat = CF_CATEGORY[e.source] ?? "operating";
    cats[cat].set(e.source, (cats[cat].get(e.source) ?? 0) + e.delta);
  }

  const build = (m: Map<string, number>) => {
    const lines = [...m.entries()].map(([source, c]) => ({ source, label: CF_LABEL[source] ?? source, amount: round2(fromCents(c)) })).filter((l) => l.amount !== 0);
    return { lines, net: round2(lines.reduce((s, l) => s + l.amount, 0)) };
  };
  const operating = build(cats.operating), investing = build(cats.investing), financing = build(cats.financing);
  return {
    period: period ?? "الكلّ",
    operating, investing, financing,
    netChange: round2(operating.net + investing.net + financing.net),
    cashBalance: round2(fromCents(cashBalance)),
  };
}

// المركزُ الماليّ (تراكميّ، بلا فترة): أصولٌ وخصومٌ وصافي أصولٍ بالصناديق، مع برهان التوازن.
export async function statementOfPosition(db: Db): Promise<{
  assets: Array<{ accountId: string; name: string; balance: number }>;
  liabilities: Array<{ accountId: string; name: string; balance: number }>;
  netAssetsByFund: Array<{ fundId: string; fundName: string; balance: number }>;
  assetsTotal: number; liabilitiesTotal: number; netAssetsTotal: number; balanced: boolean;
}> {
  const lines = await ledgerLines(db);
  const accName = new Map((await db.select({ id: accounts.id, name: accounts.name }).from(accounts).all()).map((a) => [a.id, a.name]));
  const fn = await fundNames(db);
  const assetCents = new Map<string, number>(), liabCents = new Map<string, number>();
  const netByFund = new Map<string, number>(); // صافي الأصول = إيراد − مصروف تراكميًّا لكلّ صندوق
  for (const l of lines) {
    if (l.type === "asset") assetCents.set(l.accountId, (assetCents.get(l.accountId) ?? 0) + (l.debit - l.credit));
    else if (l.type === "liability") liabCents.set(l.accountId, (liabCents.get(l.accountId) ?? 0) + (l.credit - l.debit));
    else if (l.type === "income") netByFund.set(l.fundId, (netByFund.get(l.fundId) ?? 0) + (l.credit - l.debit));
    else if (l.type === "expense") netByFund.set(l.fundId, (netByFund.get(l.fundId) ?? 0) - (l.debit - l.credit));
    // الأرصدةُ الافتتاحيّة (0070): «الرصيدُ المرحَّل» 3100 نوعُه net_assets — دائنُه يزيد صافيَ أصول صندوقه
    else if (l.type === "net_assets") netByFund.set(l.fundId, (netByFund.get(l.fundId) ?? 0) + (l.credit - l.debit));
  }
  const assets = [...assetCents.entries()].map(([id, c]) => ({ accountId: id, name: accName.get(id) ?? id, balance: round2(fromCents(c)) })).filter((a) => a.balance !== 0);
  const liabilities = [...liabCents.entries()].map(([id, c]) => ({ accountId: id, name: accName.get(id) ?? id, balance: round2(fromCents(c)) })).filter((a) => a.balance !== 0);
  const netAssetsByFund = fn.map((f) => ({ fundId: f.id, fundName: f.name, balance: round2(fromCents(netByFund.get(f.id) ?? 0)) })).filter((f) => f.balance !== 0);
  const assetsTotal = round2(assets.reduce((s, a) => s + a.balance, 0));
  const liabilitiesTotal = round2(liabilities.reduce((s, a) => s + a.balance, 0));
  const netAssetsTotal = round2(netAssetsByFund.reduce((s, f) => s + f.balance, 0));
  return { assets, liabilities, netAssetsByFund, assetsTotal, liabilitiesTotal, netAssetsTotal, balanced: assetsTotal === round2(liabilitiesTotal + netAssetsTotal) };
}
