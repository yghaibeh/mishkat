/**
 * **السجلُّ الأسبوعيّ: سلسلةُ ق-٥ كاملةً عبر المحرّك، وصفرُ سطرِ اعتمادٍ في وحدة سجل اليوم.**
 *
 * هذه أوّلُ وحدةٍ غنيّةٍ تستهلك محرّك NESSA، والتسجيلُ فيه **سطرُ بيان**: نوعٌ يُعلن كيانَه
 * وقدراته وأثرَي بتّه، ثم يجري عليه **المحرّكُ نفسُه** — فالسلسلةُ (مسودة ← إقرارُ الأمير ←
 * اعتمادُ الأقرب ← قفل) والرفضُ بسببٍ والسحبُ والتدخلُ الفوقيُّ وكسرُ الزجاج والقفلُ الزمنيّ
 * **كلُّها سلوكُ المحرّك** لا كودٌ يُكتب هنا.
 *
 * وق-١٠ يقع **بنيوياً**: حمولةُ السجل تُشتقّ من قيوده، وحصيلةٌ صفريةٌ ⇒ حمولةٌ فارغة ⇒
 * `EMPTY_PAYLOAD` — فلا «زرَّ تقديمٍ فوق أصفار» ولا تقديمَ يمرّ من خلف الواجهة.
 */
import { describe, it, expect } from "vitest"
import { ApprovalStore } from "../../../src/features/approval/data/store.js"
import {
  WEEKLY_RECORD,
  weeklyRecordLockCheck,
  weeklyRecordPayloadSource,
} from "../../../src/features/approval/registered/weeklyRecord.js"
import { makeCapabilityCheck } from "../../../src/features/approval/services/authority.js"
import {
  approveRequest,
  rejectRequest,
  retractSubmission,
  submitForApproval,
  type ApprovalContext,
} from "../../../src/features/approval/services/engine.js"
import {
  breakGlassApprove,
  overrideApprove,
} from "../../../src/features/approval/services/exceptions.js"
import { pendingForApprover } from "../../../src/features/approval/services/inbox.js"
import { recordDailyEntry } from "../../../src/features/dailyLog/services/entries.js"
import { weekEndExclusive } from "../../../src/features/dailyLog/services/time.js"
import type { DailyLogStore } from "../../../src/features/dailyLog/data/store.js"
import { createSettingsResolver, type SettingOverride } from "../../../src/settings/resolver.js"
import type { Actor } from "../../../src/authorization/can.js"
import {
  KHALID,
  KHALID_PATH,
  NOW,
  WEEK,
  canonicalPeople,
  dailyLogContext,
  seedDailyLogStore,
} from "../dailyLog/_seed.js"

const FROM = new Date("2026-01-01T00:00:00.000Z")
const PERIOD = { id: WEEK, endsAt: weekEndExclusive(WEEK) }

type World = { readonly log: DailyLogStore; readonly approval: ApprovalStore }

function world(): World {
  return { log: seedDailyLogStore(), approval: new ApprovalStore("t-main") }
}

function approvalContext(
  w: World,
  actorPersonId: string,
  options: { readonly people?: readonly Actor[]; readonly settings?: readonly SettingOverride[] } = {},
): ApprovalContext {
  const people = options.people ?? canonicalPeople()
  return {
    now: NOW,
    actorPersonId,
    people,
    settings: createSettingsResolver(options.settings ?? []),
    holds: makeCapabilityCheck(people, { now: NOW, intent: "read", isFeatureEnabled: () => true }),
    payloadFor: weeklyRecordPayloadSource(w.log),
  }
}

/** يومٌ من عملٍ في مسجد خالد — الحصيلةُ غيرُ صفرية فيصير التقديمُ ممكناً (ق-١٠). */
function withWork(w: World, clientUuid = "wr-1"): World {
  const r = recordDailyEntry(w.log, dailyLogContext("u-amir"), {
    clientUuid,
    unitId: KHALID,
    activityId: "lesson",
    count: 2,
    date: NOW,
  })
  if (!r.ok) throw new Error(r.error.code)
  return w
}

function submit(w: World, personId = "u-amir") {
  return submitForApproval(w.approval, approvalContext(w, personId), {
    typeId: WEEKLY_RECORD.id,
    unitPath: KHALID_PATH,
    period: PERIOD,
  })
}

describe("النوعُ **بيانٌ يُعلن**: كيانُه وقدراتُه وأثرا بتّه (عقدُ المحرّك §٧)", () => {
  it("مسجَّلٌ بقدرات `report.*` ونطاقُه وحدة، وحرّاسُه لا تُعطَّل", () => {
    expect(WEEKLY_RECORD.scopeKind).toBe("unit")
    expect(WEEKLY_RECORD.submitCapability).toBe("report.submit")
    expect(WEEKLY_RECORD.approveCapability).toBe("report.approve")
    expect(WEEKLY_RECORD.approvalLocks).toBe(true)
    expect(WEEKLY_RECORD.rejectionRequiresReason).toBe(true)
    expect(WEEKLY_RECORD.rejectionReturnsToDraft).toBe(true)
  })
})

describe("ق-١٠ — لا تقديمَ فوق حصيلةٍ صفرية", () => {
  it("**تقديمُ أسبوعٍ بلا إدخالٍ مرفوضٌ في الخادم** — لا يكفي إخفاءُ الزر", () => {
    const w = world()
    const r = submit(w)
    expect(!r.ok && r.error.code).toBe("EMPTY_PAYLOAD")
  })

  it("وأوّلُ قيدٍ يفتح التقديم — الحصيلةُ هي الشرط لا مرورُ الزمن", () => {
    const w = withWork(world())
    const r = submit(w)
    expect(r.ok && r.value.state).toBe("submitted")
  })

  it("**والحمولةُ تُشتقّ من القيود ولا يُدخلها المقدِّم**", () => {
    const w = withWork(world())
    const r = submit(w)
    expect(r.ok && (r.value.payload as { points: number }).points).toBe(10)
    expect(r.ok && (r.value.payload as { unitPath: string }).unitPath).toBe(KHALID_PATH)
  })

  it("**وب-٤٢: النشاطُ الحرُّ يظهر لمعتمِد السجل** في حمولته بصفر نقاطه", () => {
    const w = withWork(world())
    recordDailyEntry(w.log, dailyLogContext("u-amir"), {
      clientUuid: "wr-free",
      unitId: KHALID,
      freeTextAr: "حملةُ نظافةٍ لساحة المسجد",
      count: 1,
      date: NOW,
    })
    const r = submit(w)
    const free = r.ok ? (r.value.payload as { free: readonly { textAr: string }[] }).free : []
    expect(free).toHaveLength(1)
    expect(free[0]?.textAr).toBe("حملةُ نظافةٍ لساحة المسجد")
    expect(r.ok && (r.value.payload as { points: number }).points).toBe(10)
  })
})

describe("ق-٥ — السلسلةُ كاملةً عبر المحرّك: إقرارُ الأمير ثم اعتمادُ الأقرب", () => {
  it("**الأميرُ يقدّم والمربعُ (الأقرب) يعتمد فيُقفل**", () => {
    const w = withWork(world())
    const submitted = submit(w)
    expect(submitted.ok).toBe(true)

    const decided = approveRequest(w.approval, approvalContext(w, "u-square"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(decided.ok && decided.value.state).toBe("approved")
    expect(decided.ok && decided.value.route).toBe("nearest")
    expect(decided.ok && decided.value.lockedAt).not.toBeNull()
  })

  it("**ومَن ليس الأقربَ مردودٌ ولو ملك القدرة** (المنطقةُ ورأسُ القسم فوق مربعٍ حيّ)", () => {
    const w = withWork(world())
    const submitted = submit(w)
    for (const personId of ["u-rabita", "u-section-head", "u-blocked"]) {
      const r = approveRequest(w.approval, approvalContext(w, personId), {
        requestId: submitted.ok ? submitted.value.id : "",
      })
      expect(!r.ok && r.error.code, personId).toBe("NOT_NEAREST_LAYER")
    }
  })

  it("**والأميرُ لا يعتمد سجلَّ نفسِه** (ق-٩ — على الشخص لا على الدور)", () => {
    const w = withWork(world())
    const submitted = submit(w)
    const r = approveRequest(w.approval, approvalContext(w, "u-amir"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(!r.ok && r.error.code).toBe("NOT_NEAREST_LAYER")
  })

  it("**والمديرُ لا يظهر في صندوق «بانتظار اعتمادك»** (ق-٣/ق-٤)", () => {
    const w = withWork(world())
    submit(w)
    const admin = pendingForApprover(w.approval, approvalContext(w, "u-admin"), {
      typeId: WEEKLY_RECORD.id,
      scopePath: "/",
    })
    expect(admin).toEqual([])
    const square = pendingForApprover(w.approval, approvalContext(w, "u-square"), {
      typeId: WEEKLY_RECORD.id,
      scopePath: "/men/homs/sq2/",
    })
    expect(square).toHaveLength(1)
  })

  it("**والرفضُ بسببٍ إلزاميّ يعيد السجلَّ مسودةً** ويُشعر المقدِّم (ق-٧)", () => {
    const w = withWork(world())
    const submitted = submit(w)
    const bare = rejectRequest(w.approval, approvalContext(w, "u-square"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(!bare.ok && bare.error.code).toBe("REASON_REQUIRED")

    const rejected = rejectRequest(w.approval, approvalContext(w, "u-square"), {
      requestId: submitted.ok ? submitted.value.id : "",
      reasonAr: "الحصيلةُ لا تطابق ما رأيتُه في زيارتي",
    })
    expect(rejected.ok && rejected.value.state).toBe("draft")
    expect(w.approval.notices().some((n) => n.kind === "rejected" && n.recipients.includes("u-amir"))).toBe(true)
  })

  it("**والسحبُ للمقدِّم قبل الاعتماد وحده** (ب-٣٠ج)", () => {
    const w = withWork(world())
    const submitted = submit(w)
    const byOther = retractSubmission(w.approval, approvalContext(w, "u-square"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(!byOther.ok && byOther.error.code).toBe("NOT_SUBMITTER")

    const byOwner = retractSubmission(w.approval, approvalContext(w, "u-amir"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(byOwner.ok && byOwner.value.state).toBe("draft")
  })

  it("**والتدخلُ الفوقيُّ لمن هو أعلى من الأقرب بقدرةٍ صريحة** (ق-١٢)", () => {
    const w = withWork(world())
    const submitted = submit(w)
    const bare = overrideApprove(w.approval, approvalContext(w, "u-rabita"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(!bare.ok && bare.error.code).toBe("REASON_REQUIRED")

    const r = overrideApprove(w.approval, approvalContext(w, "u-rabita"), {
      requestId: submitted.ok ? submitted.value.id : "",
      reasonAr: "مسؤولُ المربع مسافرٌ ولم يُفرَّغ تكليفُه",
    })
    expect(r.ok && r.value.route).toBe("override")
  })

  it("**وكسرُ الزجاج مردودٌ ما دامت طبقةٌ نشطة** (ق-٣)", () => {
    const w = withWork(world())
    const submitted = submit(w)
    const r = breakGlassApprove(w.approval, approvalContext(w, "u-admin"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(!r.ok && r.error.code).toBe("LAYER_NOT_VACANT")
  })
})

describe("ق-٨ — القفلُ: المعتمَدُ لا يُكتب عليه، ولا يُعاد تقديمُه", () => {
  it("**اعتمادٌ ثانٍ على معتمَدٍ مردود**", () => {
    const w = withWork(world())
    const submitted = submit(w)
    approveRequest(w.approval, approvalContext(w, "u-square"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    const again = approveRequest(w.approval, approvalContext(w, "u-square"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    expect(!again.ok && again.error.code).toBe("LOCKED")
  })

  it("**وإعادةُ تقديمِ فترةٍ معتمَدةٍ مردودة** (ق-٦٧: فريدٌ لكل وحدة/فترة)", () => {
    const w = withWork(world())
    const submitted = submit(w)
    approveRequest(w.approval, approvalContext(w, "u-square"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })
    const again = submit(w)
    expect(!again.ok && again.error.code).toBe("DUPLICATE_PERIOD")
  })

  it("**وقيدٌ يوميٌّ جديدٌ على أسبوعٍ معتمَدٍ مرفوض** — لا رفعَ للمجموع المعتمَد", () => {
    const w = withWork(world())
    const submitted = submit(w)
    approveRequest(w.approval, approvalContext(w, "u-square"), {
      requestId: submitted.ok ? submitted.value.id : "",
    })

    const locked = dailyLogContext("u-amir", {
      isPeriodLocked: weeklyRecordLockCheck(w.approval),
    })
    const r = recordDailyEntry(w.log, locked, {
      clientUuid: "wr-after",
      unitId: KHALID,
      activityId: "lesson",
      count: 5,
      date: NOW,
    })
    expect(!r.ok && r.error.code).toBe("PERIOD_LOCKED")
  })

  it("**وأسبوعٌ لم يُعتمد بعدُ يبقى مفتوحاً للكتابة** — القفلُ بالاعتماد لا بالتقديم", () => {
    const w = withWork(world())
    submit(w)
    const stillOpen = dailyLogContext("u-amir", {
      isPeriodLocked: weeklyRecordLockCheck(w.approval),
    })
    const r = recordDailyEntry(w.log, stillOpen, {
      clientUuid: "wr-open",
      unitId: KHALID,
      activityId: "jamaah",
      count: 1,
      date: NOW,
    })
    expect(r.ok).toBe(true)
  })
})

describe("ب-٣٩د — القفلُ الزمنيُّ **من الإعداد** لا رقمٌ صلب", () => {
  const OLD_WEEK = "2026-01-03"
  const OLD_PERIOD = { id: OLD_WEEK, endsAt: weekEndExclusive(OLD_WEEK) }

  function withOldWork(): World {
    const w = world()
    const past = dailyLogContext("u-amir", { now: new Date("2026-01-05T00:00:00.000Z") })
    const r = recordDailyEntry(w.log, past, {
      clientUuid: "wr-old",
      unitId: KHALID,
      activityId: "lesson",
      count: 1,
      date: new Date("2026-01-05T00:00:00.000Z"),
    })
    if (!r.ok) throw new Error(r.error.code)
    return w
  }

  it("**تقديمُ فترةٍ أمضت أكثرَ من مدة القفل مردود**", () => {
    const w = withOldWork()
    const r = submitForApproval(w.approval, approvalContext(w, "u-amir"), {
      typeId: WEEKLY_RECORD.id,
      unitPath: KHALID_PATH,
      period: OLD_PERIOD,
    })
    expect(!r.ok && r.error.code).toBe("PERIOD_TIME_LOCKED")
  })

  it("**ورفعُ الإعداد وحده يغيّر السلوك بلا تغيير سطرِ كود** (قب-٦/G14)", () => {
    const w = withOldWork()
    const ctx = approvalContext(w, "u-amir", {
      settings: [
        { settingId: "records.backdate_lock_days", scopePath: "/men/", value: 400, validFrom: FROM },
      ],
    })
    const r = submitForApproval(w.approval, ctx, {
      typeId: WEEKLY_RECORD.id,
      unitPath: KHALID_PATH,
      period: OLD_PERIOD,
    })
    expect(r.ok).toBe(true)
  })
})
