// إدارة الصلاحيات القابلة للتهيئة (خادم فقط) — التجاوزات + حساب القدرات الفعلية.
import { and, eq } from "drizzle-orm";
import { useDb } from "./utils/db";
import { permissionOverrides } from "./database/schema";
import { currentUser } from "./auth.server";
import { isGlobalAdmin } from "./utils/context";
import { effectiveCaps, type Override } from "../lib/capabilities";

export async function loadOverrides(db: ReturnType<typeof useDb>): Promise<Override[]> {
  const rows = await db.select().from(permissionOverrides).all();
  return rows.map((r) => ({ role: r.role, capability: r.capability, effect: r.effect as "grant" | "revoke" }));
}

// القدرات الفعلية لمستخدم من أدواره + التجاوزات (يُستدعى من meUser)
export async function userCaps(db: ReturnType<typeof useDb>, roles: string[]): Promise<string[]> {
  return effectiveCaps(roles, await loadOverrides(db));
}

async function requirePermAdmin() {
  const u = await currentUser();
  if (!u || !isGlobalAdmin(u)) throw new Error("إدارة الصلاحيات للإدارة العليا فقط");
  return u;
}

export async function permissionMatrixData() {
  await requirePermAdmin();
  return { overrides: await loadOverrides(useDb()) };
}

export async function setPermissionData(input: { role: string; capability: string; state: "grant" | "revoke" | "default" }) {
  await requirePermAdmin();
  const db = useDb();
  await db.delete(permissionOverrides).where(and(eq(permissionOverrides.role, input.role), eq(permissionOverrides.capability, input.capability))).run();
  if (input.state !== "default") {
    await db.insert(permissionOverrides).values({
      id: crypto.randomUUID(), role: input.role, capability: input.capability, effect: input.state, createdAt: Date.now(),
    }).run();
  }
  return { ok: true as const };
}
