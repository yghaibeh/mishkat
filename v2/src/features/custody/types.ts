/**
 * أنواعُ العُهد والأصول — عقدُ الوحدة `features/custody/SPEC.md`.
 *
 * **ثابتٌ واحدٌ يُفرَض هنا بالنوع قبل أيّ سطرِ منطق، ومنه تتفرّع كلُّ قواعد ق-٧٨…ق-٨٣**:
 *
 * > **لا حقلَ حائزٍ ولا حقلَ حالةٍ في أيّ كيانٍ مخزَّن.**
 *
 * في v1 كان الحائزُ حقلاً يُكتب، فصارت العهدةُ تقع على رقبتك بلا علمك، وإذا تبدّل ضاع
 * التاريخ («سجلُّ أصولٍ لا نظامُ عُهد» — ق-٧٨)، وتناقض «بعهدة فلان» مع «في الوحدة» في
 * السطر نفسه (ق-٨٠). وفي v2 **الحائزُ والحالةُ اشتقاقان** من `CustodyMove` — فلا يوجد ما
 * يُحرَّر، ولا يمكن أن يوجد بابٌ ثانٍ. (نظيرُ ق-٦٠ «صفر رصيدٍ مخزَّن» في الصندوق.)
 *
 * **ملاحظةُ تصميمٍ محروسةٌ باختبار**: `tests/features/custody/single-path.test.ts` يمسح هذا
 * الملفّ ومستودعَ الوحدة فيفشل عند أوّل حقلِ حيازةٍ يُخزَّن — الادّعاءُ يُقاس بالمحتوى.
 */

/** إسقاطُ الوحدة التنظيمية للقراءة — موطنُها `org`، وهذه نسخةُ نطاقٍ لا مصدرُ حقيقة. */
export type CustodyUnit = {
  readonly tenantId: string
  readonly id: string
  readonly path: string
}

/**
 * الأصلُ: **سجلٌّ وصفيٌّ في وحدةٍ تنظيمية**. موطنُه التنظيميّ لا يتحرّك بالحيازة (ق-٨٠:
 * «الإعادةُ تفرّغ اليدَ وتُبقي الأصلَ في وحدته»)، وليس فيه حائزٌ ولا حالة.
 */
export type Asset = {
  readonly tenantId: string
  readonly id: string
  readonly unitPath: string
  readonly labelAr: string
  readonly serialAr: string | null
  readonly noteAr: string | null
  readonly registeredBy: string
  readonly registeredAt: Date
}

/**
 * أنواعُ حركات السلسلة (ق-٧٨ نصّاً) — **والنوعُ يُشتقّ لا يُملى**: الأولى «تسليم» وما
 * بعدها «نقلُ عهدة»، فلا يستطيع أحدٌ أن يسمّي نقلاً تسليماً أوّلَ فيطمس سابقَه.
 */
export type CustodyMoveKind =
  | "handover"
  | "transfer"
  | "return"
  | "damage"
  | "loss"
  | "decommission"

/** ما يطلبه المدخل: فعلٌ واحدٌ من خمسة — و«تسليم/نقل» فعلٌ واحدٌ (`hand`) تُسمّيه الخدمة. */
export type CustodyAction = "hand" | "return" | "damage" | "loss" | "decommission"

/**
 * حدثُ السلسلة — **لا يُمحى ولا يُكتب فوقه**؛ الحقلان الوحيدان اللذان يُختمان بعد الإنشاء
 * هما بصمةُ الإقرار (ق-٧٩)، ولها كاتبٌ واحدٌ ضيّقٌ في المستودع (`stampReceipt`).
 */
export type CustodyMove = {
  readonly tenantId: string
  readonly id: string
  readonly assetId: string
  /** ترتيبٌ حتميٌّ متتابعٌ داخل سلسلة الأصل — أساسُ «الأولى تسليمٌ وما بعدها نقل». */
  readonly seq: number
  readonly kind: CustodyMoveKind
  readonly fromPersonId: string | null
  readonly toPersonId: string | null
  /** «بأيّ حال» من ق-٧٨ — إلزاميّ في كل حركة. */
  readonly conditionAr: string
  readonly noteAr: string | null
  readonly at: Date
  /** «ومن نفّذه» — من الجلسة لا من المدخل. */
  readonly byPersonId: string
  readonly acknowledgedBy: string | null
  readonly acknowledgedAt: Date | null
}

/**
 * > **الحالةُ والحائزُ ليسا هنا عمداً.** موطنُهما `services/derive.ts` لأنّهما **مخرجُ
 * > اشتقاقٍ لا كيانٌ مخزَّن** (ق-٨٠). وهذا الفصلُ ليس ترتيباً جمالياً: الحارسُ المحتوائيّ
 * > في `single-path.test.ts` يمسح **هذا الملفّ ومجلدَ `data/`** فيفشل عند أوّل `readonly
 * > holder…` أو `readonly status…` — فلو عاشا هنا لَما أمكن قياسُ الادّعاء أصلاً.
 */

/**
 * > **وقيدُ التدقيق ليس هنا عمداً** (CR-027/قب-٤٩). كان في هذا الملفّ `CustodyAuditRecord`
 * > **أضيقُ من العقد المعلن** `AuditEntry` — وذلك **مصدرا حقيقةٍ لشيءٍ واحد** (المادة ١/٢)،
 * > وأثرُه أن قيدَ حدثٍ في مسجدٍ لا يظهر في تدقيق ذلك المسجد. فأُلغي السجلُّ المحليُّ ووُحِّد
 * > على `src/audit/journal.ts`، و**ق-٨٣ لم يُنقص حرفاً**: «قبل/بعد» حقلان في العقد نفسِه
 * > (`AuditPayload`)، وعمودان في `audit_log` منذ الهجرة الأولى.
 */

/** رمزُ خطأٍ خاصٌّ بهذه الوحدة — §٩ من عقد الوحدة. */
export type CustodyErrorCode =
  | "UNKNOWN_ASSET"
  | "UNKNOWN_CUSTODY_UNIT"
  | "EMPTY_ASSET_LABEL"
  | "FIELD_NOT_EDITABLE"
  | "RECIPIENT_OUT_OF_SCOPE"
  | "SAME_HOLDER"
  | "NO_CURRENT_HOLDER"
  | "ASSET_CLOSED"
  | "MOVE_NOT_FOUND"
  | "NOT_RECEIVING_HOLDER"
  | "ALREADY_ACKNOWLEDGED"
  | "MOVE_SUPERSEDED"
  | "NOT_ACKNOWLEDGEABLE"

export type CustodyError = {
  readonly code: CustodyErrorCode
  readonly detail?: string
}

export type CustodyOk<T> = { readonly ok: true; readonly value: T }
export type CustodyErr = { readonly ok: false; readonly error: CustodyError }
export type CustodyResult<T> = CustodyOk<T> | CustodyErr

export function custodyOk<T>(value: T): CustodyOk<T> {
  return { ok: true, value }
}

export function custodyErr(code: CustodyErrorCode, detail?: string): CustodyErr {
  return detail === undefined
    ? { ok: false, error: { code } }
    : { ok: false, error: { code, detail } }
}
