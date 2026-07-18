// «العُهد» (خادم فقط) — مساحةُ عملٍ قائمةٌ بذاتها: عُهدُ نطاقي (لمن يُسلّم ويستلم) و«عُهدتي»
// (لكلّ فردٍ بيده شيء). العزلُ بالنطاق كسائر النظام، والإقرارُ بيد المستلم وحدَه.
import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { useDb } from "./utils/db";
import { assets, assetCustody, orgUnits, persons, roleAssignments } from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";
import { hasCap } from "../lib/capabilities";
import { userCaps } from "./permissions.server";
import { writeAudit } from "./utils/audit";
import {
  assignCustody, acknowledgeCustody, returnCustody, reportCustody, custodyTimeline, myCustody,
  conditionLabel, CONDITION_KEYS,
} from "./services/assetCustody";

// أدوارُ العهدة: مَن يُسلّم عُهدَ وحدته ويستردّها (نفسُ منطق أمانة الصندوق)
const CUSTODY_SCOPE_ROLES = ["section_head", "rabita", "square", "amir"];
// الحالاتُ التي تعني «بيد شخصٍ الآن» — وما عداها فالأصلُ في وحدته مهما بقي اسمٌ قديم
const HELD = ["active", "damaged"];

async function me() {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  return u;
}
// نطاقُ الإدارة: null = الكلّ (الإدارة العليا)، وإلّا مساراتُ تكليفاته العهدِيّة
function scopes(u: NonNullable<Awaited<ReturnType<typeof currentUser>>>): string[] | null {
  if (isGlobalAdmin(u)) return null;
  return [...new Set(u.assignments.filter((a) => CUSTODY_SCOPE_ROLES.includes(a.role)).map((a) => a.orgPath))];
}
const covers = (sc: string[] | null, path: string | null) => sc === null || (!!path && sc.some((p) => path.startsWith(p)));

async function requireManage() {
  const u = await me();
  const caps = await userCaps(useDb(), [...new Set(u.assignments.map((a) => a.role))]);
  if (!hasCap(caps, "assets.manage")) throw new Error("إدارةُ العُهد لمسؤول الوحدة");
  const sc = scopes(u);
  if (sc !== null && !sc.length) throw new Error("لا نطاقَ عهدةٍ لك");
  return { u, sc };
}

// ===== عُهدُ نطاقي: مَن يحوز ماذا، ومنذ متى، وهل أقرّ — ومَن لم يقرّ بعد =====
export async function scopeCustodyData() {
  const { u, sc } = await requireManage();
  const db = useDb();
  const rows = (await db.select().from(assets).all()).filter((a) => covers(sc, a.orgPath ?? "/"));
  const ids = rows.map((r) => r.id);
  const events: Array<typeof assetCustody.$inferSelect> = [];
  for (let i = 0; i < ids.length; i += 90) {
    events.push(...(await db.select().from(assetCustody).where(inArray(assetCustody.assetId, ids.slice(i, i + 90))).all()));
  }
  const lastOf = new Map<string, typeof assetCustody.$inferSelect>();
  for (const e of events) lastOf.set(e.assetId, e); // الاستعلامُ مرتَّبٌ بالإدراج فآخرُه الأحدث
  const ouIds = [...new Set(rows.map((r) => r.orgUnitId).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  for (let i = 0; i < ouIds.length; i += 90) {
    for (const o of await db.select({ id: orgUnits.id, name: orgUnits.name }).from(orgUnits).where(inArray(orgUnits.id, ouIds.slice(i, i + 90))).all()) names.set(o.id, o.name);
  }
  return {
    canManage: true,
    items: rows.map((a) => {
      const last = lastOf.get(a.id);
      return {
        id: a.id, name: a.name, kind: a.kind, details: a.details, status: a.status,
        unitName: (a.orgUnitId && names.get(a.orgUnitId)) || "—",
        // الحالةُ هي مصدرُ الحقيقة للحيازة: صفوفٌ قديمةٌ تحمل اسمَ حائزٍ وحالتُها «مُعادة»
        // كانت تعرض «بعهدة فلان» و«في الوحدة» معاً — تناقضٌ في سطرٍ واحد (قاعدة الحقيقة الواحدة ٣٤).
        holderName: HELD.includes(a.status) ? a.holderName : null,
        holderPersonId: HELD.includes(a.status) ? a.holderPersonId : null,
        condition: a.condition, conditionLabel: conditionLabel(a.condition),
        since: a.custodySince,
        // «بانتظار إقراره» فعلٌ معلَّقٌ لا رقمٌ صامت — المسؤول يرى مَن لم يستلم بعد
        awaitingAck: !!(last && !last.ackAt && last.toPersonId),
        lastAt: last?.at ?? a.createdAt,
      };
    }).sort((x, y) => Number(y.awaitingAck) - Number(x.awaitingAck) || y.lastAt - x.lastAt),
    // مرشّحو التسليم: أشخاصُ نطاقي (بتكليفٍ داخل مساري) — لا كلُّ أشخاص الشبكة
    people: await scopePeople(db, sc),
  };
}

async function scopePeople(db: ReturnType<typeof useDb>, sc: string[] | null) {
  const ras = await db.select({ personId: roleAssignments.personId, path: roleAssignments.orgPath })
    .from(roleAssignments).where(eq(roleAssignments.approvalStatus, "approved")).all();
  const inScope = [...new Set(ras.filter((r) => covers(sc, r.path)).map((r) => r.personId))].slice(0, 400);
  const out: Array<{ id: string; name: string }> = [];
  for (let i = 0; i < inScope.length; i += 90) {
    out.push(...(await db.select({ id: persons.id, name: persons.fullName }).from(persons)
      .where(and(inArray(persons.id, inScope.slice(i, i + 90)), ne(persons.status, "deleted"))).all()));
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

// ===== «عُهدتي»: ما بيدي وما ينتظر إقراري — لكلّ فردٍ بلا قدرةِ إدارة =====
export async function myCustodyData() {
  const u = await me();
  return myCustody(useDb(), u.personId);
}

export async function custodyTimelineData(assetId: string) {
  const u = await me();
  const db = useDb();
  const a = (await db.select().from(assets).where(eq(assets.id, assetId)).all())[0];
  if (!a) throw new Error("الأصل غير موجود");
  // يراها مسؤولُ نطاقها أو حائزُها نفسُه (سلسلةُ حيازةٍ لا تُخفى عن صاحبها)
  const sc = scopes(u);
  const mineNow = a.holderPersonId === u.personId;
  if (!mineNow && !covers(sc, a.orgPath ?? "/")) throw new Error("خارج نطاقك");
  return { asset: { id: a.id, name: a.name, holderName: a.holderName, status: a.status }, events: await custodyTimeline(db, assetId) };
}

// ===== الحركات =====
export async function assignCustodyData(input: { assetId: string; toPersonId: string; condition?: string; note?: string }) {
  try {
    const { u, sc } = await requireManage();
    const db = useDb();
    const a = (await db.select().from(assets).where(eq(assets.id, input.assetId)).all())[0];
    if (!a) return { error: "الأصل غير موجود" as const };
    if (!covers(sc, a.orgPath ?? "/")) return { error: "الأصل خارج نطاقك" as const };
    if (input.condition && !CONDITION_KEYS.includes(input.condition)) return { error: "حالةٌ غير معروفة" as const };
    const r = await assignCustody(db, { ...input, byUserId: u.userId });
    await writeAudit(db, { actorUserId: u.userId, action: "custody.assign", entity: "asset", entityId: input.assetId, after: { to: input.toPersonId, condition: input.condition } });
    return { ok: true as const, id: r.id };
  } catch (e) { return { error: (e as Error).message || "تعذّرت الحركة" as const }; }
}

export async function acknowledgeCustodyData(eventId: string) {
  try {
    const u = await me();
    const db = useDb();
    await acknowledgeCustody(db, eventId, { personId: u.personId, userId: u.userId });
    await writeAudit(db, { actorUserId: u.userId, action: "custody.ack", entity: "asset_custody", entityId: eventId });
    return { ok: true as const };
  } catch (e) { return { error: (e as Error).message || "تعذّر الإقرار" as const }; }
}

export async function returnCustodyData(input: { assetId: string; condition?: string; note?: string }) {
  try {
    const { u, sc } = await requireManage();
    const db = useDb();
    const a = (await db.select().from(assets).where(eq(assets.id, input.assetId)).all())[0];
    if (!a) return { error: "الأصل غير موجود" as const };
    if (!covers(sc, a.orgPath ?? "/")) return { error: "الأصل خارج نطاقك" as const };
    await returnCustody(db, { ...input, byUserId: u.userId });
    await writeAudit(db, { actorUserId: u.userId, action: "custody.return", entity: "asset", entityId: input.assetId, before: { holder: a.holderName } });
    return { ok: true as const };
  } catch (e) { return { error: (e as Error).message || "تعذّرت الإعادة" as const }; }
}

export async function reportCustodyData(input: { assetId: string; state: "damaged" | "lost" | "retire"; note?: string }) {
  try {
    const { u, sc } = await requireManage();
    const db = useDb();
    const a = (await db.select().from(assets).where(eq(assets.id, input.assetId)).all())[0];
    if (!a) return { error: "الأصل غير موجود" as const };
    if (!covers(sc, a.orgPath ?? "/")) return { error: "الأصل خارج نطاقك" as const };
    await reportCustody(db, { ...input, byUserId: u.userId });
    await writeAudit(db, { actorUserId: u.userId, action: `custody.${input.state}`, entity: "asset", entityId: input.assetId, after: { note: input.note } });
    return { ok: true as const };
  } catch (e) { return { error: (e as Error).message || "تعذّر البلاغ" as const }; }
}

// ===== تكاملُ الاستقالة: لا تُطوى صفحةُ كادرٍ وبيده عهدة =====
// (تُستدعى من مسار قرار الاستقالة — «الجواب قبل القرار» لا مفاجأةٌ بعده)
export async function openCustodyOf(personId: string): Promise<Array<{ id: string; name: string }>> {
  const db = useDb();
  const rows = await db.select({ id: assets.id, name: assets.name }).from(assets)
    .where(and(eq(assets.holderPersonId, personId), inArray(assets.status, ["active", "damaged"]))).all();
  return rows;
}

// عدّادُ «بانتظار إقراري» لبطاقة الرئيسية (فعلٌ شخصيٌّ لا يُنسى)
export async function myCustodyBadge(personId: string) {
  const db = useDb();
  const waiting = (await db.select().from(assetCustody)
    .where(and(eq(assetCustody.toPersonId, personId), isNotNull(assetCustody.toPersonId))).all())
    .filter((e) => !e.ackAt && (e.action === "assign" || e.action === "transfer"));
  const held = await db.select({ id: assets.id }).from(assets)
    .where(and(eq(assets.holderPersonId, personId), eq(assets.status, "active"))).all();
  return { held: held.length, awaitingMyAck: waiting.length };
}
