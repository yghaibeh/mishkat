/**
 * ترميزُ القيم بين الكيان والقاعدة — **بلا نوعٍ خاصٍّ بمحرّك** (ADR-001 ع-٣).
 *
 * التاريخُ عددٌ صحيحٌ بالمللي ثانية، والمنطقُ ٠/١، والبنيةُ نصُّ JSON — ثلاثةُ اصطلاحاتٍ
 * تعمل على SQLite/D1 وPostgres سواءً، فلا يُعاد تفسيرُ عمودٍ يوم يتغيّر المحرّك.
 *
 * وكلُّ قراءةٍ **مُتحقَّقٌ منها**: صفٌّ ينقصه عمودٌ أو يحمل نوعاً غير متوقَّع **يُرمى**
 * ولا يُقرأ بـ`undefined` صامتة (المادة ٣/٣: التحقق عند الحدود — والقاعدةُ حدّ).
 */

import type { SqlRow, SqlValue } from "./sql/driver.js"

export function encodeDate(value: Date): number {
  return value.getTime()
}

export function encodeBoolean(value: boolean): number {
  return value ? 1 : 0
}

export function encodeNullable<T, E extends SqlValue>(
  value: T | null,
  encode: (inner: T) => E,
): E | null {
  return value === null ? null : encode(value)
}

function requireColumn(row: SqlRow, column: string): SqlValue {
  if (!(column in row)) throw new Error(`عمودٌ مفقودٌ في الصفّ: ${column}`)
  return row[column] ?? null
}

export function readText(row: SqlRow, column: string): string {
  const value = requireColumn(row, column)
  if (typeof value !== "string") throw new Error(`العمود ${column} ليس نصّاً`)
  return value
}

export function readTextOrNull(row: SqlRow, column: string): string | null {
  const value = requireColumn(row, column)
  if (value === null) return null
  if (typeof value !== "string") throw new Error(`العمود ${column} ليس نصّاً ولا فارغاً`)
  return value
}

export function readInt(row: SqlRow, column: string): number {
  const value = requireColumn(row, column)
  if (typeof value !== "number") throw new Error(`العمود ${column} ليس عدداً`)
  return value
}

export function readIntOrNull(row: SqlRow, column: string): number | null {
  const value = requireColumn(row, column)
  if (value === null) return null
  if (typeof value !== "number") throw new Error(`العمود ${column} ليس عدداً ولا فارغاً`)
  return value
}

export function readBoolean(row: SqlRow, column: string): boolean {
  return readInt(row, column) !== 0
}

export function readDate(row: SqlRow, column: string): Date {
  return new Date(readInt(row, column))
}

export function readDateOrNull(row: SqlRow, column: string): Date | null {
  const value = readIntOrNull(row, column)
  return value === null ? null : new Date(value)
}
