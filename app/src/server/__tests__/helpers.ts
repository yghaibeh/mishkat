// أدوات الاختبار: قاعدة بيانات في الذاكرة (libsql) عبر هجرات النظام الحقيقية + مستخدم وهمي.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../database/schema";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "..", "database", "migrations");

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

// يبني قاعدة بيانات في الذاكرة ويطبّق كل الهجرات بالترتيب (المصدر الحقيقي للمخطط)
export async function createTestDb(): Promise<{ db: TestDb; client: Client }> {
  const client = createClient({ url: ":memory:" });
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    await client.executeMultiple(sql);
  }
  const db = drizzle(client, { schema });
  return { db, client };
}

// مستخدم وهمي لمحاكاة currentUser() — assignments تحدّد الدور والنطاق
export type FakeUser = {
  userId: string;
  personId: string;
  fullName: string;
  assignments: Array<{ role: string; orgUnitId: string; orgPath: string; portfolio?: string | null }>;
};

export function makeUser(role: string, orgUnitId: string, orgPath: string, opts?: Partial<FakeUser>): FakeUser {
  return {
    userId: opts?.userId ?? `u-${role}-${orgUnitId}`,
    personId: opts?.personId ?? `p-${role}-${orgUnitId}`,
    fullName: opts?.fullName ?? `${role} ${orgUnitId}`,
    assignments: [{ role, orgUnitId, orgPath, portfolio: null }],
  };
}
