/**
 * حرّاسُ الحواف — ما يُنسى عادةً فيصير ثغرةً: الأمينُ المجهول · التأريخُ المقفل ·
 * «ما ينتظر إقراري» · عزلُ سجلّ الشبكات · وأسبابُ الخطأ التي تصل كما هي.
 */
import { describe, it, expect } from "vitest"
import { BoxTenantRegistry } from "../../../src/features/box/data/tenant.js"
import { makeCustodyCheck } from "../../../src/features/box/services/custodian.js"
import { handoverDown } from "../../../src/features/box/services/handover.js"
import { receiveIntoBox } from "../../../src/features/box/services/operations.js"
import { recordMosqueFinance } from "../../../src/features/box/services/mosqueFinance.js"
import { myPendingHandovers, unitBoxView } from "../../../src/features/box/services/boxViews.js"
import { boxFlow, subtreeBoxBalances } from "../../../src/features/box/services/boxBalances.js"
import { boxErr } from "../../../src/features/box/types.js"
import {
  boxContext,
  c,
  canonicalDirectory,
  DECISION,
  MAIN_TENANT_ID,
  NOW,
  SECOND_TENANT_ID,
  seedBoxStores,
} from "./_seed.js"

const KHALID = "khalid"
const SQ2_PATH = "/men/homs/sq2/"

describe("ق-٥٩ — سؤالُ الأمانة يُجيبه المحرّك، والمجهولُ ليس أميناً", () => {
  it("شخصٌ ليس في دليل الفاعلين ⇒ **ليس أميناً** (لا يُصطنع أمينٌ من مجهول)", () => {
    const custody = makeCustodyCheck(canonicalDirectory, DECISION)
    expect(custody("لا-أحد", "/men/homs/sq2/khalid/")).toBe(false)
  })

  it("والأميرُ أمينُ مسجده، **والمعلّمُ ليس أميناً** ولو كان له تكليفٌ في المسجد", () => {
    const custody = makeCustodyCheck(canonicalDirectory, DECISION)
    expect(custody("u-amir", "/men/homs/sq2/khalid/")).toBe(true)
    expect(custody("u-teacher", "/men/homs/sq2/khalid/")).toBe(false)
    expect(custody("u-admin", "/men/homs/sq2/khalid/")).toBe(false)
  })

  it("**ومشرفُ القسم أمينُ صندوق قسمه ولا يهبط** أميناً لمسجدٍ تحته (نطاق «ذ»)", () => {
    const custody = makeCustodyCheck(canonicalDirectory, DECISION)
    expect(custody("u-section-head", "/men/")).toBe(true)
    expect(custody("u-section-head", "/men/homs/sq2/khalid/")).toBe(false)
  })
})

describe("الوحدةُ المجهولة تُقفل ولا تُفتح — في الطرفين معاً", () => {
  it("مصدرٌ مجهول ⇒ `UNKNOWN_BOX_UNIT` ولا قيدَ ولا سجلَّ تسليم", () => {
    const stores = seedBoxStores()
    const r = handoverDown(stores, boxContext("u-square"), {
      fromUnitId: "لا-وحدة",
      toUnitId: KHALID,
      toCustodianPersonId: "u-amir",
      operationId: "hnd-x1",
      memoAr: "تسليمٌ من مجهول",
      currency: "USD",
      amount: c(100),
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("UNKNOWN_BOX_UNIT")
    expect(stores.ledger.entries()).toHaveLength(0)
  })

  it("**ووجهةٌ مجهولة ⇒ `UNKNOWN_BOX_UNIT`** — لا تسليمَ إلى العدم", () => {
    const stores = seedBoxStores()
    const r = handoverDown(stores, boxContext("u-square"), {
      fromUnitId: "sq2",
      toUnitId: "لا-وحدة",
      toCustodianPersonId: "u-amir",
      operationId: "hnd-x2",
      memoAr: "تسليمٌ إلى مجهول",
      currency: "USD",
      amount: c(100),
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("UNKNOWN_BOX_UNIT")
    expect(stores.box.handovers()).toHaveLength(0)
  })
})

describe("ب-٣٩د — القفلُ الزمنيّ يسري على مسارات الصندوق كما على النواة", () => {
  const LOCKED_AT = new Date("2026-01-01T00:00:00.000Z")

  it("قبضٌ بتاريخٍ أقدمَ من مدة القفل ⇒ `PERIOD_LOCKED` (والرقمُ إعدادٌ حيّ لا صلب)", () => {
    const stores = seedBoxStores()
    const r = receiveIntoBox(stores, boxContext("u-amir"), {
      unitId: KHALID,
      operationId: "rcv-old",
      memoAr: "قبضٌ رجعيٌّ مقفل",
      lines: [{ currency: "USD", amount: c(100) }],
      at: LOCKED_AT,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("PERIOD_LOCKED")
  })

  it("وتسليمٌ بتاريخٍ مقفل ⇒ مرفوضٌ **ولا سجلَّ تسليمٍ يبقى** (الذرّية عابرةٌ للمستودعين)", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, boxContext("u-square"), {
      unitId: "sq2",
      operationId: "rcv-1",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(9_000) }],
    })
    const r = handoverDown(stores, boxContext("u-square"), {
      fromUnitId: "sq2",
      toUnitId: KHALID,
      toCustodianPersonId: "u-amir",
      operationId: "hnd-old",
      memoAr: "تسليمٌ رجعيٌّ مقفل",
      currency: "USD",
      amount: c(100),
      at: LOCKED_AT,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("PERIOD_LOCKED")
    expect(stores.box.handovers()).toHaveLength(0)
  })

  it("وصرفُ مالية المسجد بتاريخٍ مقفل ⇒ مرفوضٌ كذلك — لا بابَ التفافٍ على القفل", () => {
    const stores = seedBoxStores()
    const r = recordMosqueFinance(stores, boxContext("u-amir"), {
      verb: "paid",
      unitId: KHALID,
      operationId: "mf-old",
      memoAr: "صرفٌ رجعيٌّ مقفل",
      categoryId: "fuel",
      currency: "USD",
      amount: c(100),
      at: LOCKED_AT,
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe("PERIOD_LOCKED")
  })

  it("**وبتاريخ اليوم يمرّ** — القفلُ يحرس الماضي لا الحاضر", () => {
    const stores = seedBoxStores()
    const r = recordMosqueFinance(stores, boxContext("u-amir"), {
      verb: "received",
      unitId: KHALID,
      operationId: "mf-now",
      memoAr: "قبضٌ اليوم",
      lines: [{ currency: "USD", amount: c(100) }],
      at: NOW,
    })
    expect(r.ok).toBe(true)
  })
})

describe("«ما ينتظر إقراري» بالملكية لا بالنطاق (§١.١)", () => {
  it("التسليمُ الوارد يظهر لأمينه وحده، ويختفي بعد إقراره", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, boxContext("u-square"), {
      unitId: "sq2",
      operationId: "rcv-1",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(9_000) }],
    })
    const done = handoverDown(stores, boxContext("u-square"), {
      fromUnitId: "sq2",
      toUnitId: KHALID,
      toCustodianPersonId: "u-amir",
      operationId: "hnd-1",
      memoAr: "سلّمتُ",
      currency: "USD",
      amount: c(1_000),
    })
    if (!done.ok) throw new Error(done.error.code)

    expect(myPendingHandovers(stores, "u-amir")).toHaveLength(1)
    expect(myPendingHandovers(stores, "u-square")).toHaveLength(0)
    // وسجلُّ الوحدة يعرض التسليمَ للطرفين (عرضٌ لا فعل).
    expect(unitBoxView(stores, SQ2_PATH).handovers).toHaveLength(1)
  })
})

describe("التجميعُ الهابط والصناديقُ الثلاثة عليه (ق-١٧)", () => {
  it("قبضُ المسجد يظهر في **الصناديق الثلاثة الهابطة** عند المربع فوقه", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, boxContext("u-amir"), {
      unitId: KHALID,
      operationId: "rcv-child",
      memoAr: "قبضتُ في المسجد",
      lines: [{ currency: "USD", amount: c(6_000) }],
    })
    expect(subtreeBoxBalances(stores.ledger, SQ2_PATH).get("USD")?.net).toBe(6_000)
    expect(boxFlow(stores.ledger, SQ2_PATH, "subtree").get("USD")).toEqual({
      incoming: 6_000,
      outgoing: 0,
      net: 6_000,
    })
    // ورصيدُ المربع **بذاته** صفرٌ — الفرقُ بين «صندوقي» و«ما تحتي» معلنٌ لا ملتبس.
    expect(boxFlow(stores.ledger, SQ2_PATH, "own").size).toBe(0)
  })
})

describe("المادة ٣/٤ — الخطأُ البرمجيّ **يمرّ ولا يُبتلع** في مسار التسليم", () => {
  it("رميةٌ برمجيةٌ داخل المعاملة تُرمى للأعلى (ولا تُقنَّع خطأَ عمل)، **والمستودعان يرتدّان**", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, boxContext("u-square"), {
      unitId: "sq2",
      operationId: "rcv-1",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(9_000) }],
    })
    const entriesBefore = stores.ledger.entries().length
    const broken = {
      ledger: stores.ledger,
      box: Object.assign(Object.create(Object.getPrototypeOf(stores.box)), stores.box, {
        saveHandover: () => {
          throw new TypeError("عطبٌ برمجيٌّ مصطنع في حفظ التسليم")
        },
      }),
    }

    expect(() =>
      handoverDown(broken, boxContext("u-square"), {
        fromUnitId: "sq2",
        toUnitId: KHALID,
        toCustodianPersonId: "u-amir",
        operationId: "hnd-boom",
        memoAr: "تسليمٌ يتعثّر برمجياً",
        currency: "USD",
        amount: c(100),
      }),
    ).toThrow(TypeError)

    // القيدُ ارتدّ مع الرمية: لا مالَ تحرّك بلا توثيقِ تسليمه.
    expect(stores.ledger.entries()).toHaveLength(entriesBefore)
  })
})

describe("سجلُّ الشبكات وأخطاءُ العمل قيمٌ معلنة", () => {
  it("`has` يعرف ما أُنشئ ولا يدّعي ما لم يُنشأ", () => {
    const registry = new BoxTenantRegistry()
    expect(registry.has(MAIN_TENANT_ID)).toBe(false)
    registry.storesFor(MAIN_TENANT_ID)
    expect(registry.has(MAIN_TENANT_ID)).toBe(true)
    expect(registry.has(SECOND_TENANT_ID)).toBe(false)
  })

  it("والخطأُ يحمل رمزَه، وتفصيلُه اختياريٌّ للتشخيص لا للمستخدم", () => {
    expect(boxErr("UNKNOWN_CATEGORY")).toEqual({ ok: false, error: { code: "UNKNOWN_CATEGORY" } })
    expect(boxErr("UNKNOWN_CATEGORY", "fuel")).toEqual({
      ok: false,
      error: { code: "UNKNOWN_CATEGORY", detail: "fuel" },
    })
  })
})
