/**
 * مجموعة أسباب القرار المغلقة — SPEC_authorization §٤.١.
 * كل قرار يعيد سبباً مصنَّفاً لا «نعم/لا»: للرسالة، وللتدقيق، ولقوة التوكيد في الاختبار.
 */
export const REASON_CODES = [
  "ALLOWED_BY_ROLE",
  "ALLOWED_BY_GRANT",
  "ALLOWED_PERSONAL_OWNER",
  "DENIED_UNKNOWN_CAPABILITY",
  "DENIED_ACCOUNT_SUSPENDED",
  "DENIED_SESSION_STALE",
  "DENIED_NO_ACTIVE_ASSIGNMENT",
  "DENIED_ROLE_SUSPENDED",
  "DENIED_NO_CAPABILITY",
  "DENIED_OUT_OF_SCOPE",
  "DENIED_EXPLICIT_BLOCK",
  "DENIED_PERSONAL_NOT_OWNER",
  "DENIED_PERSONAL_NOT_IN_ROLE",
  "DENIED_ROOT_SCOPE_REQUIRED",
  "DENIED_IMPERSONATION_READONLY",
  "DENIED_FEATURE_DISABLED",
] as const

export type ReasonCode = (typeof REASON_CODES)[number]

/**
 * الرسالة العربية تُصاغ في طبقة العرض من الرمز (المادة ٣/٤) — هذا معجمها الوحيد،
 * فلا تُبعثر نصوص الرفض في المكوّنات (المادة ٢/٦).
 */
export const REASON_LABELS_AR: Readonly<Record<ReasonCode, string>> = Object.freeze({
  ALLOWED_BY_ROLE: "مسموح بحكم دورك على هذا النطاق",
  ALLOWED_BY_GRANT: "مسموح بمنحٍ فرديّ فوق دورك",
  ALLOWED_PERSONAL_OWNER: "مسموح لأنك صاحب هذا الكيان",
  DENIED_UNKNOWN_CAPABILITY: "قدرة غير معروفة — خطأ برمجي، أبلغ الدعم",
  DENIED_ACCOUNT_SUSPENDED: "حسابك موقوف — راجع مسؤولك",
  DENIED_SESSION_STALE: "انتهت صلاحية جلستك — سجّل الدخول من جديد",
  DENIED_NO_ACTIVE_ASSIGNMENT: "لا تكليف سارياً لك — راجع مسؤولك لاعتماد تكليفك",
  DENIED_ROLE_SUSPENDED: "دورك موقوف بمفتاح تفعيل — راجع الإدارة",
  DENIED_NO_CAPABILITY: "هذه الصلاحية ليست ضمن دورك",
  DENIED_OUT_OF_SCOPE: "هذا العنصر خارج نطاقك",
  DENIED_EXPLICIT_BLOCK: "هذه الصلاحية محجوبة عنك — راجع مسؤولك",
  DENIED_PERSONAL_NOT_OWNER: "هذا فعلٌ لا يقوم به إلا صاحبه",
  DENIED_PERSONAL_NOT_IN_ROLE: "هذا فعلٌ شخصيٌّ لا يمنحه دورك — ولو كان الكيان باسمك",
  DENIED_ROOT_SCOPE_REQUIRED: "هذه صلاحية شبكية تُمارَس على الجذر حصراً",
  DENIED_IMPERSONATION_READONLY: "جلسة اطّلاعٍ للدعم — لا يجوز فيها أي فعل كاتب",
  DENIED_FEATURE_DISABLED: "هذه الميزة معطّلة بمفتاح تفعيل",
})
