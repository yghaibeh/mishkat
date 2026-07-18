import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../database/schema'

// جسر بيئة Cloudflare: env يصل إلى مدخل الـWorker (src/server.ts) ويُحقَن هنا.
// ربط D1 ثابت لكل العزلة (isolate) فالتخزين على مستوى الوحدة آمن.
let cfEnv: Record<string, any> | null = null
export function setCloudflareEnv(env: Record<string, any>) { cfEnv = env }
export function getCloudflareEnv(): Record<string, any> | null { return cfEnv }

export function useDb() {
  if (!cfEnv?.DB) throw new Error('ربط قاعدة البيانات D1 (DB) غير متاح')
  return drizzle(cfEnv.DB, { schema })
}

export type Db = ReturnType<typeof useDb>
