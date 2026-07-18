// المرحلة ٠ (تكملة) — مولِّدُ القيود: يحوّل كلَّ حدثٍ ماليٍّ قائمٍ إلى قيدٍ متوازنٍ في الدفتر.
// المستخدمُ لا يستدعي هذا؛ تستدعيه دوالُّ الأحداث (تبرّع/مصروف/راتب/محروقات) فيصير الدفترُ مرآةً صادقة.
// كلُّ ترحيلٍ idempotent بمفتاح (source, sourceRef) — تكرارُ الحدث لا يزدوج في الدفتر.
import { postJournal, toCents, hasActivePosting } from "./ledger";
import type { Db } from "../utils/db";

// حساباتُ الدفتر القياسيّة (من دليل الحسابات المبذور 0056)
const ACC = { cash: "1110", donations: "4100", salaries: "5100", opex: "5200", fuel: "5300", other: "5900" } as const;

// يحلّ حسابَ النقد والوسمَ بالعملة: الأساس ⇒ 1110 بلا وسم؛ الأجنبيّة ⇒ حسابُها + العملة والمقدارُ الأصليّ + القيمةُ بالدولار.
async function cashLeg(db: Db, fundId: string, usdAmount: number, currency?: string, origAmount?: number): Promise<{ accountId: string; fundId: string; currency?: string; amountOrig?: number; _cents: number }> {
  const cents = toCents(usdAmount);
  if (!currency || currency === "USD") return { accountId: ACC.cash, fundId, _cents: cents };
  const { cashAccountFor } = await import("./currencies");
  return { accountId: await cashAccountFor(db, currency), fundId, currency, amountOrig: toCents(origAmount ?? usdAmount), _cents: cents };
}

// تبرّعٌ ⇒ مدين النقد / دائن التبرّعات (موسومٌ بصندوقه). e.amount بالدولار؛ إن كان بعملةٍ أجنبيّةٍ فمرّر currency+origAmount.
export async function postDonation(db: Db, e: { id: string; amount: number; fundId?: string; dateHijri?: string; memo?: string; currency?: string; origAmount?: number; createdBy?: string }): Promise<{ id: string; skipped?: boolean }> {
  if (await hasActivePosting(db, "donation", e.id)) return { id: "", skipped: true };
  const fundId = e.fundId ?? "general";
  const leg = await cashLeg(db, fundId, e.amount, e.currency, e.origAmount);
  return postJournal(db, { source: "donation", sourceRef: e.id, dateHijri: e.dateHijri, memo: e.memo ?? "تبرّع", createdBy: e.createdBy }, [
    { accountId: leg.accountId, fundId, debit: leg._cents, currency: leg.currency, amountOrig: leg.amountOrig },
    { accountId: ACC.donations, fundId, credit: leg._cents },
  ]);
}

// خريطةُ فئة المصروف ⇒ حساب (بسيطة؛ الافتراضُ تشغيليّ) — تُستعمل أيضًا في المصروف النثريّ
export function expenseAccount(category?: string): string {
  const c = (category ?? "").trim();
  if (/محروق|وقود|بنزين|مازوت|صيانة/.test(c)) return ACC.fuel;
  return ACC.opex;
}

// مصروفٌ ⇒ مدين المصروف / دائن النقد. يدعم العملةَ الأجنبيّة (يُصرَف من صندوق نقدها).
export async function postExpense(db: Db, e: { id: string; amount: number; fundId?: string; category?: string; dateHijri?: string; memo?: string; currency?: string; origAmount?: number; createdBy?: string }): Promise<{ id: string; skipped?: boolean }> {
  if (await hasActivePosting(db, "expense", e.id)) return { id: "", skipped: true };
  const fundId = e.fundId ?? "general";
  const leg = await cashLeg(db, fundId, e.amount, e.currency, e.origAmount);
  return postJournal(db, { source: "expense", sourceRef: e.id, dateHijri: e.dateHijri, memo: e.memo ?? (e.category ?? "مصروف"), createdBy: e.createdBy }, [
    { accountId: expenseAccount(e.category), fundId, debit: leg._cents },
    { accountId: leg.accountId, fundId, credit: leg._cents, currency: leg.currency, amountOrig: leg.amountOrig },
  ]);
}

// راتبٌ مصروفٌ ⇒ مدين الرواتب / دائن النقد
export async function postPayout(db: Db, e: { id: string; amount: number; fundId?: string; memo?: string; createdBy?: string }): Promise<{ id: string; skipped?: boolean }> {
  if (await hasActivePosting(db, "payout", e.id)) return { id: "", skipped: true };
  const fundId = e.fundId ?? "general";
  const cents = toCents(e.amount);
  return postJournal(db, { source: "payout", sourceRef: e.id, memo: e.memo ?? "صرفُ راتب", createdBy: e.createdBy }, [
    { accountId: ACC.salaries, fundId, debit: cents },
    { accountId: ACC.cash, fundId, credit: cents },
  ]);
}

// محروقاتٌ/مصروفُ أصلٍ ⇒ مدين المحروقات / دائن النقد
export async function postFuel(db: Db, e: { id: string; amount: number; fundId?: string; memo?: string; createdBy?: string }): Promise<{ id: string; skipped?: boolean }> {
  if (await hasActivePosting(db, "fuel", e.id)) return { id: "", skipped: true };
  const fundId = e.fundId ?? "general";
  const cents = toCents(e.amount);
  return postJournal(db, { source: "fuel", sourceRef: e.id, memo: e.memo ?? "محروقات/صيانة", createdBy: e.createdBy }, [
    { accountId: ACC.fuel, fundId, debit: cents },
    { accountId: ACC.cash, fundId, credit: cents },
  ]);
}
