/**
 * ق-٦٩ — **السلفةُ ذمّةٌ مدينة تُسترد آلياً من الراتب** (عقدُ الوحدة §٦).
 *
 * أربعةُ ثوابتٍ، كلٌّ يقتل خطأً محاسبياً موثّقاً:
 *  ١. **ذمّةٌ لا مصروف**: مدينُ الذمم المدينة / دائنُ النقد — **صافي الأصول ثابتٌ عند المنح**.
 *     (لو رُحِّلت مصروفاً لَظهر النظامُ فقيراً بمقدار سلفةٍ ستعود — وهو تشويهٌ للقوائم الثلاث.)
 *  ٢. **الاستردادُ آليّ ولا يُجوّع**: `net = gross − القسط` **و`net ≥ ٠` دائماً** — فالقسطُ
 *     يُقتطع **بما لا يتجاوز الإجماليّ**، ولا يخرج الموظفُ مديناً بشهرٍ عمله.
 *  ٣. **آخرُ قسطٍ الباقي فقط** — لا القسطُ الكامل: فلا يُستردّ فوقَ الأصل قرشٌ واحد.
 *  ٤. **القسطُ الأكبر من الأصل يُرفض** عند المنح — عقدٌ مختلٌّ لا يُقبل ثم يُصحَّح.
 *
 * **وهي الخصمُ الوحيدُ في النظام** (ب-٣١/ق-٣٤): تسويةٌ محاسبية مشتقّةٌ من عقد السلفة —
 * **لا بابَ يدويٌّ لمبلغ خصم**، فبقيت ب-٣١ محقَّقةً بلا نقضِ ق-٥٢.
 */

import { postEvent } from "../../ledger/services/posting.js";
import { ZERO_CENTS, cents } from "../../ledger/services/money.js";
import type { Cents } from "../../ledger/types.js";
import { atomically, type PayrollStores } from "../data/store.js";
import type { PayrollContext } from "./context.js";
import { baseCurrency } from "./rates.js";
import {
  payrollErr,
  payrollOk,
  type Advance,
  type PayrollResult,
} from "../types.js";

export type GrantAdvanceInput = {
  readonly personId: string;
  readonly unitId: string;
  /** معرّفُ العملية في وحدتها — **مفتاحُ التكرار الطبيعيّ** لا رقمٌ عشوائيّ (ق-٥٠). */
  readonly operationId: string;
  readonly principalCents: Cents;
  readonly instalmentCents: Cents;
  readonly memoAr: string;
};

/**
 * **منحُ السلفة** — قيدٌ واحد: مدينُ الذمم / دائنُ النقد. والذرّيةُ **عابرةٌ للمستودعين**:
 * فلا سجلُّ سلفةٍ بلا قيدها ولا قيدٌ بلا سجلّه.
 */
export function grantAdvance(
  stores: PayrollStores,
  ctx: PayrollContext,
  input: GrantAdvanceInput,
): PayrollResult<Advance> {
  const unit = stores.ledger.getUnit(input.unitId);
  if (unit === null) return payrollErr("UNKNOWN_PAYROLL_UNIT", input.unitId);

  const principal = cents(input.principalCents);
  if (!principal.ok) return { ok: false, error: principal.error };
  const instalment = cents(input.instalmentCents);
  if (!instalment.ok) return { ok: false, error: instalment.error };
  if (principal.value <= 0)
    return payrollErr("NEGATIVE_AMOUNT", String(principal.value));
  if (instalment.value <= 0)
    return payrollErr("NEGATIVE_AMOUNT", String(instalment.value));
  // ق-٦٩ نصاً: القسطُ الأكبر من الأصل **يُرفض** — عقدٌ مختلٌّ لا يُقبل ابتداءً.
  if (instalment.value > principal.value) {
    return payrollErr("INSTALMENT_EXCEEDS_PRINCIPAL", String(instalment.value));
  }

  const currency = baseCurrency(ctx, unit.path);
  const common = { unitId: input.unitId, currency, amount: principal.value };

  return atomically(stores, () => {
    const posted = postEvent(stores.ledger, ctx, {
      sourceType: "payroll",
      sourceId: input.operationId,
      at: ctx.now,
      unitId: input.unitId,
      memoAr: input.memoAr,
      lines: [
        // **أصلٌ يحلّ محلَّ أصل** — فصافي الأصول ثابت (وهو ما يُبرهن بالسنت في اختباره).
        { accountId: ctx.accounts.staffReceivable, side: "debit", ...common },
        { accountId: ctx.accounts.cash, side: "credit", ...common },
      ],
    });
    if (!posted.ok) return { ok: false as const, error: posted.error };

    const advance: Advance = {
      tenantId: stores.payroll.tenantId,
      id: stores.payroll.nextId("adv"),
      personId: input.personId,
      unitPath: unit.path,
      entryId: posted.value.entry.id,
      principalCents: principal.value,
      instalmentCents: instalment.value,
      grantedAt: ctx.now,
      closedAt: null,
    };
    stores.payroll.saveAdvance(advance);
    stores.ledger.audit.append({
      at: ctx.now,
      actorPersonId: ctx.actorPersonId,
      action: "payroll.advance.grant",
      unitPath: advance.unitPath,
      capability: null,
      targetType: "payrollAdvance",
      targetId: advance.id,
      reason: null,
    });
    return payrollOk(stores.payroll.getAdvance(advance.id)!);
  });
}

/** المتبقي على سلفةٍ — **اشتقاقٌ من أقساطها**، لا حقلٌ يُنقَص (ق-٦٠ روحاً). */
export function outstandingOf(stores: PayrollStores, advanceId: string): Cents {
  const advance = stores.payroll.getAdvance(advanceId);
  if (advance === null) return ZERO_CENTS;
  const recovered = stores.payroll
    .instalmentsOf(advanceId)
    .reduce<number>((sum, i) => sum + i.amountCents, 0);
  return Math.max(advance.principalCents - recovered, 0) as Cents;
}

/**
 * **القسطُ المستحقُّ على راتبٍ بإجماليٍّ معلوم** — ثلاثةُ حدودٍ يغلب أصغرُها:
 * القسطُ المتفق عليه · **المتبقي** (فآخرُ قسطٍ الباقي فقط) · **الإجماليُّ نفسُه** (فـ`net ≥ ٠`).
 * وسلفةٌ واحدةٌ في الشهر — **الأقدمُ أولاً** حتماً (ترتيبٌ بالمعرّف المتتابع).
 */
export function dueInstalmentFor(
  stores: PayrollStores,
  personId: string,
  grossCents: Cents,
): { readonly advanceId: string; readonly amountCents: Cents } | null {
  if (grossCents <= 0) return null;
  const advance = stores.payroll.openAdvancesOf(personId)[0];
  if (advance === undefined) return null;

  const outstanding = outstandingOf(stores, advance.id);
  if (outstanding <= 0) return null;

  const due = Math.min(advance.instalmentCents, outstanding, grossCents);
  return due <= 0 ? null : { advanceId: advance.id, amountCents: due as Cents };
}

/**
 * تسجيلُ قسطٍ استُرد **داخل معاملة الصرف** — واقعةٌ التُزمت ومعها قيدُها.
 * **والإقفالُ عند الصفر حالةٌ لا حذف** (المادة ٧/٤): السلفةُ تبقى في السجل مختومةً بتاريخها.
 */
export function recordInstalment(
  stores: PayrollStores,
  ctx: PayrollContext,
  input: {
    readonly advanceId: string;
    readonly periodId: string;
    readonly entryId: string;
    readonly amountCents: Cents;
  },
): void {
  stores.payroll.appendInstalment({
    tenantId: stores.payroll.tenantId,
    id: stores.payroll.nextId("ins"),
    advanceId: input.advanceId,
    periodId: input.periodId,
    entryId: input.entryId,
    amountCents: input.amountCents,
  });

  const advance = stores.payroll.getAdvance(input.advanceId);
  if (advance !== null && outstandingOf(stores, input.advanceId) <= 0) {
    stores.payroll.saveAdvance({ ...advance, closedAt: ctx.now });
  }
}
