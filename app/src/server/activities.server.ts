// النشاطات والمتابعة (الوثيقة ٢٦ §ن — جوهر «مجلس»): الشيخ/الأمير يُنشئ نشاطًا مطلوبًا من الطلاب،
// الطالب يراه بسلاسة في «المطلوب منّي» ويردّ، والمنشئ يتابع الردود ويقبلها. إشعاراتٌ في الاتجاهين.
import { and, eq, inArray } from "drizzle-orm";
import { useDb } from "./utils/db";
import { selectByIdChunks } from "./utils/chunks";
import { activities, activityResponses, circles, circleStudents, orgUnits, notifications } from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";

type U = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

// نطاقات إنشاء المستخدم: حلقاتُه (معلّمًا) ومساجدُه (أميرًا) — والإدارة/الطبقات ما يغطّون
// (تُصدَّر لتشاركها وحدة الاختبارات §خ — نفس نموذج النطاق والعضويّة)
export async function creatableScopes(u: U) {
  const db = useDb();
  const out: Array<{ kind: "circle" | "mosque"; id: string; label: string; mosqueId: string | null }> = [];
  const amirMosques = u.assignments.filter((a) => a.role === "amir").map((a) => a.orgUnitId);
  const admin = isGlobalAdmin(u);
  const layerPaths = u.assignments.filter((a) => ["section_head", "rabita", "square"].includes(a.role)).map((a) => a.orgPath);

  const allCircles = await db.select().from(circles).where(eq(circles.status, "active")).all();
  const mosqueIds = [...new Set(allCircles.map((c) => c.mosqueId))];
  const mosques: Array<{ id: string; name: string; path: string }> = [];
  for (let i = 0; i < mosqueIds.length; i += 90) {
    mosques.push(...(await db.select({ id: orgUnits.id, name: orgUnits.name, path: orgUnits.path }).from(orgUnits).where(inArray(orgUnits.id, mosqueIds.slice(i, i + 90))).all()));
  }
  const mById = new Map(mosques.map((m) => [m.id, m]));
  const covers = (path: string | null) => admin || (!!path && layerPaths.some((p) => path.startsWith(p)));

  for (const c of allCircles) {
    const m = mById.get(c.mosqueId);
    const can = c.teacherPersonId === u.personId || amirMosques.includes(c.mosqueId) || covers(m?.path ?? null);
    if (can) out.push({ kind: "circle", id: c.id, label: `حلقة ${c.name} — ${m?.name ?? "—"}`, mosqueId: c.mosqueId });
  }
  const seenM = new Set<string>();
  for (const m of mosques) {
    if (seenM.has(m.id)) continue;
    if (amirMosques.includes(m.id) || covers(m.path)) { out.push({ kind: "mosque", id: m.id, label: `مسجد ${m.name} (كلّ الحلقات)`, mosqueId: m.id }); seenM.add(m.id); }
  }
  return out;
}

export async function activityScopesData() {
  const u = await currentUser();
  if (!u) return { items: [] };
  return { items: await creatableScopes(u) };
}

/* ===== إنشاء نشاط + إشعار طلاب النطاق ===== */
export async function createActivityData(input: {
  scopeKind: "circle" | "mosque"; scopeId: string; title: string; details?: string; dueAt?: number; required?: boolean;
}) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const scopes = await creatableScopes(u);
  const scope = scopes.find((s) => s.kind === input.scopeKind && s.id === input.scopeId);
  if (!scope) return { error: "النشاط ضمن حلقاتك أو مسجدك فقط" as const };
  if (!input.title.trim()) return { error: "عنوان النشاط مطلوب" as const };

  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(activities).values({
    id, scopeKind: input.scopeKind, scopeId: input.scopeId, mosqueId: scope.mosqueId,
    title: input.title.trim(), details: input.details?.trim() || null, dueAt: input.dueAt ?? null,
    required: input.required ?? true, status: "active", createdBy: u.personId, createdByName: u.fullName, createdAt: now,
  }).run();

  // إشعار طلاب النطاق المعروفي الهوية
  const students = await scopeStudentPersons(input.scopeKind, input.scopeId);
  for (const pid of students) {
    await db.insert(notifications).values({
      id: crypto.randomUUID(), personId: pid, channel: "inapp", kind: "activity_new",
      payload: JSON.stringify({ activityId: id, title: input.title.trim(), dueAt: input.dueAt ?? null }),
      status: "queued", createdAt: now, sentAt: null,
    }).run();
  }
  return { ok: true as const, id, notified: students.length };
}

// طلاب النطاق الموصولون بهويّةٍ (person_id) — هم من يرى «المطلوب منّي» ويُشعَر
export async function scopeStudentPersons(scopeKind: string, scopeId: string): Promise<string[]> {
  const db = useDb();
  const circleIds = scopeKind === "circle"
    ? [scopeId]
    : (await db.select({ id: circles.id }).from(circles).where(and(eq(circles.mosqueId, scopeId), eq(circles.status, "active"))).all()).map((c) => c.id);
  if (!circleIds.length) return [];
  const rows = await db.select({ personId: circleStudents.personId }).from(circleStudents)
    .where(and(inArray(circleStudents.circleId, circleIds), eq(circleStudents.status, "active"))).all();
  return [...new Set(rows.map((r) => r.personId).filter(Boolean))] as string[];
}

/* ===== «المطلوب منّي» — نشاطات حلقاتي ومسجدي مع حالة ردّي ===== */
export type DutyItem = {
  id: string; title: string; details: string | null; dueAt: number | null; required: boolean;
  createdByName: string | null; createdAt: number; scopeLabel: string;
  myResponse: { body: string; submittedAt: number; reviewStatus: string } | null;
};

export async function myDutiesData(): Promise<{ items: DutyItem[] }> {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { items: [] };
  // حلقاتي طالبًا (عبر person_id) — ومساجدها
  const memberships = await db.select().from(circleStudents)
    .where(and(eq(circleStudents.personId, u.personId), eq(circleStudents.status, "active"))).all();
  const memberCircleIds = [...new Set(memberships.map((m) => m.circleId))];
  if (!memberCircleIds.length) return { items: [] };
  // ف٧: أرشفةُ الحلقة تُسقط واجباتها — لا نحلّ إلا الحلقات النشطة
  const cs = await selectByIdChunks(memberCircleIds, (b) => db.select().from(circles).where(and(inArray(circles.id, b), eq(circles.status, "active"))).all());
  const circleIds = cs.map((c) => c.id);
  const mosqueIds = [...new Set(cs.map((c) => c.mosqueId))];

  const acts = (await db.select().from(activities).where(eq(activities.status, "active")).all())
    .filter((a) => (a.scopeKind === "circle" && circleIds.includes(a.scopeId)) || (a.scopeKind === "mosque" && mosqueIds.includes(a.scopeId)));
  if (!acts.length) return { items: [] };

  const myResp = await selectByIdChunks(acts.map((a) => a.id), (b) => db.select().from(activityResponses)
    .where(and(eq(activityResponses.personId, u.personId), inArray(activityResponses.activityId, b))).all()); // ف٨
  const respBy = new Map(myResp.map((r) => [r.activityId, r]));
  const cById = new Map(cs.map((c) => [c.id, c.name]));

  const items = acts.map((a) => {
    const r = respBy.get(a.id);
    return {
      id: a.id, title: a.title, details: a.details, dueAt: a.dueAt, required: a.required,
      createdByName: a.createdByName, createdAt: a.createdAt,
      scopeLabel: a.scopeKind === "circle" ? `حلقة ${cById.get(a.scopeId) ?? ""}` : "المسجد",
      myResponse: r ? { body: r.body, submittedAt: r.submittedAt, reviewStatus: r.reviewStatus } : null,
    };
  }).sort((a, b) => (a.myResponse ? 1 : 0) - (b.myResponse ? 1 : 0) || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || b.createdAt - a.createdAt);
  return { items };
}

/* ===== ردّ الطالب + إشعار المنشئ ===== */
export async function respondActivityData(input: { activityId: string; body: string }) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  if (!input.body.trim()) return { error: "اكتب ردّك" as const };
  const a = (await db.select().from(activities).where(eq(activities.id, input.activityId)).all())[0];
  if (!a || a.status !== "active") return { error: "النشاط غير متاح" as const };
  // العضويّة: طالبٌ في نطاق النشاط
  const members = await scopeStudentPersons(a.scopeKind, a.scopeId);
  if (!members.includes(u.personId)) return { error: "النشاط ليس ضمن حلقاتك" as const };

  const now = Date.now();
  const existing = (await db.select().from(activityResponses)
    .where(and(eq(activityResponses.activityId, input.activityId), eq(activityResponses.personId, u.personId))).all())[0];
  if (existing) {
    await db.update(activityResponses).set({ body: input.body.trim(), submittedAt: now, reviewStatus: "pending" }).where(eq(activityResponses.id, existing.id)).run();
  } else {
    await db.insert(activityResponses).values({
      id: crypto.randomUUID(), activityId: input.activityId, personId: u.personId, personName: u.fullName,
      body: input.body.trim(), submittedAt: now, reviewStatus: "pending",
    }).run();
  }
  await db.insert(notifications).values({
    id: crypto.randomUUID(), personId: a.createdBy, channel: "inapp", kind: "activity_response",
    payload: JSON.stringify({ activityId: a.id, title: a.title, student: u.fullName }),
    status: "queued", createdAt: now, sentAt: null,
  }).run();
  return { ok: true as const };
}

/* ===== متابعة المنشئ: نشاطاتي وردودها + قبول ===== */
export async function myActivitiesData() {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { items: [] };
  const scopes = await creatableScopes(u);
  const mine = (await db.select().from(activities).all())
    .filter((a) => a.createdBy === u.personId || scopes.some((s) => s.kind === a.scopeKind && s.id === a.scopeId))
    .sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
  if (!mine.length) return { items: [] };
  const resp = await db.select().from(activityResponses).where(inArray(activityResponses.activityId, mine.map((a) => a.id))).all();
  const byAct = new Map<string, typeof resp>();
  for (const r of resp) { if (!byAct.has(r.activityId)) byAct.set(r.activityId, []); byAct.get(r.activityId)!.push(r); }
  // كم طالبًا في النطاق (لنسبة الإجابة)
  const items = [] as Array<{
    id: string; title: string; details: string | null; dueAt: number | null; status: string; createdAt: number;
    expected: number; responses: Array<{ id: string; personName: string | null; body: string; submittedAt: number; reviewStatus: string }>;
  }>;
  for (const a of mine) {
    const expected = (await scopeStudentPersons(a.scopeKind, a.scopeId)).length;
    items.push({
      id: a.id, title: a.title, details: a.details, dueAt: a.dueAt, status: a.status, createdAt: a.createdAt,
      expected,
      responses: (byAct.get(a.id) ?? []).map((r) => ({ id: r.id, personName: r.personName, body: r.body, submittedAt: r.submittedAt, reviewStatus: r.reviewStatus }))
        .sort((x, y) => y.submittedAt - x.submittedAt),
    });
  }
  return { items };
}

export async function reviewResponseData(input: { responseId: string; status: "seen" | "accepted" }) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const r = (await db.select().from(activityResponses).where(eq(activityResponses.id, input.responseId)).all())[0];
  if (!r) return { error: "الردّ غير موجود" as const };
  const a = (await db.select().from(activities).where(eq(activities.id, r.activityId)).all())[0];
  if (!a) return { error: "النشاط غير موجود" as const };
  const scopes = await creatableScopes(u);
  const can = a.createdBy === u.personId || scopes.some((s) => s.kind === a.scopeKind && s.id === a.scopeId);
  if (!can) return { error: "المراجعة لمنشئ النشاط أو المسؤول" as const };
  await db.update(activityResponses).set({ reviewStatus: input.status, reviewedBy: u.personId }).where(eq(activityResponses.id, input.responseId)).run();
  return { ok: true as const };
}

export async function closeActivityData(id: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const a = (await db.select().from(activities).where(eq(activities.id, id)).all())[0];
  if (!a) return { error: "النشاط غير موجود" as const };
  const scopes = await creatableScopes(u);
  const can = a.createdBy === u.personId || scopes.some((s) => s.kind === a.scopeKind && s.id === a.scopeId);
  if (!can) return { error: "الإغلاق لمنشئ النشاط أو المسؤول" as const };
  await db.update(activities).set({ status: "closed" }).where(eq(activities.id, id)).run();
  return { ok: true as const };
}
