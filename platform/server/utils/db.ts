import { drizzle } from 'drizzle-orm/d1'
import type { H3Event } from 'h3'
import * as schema from '../database/schema'

// يُرجع عميل Drizzle مربوطاً بقاعدة D1 المُمرَّرة من بيئة Cloudflare
export function useDb(event: H3Event) {
  const env = (event.context as any).cloudflare?.env
  if (!env?.DB) {
    throw createError({ statusCode: 500, statusMessage: 'ربط قاعدة البيانات D1 (DB) غير متاح' })
  }
  return drizzle(env.DB, { schema })
}

export type Db = ReturnType<typeof useDb>
