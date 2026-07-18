import { offlineDb, type OutboxItem, type OutboxKind } from "./db";
import { saveTahfeezDailyByCircle } from "@/lib/api/tahfeez";
import { saveDailyLog, saveWomenActivity } from "@/lib/api/functions";
import { recordLesson, addHalaqaStudent } from "@/lib/api/alaBaseera";

export function newClientUuid(): string {
  return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// يُصفّ عمليةَ كتابةٍ محلّيًّا (IndexedDB) ثم يحاول إرسالها فورًا إن كان أونلاين.
// يُعيد معرّف العنصر (= clientUuid). إن تعذّرت IndexedDB (SSR/غير مدعوم) يُرسل مباشرةً.
export async function enqueue(kind: OutboxKind, payload: Record<string, unknown>, opts?: { blob?: Blob; filename?: string; clientUuid?: string }): Promise<string> {
  const id = opts?.clientUuid ?? (payload.clientUuid as string) ?? newClientUuid();
  const item: OutboxItem = { id, kind, payload: { ...payload, clientUuid: id }, blob: opts?.blob, filename: opts?.filename, createdAt: Date.now(), tries: 0 };
  const dbp = offlineDb();
  if (!dbp) { await send(item); return id; }
  await (await dbp).put("outbox", item);
  void flush();
  notify();
  return id;
}

export async function pendingCount(): Promise<number> {
  const dbp = offlineDb();
  if (!dbp) return 0;
  return (await dbp).count("outbox");
}

function notify() { if (typeof window !== "undefined") window.dispatchEvent(new Event("outbox-changed")); }
// خطأٌ دائمٌ (رفضُ الخادم منطقيًّا: تحقّقٌ/صلاحيّةٌ/أرشفة) ≠ خطأٌ عابرٌ (شبكة/409) — ق٣
class PermanentError extends Error {}
function assertOk(r: unknown) {
  if (r && typeof r === "object" && "error" in r && (r as { error?: string }).error) throw new PermanentError((r as { error: string }).error);
}
// إعلامُ المستخدم بعنصرٍ أُسقط لتعذّرٍ دائم (بدل ابتلاعه صامتًا)
function notifyDropped(it: OutboxItem, reason: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("outbox-dropped", { detail: { kind: it.kind, reason } }));
}

async function send(it: OutboxItem): Promise<void> {
  switch (it.kind) {
    case "daily_entry": assertOk(await saveDailyLog({ data: it.payload as never })); return;
    case "women_activity": assertOk(await saveWomenActivity({ data: it.payload as never })); return;
    case "lesson": assertOk(await recordLesson({ data: it.payload as never })); return;
    case "tahfeez_daily": assertOk(await saveTahfeezDailyByCircle({ data: it.payload as never })); return;
    case "student": assertOk(await addHalaqaStudent({ data: it.payload as never })); return;
    case "media": {
      const p = it.payload as { scope?: string; refId?: string; lessonId?: string; lessonClientUuid?: string; clientUuid: string; caption?: string };
      const fd = new FormData();
      fd.append("file", it.blob!, it.filename ?? "photo.jpg");
      fd.append("clientUuid", p.clientUuid);
      if (p.scope) fd.append("scope", p.scope);
      if (p.refId) fd.append("refId", p.refId);
      if (p.lessonId) fd.append("lessonId", p.lessonId);
      // مرفق درسٍ سُجّل دون اتصال: يُحلّ معرّف الجلسة خادميًّا عبر client_uuid للدرس
      if (p.lessonClientUuid) fd.append("lessonClientUuid", p.lessonClientUuid);
      if (p.caption) fd.append("caption", p.caption);
      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      // 409 = الدرس لم يُزامَن بعد ⇒ خطأٌ قابلٌ لإعادة المحاولة (الطابور يعيد لاحقًا)
      if (!res.ok) throw new Error("upload " + res.status);
      return;
    }
    default:
      // نوعٌ غير معروف (إصدارٌ قديمٌ أزال kindًا) — لا نبتلعه صامتًا: خطأٌ دائمٌ يُسقَط بإعلام (ط٣)
      throw new PermanentError("عنصرٌ من نوعٍ غير مدعوم: " + (it as { kind?: string }).kind);
  }
}

let flushing = false;
// يُفرّغ الطابور بالترتيب الزمنيّ؛ يتوقّف عند أوّل فشلٍ (شبكة) ويعيد المحاولة لاحقًا.
export async function flush(): Promise<void> {
  const dbp = offlineDb();
  if (!dbp || flushing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  // ط٣: قفلٌ عبر التبويبات (Web Locks) — تبويبان مفتوحان لا يُفرغان الطابورَ معًا فيُرسل العنصرُ مرّتين.
  // ifAvailable: إن كان تبويبٌ آخر يُفرّغ الآن، ننسحب بهدوء (سيُكمل هو).
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (locks?.request) {
    await locks.request("mishkat-outbox-flush", { ifAvailable: true }, async (lock) => {
      if (!lock) return; // تبويبٌ آخر يمسك القفل
      await flushLocked(dbp);
    });
    return;
  }
  await flushLocked(dbp);
}

async function flushLocked(dbp: NonNullable<ReturnType<typeof offlineDb>>): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const db = await dbp;
    const all = (await db.getAll("outbox")).sort((a, b) => a.createdAt - b.createdAt);
    for (const it of all) {
      try {
        await send(it);
        await db.delete("outbox", it.id);
      } catch (e) {
        it.tries++; it.lastError = String((e as Error)?.message ?? e);
        // خطأٌ دائم (رفضُ الخادم): يُسقَط فورًا مع إعلام المستخدم ولا يحجب البقيّة (ق٣) —
        // كان يُعيد المحاولةَ ٢٠ مرّةً ثم يُسقَط صامتًا حاجبًا كلَّ ما بعده.
        if (e instanceof PermanentError) {
          await db.delete("outbox", it.id);
          notifyDropped(it, it.lastError);
          continue; // نُكمل بقيّة الطابور — العنصرُ الفاسد لا يوقفه
        }
        // خطأٌ عابر (شبكة/409): نُبقيه ونتوقّف لنُعيد لاحقًا بالترتيب
        if (it.tries > 20) { await db.delete("outbox", it.id); notifyDropped(it, it.lastError); }
        else await db.put("outbox", it);
        break;
      }
    }
  } finally {
    flushing = false;
    notify();
  }
}
