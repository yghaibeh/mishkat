/**
 * ق-٦٧ — **الإقفالُ الدوريّ: المستهلكُ البرهانيّ للمحرّك** (عقدُ الوحدة §٠/§٦).
 *
 * ما وقف عنده T8 يُغلق هنا: الأمينُ يرفع، والأقربُ يعتمد — **بلا سطرِ اعتمادٍ في وحدة
 * الصندوق**. والتقريرُ **يُشتقّ من الدفتر** لا يُدخله المقدِّم (ق-٦٧ نصاً).
 */
import { describe, it, expect } from "vitest"
import { ApprovalStore } from "../../../src/features/approval/data/store.js"
import {
  approveRequest,
  rejectRequest,
  retractSubmission,
  submitForApproval,
} from "../../../src/features/approval/services/engine.js"
import { boxClosingPayloadSource } from "../../../src/features/approval/registered/boxClosing.js"
import { receiveIntoBox, spendFromBox } from "../../../src/features/box/services/operations.js"
import { handoverDown } from "../../../src/features/box/services/handover.js"
import { boxContext } from "../box/_seed.js"
import {
  HOMS_APPROVERS,
  PERIOD,
  SQ2_PATH,
  approvalContext,
  c,
  seedApprovalStores,
} from "./_seed.js"

const TYPE = "box.closing"

/** عالمٌ ماليٌّ صغيرٌ في صندوق المربع: قُبض ٥٠٠ · صُرف ٢٠٠ · وُزّع نزولاً ١٠٠ ⇒ بقي ٢٠٠. */
function seedMoney(): ReturnType<typeof seedApprovalStores> {
  const stores = seedApprovalStores()
  const box = boxContext("u-square")
  receiveIntoBox(stores.box, box, {
    unitId: "sq2",
    operationId: "op-1",
    memoAr: "تبرعُ محسن",
    lines: [{ currency: "USD", amount: c(50_000) }],
  })
  spendFromBox(stores.box, box, {
    unitId: "sq2",
    operationId: "op-2",
    memoAr: "محروقاتُ الشهر",
    categoryId: "fuel",
    currency: "USD",
    amount: c(20_000),
  })
  handoverDown(stores.box, box, {
    fromUnitId: "sq2",
    toUnitId: "khalid",
    toCustodianPersonId: "u-amir",
    operationId: "op-3",
    memoAr: "تسليمٌ لمسجد خالد",
    currency: "USD",
    amount: c(10_000),
  })
  return stores
}

describe("ق-٦٧/١ — تقريرُ الإقفال **يتولّد من الدفتر** لا يُدخله المقدِّم", () => {
  it("أسطرُ العملات: قبضتُ · صرفتُ · وزّعتُ نزولاً · بقي — كلُّها اشتقاقٌ", () => {
    const stores = seedMoney()
    const payload = boxClosingPayloadSource(stores.box)(TYPE, SQ2_PATH, PERIOD)
    expect(payload).toEqual({
      unitPath: SQ2_PATH,
      periodId: PERIOD.id,
      lines: [{ currency: "USD", received: 50_000, spent: 20_000, distributed: 10_000, remaining: 20_000 }],
    })
  })

  it("**والعملاتُ أسطرٌ منفصلةٌ مرتَّبةٌ حتمياً** — لا جمعَ بينها (ق-٦٢)", () => {
    const stores = seedApprovalStores()
    receiveIntoBox(stores.box, boxContext("u-square"), {
      unitId: "sq2",
      operationId: "op-multi",
      memoAr: "تبرعٌ بعملتين",
      lines: [
        { currency: "TRY", amount: c(7_000) },
        { currency: "USD", amount: c(5_000) },
      ],
    })
    const payload = boxClosingPayloadSource(stores.box)(TYPE, SQ2_PATH, PERIOD)
    expect(payload.lines).toEqual([
      { currency: "TRY", received: 7_000, spent: 0, distributed: 0, remaining: 7_000 },
      { currency: "USD", received: 5_000, spent: 0, distributed: 0, remaining: 5_000 },
    ])
  })

  it("**وحركةُ ما بعد نهاية الفترة لا تدخل تقريرَها** — النافذةُ معلنةٌ لا ضمنية", () => {
    const stores = seedMoney()
    const early = { id: "1447-11", endsAt: new Date("2026-06-30T00:00:00.000Z") }
    const payload = boxClosingPayloadSource(stores.box)(TYPE, SQ2_PATH, early)
    expect(payload.lines).toEqual([])
  })

  it("ووحدةٌ بلا حركةٍ تُقفل بتقريرٍ **صفريٍّ ظاهر** لا بغيابٍ صامت (ق-١١٢)", () => {
    const stores = seedApprovalStores()
    const payload = boxClosingPayloadSource(stores.box)(TYPE, SQ2_PATH, PERIOD)
    expect(payload).toEqual({ unitPath: SQ2_PATH, periodId: PERIOD.id, lines: [] })
  })
})

describe("ق-٦٧/٢ — السلسلةُ كاملةً عبر المحرّك: تقديمٌ ⟵ الأقربُ ⟵ اعتمادٌ/رفض", () => {
  it("الأمينُ يرفع فيصل إلى **المربع وحده**، ويعتمده فيُقفل", () => {
    const stores = seedMoney()
    const s = new ApprovalStore("t-main")
    const submitted = submitForApproval(s, approvalContext("u-square", { stores }), {
      typeId: TYPE,
      unitPath: SQ2_PATH,
      period: PERIOD,
    })
    expect(submitted.ok).toBe(true)
    expect(s.notices()[0]?.recipients).toEqual([...HOMS_APPROVERS])

    const decided = approveRequest(s, approvalContext("u-rabita", { stores }), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(decided.ok && decided.value.state).toBe("approved")
    expect(decided.ok && decided.value.lockedAt).not.toBeNull()
    // والحمولةُ المحفوظةُ هي المشتقّةُ نفسُها — لا رقمٌ من المدخل.
    expect(decided.ok && decided.value.payload).toEqual({
      unitPath: SQ2_PATH,
      periodId: PERIOD.id,
      lines: [{ currency: "USD", received: 50_000, spent: 20_000, distributed: 10_000, remaining: 20_000 }],
    })
  })

  it("**ولا إقفالَ مرتين** لنفس الوحدة والفترة", () => {
    const stores = seedMoney()
    const s = new ApprovalStore("t-main")
    const first = submitForApproval(s, approvalContext("u-square", { stores }), {
      typeId: TYPE,
      unitPath: SQ2_PATH,
      period: PERIOD,
    })
    approveRequest(s, approvalContext("u-rabita", { stores }), {
      requestId: first.ok ? first.value.id : "",
    })
    const again = submitForApproval(s, approvalContext("u-square", { stores }), {
      typeId: TYPE,
      unitPath: SQ2_PATH,
      period: PERIOD,
    })
    expect(!again.ok && again.error.code).toBe("DUPLICATE_PERIOD")
  })

  it("والرفضُ بسببٍ يعيده مسودةً ويُشعر الأمين المقدِّم — نفسُ سلسلةِ التقارير مطبَّقةً على المال", () => {
    const stores = seedMoney()
    const s = new ApprovalStore("t-main")
    const submitted = submitForApproval(s, approvalContext("u-square", { stores }), {
      typeId: TYPE,
      unitPath: SQ2_PATH,
      period: PERIOD,
    })
    const rejected = rejectRequest(s, approvalContext("u-rabita", { stores }), {
      requestId: submitted.ok ? submitted.value.id : "",
      reasonAr: "صرفٌ بلا فئةٍ صحيحة",
    })
    expect(rejected.ok && rejected.value.state).toBe("draft")
    expect(s.notices().filter((n) => n.kind === "rejected")[0]?.recipients).toEqual(["u-square"])
  })

  it("**ولا سحبَ للإقفال**: النوعُ لا يعلن قدرةَ سحبٍ فلا يوجد المسارُ أصلاً (ب-٣٠ج للتقارير)", () => {
    const stores = seedMoney()
    const s = new ApprovalStore("t-main")
    const submitted = submitForApproval(s, approvalContext("u-square", { stores }), {
      typeId: TYPE,
      unitPath: SQ2_PATH,
      period: PERIOD,
    })
    const retracted = retractSubmission(s, approvalContext("u-square", { stores }), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(!retracted.ok && retracted.error.code).toBe("RETRACT_NOT_AVAILABLE")
  })
})

describe("«صفر منطق اعتمادٍ في وحدة الصندوق» — يُقاس بالمحتوى لا يُوعَد به", () => {
  it("مصدرُ وحدة الصندوق لا يستورد المحرّك ولا يذكر مفرداتِ الاعتماد", async () => {
    const { readdirSync, statSync, readFileSync } = await import("node:fs")
    const { join } = await import("node:path")
    const root = new URL("../../../src/features/box/", import.meta.url).pathname

    const files: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (full.endsWith(".ts")) files.push(full)
      }
    }
    walk(root)
    expect(files.length).toBeGreaterThan(0)

    const forbidden = [/features\/approval/, /approverLayer/, /breakGlass/, /submitForApproval/]
    for (const file of files) {
      const src = readFileSync(file, "utf8")
      for (const pattern of forbidden) {
        expect(pattern.test(src), `${file} ⟵ ${pattern}`).toBe(false)
      }
    }
  })
})
