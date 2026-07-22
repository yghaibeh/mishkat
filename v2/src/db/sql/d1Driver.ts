/**
 * محرّكُ D1 للإنتاج — **الموضعُ الوحيد في المستودع كلِّه** الذي يلمس واجهة D1 (ع-٢/G17).
 *
 * `batch()` هنا **مسموحةٌ ومقصودة**: هي حاملةُ الذرّية في غياب المعاملات التفاعلية
 * (`db/README.md` الحسم ١)، ومنعُها في ع-٢ منعٌ **خارج هذه الطبقة** لأن ما لا مقابل له في
 * Postgres يجب ألا يتسرّب إلى المنطق. وعند الانتقال يُستبدل هذا الملفّ وحده.
 *
 * النوعُ **بنيويّ لا مستورَد**: لا تبعيةَ على `@cloudflare/workers-types` لأجل ثلاث دوالّ —
 * وحدودُ D1 المعلنة (ADR ملحق ب) هي العقد، لا شكلُ حزمةِ أنواع.
 */

import type { SqlDriver, SqlRow, SqlStatement, SqlValue } from "./driver.js"

type D1PreparedStatement = {
  bind: (...values: SqlValue[]) => D1PreparedStatement
  all: <T>() => Promise<{ results: T[] }>
}

/** أقلُّ ما نحتاجه من `D1Database` — ولا شيء أكثر (سطحٌ أضيق = هجرةٌ أرخص). */
export type D1Like = {
  prepare: (sql: string) => D1PreparedStatement
  batch: (statements: D1PreparedStatement[]) => Promise<unknown[]>
  exec: (sql: string) => Promise<unknown>
}

export function d1Driver(database: D1Like): SqlDriver {
  const bound = (statement: SqlStatement): D1PreparedStatement =>
    database.prepare(statement.sql).bind(...(statement.params as SqlValue[]))

  return {
    all: async (statement) => (await bound(statement).all<SqlRow>()).results,
    batch: async (statements) => {
      if (statements.length === 0) return
      await database.batch(statements.map(bound))
    },
    exec: async (sql) => {
      await database.exec(sql)
    },
  }
}
