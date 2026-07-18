// المكتبة التدريبيّة (الوثيقة ٢٦ §ت) — موادّ مصنّفة (عقيدة/فقه/…/تدريب إداريّ) بجمهورٍ مستهدف،
// وتتبّعٌ فرديّ: استلم (أوّل عرضٍ للمكتبة) → فتح (أوّل تنزيل) → أنجز (إقرارٌ صريح — أمانة).
import { and, eq, inArray } from "drizzle-orm";
import { useDb } from "./utils/db";
import { materials, materialProgress, persons, roleAssignments, orgUnits } from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";
import { writeAudit } from "./utils/audit";

export const MATERIAL_CATEGORIES = [
  { key: "aqeedah", label: "عقيدة" },
  { key: "fiqh", label: "فقه" },
  { key: "seerah", label: "سيرة" },
  { key: "tarbiya", label: "تربية" },
  { key: "admin_training", label: "تدريب إداريّ" },
  { key: "other", label: "أخرى" },
] as const;

export const MATERIAL_AUDIENCES = [
  { key: "amir", label: "مسؤولو المساجد" },
  { key: "teacher", label: "المعلّمون" },
  { key: "supervisor", label: "المشرفون (مربع/منطقة/قسم)" },
  { key: "all", label: "الجميع" },
] as const;

const SUPERVISOR_ROLES = ["square", "rabita", "section_head"];

// أدوار المستخدم ⇒ الجمهورات التي ينتمي إليها
function audiencesOf(u: NonNullable<Awaited<ReturnType<typeof currentUser>>>): string[] {
  const roles = new Set(u.assignments.map((a) => a.role));
  const out = new Set<string>(["all"]);
  if (roles.has("amir") || roles.has("admin")) out.add("amir");
  if (roles.has("teacher") || roles.has("admin")) out.add("teacher");
  if (SUPERVISOR_ROLES.some((r) => (roles as Set<string>).has(r)) || roles.has("admin")) out.add("supervisor");
  return [...out];
}

const canManage = (u: NonNullable<Awaited<ReturnType<typeof currentUser>>>) =>
  isGlobalAdmin(u) || u.assignments.some((a) => a.role === "section_head");

export type LibraryItem = {
  id: string; title: string; category: string; kind: string; url: string | null;
  description: string | null; mandatory: boolean; sizeBytes: number | null;
  deliveredAt: number | null; openedAt: number | null; completedAt: number | null;
};

/* ===== ١) مكتبتي — تختم «الاستلام» آليًّا أوّلَ عرض ===== */
export async function myLibraryData(): Promise<{ items: LibraryItem[] } | { error: string }> {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" };
  const auds = audiencesOf(u);
  const rows = (await db.select().from(materials).where(eq(materials.status, "active")).all())
    .filter((m) => auds.includes(m.audience))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  if (!rows.length) return { items: [] };

  const ids = rows.map((m) => m.id);
  const prog = await db.select().from(materialProgress)
    .where(and(eq(materialProgress.personId, u.personId), inArray(materialProgress.materialId, ids))).all();
  const byMat = new Map(prog.map((p) => [p.materialId, p]));
  const now = Date.now();
  // ختم الاستلام لأوّل ظهور (idempotent عبر UNIQUE)
  for (const m of rows) {
    if (!byMat.has(m.id)) {
      const row = { id: crypto.randomUUID(), materialId: m.id, personId: u.personId, deliveredAt: now, openedAt: null, completedAt: null };
      try { await db.insert(materialProgress).values(row).run(); byMat.set(m.id, row as never); } catch { /* سباقٌ متزامن — موجودٌ أصلًا */ }
    }
  }
  return {
    items: rows.map((m) => {
      const p = byMat.get(m.id);
      return {
        id: m.id, title: m.title, category: m.category, kind: m.kind,
        url: m.kind === "link" ? m.externalUrl : (m.r2Key ? `/media/${m.r2Key}` : null),
        description: m.description, mandatory: m.mandatory, sizeBytes: m.sizeBytes,
        deliveredAt: p?.deliveredAt ?? null, openedAt: p?.openedAt ?? null, completedAt: p?.completedAt ?? null,
      };
    }),
  };
}

/* ===== ٢) ختم الفتح والإنجاز ===== */
async function stamp(materialId: string, field: "openedAt" | "completedAt") {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const m = (await db.select().from(materials).where(eq(materials.id, materialId)).all())[0];
  if (!m || m.status !== "active") return { error: "المادّة غير متاحة" as const };
  const now = Date.now();
  const p = (await db.select().from(materialProgress)
    .where(and(eq(materialProgress.materialId, materialId), eq(materialProgress.personId, u.personId))).all())[0];
  if (!p) {
    // الإنجاز يستلزم فتحًا — من أقرّ فقد اطّلع
    await db.insert(materialProgress).values({
      id: crypto.randomUUID(), materialId, personId: u.personId,
      deliveredAt: now, openedAt: now, completedAt: field === "completedAt" ? now : null,
    }).run();
  } else if (!p[field]) {
    // الإنجاز يستلزم فتحًا — من أقرّ فقد اطّلع
    const patch: Partial<{ openedAt: number; completedAt: number }> = { [field]: now } as never;
    if (field === "completedAt" && !p.openedAt) patch.openedAt = now;
    await db.update(materialProgress).set(patch).where(eq(materialProgress.id, p.id)).run();
  }
  return { ok: true as const };
}
export const markMaterialOpenedData = (id: string) => stamp(id, "openedAt");
export const markMaterialCompletedData = (id: string) => stamp(id, "completedAt");

/* ===== ٣) إدارة الموادّ (المدير/رأس القسم) ===== */
export async function createMaterialData(input: {
  title: string; category: string; kind: "pdf" | "audio" | "link";
  r2Key?: string; externalUrl?: string; contentType?: string; sizeBytes?: number;
  description?: string; audience: string; mandatory: boolean; sortOrder?: number;
}) {
  const db = useDb();
  const u = await currentUser();
  if (!u || !canManage(u)) return { error: "إدارة المكتبة للإدارة العليا" as const };
  if (!input.title.trim()) return { error: "العنوان مطلوب" as const };
  if (!MATERIAL_CATEGORIES.some((c) => c.key === input.category)) return { error: "تصنيفٌ غير معروف" as const };
  if (!MATERIAL_AUDIENCES.some((a) => a.key === input.audience)) return { error: "جمهورٌ غير معروف" as const };
  if (input.kind === "link" && !input.externalUrl?.trim()) return { error: "الرابط مطلوب" as const };
  if (input.kind !== "link" && !input.r2Key) return { error: "ارفع الملفّ أوّلًا" as const };
  const id = crypto.randomUUID();
  await db.insert(materials).values({
    id, title: input.title.trim(), category: input.category, kind: input.kind,
    r2Key: input.r2Key ?? null, externalUrl: input.externalUrl?.trim() || null,
    contentType: input.contentType ?? null, sizeBytes: input.sizeBytes ?? null,
    description: input.description?.trim() || null, audience: input.audience,
    mandatory: input.mandatory, sortOrder: input.sortOrder ?? 0,
    status: "active", createdBy: u.userId, createdAt: Date.now(),
  }).run();
  await writeAudit(db, { actorUserId: u.userId, action: "create_material", entity: "material", entityId: id, after: { title: input.title, audience: input.audience, mandatory: input.mandatory } });
  return { ok: true as const, id };
}

export async function updateMaterialData(input: { id: string; mandatory?: boolean; sortOrder?: number; status?: "active" | "archived"; title?: string; description?: string }) {
  const db = useDb();
  const u = await currentUser();
  if (!u || !canManage(u)) return { error: "إدارة المكتبة للإدارة العليا" as const };
  const m = (await db.select().from(materials).where(eq(materials.id, input.id)).all())[0];
  if (!m) return { error: "المادّة غير موجودة" as const };
  const patch: Record<string, unknown> = {};
  if (input.mandatory !== undefined) patch.mandatory = input.mandatory;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
  if (input.status) patch.status = input.status;
  if (input.title?.trim()) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description.trim() || null;
  if (!Object.keys(patch).length) return { ok: true as const };
  await db.update(materials).set(patch).where(eq(materials.id, input.id)).run();
  await writeAudit(db, { actorUserId: u.userId, action: "update_material", entity: "material", entityId: input.id, after: patch });
  return { ok: true as const };
}

export async function listMaterialsAdminData() {
  const db = useDb();
  const u = await currentUser();
  if (!u || !canManage(u)) return { items: [] };
  const rows = await db.select().from(materials).all();
  return { items: rows.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt) };
}

/* ===== ٤) مصفوفة المتابعة — أفراد الجمهور × الموادّ الإلزاميّة، بعزل النطاق ===== */
export type TrackingRow = {
  personId: string; fullName: string; unitName: string | null;
  perMaterial: Array<{ materialId: string; state: "none" | "delivered" | "opened" | "completed" }>;
  completed: number; total: number;
};

export async function materialTrackingData() {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  // الناظر: الإدارة أو طبقةٌ إشرافيّة — يرى أفراد نطاقه فقط
  const admin = isGlobalAdmin(u);
  const scopes = admin ? ["/"] : u.assignments
    .filter((a) => ["section_head", "rabita", "square"].includes(a.role)).map((a) => a.orgPath);
  if (!scopes.length) return { error: "المتابعة للطبقات الإشرافيّة" as const };

  const mats = (await db.select().from(materials)
    .where(and(eq(materials.status, "active"), eq(materials.mandatory, true))).all())
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  if (!mats.length) return { materials: [], rows: [] };

  // أفراد الجمهور: تكليفاتٌ نشطةٌ معتمَدةٌ ضمن النطاق، بدور الجمهور المستهدف
  const audRoles: Record<string, string[]> = { amir: ["amir"], teacher: ["teacher"], supervisor: SUPERVISOR_ROLES, all: ["amir", "teacher", ...SUPERVISOR_ROLES] };
  const neededRoles = [...new Set(mats.flatMap((m) => audRoles[m.audience] ?? []))];
  const assigns = (await db.select().from(roleAssignments)
    .where(and(inArray(roleAssignments.role, neededRoles), eq(roleAssignments.approvalStatus, "approved"))).all())
    .filter((a) => !a.endDate && scopes.some((s) => a.orgPath.startsWith(s)));
  const personIds = [...new Set(assigns.map((a) => a.personId))];
  if (!personIds.length) return { materials: mats.map((m) => ({ id: m.id, title: m.title, audience: m.audience })), rows: [] };

  const people: Array<{ id: string; fullName: string }> = [];
  for (let i = 0; i < personIds.length; i += 90) {
    people.push(...(await db.select({ id: persons.id, fullName: persons.fullName }).from(persons).where(inArray(persons.id, personIds.slice(i, i + 90))).all()));
  }
  const unitIds = [...new Set(assigns.map((a) => a.orgUnitId))];
  const units: Array<{ id: string; name: string }> = [];
  for (let i = 0; i < unitIds.length; i += 90) {
    units.push(...(await db.select({ id: orgUnits.id, name: orgUnits.name }).from(orgUnits).where(inArray(orgUnits.id, unitIds.slice(i, i + 90))).all()));
  }
  const unitById = new Map(units.map((x) => [x.id, x.name]));
  const unitOf = new Map<string, string>();
  for (const a of assigns) if (!unitOf.has(a.personId)) unitOf.set(a.personId, unitById.get(a.orgUnitId) ?? "");
  const rolesOf = new Map<string, Set<string>>();
  for (const a of assigns) { if (!rolesOf.has(a.personId)) rolesOf.set(a.personId, new Set()); rolesOf.get(a.personId)!.add(a.role); }

  // كلّ التقدّم للموادّ الإلزاميّة (جدولٌ صغير — قراءةٌ كاملةٌ بلا IN ضخم)
  const allProg = await db.select().from(materialProgress).where(inArray(materialProgress.materialId, mats.map((m) => m.id))).all();
  const progBy = new Map<string, typeof allProg[number]>();
  for (const p of allProg) progBy.set(`${p.personId}|${p.materialId}`, p);

  const inAudience = (pid: string, audience: string) => {
    const roles = rolesOf.get(pid) ?? new Set();
    return (audRoles[audience] ?? []).some((r) => roles.has(r));
  };

  const rows: TrackingRow[] = people.map((p) => {
    const perMaterial = mats.filter((m) => inAudience(p.id, m.audience)).map((m) => {
      const pr = progBy.get(`${p.id}|${m.id}`);
      const state = pr?.completedAt ? "completed" : pr?.openedAt ? "opened" : pr?.deliveredAt ? "delivered" : "none";
      return { materialId: m.id, state: state as TrackingRow["perMaterial"][number]["state"] };
    });
    return {
      personId: p.id, fullName: p.fullName, unitName: unitOf.get(p.id) ?? null,
      perMaterial, completed: perMaterial.filter((x) => x.state === "completed").length, total: perMaterial.length,
    };
  }).filter((r) => r.total > 0).sort((a, b) => (a.completed / a.total) - (b.completed / b.total) || a.fullName.localeCompare(b.fullName, "ar"));

  return { materials: mats.map((m) => ({ id: m.id, title: m.title, audience: m.audience })), rows };
}
