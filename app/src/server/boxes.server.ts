// «الصندوق» الهرمي — نقطة دخول RPC بحراسة الملكية (ق-د٢ + قاعدة المالك الواحد):
// أمينُ الصندوق = صاحبُ تكليفٍ نشطٍ على الوحدة (والأميرُ لمسجده — يقبض بنفسه ق-د٢)؛
// المديرُ أمينُ صندوق المركز ومطّلعٌ على الكل؛ الاطلاعُ نزولاً لكل سلَفٍ يغطي الوحدة.
import { and, desc, eq, isNull } from "drizzle-orm";
import { useDb } from "./utils/db";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";
import { orgUnits, roleAssignments, expenseCategories, handovers, journalEntries, journalLines } from "./database/schema";
import { receiveToBox, spendFromBox, handoverDown, acknowledgeHandover, boxBalances, subtreeBoxSummary, type CurrencyLine } from "./services/unitBox";

type U = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

// أمينُ الوحدة: صاحبُ دورِ عهدةٍ عليها بعينها (أو المدير للمركز "root").
// أدوارُ العهدة حصراً (سؤال المالك «تأكد أن كل شيء متكامل»): المشرفون والأمير — لا المعلم
// ولا المالي ولا أي تكليفٍ عارضٍ على الوحدة (المالي يسجّل عبر مقترحات «القرارات» — وثيقة ٢٨).
const CUSTODIAN_ROLES = new Set(["section_head", "rabita", "square", "amir"]);
function isCustodian(u: U, unitId: string): boolean {
  if (unitId === "root") return isGlobalAdmin(u);
  return u.assignments.some((a) => a.orgUnitId === unitId && CUSTODIAN_ROLES.has(a.role));
}
// اطلاعٌ نزولاً: سلَفٌ يغطي مسار الوحدة (أو المدير)
async function canView(db: ReturnType<typeof useDb>, u: U, unitId: string): Promise<boolean> {
  if (isGlobalAdmin(u) || isCustodian(u, unitId)) return true;
  const unit = (await db.select({ path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.id, unitId)).all())[0];
  return !!unit && u.assignments.some((a) => unit.path.startsWith(a.orgPath));
}

// صندوقي/صندوق وحدة: الأرصدة بالعملات + ما تحته تجميعاً + تسليمات تنتظر إقراري + آخر الحركات
export async function unitBoxData(unitId?: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return null;
  // الوحدة الافتراضية: المركز للمدير، وإلا أعلى تكليف نشط للمستخدم
  const target = unitId ?? (isGlobalAdmin(u) ? "root" : u.assignments[0]?.orgUnitId);
  if (!target) return null;
  if (!(await canView(db, u, target))) throw new Error("لا صلاحية على هذا الصندوق");
  const unit = target === "root" ? { id: "root", name: "صندوق المركز", path: "/" }
    : (await db.select({ id: orgUnits.id, name: orgUnits.name, path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.id, target)).all())[0];
  if (!unit) throw new Error("الوحدة غير موجودة");

  const balances = await boxBalances(db, target);
  const children = await subtreeBoxSummary(db, unit.path);
  const childNames = children.length
    ? new Map((await db.select({ id: orgUnits.id, name: orgUnits.name }).from(orgUnits).all()).map((x) => [x.id, x.name]))
    : new Map<string, string>();

  // تسليمات تنتظر إقرار أمين هذه الوحدة (بصمة الطرف الثاني)
  const pendingAck = isCustodian(u, target)
    ? await db.select().from(handovers).where(and(eq(handovers.toUnitId, target), eq(handovers.status, "delivered"))).all()
    : [];
  // آخر حركات الصندوق (من الدفتر الموسوم)
  const lines = await db.select({ entryId: journalLines.entryId }).from(journalLines).where(eq(journalLines.unitId, target)).all();
  const ids = [...new Set(lines.map((l) => l.entryId))].slice(-200);
  const entries = ids.length
    ? (await db.select({ id: journalEntries.id, memo: journalEntries.memo, at: journalEntries.entryDate, source: journalEntries.source })
        .from(journalEntries).orderBy(desc(journalEntries.entryDate)).all()).filter((e) => ids.includes(e.id)).slice(0, 12)
    : [];

  const cats = await db.select().from(expenseCategories).where(eq(expenseCategories.active, true)).orderBy(expenseCategories.sort).all();
  return {
    unit: { id: unit.id, name: unit.name },
    custodian: isCustodian(u, target),
    balances,
    children: children.map((c) => ({ ...c, name: childNames.get(c.unitId) ?? c.unitId })).sort((a, b) => b.usd - a.usd),
    pendingAck: pendingAck.map((h) => ({ id: h.id, purpose: h.purpose, lines: JSON.parse(h.lines) as CurrencyLine[], deliveredAt: h.deliveredAt, note: h.note })),
    recent: entries,
    categories: cats.map((c) => ({ key: c.key, label: c.label })),
  };
}

export async function boxReceiveData(input: { unitId: string; fundId?: string; lines: CurrencyLine[]; donorName?: string; memo?: string }) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  if (!isCustodian(u, input.unitId)) return { error: "القبض لأمين الصندوق حصراً" as const };
  const r = await receiveToBox(db, { ...input, createdBy: u.userId });
  return { ok: true as const, entryId: r.entryId };
}

export async function boxSpendData(input: { unitId: string; fundId?: string; category: string; lines: CurrencyLine[]; payeeName?: string; memo?: string; entitlementId?: string }) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  if (!isCustodian(u, input.unitId)) return { error: "الصرف لأمين الصندوق حصراً" as const };
  try { const r = await spendFromBox(db, { ...input, createdBy: u.userId }); return { ok: true as const, entryId: r.entryId }; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function boxHandoverData(input: { fromUnitId: string; toUnitId: string; purpose: string; batchId?: string; lines: CurrencyLine[]; note?: string }) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  if (!isCustodian(u, input.fromUnitId)) return { error: "التسليم من صندوقك حصراً" as const };
  try { const r = await handoverDown(db, { ...input, deliveredBy: u.userId }); return { ok: true as const, id: r.id }; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function boxAcknowledgeData(input: { handoverId: string }) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  try { await acknowledgeHandover(db, input.handoverId, u.userId); return { ok: true as const }; }
  catch (e) { return { error: (e as Error).message }; }
}

// خطة رواتب الشهر + توزيعها تسليماتٍ + خريطة الدفعة (٣٩ §٩) — لأمين المركز (المدير)
export async function salariesPlanData(month?: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u || !isGlobalAdmin(u)) return null;
  const { salariesPlan } = await import("./services/unitBox");
  const { hijriMonthKey } = await import("./utils/week");
  const m = month ?? hijriMonthKey(new Date());
  const plan = await salariesPlan(db, m);
  const { distributionMap } = await import("./services/unitBox");
  const map = plan.already > 0 ? await distributionMap(db, `salaries:${m}`) : [];
  return { ...plan, map };
}

export async function distributeSalariesData(input: { month: string }) {
  const db = useDb();
  const u = await currentUser();
  if (!u || !isGlobalAdmin(u)) return { error: "توزيع الرواتب لأمين صندوق المركز" as const };
  try { const { distributeSalaries } = await import("./services/unitBox"); const r = await distributeSalaries(db, input.month, u.userId); return { ok: true as const, ...r }; }
  catch (e) { return { error: (e as Error).message }; }
}

// الإقفال الدوري (٣٩ §٦-٥): أمينُ الوحدة يقفل شهره ويرفعه؛ الطبقةُ الأقرب تعتمد (NESSA)
export async function submitClosingData(input: { unitId: string; month?: string }) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  if (!isCustodian(u, input.unitId)) return { error: "الإقفال لأمين الصندوق حصراً" as const };
  const { hijriMonthKey } = await import("./utils/week");
  try {
    const { submitBoxClosing } = await import("./services/unitBox");
    const r = await submitBoxClosing(db, { unitId: input.unitId, month: input.month ?? hijriMonthKey(new Date()), submittedBy: u.userId });
    return { ok: true as const, summary: r.summary };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function pendingClosingsData() {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { items: [] };
  const { pendingClosingsFor } = await import("./services/unitBox");
  return { items: await pendingClosingsFor(db, u.personId) };
}

export async function approveClosingData(input: { closingId: string }) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  try { const { approveBoxClosing } = await import("./services/unitBox"); await approveBoxClosing(db, input.closingId, u.userId); return { ok: true as const }; }
  catch (e) { return { error: (e as Error).message }; }
}
