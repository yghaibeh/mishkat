import { defineConfig } from 'drizzle-kit'

// توليد هجرات SQLite متوافقة مع Cloudflare D1
export default defineConfig({
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dialect: 'sqlite',
})
