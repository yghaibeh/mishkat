/**
 * أنواع وحدة الشجرة والحسابات — SPEC_org_and_accounts §١–§٣.
 *
 * الأنواع تُشتقّ من عقود المحرك والمصفوفة الذهبية: لا معرّف دور أو نوع وحدة مخترعٌ هنا.
 * أخطاء العمل **قيمٌ معلنة** (المادة ٣/٤): الخدمات تعيد `Result` لا تُلقي استثناءً لخطأ عمل.
 */

import type { RoleId, UnitTypeId } from "../../authorization/generated/roles.generated.js"

export type Section = "men" | "women"

/**
 * كيان الوحدة — المسار مشتقٌّ من الأب والمعرّف (ت-٢)، لا يُكتب مستقلاً.
 * `tenantId` (§١.٠، قب-١٨/CR-006): الشبكةُ الحاضنة، **تُشتقّ من سياق المستودع لا من مدخل
 * العميل** — يختمها المستودعُ عند الحفظ. المسارُ هنا نسبيٌّ للشبكة؛ العنوان المادّي
 * `/{tenantId}{path}` (انظر `globalPath`).
 */
export type OrgUnit = {
  readonly tenantId: string
  readonly id: string
  readonly type: UnitTypeId
  readonly labelAr: string
  readonly parentId: string | null
  readonly path: string
  readonly section: Section | null
  readonly archived: boolean
}

export type AccountStatus = "active" | "suspended" | "cancelled"

export type Account = {
  readonly tenantId: string
  readonly personId: string
  readonly username: string
  readonly status: AccountStatus
  readonly sessionEpoch: number
}

export type AssignmentApproval = "pending" | "approved" | "rejected"

/** الإسناد المخزَّن — مقطعُ الحقيقة الوحيد للنطاق هو `scopePath` المشتقُّ من الوحدة. */
export type StoredAssignment = {
  readonly tenantId: string
  readonly id: string
  readonly personId: string
  readonly roleId: RoleId
  readonly unitId: string
  readonly scopePath: string
  readonly startDate: Date
  readonly endDate: Date | null
  readonly approvalStatus: AssignmentApproval
}

/** طلب التسجيل من تحت — كيانٌ معلّق واحد (CR-001 §ج). */
export type RegistrationRequest = {
  readonly tenantId: string
  readonly id: string
  readonly personId: string
  readonly username: string
  readonly requestedRoleId: RoleId
  readonly requestedUnitId: string
  readonly status: "pending" | "approved" | "rejected"
  /** «مدعو» إن ورد بدعوة برمز؛ «عام» إن ورد من المسار العام. */
  readonly origin: "public" | "invited"
}

/** رمز الخطأ المصنَّف — تُصاغ رسالتُه العربية في طبقة العرض لا هنا (المادة ٣/٤). */
export type OrgErrorCode =
  | "ENTITY_NOT_FOUND"
  | "PARENT_NOT_FOUND"
  | "DUPLICATE_ID"
  | "UNIT_TYPE_MISMATCH"
  | "SECTION_MIX_REJECTED"
  | "DISABLED_UNIT_TYPE"
  | "ROOT_ONLY"
  | "PROVISION_DENIED"
  | "USERNAME_TAKEN"
  | "REQUEST_NOT_PENDING"
  | "ROLE_SUSPENDED"
  | "INVALID_STATUS_TRANSITION"

export type OrgError = {
  readonly code: OrgErrorCode
  /** تفصيلٌ آليّ للتشخيص — مثلاً الشرطُ الساقط في التمكين (ش١…ش٥). */
  readonly detail?: string
}

export type Ok<T> = { readonly ok: true; readonly value: T }
export type Err = { readonly ok: false; readonly error: OrgError }
export type Result<T> = Ok<T> | Err

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

export function err(code: OrgErrorCode, detail?: string): Err {
  return detail === undefined
    ? { ok: false, error: { code } }
    : { ok: false, error: { code, detail } }
}
