/**
 * بلاغات الميدان الستة — لكلٍّ اختبارٌ يُثبت **موتَ سببه** (المهمة، معيار القبول ٥).
 * ع-٤ · ع-١٧ · ع-٢٧ · ع-٢٨ (التمكين) · ع-٣٢ (مسارا الإلحاق) · ع-٣٣ (الذرّية).
 */
import { describe, it, expect } from "vitest"
import { seedWorld, NOW } from "./_seed.js"
import { provision, submitPublicRequest, approveRegistration } from "../../../src/features/org/services/provisioning.js"

const CTX = { now: NOW, intent: "write" as const, isFeatureEnabled: () => true }

describe("ع-٤/ع-٢٧: أمير المسجد يُنشئ حساب عامله بنفسه (لا يعود «تعذّرت الإضافة»)", () => {
  it("الأمير يوفّر محفّظاً على مسجده — الحساب والتكليف معاً", () => {
    const w = seedWorld()
    const r = provision(w.store, w.actor("u-amir"), CTX, {
      targetUnitId: "khalid",
      targetRoleId: "teacher",
      username: "muhaffith",
    })
    expect(r.ok).toBe(true)
  })
})

describe("ع-١٧: نمط اللجان صار قاعدةَ النظام لا استثناءً", () => {
  it("الأمير يوفّر مسؤول لجنة كما يوفّر أيَّ دورٍ تحت مسجده", () => {
    const w = seedWorld()
    const r = provision(w.store, w.actor("u-amir"), CTX, {
      targetUnitId: "khalid",
      targetRoleId: "committee_head",
      username: "lajna17",
    })
    expect(r.ok).toBe(true)
  })
})

describe("ع-٢٨: التمكين المفوَّض بلا إدارة مستخدمين مركزية", () => {
  it("مسؤول المربع يوفّر أميراً على مساجد مربعه دون المرور بالمركز", () => {
    const w = seedWorld()
    const r = provision(w.store, w.actor("u-square"), CTX, {
      targetUnitId: "bilal",
      targetRoleId: "amir",
      username: "amir28",
    })
    expect(r.ok).toBe(true)
  })
})

describe("ع-٣٢: مسارا الإلحاق يعملان معاً وينتهيان بإسنادٍ واحد متكافئ", () => {
  it("التمكين من فوق وطلب التسجيل من تحت يُنتجان الإسناد نفسه", () => {
    const w = seedWorld()

    // (أ) من فوق: الأمير يوفّر محفّظاً على مسجده.
    const top = provision(w.store, w.actor("u-amir"), CTX, {
      targetUnitId: "khalid",
      targetRoleId: "teacher",
      username: "top-teacher",
    })
    expect(top.ok).toBe(true)

    // (ب) من تحت: طلبٌ عامّ معلّق ثم يبتّه الأمير (نفس مصفوفة §١.٦).
    const req = submitPublicRequest(w.store, {
      username: "bottom-teacher",
      requestedRoleId: "teacher",
      requestedUnitId: "khalid",
    })
    expect(req.ok).toBe(true)
    if (!req.ok) return
    expect(w.store.getRequest(req.value.id)?.status).toBe("pending")

    const approved = approveRegistration(w.store, w.actor("u-amir"), CTX, req.value.id)
    expect(approved.ok).toBe(true)

    if (top.ok && approved.ok) {
      expect(approved.value.assignment.roleId).toBe(top.value.assignment.roleId)
      expect(approved.value.assignment.scopePath).toBe(top.value.assignment.scopePath)
      expect(approved.value.assignment.approvalStatus).toBe("approved")
    }
  })

  it("بتُّ الطلب يخضع لمصفوفة التمكين — لا يقبل الأقربُ دوراً يتجاوز نطاقه (يقفل خ-٤)", () => {
    const w = seedWorld()
    // طلبٌ لأميرٍ على مسجدٍ خارج مربع مسؤول المربع الآخر — يبتّه أميرٌ لا يملك التوفير عليه.
    const req = submitPublicRequest(w.store, {
      username: "sneaky",
      requestedRoleId: "amir",
      requestedUnitId: "khalid",
    })
    expect(req.ok).toBe(true)
    if (!req.ok) return
    // الأمير لا يوفّر أميراً (ش٢) ⇒ بتُّه للطلب مرفوض بالمصفوفة نفسها.
    const bad = approveRegistration(w.store, w.actor("u-amir"), CTX, req.value.id)
    expect(!bad.ok && bad.error.code).toBe("PROVISION_DENIED")
    expect(w.store.getRequest(req.value.id)?.status).toBe("pending")
  })

  it("يرفض البتَّ إن كان اسمُ الدخول المطلوب محجوزاً — دون أثر", () => {
    const w = seedWorld()
    const req = submitPublicRequest(w.store, {
      username: "u-amir", // محجوزٌ في العالم القانوني
      requestedRoleId: "teacher",
      requestedUnitId: "khalid",
    })
    if (!req.ok) return
    const r = approveRegistration(w.store, w.actor("u-amir"), CTX, req.value.id)
    expect(!r.ok && r.error.code).toBe("USERNAME_TAKEN")
    expect(w.store.getRequest(req.value.id)?.status).toBe("pending")
  })

  it("يرفض بتَّ طلبٍ ليس معلّقاً", () => {
    const w = seedWorld()
    const req = submitPublicRequest(w.store, {
      username: "once",
      requestedRoleId: "teacher",
      requestedUnitId: "khalid",
    })
    if (!req.ok) return
    approveRegistration(w.store, w.actor("u-amir"), CTX, req.value.id)
    const again = approveRegistration(w.store, w.actor("u-amir"), CTX, req.value.id)
    expect(!again.ok && again.error.code).toBe("REQUEST_NOT_PENDING")
  })

  it("المسار العام لا يقرأ الوحدات (CR-001 §ج): التحقُّق كلُّه عند البتّ", () => {
    const w = seedWorld()
    // يُقبل الطلبُ العامّ بلا قراءةٍ شبكية (كتابةُ كيانٍ معلّقٍ واحد)…
    const req = submitPublicRequest(w.store, {
      username: "nowhere",
      requestedRoleId: "teacher",
      requestedUnitId: "ghost",
    })
    expect(req.ok).toBe(true)
    if (!req.ok) return
    // …فإذا بُتّ عليه ووحدتُه غير موجودة رُفض عند البتّ.
    const bad = approveRegistration(w.store, w.actor("u-amir"), CTX, req.value.id)
    expect(!bad.ok && bad.error.code).toBe("ENTITY_NOT_FOUND")
  })
})

describe("ع-٣٣: الذرّية — القبول يُنشئ الهيكلية دفعةً أو لا شيء", () => {
  it("طلبٌ مقبولٌ يُنشئ الحساب والتكليف معاً في دفعةٍ واحدة", () => {
    const w = seedWorld()
    const req = submitPublicRequest(w.store, {
      username: "atomic-approve",
      requestedRoleId: "teacher",
      requestedUnitId: "khalid",
    })
    if (!req.ok) return
    const r = approveRegistration(w.store, w.actor("u-amir"), CTX, req.value.id)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(w.store.getAccount(r.value.account.personId)?.username).toBe("atomic-approve")
      expect(r.value.assignment.approvalStatus).toBe("approved")
    }
  })
})
