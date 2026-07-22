/**
 * محرّكُ SQLite المحليّ — **نفسُ محرّك D1** (D1 هي SQLite) بلا مِقبض الشبكة.
 *
 * غرضُه أن تجري الاختباراتُ التكاملية على **قاعدةٍ حقيقية** لا على محاكاةٍ في الذاكرة
 * (TESTING_POLICY §١: «server functions ضد D1 حقيقية محلية»)، وأن تعمل في CI **بلا حالةٍ
 * محلية** (قب-٢٣): قاعدةٌ في الذاكرة تُبنى وتُهاجَر وتُهدَم في كل اختبار.
 *
 * **لا يدخل حزمةَ الـWorker**: نقطةُ دخول الإنتاج تستعمل `d1Driver.ts` وحده؛ وهذا الملفّ
 * لا يستورده أحدٌ إلا الاختباراتُ وأدواتُ النقل.
 */

import { DatabaseSync } from "node:sqlite"
import type { SqlDriver, SqlRow, SqlStatement, SqlValue } from "./driver.js"

export type SqliteDriver = SqlDriver & {
  /** تنفيذٌ متزامنٌ لعباراتٍ متعددة — لبناء عوالم الاختبار (بذرةُ v1 مثلاً). */
  readonly execSync: (sql: string) => void
  readonly close: () => void
}

export function openSqliteDriver(): SqliteDriver {
  const db = new DatabaseSync(":memory:")
  db.exec("PRAGMA foreign_keys = ON")

  const run = (statement: SqlStatement): void => {
    db.prepare(statement.sql).run(...(statement.params as SqlValue[]))
  }

  return {
    // `async` مقصودة: خطأُ المحرّك يجب أن يصل **رفضاً** كما يصل من D1 عبر الشبكة —
    // ورميةٌ متزامنةٌ من منفذٍ يَعِد بوعدٍ تتسلّل من كل `await` مكتوبٍ حوله.
    all: async (statement) =>
      db.prepare(statement.sql).all(...(statement.params as SqlValue[])) as unknown as readonly SqlRow[],
    batch: async (statements) => {
      // **الدفعةُ معاملةٌ** — نظيرُ المعاملة الضمنية في D1 حرفياً (ADR-001 ملحق ب).
      db.exec("BEGIN")
      try {
        for (const statement of statements) run(statement)
        db.exec("COMMIT")
      } catch (e) {
        db.exec("ROLLBACK")
        throw e
      }
    },
    exec: async (sql) => {
      db.exec(sql)
    },
    execSync: (sql) => db.exec(sql),
    close: () => db.close(),
  }
}
