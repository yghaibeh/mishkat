// مركزُ الإعلام (خادم فقط) — معرضُ كلّ الصور المرفوعة في الشبكة (سجلّات اليوم + دروس الحلقات)
// مربوطةً بمسجدها ومنطقتها عبر مسار الشجرة، + العُهدُ التي في العمل. للإدارة ومسؤول الإعلام (media.hub).
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { useDb } from "./utils/db";
import { attachments, weeklyRecords, lessonAttachments, lessonSessions, halaqat, venues, orgUnits, assets, roleAssignments } from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";
import { hasCap } from "../lib/capabilities";

const PAGE = 24;

// بوّابة القدرة (تحترم التجاوزات): الإدارة العليا «*» ومسؤول الإعلام media.hub — ومن تُمنح له لاحقًا
async function requireMediaHub() {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const { userCaps } = await import("./permissions.server");
  const caps = await userCaps(useDb(), u.assignments.map((a) => a.role));
  if (!hasCap(caps, "media.hub")) throw new Error("لا تملك صلاحية مركز الإعلام");
  return u;
}

// بادئاتُ النطاق: الإدارة العليا ترى الكلّ (null)، وغيرُها مساراتُ تكليفاته (يعزل القسم/المنطقة تلقائيًّا)
function scopePrefixes(u: NonNullable<Awaited<ReturnType<typeof currentUser>>>): string[] | null {
  if (isGlobalAdmin(u)) return null;
  const paths = [...new Set(u.assignments.map((a) => a.orgPath).filter(Boolean))];
  return paths.length ? paths : ["/__none__/"];
}

// حلُّ أسماء الوحدات من مقاطع المسارات: اسمُ الوحدة نفسِها (مسجد/حلقة) + المنطقة (rabita) صعودًا
async function unitNames(db: ReturnType<typeof useDb>, paths: string[]): Promise<Map<string, { name: string; type: string }>> {
  const ids = [...new Set(paths.flatMap((p) => p.split("/").filter(Boolean)))];
  const map = new Map<string, { name: string; type: string }>();
  for (let i = 0; i < ids.length; i += 90) { // تقطيعٌ دون حدّ متغيّرات D1
    const rows = await db.select({ id: orgUnits.id, name: orgUnits.name, type: orgUnits.type }).from(orgUnits).where(inArray(orgUnits.id, ids.slice(i, i + 90))).all();
    for (const r of rows) map.set(r.id, { name: r.name, type: r.type });
  }
  return map;
}
function regionOf(path: string, names: Map<string, { name: string; type: string }>): string {
  const segs = path.split("/").filter(Boolean);
  const rabita = segs.map((s) => names.get(s)).find((n) => n?.type === "rabita");
  if (rabita) return rabita.name;
  const square = segs.map((s) => names.get(s)).find((n) => n?.type === "square");
  return square?.name ?? "—";
}
function unitOf(path: string, unitId: string | null, names: Map<string, { name: string; type: string }>): string {
  if (unitId && names.get(unitId)) return names.get(unitId)!.name;
  const segs = path.split("/").filter(Boolean);
  for (let i = segs.length - 1; i >= 0; i--) { const n = names.get(segs[i]); if (n) return n.name; }
  return "—";
}

export type GalleryItem = { id: string; url: string; caption: string | null; createdAt: number; source: "daily" | "lesson" | "post"; mosqueName: string; regionName: string };

// معرضُ الصور: يجمع مرفقاتِ سجلّ اليوم ومرفقاتِ الدروس، الأحدثُ أوّلًا، بترقيمٍ تدريجيّ.
export async function mediaGalleryData(offset = 0) {
  const u = await requireMediaHub();
  const db = useDb();
  const prefixes = scopePrefixes(u);
  const fetchLimit = Math.min(offset + PAGE, 480); // سقفُ أمانٍ للدمج

  // (تغطيات الإعلام media_post): مرجعها ذاتيٌّ — بلا join؛ تظهر لكل النطاقات (منشورُ شبكة)
  const posts = await db.select({ id: attachments.id, r2Key: attachments.r2Key, caption: attachments.caption, createdAt: attachments.createdAt })
    .from(attachments).where(eq(attachments.scope, "media_post")).orderBy(desc(attachments.createdAt)).limit(fetchLimit).all();

  // (أ) صورُ سجلّ اليوم: attachments(daily_record) ← weekly_records (مسارُ الوحدة المُدخِلة أو المسجد)
  const dailyPath = sql`coalesce(${weeklyRecords.unitPath}, ${weeklyRecords.mosquePath})`;
  const dailyScope = prefixes ? or(...prefixes.map((p) => sql`${dailyPath} LIKE ${p + "%"}`)) : undefined;
  const dailyWhere = dailyScope ? and(eq(attachments.scope, "daily_record"), dailyScope) : eq(attachments.scope, "daily_record");
  const daily = await db.select({
    id: attachments.id, r2Key: attachments.r2Key, caption: attachments.caption, createdAt: attachments.createdAt,
    unitId: sql<string>`coalesce(${weeklyRecords.unitId}, ${weeklyRecords.mosqueId})`, path: sql<string>`${dailyPath}`,
  }).from(attachments).innerJoin(weeklyRecords, eq(weeklyRecords.id, attachments.refId))
    .where(dailyWhere).orderBy(desc(attachments.createdAt)).limit(fetchLimit).all();
  const dailyTotal = (await db.select({ c: sql<number>`count(*)` }).from(attachments)
    .innerJoin(weeklyRecords, eq(weeklyRecords.id, attachments.refId)).where(dailyWhere).all())[0]?.c ?? 0;

  // (ب) صورُ الدروس: lesson_attachments ← الجلسة ← الحلقة ← المكان ← الوحدة (مسارها)
  const lessonScope = prefixes ? or(...prefixes.map((p) => sql`${orgUnits.path} LIKE ${p + "%"}`)) : undefined;
  const lessonBase = db.select({
    id: lessonAttachments.id, r2Key: lessonAttachments.r2Key, caption: lessonAttachments.caption, createdAt: lessonAttachments.createdAt,
    unitId: venues.orgUnitId, path: orgUnits.path,
  }).from(lessonAttachments)
    .innerJoin(lessonSessions, eq(lessonSessions.id, lessonAttachments.lessonSessionId))
    .innerJoin(halaqat, eq(halaqat.id, lessonSessions.halaqaId))
    .innerJoin(venues, eq(venues.id, halaqat.venueId))
    .innerJoin(orgUnits, eq(orgUnits.id, venues.orgUnitId));
  const lessons = await (lessonScope ? lessonBase.where(lessonScope) : lessonBase).orderBy(desc(lessonAttachments.createdAt)).limit(fetchLimit).all();
  const lessonCount = db.select({ c: sql<number>`count(*)` }).from(lessonAttachments)
    .innerJoin(lessonSessions, eq(lessonSessions.id, lessonAttachments.lessonSessionId))
    .innerJoin(halaqat, eq(halaqat.id, lessonSessions.halaqaId))
    .innerJoin(venues, eq(venues.id, halaqat.venueId))
    .innerJoin(orgUnits, eq(orgUnits.id, venues.orgUnitId));
  const lessonTotal = (await (lessonScope ? lessonCount.where(lessonScope) : lessonCount).all())[0]?.c ?? 0;

  // دمجٌ زمنيّ + شريحةُ الصفحة + حلُّ الأسماء (مسجد + منطقة)
  const merged = [
    ...daily.map((r) => ({ ...r, source: "daily" as const })),
    ...lessons.map((r) => ({ ...r, source: "lesson" as const, unitId: r.unitId ?? null })),
    ...posts.map((r) => ({ ...r, source: "post" as const, path: null as string | null, unitId: null as string | null })),
  ].sort((a, b) => b.createdAt - a.createdAt).slice(offset, offset + PAGE);
  const names = await unitNames(db, merged.map((m) => m.path ?? ""));
  const items: GalleryItem[] = merged.map((m) => ({
    id: m.id, url: `/media/${m.r2Key}`, caption: m.caption, createdAt: m.createdAt, source: m.source,
    // التغطيةُ منشورُ شبكةٍ لا صورةُ وحدة: بلا وسمَي مسجدٍ ومنطقة (كانا يُعرضان فارغَين)
    mosqueName: m.source === "post" ? "" : unitOf(m.path ?? "", m.unitId ?? null, names),
    regionName: m.source === "post" ? "" : regionOf(m.path ?? "", names),
  }));
  // تشخيصُ الفراغ (قاعدة السطر المفهوم ٣٤): «لا صور» ليست جملةً واحدة — إمّا لا مسؤولَ إعلامٍ
  // معيَّنٌ أصلًا (فلا ناشرَ للتغطيات) أو معيَّنٌ ولم يرفع بعد. المديرُ يحتاج التمييزَ ليعالج.
  const officers = (await db.select({ c: sql<number>`count(*)` }).from(roleAssignments)
    .where(and(eq(roleAssignments.role, "media"), eq(roleAssignments.approvalStatus, "approved"))).all())[0]?.c ?? 0;
  return { items, total: dailyTotal + lessonTotal + posts.length, mediaOfficers: officers };
}

// «عُهدتي»: الأصولُ النشطة التي بعُهدة هذا الشخص وحدَه — لا مرآةَ لعُهد الشبكة.
// (بلاغ المالك ٢٠٢٦-٠٧-١٨: «ما علاقة العهد بالإعلام؟» — سجلُّ عُهد الشبكة مِلكُ «الصندوق»
// حيث تُدار فعلًا (assets.server)، وهنا لا يبقى إلا ما بيد صاحب الدور: كاميرتُه وحاسوبُه.
// قاعدتا الحقيقة الواحدة والتبويب الشخصيّ ٣٤ — كان يعرض مركباتِ غيره ولا صلةَ له بها.)
export async function mediaAssetsData() {
  const u = await requireMediaHub();
  const db = useDb();
  const rows = await db.select().from(assets)
    .where(and(eq(assets.status, "active"), eq(assets.holderPersonId, u.personId)))
    .orderBy(desc(assets.createdAt)).limit(100).all();
  const unitIds = [...new Set(rows.map((r) => r.orgUnitId).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  for (let i = 0; i < unitIds.length; i += 90) {
    const us = await db.select({ id: orgUnits.id, name: orgUnits.name }).from(orgUnits).where(inArray(orgUnits.id, unitIds.slice(i, i + 90))).all();
    for (const r of us) names.set(r.id, r.name);
  }
  return {
    items: rows.map((a) => ({
      id: a.id, name: a.name, kind: a.kind, details: a.details, holderName: a.holderName,
      unitName: (a.orgUnitId && names.get(a.orgUnitId)) || "—", createdAt: a.createdAt,
    })),
  };
}
