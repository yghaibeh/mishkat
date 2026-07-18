// منطق وحدة «الاجتماعات» (خادم فقط) — اجتماعات الشورى والقرارات، مرتبطة بالمسجد مباشرةً.
import { desc, eq, inArray, sql } from "drizzle-orm";
import { useDb } from "./utils/db";
import { meetings, decisions } from "./database/schema";
import { requireMosqueAccess, requireMosqueManage } from "./utils/scope";

async function count(query: { all: () => Promise<Array<{ c: number }>> }) {
  return (await query.all())[0]?.c ?? 0;
}

const MEET_PAGE = 20;

export async function meetingsData(mosqueId: string, offset = 0) {
  await requireMosqueAccess(mosqueId);
  const db = useDb();
  const allIds = (await db.select({ id: meetings.id }).from(meetings).where(eq(meetings.mosqueId, mosqueId)).all()).map((m) => m.id);
  const total = allIds.length;
  const decCount = allIds.length
    ? await count(db.select({ c: sql<number>`count(*)` }).from(decisions).where(inArray(decisions.meetingId, allIds)))
    : 0;
  const lastRow = await db.select({ t: sql<number | null>`max(scheduled_at)` }).from(meetings).where(eq(meetings.mosqueId, mosqueId)).all();
  const lastAt = (lastRow[0]?.t as number | null) ?? null;

  const page = await db.select().from(meetings).where(eq(meetings.mosqueId, mosqueId))
    .orderBy(desc(meetings.scheduledAt)).limit(MEET_PAGE).offset(offset).all();
  const pageIds = page.map((m) => m.id);
  const decPer = pageIds.length
    ? await db.select({ m: decisions.meetingId, c: sql<number>`count(*)` }).from(decisions).where(inArray(decisions.meetingId, pageIds)).groupBy(decisions.meetingId).all()
    : [];
  const decMap = new Map(decPer.map((d) => [d.m, d.c]));

  // قرارات صفحة الاجتماعات (قائمة كاملة لعرضها تحت كل اجتماع)
  const decRows = pageIds.length
    ? await db.select().from(decisions).where(inArray(decisions.meetingId, pageIds)).all()
    : [];
  const decListMap = new Map<string, Array<{ id: string; title: string; kind: string; result: string | null; note: string | null }>>();
  for (const d of decRows) {
    const arr = decListMap.get(d.meetingId) ?? [];
    arr.push({ id: d.id, title: d.title, kind: d.kind, result: d.result, note: d.note });
    decListMap.set(d.meetingId, arr);
  }

  const items = page.map((m) => ({
    id: m.id, type: m.type, scheduledAt: m.scheduledAt, memberCount: m.memberCount,
    minutes: m.minutes, decisions: decMap.get(m.id) ?? 0, decisionList: decListMap.get(m.id) ?? [],
  }));
  return { kpis: { meetings: total, decisions: decCount, lastAt }, items, total, offset, pageSize: MEET_PAGE };
}

async function meetingMosque(db: ReturnType<typeof useDb>, meetingId: string) {
  const m = (await db.select().from(meetings).where(eq(meetings.id, meetingId)).all())[0];
  if (!m) throw new Error("الاجتماع غير موجود");
  return m;
}

export async function createMeetingData(input: { mosqueId: string; type: "periodic" | "extraordinary"; scheduledAt: number; memberCount?: number; minutes?: string }) {
  await requireMosqueManage(input.mosqueId);
  const db = useDb();
  const id = crypto.randomUUID();
  await db.insert(meetings).values({
    id, mosqueId: input.mosqueId, type: input.type, scheduledAt: input.scheduledAt,
    memberCount: input.memberCount ?? 0, minutes: input.minutes?.trim() || null, createdAt: Date.now(),
  }).run();
  return { ok: true as const, id };
}

// تحديث محضر الاجتماع (خلاصة ما جرى)
export async function setMeetingMinutesData(input: { meetingId: string; minutes: string }) {
  const db = useDb();
  const m = await meetingMosque(db, input.meetingId);
  await requireMosqueManage(m.mosqueId);
  await db.update(meetings).set({ minutes: input.minutes.trim() || null }).where(eq(meetings.id, input.meetingId)).run();
  return { ok: true as const };
}

// إضافة قرارٍ للاجتماع (عنوان + نوع + نتيجة + ملاحظة)
export async function addDecisionData(input: { meetingId: string; title: string; kind: "binding" | "advisory"; result?: "passed" | "failed"; note?: string }) {
  const db = useDb();
  const m = await meetingMosque(db, input.meetingId);
  await requireMosqueManage(m.mosqueId);
  const id = crypto.randomUUID();
  await db.insert(decisions).values({
    id, meetingId: input.meetingId, title: input.title.trim(), kind: input.kind,
    votesFor: 0, votesAgainst: 0, totalVoters: m.memberCount, amirVoteFor: null,
    result: input.result ?? "passed", note: input.note?.trim() || null,
  }).run();
  return { ok: true as const, id };
}

export async function removeDecisionData(input: { id: string }) {
  const db = useDb();
  const d = (await db.select().from(decisions).where(eq(decisions.id, input.id)).all())[0];
  if (!d) return { error: "القرار غير موجود" as const };
  const m = await meetingMosque(db, d.meetingId);
  await requireMosqueManage(m.mosqueId);
  await db.delete(decisions).where(eq(decisions.id, input.id)).run();
  return { ok: true as const };
}
