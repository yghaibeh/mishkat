/**
 * **الاختبارُ الإلزاميّ السادس** (T16) — **قب-٣٨/CR-012**: القدرةُ الشخصية تسأل **الدورَ
 * والملكيةَ معاً**.
 *
 * كان في v1 «حلقاتي» عالماً ثانياً للحلقة (ز-٢) فوقع ع-١١ («عومل مشرفاً لا معلماً») وع-٢٩.
 * وفي v2 «حلقاتي» **عدسةُ ملكيةٍ على الكيان نفسِه** — ومسارُ قرارها في المحرّك:
 *  ١. **حزمةُ دورِك تحمل `circle.teach`؟** وإلا `DENIED_PERSONAL_NOT_IN_ROLE` — **ولو أُسنِدت
 *     إليك الحلقةُ فعلاً**. فالإسنادُ وحده لا يفتح باباً.
 *  ٢. **وأنت صاحبُها؟** وإلا `DENIED_PERSONAL_NOT_OWNER` — فصفحةُ غيرِك مرفوضة.
 * والمخرجُ المعلَن وحده: **منحٌ فرديٌّ صريح** عند شغور الدور (§١.٤).
 */
import { describe, it, expect, beforeEach } from "vitest"
import { assignTeacher } from "../../../src/features/circles/services/circles.js"
import { makeCirclesEndpoints } from "../../../src/features/circles/server/endpoints.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import type { Actor } from "../../../src/authorization/can.js"
import {
  canonicalActor,
  canonicalDirectory,
  circlesContext,
  DECISION,
  NOW,
  seedCircle,
  seedCirclesStore,
  WRITE,
} from "./_seed.js"

beforeEach(() => clearRegistryForTests())

/** حلقةٌ في مسجد خالد مُسنَدةٌ إلى شخصٍ بعينه — بالمسار المُعلَن لا بحقنٍ في المستودع. */
function seedAssigned(personId: string) {
  const store = seedCirclesStore()
  const circleId = seedCircle(store)
  const done = assignTeacher(store, circlesContext("u-amir"), {
    circleId,
    teacherPersonId: personId,
  })
  if (!done.ok) throw new Error(done.error.code)
  return { store, circleId }
}

describe("قب-٣٨ — **مُسنَدٌ بلا دور المعلّم ⇒ `circle.teach` مرفوضةٌ بالسبب المميِّز**", () => {
  it("مسؤولُ اللجنة أُسنِدت له حلقةٌ فعلاً — ودورُه لا يحمل القدرة ⇒ `DENIED_PERSONAL_NOT_IN_ROLE`", async () => {
    const { store, circleId } = seedAssigned("u-committee-head")
    const ep = makeCirclesEndpoints(store, canonicalDirectory)

    // الإسنادُ واقعٌ في البيانات — فليست الحجّةُ «ليست حلقتَه».
    expect(store.getCircle(circleId)?.teacherPersonId).toBe("u-committee-head")

    const rejected = await ep.mine.invoke(
      { personId: "u-committee-head" },
      canonicalActor("u-committee-head"),
      DECISION,
    )
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.decision.reason).toBe("DENIED_PERSONAL_NOT_IN_ROLE")
  })

  it("**والسببُ مميِّزٌ لا مبهم**: «دورُك لا يمنحها» غيرُ «لستَ صاحبَها»", async () => {
    const { store } = seedAssigned("u-teacher")
    const ep = makeCirclesEndpoints(store, canonicalDirectory)

    // معلّمٌ حقيقيٌّ يطلب صفحةَ غيرِه ⇒ **ليس صاحبَها**.
    const notOwner = await ep.mine.invoke(
      { personId: "u-committee-head" },
      canonicalActor("u-teacher"),
      DECISION,
    )
    expect(notOwner.ok).toBe(false)
    if (!notOwner.ok) expect(notOwner.decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")

    // ومديرٌ يطلب صفحةَ نفسِه ⇒ **دورُه لا يمنحها** (سببٌ آخرُ تماماً).
    const notInRole = await ep.mine.invoke(
      { personId: "u-admin" },
      canonicalActor("u-admin"),
      DECISION,
    )
    expect(notInRole.ok).toBe(false)
    if (!notInRole.ok) expect(notInRole.decision.reason).toBe("DENIED_PERSONAL_NOT_IN_ROLE")
  })

  it("**والمعلّمُ صاحبُ الدورِ والحلقةِ يمرّ** — ويرى حلقاته هو وحده", async () => {
    const { store, circleId } = seedAssigned("u-teacher")
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const seen = await ep.mine.invoke(
      { personId: "u-teacher" },
      canonicalActor("u-teacher"),
      DECISION,
    )
    expect(seen.ok).toBe(true)
    if (seen.ok) {
      expect(seen.value.personId).toBe("u-teacher")
      expect(seen.value.circles.map((c) => c.id)).toEqual([circleId])
    }
  })

  it("**والقراءةُ بمعرّف الجلسة لا بالمدخل**: لا تُقرأ حلقاتُ غيرِك ولو مرّ الفحص", async () => {
    const { store } = seedAssigned("u-teacher")
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const seen = await ep.mine.invoke(
      { personId: "u-teacher" },
      canonicalActor("u-teacher"),
      DECISION,
    )
    if (!seen.ok) throw new Error(seen.decision.reason)
    expect(seen.value.personId).toBe("u-teacher")
  })

  it("**والمخرجُ المعلَن وحده منحٌ فرديّ**: مسؤولُ اللجنة بمنحٍ صريحٍ يمرّ (§١.٤)", async () => {
    const { store } = seedAssigned("u-committee-head")
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const base = canonicalActor("u-committee-head")
    const granted: Actor = {
      ...base,
      overrides: [
        {
          capId: "circle.teach",
          scopePath: "/",
          effect: "grant",
          startDate: new Date(NOW.getTime() - 1),
          endDate: null,
          reason: "شغورُ المعلّم — تكليفٌ مؤقّتٌ بحلقةِ التحفيظ",
        },
      ],
    }
    const seen = await ep.mine.invoke({ personId: "u-committee-head" }, granted, DECISION)
    expect(seen.ok).toBe(true)
  })

  it("**والحجبُ يغلب حتى على المعلّم المالك** (§١.٤)", async () => {
    const { store } = seedAssigned("u-teacher")
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const base = canonicalActor("u-teacher")
    const blocked: Actor = {
      ...base,
      overrides: [
        {
          capId: "circle.teach",
          scopePath: "/",
          effect: "deny",
          startDate: new Date(NOW.getTime() - 1),
          endDate: null,
          reason: "حجبٌ مؤقّتٌ أثناء تحقيقٍ في سجل الحلقة",
        },
      ],
    }
    const rejected = await ep.mine.invoke({ personId: "u-teacher" }, blocked, DECISION)
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.decision.reason).toBe("DENIED_EXPLICIT_BLOCK")
  })
})

describe("§٤ — **الإسنادُ فعلُ الأمير**، والمُسنَدُ إليه من أهل الوحدة", () => {
  it("الأميرُ يُسنِد معلّمَ مسجده", async () => {
    const store = seedCirclesStore()
    const circleId = seedCircle(store)
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const done = await ep.assignTeacher.invoke(
      { circleId, teacherPersonId: "u-teacher" },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(done.ok).toBe(true)
  })

  it("**والمعلّمُ لا يُسنِد نفسَه** — الإنشاءُ والإسنادُ للأمير (ق-٨٤ وهامش م-١٠)", async () => {
    const store = seedCirclesStore()
    const circleId = seedCircle(store)
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    const rejected = await ep.assignTeacher.invoke(
      { circleId, teacherPersonId: "u-teacher" },
      canonicalActor("u-teacher"),
      WRITE,
    )
    expect(rejected.ok).toBe(false)
  })

  it("**ومَن لا تكليفَ له في الوحدة لا يُسنَد** ⇒ `TEACHER_OUT_OF_SCOPE` (يُقاس بالمسار لا بالمسمّى)", () => {
    const store = seedCirclesStore()
    const circleId = seedCircle(store)
    const rejected = assignTeacher(store, circlesContext("u-amir"), {
      circleId,
      teacherPersonId: "u-amir-bilal",
    })
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.error.code).toBe("TEACHER_OUT_OF_SCOPE")
  })

  it("**ولا يكفي أن يكون فوقَك في الشجرة**: مسؤولُ المربع ليس داخلَ وحدة المسجد", () => {
    const store = seedCirclesStore()
    const circleId = seedCircle(store)
    const rejected = assignTeacher(store, circlesContext("u-amir"), {
      circleId,
      teacherPersonId: "u-square",
    })
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.error.code).toBe("TEACHER_OUT_OF_SCOPE")
  })

  it("وتكليفٌ منتهٍ أو معلَّقٌ لا يُبلِّغ الوحدةَ (ق-٢٤/ق-٢٥)", () => {
    const store = seedCirclesStore()
    const circleId = seedCircle(store, { unitId: "bilal", actorPersonId: "u-amir-bilal" })
    const ended = assignTeacher(store, circlesContext("u-amir-bilal"), {
      circleId,
      teacherPersonId: "u-ended",
    })
    expect(ended.ok).toBe(false)

    const omarCircle = seedCircle(store, { unitId: "omar", actorPersonId: "u-amir-omar" })
    const pending = assignTeacher(store, circlesContext("u-amir-omar"), {
      circleId: omarCircle,
      teacherPersonId: "u-pending",
    })
    expect(pending.ok).toBe(false)
  })

  it("**ونزعُ الإسناد ممكنٌ**: `null` يُخلي الحلقةَ من معلّمها بلا حذفِ الحلقة", () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    const circleId = seedCircle(store)
    assignTeacher(store, ctx, { circleId, teacherPersonId: "u-teacher" })
    const cleared = assignTeacher(store, ctx, { circleId, teacherPersonId: null })
    expect(cleared.ok).toBe(true)
    expect(store.getCircle(circleId)?.teacherPersonId).toBeNull()
  })

  it("وإسنادٌ لحلقةٍ مؤرشفةٍ مرفوضٌ (`CIRCLE_ARCHIVED`) — لا عملَ على مؤرشف", async () => {
    const store = seedCirclesStore()
    const ctx = circlesContext("u-amir")
    const circleId = seedCircle(store)
    const ep = makeCirclesEndpoints(store, canonicalDirectory)
    await ep.archive.invoke({ circleId }, canonicalActor("u-amir"), WRITE)
    const rejected = assignTeacher(store, ctx, { circleId, teacherPersonId: "u-teacher" })
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.error.code).toBe("CIRCLE_ARCHIVED")
  })
})
