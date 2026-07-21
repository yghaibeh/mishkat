/**
 * سجلُّ أنواع الاعتماد — **النوعُ بيانٌ يُعلن، لا وحدةُ منطقٍ تُكتب** (عقدُ الوحدة §٧).
 *
 * هذا هو موضعُ الفارق كلِّه عن v1: هناك كان لكل ميزةٍ منطقُ اعتمادٍ خاصّ فاختلفت السلوكيات
 * وتناقضت؛ وهنا **يُسجَّل النوعُ إعلاناً** (كيانُه · قدراتُه · نطاقُه · شرطا تقديمه · ما يحدث
 * عند الاعتماد والرفض) ثم **يجري عليه المحرّكُ نفسُه** — فالسلوكُ واحدٌ بحكم البناء.
 *
 * **ولا يُعطِّل نوعٌ حارساً** (قاعدةُ CR-008 مرفوعةً إلى نظام الأنواع): حقولُ الحراسة نوعُها
 * الحرفيّ `true`، فمحاولةُ إعلانِ `false` **لا تُترجم** — منعٌ من المُترجِم لا من المراجعة.
 */

import type { CapId } from "../../authorization/generated/capabilities.generated.js"

export type ApprovalTypeDefinition = {
  /** معرّفُ النوع — فريدٌ في السجل (`box.closing`، `unit.report` …). */
  readonly id: string
  readonly entityAr: string
  /** كيانُ النوع نطاقُه **وحدةٌ تنظيمية** — والسلسلةُ تتبع الشجرة (ق-١). */
  readonly scopeKind: "unit"
  /** قدرةُ التقديم — «ذ» عادةً: الوحدةُ بعينها تُقدّم عن نفسها (ق-٩). */
  readonly submitCapability: CapId
  /** قدرةُ الاعتماد/الرفض — «ف»: عملُ مَن تحت (ق-١). */
  readonly approveCapability: CapId
  /** قدرةُ التدخل الفوقيّ إن كانت للنوع (ق-١٢)، و`null` = لا مسارَ تدخّلٍ أصلاً. */
  readonly overrideCapability: CapId | null
  /** قدرةُ السحب قبل الاعتماد (ب-٣٠ج)، و`null` = لا سحبَ لهذا النوع. */
  readonly retractCapability: CapId | null
  /** شرطُ تقديمٍ: طلبٌ واحدٌ لكل وحدةٍ وفترة (ق-٦٧). */
  readonly uniquePerPeriod: true
  /** شرطُ تقديمٍ: حمولةٌ مشتقّةٌ غيرُ فارغة — لا تقديمَ على فراغ (ق-١٠). */
  readonly payloadRequired: true
  /** أثرُ الاعتماد: قفلٌ (ق-٨). */
  readonly approvalLocks: true
  /** أثرُ الرفض: عودةٌ إلى المسودة (ق-٧). */
  readonly rejectionReturnsToDraft: true
  /** أثرُ الرفض: سببٌ نصّيٌّ إلزاميّ (ق-٧). */
  readonly rejectionRequiresReason: true
}

const TYPES = new Map<string, ApprovalTypeDefinition>()

/** يسجّل نوعاً. **الاسمُ المكرَّر يرمي**: نوعان بمعرّفٍ واحدٍ عيبُ مصدرِ حقيقةٍ لا تفصيل. */
export function defineApprovalType(definition: ApprovalTypeDefinition): ApprovalTypeDefinition {
  if (TYPES.has(definition.id)) {
    throw new Error(`نوعُ اعتمادٍ مكرَّرُ المعرّف: ${definition.id} — المعرّفُ واحدٌ في السجل`)
  }
  const frozen = Object.freeze({ ...definition })
  TYPES.set(frozen.id, frozen)
  return frozen
}

/** النوعُ بمعرّفه، أو `null` — و**ما ليس في السجل غيرُ موجود** (نظيرُ جدول المسارات في G7). */
export function approvalType(id: string): ApprovalTypeDefinition | null {
  return TYPES.get(id) ?? null
}

export function registeredApprovalTypes(): readonly ApprovalTypeDefinition[] {
  return Object.freeze([...TYPES.values()])
}

export function clearApprovalTypesForTests(): void {
  TYPES.clear()
}
