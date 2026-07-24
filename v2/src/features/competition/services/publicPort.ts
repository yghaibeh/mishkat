/**
 * **المنفذُ الضيّقُ للمسار العامّ** — قيدُ قب-١٣ الثالث **مفروضٌ بغياب المِقبض** (عقدُ الوحدة §٤-٢).
 *
 * الصنفُ الذي يحرسه هذا الملفُّ هو بعينه ما أنتج ثغرات v1 (أ-١…أ-٨: نقاطُ RPC مكشوفةٌ لمجهولٍ
 * **بلا أن يقصد أحد**) — وأخطرُ صوره **البحثُ المكشوف** (أ-١). ولذلك:
 *
 * **المسارُ العامُّ لا يستقبل المستودعَ أصلاً.** يستقبل هذا المنفذَ، وله **مِقبضٌ واحدٌ لا ثانيَ
 * له**: `submit`. فلا قائمةَ ولا بحثَ ولا تقريرَ **يمكن استدعاؤه من هناك** — لا امتناعاً بل
 * **بغياب الدالة**، كما قُتل «قسمٌ يُفعَّل» بغياب الحقل في وحدة الحلقات.
 *
 * **وصفرُ صفٍّ شبكيٍّ يخرج**: `PublicEnrollReceipt` **ثلاثةُ حقولٍ لا رابع** — لا اسمَ مسجدٍ
 * ولا عنوانَ مسابقةٍ ولا معرّفَ كيانٍ ولا عدد. والسببُ **رمزٌ مصنَّف** لا بيانٌ عن الشبكة:
 * يكفي المتقدّمَ ليصحّح طلبَه، ولا يكفي آلةً لتستخرج به خريطةَ الشبكة.
 *
 * **وضوابطُ ق-٣٢ تعيش هنا** لأنها **حرزُ الباب** لا منطقَ الالتحاق:
 *  - **الفخُّ يبتلع صامتاً**: إيصالٌ مقبولٌ ظاهراً و**صفرُ صفٍّ يُكتب** — فالصمتُ شرطُ
 *    فاعليته، والرفضُ المعلن **يعلّم الآلة** أن تتجنّبه.
 *  - **سقفُ الهاتف عدٌّ مفهرَسٌ لا استعلامُ قائمة**، ولا يخرج عددُه في الإيصال.
 *  - **المفتاحُ العامُّ يُغلق البابَ كلَّه** (ب-٤٤) قبل أيّ عملٍ آخر.
 */

import type { CompetitionStore } from "../data/store.js"
import type { CompetitionContext } from "./context.js"
import { booleanSetting, numberSetting } from "./shared.js"
import { submitPublicEnrollment, type PublicEnrollmentInput } from "./enrollment.js"
import type { CompetitionErrorCode } from "../types.js"

/** مفتاحُ التفعيل المسجَّل — **ب-٤٤**، مطفأٌ افتراضاً (`SPEC_settings` مجال `feature`). */
const PUBLIC_REGISTRATION_FLAG = "feature.competition_public_registration"

export type PublicEnrollRequest = PublicEnrollmentInput & {
  /** **فخٌّ صامت**: حقلٌ لا يراه إنسانٌ — فمن ملأه آلةٌ (ق-٣٢). */
  readonly trapField?: string
}

/**
 * **الإيصال — ثلاثةُ حقولٍ لا رابع**. وهو كلُّ ما يخرج من المسار العامّ إلى العالم:
 * قبولٌ من عدمه · رمزُ متابعةٍ يتابع به بلا حساب · سببٌ **مصنَّفٌ** يصحّح به طلبَه.
 */
export type PublicEnrollReceipt = {
  readonly accepted: boolean
  readonly followUpCode: string | null
  readonly reason: CompetitionErrorCode | null
}

export type PublicEnrollPort = {
  readonly submit: (ctx: CompetitionContext, request: PublicEnrollRequest) => PublicEnrollReceipt
}

function rejected(reason: CompetitionErrorCode): PublicEnrollReceipt {
  return { accepted: false, followUpCode: null, reason }
}

/**
 * **المنفذُ**: كائنٌ بمِقبضٍ واحد. وما لا مِقبضَ له **لا يُستدعى** — وهذا هو الفرق بين
 * «حارسٍ يمنع القراءة» و«قراءةٍ لا سبيل إليها».
 */
export function makePublicEnrollPort(store: CompetitionStore): PublicEnrollPort {
  return Object.freeze({
    submit(ctx: CompetitionContext, request: PublicEnrollRequest): PublicEnrollReceipt {
      // ١) **المفتاحُ العامّ** — مطفأٌ ⇒ البابُ مغلقٌ قبل أيّ عملٍ آخر (ب-٤٤).
      if (!ctx.isFeatureEnabled(PUBLIC_REGISTRATION_FLAG)) {
        return rejected("PUBLIC_REGISTRATION_DISABLED")
      }

      // ٢) **الفخُّ الصامت** — يُبتلع الطلبُ بإيصالٍ مقبولٍ ظاهراً و**صفرِ صفٍّ يُكتب**.
      const honeypotOn = booleanSetting(ctx, "identity.registration.honeypot_enabled", "/")
      if (honeypotOn && (request.trapField ?? "").trim().length > 0) {
        return { accepted: true, followUpCode: store.nextId("fu"), reason: null }
      }

      // ٣) **سقفُ الهاتف** (ق-٣٢ نفسُه — لا رقمٌ ثانٍ للمسابقة): عدٌّ مفهرَسٌ لا يخرج.
      const maxPerPhone = numberSetting(ctx, "identity.registration.max_pending_per_phone", "/")
      if (store.pendingCountForPhone(request.phone) >= maxPerPhone) {
        return rejected("PHONE_QUOTA_EXCEEDED")
      }

      // ٤) **كتابةُ الكيان الواحد المعلَّق** — ولا شيءَ سواه.
      const done = submitPublicEnrollment(store, ctx, request)
      if (!done.ok) return rejected(done.error.code)
      return { accepted: true, followUpCode: done.value.followUpCode, reason: null }
    },
  })
}
