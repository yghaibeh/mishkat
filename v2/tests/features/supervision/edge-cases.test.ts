/**
 * حوافُّ الوحدة — ما يقع مرةً كلَّ سنةٍ ويكلّف حين يقع (TESTING_POLICY §٣: التغطيةُ شرطٌ لازمٌ
 * غيرُ كافٍ، والمقياسُ **جودةُ التوكيد**).
 *
 * وفيها أربعُ عائلاتٍ: **ذرّيةُ المستودع** (لا نصفُ كتابةٍ تبقى) · **المنافذُ والإعدادات**
 * (النوعُ الخاطئ حالةٌ برمجيةٌ تُلقى لا خطأُ عملٍ يُبتلع) · **جبرُ المسارات** (حدودُ الاحتواء)
 * · **سطوحُ البتّ** (الرفضُ والصندوق) — وكلُّها سلوكٌ معلَنٌ في العقد لا رفعُ نسبة.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { ApprovalStore } from "../../../src/features/approval/data/store.js"
import { makeVisitApprovalEndpoints } from "../../../src/features/approval/server/supervisionVisit.js"
import { supervisionVisitVerdict } from "../../../src/features/approval/registered/supervisionVisit.js"
import { SupervisionStore } from "../../../src/features/supervision/data/store.js"
import { SupervisionTenantRegistry } from "../../../src/features/supervision/data/tenant.js"
import { makeSupervisionEndpoints } from "../../../src/features/supervision/server/endpoints.js"
import {
  settingNumber,
  settingText,
} from "../../../src/features/supervision/services/context.js"
import {
  effectiveScopePathsOf,
  recordVisit,
  supervisorAnchorFor,
} from "../../../src/features/supervision/services/visits.js"
import { nextUnitUnder } from "../../../src/features/supervision/services/views.js"
import { daysBetweenDayKeys } from "../../../src/features/supervision/services/cadence.js"
import type { Assignment } from "../../../src/authorization/can.js"
import {
  C1,
  C1_PATH,
  CORE,
  HOMS_PATH,
  KHALID_PATH,
  MAIN_TENANT_ID,
  NOW,
  READ,
  SQ2_PATH,
  TAHFEEZ_DETAILS,
  WRITE,
  canonicalActor,
  canonicalPeople,
  canonicalResponsibleOf,
  PENDING_VERDICT,
  seedSupervisionStore,
  supervisionContext,
} from "./_seed.js"

const SETTINGS = createSettingsResolver([])
const PORTS = { verdictOf: () => PENDING_VERDICT, responsibleOf: canonicalResponsibleOf }

beforeEach(() => clearRegistryForTests())

describe("ذرّيةُ المستودع — لا نصفَ كتابةٍ تبقى", () => {
  it("**المعاملةُ تُرجع الحالةَ كاملةً عند الرمي** — العدّادُ يرتدّ معها", () => {
    const store = seedSupervisionStore()
    const before = store.visits().length

    expect(() =>
      store.transaction(() => {
        store.saveVisit({
          tenantId: MAIN_TENANT_ID,
          id: store.nextId("vst"),
          targetId: C1,
          targetPath: C1_PATH,
          curriculum: "tahfeez",
          supervisorPath: SQ2_PATH,
          dayKey: "2026-07-20",
          visitedAt: NOW,
          core: CORE,
          details: TAHFEEZ_DETAILS,
          byPersonId: "u-square",
        })
        throw new Error("انقطاعٌ في منتصف المعاملة")
      }),
    ).toThrow()

    expect(store.visits().length).toBe(before)
    // والعدّادُ ارتدّ: أوّلُ معرّفٍ بعد التراجع هو المعرّفُ نفسُه لا التالي له.
    expect(store.nextId("vst")).toBe("vst-1")
  })

  it("والمجهولُ يُجاب بـ`null` لا باستثناءٍ صامت (وحدةً وهدفاً وزيارة)", () => {
    const store = new SupervisionStore(MAIN_TENANT_ID)
    expect(store.getUnit("ghost")).toBeNull()
    expect(store.getTarget("ghost")).toBeNull()
    expect(store.getVisit("ghost")).toBeNull()
    expect(store.units()).toEqual([])
  })

  it("**وزياراتُ الهدف بالأحدث أولاً، وتعادلُ اليوم يُكسر بالمعرّف** (حتميّةٌ لا عشوائية)", () => {
    const store = seedSupervisionStore()
    const first = recordVisit(store, supervisionContext("u-square"), {
      targetId: C1,
      visitedAt: NOW,
      core: CORE,
      details: TAHFEEZ_DETAILS,
    })
    const second = recordVisit(store, supervisionContext("u-rabita"), {
      targetId: C1,
      visitedAt: NOW,
      core: CORE,
      details: TAHFEEZ_DETAILS,
    })
    expect(first.ok && second.ok).toBe(true)

    const ordered = store.visitsOfTarget(C1).map((v) => v.id)
    expect(ordered).toEqual(["vst-2", "vst-1"])
    expect(store.visitsOfTarget("ghost")).toEqual([])
  })

  it("وسجلُّ الشبكة يعرف مَن فيه ومَن ليس فيه", () => {
    const registry = new SupervisionTenantRegistry()
    expect(registry.has(MAIN_TENANT_ID)).toBe(false)
    registry.storeFor(MAIN_TENANT_ID)
    expect(registry.has(MAIN_TENANT_ID)).toBe(true)
  })
})

describe("الإعداداتُ والمنافذ — النوعُ الخاطئ حالةٌ برمجيةٌ تُلقى لا خطأُ عملٍ يُبتلع", () => {
  it("**قراءةُ إعدادٍ ليس رقماً ترمي**، وكذلك ما ليس نصاً", () => {
    const ctx = supervisionContext("u-square")
    expect(() => settingNumber(ctx, "time.zone", SQ2_PATH)).toThrow(TypeError)
    expect(() => settingText(ctx, "supervision.visit_cadence_days", SQ2_PATH)).toThrow(TypeError)
  })

  it("و**الإعدادُ غيرُ المسجَّل يرمي** — لا قيمةَ افتراضيةَ تُخترع (سجلُّ الإعدادات مغلق)", () => {
    const ctx = supervisionContext("u-square")
    expect(() => settingNumber(ctx, "supervision.made_up_setting", SQ2_PATH)).toThrow()
  })
})

describe("جبرُ المسارات — حدودُ الاحتواء تُختبر بحدودها", () => {
  it("`nextUnitUnder` تعيد `null` لِما ليس تحت النطاق، والمقطعَ الأول لِما تحته", () => {
    expect(nextUnitUnder(SQ2_PATH, C1_PATH)).toBe(KHALID_PATH)
    expect(nextUnitUnder(HOMS_PATH, C1_PATH)).toBe(SQ2_PATH)
    expect(nextUnitUnder(KHALID_PATH, KHALID_PATH)).toBeNull()
    expect(nextUnitUnder(SQ2_PATH, "/men/homs/sq7/omar/c2/")).toBeNull()
  })

  it("**والمرساةُ أعمقُ إسنادٍ حاوٍ** — والمساواةُ احتواء، وغيرُ الحاوي `null`", () => {
    expect(supervisorAnchorFor([HOMS_PATH, SQ2_PATH], C1_PATH)).toBe(SQ2_PATH)
    expect(supervisorAnchorFor([SQ2_PATH, HOMS_PATH], C1_PATH)).toBe(SQ2_PATH)
    expect(supervisorAnchorFor([C1_PATH], C1_PATH)).toBe(C1_PATH)
    expect(supervisorAnchorFor(["/men/homs/sq7/"], C1_PATH)).toBeNull()
  })

  it("**والإسنادُ غيرُ الفعّال لا يصير مرساةً**: منتهٍ أو معلَّقٌ أو مؤرشفٌ أو لم يبدأ بعد", () => {
    const base: Assignment = {
      roleId: "square",
      scopePath: SQ2_PATH,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: null,
      approvalStatus: "approved",
      unitArchived: false,
    }
    const cases: readonly Assignment[] = [
      { ...base, approvalStatus: "pending" },
      { ...base, unitArchived: true },
      { ...base, endDate: new Date("2026-05-01T00:00:00.000Z") },
      { ...base, startDate: new Date("2026-12-01T00:00:00.000Z") },
    ]
    for (const assignment of cases) {
      expect(effectiveScopePathsOf([assignment], NOW)).toEqual([])
    }
    expect(effectiveScopePathsOf([base], NOW)).toEqual([SQ2_PATH])
  })

  it("وعددُ الأيام بين مفتاحين يُقاس في الاتجاهين، وصفرٌ لليوم نفسِه", () => {
    expect(daysBetweenDayKeys("2026-07-10", "2026-07-20")).toBe(10)
    expect(daysBetweenDayKeys("2026-07-20", "2026-07-20")).toBe(0)
    // عبر حدّ التوقيت الصيفيّ في دمشق (نهايةُ آذار) — الجبرُ على المفاتيح لا على اللحظات.
    expect(daysBetweenDayKeys("2026-03-25", "2026-04-01")).toBe(7)
  })
})

describe("سطوحُ البتّ في نقطة التمديد — الرفضُ والصندوق", () => {
  async function pending() {
    const supervision = seedSupervisionStore()
    const approval = new ApprovalStore(MAIN_TENANT_ID)
    const ep = makeSupervisionEndpoints(supervision, SETTINGS, {
      ...PORTS,
      verdictOf: supervisionVisitVerdict(approval),
    })
    const approvalEp = makeVisitApprovalEndpoints(
      { supervision, approval },
      SETTINGS,
      canonicalPeople(),
    )
    const recorded = await ep.record.invoke(
      { targetId: C1, visitedAt: NOW, core: CORE, details: TAHFEEZ_DETAILS },
      canonicalActor("u-square"),
      WRITE,
    )
    if (!recorded.ok || !recorded.value.ok) throw new Error("تعذّر التسجيل")
    const submitted = await approvalEp.submit.invoke(
      { visitId: recorded.value.value.id },
      canonicalActor("u-square"),
      WRITE,
    )
    if (!submitted.ok || !submitted.value.ok) throw new Error("تعذّر الرفع")
    return { ep, approvalEp, requestId: submitted.value.value.id }
  }

  it("**الرفضُ بسببٍ يعيدها مسودةً**، والرفضُ بلا سببٍ مردود", async () => {
    const { approvalEp, requestId } = await pending()

    const bare = await approvalEp.reject.invoke(
      { requestId, reasonAr: "  " },
      canonicalActor("u-rabita"),
      WRITE,
    )
    expect(bare.ok && !bare.value.ok && bare.value.error.code).toBe("REASON_REQUIRED")

    const rejected = await approvalEp.reject.invoke(
      { requestId, reasonAr: "أعد الزيارةَ بحضورٍ أوسع" },
      canonicalActor("u-rabita"),
      WRITE,
    )
    expect(rejected.ok && rejected.value.ok && rejected.value.value.state).toBe("draft")
  })

  it("**وصندوقُ الانتظار للأقرب وحده**: المنطقةُ تجده مملوءاً، والرافعُ يجده فارغاً", async () => {
    const { approvalEp } = await pending()

    const forRabita = await approvalEp.pending.invoke(
      { unitId: "homs" },
      canonicalActor("u-rabita"),
      READ,
    )
    expect(forRabita.ok && forRabita.value.length).toBe(1)

    // **الحارسان مستقلّان**: البابُ يُفتح لحامل القدرة (`can()`)، ثم يقف الطالبُ عند المحرّك —
    // فالمربعُ يفتح صندوقَه ويجده **فارغاً** لأنه ليس الأقربَ لزيارته (ق-١/ق-٩).
    const forSquare = await approvalEp.pending.invoke(
      { unitId: "sq2" },
      canonicalActor("u-square"),
      READ,
    )
    expect(forSquare.ok && forSquare.value).toEqual([])
  })

  it("**والمجهولُ يُقفل**: رفعُ زيارةٍ لا وجود لها وبتُّ طلبٍ لا وجود له مردودان", async () => {
    const { approvalEp } = await pending()

    const submitGhost = await approvalEp.submit.invoke(
      { visitId: "ghost" },
      canonicalActor("u-square"),
      WRITE,
    )
    expect(submitGhost.ok).toBe(false)

    const approveGhost = await approvalEp.approve.invoke(
      { requestId: "ghost" },
      canonicalActor("u-rabita"),
      WRITE,
    )
    expect(approveGhost.ok).toBe(false)

    const pendingGhost = await approvalEp.pending.invoke(
      { unitId: "ghost" },
      canonicalActor("u-rabita"),
      READ,
    )
    expect(pendingGhost.ok).toBe(false)
  })

  it("**ولوحةُ وحدةٍ مجهولةٍ وقائمتُها مردودتان كذلك** (`NO_SCOPE` يُقفل ولا يُفتح)", async () => {
    const { ep } = await pending()
    for (const call of [
      ep.board.invoke({ unitId: "ghost" }, canonicalActor("u-square"), READ),
      ep.overview.invoke({ unitId: "ghost" }, canonicalActor("u-rabita"), READ),
      ep.visits.invoke({ unitId: "ghost" }, canonicalActor("u-amir"), READ),
    ]) {
      expect((await call).ok).toBe(false)
    }
  })
})
