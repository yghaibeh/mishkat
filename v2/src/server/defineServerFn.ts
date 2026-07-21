/**
 * الإعلان الإلزامي على دوال الخادم — SPEC_authorization §٥.٢ + CR-001 §ج (قب-١٣).
 *
 * **المنع افتراضاً**: كل دالة خادم تعلن في تعريفها إمّا `capability` وإمّا `PUBLIC_DECLARED`.
 * الدالة بلا إعلان **لا تُسجَّل في جدول المسارات أصلاً** ⇒ لا تصير نقطة RPC مكشوفة
 * كما حصل في v1 (صنف أ-١…أ-٨: fail-open لمجهول).
 *
 * أربعة ثوابت، كلٌّ يقتل عيباً موثقاً:
 *  ١. `capability` إلزامي — لا افتراضي ولا اختياري ⇒ يقتل صنف أ.
 *  ٢. `scope` **يُشتق من الكيان المخزَّن** لا من مدخل العميل ⇒ يقتل صنف خ.
 *  ٣. `NO_SCOPE` يُقفل ولا يُفتح — الكيان غير الموجود يعني رفضاً.
 *  ٤. `audit` جزءٌ من التعريف لا خطوةٌ تُنسى.
 */

import type { CapId } from "../authorization/generated/capabilities.generated.js"
import type { Scope } from "../authorization/scope.js"
import { can, type Actor, type DecisionContext, type Decision } from "../authorization/can.js"
import { PUBLIC_DECLARED_ROUTES } from "./publicRoutes.js"

/** صنف المسار العام المعلن — «الاستثناء المعلن آمن، والصامت قاتل». */
export const PUBLIC_DECLARED = "PUBLIC_DECLARED" as const
export type PublicDeclared = typeof PUBLIC_DECLARED

export type ServerFnDeclaration<TInput, TOutput> = {
  readonly name: string
  /** قدرةٌ مطلوبة **أو** مسارٌ عام معلن. لا شكل ثالث ولا غياب. */
  readonly capability: CapId | PublicDeclared
  /** مُحلِّل النطاق: يشتق النطاق من الكيان المخزَّن. مطلوبٌ لكل دالة محمية بقدرة. */
  readonly scope?: (input: TInput) => Scope | Promise<Scope>
  /** هل الفعل كاتب؟ يحدد رفضَ جلسة الانتحال القرائي. */
  readonly intent: "read" | "write"
  /** اسم الفعل في سجل التدقيق — التدوين جزء من التعريف. */
  readonly audit: string
  readonly handler: (
    input: TInput,
    ctx: { decision: Decision; actor: Actor; request: DecisionContext },
  ) => Promise<TOutput>
}

export type RegisteredServerFn<TInput, TOutput> = {
  readonly declaration: ServerFnDeclaration<TInput, TOutput>
  readonly invoke: (
    input: TInput,
    actor: Actor,
    ctx: DecisionContext,
  ) => Promise<{ ok: true; value: TOutput } | { ok: false; decision: Decision }>
}

/** جدول المسارات: الدوال المسجَّلة حصراً. ما ليس فيه غير موجود. */
const REGISTRY = new Map<string, RegisteredServerFn<never, unknown>>()

export function defineServerFn<TInput, TOutput>(
  declaration: ServerFnDeclaration<TInput, TOutput>,
): RegisteredServerFn<TInput, TOutput> {
  // الإعلان يُفحص عند التسجيل: دالةٌ ناقصة الإعلان لا تدخل الجدول.
  if (declaration.capability === undefined) {
    throw new Error(`دالة الخادم «${declaration.name}» بلا إعلان قدرة — لا تُسجَّل (المادة ٤/٥)`)
  }
  // المسار العام المعلن يُفحص **زمن التشغيل** أيضاً لا بالبوابة وحدها: بوابة G16 تحرس
  // الشجرة، وهذا يحرس التسجيل نفسه — فلا تُسجَّل دالةٌ عامة خارج القائمة البيضاء ولو
  // التفّ أحدٌ على الفحص الساكن (دفاعٌ في العمق على الصنف الذي أنتج ثغرات v1).
  if (
    declaration.capability === PUBLIC_DECLARED &&
    !PUBLIC_DECLARED_ROUTES.includes(declaration.name)
  ) {
    throw new Error(
      `دالة الخادم «${declaration.name}» تعلن PUBLIC_DECLARED وليست في القائمة البيضاء المعتمدة — إضافتها تغييرٌ جوهري بـCR (CR-001 §ج)`,
    )
  }
  if (declaration.capability !== PUBLIC_DECLARED && declaration.scope === undefined) {
    throw new Error(
      `دالة الخادم «${declaration.name}» تعلن قدرةً بلا مُحلِّل نطاق — النطاق معامل إلزامي (المادة ٤/٣)`,
    )
  }
  if (REGISTRY.has(declaration.name)) {
    throw new Error(`دالة خادم مكررة الاسم: ${declaration.name}`)
  }

  const registered: RegisteredServerFn<TInput, TOutput> = {
    declaration,
    async invoke(input, actor, ctx) {
      const request: DecisionContext = { ...ctx, intent: declaration.intent }
      if (declaration.capability === PUBLIC_DECLARED) {
        const value = await declaration.handler(input, {
          actor,
          decision: { allowed: true, reason: "ALLOWED_BY_ROLE" },
          request,
        })
        return { ok: true, value }
      }

      // الهوية تُفحص **قبل** جسم الدالة لا داخله — فنمط `u && …` مستحيل بنيوياً.
      const scope = await declaration.scope!(input)
      const decision = can(actor, declaration.capability, scope, request)
      if (!decision.allowed) return { ok: false, decision }

      const value = await declaration.handler(input, { decision, actor, request })
      return { ok: true, value }
    },
  }

  REGISTRY.set(declaration.name, registered as unknown as RegisteredServerFn<never, unknown>)
  return registered
}

export function registeredServerFns(): readonly RegisteredServerFn<never, unknown>[] {
  return [...REGISTRY.values()]
}

export function clearRegistryForTests(): void {
  REGISTRY.clear()
}
