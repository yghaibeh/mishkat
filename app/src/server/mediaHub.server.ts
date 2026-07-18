// مركزُ الإعلام (خادم فقط) — معرضُ صور الشبكة من ثلاثة روافد: تغطياتُ الإعلام (سجلُّ حدثٍ
// بعنوانه ونوعه ووحدته وناشره) + صورُ سجلّات اليوم + صورُ دروس الحلقات. كلُّ صورةٍ منسوبةٌ:
// ماذا وأين ومتى ومَن (قاعدة الصورة المنسوبة ٣٤ — بلاغ المالك «ما سياقها؟ من قام بها؟»).
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { useDb } from "./utils/db";
import {
  attachments, weeklyRecords, lessonAttachments, lessonSessions, halaqat, venues, orgUnits, assets,
  roleAssignments, mediaCoverages, users, persons, teachers,
} from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";
import { hasCap } from "../lib/capabilities";
import { COVERAGE_KIND_KEYS } from "../lib/media-kinds";
import { userCaps } from "./permissions.server";
import { writeAudit } from "./utils/audit";

const PAGE = 24;

// بوّابة القدرة (تحترم التجاوزات): الإدارة العليا «*» ومسؤول الإعلام media.hub — ومن تُمنح له لاحقًا
async function requireMediaHub() {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const caps = await userCaps(useDb(), [...new Set(u.assignments.map((a) => a.role))]);
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

// أسماءُ الرافعين: users.id → اسمُ الشخص (نسبةُ الصورة إلى صاحبها لا إلى المجهول)
async function uploaderNames(db: ReturnType<typeof useDb>, userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 90) {
    const rows = await db.select({ id: users.id, name: persons.fullName })
      .from(users).innerJoin(persons, eq(persons.id, users.personId))
      .where(inArray(users.id, ids.slice(i, i + 90))).all();
    for (const r of rows) map.set(r.id, r.name);
  }
  return map;
}

export type GalleryItem = {
  id: string; url: string; title: string; caption: string | null; createdAt: number;
  source: "daily" | "lesson" | "post"; kind: string | null; mosqueName: string; regionName: string;
  byName: string | null; photoCount: number; coverageId: string | null;
};

// معرضُ الصور: يجمع الروافد الثلاثة، الأحدثُ أوّلًا (بتاريخ الحدث لا الرفع)، بترقيمٍ تدريجيّ.
export async function mediaGalleryData(offset = 0) {
  const u = await requireMediaHub();
  const db = useDb();
  const prefixes = scopePrefixes(u);
  const fetchLimit = Math.min(offset + PAGE, 480); // سقفُ أمانٍ للدمج

  // (أ) التغطيات: سجلُّ الحدث + صورتُه الأولى + عددُ صوره — معزولةٌ بالنطاق كسائر الروافد
  const covScope = prefixes ? or(...prefixes.map((p) => sql`${mediaCoverages.orgPath} LIKE ${p + "%"}`)) : undefined;
  const covBase = db.select().from(mediaCoverages);
  const covs = await (covScope ? covBase.where(covScope) : covBase).orderBy(desc(mediaCoverages.occurredAt)).limit(fetchLimit).all();
  const covPhotos = covs.length
    ? await db.select({ id: attachments.id, refId: attachments.refId, r2Key: attachments.r2Key, caption: attachments.caption, createdAt: attachments.createdAt })
      .from(attachments).where(and(eq(attachments.scope, "media_post"), inArray(attachments.refId, covs.slice(0, 90).map((c) => c.id))))
      .orderBy(attachments.createdAt).all()
    : [];
  const photosOf = new Map<string, typeof covPhotos>();
  for (const p of covPhotos) { const arr = photosOf.get(p.refId) ?? []; arr.push(p); photosOf.set(p.refId, arr); }

  // (ب) صورُ سجلّ اليوم: attachments(daily_record) ← weekly_records (مسارُ الوحدة المُدخِلة أو المسجد)
  const dailyPath = sql`coalesce(${weeklyRecords.unitPath}, ${weeklyRecords.mosquePath})`;
  const dailyScope = prefixes ? or(...prefixes.map((p) => sql`${dailyPath} LIKE ${p + "%"}`)) : undefined;
  const dailyWhere = dailyScope ? and(eq(attachments.scope, "daily_record"), dailyScope) : eq(attachments.scope, "daily_record");
  const daily = await db.select({
    id: attachments.id, r2Key: attachments.r2Key, caption: attachments.caption, createdAt: attachments.createdAt,
    uploadedBy: attachments.uploadedBy,
    unitId: sql<string>`coalesce(${weeklyRecords.unitId}, ${weeklyRecords.mosqueId})`, path: sql<string>`${dailyPath}`,
  }).from(attachments).innerJoin(weeklyRecords, eq(weeklyRecords.id, attachments.refId))
    .where(dailyWhere).orderBy(desc(attachments.createdAt)).limit(fetchLimit).all();
  const dailyTotal = (await db.select({ c: sql<number>`count(*)` }).from(attachments)
    .innerJoin(weeklyRecords, eq(weeklyRecords.id, attachments.refId)).where(dailyWhere).all())[0]?.c ?? 0;

  // (ج) صورُ الدروس: lesson_attachments ← الجلسة ← الحلقة ← المكان ← الوحدة؛ ونسبتُها لمعلّمها
  const lessonScope = prefixes ? or(...prefixes.map((p) => sql`${orgUnits.path} LIKE ${p + "%"}`)) : undefined;
  const lessonBase = db.select({
    id: lessonAttachments.id, r2Key: lessonAttachments.r2Key, caption: lessonAttachments.caption, createdAt: lessonAttachments.createdAt,
    unitId: venues.orgUnitId, path: orgUnits.path, teacherName: persons.fullName, halaqaName: halaqat.name,
  }).from(lessonAttachments)
    .innerJoin(lessonSessions, eq(lessonSessions.id, lessonAttachments.lessonSessionId))
    .innerJoin(halaqat, eq(halaqat.id, lessonSessions.halaqaId))
    .innerJoin(venues, eq(venues.id, halaqat.venueId))
    .innerJoin(orgUnits, eq(orgUnits.id, venues.orgUnitId))
    .leftJoin(teachers, eq(teachers.id, lessonSessions.teacherId))
    .leftJoin(persons, eq(persons.id, teachers.personId));
  const lessons = await (lessonScope ? lessonBase.where(lessonScope) : lessonBase).orderBy(desc(lessonAttachments.createdAt)).limit(fetchLimit).all();
  const lessonCount = db.select({ c: sql<number>`count(*)` }).from(lessonAttachments)
    .innerJoin(lessonSessions, eq(lessonSessions.id, lessonAttachments.lessonSessionId))
    .innerJoin(halaqat, eq(halaqat.id, lessonSessions.halaqaId))
    .innerJoin(venues, eq(venues.id, halaqat.venueId))
    .innerJoin(orgUnits, eq(orgUnits.id, venues.orgUnitId));
  const lessonTotal = (await (lessonScope ? lessonCount.where(lessonScope) : lessonCount).all())[0]?.c ?? 0;

  // دمجٌ زمنيّ + شريحةُ الصفحة + حلُّ الأسماء (وحدة + منطقة + ناشر)
  type Row = {
    key: string; r2Key: string; title: string; caption: string | null; at: number;
    source: "daily" | "lesson" | "post"; kind: string | null; path: string | null; unitId: string | null;
    by: string | null; byUser: string | null; photoCount: number; coverageId: string | null;
  };
  const merged: Row[] = [
    ...covs.map((c): Row => {
      const ph = photosOf.get(c.id) ?? [];
      return {
        key: c.id, r2Key: ph[0]?.r2Key ?? "", title: c.title, caption: c.body, at: c.occurredAt,
        source: "post", kind: c.kind, path: c.orgPath, unitId: c.orgUnitId,
        by: null, byUser: c.createdBy, photoCount: ph.length, coverageId: c.id,
      };
    }).filter((c) => c.r2Key), // تغطيةٌ بلا صورةٍ لا تُعرض في المعرض (تُتمّ من صفحتها)
    ...daily.map((r): Row => ({
      key: r.id, r2Key: r.r2Key, title: r.caption || "توثيقُ سجلّ اليوم", caption: r.caption, at: r.createdAt,
      source: "daily", kind: null, path: r.path, unitId: r.unitId, by: null, byUser: r.uploadedBy, photoCount: 1, coverageId: null,
    })),
    ...lessons.map((r): Row => ({
      key: r.id, r2Key: r.r2Key, title: r.caption || r.halaqaName || "درسُ حلقة", caption: r.caption, at: r.createdAt,
      source: "lesson", kind: null, path: r.path, unitId: r.unitId ?? null, by: r.teacherName ?? null, byUser: null, photoCount: 1, coverageId: null,
    })),
  ].sort((a, b) => b.at - a.at).slice(offset, offset + PAGE);

  const names = await unitNames(db, merged.map((m) => m.path ?? ""));
  const uploaders = await uploaderNames(db, merged.map((m) => m.byUser ?? "").filter(Boolean));
  // احتياطُ النسبة: صورةُ سجلّ اليوم بلا حسابِ رافعٍ تُنسب لمسؤول وحدتها (أميرها) — فالمسؤوليّة
  // معلومةٌ ولو لم يكن للرافع حساب؛ «غير منسوبة» آخرُ الحلول لا أوّلُها.
  const orphanUnits = merged.filter((m) => m.source === "daily" && !m.by && !m.byUser).map((m) => m.unitId).filter(Boolean) as string[];
  const unitOwner = new Map<string, string>();
  if (orphanUnits.length) {
    const rows = await db.select({ unit: roleAssignments.orgUnitId, name: persons.fullName })
      .from(roleAssignments).innerJoin(persons, eq(persons.id, roleAssignments.personId))
      .where(and(eq(roleAssignments.role, "amir"), eq(roleAssignments.approvalStatus, "approved"),
        inArray(roleAssignments.orgUnitId, [...new Set(orphanUnits)].slice(0, 90)))).all();
    for (const r of rows) if (r.unit && !unitOwner.has(r.unit)) unitOwner.set(r.unit, r.name);
  }
  const items: GalleryItem[] = merged.map((m) => ({
    id: m.key, url: `/media/${m.r2Key}`, title: m.title, caption: m.caption, createdAt: m.at, source: m.source,
    kind: m.kind, mosqueName: unitOf(m.path ?? "", m.unitId, names), regionName: regionOf(m.path ?? "", names),
    byName: m.by ?? (m.byUser ? uploaders.get(m.byUser) ?? null : null) ?? (m.unitId ? unitOwner.get(m.unitId) ?? null : null),
    photoCount: m.photoCount, coverageId: m.coverageId,
  }));

  // تشخيصُ الفراغ (قاعدة السطر المفهوم ٣٤): «لا صور» ليست جملةً واحدة — إمّا لا مسؤولَ إعلامٍ
  // معيَّنٌ أصلًا (فلا ناشرَ للتغطيات) أو معيَّنٌ ولم يرفع بعد. المديرُ يحتاج التمييزَ ليعالج.
  const officers = (await db.select({ c: sql<number>`count(*)` }).from(roleAssignments)
    .where(and(eq(roleAssignments.role, "media"), eq(roleAssignments.approvalStatus, "approved"))).all())[0]?.c ?? 0;
  const covTotal = covs.filter((c) => (photosOf.get(c.id) ?? []).length).length;
  return { items, total: dailyTotal + lessonTotal + covTotal, mediaOfficers: officers };
}

// صفحةُ التغطية: ألبومُها كاملًا + نصُّها + نسبتُها (من/أين/متى)
export async function coverageDetailData(id: string) {
  const u = await requireMediaHub();
  const db = useDb();
  const c = (await db.select().from(mediaCoverages).where(eq(mediaCoverages.id, id)).all())[0];
  if (!c) throw new Error("التغطية غير موجودة");
  const prefixes = scopePrefixes(u);
  if (prefixes && !prefixes.some((p) => (c.orgPath ?? "").startsWith(p))) throw new Error("خارج نطاقك");
  const photos = await db.select({ id: attachments.id, r2Key: attachments.r2Key, caption: attachments.caption })
    .from(attachments).where(and(eq(attachments.scope, "media_post"), eq(attachments.refId, id)))
    .orderBy(attachments.createdAt).all();
  const names = await unitNames(db, [c.orgPath ?? ""]);
  const by = c.createdBy ? (await uploaderNames(db, [c.createdBy])).get(c.createdBy) ?? null : null;
  return {
    id: c.id, title: c.title, kind: c.kind, body: c.body, occurredAt: c.occurredAt,
    unitName: unitOf(c.orgPath ?? "", c.orgUnitId, names), regionName: regionOf(c.orgPath ?? "", names),
    byName: by, mine: !!c.createdBy && c.createdBy === u.userId,
    photos: photos.map((p) => ({ id: p.id, url: `/media/${p.r2Key}`, caption: p.caption })),
  };
}

// إنشاءُ تغطية: قدرةٌ شخصيّةٌ (media.post) + وحدةٌ ضمن نطاق الناشر + عنوانٌ وحدثٌ ومكان.
// تُنشأ أوّلًا ثمّ تُرفع صورُها إليها (ref_id) — فلا صورةَ يتيمةٌ بلا سياق.
export async function createCoverageData(input: {
  title: string; kind: string; orgUnitId: string; occurredAt: number; body?: string;
}) {
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const db = useDb();
  const caps = await userCaps(db, [...new Set(u.assignments.map((a) => a.role))]);
  if (!hasCap(caps, "media.post")) return { error: "نشرُ التغطيات لمسؤول الإعلام وحده" as const };
  const title = input.title.trim();
  if (!title) return { error: "عنوانُ التغطية مطلوب" as const };
  if (!COVERAGE_KIND_KEYS.includes(input.kind)) return { error: "نوعٌ غير معروف" as const };
  const ou = (await db.select({ id: orgUnits.id, path: orgUnits.path }).from(orgUnits).where(eq(orgUnits.id, input.orgUnitId)).all())[0];
  if (!ou) return { error: "اختر الوحدة المغطّاة" as const };
  const prefixes = scopePrefixes(u);
  if (prefixes && !prefixes.some((p) => ou.path.startsWith(p))) return { error: "الوحدة خارج نطاقك" as const };
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(mediaCoverages).values({
    id, title, kind: input.kind, orgUnitId: ou.id, orgPath: ou.path,
    occurredAt: input.occurredAt || now, dateHijri: null, body: input.body?.trim() || null,
    createdBy: u.userId, createdAt: now,
  }).run();
  await writeAudit(db, { actorUserId: u.userId, action: "media.coverage.create", entity: "media_coverages", entityId: id, after: { title, kind: input.kind, unit: ou.id } });
  return { id };
}

// حذفُ تغطيةٍ نشرها صاحبُها (صورةٌ خاطئةٌ أو حدثٌ مكرَّر) — لناشرها وحدَه، ومعها صفوفُ صورها.
export async function deleteCoverageData(id: string) {
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const db = useDb();
  const c = (await db.select().from(mediaCoverages).where(eq(mediaCoverages.id, id)).all())[0];
  if (!c) return { error: "التغطية غير موجودة" as const };
  if (c.createdBy !== u.userId) return { error: "الحذفُ لناشر التغطية" as const };
  await db.delete(attachments).where(and(eq(attachments.scope, "media_post"), eq(attachments.refId, id))).run();
  await db.delete(mediaCoverages).where(eq(mediaCoverages.id, id)).run();
  await writeAudit(db, { actorUserId: u.userId, action: "media.coverage.delete", entity: "media_coverages", entityId: id, before: { title: c.title } });
  return { ok: true as const };
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
