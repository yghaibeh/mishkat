/**
 * حوافُّ الوحدة — **الحالاتُ التي تُنسى فتُكلِّف** (TESTING_POLICY §٤ الطبقةُ الثالثة).
 *
 * ثلاثُ عائلاتٍ لا رابعةَ لها هنا:
 *  ١. **الذرّية**: عطبٌ في منتصف الكتابة يُرجع المستودعَ كما كان — **بما فيه العدّاد**،
 *     فالفشلُ لا يحرق معرّفاً (نفسُ درس ق-٥٦ في الدفتر).
 *  ٢. **الإعدادُ بنوعٍ خاطئ حالةٌ برمجيةٌ تُلقى ولا تُبتلَع** (المادة ٣/٤): إعدادٌ يُفترض
 *     مفتاحاً فيأتي رقماً **يجب أن ينفجر** لا أن يُقرأ «صواباً» صامتاً.
 *  ٣. **مفاتيحُ التفعيل تسري على كل بابٍ** لا على بابٍ واحد (قب-٧).
 */
import { describe, it, expect } from "vitest"
import { CommitteeStore } from "../../../src/features/committees/data/store.js"
import {
  committeePath,
  deactivateCommittee,
  formCommittee,
} from "../../../src/features/committees/services/committees.js"
import { addMember } from "../../../src/features/committees/services/members.js"
import { recordActivity } from "../../../src/features/committees/services/activities.js"
import {
  areCommitteesEnabled,
  areMeetingsEnabled,
  isFutureDatingAllowed,
} from "../../../src/features/committees/services/context.js"
import { err, ok } from "../../../src/features/committees/types.js"
import {
  KHALID,
  KHALID_PATH,
  MAIN_TENANT_ID,
  NOW,
  PERIOD,
  RELIEF,
  committeeContext,
  seedCommitteeStore,
} from "./_seed.js"

const FROM = new Date("2026-01-01T00:00:00.000Z")

function off(settingId: string, value: unknown) {
  return committeeContext("u-amir", [
    { settingId, scopePath: "/", value: value as boolean, validFrom: FROM },
  ])
}

function seeded() {
  const store = seedCommitteeStore()
  const formed = formCommittee(store, committeeContext("u-amir"), {
    id: RELIEF.id,
    mosqueUnitId: KHALID,
    labelAr: RELIEF.labelAr,
    headPersonId: RELIEF.headPersonId,
    headNameAr: RELIEF.headNameAr,
  })
  if (!formed.ok) throw new Error(formed.error.code)
  return store
}

describe("الذرّية — الفشلُ يُرجع كلَّ شيءٍ **بما فيه العدّاد**", () => {
  it("رميةٌ داخل المعاملة تُرجع الكياناتِ والعدّادَ معاً — فلا يُحرق معرّف", () => {
    const store = seeded()
    const before = store.committees().length

    expect(() =>
      store.transaction(() => {
        store.saveMember({
          tenantId: MAIN_TENANT_ID,
          id: store.nextId("cmm"),
          committeeId: RELIEF.id,
          nameAr: "عضوٌ لن يبقى",
        })
        throw new Error("عطبٌ في منتصف الدفعة")
      }),
    ).toThrow("عطبٌ في منتصف الدفعة")

    expect(store.members()).toHaveLength(0)
    expect(store.committees()).toHaveLength(before)
    // **العدّادُ ارتدّ**: المعرّفُ التالي هو نفسُه الذي أُحرق في المحاولة الفاشلة.
    const kept = addMember(store, committeeContext(RELIEF.headPersonId), {
      committeeId: RELIEF.id,
      nameAr: "عضوٌ باقٍ",
    })
    if (!kept.ok) throw new Error(kept.error.code)
    expect(kept.value.id).toBe("cmm-1")
  })

  it("والمعاملةُ الناجحةُ تُبقي ما كتبته (وإلا فالارتدادُ يبتلع الصحيح)", () => {
    const store = seeded()
    const value = store.transaction(() => {
      store.saveMeeting({
        tenantId: MAIN_TENANT_ID,
        id: store.nextId("mtg"),
        mosqueUnitId: KHALID,
        mosquePath: KHALID_PATH,
        heldAt: NOW,
        minutesAr: "محضر",
        decisionsAr: ["قرار"],
      })
      return "تمّ"
    })
    expect(value).toBe("تمّ")
    expect(store.meetings()).toHaveLength(1)
  })

  it("والمستودعُ الفارغُ يجيب بلا شيءٍ لا بانفجار (قراءاتٌ آمنة)", () => {
    const store = new CommitteeStore(MAIN_TENANT_ID)
    expect(store.getUnit("لا-وحدة")).toBeNull()
    expect(store.getCommittee("لا-لجنة")).toBeNull()
    expect(store.getActivity("لا-نشاط")).toBeNull()
    expect(store.committees()).toEqual([])
    expect(store.members()).toEqual([])
    expect(store.activities()).toEqual([])
    expect(store.meetings()).toEqual([])
  })
})

describe("**الإعدادُ بنوعٍ خاطئ يُلقى ولا يُبتلَع** (المادة ٣/٤: الاستثناءُ للحالات البرمجية)", () => {
  it("`feature.committees` رقماً بدل مفتاح ⇒ انفجارٌ مُشخِّص لا «صوابٌ» صامت", () => {
    expect(() => areCommitteesEnabled(off("feature.committees", 5), KHALID_PATH)).toThrow(
      /feature.committees/,
    )
  })

  it("و`feature.meetings` كذلك", () => {
    expect(() => areMeetingsEnabled(off("feature.meetings", "نعم"), KHALID_PATH)).toThrow(
      /feature.meetings/,
    )
  })

  it("و`records.allow_future_dating` كذلك", () => {
    expect(() =>
      isFutureDatingAllowed(off("records.allow_future_dating", 1), KHALID_PATH),
    ).toThrow(/records.allow_future_dating/)
  })

  it("والقيمُ الصحيحةُ تُقرأ كما هي — الافتراضاتُ من السجل لا من الكود (قب-٦)", () => {
    const base = committeeContext("u-amir")
    expect(areCommitteesEnabled(base, KHALID_PATH)).toBe(true)
    expect(areMeetingsEnabled(base, KHALID_PATH)).toBe(true)
    expect(isFutureDatingAllowed(base, KHALID_PATH)).toBe(false)
  })
})

describe("**مفتاحُ التفعيل يسري على كل بابٍ** لا على بابٍ واحد (قب-٧)", () => {
  const DISABLED = [
    { settingId: "feature.committees", scopePath: "/", value: false, validFrom: FROM },
  ]

  it("تعطيلُ وحدة اللجان يمنع التشكيلَ والإيقافَ والعضوَ والنشاطَ معاً", () => {
    const store = seeded()
    const ctx = committeeContext("u-amir", DISABLED)

    const formed = formCommittee(store, ctx, {
      id: "cm-after-off",
      mosqueUnitId: KHALID,
      labelAr: "لجنةٌ بعد التعطيل",
      headPersonId: null,
      headNameAr: "فلان",
    })
    const stopped = deactivateCommittee(store, ctx, { committeeId: RELIEF.id })
    const member = addMember(store, ctx, { committeeId: RELIEF.id, nameAr: "عضو" })
    const activity = recordActivity(store, ctx, {
      committeeId: RELIEF.id,
      periodId: PERIOD,
      titleAr: "نشاط",
      participantCount: 0,
      participantNamesAr: [],
      completedAt: NOW,
    })

    for (const r of [formed, stopped, member, activity]) {
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.code).toBe("MODULE_DISABLED")
    }
    // **ولا يحذف بياناتها** (نصُّ الإجراء المرافق في `SPEC_settings`).
    expect(store.getCommittee(RELIEF.id)?.active).toBe(true)
  })
})

describe("ثوابتُ صغيرةٌ تُبنى مرةً فلا تتباعد", () => {
  it("`committeePath` يحفظ ثابتَ التمثيل: يبدأ بـ`/` وينتهي بـ`/` ويحتوي مسارَ مسجده", () => {
    const path = committeePath(KHALID_PATH, "cm-x")
    expect(path).toBe(`${KHALID_PATH}cm-x/`)
    expect(path.startsWith("/")).toBe(true)
    expect(path.endsWith("/")).toBe(true)
  })

  it("و`ok`/`err` قيمتان معلنتان — والتفصيلُ اختياريٌّ لا يُختلق", () => {
    expect(ok("قيمة")).toEqual({ ok: true, value: "قيمة" })
    expect(err("COMMITTEE_NOT_FOUND")).toEqual({ ok: false, error: { code: "COMMITTEE_NOT_FOUND" } })
    expect(err("COMMITTEE_NOT_FOUND", "cm-1")).toEqual({
      ok: false,
      error: { code: "COMMITTEE_NOT_FOUND", detail: "cm-1" },
    })
  })
})
