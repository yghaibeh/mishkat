// مصادقة جهة الخادم (cookie + هوية المستخدم الحالي) — خادم فقط.
import { eq } from "drizzle-orm";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

import { useDb, getCloudflareEnv } from "./utils/db";
import { users, persons, orgUnits } from "./database/schema";
import { verifyPassword, signToken } from "./utils/auth";
import { verifyTotp } from "./utils/totp";
import { isRateLimited, recordFailedAttempt, resetAttempts } from "./services/authTokens";
import { userFromToken, type AuthUser } from "./utils/context";

export const TOKEN_COOKIE = "mishkat_token";

// س١ (أمن): سرُّ التوقيع إلزاميٌّ — لا رجوعَ لثابتٍ معروفٍ (كان يُمكّن تزويرَ رمزٍ لأيّ مستخدمٍ عند غياب السرّ).
// الفشلُ المُغلَق (توقّفٌ) أأمنُ من رمزٍ قابلٍ للتزوير صامتًا.
function jwtSecret(): string {
  const s = getCloudflareEnv()?.JWT_SECRET as string | undefined;
  if (!s) throw new Error("JWT_SECRET غير مضبوط — أوقف الخدمة بدل توقيعٍ بسرٍّ معروف");
  return s;
}

export async function currentUser(): Promise<AuthUser | null> {
  return userFromToken(getCookie(TOKEN_COOKIE), jwtSecret());
}

export async function loginUser(input: { login: string; password: string; totp?: string }) {
  const db = useDb();
  // س٢ (أمن): حدُّ المحاولات ضدّ التخمين/حشو بيانات الاعتماد — كان مفقودًا رغم جاهزيّة البنية
  const rlKey = `login:${input.login.toLowerCase()}`;
  if (await isRateLimited(db, rlKey)) {
    return { error: "محاولاتٌ كثيرةٌ متتالية — انتظر ربع ساعةٍ ثم أعد المحاولة" as const };
  }
  const u = (await db.select().from(users).where(eq(users.login, input.login)).all())[0];
  if (!u || !(await verifyPassword(input.password, u.passwordHash))) {
    await recordFailedAttempt(db, rlKey);
    return { error: "بيانات الدخول غير صحيحة" as const };
  }
  await resetAttempts(db, rlKey); // نجاحُ كلمة المرور يُصفّر العدّاد
  const p0 = (await db.select().from(persons).where(eq(persons.id, u.personId)).all())[0];
  // حالة الحساب = المصدر الوحيد للحقيقة: أيُّ حالةٍ غير active ⇒ يُمنع الدخول برسالةٍ واضحة (مع السبب إن وُجد)
  if (!p0 || p0.status !== "active") {
    const reason = p0?.statusReason ? ` — ${p0.statusReason}` : "";
    const label = p0?.status === "deleted" ? "الحساب مُلغى" : "الحساب موقوف";
    return { error: `${label}${reason} — تواصل مع الإدارة` as const };
  }
  if (u.mfaEnabled) {
    if (!input.totp || !u.mfaSecret || !(await verifyTotp(u.mfaSecret, input.totp))) {
      return { error: "رمز التحقق الثنائي مطلوب أو غير صحيح" as const, mfaRequired: true };
    }
  }
  const token = await signToken({ sub: u.id, pid: u.personId, ep: u.sessionEpoch }, jwtSecret());
  setCookie(TOKEN_COOKIE, token, { httpOnly: true, path: "/", maxAge: 7 * 86400, sameSite: "lax", secure: true });
  const p = (await db.select().from(persons).where(eq(persons.id, u.personId)).all())[0];
  return { ok: true as const, fullName: p?.fullName ?? "" };
}

export async function logoutUser() {
  deleteCookie(TOKEN_COOKIE, { path: "/" });
  return { ok: true as const };
}

const STAFF_ROLES = ["amir"];

export async function meUser() {
  const u = await currentUser();
  // جلسةٌ ملغاة فعليًّا (موقوف/ملغى/رمزٌ مُبطَل بـ epoch) ⇒ currentUser فارغ: نحذف الكوكي ونُخرجه فورًا.
  // ملاحظة: «بلا أدوار» ليس إلغاءً — يبقى مسجَّلًا ويُوجَّه إلى /no-access (فصل الحالة عن الصلاحيات).
  if (!u) {
    if (getCookie(TOKEN_COOKIE)) deleteCookie(TOKEN_COOKIE, { path: "/" });
    return null;
  }
  const roles = u.assignments.map((a) => a.role);
  const db = useDb();
  const { userCaps } = await import("./permissions.server");
  const caps = await userCaps(db, roles);

  // مسجد المستخدم (إن كان من طاقم مسجد) — يحدّد هبوطه وتبويب «مسجدي»
  let homeMosqueId: string | null = null;
  const staff = u.assignments.find((a) => STAFF_ROLES.includes(a.role));
  if (staff) {
    const ou = (await db.select({ id: orgUnits.id, type: orgUnits.type }).from(orgUnits).where(eq(orgUnits.id, staff.orgUnitId)).all())[0];
    if (ou?.type === "mosque") homeMosqueId = ou.id;
  }
  const { loadFeatures, loadBrand } = await import("./settings.server");
  const features = await loadFeatures(db);
  const brand = await loadBrand(db);
  return { fullName: u.fullName, roles, caps, homeMosqueId, features, brand };
}
