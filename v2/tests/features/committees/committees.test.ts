/**
 * ب-١٨ + ع-١٧ + ق-٣١ — **تشكيلُ اللجان وأعضاؤها أسماءٌ حرّة**.
 *
 * ثلاثةُ ثوابتٍ تُختبر هنا بأسمائها:
 *  ١. الأميرُ يشكّل لجانَ مسجده، ومسؤولُ اللجنة **إمّا صاحبُ حسابٍ مكَّنه الأمير** (ع-١٧)
 *     **وإمّا اسمٌ حرٌّ بلا حساب** (ق-٣١) — والوحدةُ **لا تُنشئ حساباً أبداً**.
 *  ٢. **أعضاءُ اللجنة أسماءٌ حرّة**: كيانُ العضو **لا يحمل معرّفَ شخصٍ أصلاً** — استحالةٌ
 *     بالبنية لا انضباطٌ يُنسى (ق-٣١، وهي علاجُ «تعيينُ مسؤولِ لجنةٍ كان يبحث في كل أشخاص النظام»).
 *  ٣. **عزلُ النطاق**: لجانُ مسجدٍ لا تُرى من مسجدٍ آخر، والمشرفُ فوقهما يراهما (ق-١٧).
 */
import { describe, it, expect } from "vitest"
import {
  formCommittee,
  deactivateCommittee,
  committeesWithin,
  committeesLedBy,
} from "../../../src/features/committees/services/committees.js"
import { addMember, membersOf } from "../../../src/features/committees/services/members.js"
import {
  BILAL,
  BILAL_PATH,
  DAWAH,
  HOMS_PATH,
  KHALID,
  KHALID_PATH,
  RELIEF,
  SQ2_PATH,
  committeeContext,
  seedCommitteeStore,
} from "./_seed.js"

function seedWithCommittee() {
  const store = seedCommitteeStore()
  const formed = formCommittee(store, committeeContext("u-amir"), {
    id: RELIEF.id,
    mosqueUnitId: KHALID,
    labelAr: RELIEF.labelAr,
    headPersonId: RELIEF.headPersonId,
    headNameAr: RELIEF.headNameAr,
  })
  if (!formed.ok) throw new Error(formed.error.code)
  return { store, committee: formed.value }
}

describe("ب-١٨/ع-١٧ — الأميرُ يشكّل لجنةً، ومسارُها مشتقٌّ من مسجده", () => {
  it("لجنةُ الأمير تُنشأ بمسارٍ **تحت مسجده** — فيصير الأميرُ أقربَ سلَفٍ فوقها (ق-١٣)", () => {
    const { committee } = seedWithCommittee()
    expect(committee.mosquePath).toBe(KHALID_PATH)
    expect(committee.path).toBe(`${KHALID_PATH}${RELIEF.id}/`)
    expect(committee.path.startsWith(KHALID_PATH)).toBe(true)
    expect(committee.path).not.toBe(KHALID_PATH)
  })

  it("ومسؤولُها صاحبُ الحساب يُربط بمعرّفه — **والوحدةُ لم تُنشئ حساباً** (التوفيرُ في org)", () => {
    const { committee } = seedWithCommittee()
    expect(committee.headPersonId).toBe(RELIEF.headPersonId)
    expect(committee.headNameAr).toBe(RELIEF.headNameAr)
  })

  it("**واسمٌ حرٌّ بلا حساب مقبولٌ مسؤولاً** (ق-٣١): يُحفظ الاسمُ ويبقى معرّفُ الشخص فارغاً", () => {
    const store = seedCommitteeStore()
    const formed = formCommittee(store, committeeContext("u-amir"), {
      id: DAWAH.id,
      mosqueUnitId: KHALID,
      labelAr: DAWAH.labelAr,
      headPersonId: DAWAH.headPersonId,
      headNameAr: DAWAH.headNameAr,
    })
    if (!formed.ok) throw new Error(formed.error.code)
    expect(formed.value.headPersonId).toBeNull()
    expect(formed.value.headNameAr).toBe(DAWAH.headNameAr)
  })

  it("ووحدةٌ مجهولةٌ ترفض التشكيل — الكيانُ غيرُ الموجود يُقفل ولا يُفتح", () => {
    const store = seedCommitteeStore()
    const formed = formCommittee(store, committeeContext("u-amir"), {
      id: "cm-ghost",
      mosqueUnitId: "لا-وحدة",
      labelAr: "لجنةٌ بلا مسجد",
      headPersonId: null,
      headNameAr: "فلان",
    })
    expect(formed.ok).toBe(false)
    if (!formed.ok) expect(formed.error.code).toBe("UNKNOWN_MOSQUE_UNIT")
  })

  it("ولا لجنتان بمعرّفٍ واحد (المعرّفُ واحدٌ في السجل)", () => {
    const { store } = seedWithCommittee()
    const again = formCommittee(store, committeeContext("u-amir"), {
      id: RELIEF.id,
      mosqueUnitId: KHALID,
      labelAr: "لجنةٌ مكرّرة",
      headPersonId: null,
      headNameAr: "فلان",
    })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.error.code).toBe("DUPLICATE_COMMITTEE")
  })

  it("واسمُ اللجنة الفارغ مرفوضٌ — لا كيانَ بلا اسمٍ يُقرأ", () => {
    const store = seedCommitteeStore()
    const formed = formCommittee(store, committeeContext("u-amir"), {
      id: "cm-blank",
      mosqueUnitId: KHALID,
      labelAr: "   ",
      headPersonId: null,
      headNameAr: "فلان",
    })
    expect(formed.ok).toBe(false)
    if (!formed.ok) expect(formed.error.code).toBe("EMPTY_LABEL")
  })

  it("واسمُ المسؤول الفارغ مرفوضٌ — لجنةٌ بلا مسؤولٍ مسمّىً ليست لجنة (ق-٣١)", () => {
    const store = seedCommitteeStore()
    const formed = formCommittee(store, committeeContext("u-amir"), {
      id: "cm-headless",
      mosqueUnitId: KHALID,
      labelAr: "لجنةٌ بلا مسؤول",
      headPersonId: null,
      headNameAr: "  ",
    })
    expect(formed.ok).toBe(false)
    if (!formed.ok) expect(formed.error.code).toBe("EMPTY_HEAD_NAME")
  })

  it("**والإيقافُ حالةٌ في البيانات لا محو** (المادة ٧/٤): تُوقَف فتخرج من العاملة وتبقى محفوظة", () => {
    const { store } = seedWithCommittee()
    const stopped = deactivateCommittee(store, committeeContext("u-amir"), { committeeId: RELIEF.id })
    expect(stopped.ok).toBe(true)
    expect(store.getCommittee(RELIEF.id)).not.toBeNull()
    expect(committeesWithin(store, KHALID_PATH).map((c) => c.id)).not.toContain(RELIEF.id)
    expect(committeesWithin(store, KHALID_PATH, { includeInactive: true }).map((c) => c.id)).toContain(
      RELIEF.id,
    )
  })

  it("وإيقافُ لجنةٍ مجهولةٍ مردود", () => {
    const store = seedCommitteeStore()
    const stopped = deactivateCommittee(store, committeeContext("u-amir"), { committeeId: "لا-لجنة" })
    expect(stopped.ok).toBe(false)
    if (!stopped.ok) expect(stopped.error.code).toBe("COMMITTEE_NOT_FOUND")
  })
})

describe("ق-٣١ — أعضاءُ اللجنة أسماءٌ حرّة: **لا حسابَ ولا معرّفَ شخصٍ في الكيان**", () => {
  it("يُضاف العضوُ باسمه النصّيّ وحده، وكيانُ العضو **لا يحمل حقلَ معرّفِ شخصٍ إطلاقاً**", () => {
    const { store, committee } = seedWithCommittee()
    const added = addMember(store, committeeContext("u-committee-head"), {
      committeeId: committee.id,
      nameAr: "عبد الله",
    })
    if (!added.ok) throw new Error(added.error.code)

    expect(added.value.nameAr).toBe("عبد الله")
    // **الاستحالةُ بالبنية**: لا مفتاحَ اسمُه معرّفُ شخصٍ في كيان العضو أصلاً.
    expect(Object.keys(added.value)).toEqual(["tenantId", "id", "committeeId", "nameAr"])
    expect(Object.keys(added.value)).not.toContain("personId")
  })

  it("وأسماءٌ خمسةٌ تُضاف بلا حساب — العددُ في اللجنة خمسةٌ ولا حسابَ أُنشئ", () => {
    const { store, committee } = seedWithCommittee()
    for (const nameAr of ["أحمد", "بلال", "خالد", "زيد", "عمر"]) {
      const r = addMember(store, committeeContext("u-committee-head"), {
        committeeId: committee.id,
        nameAr,
      })
      expect(r.ok).toBe(true)
    }
    expect(membersOf(store, committee.id)).toHaveLength(5)
  })

  it("والاسمُ الفارغ مرفوض — لا عضوَ بلا اسمٍ يُقرأ", () => {
    const { store, committee } = seedWithCommittee()
    const added = addMember(store, committeeContext("u-committee-head"), {
      committeeId: committee.id,
      nameAr: "   ",
    })
    expect(added.ok).toBe(false)
    if (!added.ok) expect(added.error.code).toBe("EMPTY_MEMBER_NAME")
  })

  it("وعضوٌ في لجنةٍ مجهولةٍ مرفوض", () => {
    const { store } = seedWithCommittee()
    const added = addMember(store, committeeContext("u-committee-head"), {
      committeeId: "لا-لجنة",
      nameAr: "عبد الله",
    })
    expect(added.ok).toBe(false)
    if (!added.ok) expect(added.error.code).toBe("COMMITTEE_NOT_FOUND")
  })

  it("ولا يُضاف عضوٌ إلى لجنةٍ موقوفة", () => {
    const { store, committee } = seedWithCommittee()
    deactivateCommittee(store, committeeContext("u-amir"), { committeeId: committee.id })
    const added = addMember(store, committeeContext("u-committee-head"), {
      committeeId: committee.id,
      nameAr: "عبد الله",
    })
    expect(added.ok).toBe(false)
    if (!added.ok) expect(added.error.code).toBe("COMMITTEE_INACTIVE")
  })
})

describe("عزلُ النطاق — لجنةٌ لا تُرى من مسجدٍ آخر، والمشرفُ فوقهما يراهما (ق-١٧)", () => {
  function twoMosques() {
    const store = seedCommitteeStore()
    formCommittee(store, committeeContext("u-amir"), {
      id: RELIEF.id,
      mosqueUnitId: KHALID,
      labelAr: RELIEF.labelAr,
      headPersonId: RELIEF.headPersonId,
      headNameAr: RELIEF.headNameAr,
    })
    formCommittee(store, committeeContext("u-amir-bilal"), {
      id: DAWAH.id,
      mosqueUnitId: BILAL,
      labelAr: DAWAH.labelAr,
      headPersonId: null,
      headNameAr: DAWAH.headNameAr,
    })
    return store
  }

  it("نطاقُ مسجد خالد يرى لجنتَه وحدها — **ولا يرى لجنة بلال**", () => {
    const ids = committeesWithin(twoMosques(), KHALID_PATH).map((c) => c.id)
    expect(ids).toEqual([RELIEF.id])
  })

  it("ونطاقُ مسجد بلال يرى لجنتَه وحدها", () => {
    const ids = committeesWithin(twoMosques(), BILAL_PATH).map((c) => c.id)
    expect(ids).toEqual([DAWAH.id])
  })

  it("**والمربعُ فوقهما يرى الاثنتين** (الاطّلاعُ الهابط مباحٌ دائماً — ق-١٧)", () => {
    const ids = committeesWithin(twoMosques(), SQ2_PATH).map((c) => c.id)
    expect(ids).toEqual([DAWAH.id, RELIEF.id])
  })

  it("والمنطقةُ كذلك تراهما — الاحتواءُ لا الدور", () => {
    expect(committeesWithin(twoMosques(), HOMS_PATH)).toHaveLength(2)
  })

  it("**ومسؤولُ اللجنة لا يقود إلا لجنتَه** (`committee.own` ملكيةٌ لا نطاق)", () => {
    const store = twoMosques()
    const mine = committeesLedBy(store, RELIEF.headPersonId)
    expect(mine.map((c) => c.id)).toEqual([RELIEF.id])
    expect(committeesLedBy(store, "u-teacher")).toEqual([])
  })
})
