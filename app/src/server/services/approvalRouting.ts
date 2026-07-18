// ===== توجيهُ الاعتماد والزيارات — المصدرُ الوحيد للحقيقة (الوثيقة ٢٩، القرار ق1-د) =====
// المبدأ: كلُّ وحدةٍ يعتمدها «أقربُ سلَفٍ إشرافيٍّ نشطٍ مُكلَّف» (NESSA) حصرًا — لا كلُّ الطبقات ولا الإدارة.
// الإدارةُ العليا اطّلاعٌ فقط + «كسرُ زجاجٍ» عند شغور كلّ الطبقات. الاطّلاعُ نزولًا يبقى مباحًا للجميع.
import { and, eq, inArray, isNull } from "drizzle-orm";
import { roleAssignments } from "../database/schema";
import { ancestorIds } from "../utils/orgPath";
import { ROLES, type Role } from "../utils/rbac";
import type { AuthUser } from "../utils/context";
import { isGlobalAdmin } from "../utils/context";
import type { Db } from "../utils/db";

// الطبقاتُ الإشرافيّةُ التي تعتمد — بلا admin (الإدارةُ ليست طبقةَ اعتمادٍ روتينيّ).
export const SUPERVISORY_LAYERS: Role[] = [ROLES.SQUARE, ROLES.RABITA, ROLES.SECTION_HEAD];
const isSupervisory = (r: string): boolean => (SUPERVISORY_LAYERS as string[]).includes(r);

// نتيجةُ حسابِ الطبقة المعتمِدة لوحدة.
export type ApprovalLayer =
  | { kind: "layer"; unitId: string; unitPath: string; role: Role; approverPersonIds: string[] }
  | { kind: "vacant" }; // لا سلَفَ مُكلَّفٌ حتى الجذر ⇒ كسرُ الزجاج للإدارة

// أقربُ سلَفٍ إشرافيٍّ نشطٍ مُكلَّف (NESSA) لمسارِ وحدة.
// استعلامٌ واحدٌ محدودٌ بآباء المسار (عددُهم = عمقُ الشجرة ≈ ٣–٤ ثابتة) — بلا مسحِ جدول ولا LIKE '%'.
export async function approverLayerFor(db: Db, unitPath: string): Promise<ApprovalLayer> {
  const parents = ancestorIds(unitPath); // الجذرُ أوّلًا، تستثني الوحدةَ نفسَها
  if (!parents.length) return { kind: "vacant" };
  const rows = await db.select({
    orgUnitId: roleAssignments.orgUnitId, orgPath: roleAssignments.orgPath,
    role: roleAssignments.role, personId: roleAssignments.personId,
  }).from(roleAssignments).where(and(
    inArray(roleAssignments.orgUnitId, parents),
    inArray(roleAssignments.role, SUPERVISORY_LAYERS as string[]),
    isNull(roleAssignments.endDate),
    eq(roleAssignments.approvalStatus, "approved"),
  )).all();
  if (!rows.length) return { kind: "vacant" };
  // الأقربُ = أعمقُ مسارٍ (أطولُ orgPath). عند تساوي الوحدة: كلُّ مُكلَّفيها معتمِدون.
  const deepest = rows.reduce((m, r) => (r.orgPath.length > m.orgPath.length ? r : m), rows[0]);
  const peers = rows.filter((r) => r.orgUnitId === deepest.orgUnitId);
  return {
    kind: "layer", unitId: deepest.orgUnitId, unitPath: deepest.orgPath, role: deepest.role as Role,
    approverPersonIds: [...new Set(peers.map((p) => p.personId))],
  };
}

// هل هذا المستخدمُ هو معتمِدُ الوحدة (NESSA)؟ — للحرّاس والصناديق والإشعار.
export async function isNearestApprover(db: Db, u: AuthUser, unitPath: string): Promise<boolean> {
  const layer = await approverLayerFor(db, unitPath);
  if (layer.kind !== "layer") return false;
  return u.assignments.some((a) => a.orgUnitId === layer.unitId && isSupervisory(a.role));
}

// تدخّلٌ فوقيّ (§3.5): سلَفٌ إشرافيٌّ أعلى من NESSA يملك قدرةَ override — لا الإدارة، ولا المربع (أدنى طبقة).
// يُستعمَل حين يتعذّر الأقربُ مؤقّتًا (سفرٌ دون تفريغِ تكليف). مضبوطٌ بقدرةٍ صريحة.
export const OVERRIDE_CAP = "report.approve.override";
export async function canOverrideApprove(db: Db, u: AuthUser, caps: string[], unitPath: string): Promise<boolean> {
  if (isGlobalAdmin(u)) return false; // الإدارةُ لا تتدخّل روتينيًّا — لها كسرُ الزجاج فقط
  if (!caps.includes("*") && !caps.includes(OVERRIDE_CAP)) return false;
  const layer = await approverLayerFor(db, unitPath);
  if (layer.kind !== "layer") return false; // الشاغرُ من اختصاص كسر الزجاج لا التدخّل
  // سلَفٌ إشرافيٌّ يغطّي الوحدةَ لكنّه أعلى من NESSA (مسارُه أقصر من مسار NESSA)
  return u.assignments.some((a) =>
    isSupervisory(a.role) && unitPath.startsWith(a.orgPath) && a.orgPath.length < layer.unitPath.length);
}

// كسرُ الزجاج للإدارة: الوحداتُ الشاغرةُ NESSA فقط (لا طبقةَ إشرافيّةً فوقها).
export async function isBreakGlass(db: Db, u: AuthUser, unitPath: string): Promise<boolean> {
  if (!isGlobalAdmin(u)) return false;
  return (await approverLayerFor(db, unitPath)).kind === "vacant";
}

// هل يستطيع المستخدمُ اعتمادَ الوحدة؟ (الأقرب أو تدخّلٌ فوقيّ أو كسرُ زجاج) — حارسٌ موحَّد.
export async function canApproveUnit(db: Db, u: AuthUser, caps: string[], unitPath: string): Promise<{ ok: boolean; via: "nearest" | "override" | "breakglass" | "none" }> {
  if (await isNearestApprover(db, u, unitPath)) return { ok: true, via: "nearest" };
  if (await canOverrideApprove(db, u, caps, unitPath)) return { ok: true, via: "override" };
  if (await isBreakGlass(db, u, unitPath)) return { ok: true, via: "breakglass" };
  return { ok: false, via: "none" };
}
