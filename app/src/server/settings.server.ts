// منطق «الإعدادات» (خادم فقط) — المعدّلات المالية (rate_schemes) بنسخٍ مؤرّخة.
// التعديل لا يحذف: يُلغى تفعيل النسخة الحالية وتُضاف نسخة جديدة فعّالة (validFrom=الآن) فيُحفظ التاريخ.
import { and, desc, eq, like, sql } from "drizzle-orm";
import { useDb } from "./utils/db";
import { rateSchemes, pointsSchemes, appSettings } from "./database/schema";
import { currentUser } from "./auth.server";
import { writeAudit } from "./utils/audit";
import { hasCap } from "../lib/capabilities";

// الوحدات القابلة للتفعيل/التعطيل من الإعدادات (مفتاح app_settings = feature.<key>)
export const FEATURE_CATALOG: Array<{ key: string; label: string; hint: string }> = [
  { key: "alaBaseera", label: "على بصيرة", hint: "حلقات التعليم الأسري في المساجد" },
  { key: "tahfeez", label: "التحفيظ", hint: "حلقات تحفيظ القرآن" },
  { key: "meetings", label: "الاجتماعات", hint: "اجتماعات الشورى وقراراتها" },
  { key: "committees", label: "اللجان", hint: "لجان أسرة المسجد وخططها" },
];
const FEATURE_KEYS = FEATURE_CATALOG.map((f) => f.key);

// أعلام الوحدات الفعّالة — الغياب = مُفعَّل (افتراضي ON). يُستدعى من meUser.
export async function loadFeatures(db: ReturnType<typeof useDb>): Promise<Record<string, boolean>> {
  const rows = await db.select().from(appSettings).where(like(appSettings.key, "feature.%")).all();
  const off = new Set(rows.filter((r) => r.value === "0").map((r) => r.key.slice("feature.".length)));
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, !off.has(k)]));
}

// هوية العلامة — اسم المنظومة وحرف الشعار والعملة الافتراضية. يُستدعى من meUser.
export const BRAND_DEFAULTS = { name: "مِشكاة", letter: "م", currency: "USD" };
export async function loadBrand(db: ReturnType<typeof useDb>): Promise<{ name: string; letter: string; currency: string }> {
  const rows = await db.select().from(appSettings).where(like(appSettings.key, "brand.%")).all();
  const map = new Map(rows.map((r) => [r.key.slice("brand.".length), r.value]));
  return {
    name: map.get("name") || BRAND_DEFAULTS.name,
    letter: map.get("letter") || BRAND_DEFAULTS.letter,
    currency: map.get("currency") || BRAND_DEFAULTS.currency,
  };
}

// أنواع المعدّلات المعروفة + بياناتها للعرض
export const RATE_KINDS: Array<{ kind: string; label: string; hint: string; hasPerUnit: boolean }> = [
  { kind: "point_rate", label: "معدّل النقاط", hint: "المبلغ المستحَق مقابل كل (عدد) نقطة في التقرير الشهري", hasPerUnit: true },
  { kind: "hourly_rate", label: "معدّل الساعة (على بصيرة)", hint: "المبلغ المستحَق لكل ساعة درس في حلقات على بصيرة", hasPerUnit: false },
  { kind: "fixed_salary", label: "الراتب المقطوع", hint: "مبلغ شهري ثابت لمن يُوصف راتبه مقطوعاً", hasPerUnit: false },
];

async function requireCap(cap: string) {
  const u = await currentUser();
  if (!u) throw new Error("يلزم تسجيل الدخول");
  const { userCaps } = await import("./permissions.server");
  const caps = await userCaps(useDb(), u.assignments.map((a) => a.role));
  if (!hasCap(caps, cap)) throw new Error("لا تملك صلاحية تعديل المعدّلات");
  return u;
}

export async function listRatesData() {
  await requireCap("settings.view");
  const db = useDb();
  const all = await db.select().from(rateSchemes).orderBy(desc(rateSchemes.validFrom)).all();
  return RATE_KINDS.map((meta) => {
    const ofKind = all.filter((r) => r.kind === meta.kind);
    const current = ofKind.find((r) => r.active) ?? ofKind[0] ?? null;
    return {
      ...meta,
      amount: current?.amount ?? null,
      perUnit: current?.perUnit ?? null,
      currency: current?.currency ?? "USD",
      validFrom: current?.validFrom ?? null,
      versions: ofKind.length,
    };
  });
}

export async function setRateData(input: { kind: string; amount: number; perUnit?: number | null; currency?: string }) {
  const u = await requireCap("settings.manage");
  if (!RATE_KINDS.some((k) => k.kind === input.kind)) throw new Error("نوع معدّل غير معروف");
  if (!(input.amount >= 0)) throw new Error("مبلغ غير صالح");
  const db = useDb();

  const prev = (await db.select().from(rateSchemes).where(and(eq(rateSchemes.kind, input.kind), eq(rateSchemes.active, true))).all());
  // ألغِ تفعيل النسخ الحالية لهذا النوع
  await db.update(rateSchemes).set({ active: false }).where(and(eq(rateSchemes.kind, input.kind), eq(rateSchemes.active, true))).run();

  // العملة: المُمرَّرة، وإلا الحفاظ على عملة النسخة السابقة، وإلا عملة العلامة الافتراضية
  const currency = input.currency || prev[0]?.currency || (await loadBrand(db)).currency;
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(rateSchemes).values({
    id, kind: input.kind, amount: input.amount,
    perUnit: input.kind === "point_rate" ? (input.perUnit ?? null) : null,
    currency, validFrom: now, active: true,
  }).run();

  await writeAudit(db, {
    actorUserId: u.userId, action: "rate.update", entity: "rate_scheme", entityId: id,
    before: prev[0] ?? null, after: { kind: input.kind, amount: input.amount, perUnit: input.perUnit ?? null, currency },
  });
  return { ok: true as const, id };
}

// ===== الإعدادات العامة: الهدف الأسبوعي (لكل مسار) + أعلام الوحدات =====
export async function generalSettingsData() {
  await requireCap("settings.view");
  const db = useDb();
  const schemes = await db.select({ track: pointsSchemes.genderTrack, target: pointsSchemes.weeklyTarget })
    .from(pointsSchemes).where(eq(pointsSchemes.active, true)).all();
  const targetOf = (t: string) => schemes.find((s) => s.track === t)?.target ?? null;
  const features = await loadFeatures(db);
  const brand = await loadBrand(db);
  return {
    weeklyTargets: { male: targetOf("male"), female: targetOf("female") },
    features: FEATURE_CATALOG.map((f) => ({ ...f, enabled: features[f.key] ?? true })),
    brand,
  };
}

export async function setBrandData(input: { name?: string; letter?: string; currency?: string }) {
  const u = await requireCap("settings.manage");
  const db = useDb();
  const now = Date.now();
  const updates: Array<[string, string]> = [];
  if (input.name != null) updates.push(["brand.name", input.name.trim().slice(0, 40) || BRAND_DEFAULTS.name]);
  if (input.letter != null) updates.push(["brand.letter", input.letter.trim().slice(0, 2) || BRAND_DEFAULTS.letter]);
  if (input.currency != null) updates.push(["brand.currency", input.currency.trim().slice(0, 6).toUpperCase() || BRAND_DEFAULTS.currency]);
  for (const [key, value] of updates) {
    await db.insert(appSettings).values({ key, value, updatedAt: now })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: now } }).run();
  }
  await writeAudit(db, { actorUserId: u.userId, action: "brand.update", entity: "app_setting", entityId: "brand", after: Object.fromEntries(updates) });
  return { ok: true as const };
}

export async function setWeeklyTargetData(input: { track: "male" | "female"; target: number }) {
  const u = await requireCap("settings.manage");
  if (!(input.target > 0)) throw new Error("هدف غير صالح");
  const db = useDb();
  const prev = (await db.select().from(pointsSchemes).where(and(eq(pointsSchemes.genderTrack, input.track), eq(pointsSchemes.active, true))).all())[0];
  await db.update(pointsSchemes).set({ weeklyTarget: input.target })
    .where(and(eq(pointsSchemes.genderTrack, input.track), eq(pointsSchemes.active, true))).run();
  await writeAudit(db, {
    actorUserId: u.userId, action: "weeklyTarget.update", entity: "points_scheme", entityId: prev?.id ?? input.track,
    before: prev ? { weeklyTarget: prev.weeklyTarget } : null, after: { track: input.track, weeklyTarget: input.target },
  });
  return { ok: true as const };
}

export async function setFeatureData(input: { key: string; enabled: boolean }) {
  const u = await requireCap("settings.manage");
  if (!FEATURE_KEYS.includes(input.key)) throw new Error("وحدة غير معروفة");
  const db = useDb();
  const settingKey = `feature.${input.key}`;
  const value = input.enabled ? "1" : "0";
  await db.insert(appSettings).values({ key: settingKey, value, updatedAt: Date.now() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: Date.now() } }).run();
  await writeAudit(db, { actorUserId: u.userId, action: "feature.toggle", entity: "app_setting", entityId: settingKey, after: { enabled: input.enabled } });
  return { ok: true as const };
}
