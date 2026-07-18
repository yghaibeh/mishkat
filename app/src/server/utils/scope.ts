// حارس نطاق مشترك — يتحقّق أن المستخدم يملك الوصول لمسجد بعينه (مبدأ عزل النطاق).
import { eq } from "drizzle-orm";
import { useDb } from "./db";
import { orgUnits } from "../database/schema";
import { currentUser } from "../auth.server";
import { isGlobalAdmin, canAccessPath } from "./context";
import { ROLES } from "./rbac";

// يرمي إن لم يكن المستخدم مخوّلًا للمسجد (خارج شجرته). للعمليات القرائية.
export async function requireMosqueAccess(mosqueId: string) {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const db = useDb();
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all())[0];
  if (!mosque || mosque.type !== "mosque") throw new Error("المسجد غير موجود");
  if (!isGlobalAdmin(u) && !canAccessPath(u, mosque.path)) throw new Error("خارج نطاقك");
  return u;
}

// يرمي إن لم يكن المستخدم إدارة عليا أو أمير هذا المسجد تحديداً. للعمليات الكتابية.
export async function requireMosqueManage(mosqueId: string) {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const db = useDb();
  const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, mosqueId)).all())[0];
  if (!mosque || mosque.type !== "mosque") throw new Error("المسجد غير موجود");
  const isAdmin = isGlobalAdmin(u);
  const isAmir = u.assignments.some((a) => a.role === ROLES.AMIR && a.orgUnitId === mosqueId);
  if (!isAdmin && !isAmir) throw new Error("يحتاج دور أمير المسجد لهذه العملية");
  return u;
}
