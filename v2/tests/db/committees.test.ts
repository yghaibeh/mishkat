/**
 * **استمرارُ اللجان والاجتماعات على D1** — T26-ب-٢ (وحدة `committees` · الهجرة `0008`).
 *
 * ثوابتُ الوحدة تُقاس هنا **على المستودع الحقيقيّ** لا على الذاكرة:
 *  · **لا محو** (المادة ٧/٤ · عقدُ الوحدة §١): إيقافُ اللجنة **حالةٌ** (تحديثٌ على الصفّ
 *    نفسِه) لا حذف؛ والأعضاءُ والأنشطةُ والمحاضرُ ملحقةٌ فقط — اختفاءُ صفٍّ **يُرمى**.
 *  · **ق-٣١** الأسماءُ حرّةٌ بلا معرّفِ شخص — تعبر القاعدةَ كما كُتبت.
 *  · **ق-١٧** الاطّلاعُ الهابطُ بالاحتواء، و**قب-١٨** عزلُ الشبكة — بعد عبور القاعدة.
 *  · **مفتاحُ التوجيه**: اللجنةُ بمسارها هي، والعضوُ والنشاطُ بمسار لجنتهما، والمحضرُ بمسجده.
 *  · **صفر تدقيق**: الوحدةُ لا تكتب في `audit_log` أصلاً — والوحدةُ تُدرَج بلا `persistentAudit`.
 */

import { describe, expect, it } from "vitest"
import { persistentCommittee } from "../../src/db/repositories/committeesRepository.js"
import { UnitOfWork } from "../../src/db/unitOfWork.js"
import type { SqlStatement } from "../../src/db/sql/driver.js"
import { CommitteeStore } from "../../src/features/committees/data/store.js"
import {
  committeesLedBy,
  committeesWithin,
  deactivateCommittee,
  formCommittee,
} from "../../src/features/committees/services/committees.js"
import { addMember } from "../../src/features/committees/services/members.js"
import {
  activitiesOf,
  mosqueRecordContribution,
  recordActivity,
} from "../../src/features/committees/services/activities.js"
import { meetingsWithin, recordMeeting } from "../../src/features/committees/services/meetings.js"
import {
  BILAL,
  BILAL_PATH,
  DAWAH,
  freshCommitteeStore,
  committeeContext,
  committeeSession,
  freshDb,
  KHALID,
  KHALID_PATH,
  MAIN,
  NOW,
  OTHER,
  PERIOD,
  RELIEF,
  rowsOf,
  seedCommitteeSession,
  seedCommitteeUnits,
  SQ2_PATH,
} from "./_committees.js"

// ── مساعداتٌ تسلك الطريقَ المُعلَن لا حقناً في المستودع ─────────────────────────
function form(
  store: CommitteeStore,
  spec: { id: string; labelAr: string; headPersonId: string | null; headNameAr: string },
  unitId = KHALID,
): void {
  const done = formCommittee(store, committeeContext("u-amir"), {
    id: spec.id,
    mosqueUnitId: unitId,
    labelAr: spec.labelAr,
    headPersonId: spec.headPersonId,
    headNameAr: spec.headNameAr,
  })
  if (!done.ok) throw new Error(`تعذّر تشكيلُ اللجنة: ${done.error.code}`)
}

function member(store: CommitteeStore, committeeId: string, nameAr: string, actor = "u-committee-head"): string {
  const done = addMember(store, committeeContext(actor), { committeeId, nameAr })
  if (!done.ok) throw new Error(`تعذّرت إضافةُ العضو: ${done.error.code}`)
  return done.value.id
}

function activity(
  store: CommitteeStore,
  committeeId: string,
  spec: { periodId?: string; titleAr?: string; participantCount?: number; participantNamesAr?: readonly string[] } = {},
): string {
  const done = recordActivity(store, committeeContext("u-committee-head"), {
    committeeId,
    periodId: spec.periodId ?? PERIOD,
    titleAr: spec.titleAr ?? "درسٌ أسبوعيّ",
    participantCount: spec.participantCount ?? 2,
    participantNamesAr: spec.participantNamesAr ?? ["أحمد", "خالد"],
    completedAt: NOW,
  })
  if (!done.ok) throw new Error(`تعذّر تسجيلُ النشاط: ${done.error.code}`)
  return done.value.id
}

function meeting(
  store: CommitteeStore,
  unitId = KHALID,
  spec: { minutesAr?: string; decisionsAr?: readonly string[] } = {},
): string {
  const done = recordMeeting(store, committeeContext("u-amir"), {
    mosqueUnitId: unitId,
    heldAt: NOW,
    minutesAr: spec.minutesAr ?? "نوقشت خطةُ الموسم",
    decisionsAr: spec.decisionsAr ?? ["تُعقد جلسةٌ ثانية"],
  })
  if (!done.ok) throw new Error(`تعذّر تسجيلُ الاجتماع: ${done.error.code}`)
  return done.value.id
}

/** عباراتُ المصدر مقابل أساسه — بها يُقاس **ما يُكتب** لا ما يُقرأ. */
async function statementsAfter(
  driver: Awaited<ReturnType<typeof freshDb>>,
  tenantId: string,
  fn: (store: CommitteeStore) => void,
): Promise<readonly SqlStatement[]> {
  const store = freshCommitteeStore(tenantId)
  const source = persistentCommittee(store)
  const uow = new UnitOfWork(driver, { tenantId, scopePath: "/" })
  uow.enlist(source)
  await uow.hydrate()
  fn(store)
  return uow.statementsFor(source.name, source.project())
}

// ═══ الاختبار الإلزاميّ ١ — لا محو: الاختفاءُ يُرمى، والحالةُ تحديثٌ ══════════════

describe("المادة ٧/٤ — لا محو: أربعةُ جداولٍ ملحقةٌ فقط، والإيقافُ حالةٌ لا حذف", () => {
  it("محوُ صفٍّ من أيّ جدولٍ ملحقٍ **يُرمى** ولا يُترجم `DELETE`", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    await committeeSession(driver, MAIN, (store) => {
      form(store, RELIEF)
      member(store, RELIEF.id, "أحمد")
      activity(store, RELIEF.id)
      meeting(store, KHALID)
    })

    const store = freshCommitteeStore(MAIN)
    const source = persistentCommittee(store)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(source)
    await uow.hydrate()
    const projected = source.project()

    for (const table of ["committees", "committee_members", "committee_activities", "committee_meetings"] as const) {
      const forged = new Map(projected)
      forged.set(table, new Map())
      expect(() => uow.statementsFor(source.name, forged)).toThrow(new RegExp(table))
    }
    driver.close()
  })

  it("**ولا عبارةَ حذفٍ واحدة** تُولَّد مهما تعاقبت الحالات — والإيقافُ **تحديثٌ** على الصفّ نفسِه", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    await committeeSession(driver, MAIN, (store) => {
      form(store, RELIEF)
      form(store, DAWAH)
    })

    const statements = await statementsAfter(driver, MAIN, (store) => {
      // إيقافٌ ثم تسجيلُ نشاطٍ ومحضرٍ — أشدُّ ما يُغري بنمذجة الحالة حذفاً وإدراجاً.
      expect(deactivateCommittee(store, committeeContext("u-amir"), { committeeId: DAWAH.id }).ok).toBe(true)
      member(store, RELIEF.id, "خالد")
      meeting(store, KHALID)
    })
    expect(statements.filter((s) => /^DELETE/.test(s.sql))).toEqual([])
    // عبارةٌ واحدةٌ على `committees` — تحديثٌ بالمفتاح الطبيعيّ لا حذفٌ وإدراج.
    const onCommittees = statements.filter((s) => s.sql.includes("committees ") || s.sql.startsWith("INSERT INTO committees"))
    expect(onCommittees).toHaveLength(1)
    expect(onCommittees[0]!.sql).toContain("ON CONFLICT (tenant_id, id) DO UPDATE")
    driver.close()
  })

  it("الإيقافُ يُبقي الصفَّ نفسَه: عددُه واحدٌ ومعرّفُه لم يتبدّل، و`active` وحدَها تحرّكت", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    await committeeSession(driver, MAIN, (store) => form(store, DAWAH))
    const before = (await rowsOf(driver, "committees")) as readonly Record<string, unknown>[]
    expect(before).toHaveLength(1)
    expect(Number(before[0]!["active"])).toBe(1)

    await committeeSession(driver, MAIN, (store) => {
      expect(deactivateCommittee(store, committeeContext("u-amir"), { committeeId: DAWAH.id }).ok).toBe(true)
    })
    const after = (await rowsOf(driver, "committees")) as readonly Record<string, unknown>[]
    expect(after).toHaveLength(1)
    expect(after[0]!["id"]).toBe(DAWAH.id)
    expect(Number(after[0]!["active"])).toBe(0)
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٢ — ق-٣١: الأسماءُ حرّةٌ بلا معرّفِ شخص، بعد عبور القاعدة ═

describe("ق-٣١ — أسماءٌ حرّةٌ تعبر القاعدةَ بلا معرّفِ شخص", () => {
  it("مسؤولٌ اسمٌ حرٌّ (بلا حساب) ومسؤولٌ ذو حساب — كلاهما يعبر كما كُتب", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    await committeeSession(driver, MAIN, (store) => {
      form(store, RELIEF) // headPersonId مضبوط
      form(store, DAWAH) // headPersonId = null (اسمٌ حرّ)
    })
    await committeeSession(driver, MAIN, (store) => {
      const relief = store.getCommittee(RELIEF.id)!
      const dawah = store.getCommittee(DAWAH.id)!
      expect(relief.headPersonId).toBe(RELIEF.headPersonId)
      expect(dawah.headPersonId).toBeNull()
      expect(dawah.headNameAr).toBe(DAWAH.headNameAr)
      // «لجنتي» ملكيةٌ لا نطاق: صاحبُ الحساب يراها، ولجنةُ الاسم الحرّ لا تُنسب لأحد.
      expect(committeesLedBy(store, RELIEF.headPersonId).map((c) => c.id)).toEqual([RELIEF.id])
      expect(committeesLedBy(store, "u-committee-head")).toHaveLength(1)
    })
    // ولا عمودَ `person_id` في جدول الأعضاء أصلاً — الاستحالةُ بالبنية (على المخطط المطبَّق).
    const cols = (await driver.all({ sql: "PRAGMA table_info(committee_members)", params: [] })).map((r) => String(r["name"]))
    expect(cols.some((c) => /person/.test(c))).toBe(false)
    driver.close()
  })

  it("أسماءُ المشاركين الحرّةُ (قائمةُ نصٍّ) تعبر القاعدةَ بترتيبها وعددها", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    await committeeSession(driver, MAIN, (store) => {
      form(store, RELIEF)
      activity(store, RELIEF.id, { participantCount: 3, participantNamesAr: ["أحمد", "بلال", "خالد"] })
    })
    await committeeSession(driver, MAIN, (store) => {
      const a = store.activities()[0]!
      expect(a.participantCount).toBe(3)
      expect(a.participantNamesAr).toEqual(["أحمد", "بلال", "خالد"])
    })
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٣ — صفر تدقيق: الوحدةُ لا تكتب سجلاً، وتُدرَج بلا `persistentAudit` ═

describe("صفر تدقيق — وحدةُ اللجان بلا `AuditJournal`، فلا صفَّ في `audit_log` ولا مصدرَ تدقيق", () => {
  it("جلسةٌ كاملةٌ من الكتابة **لا تُنتج صفَّ تدقيقٍ واحداً** — خلافاً للعُهد", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    await committeeSession(driver, MAIN, (store) => {
      form(store, RELIEF)
      member(store, RELIEF.id, "أحمد")
      activity(store, RELIEF.id)
      meeting(store, KHALID)
    })
    // لا سجلَّ محليٌّ يُوحَّد ولا سجلٌّ يُقذف: `audit_log` يبقى فارغاً (وحدة اللجان لا تملك سجلاً).
    expect(await rowsOf(driver, "audit_log")).toEqual([])
    driver.close()
  })

  it("مصدرُ اللجان لا يُطالب بجدول `audit_log` — وحدةُ عملها تُدرِجه وحدَه", () => {
    const source = persistentCommittee(freshCommitteeStore(MAIN))
    const tables = source.tables.map((t) => (typeof t === "string" ? t : t.table))
    expect(tables).not.toContain("audit_log")
    expect(source.name).toBe("committees")
  })
})

// ═══ الاختبار الإلزاميّ ٤ — عزلُ الشبكة والنطاق على المستودع الحقيقيّ ══════════

describe("قب-١٨ + ق-١٧ — عزلُ الشبكة والنطاق **على المستودع الحقيقيّ**", () => {
  it("عزلُ الشبكة: لجنةُ شبكةٍ **لا تُقرأ** من أخرى ولو تطابق المسارُ والمعرّف", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    await seedCommitteeSession(driver, OTHER)
    await committeeSession(driver, OTHER, (store) => form(store, RELIEF))
    await committeeSession(driver, MAIN, (store) => form(store, RELIEF))

    // معرّفٌ واحدٌ (`cm-relief`) في شبكتين — المفتاحُ الطبيعيّ يفصلهما بالشبكة لا بالمسار.
    const rows = (await rowsOf(driver, "committees")) as readonly Record<string, unknown>[]
    expect(rows.map((r) => `${String(r["tenant_id"])}|${String(r["id"])}`).sort()).toEqual([
      "t-aleppo|cm-relief",
      "t-main|cm-relief",
    ])
    await committeeSession(driver, MAIN, (store) => {
      // شبكةُ MAIN ترى لجنتها هي فقط — لا لجنةَ حلب ولو حملت المعرّفَ نفسَه.
      expect(store.committees().map((c) => c.tenantId)).toEqual([MAIN])
    })
    driver.close()
  })

  it("عزلُ النطاق: جلسةُ مسجدٍ **لا تحمّل** لجنةَ جاره — والمسارُ بادئةٌ بشرطةٍ ختامية", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    await committeeSession(driver, MAIN, (store) => {
      form(store, RELIEF, KHALID)
      form(store, { id: "cm-bilal", labelAr: "لجنةُ بلال", headPersonId: null, headNameAr: "فلان" }, BILAL)
      meeting(store, KHALID)
      meeting(store, BILAL)
    })
    await committeeSession(
      driver,
      MAIN,
      (store) => {
        // نطاقُ بلال: لجنتُه ومحضرُه فقط — لجنةُ خالد ومحضرُه خارج البادئة.
        expect(store.committees().map((c) => c.id)).toEqual(["cm-bilal"])
        expect(committeesWithin(store, KHALID_PATH)).toEqual([])
        expect(store.meetings().map((m) => m.mosquePath)).toEqual([BILAL_PATH])
      },
      BILAL_PATH,
    )
    // والمربعُ فوقهما يرى الاثنتين بالاحتواء لا بالمصادفة (ق-١٧).
    await committeeSession(
      driver,
      MAIN,
      (store) => {
        expect(committeesWithin(store, SQ2_PATH).map((c) => c.id).sort()).toEqual(["cm-bilal", "cm-relief"])
        expect(meetingsWithin(store, SQ2_PATH)).toHaveLength(2)
      },
      SQ2_PATH,
    )
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٥ — الذرّية: لا نصفَ أثر ═══════════════════════════════

describe("الذرّية — فشلٌ في منتصف عمليةٍ لا يترك نصفَ أثر", () => {
  it("رميةٌ داخل المعاملة ⟵ لا لجنةَ ولا عضوَ **في القاعدة**، والعدّادُ لم يحترق", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    await committeeSession(driver, MAIN, (store) => form(store, RELIEF))
    const boom = new Error("انفجارٌ مصطنعٌ بعد الكتابة وقبل تمام العملية")

    await expect(
      committeeSession(driver, MAIN, (store) => {
        store.transaction(() => {
          store.saveMember({ tenantId: MAIN, id: store.nextId("cmm"), committeeId: RELIEF.id, nameAr: "شبح" })
          throw boom
        })
      }),
    ).rejects.toThrow(boom)

    // الفارقُ يُحسب لا يُلتقط: الذاكرةُ ارتدّت ⟵ صفرُ عبارةٍ ⟵ صفرُ أثرٍ دائم.
    expect(await rowsOf(driver, "committee_members")).toHaveLength(0)
    // والعدّادُ المحفوظُ لم يتقدّم — العضوُ التالي `cmm-1` لا `cmm-2`.
    const next = await committeeSession(driver, MAIN, (store) => member(store, RELIEF.id, "أحمد"))
    expect(next).toBe("cmm-1")
    driver.close()
  })

  it("عملٌ مرفوضٌ دلالياً (عضوٌ للجنةٍ موقوفة) لا يترك أثراً ولا يحرق معرّفاً", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    await committeeSession(driver, MAIN, (store) => {
      form(store, DAWAH)
      expect(deactivateCommittee(store, committeeContext("u-amir"), { committeeId: DAWAH.id }).ok).toBe(true)
    })
    await committeeSession(driver, MAIN, (store) => {
      const denied = addMember(store, committeeContext("u-x"), { committeeId: DAWAH.id, nameAr: "لن يُضاف" })
      expect(denied.ok).toBe(false)
      if (!denied.ok) expect(denied.error.code).toBe("COMMITTEE_INACTIVE")
    })
    expect(await rowsOf(driver, "committee_members")).toHaveLength(0)
    // ثم عضوٌ مشروعٌ للجنةٍ عاملة — معرّفُه `cmm-1`: الرفضُ لم يستهلك نبضةَ عدّاد.
    await committeeSession(driver, MAIN, (store) => form(store, RELIEF))
    const id = await committeeSession(driver, MAIN, (store) => member(store, RELIEF.id, "أحمد"))
    expect(id).toBe("cmm-1")
    driver.close()
  })

  it("وحدةُ عملٍ خليطةٌ تُرمى — لا يُقذف مستودعٌ بلا مخطط", async () => {
    const driver = await freshDb()
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(persistentCommittee(new CommitteeStore(MAIN)))
    uow.enlist({
      name: "مستودعٌ بلا مخطط",
      rowBudget: 10,
      tables: ["committee_ghost"],
      project: () => new Map(),
      load: () => undefined,
    })
    await expect(uow.hydrate()).rejects.toThrow(/committee_ghost/)
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٦ — تطابقُ البديلين ═══════════════════════════════════

type Observation = {
  readonly committees: readonly string[]
  readonly members: readonly string[]
  readonly activities: readonly string[]
  readonly meetings: readonly string[]
  readonly withinKhalid: readonly string[]
  readonly contribution: string
}

function observe(store: CommitteeStore): Observation {
  return {
    committees: store.committees().map((c) => `${c.id}|${c.path}|${c.mosquePath}|${c.active}|${c.headPersonId ?? "—"}|${c.headNameAr}`),
    members: store.members().map((m) => `${m.id}|${m.committeeId}|${m.nameAr}`),
    activities: store.activities().map((a) => `${a.id}|${a.committeeId}|${a.periodId}|${a.participantCount}|${a.participantNamesAr.join(",")}`),
    meetings: store.meetings().map((m) => `${m.id}|${m.mosquePath}|${m.minutesAr}|${m.decisionsAr.join(",")}`),
    withinKhalid: committeesWithin(store, KHALID_PATH).map((c) => c.id),
    contribution: JSON.stringify(
      mosqueRecordContribution(store, {
        mosquePath: KHALID_PATH,
        periodId: PERIOD,
        confirmedCommitteeIds: new Set([RELIEF.id]),
      }),
    ),
  }
}

/** خطواتٌ متزامنةٌ بحتة تُشغَّل **حرفياً** على البديلين — الاسمُ يُشتقّ والمعرّفُ من العدّاد. */
const STEPS: readonly ((store: CommitteeStore) => void)[] = [
  (store) => form(store, RELIEF),
  (store) => form(store, DAWAH),
  (store) => expect(member(store, RELIEF.id, "أحمد")).toBe("cmm-1"),
  (store) => expect(activity(store, RELIEF.id, { participantCount: 1, participantNamesAr: ["أحمد"] })).toBe("cma-2"),
  (store) => expect(meeting(store, KHALID)).toBe("mtg-3"),
  (store) => {
    expect(deactivateCommittee(store, committeeContext("u-amir"), { committeeId: DAWAH.id }).ok).toBe(true)
  },
  (store) => {
    // مرفوضٌ: لا يترك أثراً على أيٍّ من البديلين ولا يحرق معرّفاً.
    expect(addMember(store, committeeContext("u-x"), { committeeId: DAWAH.id, nameAr: "لن يُضاف" }).ok).toBe(false)
  },
  (store) => expect(member(store, RELIEF.id, "خالد")).toBe("cmm-4"),
]

describe("تطابقُ البديلين — اللجانُ في الذاكرة وعلى D1", () => {
  it("السيناريو نفسُه يعطي النتائج نفسَها على البديلين **خطوةً خطوة**", async () => {
    const memory = freshCommitteeStore(MAIN)
    seedCommitteeUnits(memory)
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)

    for (const [index, step] of STEPS.entries()) {
      step(memory)
      const inMemory = observe(memory)
      const onD1 = await committeeSession(driver, MAIN, (store) => {
        step(store)
        return observe(store)
      })
      expect(`الخطوة ${index + 1}: ${JSON.stringify(onD1)}`).toBe(`الخطوة ${index + 1}: ${JSON.stringify(inMemory)}`)
    }
    driver.close()
  })

  it("الحالةُ الدائمة تُقرأ بعد الجلسة كما تُركت — التحميلُ والإسقاطُ متعاكسان", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    for (const step of STEPS) await committeeSession(driver, MAIN, step)
    const first = await committeeSession(driver, MAIN, observe)
    const second = await committeeSession(driver, MAIN, observe)
    expect(second).toEqual(first)
    driver.close()
  })

  it("قراءةٌ بلا كتابة **لا تُنتج عبارةً واحدة** — فالتحميلُ لا يُلوّث جدولاً ملحقاً فقط", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    await committeeSession(driver, MAIN, (store) => {
      form(store, RELIEF)
      activity(store, RELIEF.id)
    })
    const before = await rowsOf(driver, "committee_activities")
    const statements = await statementsAfter(driver, MAIN, (store) => {
      void activitiesOf(store, RELIEF.id, PERIOD)
      void committeesWithin(store, KHALID_PATH)
    })
    expect(statements).toEqual([])
    expect(await rowsOf(driver, "committee_activities")).toEqual(before)
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٧ — الحتميّة والعدّاد عبر الجلسات وتحت نطاقٍ جزئيّ ══════

describe("الحتميّة تنجو عبور القاعدة — والعدّادُ يعدّه ثلاثةٌ لا الخمسة", () => {
  it("المعرّفُ متتابعٌ عبر جلساتٍ ثلاث — عضوٌ فنشاطٌ فمحضرٌ يتقاسمون عدّاداً واحداً", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    await committeeSession(driver, MAIN, (store) => form(store, RELIEF))
    const first = await committeeSession(driver, MAIN, (store) => member(store, RELIEF.id, "أحمد"))
    const second = await committeeSession(driver, MAIN, (store) => activity(store, RELIEF.id))
    const third = await committeeSession(driver, MAIN, (store) => meeting(store, KHALID))
    // اللجنةُ (معرّفٌ حرٌّ) لم تدخل العدّاد — فالعدّادُ بدأ من ١ عند أوّل عضو.
    expect([first, second, third]).toEqual(["cmm-1", "cma-2", "mtg-3"])
    driver.close()
  })

  it("**والنطاقُ الجزئيُّ لا يُنقص العدّاد**: جلسةُ مسجدٍ لا تدهس معرّفَ جاره", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    await committeeSession(driver, MAIN, (store) => {
      form(store, RELIEF, KHALID)
      form(store, { id: "cm-bilal", labelAr: "لجنةُ بلال", headPersonId: null, headNameAr: "فلان" }, BILAL)
      member(store, RELIEF.id, "أحمد") // cmm-1 في خالد
    })
    // جلسةٌ لا ترى إلا مسجد بلال، ومع ذلك يُستأنف العدّادُ من المحفوظ ⟵ العضوُ `cmm-2`.
    const id = await committeeSession(driver, MAIN, (store) => member(store, "cm-bilal", "زيد"), BILAL_PATH)
    expect(id).toBe("cmm-2")
    const rows = (await rowsOf(driver, "committee_members")) as readonly Record<string, unknown>[]
    expect(rows.map((r) => String(r["id"])).sort()).toEqual(["cmm-1", "cmm-2"])
    driver.close()
  })

  it("ولا ساعةَ في المستودع: قاعدتان مستقلتان تُنتجان الصفوفَ نفسَها حرفياً", async () => {
    const runs: string[] = []
    for (let i = 0; i < 2; i += 1) {
      const driver = await freshDb()
      await seedCommitteeSession(driver, MAIN)
      await committeeSession(driver, MAIN, (store) => {
        form(store, RELIEF)
        activity(store, RELIEF.id)
      })
      runs.push(JSON.stringify(await rowsOf(driver, "committee_activities")))
      driver.close()
    }
    expect(runs[1]).toBe(runs[0])
  })
})

// ═══ الاختبار الإلزاميّ ٨ — ميزانيةُ التحميل (G23) ════════════════════════════

describe("ميزانيةُ التحميل — اللجانُ تُعلن سقفَها وتُقاس عليه (G23)", () => {
  it("سقفُ اللجان موجبٌ ومُعلَنٌ في المصنع — لا مستودعَ بلا سقف", () => {
    const source = persistentCommittee(new CommitteeStore(MAIN))
    expect(`${source.name}:${source.rowBudget > 0}`).toBe("committees:true")
  })

  it("**وتجاوزُه رميةٌ تُسمّي الوحدةَ والجدولَ الأكبر** — لا «تجاوزٌ» مبهمة", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    await committeeSession(driver, MAIN, (store) => form(store, RELIEF))
    const store = freshCommitteeStore(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist({ ...persistentCommittee(store), rowBudget: 2 })
    await expect(uow.hydrate()).rejects.toThrow(/وحدةُ عمل «committees»/)
    await expect(uow.hydrate()).rejects.toThrow(/committee_units=/)
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٩ + حوافُّ التغطية — السلبُ أكثرُ من الإيجاب ════════════

describe("حوافُّ مستودع اللجان — والسلبُ أكثرُ من الإيجاب", () => {
  it("**مفتاحُ توجيهٍ لا يُشتقّ يُرمى**: عضوٌ إلى لجنةٍ مجهولة لا يُوجَّه إلى الجذر صامتاً", () => {
    const store = new CommitteeStore(MAIN)
    store.saveMember({ tenantId: MAIN, id: "cmm-1", committeeId: "cm-لا-وجود", nameAr: "يتيم" })
    expect(() => persistentCommittee(store).project()).toThrow(/مفتاحُ توجيهٍ لا يُشتقّ/)
  })

  it("**ونشاطٌ إلى لجنةٍ مجهولة كذلك يُرمى** — الوجهُ الثاني لنفس الاشتقاق", () => {
    const store = new CommitteeStore(MAIN)
    store.saveActivity({
      tenantId: MAIN,
      id: "cma-1",
      committeeId: "cm-لا-وجود",
      periodId: PERIOD,
      titleAr: "نشاطٌ يتيم",
      participantCount: 0,
      participantNamesAr: [],
      completedAt: NOW,
    })
    expect(() => persistentCommittee(store).project()).toThrow(/مفتاحُ توجيهٍ لا يُشتقّ/)
  })

  it("تحميلٌ من لا شيء لا يرمي ولا يخترع — قاعدةٌ فارغةٌ مستودعٌ فارغٌ وعدّادٌ من الصفر", () => {
    const store = new CommitteeStore(MAIN)
    persistentCommittee(store).load(new Map())
    expect(store.committees()).toEqual([])
    expect(store.members()).toEqual([])
    expect(store.meetings()).toEqual([])
    expect(store.nextId("cmm")).toBe("cmm-1")
  })

  it("**قائمةُ نصٍّ مشوَّهةٌ في القاعدة تُرمى** — لا تُقرأ قائمةٌ بنوعٍ غير متوقَّع صامتاً", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    // نشاطٌ سليمٌ ثم إفسادُ عمود القائمة مباشرةً في القاعدة (نصٌّ ليس مصفوفة).
    await committeeSession(driver, MAIN, (store) => {
      form(store, RELIEF)
      activity(store, RELIEF.id)
    })
    await driver.batch([
      { sql: "UPDATE committee_activities SET participant_names_ar = ?", params: ['"ليست مصفوفة"'] },
    ])
    await expect(committeeSession(driver, MAIN, () => undefined)).rejects.toThrow(/ليس قائمةَ نصوص/)
    driver.close()
  })

  it("مساهمةُ المسجد **اشتقاقٌ** لا رقمٌ مخزَّن: صفرٌ قبل الإقرار، فتُحتسب بعده — بلا عمودِ مجموع", async () => {
    const driver = await freshDb()
    await seedCommitteeSession(driver, MAIN)
    await committeeSession(driver, MAIN, (store) => {
      form(store, RELIEF)
      activity(store, RELIEF.id, { participantCount: 3, participantNamesAr: ["أحمد", "بلال", "خالد"] })
    })
    await committeeSession(driver, MAIN, (store) => {
      // قبل الإقرار: صفرٌ (اللجنةُ ليست ضمن المُقرّ).
      const before = mosqueRecordContribution(store, { mosquePath: KHALID_PATH, periodId: PERIOD, confirmedCommitteeIds: new Set() })
      expect(before.activityCount).toBe(0)
      // بعده: تُحتسب — والعددُ محسوبٌ لحظتَه لا مقروءٌ من عمود.
      const after = mosqueRecordContribution(store, { mosquePath: KHALID_PATH, periodId: PERIOD, confirmedCommitteeIds: new Set([RELIEF.id]) })
      expect(`${after.activityCount}|${after.participantCount}`).toBe("1|3")
    })
    // ولا عمودَ مجموعٍ في أيّ جدول — المساهمةُ لا تُخزَّن (نظيرُ ق-٦٠).
    const cols = (await driver.all({ sql: "PRAGMA table_info(committees)", params: [] })).map((r) => String(r["name"]))
    expect(cols.some((c) => /count|total|contribution|sum/.test(c))).toBe(false)
    driver.close()
  })
})
