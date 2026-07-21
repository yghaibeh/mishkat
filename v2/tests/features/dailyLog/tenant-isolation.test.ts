/**
 * قب-١٨ — **عزلُ الشبكة على كل المسارات**: النموذجُ مهيّأٌ للتعدّد وإن شُغّلت شبكةٌ واحدة.
 *
 * العزلُ **بنيويٌّ لا فحصٌ زمنيّ**: مستودعٌ لكل شبكة، فلا مِقبضَ عابرٌ أصلاً. والشبكةُ الثانية
 * تحمل **نفسَ المسارات النسبيّة عمداً** — فيثبت الاختبارُ أنّ التطابقَ لا يسرّب.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { DailyLogTenantRegistry } from "../../../src/features/dailyLog/data/tenant.js"
import { makeDailyLogEndpoints } from "../../../src/features/dailyLog/server/endpoints.js"
import { recordDailyEntry } from "../../../src/features/dailyLog/services/entries.js"
import { entriesOfPeriod } from "../../../src/features/dailyLog/services/entries.js"
import { periodPoints } from "../../../src/features/dailyLog/services/totals.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import {
  KHALID,
  KHALID_PATH,
  MAIN_TENANT_ID,
  NOW,
  READ,
  SECOND_TENANT_ID,
  WEEK,
  WRITE,
  canonicalActor,
  dailyLogContext,
  seedDailyLogStore,
} from "./_seed.js"

const SETTINGS = createSettingsResolver([])
const SPAN = { fromDayKey: "2026-07-01", toDayKey: "2026-07-31" }

beforeEach(() => clearRegistryForTests())

describe("قب-١٨ — مستودعٌ لكل شبكة، ولا مِقبضَ عابر", () => {
  it("سجلُّ الشبكات يوزّع مستودعاً واحداً لكل شبكةٍ ولا يخلط", () => {
    const registry = new DailyLogTenantRegistry()
    const a = registry.storeFor(MAIN_TENANT_ID)
    const b = registry.storeFor(SECOND_TENANT_ID)
    expect(a).not.toBe(b)
    expect(registry.storeFor(MAIN_TENANT_ID)).toBe(a)
    expect(a.tenantId).toBe(MAIN_TENANT_ID)
    expect(registry.has(SECOND_TENANT_ID)).toBe(true)
    expect(registry.tenantIds().sort()).toEqual([SECOND_TENANT_ID, MAIN_TENANT_ID].sort())
  })

  it("**`tenantId` مشتقٌّ من المستودع لا من مدخل العميل** — ختمٌ عند الحفظ", () => {
    const store = seedDailyLogStore(SECOND_TENANT_ID)
    const r = recordDailyEntry(store, dailyLogContext("u-amir"), {
      clientUuid: "t-1",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
    })
    expect(r.ok && r.value.tenantId).toBe(SECOND_TENANT_ID)
  })

  it("**قيدُ شبكةٍ لا يُرى من أخرى ولو تطابق المسارُ النسبيّ حرفياً**", () => {
    const main = seedDailyLogStore(MAIN_TENANT_ID)
    const other = seedDailyLogStore(SECOND_TENANT_ID)
    const ctx = dailyLogContext("u-amir")

    recordDailyEntry(other, ctx, {
      clientUuid: "t-2",
      unitId: KHALID,
      activityId: "lesson",
      count: 3,
      date: NOW,
    })

    expect(periodPoints(other, KHALID_PATH, WEEK)).toBe(15)
    expect(periodPoints(main, KHALID_PATH, WEEK)).toBe(0)
    expect(entriesOfPeriod(main, KHALID_PATH, WEEK)).toEqual([])
  })

  it("**ومنعُ الازدواج (ق-٤٦) لا يعبر الشبكات** — طالبُ شبكةٍ لا يحجب نظيرَه في أخرى", () => {
    const main = seedDailyLogStore(MAIN_TENANT_ID)
    const other = seedDailyLogStore(SECOND_TENANT_ID)
    const ctx = dailyLogContext("u-amir")
    recordDailyEntry(main, ctx, {
      clientUuid: "t-3",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
      studentIds: ["s-1"],
    })
    const elsewhere = recordDailyEntry(other, ctx, {
      clientUuid: "t-4",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: NOW,
      studentIds: ["s-1"],
    })
    expect(elsewhere.ok && elsewhere.value.points).toBe(5)
  })

  it("**وسطحُ الخادم لا يبلغ وحدةَ شبكةٍ أخرى** ⇒ `NO_SCOPE` ⇒ رفض", async () => {
    const other = new DailyLogTenantRegistry().storeFor(SECOND_TENANT_ID)
    const ep = makeDailyLogEndpoints(other, SETTINGS, () => false)
    // مستودعُ الشبكة الثانية فارغٌ من الوحدات: مسارُ خالد النسبيّ نفسُه لا يُبلَغ منه.
    const r = await ep.view.invoke(
      { unitId: KHALID, periodKey: WEEK, span: SPAN },
      canonicalActor("u-admin"),
      READ,
    )
    expect(r.ok).toBe(false)
  })

  it("**والكتابةُ كذلك** — العزلُ يسبق القدرة لا يليها", async () => {
    const other = new DailyLogTenantRegistry().storeFor(SECOND_TENANT_ID)
    const ep = makeDailyLogEndpoints(other, SETTINGS, () => false)
    const r = await ep.record.invoke(
      { unitId: KHALID, clientUuid: "t-5", activityId: "lesson", count: 1, date: NOW },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })
})
