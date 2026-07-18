// مرفقات الدروس على R2 — رفعٌ مُصادَقٌ (المعلّم المالك/أمير المكان) وقراءةٌ مُصادَقةٌ بجمهورها (ف١).
import { eq } from "drizzle-orm";
import { useDb } from "./utils/db";
import { userFromToken } from "./utils/context";
import { lessonSessions, halaqat, venues, teachers, lessonAttachments, weeklyRecords, attachments, materials } from "./database/schema";

type Env = { MEDIA?: R2Bucket; JWT_SECRET?: string };
type R2Bucket = {
  get: (k: string) => Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
  put: (k: string, v: ArrayBuffer, o?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>;
};

const COOKIE = "mishkat_token";
function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}
const bad = (status: number, msg: string) => new Response(JSON.stringify({ error: msg }), { status, headers: { "content-type": "application/json; charset=utf-8" } });

// حارس القراءة (ف١): الجلسة شرطٌ لكلّ الوسائط، وملفّات المكتبة (materials/) تُفحص بجمهور مادّتها —
// كانت القراءة عامّةً فيَحمي الموادَّ التدريبيّةَ سرُّ الرابط وحدَه.
const AUDIENCE_ROLES: Record<string, string[]> = {
  amir: ["amir"], teacher: ["teacher"], supervisor: ["square", "rabita", "section_head"],
};
export async function canReadMediaKey(
  user: { personId: string; assignments: Array<{ role: string }> } | null,
  key: string,
  db: ReturnType<typeof useDb>,
): Promise<boolean> {
  if (!user) return false;
  if (!key.startsWith("materials/")) return true; // صور التوثيق/الدروس: تكفي الجلسة (روابطها داخل صفحاتٍ منطاقة)
  const roles = new Set(user.assignments.map((a) => a.role));
  if (roles.has("admin") || roles.has("section_head")) return true; // الإدارة ترى ما ترفعه
  const m = (await db.select().from(materials).where(eq(materials.r2Key, key)).all())[0];
  if (!m || m.status !== "active") return false;
  if (m.audience === "all") return true;
  return (AUDIENCE_ROLES[m.audience] ?? []).some((r) => roles.has(r));
}

// يُعالج مساري الوسائط؛ يُعيد Response أو null (ليكمل SSR)
export async function handleMediaRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);

  // خدمة ملفّ — بجلسةٍ وجمهور (ف١)
  if (request.method === "GET" && url.pathname.startsWith("/media/")) {
    const key = decodeURIComponent(url.pathname.slice("/media/".length));
    if (!key || !env?.MEDIA) return new Response("Not found", { status: 404 });
    if (!env?.JWT_SECRET) return bad(503, "الخدمة غير مهيّأة");
    const user = await userFromToken(cookieValue(request.headers.get("cookie"), COOKIE), env.JWT_SECRET);
    if (!user) return bad(401, "يلزم تسجيل الدخول");
    if (!(await canReadMediaKey(user, key, useDb()))) return bad(403, "لا صلاحية");
    const obj = await env.MEDIA.get(key);
    if (!obj) return new Response("Not found", { status: 404 });
    // دفاعٌ في العمق (ق٤): منعُ استنشاق النوع، وتنزيلُ ملفّات المكتبة بدل عرضها سطريًّا
    const ct = obj.httpMetadata?.contentType || "application/octet-stream";
    const headers: Record<string, string> = { "content-type": ct, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" };
    if (key.startsWith("materials/") || !ct.startsWith("image/")) headers["content-disposition"] = "attachment";
    return new Response(obj.body, { headers });
  }

  // رفع مرفق (مُصادَق + ملكية)
  if (request.method === "POST" && url.pathname === "/api/media/upload") {
    if (!env?.MEDIA) return bad(501, "التخزين غير مُفعَّل");
    if (!env?.JWT_SECRET) return bad(503, "الخدمة غير مهيّأة");
    const user = await userFromToken(cookieValue(request.headers.get("cookie"), COOKIE), env.JWT_SECRET);
    if (!user) return bad(401, "يلزم تسجيل الدخول");
    let form: FormData;
    try { form = await request.formData(); } catch { return bad(400, "طلب غير صالح"); }
    const file = form.get("file");
    let lessonId = String(form.get("lessonId") || "");
    const lessonClientUuid = String(form.get("lessonClientUuid") || "").trim();
    const scope = String(form.get("scope") || "").trim();
    const refId = String(form.get("refId") || "").trim();
    const caption = String(form.get("caption") || "").trim();
    const clientUuid = String(form.get("clientUuid") || "").trim();
    if (!(file instanceof File)) return bad(400, "لا ملفّ");
    // موادّ المكتبة PDF/صوت (تُفحص داخل نطاقها)؛ وسائر النطاقات صورٌ فقط ≤ ٥ م.ب
    if (scope !== "training_material") {
      // SVG صورةٌ لكنّها تحمل سكربتًا فتُخدَم XSS مخزَّنًا — نقصرها على النقطيّة (ق٤)
      const okImg = file.type.startsWith("image/") && file.type !== "image/svg+xml";
      if (!okImg) return bad(400, "الصور فقط (عدا SVG)");
      if (file.size > 5 * 1024 * 1024) return bad(400, "الحدّ الأقصى ٥ ميغابايت");
    }

    const db = useDb();

    // ملفّ مادّةٍ تدريبيّة (مكتبة §ت) — للإدارة العليا/رأس القسم؛ PDF أو صوت حتى ٣٠ م.ب
    if (scope === "training_material") {
      const isMgr = user.assignments.some((a) => a.role === "admin" || a.role === "section_head");
      if (!isMgr) return bad(403, "رفع الموادّ للإدارة العليا");
      const okType = file.type === "application/pdf" || file.type.startsWith("audio/");
      if (!okType) return bad(400, "PDF أو ملفّ صوتيّ فقط");
      if (file.size > 30 * 1024 * 1024) return bad(400, "الحدّ الأقصى ٣٠ ميغابايت");
      const ext = file.type === "application/pdf" ? "pdf" : (file.type.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 6);
      const key = `materials/${crypto.randomUUID()}.${ext}`;
      await env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
      return Response.json({ ok: true, r2Key: key, contentType: file.type, sizeBytes: file.size });
    }

    // تغطيةٌ إعلامية (media_post) — أداةُ عمل دور الإعلام (كان المركزُ سلبيّاً بلا رفع — بلاغ المالك ٢٠٢٦-٠٧-١٨):
    // يرفعها حاملُ media.hub (مسؤول الإعلام) أو المدير، وتظهر في معرض مركز الإعلام.
    if (scope === "media_post") {
      const isMedia = user.assignments.some((a) => a.role === "media" || a.role === "admin");
      if (!isMedia) return bad(403, "التغطيات لمسؤول الإعلام");
      const key = `media-posts/${crypto.randomUUID()}.${(file.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 6)}`;
      await env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
      const id = crypto.randomUUID();
      await db.insert(attachments).values({
        id, scope: "media_post", refId: id, r2Key: key, caption: caption || null,
        contentType: file.type, sizeBytes: file.size, uploadedBy: user.userId,
        clientUuid: clientUuid || crypto.randomUUID(), createdAt: Date.now(),
      } as never).run();
      return Response.json({ ok: true, id, r2Key: key });
    }

    // مرفق توثيق أنشطة اليوم (سجل الأسبوع) — صلاحية الرفع لأمير المسجد أو جهةٍ أعلى تغطّيه
    if (scope === "daily_record") {
      const rec = (await db.select().from(weeklyRecords).where(eq(weeklyRecords.id, refId)).all())[0];
      if (!rec) return bad(404, "سجل الأسبوع غير موجود");
      const isAmir = user.assignments.some((a) => a.role === "amir" && a.orgUnitId === rec.mosqueId);
      const isLayer = user.assignments.some((a) =>
        (a.role === "admin" || a.role === "square" || a.role === "rabita") &&
        rec.mosquePath.startsWith(a.orgPath) && a.orgPath !== rec.mosquePath,
      );
      if (!isAmir && !isLayer) return bad(403, "لا صلاحية");
      // idempotency للرفع دون اتصال: نفس clientUuid لا يُرفَع مرّتين
      if (clientUuid) {
        const dup = (await db.select().from(attachments).where(eq(attachments.clientUuid, clientUuid)).all())[0];
        if (dup) return Response.json({ ok: true, id: dup.id, url: `/media/${dup.r2Key}`, caption: dup.caption });
      }
      const ext = (file.type.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 5);
      const key = `daily/${refId}/${crypto.randomUUID()}.${ext}`;
      await env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
      const id = crypto.randomUUID();
      await db.insert(attachments).values({ id, scope, refId, r2Key: key, caption: caption || null, contentType: file.type, uploadedBy: user.userId, clientUuid: clientUuid || null, createdAt: Date.now() }).run();
      return Response.json({ ok: true, id, url: `/media/${key}`, caption });
    }

    // رفعٌ دون اتصال: قد يصل المرفق قبل مزامنة الدرس نفسه ⇒ نحلّ معرّف الجلسة عبر client_uuid.
    // إن لم يُزامَن الدرس بعد ⇒ 409 (يعيد الطابور المحاولة بعد مزامنة الدرس — الترتيب الزمنيّ يضمن ذلك).
    if (!lessonId && lessonClientUuid) {
      const byUuid = (await db.select({ id: lessonSessions.id }).from(lessonSessions).where(eq(lessonSessions.clientUuid, lessonClientUuid)).all())[0];
      if (!byUuid) return bad(409, "الدرس لم يُزامَن بعد");
      lessonId = byUuid.id;
    }
    const l = (await db.select().from(lessonSessions).where(eq(lessonSessions.id, lessonId)).all())[0];
    if (!l) return bad(404, "الدرس غير موجود");
    // idempotency للرفع دون اتصال: نفس clientUuid لا يُرفَع مرّتين
    if (clientUuid) {
      const dup = (await db.select().from(lessonAttachments).where(eq(lessonAttachments.clientUuid, clientUuid)).all())[0];
      if (dup) return Response.json({ ok: true, id: dup.id, url: `/media/${dup.r2Key}`, caption: dup.caption });
    }
    const h = (await db.select().from(halaqat).where(eq(halaqat.id, l.halaqaId)).all())[0];
    const v = h ? (await db.select().from(venues).where(eq(venues.id, h.venueId)).all())[0] : undefined;
    const t = h ? (await db.select({ personId: teachers.personId }).from(teachers).where(eq(teachers.id, h.teacherId)).all())[0] : undefined;
    const isAmir = !!v?.orgUnitId && user.assignments.some((a) => a.role === "amir" && a.orgUnitId === v.orgUnitId);
    const isOwner = !!t && t.personId === user.personId;
    if (!isAmir && !isOwner) return bad(403, "لا صلاحية");

    const ext = (file.type.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 5);
    const key = `lessons/${lessonId}/${crypto.randomUUID()}.${ext}`;
    await env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    const id = crypto.randomUUID();
    await db.insert(lessonAttachments).values({ id, lessonSessionId: lessonId, r2Key: key, caption: caption || null, contentType: file.type, clientUuid: clientUuid || null, createdAt: Date.now() }).run();
    return Response.json({ ok: true, id, url: `/media/${key}`, caption });
  }

  return null;
}
