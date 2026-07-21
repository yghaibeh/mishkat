/**
 * سطوحُ الوحدة — `SPEC_authorization` §٥.٢: **قدرةٌ معلنة قبل الجسم**، و**نطاقٌ يُشتقّ من
 * الكيان المخزَّن**، و**فاعلٌ من الجلسة لا من المدخل**، والغائبُ ⇒ `NO_SCOPE` ⇒ رفض.
 *
 * وحالاتُ السلب هنا أكثرُ من الإيجاب عمداً (TESTING_POLICY §٤): **النظامُ الآمن يُعرَّف بما يمنعه.**
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { makeDailyLogEndpoints } from "../../../src/features/dailyLog/server/endpoints.js"
import { makeWeeklyRecordEndpoints } from "../../../src/features/approval/server/weeklyRecord.js"
import { weeklyRecordLockCheck } from "../../../src/features/approval/registered/weeklyRecord.js"
import { ApprovalStore } from "../../../src/features/approval/data/store.js"
import { weekEndExclusive } from "../../../src/features/dailyLog/services/time.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import {
  KHALID,
  NOUR,
  NOW,
  READ,
  WEEK,
  WRITE,
  canonicalActor,
  canonicalPeople,
  seedDailyLogStore,
} from "./_seed.js"

const SETTINGS = createSettingsResolver([])
const SPAN = { fromDayKey: "2026-07-01", toDayKey: "2026-07-31" }
const PERIOD = { id: WEEK, endsAt: weekEndExclusive(WEEK) }

function endpoints() {
  const log = seedDailyLogStore()
  const approval = new ApprovalStore("t-main")
  // مُركِّبُ النظام هو مَن يصل المنفذَ بمُنفِّذه — لا الوحدةُ تستنتجه (G22).
  const dl = makeDailyLogEndpoints(log, SETTINGS, weeklyRecordLockCheck(approval))
  const wr = makeWeeklyRecordEndpoints({ approval, dailyLog: log }, SETTINGS, canonicalPeople())
  return { log, approval, dl, wr }
}

beforeEach(() => clearRegistryForTests())

describe("G7 — كلُّ دالةٍ تعلن قدرتَها ونيّتَها ونطاقَها", () => {
  it("الإعلاناتُ مكتملةٌ في كل سطحٍ من سطوح الوحدة", () => {
    const { dl, wr } = endpoints()
    for (const fn of [dl.view, dl.record, dl.roster, dl.catalogView, dl.catalogUpsert]) {
      expect(fn.declaration.capability).not.toBe("PUBLIC_DECLARED")
      expect(fn.declaration.scope).toBeDefined()
      expect(fn.declaration.audit.length).toBeGreaterThan(0)
    }
    expect(dl.record.declaration.capability).toBe("dailyLog.edit")
    expect(dl.roster.declaration.capability).toBe("familyRoster.manage")
    expect(dl.catalogUpsert.declaration.capability).toBe("activityCatalog.manage")
    expect(wr.submit.declaration.intent).toBe("write")
  })
})

describe("النطاقُ يُشتقّ من الكيان المخزَّن — والغائبُ يُقفل ولا يُفتح", () => {
  it("**وحدةٌ مجهولةٌ ⇒ رفضٌ قبل جسم الدالة** لا استثناءٌ داخله", async () => {
    const { dl } = endpoints()
    const r = await dl.view.invoke({ unitId: "ghost", periodKey: WEEK, span: SPAN }, canonicalActor("u-admin"), READ)
    expect(r.ok).toBe(false)
  })

  it("وقيدٌ على وحدةٍ مجهولةٍ مرفوضٌ كذلك", async () => {
    const { dl } = endpoints()
    const r = await dl.record.invoke(
      { unitId: "ghost", clientUuid: "x", activityId: "lesson", count: 1, date: NOW },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })
})

describe("العزلُ بالنطاق: من لا نطاقَ له على المسجد مرفوضٌ في الخادم", () => {
  it("**أميرُ مسجدٍ آخر لا يُدخل سجلَ مسجدِ جاره**", async () => {
    const { dl } = endpoints()
    const r = await dl.record.invoke(
      { unitId: KHALID, clientUuid: "x1", activityId: "lesson", count: 1, date: NOW },
      canonicalActor("u-amir-bilal"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })

  it("**والمعلّمُ والطالبُ والإعلاميُّ والماليُّ كلُّهم مرفوضون في الإدخال**", async () => {
    const { dl } = endpoints()
    for (const personId of ["u-teacher", "u-student", "u-media", "u-finance"]) {
      const r = await dl.record.invoke(
        { unitId: KHALID, clientUuid: `x-${personId}`, activityId: "lesson", count: 1, date: NOW },
        canonicalActor(personId),
        WRITE,
      )
      expect(r.ok, personId).toBe(false)
    }
  })

  it("**والمديرُ يرى ولا يُدخل** (ق-٤ «المدير لا يُكلَّف»)", async () => {
    const { dl } = endpoints()
    const viewed = await dl.view.invoke({ unitId: KHALID, periodKey: WEEK, span: SPAN }, canonicalActor("u-admin"), READ)
    expect(viewed.ok).toBe(true)

    const wrote = await dl.record.invoke(
      { unitId: KHALID, clientUuid: "x-admin", activityId: "lesson", count: 1, date: NOW },
      canonicalActor("u-admin"),
      WRITE,
    )
    expect(wrote.ok).toBe(false)
  })

  it("**وكتالوجُ الأنشطة للمدير وحده** — قدرةٌ جذرية، والأميرُ ومشرفُ القسم مرفوضان", async () => {
    const { dl } = endpoints()
    const admin = await dl.catalogUpsert.invoke(
      {
        schemeId: "scheme-men",
        activityId: "iftar",
        ar: "إفطارُ صائم",
        weight: 3,
        maxPerDay: null,
        requiresParticipation: false,
        active: true,
      },
      canonicalActor("u-admin"),
      WRITE,
    )
    expect(admin.ok).toBe(true)

    for (const personId of ["u-amir", "u-section-head", "u-square", "u-finance"]) {
      const r = await dl.catalogUpsert.invoke(
        {
          schemeId: "scheme-men",
          activityId: "iftar",
          ar: "إفطارُ صائم",
          weight: 3,
          maxPerDay: null,
          requiresParticipation: false,
          active: true,
        },
        canonicalActor(personId),
        WRITE,
      )
      expect(r.ok, personId).toBe(false)
    }
  })

  it("**وضبطُ عدد الأسرة لصاحب النطاق بعينه** — أميرُ الجار مرفوض", async () => {
    const { dl } = endpoints()
    const owner = await dl.roster.invoke({ unitId: KHALID, studentCount: 12 }, canonicalActor("u-amir"), WRITE)
    expect(owner.ok).toBe(true)

    const neighbour = await dl.roster.invoke(
      { unitId: KHALID, studentCount: 99 },
      canonicalActor("u-amir-bilal"),
      WRITE,
    )
    expect(neighbour.ok).toBe(false)
  })
})

describe("سطوحُ السجل الأسبوعيّ — الفاعلُ من الجلسة والقدرةُ قبل الجسم", () => {
  it("**التقديمُ فوق حصيلةٍ صفريةٍ مرفوضٌ في الخادم** (ق-١٠)", async () => {
    const { wr } = endpoints()
    const r = await wr.submit.invoke({ unitId: KHALID, period: PERIOD }, canonicalActor("u-amir"), WRITE)
    expect(r.ok && (r.value.ok === false ? r.value.error.code : "")).toBe("EMPTY_PAYLOAD")
  })

  it("**ومَن لا يملك تقديمَ التقرير مرفوضٌ قبل الجسم**", async () => {
    const { wr } = endpoints()
    for (const personId of ["u-teacher", "u-student", "u-media", "u-admin"]) {
      const r = await wr.submit.invoke({ unitId: KHALID, period: PERIOD }, canonicalActor(personId), WRITE)
      expect(r.ok, personId).toBe(false)
    }
  })

  it("**والاعتمادُ يُرفض لمن لا يملك `report.approve`** ولو كان الأقرب", async () => {
    const { dl, wr } = endpoints()
    await dl.record.invoke(
      { unitId: KHALID, clientUuid: "wr-e", activityId: "lesson", count: 1, date: NOW },
      canonicalActor("u-amir"),
      WRITE,
    )
    const submitted = await wr.submit.invoke({ unitId: KHALID, period: PERIOD }, canonicalActor("u-amir"), WRITE)
    const requestId = submitted.ok && submitted.value.ok ? submitted.value.value.id : ""
    expect(requestId.length).toBeGreaterThan(0)

    for (const personId of ["u-teacher", "u-student", "u-finance", "u-media"]) {
      const r = await wr.approve.invoke({ requestId }, canonicalActor(personId), WRITE)
      expect(r.ok, personId).toBe(false)
    }

    const nearest = await wr.approve.invoke({ requestId }, canonicalActor("u-square"), WRITE)
    expect(nearest.ok && nearest.value.ok).toBe(true)
  })

  it("**وطلبٌ مجهولٌ ⇒ `NO_SCOPE` ⇒ رفضٌ** لا استثناء", async () => {
    const { wr } = endpoints()
    const r = await wr.approve.invoke({ requestId: "ghost" }, canonicalActor("u-square"), WRITE)
    expect(r.ok).toBe(false)
  })
})

describe("ق-٤٢ — المسارُ النسائيُّ يمرّ بنفس السطوح بلا سطحٍ ثانٍ", () => {
  it("قيدٌ على مسجدٍ نسائيٍّ يُرفض لمن لا نطاقَ له عليه — وبنفس الدالة لا بدالةٍ موازية", async () => {
    const { dl } = endpoints()
    const r = await dl.record.invoke(
      { unitId: NOUR, clientUuid: "w-x", activityId: "dawah", count: 1, date: NOW },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })
})
