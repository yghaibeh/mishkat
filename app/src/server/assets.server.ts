// العُهدة والأصول (الوثيقة ٢٦ §ع): «اختر نوع العهدة» · مَن بحوزته أيّ أصل · مركباتُ المؤسّسة
// وآليّاتها العامّة بمصروفها الشهريّ للمحروقات — «ليكون عندنا تقييمٌ لكلّ شيء».
import { and, eq, inArray } from "drizzle-orm";
import { useDb } from "./utils/db";
import { assets, assetExpenses, orgUnits, persons } from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";
import { writeAudit } from "./utils/audit";

export const ASSET_KINDS = [
  { key: "personal_custody", label: "عُهدة شخصيّة" },
  { key: "vehicle", label: "مركبة" },
  { key: "equipment", label: "آليّة/تجهيز عامّ" },
] as const;

type U = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

// نطاقات الإدارة: الإدارة العليا كلَّ شيء؛ والطبقات/الأمراء نطاقاتهم
function manageScopes(u: U): string[] | null {
  if (isGlobalAdmin(u)) return null; // null = الكلّ
  const paths = u.assignments
    .filter((a) => ["section_head", "rabita", "square", "amir"].includes(a.role))
    .map((a) => a.orgPath);
  return paths.length ? paths : [];
}
const covers = (scopes: string[] | null, path: string | null) =>
  scopes === null || (!!path && scopes.some((p) => path.startsWith(p)));

export async function saveAssetData(input: {
  id?: string; kind: string; name: string; details?: string;
  orgUnitId?: string; holderPersonId?: string; holderName?: string;
}) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const scopes = manageScopes(u);
  if (scopes !== null && !scopes.length) return { error: "إدارة الأصول للمسؤولين" as const };
  if (!ASSET_KINDS.some((k) => k.key === input.kind)) return { error: "نوعٌ غير معروف" as const };
  if (!input.name.trim()) return { error: "اسم الأصل مطلوب" as const };

  let orgPath: string | null = null;
  if (input.orgUnitId) {
    const ou = (await db.select({ path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.id, input.orgUnitId)).all())[0];
    if (!ou) return { error: "الوحدة غير موجودة" as const };
    orgPath = ou.path;
  }
  if (!covers(scopes, orgPath ?? "/")) return { error: "الأصل خارج نطاقك" as const };

  let holderName = input.holderName?.trim() || null;
  if (input.holderPersonId) {
    const p = (await db.select({ fullName: persons.fullName }).from(persons).where(eq(persons.id, input.holderPersonId)).all())[0];
    holderName = p?.fullName ?? holderName;
  }
  const now = Date.now();
  if (input.id) {
    const a = (await db.select().from(assets).where(eq(assets.id, input.id)).all())[0];
    if (!a) return { error: "الأصل غير موجود" as const };
    if (!covers(scopes, a.orgPath ?? "/")) return { error: "الأصل خارج نطاقك" as const };
    await db.update(assets).set({
      kind: input.kind, name: input.name.trim(), details: input.details?.trim() || null,
      orgUnitId: input.orgUnitId ?? null, orgPath, holderPersonId: input.holderPersonId ?? null, holderName, updatedAt: now,
    }).where(eq(assets.id, input.id)).run();
    // ق٣: التعديل — وخاصّةً تبديلُ الحائز — يُدوَّن (كان بلا تدقيقٍ فيضيع «من كان يحوزها»)
    await writeAudit(db, { actorUserId: u.userId, action: "update_asset", entity: "asset", entityId: input.id,
      before: { holderPersonId: a.holderPersonId, holderName: a.holderName }, after: { holderPersonId: input.holderPersonId ?? null, holderName } });
    return { ok: true as const, id: input.id };
  }
  const id = crypto.randomUUID();
  await db.insert(assets).values({
    id, kind: input.kind, name: input.name.trim(), details: input.details?.trim() || null,
    orgUnitId: input.orgUnitId ?? null, orgPath, holderPersonId: input.holderPersonId ?? null, holderName,
    status: "active", createdBy: u.userId, createdAt: now, updatedAt: now,
  }).run();
  await writeAudit(db, { actorUserId: u.userId, action: "create_asset", entity: "asset", entityId: id, after: { kind: input.kind, name: input.name } });
  return { ok: true as const, id };
}

export async function setAssetStatusData(input: { id: string; status: "active" | "returned" | "retired" }) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const a = (await db.select().from(assets).where(eq(assets.id, input.id)).all())[0];
  if (!a) return { error: "الأصل غير موجود" as const };
  if (!covers(manageScopes(u), a.orgPath ?? "/")) return { error: "الأصل خارج نطاقك" as const };
  await db.update(assets).set({ status: input.status, updatedAt: Date.now() }).where(eq(assets.id, input.id)).run();
  await writeAudit(db, { actorUserId: u.userId, action: "set_asset_status", entity: "asset", entityId: input.id, before: { status: a.status }, after: { status: input.status } }); // ق٣
  return { ok: true as const };
}

// القائمة بعزل النطاق + آخر ١٢ شهرًا من المصروف لكلّ مركبة/آليّة
export async function assetsData() {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const scopes = manageScopes(u);
  if (scopes !== null && !scopes.length) return { error: "عرض الأصول للمسؤولين" as const };
  const rows = (await db.select().from(assets).all())
    .filter((a) => covers(scopes, a.orgPath ?? "/"))
    .sort((a, b) => a.kind.localeCompare(b.kind) || b.createdAt - a.createdAt);
  const ids = rows.map((r) => r.id);
  const exps: Array<typeof assetExpenses.$inferSelect> = [];
  for (let i = 0; i < ids.length; i += 90) {
    exps.push(...(await db.select().from(assetExpenses).where(inArray(assetExpenses.assetId, ids.slice(i, i + 90))).all()));
  }
  const byAsset = new Map<string, Array<{ month: string; fuelAmount: number; otherAmount: number; note: string | null }>>();
  for (const e of exps.sort((a, b) => b.month.localeCompare(a.month))) {
    if (!byAsset.has(e.assetId)) byAsset.set(e.assetId, []);
    const list = byAsset.get(e.assetId)!;
    if (list.length < 12) list.push({ month: e.month, fuelAmount: e.fuelAmount, otherAmount: e.otherAmount, note: e.note });
  }
  // أسماء الوحدات
  const ouIds = [...new Set(rows.map((r) => r.orgUnitId).filter(Boolean))] as string[];
  const ous: Array<{ id: string; name: string }> = [];
  for (let i = 0; i < ouIds.length; i += 90) {
    ous.push(...(await db.select({ id: orgUnits.id, name: orgUnits.name }).from(orgUnits).where(inArray(orgUnits.id, ouIds.slice(i, i + 90))).all()));
  }
  const ouBy = new Map(ous.map((o) => [o.id, o.name]));
  return {
    items: rows.map((a) => ({
      id: a.id, kind: a.kind, name: a.name, details: a.details, status: a.status,
      unitName: a.orgUnitId ? (ouBy.get(a.orgUnitId) ?? null) : null,
      holderName: a.holderName,
      expenses: byAsset.get(a.id) ?? [],
      totalFuel: (byAsset.get(a.id) ?? []).reduce((s, e) => s + e.fuelAmount, 0),
    })),
  };
}

// مصروفٌ شهريّ (upsert بالشهر) — للمركبات والآليّات
export async function saveAssetExpenseData(input: { assetId: string; month: string; fuelAmount: number; otherAmount?: number; note?: string }) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  if (!/^\d{4}-\d{2}$/.test(input.month)) return { error: "الشهر بصيغة YYYY-MM" as const };
  if (input.fuelAmount < 0 || (input.otherAmount ?? 0) < 0) return { error: "المبالغ موجبة" as const };
  const a = (await db.select().from(assets).where(eq(assets.id, input.assetId)).all())[0];
  if (!a) return { error: "الأصل غير موجود" as const };
  if (!covers(manageScopes(u), a.orgPath ?? "/")) return { error: "الأصل خارج نطاقك" as const };
  const existing = (await db.select().from(assetExpenses)
    .where(and(eq(assetExpenses.assetId, input.assetId), eq(assetExpenses.month, input.month))).all())[0];
  const total = input.fuelAmount + (input.otherAmount ?? 0);
  let rowId: string;
  if (existing) {
    rowId = existing.id;
    await db.update(assetExpenses).set({ fuelAmount: input.fuelAmount, otherAmount: input.otherAmount ?? 0, note: input.note?.trim() || null }).where(eq(assetExpenses.id, existing.id)).run();
  } else {
    rowId = crypto.randomUUID();
    await db.insert(assetExpenses).values({
      id: rowId, assetId: input.assetId, month: input.month,
      fuelAmount: input.fuelAmount, otherAmount: input.otherAmount ?? 0, note: input.note?.trim() || null,
      createdBy: u.userId, createdAt: Date.now(),
    }).run();
  }
  // ه٦: يُرحَّل للدفتر (محروقات/صيانة). التحديثُ يعكس القيدَ القديمَ ثمّ يُرحّل الجديد (دفترٌ لا يُعدَّل بل يُصحَّح بعكس)
  try {
    const { postFuel } = await import("./services/ledgerPost");
    const { reverseByRef } = await import("./services/ledger");
    if (existing) await reverseByRef(db, "fuel", rowId, u.userId);
    if (total > 0) await postFuel(db, { id: rowId, amount: total, memo: `محروقات/صيانة — ${a.name}`, createdBy: u.userId });
  } catch (e) { console.error("[ledger] postFuel failed:", (e as Error)?.message ?? e); }
  return { ok: true as const };
}
