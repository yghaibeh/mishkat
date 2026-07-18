// المرحلة ٤ (تكملة) — سُلَفُ الموظّفين: النقدُ يخرج فيصير ذمّةً مدينةً على الموظّف، ثمّ يُستردُّ أقساطًا من الراتب.
// المستخدمُ يرى «سُلفةٌ ورصيدٌ متبقٍّ وقسطٌ شهريّ»؛ الدفترُ خلفه يوازن (Dr 1200 / Cr 1110 منحًا، والعكسُ استردادًا).
import { and, eq, desc } from "drizzle-orm";
import { staffAdvances, persons } from "../database/schema";
import { postJournal, toCents } from "./ledger";
import { writeAudit } from "../utils/audit";
import type { Db } from "../utils/db";

const round2 = (n: number) => Math.round(n * 100) / 100;
const ACC = { cash: "1110", receivable: "1200" } as const;

// منحُ سُلفةٍ: يُنشئ السجلَّ ويُرحّل القيدَ (Dr ذمّةٌ مدينة / Cr نقد). النقدُ يتحوّل إلى ذمّةٍ لا يختفي.
export async function grantAdvance(db: Db, input: { personId: string; principal: number; monthlyDeduction: number; fundId?: string; note?: string; createdBy?: string }): Promise<{ id: string }> {
  const principal = round2(input.principal);
  const monthly = round2(input.monthlyDeduction);
  if (!(principal > 0)) throw new Error("مبلغُ السلفة يجب أن يكون موجبًا");
  if (!(monthly > 0)) throw new Error("قسطُ الاسترداد يجب أن يكون موجبًا");
  if (monthly > principal) throw new Error("قسطُ الاسترداد لا يتجاوز أصلَ السلفة");
  const id = crypto.randomUUID();
  const fundId = input.fundId ?? "general";
  await db.insert(staffAdvances).values({
    id, personId: input.personId, principal, balance: principal, monthlyDeduction: monthly,
    fundId, status: "active", note: input.note?.trim() || null, createdBy: input.createdBy ?? null, createdAt: Date.now(),
  }).run();
  const cents = toCents(principal);
  await postJournal(db, { source: "advance", sourceRef: id, memo: input.note ?? "سُلفةُ موظّف", createdBy: input.createdBy }, [
    { accountId: ACC.receivable, fundId, debit: cents },
    { accountId: ACC.cash, fundId, credit: cents },
  ]);
  await writeAudit(db, { actorUserId: input.createdBy ?? null, action: "grant_advance", entity: "staff_advance", entityId: id, after: { personId: input.personId, principal, monthlyDeduction: monthly, fundId } });
  return { id };
}

// تسجيلُ استردادٍ (قسطٌ أو دفعة): يُنقص الرصيدَ ويُرحّل القيدَ العكسيّ (Dr نقد / Cr ذمّة)، ويُقفل عند بلوغ الصفر.
// المبلغُ يُقصَّ على الرصيد المتبقّي فلا يُستردُّ أكثرُ من المستحقّ. المفتاحُ (advance_repay, advanceId:month) يمنع الازدواج.
export async function recordRepayment(db: Db, input: { advanceId: string; amount: number; month?: string; createdBy?: string }): Promise<{ balance: number; settled: boolean; applied: number }> {
  const adv = (await db.select().from(staffAdvances).where(eq(staffAdvances.id, input.advanceId)).all())[0];
  if (!adv) throw new Error("السلفة غير موجودة");
  if (adv.status === "settled") return { balance: 0, settled: true, applied: 0 };
  const applied = round2(Math.min(input.amount, adv.balance));
  if (!(applied > 0)) return { balance: adv.balance, settled: false, applied: 0 };
  const newBalance = round2(adv.balance - applied);
  const settled = newBalance <= 0.0001;
  await db.update(staffAdvances).set({ balance: settled ? 0 : newBalance, status: settled ? "settled" : "active" }).where(eq(staffAdvances.id, adv.id)).run();
  const cents = toCents(applied);
  const ref = `${adv.id}:${input.month ?? String(Date.now())}`; // فريدٌ لكلّ قسطٍ (شهرٌ أو ختمٌ زمنيّ)
  await postJournal(db, { source: "advance_repay", sourceRef: ref, memo: "استردادُ سُلفة", createdBy: input.createdBy }, [
    { accountId: ACC.cash, fundId: adv.fundId, debit: cents },
    { accountId: ACC.receivable, fundId: adv.fundId, credit: cents },
  ]);
  await writeAudit(db, { actorUserId: input.createdBy ?? null, action: "advance_repayment", entity: "staff_advance", entityId: adv.id, after: { applied, balance: settled ? 0 : newBalance, settled } });
  return { balance: settled ? 0 : newBalance, settled, applied };
}

// السُلَفُ النشطةُ لشخصٍ (يستعملها الراتبُ لاحتساب قسط الاسترداد الشهريّ).
export async function activeAdvancesFor(db: Db, personId: string): Promise<Array<{ id: string; balance: number; monthlyDeduction: number }>> {
  return db.select({ id: staffAdvances.id, balance: staffAdvances.balance, monthlyDeduction: staffAdvances.monthlyDeduction })
    .from(staffAdvances).where(and(eq(staffAdvances.personId, personId), eq(staffAdvances.status, "active"))).all();
}

// قسطُ الاستردادِ المستحقُّ هذا الشهرَ = Σ min(القسط، الرصيد) على السُلَف النشطة (آخرُ قسطٍ = الباقي فقط).
export async function scheduledRecovery(db: Db, personId: string): Promise<number> {
  const list = await activeAdvancesFor(db, personId);
  return round2(list.reduce((s, a) => s + Math.min(a.monthlyDeduction, a.balance), 0));
}

// قائمةُ السُلَف القائمة (للعرض والإدارة) مع اسم الموظّف.
export async function outstandingAdvances(db: Db): Promise<Array<{ id: string; personId: string; personName: string; principal: number; balance: number; monthlyDeduction: number; status: string; createdAt: number }>> {
  const rows = await db.select({
    id: staffAdvances.id, personId: staffAdvances.personId, principal: staffAdvances.principal,
    balance: staffAdvances.balance, monthlyDeduction: staffAdvances.monthlyDeduction, status: staffAdvances.status,
    createdAt: staffAdvances.createdAt, personName: persons.fullName,
  }).from(staffAdvances).leftJoin(persons, eq(persons.id, staffAdvances.personId))
    .orderBy(desc(staffAdvances.createdAt)).all();
  return rows.map((r) => ({ ...r, personName: r.personName ?? "—" }));
}
