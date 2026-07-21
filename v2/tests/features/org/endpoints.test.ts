/**
 * دوال الخادم المُعلَنة — SPEC_org_and_accounts §٥ + SPEC_authorization §٥.٢.
 * **هنا تصير G7 عاملةً**: دوالٌ حقيقية تمرّ بـ`defineServerFn` بإعلان قدرتها.
 * الفرض قبل الجسم · النطاق يُشتقّ من الكيان المخزَّن · قب-١١/ق-م٢ (التوفير للمربع لا التعديل).
 */
import { describe, it, expect, beforeEach } from "vitest"
import { seedWorld, NOW } from "./_seed.js"
import { makeOrgEndpoints } from "../../../src/features/org/server/endpoints.js"
import { buildActor } from "../../../src/features/org/services/session.js"
import {
  registeredServerFns,
  clearRegistryForTests,
} from "../../../src/server/defineServerFn.js"
import type { Actor, DecisionContext } from "../../../src/authorization/can.js"

const CTX: DecisionContext = { now: NOW, intent: "read", isFeatureEnabled: () => true }
const anonymous: Actor = {
  personId: "anonymous",
  accountStatus: "active",
  sessionEpoch: 0,
  currentSessionEpoch: 0,
  assignments: [],
  overrides: [],
}

beforeEach(() => clearRegistryForTests())

describe("G7 عاملة: الوحدة تسجّل دوالَ خادمٍ مُعلَنة (المُعلِنة > ٠)", () => {
  it("كل دوال الوحدة مسجَّلة بإعلان قدرتها", () => {
    const { store } = seedWorld()
    makeOrgEndpoints(store)
    expect(registeredServerFns().length).toBeGreaterThan(0)
    for (const fn of registeredServerFns()) {
      expect(fn.declaration.capability).toBeDefined()
      expect(fn.declaration.audit.length).toBeGreaterThan(0)
    }
  })
})

describe("الفرض قبل الجسم — التوفير عبر نقطة خادمٍ محروسة", () => {
  it("الأمير يوفّر على مسجده عبر النقطة", async () => {
    const { store, actor } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const r = await ep.provision.invoke(
      { targetUnitId: "khalid", targetRoleId: "teacher", username: "ep-teacher" },
      actor("u-amir"),
      CTX,
    )
    expect(r.ok).toBe(true)
  })

  it("المحفّظ لا يوفّر — لا يحمل القدرة (رفضٌ قبل الجسم)", async () => {
    const { store } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const teacher = buildActor(store, "u-teacher")
    const r = await ep.provision.invoke(
      { targetUnitId: "khalid", targetRoleId: "student", username: "x" },
      teacher,
      CTX,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.decision.reason).toBe("DENIED_NO_CAPABILITY")
  })

  it("النطاق يُشتقّ من الكيان المخزَّن — وحدةٌ غير موجودة تُقفل (NO_SCOPE ⇒ رفض)", async () => {
    const { store, actor } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const r = await ep.provision.invoke(
      { targetUnitId: "ghost", targetRoleId: "teacher", username: "x" },
      actor("u-amir"),
      CTX,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })
})

describe("إنشاء الوحدة عبر النقطة — النطاق من الأب المخزَّن", () => {
  it("مشرف عام القسم ينشئ منطقةً تحت قسمه", async () => {
    const { store, actor } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const r = await ep.createUnit.invoke(
      { parentId: "men", id: "hama", type: "region", labelAr: "منطقة حماة" },
      actor("u-section-head"),
      CTX,
    )
    expect(r.ok).toBe(true)
  })

  it("المحفّظ لا ينشئ وحدة", async () => {
    const { store } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const teacher = buildActor(store, "u-teacher")
    const r = await ep.createUnit.invoke(
      { parentId: "men", id: "z", type: "region", labelAr: "x" },
      teacher,
      CTX,
    )
    expect(r.ok).toBe(false)
  })
})

describe("قب-١١/ق-م٢: التوفير للمربع والأمير — لا تعديل تكاليف", () => {
  it("مشرف عام القسم ينهي تكليفاً (يملك user.manage)", async () => {
    const { store, actor } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const own = store.assignmentsForPerson("u-amir")[0]!
    const r = await ep.endAssignment.invoke({ assignmentId: own.id }, actor("u-section-head"), CTX)
    expect(r.ok).toBe(true)
  })

  it("مسؤول المربع لا ينهي تكليفاً — يكفيه التوفير (فصلُ مهام)", async () => {
    const { store, actor } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const own = store.assignmentsForPerson("u-amir")[0]!
    const r = await ep.endAssignment.invoke({ assignmentId: own.id }, actor("u-square"), CTX)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.decision.reason).toBe("DENIED_NO_CAPABILITY")
  })

  it("والأمير كذلك لا ينهي تكاليف مسجده", async () => {
    const { store, actor } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const own = store.assignmentsForPerson("u-teacher")[0]!
    const r = await ep.endAssignment.invoke({ assignmentId: own.id }, actor("u-amir"), CTX)
    expect(r.ok).toBe(false)
  })
})

describe("المسار العام المعلن — طلب التسجيل من تحت", () => {
  it("يعمل بلا هوية ويكتب كياناً معلّقاً واحداً", async () => {
    const { store } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const before = store.requests.size
    const r = await ep.publicRequest.invoke(
      { username: "walkin", requestedRoleId: "teacher", requestedUnitId: "khalid" },
      anonymous,
      CTX,
    )
    expect(r.ok).toBe(true)
    expect(store.requests.size).toBe(before + 1)
  })
})

describe("تحريك وأرشفة الوحدة عبر النقطة", () => {
  it("مشرف عام القسم يحرّك وحدةً داخل نطاقه", async () => {
    const { store, actor } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const r = await ep.moveUnit.invoke({ unitId: "bilal", newParentId: "sq7" }, actor("u-section-head"), CTX)
    expect(r.ok).toBe(true)
  })

  it("مشرف عام القسم يؤرشف وحدةً في نطاقه", async () => {
    const { store, actor } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const r = await ep.archiveUnit.invoke({ unitId: "bilal" }, actor("u-section-head"), CTX)
    expect(r.ok).toBe(true)
  })

  it("المحفّظ لا يحرّك ولا يؤرشف — رفضٌ قبل الجسم", async () => {
    const { store } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const teacher = buildActor(store, "u-teacher")
    expect((await ep.moveUnit.invoke({ unitId: "bilal", newParentId: "sq7" }, teacher, CTX)).ok).toBe(false)
    expect((await ep.archiveUnit.invoke({ unitId: "bilal" }, teacher, CTX)).ok).toBe(false)
  })
})

describe("بتّ طلب التسجيل عبر النقطة (registration.approve)", () => {
  it("الأمير يبتّ طلباً على مسجده فيتحوّل إلى إسنادٍ معتمَد", async () => {
    const { store, actor } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const req = await ep.publicRequest.invoke(
      { username: "ep-req", requestedRoleId: "teacher", requestedUnitId: "khalid" },
      anonymous,
      CTX,
    )
    expect(req.ok).toBe(true)
    if (!req.ok) return
    const requestId = req.value.ok ? req.value.value.id : ""
    const done = await ep.approveRegistration.invoke({ requestId }, actor("u-amir"), CTX)
    expect(done.ok).toBe(true)
  })

  it("بتُّ طلبٍ لوحدةٍ غير موجودة يُقفل (NO_SCOPE ⇒ رفض)", async () => {
    const { store, actor } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const req = await ep.publicRequest.invoke(
      { username: "ep-ghost", requestedRoleId: "teacher", requestedUnitId: "ghost" },
      anonymous,
      CTX,
    )
    if (!req.ok || !req.value.ok) return
    const done = await ep.approveRegistration.invoke({ requestId: req.value.value.id }, actor("u-amir"), CTX)
    expect(done.ok).toBe(false)
  })
})

describe("إعادة تعيين كلمة المرور عبر النقطة", () => {
  it("مشرف عام القسم يعيد تعيين كلمة مرور حسابٍ في نطاقه", async () => {
    const { store, actor } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const r = await ep.resetPassword.invoke({ personId: "u-amir" }, actor("u-section-head"), CTX)
    expect(r.ok).toBe(true)
  })
})

describe("تغيير حالة الحساب عبر النقطة", () => {
  it("مشرف عام القسم يجمّد حساباً في نطاقه", async () => {
    const { store, actor } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const r = await ep.setStatus.invoke(
      { personId: "u-amir", status: "suspended" },
      actor("u-section-head"),
      CTX,
    )
    expect(r.ok).toBe(true)
    expect(store.getAccount("u-amir")?.status).toBe("suspended")
  })

  it("المحفّظ لا يجمّد حساباً", async () => {
    const { store } = seedWorld()
    const ep = makeOrgEndpoints(store)
    const teacher = buildActor(store, "u-teacher")
    const r = await ep.setStatus.invoke(
      { personId: "u-amir", status: "suspended" },
      teacher,
      CTX,
    )
    expect(r.ok).toBe(false)
  })
})
