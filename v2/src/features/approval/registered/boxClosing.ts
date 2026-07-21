/**
 * ق-٦٧ — **الإقفالُ الدوريّ للصندوق: نوعُ اعتمادٍ مسجَّلٌ في المحرّك** (عقدُ الوحدة §٠/§٦).
 *
 * هنا يُغلق ما وقف عنده T8 (قب-٢٨): «الأمينُ يرفع والطبقةُ الأقربُ تعتمد» صار **سطرَ إعلانٍ**
 * لا وحدةَ منطقٍ ثانية. ولذلك **لم يُمسّ سطرٌ واحدٌ في وحدة الصندوق**: هذا الملفّ يعيش في
 * مجلد المحرّك، ويستهلك من الصندوق **دوالَّ اشتقاقٍ قائمة** لا مفاهيمَ اعتماد.
 *
 * **والتقريرُ يتولّد من الدفتر** (ق-٦٧ نصاً) لا يُدخله المقدِّم: استلمتُ · صرفتُ · وزّعتُ
 * نزولاً · بقي — **بأسطر العملات المنفصلة** (ق-٦٢)، و**صفر رصيدٍ مخزَّن** (ق-٦٠).
 *
 * **نافذةُ التقرير**: كلُّ حركةٍ **حتى نهاية الفترة**؛ وحدُّ بدايتها يُضاف يوم يُسجَّل تقويمُ
 * الإقفال (`finance.closing.period`) في مهمّته — **معلنٌ هنا لا صامتٌ في الكود**.
 */

import { ACCOUNT_ROLES } from "../../ledger/services/simpleFace.js"
import type { BoxStores } from "../../box/data/store.js"
import { defineApprovalType } from "../registry.js"
import type { ApprovalPayloadSource } from "../services/engine.js"

/** النوعُ **بيانٌ يُعلن**: كيانُه وقدرتاه وشرطا تقديمه وأثرا بتّه (عقدُ الوحدة §٧). */
export const BOX_CLOSING = defineApprovalType({
  id: "box.closing",
  entityAr: "الإقفالُ الدوريّ للصندوق",
  scopeKind: "unit",
  // «ذ» — الوحدةُ بعينها تقفل صندوقَها، فلا يقفل مشرفٌ عن وحدةٍ تحته (ق-٩).
  submitCapability: "box.closing.submit",
  // «ف» — عملُ مَن تحت؛ والأقربيّةُ يحسمها المحرّك بعد القدرة (ق-١).
  approveCapability: "box.closing.approve",
  // لا تدخّلَ فوقياً ولا سحبَ للإقفال: لا قدرةَ لهما في الكتالوج ⇒ **لا مسارَ أصلاً**.
  overrideCapability: null,
  retractCapability: null,
  uniquePerPeriod: true,
  payloadRequired: true,
  approvalLocks: true,
  rejectionReturnsToDraft: true,
  rejectionRequiresReason: true,
})

/** سطرُ عملةٍ في تقرير العهدة — **أرقامٌ مشتقّةٌ** لا حقولٌ مخزَّنة (ق-٦٠). */
export type ClosingLine = {
  readonly currency: string
  readonly received: number
  readonly spent: number
  readonly distributed: number
  readonly remaining: number
}

type Totals = { received: number; spent: number; distributed: number }

/**
 * مُولِّدُ الحمولة — يُحقن في سياق الطلب فيبقى المحرّكُ **عامّاً لا يعرف صندوقاً**.
 * والقياسُ على **أسطر النقد** حصراً: هي حركةُ مال الصندوق الفعليّة (نفسُ قاعدة `boxBalances`).
 */
export function boxClosingPayloadSource(stores: BoxStores): ApprovalPayloadSource {
  return (typeId, unitPath, period) => {
    // التسليماتُ النازلةُ من هذه الوحدة: قيودُها هي «وزّعتُ نزولاً» تمييزاً لها عن الصرف.
    const distributedEntries = new Set(
      stores.box
        .handovers()
        .filter((h) => h.fromUnitPath === unitPath)
        .map((h) => h.entryId),
    )
    const withinPeriod = new Set(
      stores.ledger
        .entries()
        .filter((e) => e.at.getTime() <= period.endsAt.getTime())
        .map((e) => e.id),
    )

    const totals = new Map<string, Totals>()
    for (const line of stores.ledger.lines()) {
      if (line.accountId !== ACCOUNT_ROLES.cash) continue
      if (line.unitPath !== unitPath) continue
      if (!withinPeriod.has(line.entryId)) continue
      const t = totals.get(line.currency) ?? { received: 0, spent: 0, distributed: 0 }
      if (line.debit > 0) t.received += line.debit
      else if (distributedEntries.has(line.entryId)) t.distributed += line.credit
      else t.spent += line.credit
      totals.set(line.currency, t)
    }

    const lines: ClosingLine[] = [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, t]) => ({
        currency,
        received: t.received,
        spent: t.spent,
        distributed: t.distributed,
        // **بقي** اشتقاقٌ من الثلاثة لا حقلٌ يُقرأ (ق-٦٠).
        remaining: t.received - t.spent - t.distributed,
      }))

    void typeId
    return { unitPath, periodId: period.id, lines }
  }
}
