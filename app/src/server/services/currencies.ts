// تعدّدُ العملات — نموذجُ العملة الوظيفيّة: الدفترُ بالدولار (الأساس)، والعملاتُ الأجنبيّةُ تُحوَّل بسعرها.
// الأسعارُ مؤرّخة (يُستعمل أحدثُها). التصريفُ (exchange) يُثبِت مكاسبَ/خسائرَ فروق العملة تلقائيًّا.
import { and, eq, desc, sql } from "drizzle-orm";
import { currencies, fxRates, journalLines, accounts } from "../database/schema";
import { postJournal, toCents, fromCents } from "./ledger";
import { writeAudit } from "../utils/audit";
import type { Db } from "../utils/db";

const round2 = (n: number) => Math.round(n * 100) / 100;
const ACC = { gain: "4910", loss: "5910" } as const;

export async function listCurrencies(db: Db): Promise<Array<{ code: string; name: string; symbol: string; isBase: boolean; cashAccount: string; rate: number }>> {
  const rows = await db.select().from(currencies).where(eq(currencies.active, true)).orderBy(currencies.sortOrder).all();
  const out = [];
  for (const c of rows) out.push({ code: c.code, name: c.name, symbol: c.symbol, isBase: c.isBase, cashAccount: c.cashAccount, rate: await latestRate(db, c.code) });
  return out;
}

export async function cashAccountFor(db: Db, code: string): Promise<string> {
  const c = (await db.select({ a: currencies.cashAccount }).from(currencies).where(eq(currencies.code, code)).all())[0];
  if (!c) throw new Error(`عملةٌ غير معروفة: ${code}`);
  return c.a;
}

async function isBase(db: Db, code: string): Promise<boolean> {
  const c = (await db.select({ b: currencies.isBase }).from(currencies).where(eq(currencies.code, code)).all())[0];
  return !!c?.b;
}

// أحدثُ سعرِ صرفٍ للعملة (كم دولارًا تساوي وحدةٌ واحدة). الأساسُ = 1.
export async function latestRate(db: Db, code: string): Promise<number> {
  if (await isBase(db, code)) return 1;
  const r = (await db.select({ r: fxRates.rateToBase }).from(fxRates).where(eq(fxRates.currency, code)).orderBy(desc(fxRates.effectiveAt)).limit(1).all())[0];
  return r?.r ?? 0;
}

// ضبطُ سعرِ صرفٍ (بأثرٍ من الآن). rateToBase = كم دولارًا تساوي وحدةٌ واحدة من العملة.
export async function setRate(db: Db, input: { currency: string; rateToBase: number; createdBy?: string }): Promise<{ id: string }> {
  const cur = (await db.select().from(currencies).where(eq(currencies.code, input.currency)).all())[0];
  if (!cur) throw new Error("عملةٌ غير معروفة");
  if (cur.isBase) throw new Error("عملةُ الأساس سعرُها ثابتٌ = 1");
  if (!(input.rateToBase > 0)) throw new Error("السعرُ يجب أن يكون موجبًا");
  const id = crypto.randomUUID();
  await db.insert(fxRates).values({ id, currency: input.currency, rateToBase: input.rateToBase, effectiveAt: Date.now(), createdBy: input.createdBy ?? null, createdAt: Date.now() }).run();
  await writeAudit(db, { actorUserId: input.createdBy ?? null, action: "set_fx_rate", entity: "fx_rate", entityId: id, after: { currency: input.currency, rateToBase: input.rateToBase } });
  return { id };
}

// تحويلُ مبلغٍ من عملةٍ إلى الدولار (الأساس) بأحدث سعر. يرمي إن لم يوجد سعرٌ لعملةٍ أجنبيّة.
export async function convertToBase(db: Db, code: string, amount: number): Promise<number> {
  if (await isBase(db, code)) return round2(amount);
  const rate = await latestRate(db, code);
  if (!(rate > 0)) throw new Error(`لا سعرَ صرفٍ للعملة ${code} — اضبطه أوّلًا`);
  return round2(amount * rate);
}

// أرصدةُ النقد لكلّ عملة: المقدارُ بالعملة الأصليّة + قيمتُه الدفتريّةُ بالدولار.
export async function currencyBalances(db: Db): Promise<Array<{ code: string; name: string; symbol: string; isBase: boolean; native: number; usdValue: number; rate: number }>> {
  const curs = await db.select().from(currencies).where(eq(currencies.active, true)).orderBy(currencies.sortOrder).all();
  const out = [];
  for (const c of curs) {
    // القيمةُ الدفتريّةُ بالدولار = صافي مدين−دائن على حساب نقد العملة (بالسنتات)
    const usdRow = (await db.select({ d: sql<number>`coalesce(sum(${journalLines.debitCents}),0)`, cr: sql<number>`coalesce(sum(${journalLines.creditCents}),0)` })
      .from(journalLines).where(eq(journalLines.accountId, c.cashAccount)).all())[0];
    const usdValue = round2(fromCents((usdRow?.d ?? 0) - (usdRow?.cr ?? 0)));
    let native: number;
    if (c.isBase) native = usdValue; // الأساسُ: المقدارُ = القيمةُ الدولاريّة
    else {
      // المقدارُ الأصليّ = Σ(amount_orig موجبٌ للمدين، سالبٌ للدائن) على حساب النقد
      const natRow = (await db.select({
        d: sql<number>`coalesce(sum(case when ${journalLines.debitCents} > 0 then ${journalLines.amountOrig} else 0 end),0)`,
        cr: sql<number>`coalesce(sum(case when ${journalLines.creditCents} > 0 then ${journalLines.amountOrig} else 0 end),0)`,
      }).from(journalLines).where(and(eq(journalLines.accountId, c.cashAccount), eq(journalLines.currency, c.code))).all())[0];
      native = round2(fromCents((natRow?.d ?? 0) - (natRow?.cr ?? 0)));
    }
    out.push({ code: c.code, name: c.name, symbol: c.symbol, isBase: c.isBase, native, usdValue, rate: await latestRate(db, c.code) });
  }
  return out;
}

// تصريفٌ: إعطاءُ مبلغٍ بعملةٍ وأخذُ مبلغٍ بأخرى. يُقوَّم الطرفان بالدولار، والفرقُ مكسبٌ/خسارةُ صرف.
export async function recordExchange(db: Db, input: { fromCurrency: string; fromAmount: number; toCurrency: string; toAmount: number; fundId?: string; createdBy?: string }): Promise<{ usdFrom: number; usdTo: number; gain: number; loss: number }> {
  if (input.fromCurrency === input.toCurrency) throw new Error("لا تصريفَ بين العملة ونفسِها");
  if (!(input.fromAmount > 0) || !(input.toAmount > 0)) throw new Error("المبلغان موجبان");
  const fundId = input.fundId ?? "general";
  const fromAcc = await cashAccountFor(db, input.fromCurrency);
  const toAcc = await cashAccountFor(db, input.toCurrency);
  const usdFrom = await convertToBase(db, input.fromCurrency, input.fromAmount);
  const usdTo = await convertToBase(db, input.toCurrency, input.toAmount);
  const centsFrom = toCents(usdFrom), centsTo = toCents(usdTo);
  const fromBase = await isBase(db, input.fromCurrency), toBase = await isBase(db, input.toCurrency);
  const lines: Parameters<typeof postJournal>[2] = [
    { accountId: toAcc, fundId, debit: centsTo, currency: toBase ? undefined : input.toCurrency, amountOrig: toBase ? undefined : toCents(input.toAmount) },
    { accountId: fromAcc, fundId, credit: centsFrom, currency: fromBase ? undefined : input.fromCurrency, amountOrig: fromBase ? undefined : toCents(input.fromAmount) },
  ];
  const diff = centsTo - centsFrom; // مدينٌ زائدٌ ⇐ مكسب؛ ناقصٌ ⇐ خسارة
  if (diff > 0) lines.push({ accountId: ACC.gain, fundId, credit: diff });
  else if (diff < 0) lines.push({ accountId: ACC.loss, fundId, debit: -diff });
  await postJournal(db, { source: "exchange", memo: `تصريف: ${input.fromAmount} ${input.fromCurrency} ⇐ ${input.toAmount} ${input.toCurrency}`, createdBy: input.createdBy }, lines);
  await writeAudit(db, { actorUserId: input.createdBy ?? null, action: "record_exchange", entity: "exchange", entityId: fromAcc + ">" + toAcc, after: { usdFrom, usdTo, diff: fromCents(diff) } });
  return { usdFrom, usdTo, gain: diff > 0 ? round2(fromCents(diff)) : 0, loss: diff < 0 ? round2(fromCents(-diff)) : 0 };
}

// حارسٌ: هل الحسابُ حسابُ نقدِ عملةٍ أجنبيّة؟ (لأجل واجهات الأرصدة)
export async function foreignCashAccounts(db: Db): Promise<Set<string>> {
  const rows = await db.select({ a: currencies.cashAccount }).from(currencies).where(eq(currencies.isBase, false)).all();
  void accounts;
  return new Set(rows.map((r) => r.a));
}
