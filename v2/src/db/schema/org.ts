/**
 * جداولُ **الشجرة والحسابات** (`features/org`) — وحدةُ الريادة الأولى (T25).
 *
 * تُثبت مفتاحَ التوجيه في أصعب صوره: الوحدةُ نطاقُها مسارُها، و**الحسابُ الشخصيّ نطاقُه
 * الشبكةُ كلُّها** (`/`) لأن الشخصَ قد يخدم في قسمين — وذلك **صادقٌ لا حشو** (README الحسم ٢).
 */

import { int, routing, text, TENANT_COLUMN, type TableSpec } from "./columns.js"

export const ORG_TABLES: readonly TableSpec[] = [
  // ── وحدةُ الريادة الأولى: الشجرة (تُثبت مفتاحَ التوجيه في أصعب صوره) ──────────
  {
    name: "org_units",
    columns: [
      ...routing(),
      text("id"),
      text("type"),
      text("label_ar"),
      text("parent_id", true),
      text("section", true),
      int("archived"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    name: "org_accounts",
    columns: [...routing(), text("person_id"), text("username"), text("status"), int("session_epoch")],
    primaryKey: [TENANT_COLUMN, "person_id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    name: "org_assignments",
    columns: [
      ...routing(),
      text("id"),
      text("person_id"),
      text("role_id"),
      text("unit_id"),
      int("start_date"),
      int("end_date", true),
      text("approval_status"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
  {
    name: "org_requests",
    columns: [
      ...routing(),
      text("id"),
      text("person_id"),
      text("username"),
      text("requested_role_id"),
      text("requested_unit_id"),
      text("status"),
      text("origin"),
    ],
    primaryKey: [TENANT_COLUMN, "id"],
    appendOnly: false,
    infrastructure: false,
  },
]
