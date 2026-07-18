// التسجيل الذاتيّ الهرميّ (الوثيقة ٢٦ §١) — لا حساب قبل الاعتماد؛ الاعتماد ينشئ الهيكلية ذرّيًّا.
// مَن يعتمد؟ الطبقة المغطّية فوق الدور المطلوب مباشرةً (طالب→أمير المسجد، أمير→مربع/منطقة، مربع→منطقة، منطقة→المدير العام).
import { and, eq, inArray, isNull } from "drizzle-orm";
import { useDb } from "./utils/db";
import { registrationRequests, orgUnits, circles, circleStudents, persons, personContacts, users, roleAssignments, notifications } from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";
import { hashPassword } from "./utils/auth";
import { createOrgUnit } from "./services/orgUnits";
import { syncCircleTwins } from "./services/studentBridge";
import { bridgeCircle } from "./circles.server";
import { writeAudit } from "./utils/audit";
import { ROLES } from "./utils/rbac";

// الأدوار المتاحة للتسجيل الذاتيّ (لا admin/section_head — تعيينٌ إداريّ حصرًا)
export const SELF_REG_KINDS = ["student", "teacher", "amir", "square", "rabita"] as const;
export type SelfRegKind = (typeof SELF_REG_KINDS)[number];

// رتبة الدور في الهرم (أصغر = أعلى) — تحدّد من يعتمد من
const KIND_RANK: Record<string, number> = { rabita: 2, square: 3, amir: 4, teacher: 5, student: 5 };
const ROLE_RANK: Record<string, number> = { admin: 0, section_head: 1, rabita: 2, square: 3, amir: 4, teacher: 5 };

// نوع الوحدة المطلوب لكلّ دور
const KIND_UNIT_TYPE: Record<string, string[]> = {
  student: ["mosque", "halaqa"], teacher: ["mosque", "halaqa"], amir: ["mosque", "halaqa"],
  square: ["square"], rabita: ["rabita"],
};

const label = (k: string) =>
  k === "student" ? "طالب" : k === "teacher" ? "معلّم حلقة" : k === "amir" ? "مسؤول مسجد" : k === "square" ? "مسؤول مربع" : "مسؤول منطقة";

/* ===== ١) الشجرة العامّة المختصرة (بلا جلسة) — أسماء فقط، لا أشخاص ولا إحصاءات ===== */
export async function publicOrgTreeData() {
  const db = useDb();
  const units = await db
    .select({ id: orgUnits.id, parentId: orgUnits.parentId, type: orgUnits.type, name: orgUnits.name, section: orgUnits.section })
    .from(orgUnits).where(eq(orgUnits.status, "active")).all();
  const mosqueIds = units.filter((x) => x.type === "mosque" || x.type === "halaqa").map((x) => x.id);
  // حلقات المساجد (للطالب/المعلّم) — على دفعاتٍ احترامًا لحدّ متغيّرات D1
  const circleRows: Array<{ id: string; mosqueId: string; name: string }> = [];
  for (let i = 0; i < mosqueIds.length; i += 90) {
    const batch = mosqueIds.slice(i, i + 90);
    circleRows.push(...(await db.select({ id: circles.id, mosqueId: circles.mosqueId, name: circles.name })
      .from(circles).where(and(eq(circles.status, "active"), inArray(circles.mosqueId, batch))).all()));
  }
  return { units, circles: circleRows, kinds: SELF_REG_KINDS as unknown as string[] };
}

/* ===== ٢) التقديم (بلا جلسة) ===== */
export async function submitRegistrationData(input: {
  kind: string; fullName: string; gender: "male" | "female"; login: string; password: string;
  phone?: string; note?: string;
  targetUnitId?: string;                    // وحدة قائمة
  proposedUnitName?: string;                // «مسجدي غير مدرج»
  proposedParentId?: string;                // الأب (مربع/منطقة) للوحدة المقترحة
  circleId?: string;                        // للطالب/المعلّم (اختياري)
  website?: string;                         // honeypot — يملؤه الروبوت فقط
}) {
  const db = useDb();
  if (input.website) return { ok: true as const, token: crypto.randomUUID() }; // فخّ صامت — لا نكشف شيئًا
  const kind = input.kind as SelfRegKind;
  if (!SELF_REG_KINDS.includes(kind)) return { error: "دورٌ غير متاحٍ للتسجيل الذاتيّ" as const };
  const fullName = input.fullName.trim();
  const login = input.login.trim().toLowerCase();
  if (fullName.length < 5) return { error: "أدخل الاسم الكامل" as const };
  if (!/^[a-z0-9_.-]{3,32}$/.test(login)) return { error: "اسم الدخول: أحرفٌ لاتينيّةٌ صغيرةٌ وأرقام (٣–٣٢)" as const };
  if (input.password.length < 8) return { error: "كلمة المرور ٨ أحرفٍ فأكثر" as const };

  // فريد اسم الدخول: عبر الحسابات القائمة والطلبات المعلّقة معًا
  const existsUser = (await db.select({ id: users.id }).from(users).where(eq(users.login, login)).all())[0];
  if (existsUser) return { error: "اسم الدخول غير متاح" as const };
  const pendingSame = await db.select({ id: registrationRequests.id }).from(registrationRequests)
    .where(and(eq(registrationRequests.login, login), eq(registrationRequests.status, "pending"))).all();
  if (pendingSame.length) return { error: "اسم الدخول غير متاح" as const };

  // الهدف: وحدة قائمة، أو مسجدٌ مقترحٌ لمسؤول مسجدٍ فقط
  let targetUnitId: string | null = null;
  let targetPath: string | null = null;
  let proposedUnitName: string | null = null;
  let proposedParentId: string | null = null;
  const genderOfTrack = (t: string) => (t === "female" ? "female" : "male");
  if (input.targetUnitId) {
    const ou = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.targetUnitId)).all())[0];
    if (!ou || ou.status !== "active") return { error: "الوحدة المختارة غير متاحة" as const };
    if (!KIND_UNIT_TYPE[kind].includes(ou.type)) return { error: "الوحدة لا تناسب الدور المختار" as const };
    // ف٣: جنس المتقدّم يطابق مسارَ الوحدة — الواجهة تربطهما لكنّ المسار عامٌّ بلا جلسة، فالحكم للخادم
    if (input.gender !== genderOfTrack(ou.genderTrack)) return { error: "الوحدة المختارة في قسمٍ لا يطابق الجنس المُدخل" as const };
    targetUnitId = ou.id; targetPath = ou.path;
  } else if (kind === "amir" && input.proposedUnitName?.trim() && input.proposedParentId) {
    const parent = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.proposedParentId)).all())[0];
    if (!parent || parent.status !== "active") return { error: "الوحدة الأب غير متاحة" as const };
    if (!["square", "rabita"].includes(parent.type)) return { error: "يُنشأ المسجد تحت مربعٍ أو منطقة" as const };
    if (input.gender !== genderOfTrack(parent.genderTrack)) return { error: "الوحدة الأب في قسمٍ لا يطابق الجنس المُدخل" as const }; // ف٣
    proposedUnitName = input.proposedUnitName.trim();
    proposedParentId = parent.id; targetPath = parent.path; // المعتمِد من يغطّي الأب
  } else {
    return { error: "اختر موقعك في الهيكل" as const };
  }

  // حلقة الطالب (اختياريّة) — يجب أن تتبع المسجد المختار
  let circleId: string | null = null;
  if (input.circleId && targetUnitId) {
    const c = (await db.select().from(circles).where(eq(circles.id, input.circleId)).all())[0];
    if (c && c.status === "active" && c.mosqueId === targetUnitId) {
      if (input.gender !== genderOfTrack(c.genderTrack)) return { error: "الحلقة المختارة لمسارٍ لا يطابق الجنس المُدخل" as const }; // ف٣
      circleId = c.id;
    }
  }

  // سقف تكرار بسيط: ٣ طلباتٍ معلّقةٍ كحدٍّ أقصى لنفس الهاتف
  if (input.phone?.trim()) {
    const dup = await db.select({ id: registrationRequests.id }).from(registrationRequests)
      .where(and(eq(registrationRequests.phone, input.phone.trim()), eq(registrationRequests.status, "pending"))).all();
    if (dup.length >= 3) return { error: "لديك طلباتٌ معلّقةٌ كثيرة — انتظر البتّ فيها" as const };
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(registrationRequests).values({
    id, kind, fullName, gender: input.gender, login,
    passwordHash: await hashPassword(input.password), phone: input.phone?.trim() || null,
    targetUnitId, targetPath, proposedUnitName, proposedParentId, circleId,
    note: input.note?.trim() || null, status: "pending", createdAt: now,
  }).run();

  await notifyApprovers(db, { id, kind, fullName, targetPath: targetPath!, proposedUnitName, targetUnitId, now });
  return { ok: true as const, token: id };
}

// إشعار «طلب انضمام» لأقرب طبقةٍ مغطّيةٍ مخوَّلة (وللأمير مباشرةً في طلبات الطلاب/المعلّمين)
async function notifyApprovers(db: ReturnType<typeof useDb>, req: { id: string; kind: string; fullName: string; targetPath: string; proposedUnitName: string | null; targetUnitId: string | null; now: number }) {
  const kindRank = KIND_RANK[req.kind];
  const assigns = (await db.select().from(roleAssignments).where(eq(roleAssignments.approvalStatus, "approved")).all())
    .filter((a) => !a.endDate && (ROLE_RANK[a.role] ?? 99) < kindRank)
    .filter((a) => a.role === "admin" || req.targetPath.startsWith(a.orgPath)
      || (kindRank === 5 && a.role === "amir" && a.orgUnitId === req.targetUnitId));
  if (!assigns.length) return;
  // الأقرب: أعمق مسارٍ يغطّي (والأمير أولى في طلبات داخل المسجد)
  const nonAdmin = assigns.filter((a) => a.role !== "admin");
  const pool = nonAdmin.length ? nonAdmin : assigns;
  const deepest = pool.reduce((m, a) => (a.orgPath.length > m.orgPath.length ? a : m), pool[0]);
  const targets = pool.filter((a) => a.orgPath.length === deepest.orgPath.length);
  for (const t of targets) {
    await db.insert(notifications).values({
      id: crypto.randomUUID(), personId: t.personId, channel: "inapp", kind: "registration_pending",
      payload: JSON.stringify({ requestId: req.id, fullName: req.fullName, roleLabel: label(req.kind), unitName: req.proposedUnitName ?? undefined }),
      status: "queued", createdAt: req.now, sentAt: null,
    }).run();
  }
}

/* ===== ٣) الاستعلام بالرمز (بلا جلسة) ===== */
export async function registrationStatusData(token: string) {
  const db = useDb();
  const r = (await db.select().from(registrationRequests).where(eq(registrationRequests.id, token)).all())[0];
  if (!r) return { error: "لا طلب بهذا الرمز" as const };
  return {
    status: r.status as "pending" | "approved" | "rejected",
    kindLabel: label(r.kind), fullName: r.fullName,
    rejectReason: r.rejectReason ?? null, decidedAt: r.decidedAt ?? null, createdAt: r.createdAt,
  };
}

/* ===== ٤) صندوق طلبات الانضمام (مقيّد) ===== */
type Approver = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

function approverAssigns(u: Approver, kind: string, targetPath: string, targetUnitId: string | null) {
  const kindRank = KIND_RANK[kind] ?? 99;
  return u.assignments.filter((a) =>
    (ROLE_RANK[a.role] ?? 99) < kindRank &&
    (a.role === "admin" || targetPath.startsWith(a.orgPath) ||
      (kindRank === 5 && a.role === "amir" && a.orgUnitId === targetUnitId)));
}
const canApprove = (u: Approver, kind: string, targetPath: string, targetUnitId: string | null) =>
  isGlobalAdmin(u) || approverAssigns(u, kind, targetPath, targetUnitId).length > 0;

export type RegRequestItem = {
  id: string; kind: string; kindLabel: string; fullName: string; gender: string; login: string;
  phone: string | null; note: string | null; createdAt: number;
  unitName: string | null; unitPath: string | null;
  proposedUnitName: string | null; proposedParentName: string | null;
  circleName: string | null; targetInactive: boolean;
};

export async function pendingRegistrationsData(): Promise<{ items: RegRequestItem[] }> {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { items: [] };
  const rows = await db.select().from(registrationRequests).where(eq(registrationRequests.status, "pending")).all();
  let mine = rows.filter((r) => canApprove(u, r.kind, r.targetPath ?? "/", r.targetUnitId));
  // قاعدة المالك الواحد (٣٤ §المبادئ): الإدارةُ لا تُوجَّه لها الطلباتُ روتينيًّا — تظهر لها
  // حصراً طلباتُ الوحدات التي لا طبقةَ إشرافيّةً مُكلَّفةً فوقها (نظير كسر الزجاج) — كانت كلُّ
  // الطلبات تظهر للمدير ولكلّ الطبقات معًا (تدقيق ٣٣ هـ-٣: قناةٌ مكرّرةٌ عبر المستويات).
  if (isGlobalAdmin(u)) {
    const { approverLayerFor } = await import("./services/approvalRouting");
    const vacant: typeof mine = [];
    for (const r of mine) {
      const layer = await approverLayerFor(db, r.targetPath ?? "/");
      if (layer.kind === "vacant") vacant.push(r);
    }
    mine = vacant;
  }
  if (!mine.length) return { items: [] };

  const unitIds = [...new Set(mine.flatMap((r) => [r.targetUnitId, r.proposedParentId].filter(Boolean)))] as string[];
  const units = unitIds.length
    ? await db.select({ id: orgUnits.id, name: orgUnits.name, path: orgUnits.path, status: orgUnits.status }).from(orgUnits).where(inArray(orgUnits.id, unitIds)).all()
    : [];
  const uById = new Map(units.map((x) => [x.id, x]));
  const circleIds = [...new Set(mine.map((r) => r.circleId).filter(Boolean))] as string[];
  const cs = circleIds.length ? await db.select({ id: circles.id, name: circles.name }).from(circles).where(inArray(circles.id, circleIds)).all() : [];
  const cById = new Map(cs.map((c) => [c.id, c]));

  const items = mine.map((r) => {
    const tu = r.targetUnitId ? uById.get(r.targetUnitId) : undefined;
    const pp = r.proposedParentId ? uById.get(r.proposedParentId) : undefined;
    return {
      id: r.id, kind: r.kind, kindLabel: label(r.kind), fullName: r.fullName, gender: r.gender,
      login: r.login, phone: r.phone, note: r.note, createdAt: r.createdAt,
      unitName: tu?.name ?? null, unitPath: r.targetPath, proposedUnitName: r.proposedUnitName,
      proposedParentName: pp?.name ?? null,
      circleName: r.circleId ? (cById.get(r.circleId)?.name ?? null) : null,
      targetInactive: !!(tu && tu.status !== "active") || !!(pp && pp.status !== "active"),
    };
  }).sort((a, b) => a.createdAt - b.createdAt);
  return { items };
}

/* ===== ٥) الاعتماد — إنشاء الهيكليّة كاملةً ===== */
export async function approveRegistrationData(id: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  const r = (await db.select().from(registrationRequests).where(eq(registrationRequests.id, id)).all())[0];
  if (!r || r.status !== "pending") return { error: "الطلب غير موجودٍ أو بُتَّ فيه" as const };
  if (!canApprove(u, r.kind, r.targetPath ?? "/", r.targetUnitId)) return { error: "الاعتماد لصاحب الطبقة المغطّية" as const };

  // إعادة فحص فريد اسم الدخول (الحكم الأخير — درءًا للسباق)
  const taken = (await db.select({ id: users.id }).from(users).where(eq(users.login, r.login)).all())[0];
  if (taken) return { error: "اسم الدخول حُجز بعد التقديم — ارفض الطلبَ واطلب اسمًا آخر" as const };

  // ق٣: مطالبةٌ ذرّيّة — نحجز الطلب بحالةٍ انتقاليّة بشرط أنّه ما يزال «pending».
  // اعتمادان متزامنان: الأوّل يحجز، والثاني لا يطابق شرطُه فيُصدّ — فلا شخصٌ ولا حسابٌ مكرَّر.
  await db.update(registrationRequests).set({ status: "approving" })
    .where(and(eq(registrationRequests.id, id), eq(registrationRequests.status, "pending"))).run();
  const claimed = (await db.select().from(registrationRequests).where(eq(registrationRequests.id, id)).all())[0];
  if (!claimed || claimed.status !== "approving") return { error: "الطلب بُتَّ فيه للتوّ" as const };

  try {
    return await finalizeApproval(db, u, r, id);
  } catch (e) {
    // فشلٌ أثناء الإنشاء ⇒ نُعيد الطلب للطابور (لا يبقى معلَّقًا في «approving»)
    await db.update(registrationRequests).set({ status: "pending" }).where(eq(registrationRequests.id, id)).run();
    return { error: (e as Error).message || ("تعذّر إتمام الاعتماد" as const) };
  }
}

// إتمامُ الاعتماد بعد المطالبة الذرّيّة — يرمي عند أيّ تعذّرٍ فيُعيد المُطالبةُ الطلبَ للطابور (ق٣)
async function finalizeApproval(
  db: ReturnType<typeof useDb>,
  u: NonNullable<Awaited<ReturnType<typeof currentUser>>>,
  r: typeof registrationRequests.$inferSelect,
  id: string,
) {
  const now = Date.now();
  // (أ) الوحدة: قائمة، أو تُنشأ الآن («المسجد يُضاف حين الاعتماد»)
  let unitId = r.targetUnitId;
  let unitPath = r.targetPath;
  let createdUnitId: string | null = null;
  if (!unitId && r.proposedUnitName && r.proposedParentId) {
    const parent = (await db.select().from(orgUnits).where(eq(orgUnits.id, r.proposedParentId)).all())[0];
    if (!parent || parent.status !== "active") throw new Error("الوحدة الأب لم تعد متاحة");
    const leafType = parent.section === "women" ? "halaqa" : "mosque";
    const res = await createOrgUnit(db, {
      parentId: parent.id, type: leafType, genderTrack: parent.genderTrack, name: r.proposedUnitName,
    }, u.userId);
    unitId = res.id; unitPath = res.path; createdUnitId = res.id;
  }
  if (!unitId || !unitPath) throw new Error("لا وحدة هدفٍ للطلب");
  const unit = (await db.select().from(orgUnits).where(eq(orgUnits.id, unitId)).all())[0];
  if (!unit || unit.status !== "active") throw new Error("الوحدة الهدف لم تعد نشطة");
  if (r.gender !== (unit.genderTrack === "female" ? "female" : "male")) throw new Error("جنس المتقدّم لا يطابق مسار الوحدة — لا يُعتمد"); // ف٣

  // (ب) الشخص + الاتصال + الحساب + التكليف — دفعةٌ ذرّيّةٌ واحدة (تدقيق الرصد):
  // كان تسلسلَ إدراجاتٍ منفصلًا، فعطبٌ بعد إدراج الحساب يترك حسابًا يتيمًا باسم دخولٍ محجوز
  // فيصير الطلبُ غيرَ قابلٍ للاعتماد أبدًا. الآن: إمّا أن تُكتب الأربعةُ معًا أو لا شيء.
  const personId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const core: unknown[] = [
    db.insert(persons).values({
      id: personId, fullName: r.fullName, gender: r.gender as "male" | "female", birthYearHijri: null,
      homeOrgUnitId: unitId, status: "active", createdAt: now,
    }),
    db.insert(users).values({
      id: userId, personId, login: r.login, passwordHash: r.passwordHash,
      lastLogin: null, mfaSecret: null, mfaEnabled: false, createdAt: now,
    }),
    // تكليفٌ معتمَدٌ بدور الطلب — الطالب أيضًا دورٌ (student) ليدخل «المطلوب منّي» ومكتبته (§ن)
    db.insert(roleAssignments).values({
      id: crypto.randomUUID(), personId, role: r.kind, orgUnitId: unitId, orgPath: unitPath,
      portfolio: null, startDate: now, endDate: null, termNumber: 1,
      approvalStatus: "approved", approvedBy: u.userId, createdAt: now,
    }),
  ];
  if (r.phone) core.push(db.insert(personContacts).values({ personId, phone: r.phone }));
  await db.batch(core as unknown as Parameters<typeof db.batch>[0]);

  // الجسورُ امتدادٌ غيرُ حرجٍ للحساب (إن تعثّرت فالحسابُ سليم) — نعزلها فلا تُفشل الاعتماد
  if (r.circleId && (r.kind === "student" || r.kind === "teacher")) {
    try {
      if (r.kind === "student") {
        const csId = crypto.randomUUID();
        await db.insert(circleStudents).values({ id: csId, circleId: r.circleId, name: r.fullName, personId, notes: null, status: "active", createdAt: now }).run();
        const { mirrorStudentToTahfeez } = await import("./services/studentBridge");
        await mirrorStudentToTahfeez(db, { id: csId, circleId: r.circleId, name: r.fullName, personId });
      } else {
        await db.update(circles).set({ teacherPersonId: personId }).where(and(eq(circles.id, r.circleId), isNull(circles.teacherPersonId))).run();
        const c = (await db.select().from(circles).where(eq(circles.id, r.circleId)).all())[0];
        if (c && c.teacherPersonId === personId) {
          const mosque = (await db.select().from(orgUnits).where(eq(orgUnits.id, c.mosqueId)).all())[0];
          if (mosque) await bridgeCircle(db, mosque, { id: c.id, type: c.type, name: c.name, genderTrack: c.genderTrack, teacherPersonId: personId });
          await syncCircleTwins(db, c, { teacherPersonId: personId });
        }
      }
    } catch (e) {
      console.error(`[registration] bridge for ${personId} failed (account intact):`, (e as Error)?.message ?? e);
    }
  }

  await db.update(registrationRequests).set({
    status: "approved", decidedBy: u.userId, decidedByName: u.fullName, decidedAt: now,
    createdUnitId, createdPersonId: personId, createdUserId: userId,
  }).where(eq(registrationRequests.id, id)).run();
  await writeAudit(db, { actorUserId: u.userId, action: "approve_registration", entity: "registration_request", entityId: id, after: { kind: r.kind, login: r.login, unitId, createdUnitId } });
  return { ok: true as const, createdUnitId };
}

/* ===== ٦) الرفض — بسببٍ إلزاميّ ===== */
export async function rejectRegistrationData(id: string, reason: string) {
  const db = useDb();
  const u = await currentUser();
  if (!u) return { error: "يلزم تسجيل الدخول" as const };
  if (!reason?.trim()) return { error: "سبب الرفض إلزاميّ" as const };
  const r = (await db.select().from(registrationRequests).where(eq(registrationRequests.id, id)).all())[0];
  if (!r || r.status !== "pending") return { error: "الطلب غير موجودٍ أو بُتَّ فيه" as const };
  if (!canApprove(u, r.kind, r.targetPath ?? "/", r.targetUnitId)) return { error: "الرفض لصاحب الطبقة المغطّية" as const };
  await db.update(registrationRequests).set({
    status: "rejected", decidedBy: u.userId, decidedByName: u.fullName, decidedAt: Date.now(), rejectReason: reason.trim(),
  }).where(eq(registrationRequests.id, id)).run();
  await writeAudit(db, { actorUserId: u.userId, action: "reject_registration", entity: "registration_request", entityId: id, after: { reason: reason.trim() } });
  return { ok: true as const };
}
