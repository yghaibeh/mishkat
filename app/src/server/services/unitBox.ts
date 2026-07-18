// «الصندوق» الهرمي (ق-د٢ — الوثيقة ٣٩): سلسلة العهدة المالية على شجرة الوحدات نفسها.
// المبدأ: لا دفتر موازٍ — كل عملية قيدٌ مزدوجٌ في الدفتر الواحد موسومُ الأسطر بالوحدة (unit_id)،
// ورصيدُ صندوق كل وحدةٍ يُشتقّ اشتقاقاً. القبضُ متعدد العملات بأسطر في العملية الواحدة (ق-د٢).
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { journalLines, journalEntries, orgUnits, roleAssignments, users, monthlyEntitlements, expenseCategories, handovers, persons, boxClosings } from "../database/schema";
import { postJournal, toCents, fromCents } from "./ledger";
import { cashAccountFor, convertToBase, foreignCashAccounts } from "./currencies";
import { expenseAccount } from "./ledgerPost";

type Db = Parameters<typeof postJournal>[0];
export type CurrencyLine = { currency: string; amount: number }; // بالوحدة الطبيعية للعملة (دولارات/ليرات)

const CASH_USD = "1110";

// سطرُ نقدٍ لعملةٍ ما: الأساس بالدولار سنتاتٍ؛ الأجنبية بحسابها + المقدار الأصلي + مكافئه بالدولار
async function cashLegFor(db: Db, l: CurrencyLine, unitId: string): Promise<{ accountId: string; usdCents: number; currency?: string; amountOrig?: number; unitId: string }> {
  if (!l.currency || l.currency === "USD") return { accountId: CASH_USD, usdCents: toCents(l.amount), unitId };
  const usd = await convertToBase(db, l.currency, l.amount);
  return { accountId: await cashAccountFor(db, l.currency), usdCents: toCents(usd), currency: l.currency, amountOrig: Math.round(l.amount), unitId };
}

async function unitOrThrow(db: Db, unitId: string): Promise<{ id: string; path: string }> {
  if (unitId === "root") return { id: "root", path: "/" };
  const u = (await db.select({ id: orgUnits.id, path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.id, unitId)).all())[0];
  if (!u) throw new Error("الوحدة غير موجودة");
  return u;
}

// ═══ القبض: تبرع/استلام مالٍ إلى صندوق وحدة — أسطرُ عملاتٍ في عمليةٍ واحدة ═══
export async function receiveToBox(db: Db, input: { unitId: string; fundId?: string; lines: CurrencyLine[]; donorName?: string | null; memo?: string; createdBy?: string }): Promise<{ entryId: string }> {
  if (!input.lines.length) throw new Error("لا أسطر مبالغ");
  await unitOrThrow(db, input.unitId);
  const fund = input.fundId ?? "general";
  const legs = await Promise.all(input.lines.map((l) => cashLegFor(db, l, input.unitId)));
  const total = legs.reduce((s, g) => s + g.usdCents, 0);
  const { id } = await postJournal(db, {
    memo: input.memo ?? (input.donorName ? `قبض من ${input.donorName}` : "قبض إلى الصندوق"),
    source: "box_receive", sourceRef: crypto.randomUUID(), createdBy: input.createdBy,
  }, [
    ...legs.map((g) => ({ accountId: g.accountId, fundId: fund, debit: g.usdCents, currency: g.currency, amountOrig: g.amountOrig, unitId: g.unitId })),
    { accountId: "4100", fundId: fund, credit: total, unitId: input.unitId },
  ]);
  return { entryId: id };
}

// ═══ الصرف: من صندوق وحدةٍ بفئةٍ من القاموس المغلق — وربطُ الاستحقاق (لا دفعَ مرتين) ═══
export async function spendFromBox(db: Db, input: { unitId: string; fundId?: string; category: string; lines: CurrencyLine[]; payeeName?: string | null; memo?: string; entitlementId?: string; createdBy?: string }): Promise<{ entryId: string }> {
  if (!input.lines.length) throw new Error("لا أسطر مبالغ");
  await unitOrThrow(db, input.unitId);
  const cat = (await db.select().from(expenseCategories).where(and(eq(expenseCategories.key, input.category), eq(expenseCategories.active, true))).all())[0];
  if (!cat) throw new Error("فئة الصرف غير معرّفة — أضفها من قاموس «الإدارة»");
  if (input.entitlementId) {
    const ent = (await db.select().from(monthlyEntitlements).where(eq(monthlyEntitlements.id, input.entitlementId)).all())[0];
    if (!ent) throw new Error("الاستحقاق غير موجود");
    if (ent.status === "paid") throw new Error("هذا الاستحقاق مدفوعٌ سلفاً — لا يُدفع مرتين");
  }
  const fund = input.fundId ?? "general";
  const legs = await Promise.all(input.lines.map((l) => cashLegFor(db, l, input.unitId)));
  const total = legs.reduce((s, g) => s + g.usdCents, 0);
  const { id } = await postJournal(db, {
    memo: input.memo ?? `صرف «${cat.label}»${input.payeeName ? ` — ${input.payeeName}` : ""}`,
    source: "box_spend", sourceRef: input.entitlementId ?? crypto.randomUUID(), createdBy: input.createdBy,
  }, [
    { accountId: expenseAccount(input.category), fundId: fund, debit: total, unitId: input.unitId },
    ...legs.map((g) => ({ accountId: g.accountId, fundId: fund, credit: g.usdCents, currency: g.currency, amountOrig: g.amountOrig, unitId: g.unitId })),
  ]);
  if (input.entitlementId) {
    await db.update(monthlyEntitlements).set({ status: "paid" }).where(eq(monthlyEntitlements.id, input.entitlementId)).run();
  }
  return { entryId: id };
}

// ═══ التسليم: عمليةُ عهدةٍ بطرفين — دفعٌ من الأعلى وقبضٌ آليٌّ عند الأدنى بقيدٍ واحد ═══
export async function handoverDown(db: Db, input: { fromUnitId: string; toUnitId: string; purpose: string; batchId?: string; lines: CurrencyLine[]; note?: string; deliveredBy: string }): Promise<{ id: string; entryId: string }> {
  if (!input.lines.length) throw new Error("لا أسطر مبالغ");
  const from = await unitOrThrow(db, input.fromUnitId);
  const to = await unitOrThrow(db, input.toUnitId);
  // سلسلةُ العهدة تتبع الشجرة: لا تسليم إلا لوحدةٍ تحت المُسلِّم
  if (!(from.id === "root" || (to.path.startsWith(from.path) && to.id !== from.id))) throw new Error("التسليم لوحدةٍ ضمن نطاقك فقط — سلسلة العهدة تتبع الهيكل");
  const now = Date.now();
  const legsOut = await Promise.all(input.lines.map((l) => cashLegFor(db, l, input.fromUnitId)));
  const legsIn = await Promise.all(input.lines.map((l) => cashLegFor(db, l, input.toUnitId)));
  const { id: entryId } = await postJournal(db, {
    memo: `تسليم عهدة${input.purpose === "salaries" ? " (رواتب)" : ""} إلى الوحدة`,
    source: "box_handover", sourceRef: crypto.randomUUID(), createdBy: input.deliveredBy,
  }, [
    ...legsOut.map((g) => ({ accountId: g.accountId, fundId: "general", credit: g.usdCents, currency: g.currency, amountOrig: g.amountOrig, unitId: g.unitId })),
    ...legsIn.map((g) => ({ accountId: g.accountId, fundId: "general", debit: g.usdCents, currency: g.currency, amountOrig: g.amountOrig, unitId: g.unitId })),
  ]);
  const hid = crypto.randomUUID();
  await db.insert(handovers).values({
    id: hid, fromUnitId: input.fromUnitId, toUnitId: input.toUnitId, purpose: input.purpose,
    batchId: input.batchId ?? null, lines: JSON.stringify(input.lines), note: input.note ?? null,
    status: "delivered", deliveredBy: input.deliveredBy, deliveredAt: now, entryId, createdAt: now,
  }).run();
  return { id: hid, entryId };
}

// إقرارُ الاستلام — بصمةُ الطرف الثاني: أمينُ الوحدة المستلمة حصراً (تكليفٌ نشطٌ عليها)
export async function acknowledgeHandover(db: Db, handoverId: string, userId: string): Promise<{ status: string }> {
  const h = (await db.select().from(handovers).where(eq(handovers.id, handoverId)).all())[0];
  if (!h) throw new Error("التسليم غير موجود");
  if (h.status === "acknowledged") return { status: "acknowledged" };
  const u = (await db.select({ personId: users.personId }).from(users).where(eq(users.id, userId)).all())[0];
  const isCustodian = !!u && (await db.select({ id: roleAssignments.id }).from(roleAssignments)
    .where(and(eq(roleAssignments.personId, u.personId), eq(roleAssignments.orgUnitId, h.toUnitId),
      isNull(roleAssignments.endDate), eq(roleAssignments.approvalStatus, "approved"))).all()).length > 0;
  if (!isCustodian) throw new Error("إقرارُ الاستلام لأمين الوحدة المستلمة حصراً");
  await db.update(handovers).set({ status: "acknowledged", acknowledgedBy: userId, acknowledgedAt: Date.now() }).where(eq(handovers.id, handoverId)).run();
  return { status: "acknowledged" };
}

// ═══ رصيدُ الصندوق بالعملات — مشتقٌّ من أسطر الدفتر الموسومة بالوحدة ═══
export async function boxBalances(db: Db, unitId: string): Promise<Array<{ currency: string; amount: number }>> {
  const cashAccounts = new Set<string>([CASH_USD, ...(await foreignCashAccounts(db))]);
  const rows = await db.select({
    accountId: journalLines.accountId, currency: journalLines.currency,
    debit: journalLines.debitCents, credit: journalLines.creditCents, amountOrig: journalLines.amountOrig,
  }).from(journalLines).where(eq(journalLines.unitId, unitId)).all();
  const by = new Map<string, number>();
  for (const r of rows) {
    if (!cashAccounts.has(r.accountId)) continue;
    const sign = (r.debit ?? 0) > 0 ? 1 : -1;
    if (!r.currency) by.set("USD", (by.get("USD") ?? 0) + ((r.debit ?? 0) - (r.credit ?? 0)));
    else by.set(r.currency, (by.get(r.currency) ?? 0) + sign * (r.amountOrig ?? 0));
  }
  return [...by.entries()].filter(([, v]) => v !== 0)
    .map(([currency, v]) => ({ currency, amount: currency === "USD" ? fromCents(v) : v }));
}

// أرصدةُ ما تحت وحدةٍ (للشجرة): تجميعٌ بالأبناء المباشرين — بالمكافئ الدولاري للعرض التجميعي
export async function subtreeBoxSummary(db: Db, parentPath: string): Promise<Array<{ unitId: string; usd: number }>> {
  const depth = parentPath.split("/").filter(Boolean).length;
  const units = await db.select({ id: orgUnits.id, path: orgUnits.path }).from(orgUnits).all();
  const childOf = new Map<string, string>(); // unitId → ابن مباشر لparent يقع تحته
  for (const u of units) if (u.path.startsWith(parentPath)) {
    const segs = u.path.split("/").filter(Boolean);
    if (segs.length > depth) childOf.set(u.id, segs[depth]);
  }
  if (!childOf.size) return [];
  const cashAccounts = new Set<string>([CASH_USD, ...(await foreignCashAccounts(db))]);
  // قراءةٌ واحدةٌ بلا IN ضخمة (حدُّ متغيّرات SQLite في D1 — نفس عثرة الإشراف المعروفة) ثم ترشيحٌ في الذاكرة
  const rows = (await db.select({ unitId: journalLines.unitId, accountId: journalLines.accountId, d: journalLines.debitCents, c: journalLines.creditCents })
    .from(journalLines).where(sql`unit_id IS NOT NULL`).all()).filter((r) => childOf.has(r.unitId!));
  // الأبناء المباشرون يُعرضون دائماً ولو بصفر — وإلا استحال أولُ تسليمٍ في السلسلة
  const agg = new Map<string, number>();
  for (const u of units) {
    const segs = u.path.split("/").filter(Boolean);
    if (u.path.startsWith(parentPath) && segs.length === depth + 1) agg.set(u.id, 0);
  }
  for (const r of rows) {
    if (!r.unitId || !cashAccounts.has(r.accountId)) continue;
    const child = childOf.get(r.unitId)!;
    agg.set(child, (agg.get(child) ?? 0) + (r.d ?? 0) - (r.c ?? 0));
  }
  return [...agg.entries()].map(([unitId, cents]) => ({ unitId, usd: fromCents(cents) }));
}

// خريطةُ توزيع دفعةٍ: سلسلة التسليمات وحالتها لكل وحدة (عينُ المدير — ٣٩ §٩)
export async function distributionMap(db: Db, batchId: string) {
  const hs = await db.select().from(handovers).where(eq(handovers.batchId, batchId)).all();
  const unitIds = [...new Set(hs.flatMap((h) => [h.fromUnitId, h.toUnitId]))].filter((x) => x !== "root");
  const names = unitIds.length ? await db.select({ id: orgUnits.id, name: orgUnits.name }).from(orgUnits).where(inArray(orgUnits.id, unitIds)).all() : [];
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  return hs.map((h) => ({
    id: h.id, from: h.fromUnitId === "root" ? "المركز" : nameOf.get(h.fromUnitId) ?? h.fromUnitId,
    to: nameOf.get(h.toUnitId) ?? h.toUnitId, toUnitId: h.toUnitId,
    purpose: h.purpose, lines: JSON.parse(h.lines) as CurrencyLine[],
    status: h.status, deliveredAt: h.deliveredAt, acknowledgedAt: h.acknowledgedAt,
  }));
}

// ═══ الرواتب تسليماتٌ هرمية (٣٩ §٩): خطة الشهر مجمّعةً بالمناطق ← تسليمٌ لكلٍّ بمبلغها ═══
// المستحقُّ منسوبٌ لوحدة صاحبه (home_org_unit_id) — فالمنطقةُ هي المقطعُ الثاني من مسارها.
export async function salariesPlan(db: Db, month: string): Promise<{ month: string; regions: Array<{ unitId: string; name: string; usd: number; count: number }>; totalUsd: number; already: number }> {
  const ents = await db.select({ id: monthlyEntitlements.id, personId: monthlyEntitlements.personId, gross: monthlyEntitlements.grossAmount, status: monthlyEntitlements.status })
    .from(monthlyEntitlements).where(and(eq(monthlyEntitlements.month, month), eq(monthlyEntitlements.status, "approved"))).all();
  const people = new Map((await db.select({ id: persons.id, home: persons.homeOrgUnitId }).from(persons).all()).map((p) => [p.id, p.home]));
  const units = new Map((await db.select({ id: orgUnits.id, path: orgUnits.path, name: orgUnits.name }).from(orgUnits).all()).map((u) => [u.id, u]));
  const byRegion = new Map<string, { usd: number; count: number }>();
  for (const e of ents) {
    const home = people.get(e.personId);
    const u = home ? units.get(home) : null;
    const regionId = u ? (u.path.split("/").filter(Boolean)[1] ?? u.id) : "unassigned";
    const cur = byRegion.get(regionId) ?? { usd: 0, count: 0 };
    cur.usd += e.gross; cur.count++; byRegion.set(regionId, cur);
  }
  const already = (await db.select({ id: handovers.id }).from(handovers).where(eq(handovers.batchId, `salaries:${month}`)).all()).length;
  const regions = [...byRegion.entries()].map(([unitId, v]) => ({ unitId, name: units.get(unitId)?.name ?? "بلا وحدة", usd: Math.round(v.usd * 100) / 100, count: v.count })).sort((a, b) => b.usd - a.usd);
  return { month, regions, totalUsd: Math.round(regions.reduce((s, r) => s + r.usd, 0) * 100) / 100, already };
}

// تسليمُ رواتب الشهر: من المركز لكلّ منطقةٍ بمبلغها — دفعةٌ موسومة `salaries:<month>` تتبعها الخريطة
export async function distributeSalaries(db: Db, month: string, deliveredBy: string): Promise<{ created: number; batchId: string }> {
  const batchId = `salaries:${month}`;
  const plan = await salariesPlan(db, month);
  if (plan.already > 0) throw new Error("رواتبُ هذا الشهر سُلِّمت للمناطق سلفاً — تابع الخريطة");
  let created = 0;
  for (const r of plan.regions) {
    if (r.unitId === "unassigned" || r.usd <= 0) continue;
    await handoverDown(db, { fromUnitId: "root", toUnitId: r.unitId, purpose: "salaries", batchId, lines: [{ currency: "USD", amount: r.usd }], note: `رواتب ${month} — ${r.count} مستحقاً`, deliveredBy });
    created++;
  }
  return { created, batchId };
}

// ═══ الإقفال الدوري (٣٩ §٦-٥): «استلمتُ، صرفتُ، وزّعتُ، بقي» — يُرفع للأعلى فيعتمده ═══

function addLines(into: Map<string, number>, ls: CurrencyLine[], sign = 1) {
  for (const l of ls) into.set(l.currency, (into.get(l.currency) ?? 0) + sign * l.amount);
}
const mapToLines = (m: Map<string, number>): CurrencyLine[] => [...m.entries()].filter(([, v]) => v !== 0).map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }));

export async function submitBoxClosing(db: Db, input: { unitId: string; month: string; submittedBy: string }): Promise<{ id: string; summary: Record<string, CurrencyLine[]> }> {
  const exists = (await db.select({ id: boxClosings.id }).from(boxClosings)
    .where(and(eq(boxClosings.unitId, input.unitId), eq(boxClosings.month, input.month))).all())[0];
  if (exists) throw new Error("أُقفل هذا الشهر سلفاً لهذه الوحدة");
  // الاستلام: تسليماتٌ وصلتني (وأقررتُها) — والتوزيع: تسليماتٌ سلّمتها نزولاً
  const inH = await db.select().from(handovers).where(eq(handovers.toUnitId, input.unitId)).all();
  const outH = await db.select().from(handovers).where(eq(handovers.fromUnitId, input.unitId)).all();
  const received = new Map<string, number>(), handedDown = new Map<string, number>();
  for (const h of inH) addLines(received, JSON.parse(h.lines));
  for (const h of outH) addLines(handedDown, JSON.parse(h.lines));
  // القبض المباشر والصرف: من قيود box_receive/box_spend الموسومة بالوحدة
  const cashAccounts = new Set<string>([CASH_USD, ...(await foreignCashAccounts(db))]);
  const entries = await db.select({ id: journalEntries.id, source: journalEntries.source }).from(journalEntries).all();
  const srcOf = new Map(entries.map((e) => [e.id, e.source]));
  const rows = await db.select().from(journalLines).where(eq(journalLines.unitId, input.unitId)).all();
  const directIn = new Map<string, number>(), spent = new Map<string, number>(), remaining = new Map<string, number>();
  for (const r of rows) {
    if (!cashAccounts.has(r.accountId)) continue;
    const src = srcOf.get(r.entryId);
    const cur = r.currency ?? "USD";
    const amt = r.currency ? (r.amountOrig ?? 0) : fromCents((r.debitCents ?? 0) || (r.creditCents ?? 0));
    const sign = (r.debitCents ?? 0) > 0 ? 1 : -1;
    remaining.set(cur, (remaining.get(cur) ?? 0) + sign * amt);
    if (src === "box_receive" && sign > 0) directIn.set(cur, (directIn.get(cur) ?? 0) + amt);
    if (src === "box_spend" && sign < 0) spent.set(cur, (spent.get(cur) ?? 0) + amt);
  }
  const summary = {
    received: mapToLines(received), directIn: mapToLines(directIn),
    spent: mapToLines(spent), handedDown: mapToLines(handedDown), remaining: mapToLines(remaining),
  };
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(boxClosings).values({ id, unitId: input.unitId, month: input.month, summary: JSON.stringify(summary), status: "submitted", submittedBy: input.submittedBy, submittedAt: now, createdAt: now }).run();
  return { id, summary };
}

// اعتمادُ الإقفال — للطبقة الأقرب فوق الوحدة (NESSA — نفس سلسلة اعتماد التقارير)
export async function approveBoxClosing(db: Db, closingId: string, approverUserId: string): Promise<{ ok: true }> {
  const c = (await db.select().from(boxClosings).where(eq(boxClosings.id, closingId)).all())[0];
  if (!c) throw new Error("الإقفال غير موجود");
  if (c.status === "approved") return { ok: true };
  const unit = (await db.select({ path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.id, c.unitId)).all())[0];
  if (!unit) throw new Error("الوحدة غير موجودة");
  const u = (await db.select({ personId: users.personId }).from(users).where(eq(users.id, approverUserId)).all())[0];
  if (!u) throw new Error("لا مستخدم");
  const { approverLayerFor } = await import("./approvalRouting");
  const layer = await approverLayerFor(db, unit.path);
  const isNearest = layer.kind === "layer" && layer.approverPersonIds.includes(u.personId);
  // الشاغر (لا طبقة فوق الوحدة — كقسمٍ كامل): كسرُ زجاجٍ للمدير حصراً
  const approverIsAdmin = (await db.select({ id: roleAssignments.id }).from(roleAssignments)
    .where(and(eq(roleAssignments.personId, u.personId), eq(roleAssignments.role, "admin"),
      isNull(roleAssignments.endDate), eq(roleAssignments.approvalStatus, "approved"))).all()).length > 0;
  if (!isNearest && !(layer.kind === "vacant" && approverIsAdmin)) throw new Error("اعتمادُ الإقفال للطبقة الأقرب فوق الوحدة (أو المدير عند الشغور)");
  await db.update(boxClosings).set({ status: "approved", approvedBy: approverUserId, approvedAt: Date.now() }).where(eq(boxClosings.id, closingId)).run();
  return { ok: true };
}

// إقفالاتٌ تنتظر اعتمادي: وحداتٌ أنا طبقتها الأقرب قدّمت إقفالها
export async function pendingClosingsFor(db: Db, personId: string, isAdmin = false) {
  const subs = await db.select().from(boxClosings).where(eq(boxClosings.status, "submitted")).all();
  const out: Array<{ id: string; unitId: string; unitName: string; month: string; summary: Record<string, CurrencyLine[]> }> = [];
  const { approverLayerFor } = await import("./approvalRouting");
  for (const c of subs) {
    const unit = (await db.select({ path: orgUnits.path, name: orgUnits.name }).from(orgUnits).where(eq(orgUnits.id, c.unitId)).all())[0];
    if (!unit) continue;
    const layer = await approverLayerFor(db, unit.path);
    const mine = (layer.kind === "layer" && layer.approverPersonIds.includes(personId))
      || (layer.kind === "vacant" && isAdmin); // كسر الزجاج: الشاغرةُ طبقتُها تصعد للمدير
    if (mine) out.push({ id: c.id, unitId: c.unitId, unitName: unit.name, month: c.month, summary: JSON.parse(c.summary) });
  }
  return out;
}
