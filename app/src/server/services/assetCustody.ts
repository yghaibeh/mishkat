// محرّكُ العُهد (خدمةٌ نقيّة): سلسلةُ الحيازة وإقرارُ الاستلام.
// المبدأ: **الأصلُ لا يُبدَّل حائزُه بالتحرير** بل بحركةٍ مسجَّلة — فيبقى الجواب دائمًا:
// مَن يحوزها الآن، ومن قبله، ومتى، وبأيّ حال، وهل أقرّ باستلامها.
// استيرادٌ ساكنٌ لا ديناميكيّ (حارس ns=0).
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { assets, assetCustody, persons } from "../database/schema";
import type { Db } from "../utils/db";

export const CUSTODY_CONDITIONS = [
  { key: "new", label: "جديدة" },
  { key: "good", label: "سليمة" },
  { key: "fair", label: "بها أثرُ استعمال" },
  { key: "damaged", label: "متضرّرة" },
] as const;
export const CONDITION_KEYS = CUSTODY_CONDITIONS.map((c) => c.key) as readonly string[];
export const conditionLabel = (k?: string | null) => CUSTODY_CONDITIONS.find((c) => c.key === k)?.label ?? "—";

export const CUSTODY_ACTION_LABEL: Record<string, string> = {
  assign: "تسليمٌ لأوّل مرّة", transfer: "نقلُ عهدة", return: "إعادةٌ إلى الوحدة",
  damaged: "بلاغُ تلف", lost: "بلاغُ فقد", retire: "إخراجٌ من الخدمة",
};

async function nameOf(db: Db, personId: string | null | undefined): Promise<string | null> {
  if (!personId) return null;
  const p = (await db.select({ n: persons.fullName }).from(persons).where(eq(persons.id, personId)).all())[0];
  return p?.n ?? null;
}

// تسليمُ عهدةٍ لشخص: أوّلُ تسليمٍ «assign» وما بعده «transfer» (فالنقلُ من يدٍ إلى يدٍ يُسمّى باسمه).
// يبقى الحدثُ **بانتظار إقرار المستلم** — فالتسليمُ لا يتمّ بقول المسؤول وحدَه.
export async function assignCustody(db: Db, input: {
  assetId: string; toPersonId: string; condition?: string; note?: string; byUserId: string;
}) {
  const a = (await db.select().from(assets).where(eq(assets.id, input.assetId)).all())[0];
  if (!a) throw new Error("الأصل غير موجود");
  if (a.status === "retired") throw new Error("الأصلُ خارجُ الخدمة");
  const heldNow = a.status === "active" || a.status === "damaged";
  if (heldNow && a.holderPersonId === input.toPersonId) throw new Error("العهدةُ بيده أصلًا");
  const toName = await nameOf(db, input.toPersonId);
  if (!toName) throw new Error("الشخص غير موجود");
  const now = Date.now();
  const id = crypto.randomUUID();
  await db.insert(assetCustody).values({
    id, assetId: a.id, action: heldNow && a.holderPersonId ? "transfer" : "assign",
    fromPersonId: heldNow ? a.holderPersonId ?? null : null, fromName: heldNow ? a.holderName ?? null : null,
    toPersonId: input.toPersonId, toName,
    condition: input.condition ?? null, note: input.note?.trim() || null,
    at: now, byUserId: input.byUserId, ackAt: null, ackBy: null,
  }).run();
  await db.update(assets).set({
    holderPersonId: input.toPersonId, holderName: toName, status: "active",
    condition: input.condition ?? a.condition ?? null, custodySince: now, updatedAt: now,
  }).where(eq(assets.id, a.id)).run();
  return { id };
}

// إقرارُ المستلم بنفسه — لا يقرّ عنه أحد (ولا المدير): هو مَن سيُسأل عنها.
export async function acknowledgeCustody(db: Db, eventId: string, user: { personId: string; userId: string }) {
  const e = (await db.select().from(assetCustody).where(eq(assetCustody.id, eventId)).all())[0];
  if (!e) throw new Error("الحركة غير موجودة");
  if (e.toPersonId !== user.personId) throw new Error("الإقرارُ لمن استلم العهدة");
  if (e.ackAt) return { ok: true as const };
  await db.update(assetCustody).set({ ackAt: Date.now(), ackBy: user.userId }).where(eq(assetCustody.id, eventId)).run();
  return { ok: true as const };
}

// إعادةُ العهدة إلى الوحدة (تُفرَّغ اليدُ ويبقى الأصلُ في سجلّ وحدته)
export async function returnCustody(db: Db, input: { assetId: string; condition?: string; note?: string; byUserId: string }) {
  const a = (await db.select().from(assets).where(eq(assets.id, input.assetId)).all())[0];
  if (!a) throw new Error("الأصل غير موجود");
  if (!a.holderPersonId) throw new Error("العهدةُ غيرُ مُسلَّمةٍ لأحد");
  const now = Date.now();
  await db.insert(assetCustody).values({
    id: crypto.randomUUID(), assetId: a.id, action: "return",
    fromPersonId: a.holderPersonId, fromName: a.holderName ?? null,
    toPersonId: null, toName: null, condition: input.condition ?? null,
    note: input.note?.trim() || null, at: now, byUserId: input.byUserId,
    ackAt: now, ackBy: input.byUserId, // الإعادةُ يُثبتها مستلمُها (المسؤول) فلا انتظارَ فيها
  }).run();
  await db.update(assets).set({
    holderPersonId: null, holderName: null, status: "returned",
    condition: input.condition ?? a.condition ?? null, custodySince: null, updatedAt: now,
  }).where(eq(assets.id, a.id)).run();
  return { ok: true as const };
}

// بلاغُ تلفٍ أو فقدٍ أو إخراجٍ من الخدمة — حالةٌ صريحةٌ لا حذفٌ صامت
export async function reportCustody(db: Db, input: {
  assetId: string; state: "damaged" | "lost" | "retire"; note?: string; byUserId: string;
}) {
  const a = (await db.select().from(assets).where(eq(assets.id, input.assetId)).all())[0];
  if (!a) throw new Error("الأصل غير موجود");
  const now = Date.now();
  await db.insert(assetCustody).values({
    id: crypto.randomUUID(), assetId: a.id, action: input.state,
    fromPersonId: a.holderPersonId ?? null, fromName: a.holderName ?? null,
    toPersonId: null, toName: null, condition: input.state === "damaged" ? "damaged" : null,
    note: input.note?.trim() || null, at: now, byUserId: input.byUserId, ackAt: now, ackBy: input.byUserId,
  }).run();
  const status = input.state === "retire" ? "retired" : input.state;
  await db.update(assets).set({ status, updatedAt: now }).where(eq(assets.id, a.id)).run();
  return { ok: true as const };
}

// سلسلةُ حيازة أصلٍ واحد — الأحدثُ أوّلًا
export async function custodyTimeline(db: Db, assetId: string) {
  // ترتيبٌ ثانويٌّ بـrowid: حركتان في الملّي ثانية نفسِها (تسليمٌ ثمّ نقلٌ فوريّ) كانتا تظهران معكوستين
  const rows = await db.select().from(assetCustody).where(eq(assetCustody.assetId, assetId))
    .orderBy(desc(assetCustody.at), desc(sql`rowid`)).all();
  return rows.map((r) => ({
    id: r.id, action: r.action, actionLabel: CUSTODY_ACTION_LABEL[r.action] ?? r.action,
    fromName: r.fromName, toName: r.toName, condition: r.condition, conditionLabel: conditionLabel(r.condition),
    note: r.note, at: r.at, acknowledged: !!r.ackAt, ackAt: r.ackAt,
  }));
}

// «عُهدتي»: ما بيدي الآن + ما ينتظر إقراري (فالإقرارُ فعلٌ لا يُنسى في قائمة)
export async function myCustody(db: Db, personId: string) {
  const mine = await db.select().from(assets)
    .where(and(eq(assets.holderPersonId, personId), inArray(assets.status, ["active", "damaged"]))).all();
  const waiting = (await db.select().from(assetCustody)
    .where(and(eq(assetCustody.toPersonId, personId), inArray(assetCustody.action, ["assign", "transfer"]))).all())
    .filter((e) => !e.ackAt);
  const byId = new Map(mine.map((a) => [a.id, a]));
  return {
    items: mine.map((a) => ({
      id: a.id, name: a.name, kind: a.kind, details: a.details, status: a.status,
      condition: a.condition, conditionLabel: conditionLabel(a.condition), since: a.custodySince,
    })),
    pending: waiting.map((e) => ({
      eventId: e.id, assetId: e.assetId, assetName: byId.get(e.assetId)?.name ?? "عهدة",
      fromName: e.fromName, condition: e.condition, conditionLabel: conditionLabel(e.condition), at: e.at,
    })),
  };
}
