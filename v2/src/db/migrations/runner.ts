/**
 * مشغّلُ الهجرات — **idempotent بمفتاحٍ طبيعيّ هو اسمُ الهجرة** (المادة ٧/١، ADR ع-٤).
 *
 * لا يقرأ ملفّاً ولا يلمس نظامَ ملفات: يستقبل الهجراتِ نصّاً، فيصلح للـWorker وللـCI
 * وللاختبار سواءً. وقراءةُ المجلد شأنُ المُستدعي (البوابةُ أو الاختبار).
 *
 * **الهجرةُ مرتين لا تُفسد شيئاً**: كلُّ عبارةٍ `IF NOT EXISTS`، ودفترُ الهجرات يمنع
 * إعادةَ التطبيق أصلاً — حزامٌ وحمّالة، لأن الخطأ هنا يُتلف بياناتِ إنتاج.
 */

import type { SqlDriver } from "../sql/driver.js"

export type Migration = {
  /** مرقّمةٌ بأربع خانات — الترتيبُ من الاسم لا من ترتيب القراءة. */
  readonly name: string
  readonly sql: string
}

const LEDGER_TABLE = `CREATE TABLE IF NOT EXISTS _migrations (
  name       TEXT    NOT NULL,
  applied_at INTEGER NOT NULL,
  PRIMARY KEY (name)
)`

/** ساعةُ التطبيق حقنٌ لا استيراد — فلا زمنَ تشغيلٍ داخل الطبقة (TESTING_POLICY §٥). */
export type MigrationClock = () => number

export async function appliedMigrations(driver: SqlDriver): Promise<readonly string[]> {
  await driver.exec(LEDGER_TABLE)
  const rows = await driver.all({ sql: "SELECT name FROM _migrations ORDER BY name", params: [] })
  return rows.map((row) => String(row["name"]))
}

/**
 * يُطبّق ما لم يُطبَّق بترتيب الاسم، ويعيد **أسماءَ ما طُبِّق الآن** — فإعادةُ التشغيل
 * تُعيد قائمةً فارغة، وهو التوكيدُ الذي تقيسه G10.
 */
export async function applyMigrations(
  driver: SqlDriver,
  migrations: readonly Migration[],
  clock: MigrationClock = () => 0,
): Promise<readonly string[]> {
  const already = new Set(await appliedMigrations(driver))
  const pending = [...migrations].sort((a, b) => a.name.localeCompare(b.name))
  const applied: string[] = []
  for (const migration of pending) {
    if (already.has(migration.name)) continue
    await driver.exec(migration.sql)
    await driver.batch([
      {
        sql: "INSERT INTO _migrations (name, applied_at) VALUES (?, ?) ON CONFLICT (name) DO NOTHING",
        params: [migration.name, clock()],
      },
    ])
    applied.push(migration.name)
  }
  return applied
}
