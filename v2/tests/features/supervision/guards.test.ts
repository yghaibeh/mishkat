/**
 * سطوحُ الوحدة الأربعة — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٥.
 *
 * **الحارسان معاً**: القدرةُ تُفرض في الخادم **قبل جسم الدالة** (`can()` على نطاقٍ مشتقٍّ من
 * الكيان المخزَّن)، والخدمةُ تردُّ ما تسرّب. وهنا يُقاس **الاختبارُ الخامس الإلزاميّ**: مشرفٌ
 * يزور خارج نطاقه ⇒ مرفوض، **والاطّلاعُ الهابط مباح** (ق-١٧) — والصعودُ ممنوع.
 *
 * وحالاتُ السلب أكثرُ من الإيجاب عمداً (TESTING_POLICY §٤): النظامُ الآمن يُعرَّف بما يمنعه.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { makeSupervisionEndpoints } from "../../../src/features/supervision/server/endpoints.js"
import {
  BASEERA_DETAILS,
  C1,
  C2,
  CORE,
  HOMS_PATH,
  NOW,
  READ,
  SQ2_PATH,
  TAHFEEZ_DETAILS,
  WRITE,
  canonicalActor,
  canonicalResponsibleOf,
  PENDING_VERDICT,
  seedSupervisionStore,
} from "./_seed.js"

const SETTINGS = createSettingsResolver([])
const PORTS = { verdictOf: () => PENDING_VERDICT, responsibleOf: canonicalResponsibleOf }

function endpoints() {
  const store = seedSupervisionStore()
  return { store, ep: makeSupervisionEndpoints(store, SETTINGS, PORTS) }
}

beforeEach(() => clearRegistryForTests())

describe("`visit.record` — تنفيذُ الزيارة بقدرتها وعلى نطاقها", () => {
  it("**مشرفُ المربع يسجّل زيارةً في مربعه** — وتُنسب إليه هو (الفاعلُ من الجلسة)", async () => {
    const { ep } = endpoints()
    const r = await ep.record.invoke(
      { targetId: C1, visitedAt: NOW, core: CORE, details: TAHFEEZ_DETAILS },
      canonicalActor("u-square"),
      WRITE,
    )

    expect(r.ok).toBe(true)
    expect(r.ok && r.value.ok && r.value.value.byPersonId).toBe("u-square")
    expect(r.ok && r.value.ok && r.value.value.supervisorPath).toBe(SQ2_PATH)
  })

  it("**ومشرفُ المربع الثاني لا يزور المربع السابع** — رفضُ صلاحيةٍ قبل جسم الدالة", async () => {
    const { ep, store } = endpoints()
    const r = await ep.record.invoke(
      { targetId: C2, visitedAt: NOW, core: CORE, details: BASEERA_DETAILS },
      canonicalActor("u-square"),
      WRITE,
    )

    expect(r.ok).toBe(false)
    expect(store.visits()).toHaveLength(0)
  })

  it("**والأميرُ لا ينفّذ زيارةً** (عدسة §٢.٥: عرضٌ لا تنفيذ)", async () => {
    const { ep } = endpoints()
    const r = await ep.record.invoke(
      { targetId: C1, visitedAt: NOW, core: CORE, details: TAHFEEZ_DETAILS },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })

  it("**ولا المديرُ** (ق-٣/ق-٤: اطّلاعٌ لا تشغيل) ولا المعلّمُ ولا الطالبُ ولا الإعلاميّ", async () => {
    const { ep } = endpoints()
    for (const personId of ["u-admin", "u-teacher", "u-student", "u-media", "u-finance"]) {
      const r = await ep.record.invoke(
        { targetId: C1, visitedAt: NOW, core: CORE, details: TAHFEEZ_DETAILS },
        canonicalActor(personId),
        WRITE,
      )
      expect(r.ok, personId).toBe(false)
    }
  })

  it("**وهدفٌ مجهولٌ يُقفل ولا يُفتح** — `NO_SCOPE` رفضٌ لا تجاوز", async () => {
    const { ep } = endpoints()
    const r = await ep.record.invoke(
      { targetId: "ghost", visitedAt: NOW, core: CORE, details: TAHFEEZ_DETAILS },
      canonicalActor("u-square"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })
})

describe("`supervision.board.view` — لوحةُ المكلَّف لمن يزور", () => {
  it("مشرفُ المربع يفتح لوحةَ مربعه", async () => {
    const { ep } = endpoints()
    const r = await ep.board.invoke({ unitId: "sq2" }, canonicalActor("u-square"), READ)

    expect(r.ok).toBe(true)
    expect(r.ok && r.value.scopePath).toBe(SQ2_PATH)
    expect(r.ok && r.value.targets.length).toBe(3)
  })

  it("**والمنطقةُ تفتحها هابطةً على مربعها** (ق-١٧)", async () => {
    const { ep } = endpoints()
    const r = await ep.board.invoke({ unitId: "sq2" }, canonicalActor("u-rabita"), READ)
    expect(r.ok).toBe(true)
  })

  it("**والصعودُ ممنوع**: مشرفُ المربع لا يفتح لوحةَ المنطقة", async () => {
    const { ep } = endpoints()
    const r = await ep.board.invoke({ unitId: "homs" }, canonicalActor("u-square"), READ)
    expect(r.ok).toBe(false)
  })

  it("**والأميرُ لا لوحةَ تشغيليةَ له** — ليس مكلَّفاً بالزيارة", async () => {
    const { ep } = endpoints()
    const r = await ep.board.invoke({ unitId: "sq2" }, canonicalActor("u-amir"), READ)
    expect(r.ok).toBe(false)
  })
})

describe("`supervision.overview.view` و`supervision.visits.list` — عدسةُ الاطّلاع", () => {
  it("**المديرُ يرى العرضَ القياديَّ من الجذر** (اطّلاعٌ شبكيّ — `visit.view`)", async () => {
    const { ep } = endpoints()
    const r = await ep.overview.invoke({ unitId: "root" }, canonicalActor("u-admin"), READ)
    expect(r.ok).toBe(true)
  })

  it("**ومسؤولُ المنطقة يراه على منطقته**", async () => {
    const { ep } = endpoints()
    const r = await ep.overview.invoke({ unitId: "homs" }, canonicalActor("u-rabita"), READ)
    expect(r.ok).toBe(true)
    expect(r.ok && r.value.every((row) => row.unitPath.startsWith(HOMS_PATH))).toBe(true)
  })

  it("**والأميرُ يرى زياراتِ مسجده** (عدسة §٢.٥ بابُ ٨: اطّلاع)", async () => {
    const { ep } = endpoints()
    const r = await ep.visits.invoke({ unitId: "khalid" }, canonicalActor("u-amir"), READ)
    expect(r.ok).toBe(true)
  })

  it("**ولا يرى زياراتِ المسجد المجاور** — العزلُ بالنطاق لا بالدور", async () => {
    const { ep } = endpoints()
    const r = await ep.visits.invoke({ unitId: "bilal" }, canonicalActor("u-amir"), READ)
    expect(r.ok).toBe(false)
  })

  it("**والمعلّمُ والطالبُ والإعلاميُّ والماليُّ لا يرون شيئاً من الإشراف**", async () => {
    const { ep } = endpoints()
    for (const personId of ["u-teacher", "u-student", "u-media", "u-finance", "u-committee-head"]) {
      const overview = await ep.overview.invoke({ unitId: "homs" }, canonicalActor(personId), READ)
      expect(overview.ok, personId).toBe(false)
      const list = await ep.visits.invoke({ unitId: "khalid" }, canonicalActor(personId), READ)
      expect(list.ok, personId).toBe(false)
    }
  })

  it("**وكلُّ دالةٍ تعلن قدرتَها ونيّتها** (G7) — أربعُ دوالٍّ لا خامسةَ لها", () => {
    const { ep } = endpoints()
    expect(ep.record.declaration.capability).toBe("visit.conduct")
    expect(ep.board.declaration.capability).toBe("visit.conduct")
    expect(ep.overview.declaration.capability).toBe("visit.view")
    expect(ep.visits.declaration.capability).toBe("visit.view")
    expect(ep.record.declaration.intent).toBe("write")
    expect(ep.board.declaration.intent).toBe("read")
  })
})
