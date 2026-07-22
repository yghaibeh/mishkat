/**
 * المنفذُ المجرَّد للقاعدة — **الحدُّ الوحيد الذي يعبره SQL** (ADR-001 ع-١/ع-٢).
 *
 * لماذا منفذٌ لا استيرادٌ مباشر لـD1؟ لأن غرضَ طبقة العزل المعلن أن تكون كلفةُ الانتقال إلى
 * Postgres **أسابيع لا أرباعاً** (ADR-001 §٥): محرّكٌ جديدٌ = تنفيذٌ جديدٌ لهذا المنفذ وحده.
 *
 * والدفعةُ (`batch`) هي **الوحيدة** التي تحمل الذرّية: معاملةٌ ضمنية في D1، و`BEGIN/COMMIT`
 * في غيره. وهي مسموحةٌ **هنا وحدها** — واستعمالُها خارج `db/` تُفشله G17 (ع-٢).
 */

/** ما تقبله القاعدةُ قيمةً — لا `Date` ولا `boolean` ولا كائن (`encode.ts` يترجمها). */
export type SqlValue = string | number | null

export type SqlRow = Readonly<Record<string, SqlValue>>

export type SqlStatement = {
  readonly sql: string
  readonly params: readonly SqlValue[]
}

export type SqlDriver = {
  readonly all: (statement: SqlStatement) => Promise<readonly SqlRow[]>
  /** **كلٌّ أو لا شيء** — لا تُترك كتابةٌ جزئية بأي مسار. */
  readonly batch: (statements: readonly SqlStatement[]) => Promise<void>
  /** عباراتٌ متعددة بلا معاملات — للهجرات وحدها. */
  readonly exec: (sql: string) => Promise<void>
}
