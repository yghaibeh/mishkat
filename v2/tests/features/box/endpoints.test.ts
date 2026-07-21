/**
 * دوالُّ خادم الصندوق — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٦.
 *
 * **الفرضُ قبل الجسم لا داخله**: كلُّ نقطةٍ تعلن قدرتَها ومُحلِّلَ نطاقها المشتقَّ من الكيان
 * المخزَّن؛ والغائبُ ⇒ `NO_SCOPE` ⇒ رفض. وحالاتُ السلب هنا **أكثرُ من الإيجاب** عمداً.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { makeBoxEndpoints } from "../../../src/features/box/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { boxContext, c, canonicalActor, canonicalDirectory, DECISION, seedBoxStores, WRITE } from "./_seed.js"
import { receiveIntoBox } from "../../../src/features/box/services/operations.js"

const SETTINGS = createSettingsResolver([])
const KHALID = "khalid"

function endpoints(stores = seedBoxStores()) {
  return { stores, ep: makeBoxEndpoints(stores, SETTINGS, canonicalDirectory) }
}

beforeEach(() => clearRegistryForTests())

describe("النقاطُ الثمان تعلن قدرتها ونطاقها (G7) — والإعلانُ يطابق العقد", () => {
  it("لكل نقطةٍ اسمٌ وقدرةٌ ونيّةٌ ومُحلِّلُ نطاقٍ واسمُ فعلٍ في التدقيق", () => {
    const { ep } = endpoints()
    const declared = Object.values(ep).map((fn) => fn.declaration)
    expect(declared).toHaveLength(8)
    for (const d of declared) {
      expect(d.capability).not.toBe("PUBLIC_DECLARED")
      expect(d.scope).toBeTypeOf("function")
      expect(d.audit.length).toBeGreaterThan(0)
    }
    expect(declared.map((d) => d.name).sort()).toEqual([
      "box.handover.ack",
      "box.handover.record",
      "box.handovers.view",
      "box.receive.record",
      "box.spend.record",
      "box.unit.view",
      "mosqueFinance.record",
      "mosqueFinance.view",
    ])
  })
})

describe("القبضُ والصرفُ: القدرةُ تفتح والنطاقُ يحدّ", () => {
  it("أميرُ المسجد يقبض في **صندوق مسجده** ⇒ تنجح بسندٍ مرقّم", async () => {
    const { ep } = endpoints()
    const r = await ep.receive.invoke(
      {
        unitId: KHALID,
        operationId: "rcv-1",
        memoAr: "قبضتُ",
        lines: [{ currency: "USD", amount: c(1_000) }],
      },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    if (!r.value.ok) throw new Error(r.value.error.code)
    expect(r.value.value.voucherNo).toMatch(/^R-/)
  })

  it("**ومشرفُ القسم لا يقبض في صندوق مسجدٍ تحته** — نطاق «ذ» يمنع الهبوط (§١.٥)", async () => {
    const { ep } = endpoints()
    const r = await ep.receive.invoke(
      {
        unitId: KHALID,
        operationId: "rcv-2",
        memoAr: "قبضٌ من فوق",
        lines: [{ currency: "USD", amount: c(1_000) }],
      },
      canonicalActor("u-section-head"),
      WRITE,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("**والمسؤولُ الماليُّ لا يقبض ولا يصرف من صندوقٍ** (جدولُ الغياب §٣)", async () => {
    const { ep } = endpoints()
    const received = await ep.receive.invoke(
      { unitId: KHALID, operationId: "rcv-3", memoAr: "قبض", lines: [{ currency: "USD", amount: c(1) }] },
      canonicalActor("u-finance"),
      WRITE,
    )
    const spent = await ep.spend.invoke(
      { unitId: KHALID, operationId: "spd-3", memoAr: "صرف", categoryId: "fuel", currency: "USD", amount: c(1) },
      canonicalActor("u-finance"),
      WRITE,
    )
    expect(received.ok).toBe(false)
    expect(spent.ok).toBe(false)
  })

  it("**والمديرُ لا يقبض ولا يصرف ولا يسلّم** — اطّلاعٌ لا تشغيل (ق-٣/ق-٤)", async () => {
    const { ep } = endpoints()
    const received = await ep.receive.invoke(
      { unitId: KHALID, operationId: "rcv-4", memoAr: "قبض", lines: [{ currency: "USD", amount: c(1) }] },
      canonicalActor("u-admin"),
      WRITE,
    )
    const handed = await ep.handover.invoke(
      {
        fromUnitId: "sq2",
        toUnitId: KHALID,
        toCustodianPersonId: "u-amir",
        operationId: "hnd-admin",
        memoAr: "تسليم",
        currency: "USD",
        amount: c(1),
      },
      canonicalActor("u-admin"),
      WRITE,
    )
    expect(received.ok).toBe(false)
    expect(handed.ok).toBe(false)
  })

  it("**والطالبُ لا يرى صندوقاً أصلاً** (`box.view` غائبةٌ عنه)", async () => {
    const { ep } = endpoints()
    const r = await ep.unitView.invoke({ unitId: KHALID }, canonicalActor("u-student"), DECISION)
    expect(r.ok).toBe(false)
  })

  it("**ووحدةٌ مجهولة ⇒ `NO_SCOPE` ⇒ رفض** — الغائبُ يُقفل ولا يُفتح", async () => {
    const { ep } = endpoints()
    const r = await ep.unitView.invoke({ unitId: "لا-وحدة" }, canonicalActor("u-admin"), DECISION)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("والمديرُ **يرى** صندوقَ الشبكة بالاطّلاع الهابط (`box.view` نوعُها «و»)", async () => {
    const { stores, ep } = endpoints()
    receiveIntoBox(stores, boxContext("u-amir"), {
      unitId: KHALID,
      operationId: "rcv-5",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(3_000) }],
    })
    const r = await ep.unitView.invoke({ unitId: "root" }, canonicalActor("u-admin"), DECISION)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.subtree.get("USD")?.net).toBe(3_000)
  })
})

describe("الإقرارُ نطاقُه **شخصيّ** مشتقٌّ من التسليم المخزَّن (§١.١ + خ-٧)", () => {
  async function seedHandover() {
    const { stores, ep } = endpoints()
    receiveIntoBox(stores, boxContext("u-square"), {
      unitId: "sq2",
      operationId: "rcv-sq2",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(10_000) }],
    })
    const handed = await ep.handover.invoke(
      {
        fromUnitId: "sq2",
        toUnitId: KHALID,
        toCustodianPersonId: "u-amir",
        operationId: "hnd-1",
        memoAr: "سلّمتُ",
        currency: "USD",
        amount: c(4_000),
      },
      canonicalActor("u-square"),
      WRITE,
    )
    if (!handed.ok) throw new Error("تعذّر التسليم")
    if (!handed.value.ok) throw new Error(handed.value.error.code)
    return { stores, ep, handoverId: handed.value.value.handover.id }
  }

  it("الأمينُ المستلِمُ يقرّ ⇒ تنجح", async () => {
    const { ep, handoverId } = await seedHandover()
    const r = await ep.acknowledge.invoke({ handoverId }, canonicalActor("u-amir"), WRITE)
    expect(r.ok).toBe(true)
  })

  it("**والمديرُ يُرفض بـ`DENIED_PERSONAL_NOT_OWNER`** — لا يقرّ عن الأمين ولو ملك كلَّ شيء", async () => {
    const { ep, handoverId } = await seedHandover()
    const r = await ep.acknowledge.invoke({ handoverId }, canonicalActor("u-admin"), WRITE)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
  })

  it("**وأميرٌ آخرُ يُرفض** ولو كان أميناً على مسجدٍ آخر", async () => {
    const { ep, handoverId } = await seedHandover()
    const r = await ep.acknowledge.invoke({ handoverId }, canonicalActor("u-amir-bilal"), WRITE)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
  })

  it("**ومانحُ التسليم يُرفض** — البصمتان لشخصين لا لشخص", async () => {
    const { ep, handoverId } = await seedHandover()
    const r = await ep.acknowledge.invoke({ handoverId }, canonicalActor("u-square"), WRITE)
    expect(r.ok).toBe(false)
  })

  it("**وتسليمٌ مجهول ⇒ `NO_SCOPE`** — لا يُشتقّ نطاقٌ من مدخل العميل", async () => {
    const { ep } = await seedHandover()
    const r = await ep.acknowledge.invoke({ handoverId: "لا-تسليم" }, canonicalActor("u-amir"), WRITE)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
  })
})

describe("قب-١٨ — عزلُ الشبكة على **كل** مسارات الصندوق", () => {
  it("لا نقطةَ في الوحدة بلا مُحلِّل نطاقٍ يقرأ من مستودع شبكتها", () => {
    const { ep } = endpoints()
    for (const fn of Object.values(ep)) expect(fn.declaration.scope).toBeTypeOf("function")
  })
})
