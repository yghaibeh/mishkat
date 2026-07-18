// توفيرُ الحسابات (Account Provisioning) — بنيةٌ عالميّةٌ قابلةٌ لإعادة الاستخدام: مديرٌ مخوَّلٌ يُنشئ
// حسابَ دخولٍ (اسم مستخدم + كلمة مرور) لشخصٍ ويُسند له دورًا مُنطاقًا بموردٍ محدَّد (مسجد/حلقة/لجنة).
// هذا هو المصدرُ الوحيد لإنشاء المستخدمين المُنطاقين — يُبنى فوقه: معلّمُ الحلقة، ومسؤولُ اللجنة، وإدارةُ المستخدمين.
import { eq } from "drizzle-orm";
import { persons, users, roleAssignments, orgUnits, teachers, committees } from "../database/schema";
import { hashPassword } from "../utils/auth";
import { writeAudit } from "../utils/audit";
import type { Db } from "../utils/db";

const LOGIN_RE = /^[a-z0-9._-]+$/;

// النواة: يُنشئ شخصًا (إن لم يُمرَّر personId) + مستخدمًا + تكليفَ دورٍ مُنطاق. يتحقّق من فرادة الدخول ووجود الوحدة.
export async function provisionUser(db: Db, input: {
  fullName?: string; gender: "male" | "female"; login: string; password: string;
  role: string; orgUnitId: string; portfolio?: string; personId?: string; createdBy?: string;
}): Promise<{ personId: string; userId: string; login: string }> {
  const login = input.login.trim().toLowerCase();
  if (login.length < 3) throw new Error("اسمُ الدخول ٣ أحرفٍ فأكثر");
  if (!LOGIN_RE.test(login)) throw new Error("اسمُ الدخول: أحرفٌ لاتينيّةٌ صغيرةٌ وأرقامٌ ونقطة/شرطة فقط");
  if (input.password.length < 6) throw new Error("كلمةُ المرور ٦ أحرفٍ فأكثر");
  const dup = (await db.select({ id: users.id }).from(users).where(eq(users.login, login)).all())[0];
  if (dup) throw new Error("اسمُ الدخول مستخدَمٌ — اختر غيره");
  const ou = (await db.select().from(orgUnits).where(eq(orgUnits.id, input.orgUnitId)).all())[0];
  if (!ou) throw new Error("الوحدةُ التنظيميّة غير موجودة");
  const now = Date.now();
  let personId = input.personId;
  if (!personId) {
    if (!input.fullName || input.fullName.trim().length < 2) throw new Error("الاسمُ الكامل مطلوب");
    personId = crypto.randomUUID();
    await db.insert(persons).values({ id: personId, fullName: input.fullName.trim(), gender: input.gender, birthYearHijri: null, homeOrgUnitId: ou.id, status: "active", createdAt: now }).run();
  }
  const userId = crypto.randomUUID();
  await db.insert(users).values({ id: userId, personId, login, passwordHash: await hashPassword(input.password), lastLogin: null, mfaSecret: null, mfaEnabled: false, sessionEpoch: 0, createdAt: now }).run();
  await db.insert(roleAssignments).values({ id: crypto.randomUUID(), personId, role: input.role, orgUnitId: ou.id, orgPath: ou.path, portfolio: input.portfolio ?? null, startDate: now, endDate: null, termNumber: 1, approvalStatus: "approved", approvedBy: input.createdBy ?? null, createdAt: now }).run();
  await writeAudit(db, { actorUserId: input.createdBy ?? null, action: "provision_user", entity: "user", entityId: userId, after: { login, role: input.role, orgUnitId: ou.id, portfolio: input.portfolio ?? null } });
  return { personId, userId, login };
}

// معلّمُ حلقةٍ جديد: يوفّر حسابًا بدور «teacher» مُنطاقٍ بالمسجد + سجلَّ معلّمٍ (teachers) ليُسنَد للحلقة ويدخل دروسها بنفسه.
export async function provisionTeacher(db: Db, input: { mosqueOrgUnitId: string; fullName: string; gender: "male" | "female"; login: string; password: string; qualification?: string; createdBy?: string }): Promise<{ personId: string; userId: string; teacherId: string; login: string }> {
  const { personId, userId, login } = await provisionUser(db, { fullName: input.fullName, gender: input.gender, login: input.login, password: input.password, role: "teacher", orgUnitId: input.mosqueOrgUnitId, createdBy: input.createdBy });
  const teacherId = crypto.randomUUID();
  await db.insert(teachers).values({ id: teacherId, personId, qualification: input.qualification?.trim() || null, hourlyRateId: null, active: true, createdAt: Date.now() }).run();
  return { personId, userId, teacherId, login };
}

// مسؤولُ لجنةٍ جديد: يوفّر حسابًا بدور «committee_head» مُنطاقٍ بالمسجد (portfolio=معرّف اللجنة) + يربطه رأسًا للجنة.
export async function provisionCommitteeHead(db: Db, input: { committeeId: string; mosqueOrgUnitId: string; fullName: string; gender: "male" | "female"; login: string; password: string; createdBy?: string }): Promise<{ personId: string; userId: string; login: string }> {
  const res = await provisionUser(db, { fullName: input.fullName, gender: input.gender, login: input.login, password: input.password, role: "committee_head", orgUnitId: input.mosqueOrgUnitId, portfolio: input.committeeId, createdBy: input.createdBy });
  await db.update(committees).set({ headPersonId: res.personId, headName: input.fullName.trim() }).where(eq(committees.id, input.committeeId)).run();
  return res;
}
