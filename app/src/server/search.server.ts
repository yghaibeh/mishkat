// بحث على الخادم (type-ahead) — يُرجع أعلى N نتيجة فقط، لا يحمّل الجداول كاملة. للتوسّع لعشرات الآلاف.
import { and, eq, like, ne } from "drizzle-orm";
import { useDb } from "./utils/db";
import { persons, orgUnits, teachers, venues } from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";

const LIMIT = 20;

// الهيكلية التنظيمية كاملةً ضمن نطاق المستخدم (لمنتقي الشجرة) — قائمة مسطّحة بـ parentId.
export async function orgTree() {
  const u = await currentUser();
  const db = useDb();
  const all = await db.select({ id: orgUnits.id, name: orgUnits.name, type: orgUnits.type, parentId: orgUnits.parentId, path: orgUnits.path })
    .from(orgUnits).where(ne(orgUnits.status, "archived")).all();
  const scoped = (u && !isGlobalAdmin(u))
    ? all.filter((r) => u.assignments.some((a) => r.path.startsWith(a.orgPath)))
    : all;
  const ids = new Set(scoped.map((o) => o.id));
  // تثبيت الجذور: إن كان الأب خارج النطاق، اجعله جذرًا (parentId=null)
  return scoped.map((o) => ({ id: o.id, name: o.name, type: o.type, parentId: o.parentId && ids.has(o.parentId) ? o.parentId : null }));
}

export async function searchPersons(q: string, limit = LIMIT) {
  await currentUser();
  const db = useDb();
  const term = q.trim();
  if (term.length < 1) return [] as Array<{ id: string; name: string }>;
  const rows = await db.select({ id: persons.id, name: persons.fullName }).from(persons)
    .where(like(persons.fullName, `%${term}%`)).limit(limit).all();
  return rows;
}

export async function searchTeachers(q: string, limit = LIMIT) {
  await currentUser();
  const db = useDb();
  const term = q.trim();
  const rows = await db.select({ id: teachers.id, name: persons.fullName })
    .from(teachers).innerJoin(persons, eq(persons.id, teachers.personId))
    .where(term ? like(persons.fullName, `%${term}%`) : undefined).limit(limit).all();
  return rows;
}

export async function searchVenues(q: string, limit = LIMIT) {
  await currentUser();
  const db = useDb();
  const term = q.trim();
  const rows = await db.select({ id: venues.id, name: venues.name, type: venues.type }).from(venues)
    .where(term ? like(venues.name, `%${term}%`) : undefined).limit(limit).all();
  return rows;
}

// بحث الوحدات التنظيمية — ضمن نطاق المستخدم (الإدارة العليا = كل الشبكة)
export async function searchOrgUnits(q: string, types?: string[], limit = LIMIT) {
  const u = await currentUser();
  const db = useDb();
  const term = q.trim();
  let rows = await db.select({ id: orgUnits.id, name: orgUnits.name, type: orgUnits.type, path: orgUnits.path }).from(orgUnits)
    .where(term ? like(orgUnits.name, `%${term}%`) : undefined).limit(limit * 3).all();
  if (types && types.length) rows = rows.filter((r) => types.includes(r.type));
  if (u && !isGlobalAdmin(u)) {
    rows = rows.filter((r) => u.assignments.some((a) => r.path.startsWith(a.orgPath)));
  }
  return rows.slice(0, limit).map((r) => ({ id: r.id, name: r.name, type: r.type }));
}
