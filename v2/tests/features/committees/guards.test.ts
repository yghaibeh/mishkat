/**
 * حرّاسُ الخادم — **الحمايةُ في الخادم لا في الواجهة** (المادة ٤/٦).
 *
 * وفيه ثابتان يُكسران بيدٍ لو خُرقا:
 *  ١. **«لجنتي» ملكيةٌ لا نطاق** (ك-٢٣، `committee.own` صنفُها «ش»): أميرُ المسجد نفسُه —
 *     وهو صاحبُ السلطة على اللجنة — **لا يفتح «لجنتي»** ولا يُدخل نشاطَها باسم مسؤولها؛
 *     ولا المديرُ ولا مسؤولُ لجنةٍ أخرى. القفلُ على **الشخص** لا على الدور.
 *  ٢. **الإدارةُ اطّلاعٌ لا تشغيل** (ق-٣/ق-٤): المديرُ يرى اللجان والاجتماعات ولا يشكّل
 *     لجنةً ولا يسجّل محضراً — وهو غيابٌ **مقرونٌ برفض الخادم** لا إخفاءَ زر.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { makeCommitteeEndpoints } from "../../../src/features/committees/server/endpoints.js"
import { formCommittee } from "../../../src/features/committees/services/committees.js"
import { addMember } from "../../../src/features/committees/services/members.js"
import { recordActivity } from "../../../src/features/committees/services/activities.js"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import {
  BILAL,
  DAWAH,
  KHALID,
  NOW,
  PERIOD,
  READ,
  RELIEF,
  WRITE,
  canonicalActor,
  committeeContext,
  seedCommitteeStore,
} from "./_seed.js"

const SETTINGS = createSettingsResolver([])

beforeEach(() => clearRegistryForTests())

function world() {
  const store = seedCommitteeStore()
  formCommittee(store, committeeContext("u-amir"), {
    id: RELIEF.id,
    mosqueUnitId: KHALID,
    labelAr: RELIEF.labelAr,
    headPersonId: RELIEF.headPersonId,
    headNameAr: RELIEF.headNameAr,
  })
  // لجنةٌ **بمسؤولٍ اسمُه حرٌّ بلا حساب** (ق-٣١) — بابُها الشخصيّ لا يُفتح لأحد.
  formCommittee(store, committeeContext("u-amir-bilal"), {
    id: DAWAH.id,
    mosqueUnitId: BILAL,
    labelAr: DAWAH.labelAr,
    headPersonId: null,
    headNameAr: DAWAH.headNameAr,
  })
  return { store, ep: makeCommitteeEndpoints(store, SETTINGS) }
}

describe("تشكيلُ اللجان — `committees.manage` بنطاق المسجد بعينه", () => {
  it("الأميرُ يشكّل لجنةَ مسجده", async () => {
    const { ep } = world()
    const r = await ep.form.invoke(
      {
        unitId: KHALID,
        committeeId: "cm-new",
        labelAr: "لجنةٌ جديدة",
        headPersonId: null,
        headNameAr: "أبو بكر",
      },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(r.ok).toBe(true)
  })

  it("**والمديرُ لا يشكّل لجنةً** — الإدارةُ اطّلاعٌ لا تشغيل (ق-٣/ق-٤)", async () => {
    const { ep } = world()
    const r = await ep.form.invoke(
      {
        unitId: KHALID,
        committeeId: "cm-admin",
        labelAr: "لجنةُ المدير",
        headPersonId: null,
        headNameAr: "فلان",
      },
      canonicalActor("u-admin"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })

  it("**وأميرُ مسجدٍ آخر لا يشكّل في مسجدٍ ليس له** (`committees.manage` نطاقُها «ذ»)", async () => {
    const { ep } = world()
    const r = await ep.form.invoke(
      {
        unitId: KHALID,
        committeeId: "cm-foreign",
        labelAr: "لجنةٌ غريبة",
        headPersonId: null,
        headNameAr: "فلان",
      },
      canonicalActor("u-amir-bilal"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })

  it("**والمربعُ فوقه لا يشكّل لجنةً في مسجدٍ تحته** — «ذ» لا تسري على ما تحت", async () => {
    const { ep } = world()
    for (const personId of ["u-square", "u-rabita", "u-section-head"]) {
      const r = await ep.form.invoke(
        {
          unitId: KHALID,
          committeeId: `cm-${personId}`,
          labelAr: "لجنةٌ من فوق",
          headPersonId: null,
          headNameAr: "فلان",
        },
        canonicalActor(personId),
        WRITE,
      )
      expect(r.ok, personId).toBe(false)
    }
  })

  it("ووحدةٌ مجهولةٌ ⇒ `NO_SCOPE` ⇒ رفضٌ قبل جسم الدالة", async () => {
    const { ep } = world()
    const r = await ep.form.invoke(
      {
        unitId: "لا-وحدة",
        committeeId: "cm-x",
        labelAr: "لجنة",
        headPersonId: null,
        headNameAr: "فلان",
      },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })
})

describe("عرضُ اللجان — `committees.view` هابطٌ بالاحتواء (ق-١٧)", () => {
  it("المديرُ والمربعُ والمنطقةُ والأميرُ: كلُّهم يرون لجانَ نطاقهم", async () => {
    const { ep } = world()
    for (const personId of ["u-admin", "u-section-head", "u-rabita", "u-square", "u-amir"]) {
      const r = await ep.list.invoke({ unitId: KHALID }, canonicalActor(personId), READ)
      expect(r.ok, personId).toBe(true)
    }
  })

  it("**ومسؤولُ اللجنة لا يرى قائمةَ لجان المسجد** (محظورُه #٣٠ — عدسةُ §٢.٧)", async () => {
    const { ep } = world()
    const r = await ep.list.invoke({ unitId: KHALID }, canonicalActor("u-committee-head"), READ)
    expect(r.ok).toBe(false)
  })

  it("**والمعلّمُ والطالبُ كذلك محجوبان**", async () => {
    const { ep } = world()
    for (const personId of ["u-teacher", "u-student", "u-media", "u-finance"]) {
      const r = await ep.list.invoke({ unitId: KHALID }, canonicalActor(personId), READ)
      expect(r.ok, personId).toBe(false)
    }
  })
})

describe("**«لجنتي» ملكيةٌ لا نطاق** — القفلُ على الشخص لا على الدور (ك-٢٣)", () => {
  it("مسؤولُ اللجنة يفتح لجنتَه — **مصدرٌ واحدٌ** يجمع اللجنةَ وأعضاءَها وأنشطتَها (ق-١١١)", async () => {
    const { store, ep } = world()
    addMember(store, committeeContext(RELIEF.headPersonId), {
      committeeId: RELIEF.id,
      nameAr: "عبد الله",
    })
    recordActivity(store, committeeContext(RELIEF.headPersonId), {
      committeeId: RELIEF.id,
      periodId: PERIOD,
      titleAr: "توزيعُ سلال",
      participantCount: 1,
      participantNamesAr: ["عبد الله"],
      completedAt: NOW,
    })

    const r = await ep.myCommittee.invoke(
      { committeeId: RELIEF.id },
      canonicalActor(RELIEF.headPersonId),
      READ,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.committee.id).toBe(RELIEF.id)
    expect(r.value.members.map((m) => m.nameAr)).toEqual(["عبد الله"])
    expect(r.value.activities).toHaveLength(1)
  })

  it("**وأميرُ المسجد نفسُه لا يفتحها**، ولا المديرُ ولا المربعُ ولا معلّمٌ ولا طالب", async () => {
    const { ep } = world()
    for (const personId of ["u-amir", "u-admin", "u-square", "u-rabita", "u-teacher", "u-student"]) {
      const r = await ep.myCommittee.invoke(
        { committeeId: RELIEF.id },
        canonicalActor(personId),
        READ,
      )
      expect(r.ok, `«${personId}» فتح لجنةَ غيره`).toBe(false)
    }
  })

  it("**ولجنةٌ مسؤولُها اسمٌ حرٌّ بلا حساب لا تُفتح لأحدٍ** (ق-٣١: الملكيةُ شرطُ الباب)", async () => {
    const { ep } = world()
    for (const personId of ["u-committee-head", "u-amir-bilal", "u-admin"]) {
      const r = await ep.myCommittee.invoke({ committeeId: DAWAH.id }, canonicalActor(personId), READ)
      expect(r.ok, personId).toBe(false)
    }
  })

  it("وإضافةُ عضوٍ وتسجيلُ نشاطٍ: لمسؤول اللجنة وحده — والباقي مردودون في الخادم", async () => {
    const { ep } = world()
    const mine = await ep.addMember.invoke(
      { committeeId: RELIEF.id, nameAr: "عبد الله" },
      canonicalActor(RELIEF.headPersonId),
      WRITE,
    )
    expect(mine.ok).toBe(true)

    for (const personId of ["u-amir", "u-admin", "u-square", "u-teacher"]) {
      const member = await ep.addMember.invoke(
        { committeeId: RELIEF.id, nameAr: "دخيل" },
        canonicalActor(personId),
        WRITE,
      )
      const activity = await ep.recordActivity.invoke(
        {
          committeeId: RELIEF.id,
          periodId: PERIOD,
          titleAr: "نشاطٌ بالنيابة",
          participantCount: 0,
          participantNamesAr: [],
          completedAt: NOW,
        },
        canonicalActor(personId),
        WRITE,
      )
      expect(member.ok, `${personId} أضاف عضواً في لجنة غيره`).toBe(false)
      expect(activity.ok, `${personId} سجّل نشاطاً في لجنة غيره`).toBe(false)
    }
  })

  it("ومسؤولُ اللجنة يسجّل نشاطَ لجنته", async () => {
    const { ep } = world()
    const r = await ep.recordActivity.invoke(
      {
        committeeId: RELIEF.id,
        periodId: PERIOD,
        titleAr: "توزيعُ سلال",
        participantCount: 2,
        participantNamesAr: ["أحمد", "بلال"],
        completedAt: NOW,
      },
      canonicalActor(RELIEF.headPersonId),
      WRITE,
    )
    expect(r.ok).toBe(true)
  })
})

describe("الاجتماعات — تسجيلُ المحضر بنطاق المسجد بعينه، والاطّلاعُ هابط", () => {
  it("الأميرُ يسجّل محضرَ مسجده", async () => {
    const { ep } = world()
    const r = await ep.recordMeeting.invoke(
      {
        unitId: KHALID,
        heldAt: NOW,
        minutesAr: "محضرُ الجلسة",
        decisionsAr: ["قرارٌ أول"],
      },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(r.ok).toBe(true)
  })

  it("**والمديرُ والمربعُ والمنطقةُ لا يسجّلون محضراً** (`meetings.manage` نطاقُها «ذ»)", async () => {
    const { ep } = world()
    for (const personId of ["u-admin", "u-square", "u-rabita", "u-section-head", "u-committee-head"]) {
      const r = await ep.recordMeeting.invoke(
        { unitId: KHALID, heldAt: NOW, minutesAr: "محضر", decisionsAr: ["قرار"] },
        canonicalActor(personId),
        WRITE,
      )
      expect(r.ok, personId).toBe(false)
    }
  })

  it("**ويطّلعون عليه** — الفرقُ بين الاطّلاع والعمل هو حدُّ الغياب (ق-١٧)", async () => {
    const { ep } = world()
    for (const personId of ["u-admin", "u-square", "u-rabita", "u-amir"]) {
      const r = await ep.meetings.invoke({ unitId: KHALID }, canonicalActor(personId), READ)
      expect(r.ok, personId).toBe(true)
    }
  })

  it("ومسؤولُ اللجنة والطالبُ والمعلّمُ لا يطّلعون على محاضر المسجد", async () => {
    const { ep } = world()
    for (const personId of ["u-committee-head", "u-student", "u-teacher"]) {
      const r = await ep.meetings.invoke({ unitId: KHALID }, canonicalActor(personId), READ)
      expect(r.ok, personId).toBe(false)
    }
  })
})

describe("إيقافُ اللجنة وعرضُ أنشطتها — نطاقُهما من **اللجنة المخزَّنة**", () => {
  it("الأميرُ يوقف لجنةَ مسجده، وأميرُ غيره مردود", async () => {
    const { ep } = world()
    const foreign = await ep.deactivate.invoke(
      { committeeId: RELIEF.id },
      canonicalActor("u-amir-bilal"),
      WRITE,
    )
    expect(foreign.ok).toBe(false)
    const own = await ep.deactivate.invoke({ committeeId: RELIEF.id }, canonicalActor("u-amir"), WRITE)
    expect(own.ok).toBe(true)
  })

  it("ولجنةٌ مجهولةٌ ⇒ `NO_SCOPE` ⇒ رفض", async () => {
    const { ep } = world()
    const r = await ep.deactivate.invoke({ committeeId: "لا-لجنة" }, canonicalActor("u-amir"), WRITE)
    expect(r.ok).toBe(false)
  })

  it("**ومدخلٌ ناقصُ الحقل ⇒ `NO_SCOPE` ⇒ رفض** — النطاقُ يُقفل ولا يُفتح على مدخلٍ فاسد", async () => {
    const { ep } = world()
    const amir = canonicalActor("u-amir")
    const head = canonicalActor(RELIEF.headPersonId)
    const blank = {} as { unitId: string; committeeId: string }

    const formed = await ep.form.invoke(
      { ...blank, labelAr: "لجنة", headPersonId: null, headNameAr: "فلان" },
      amir,
      WRITE,
    )
    const listed = await ep.list.invoke(blank, amir, READ)
    const stopped = await ep.deactivate.invoke(blank, amir, WRITE)
    const mine = await ep.myCommittee.invoke(blank, head, READ)
    const member = await ep.addMember.invoke({ ...blank, nameAr: "فلان" }, head, WRITE)
    const acts = await ep.activities.invoke({ ...blank, periodId: PERIOD }, amir, READ)
    const meetings = await ep.meetings.invoke(blank, amir, READ)
    const recorded = await ep.recordMeeting.invoke(
      { ...blank, heldAt: NOW, minutesAr: "محضر", decisionsAr: ["قرار"] },
      amir,
      WRITE,
    )

    for (const r of [formed, listed, stopped, mine, member, acts, meetings, recorded]) {
      expect(r.ok).toBe(false)
    }
  })

  it("وأنشطةُ اللجنة تُرى بـ`committees.view` على مسارها الهابط، ولا يراها طالبٌ ولا معلّم", async () => {
    const { ep } = world()
    for (const personId of ["u-amir", "u-square", "u-admin"]) {
      const r = await ep.activities.invoke(
        { committeeId: RELIEF.id, periodId: PERIOD },
        canonicalActor(personId),
        READ,
      )
      expect(r.ok, personId).toBe(true)
    }
    for (const personId of ["u-student", "u-teacher", "u-committee-head"]) {
      const r = await ep.activities.invoke(
        { committeeId: RELIEF.id, periodId: PERIOD },
        canonicalActor(personId),
        READ,
      )
      expect(r.ok, personId).toBe(false)
    }
  })
})
