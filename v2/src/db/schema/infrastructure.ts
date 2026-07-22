/**
 * **البنيةُ التحتية** — ما ليس بياناتِ شبكةٍ أصلاً.
 *
 * دفترُ الهجرات وحدَه اليوم، وهو **الجدولُ الوحيد بلا `tenant_id`**. ووسمُ `infrastructure`
 * هو ما يجعل قاعدة «كلُّ جدولٍ يحمل بيانات شبكةٍ يحمل مفتاحَ التوجيه» (ع-٥) **قابلةً
 * للاشتقاق بلا استثناءٍ يُسرد**: الحارسُ يسأل الوسمَ ولا تُملى عليه قائمة (CR-011/قب-٣٦).
 */

import { int, text, type TableSpec } from "./columns.js"

export const INFRASTRUCTURE_TABLES: readonly TableSpec[] = [
  {
    name: "_migrations",
    columns: [text("name"), int("applied_at")],
    primaryKey: ["name"],
    appendOnly: true,
    infrastructure: true,
  },
]
