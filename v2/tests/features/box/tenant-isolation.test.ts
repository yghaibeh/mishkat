/**
 * قب-١٨ — **عزلُ الشبكة على كل مسارات الصندوق** (الاختبارُ الإلزاميّ الثامن).
 *
 * العزلُ **بنيويٌّ في طبقة البيانات**: مستودعا شبكةٍ لكل شبكة، فلا مِقبضَ عابرٌ أصلاً.
 * والشبكةُ الثانية تحمل **نفسَ المسارات النسبيّة عمداً** — فيثبت أنّ التطابق لا يسرّب.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { LedgerStore } from "../../../src/features/ledger/data/store.js"
import { BoxStore } from "../../../src/features/box/data/store.js"
import { BoxTenantRegistry } from "../../../src/features/box/data/tenant.js"
import { makeBoxEndpoints } from "../../../src/features/box/server/endpoints.js"
import { handoverDown } from "../../../src/features/box/services/handover.js"
import { receiveIntoBox } from "../../../src/features/box/services/operations.js"
import { unitBoxView } from "../../../src/features/box/services/boxViews.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import {
  boxContext,
  c,
  canonicalActor,
  canonicalDirectory,
  DECISION,
  MAIN_TENANT_ID,
  SECOND_TENANT_ID,
  seedBoxStores,
  WRITE,
} from "./_seed.js"

const SETTINGS = createSettingsResolver([])
const KHALID_PATH = "/men/homs/sq2/khalid/"

beforeEach(() => clearRegistryForTests())

describe("المستودعُ يختم شبكتَه — و`tenantId` لا يأتي من مدخل العميل", () => {
  it("فئةٌ وافدةٌ بشبكةٍ ملفَّقة ⇒ تُطمس بشبكة المستودع", () => {
    const store = new BoxStore(MAIN_TENANT_ID)
    store.saveCategory({
      tenantId: SECOND_TENANT_ID,
      id: "fuel",
      ar: "محروقات",
      accountId: "expense.fuel",
      active: true,
    })
    expect(store.getCategory("fuel")?.tenantId).toBe(MAIN_TENANT_ID)
  })

  it("وسجلُّ التسليم يحمل شبكةَ مستودعه لا شبكةَ المدخل", () => {
    const stores = seedBoxStores()
    receiveIntoBox(stores, boxContext("u-square"), {
      unitId: "sq2",
      operationId: "rcv-1",
      memoAr: "قبضتُ",
      lines: [{ currency: "USD", amount: c(5_000) }],
    })
    const done = handoverDown(stores, boxContext("u-square"), {
      fromUnitId: "sq2",
      toUnitId: "khalid",
      toCustodianPersonId: "u-amir",
      operationId: "hnd-1",
      memoAr: "سلّمتُ",
      currency: "USD",
      amount: c(1_000),
    })
    if (!done.ok) throw new Error(done.error.code)
    expect(done.value.handover.tenantId).toBe(MAIN_TENANT_ID)
  })
})

describe("سجلُّ الشبكات يوجّه إلى **مستودعَي شبكته** ولا يخلطهما", () => {
  it("شبكتان بنفس المسار النسبيّ ⇒ صندوقان مستقلّان تماماً", () => {
    const registry = new BoxTenantRegistry()
    const main = registry.storesFor(MAIN_TENANT_ID)
    const second = registry.storesFor(SECOND_TENANT_ID)
    expect(main.box).not.toBe(second.box)
    expect(main.ledger).not.toBe(second.ledger)
    expect(registry.storesFor(MAIN_TENANT_ID).box).toBe(main.box)
    expect(registry.tenantIds().sort()).toEqual([SECOND_TENANT_ID, MAIN_TENANT_ID].sort())
  })

  it("**ومالُ شبكةٍ لا يظهر في عرض الأخرى ولو تطابقت المسارات**", () => {
    const first = seedBoxStores(MAIN_TENANT_ID)
    const second = seedBoxStores(SECOND_TENANT_ID)
    receiveIntoBox(second, boxContext("u-amir"), {
      unitId: "khalid",
      operationId: "rcv-second",
      memoAr: "قبضُ شبكةٍ أخرى",
      lines: [{ currency: "USD", amount: c(77_000) }],
    })
    expect(unitBoxView(second, KHALID_PATH).own.get("USD")?.net).toBe(77_000)
    expect(unitBoxView(first, KHALID_PATH).own.size).toBe(0)
  })
})

describe("والحدُّ **قبل المحرّك**: فاعلٌ في شبكةٍ لا يبلغ صندوقَ أخرى", () => {
  it("نقاطُ شبكةٍ لا تعرف وحدةَ شبكةٍ لم تُبذَر فيها ⇒ `NO_SCOPE` ⇒ رفض", async () => {
    // شبكةٌ ثانيةٌ بمستودعَين نظيفين: المسارُ النسبيّ نفسُه **لا يُنتج نطاقاً** فيها.
    const barren = {
      ledger: new LedgerStore(SECOND_TENANT_ID),
      box: new BoxStore(SECOND_TENANT_ID),
    }
    const ep = makeBoxEndpoints(barren, SETTINGS, canonicalDirectory)
    const viewed = await ep.unitView.invoke({ unitId: "khalid" }, canonicalActor("u-admin"), DECISION)
    const received = await ep.receive.invoke(
      { unitId: "khalid", operationId: "x", memoAr: "قبض", lines: [{ currency: "USD", amount: c(1) }] },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(viewed.ok).toBe(false)
    expect(received.ok).toBe(false)
  })
})
