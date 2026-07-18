// إعلانات المنصّة (الوثيقة ٢٦ §ذ): إعلانٌ من الإدارة/الطبقات يصل جرسَ كلّ من في النطاق
// (+تيليغرام وWeb Push عبر طابور الإشعارات القائم). الجرس هو موجز الأخبار.
import { eq, inArray } from "drizzle-orm";
import { useDb } from "./utils/db";
import { announcements, notifications, roleAssignments, users, orgUnits } from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";
import { writeAudit } from "./utils/audit";

const LEADER_ROLES = ["section_head", "rabita", "square", "amir", "teacher"];

export async function createAnnouncementData(input: { title: string; body: string; scopePath?: string; audience?: "all" | "leaders" | "students" }) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  // المُعلن: الإدارة على أيّ نطاق؛ والطبقة على نطاقها
  const admin = isGlobalAdmin(u);
  const myPaths = u.assignments.filter((a) => ["section_head", "rabita", "square", "amir"].includes(a.role)).map((a) => a.orgPath);
  const scopePath = input.scopePath?.trim() || (admin ? "/" : myPaths[0]);
  if (!scopePath) return { error: "الإعلان للمسؤولين" as const };
  if (!admin && !myPaths.some((p) => scopePath.startsWith(p))) return { error: "الإعلان ضمن نطاقك فقط" as const };
  if (!input.title.trim() || !input.body.trim()) return { error: "العنوان والنصّ مطلوبان" as const };

  const audience = input.audience ?? "all";
  // المستهدفون: أصحاب حساباتٍ لهم تكليفٌ معتمَدٌ ضمن النطاق (والطلاب دورهم student)
  const assigns = (await db.select().from(roleAssignments).where(eq(roleAssignments.approvalStatus, "approved")).all())
    .filter((a) => !a.endDate && a.orgPath.startsWith(scopePath))
    .filter((a) => audience === "all" ? true : audience === "leaders" ? LEADER_ROLES.includes(a.role) : a.role === "student");
  const personIds = [...new Set(assigns.map((a) => a.personId))].filter((p) => p !== u.personId);
  // من له حسابٌ فقط
  const withUsers: string[] = [];
  for (let i = 0; i < personIds.length; i += 90) {
    const batch = personIds.slice(i, i + 90);
    const us = await db.select({ personId: users.personId }).from(users).where(inArray(users.personId, batch)).all();
    withUsers.push(...us.map((x) => x.personId));
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(announcements).values({
    id, title: input.title.trim(), body: input.body.trim(), scopePath, audience,
    sentCount: withUsers.length, createdBy: u.personId, createdByName: u.fullName, createdAt: now,
  }).run();
  for (const pid of withUsers) {
    await db.insert(notifications).values({
      id: crypto.randomUUID(), personId: pid, channel: "inapp", kind: "announcement",
      payload: JSON.stringify({ announcementId: id, title: input.title.trim(), body: input.body.trim(), by: u.fullName }),
      status: "queued", createdAt: now, sentAt: null,
    }).run();
  }
  await writeAudit(db, { actorUserId: u.userId, action: "create_announcement", entity: "announcement", entityId: id, after: { title: input.title, scopePath, audience, sent: withUsers.length } });
  return { ok: true as const, id, sent: withUsers.length };
}

export async function announcementsListData() {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { items: [] };
  const rows = (await db.select().from(announcements).all()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
  return { items: rows };
}

// نطاقات الإعلان المتاحة للمستخدم (لواجهة الاختيار)
export async function announceScopesData() {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { items: [] };
  if (isGlobalAdmin(u)) {
    const units = await db.select({ path: orgUnits.path, name: orgUnits.name, type: orgUnits.type }).from(orgUnits)
      .where(inArray(orgUnits.type, ["section", "rabita"])).all();
    return { items: [{ path: "/", label: "المنصّة كلّها" }, ...units.map((x) => ({ path: x.path, label: x.name }))] };
  }
  const seen = new Set<string>();
  const items: Array<{ path: string; label: string }> = [];
  for (const a of u.assignments) {
    if (!["section_head", "rabita", "square", "amir"].includes(a.role) || seen.has(a.orgPath)) continue;
    seen.add(a.orgPath);
    const ou = (await db.select({ name: orgUnits.name }).from(orgUnits).where(eq(orgUnits.id, a.orgUnitId)).all())[0];
    items.push({ path: a.orgPath, label: ou?.name ?? a.orgPath });
  }
  return { items };
}
