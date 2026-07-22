/**
 * **الاختباراتُ الإلزاميّة ١ و٤ (شقُّ التحرير) و٩ و١٠ (شقُّ عزل النطاق)** (T18):
 *  ١. **ق-٨٤**: المديرُ/المشرفُ يُدخل سجلاً ⇒ **مرفوض** (وإن رآه).
 *  ٤. **ب-٣٥أ**: المعلّمُ **يقرأ** ملاحظةَ المشرف ولا **يحرّرها**.
 *  ٩. **قب-٣٨**: مُسنَدٌ بلا دور المعلّم ⇒ `circle.teach` مرفوضةٌ **بالسبب المميِّز**.
 * ١٠. **عزلُ النطاق**: أميرُ مسجدٍ آخر مرفوضٌ في الخادم لا مخفيٌّ في الواجهة.
 *
 * **قاعدةٌ ذهبية** (TESTING_POLICY §٤): حالاتُ السلب أكثرُ من الإيجاب دائماً.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { makeCircleLogEndpoints } from "../../../src/features/circleLog/server/endpoints.js"
import { circleModelFrom } from "../../../src/features/circleLog/services/circlesPort.js"
import { createSettingsResolver } from "../../../src/settings/resolver.js"
import { recordNote } from "../../../src/features/circleLog/services/notes.js"
import type { Actor } from "../../../src/authorization/can.js"
import {
  canonicalActor,
  DECISION,
  KHALID_PATH,
  logContext,
  MOSQUE_TEACHER_ID,
  mosqueTeacher,
  NOW,
  seedWorld,
  sequentialTokens,
  WRITE,
  type World,
} from "./_seed.js"

function endpointsFor(world: World) {
  return makeCircleLogEndpoints({
    store: world.log,
    circles: circleModelFrom(world.circles),
    settings: createSettingsResolver([]),
    newToken: sequentialTokens(),
  })
}

type Fixture = { readonly label: string; readonly actor: () => Actor }

/** مستخدمٌ قانونيٌّ لكل دورٍ حيّ — من العالم القانونيّ لا من عالمٍ ثانٍ. */
const OTHERS: readonly Fixture[] = [
  { label: "admin", actor: () => canonicalActor("u-admin") },
  { label: "section_head", actor: () => canonicalActor("u-section-head") },
  { label: "rabita", actor: () => canonicalActor("u-rabita") },
  { label: "square", actor: () => canonicalActor("u-square") },
  { label: "committee_head", actor: () => canonicalActor("u-committee-head") },
  { label: "media", actor: () => canonicalActor("u-media") },
  { label: "finance_officer", actor: () => canonicalActor("u-finance") },
  { label: "student", actor: () => canonicalActor("u-student") },
]

const ROW = { enrollmentId: "", attendance: "present" as const }

beforeEach(() => clearRegistryForTests())

describe("**ق-٨٤ — الإدخالُ لمالكه**: بابان، والمديرُ والمشرفُ يريان ولا يُدخلان", () => {
  it("**أميرُ المكان يُدخل** — `circle.manage` على وحدة الحلقة بعينها", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const done = await ep.record.invoke(
      { circleId: world.circleId, at: NOW, rows: [{ ...ROW, enrollmentId: world.studentA }] },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(done.ok).toBe(true)
  })

  it("**والمعلّمُ نفسُه يُدخل** — `circle.teach` الشخصيةُ على حلقته (ق-٩٠ نصاً)", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const done = await ep.recordMine.invoke(
      { circleId: world.circleId, at: NOW, rows: [{ ...ROW, enrollmentId: world.studentA }] },
      mosqueTeacher(),
      WRITE,
    )
    expect(done.ok).toBe(true)
  })

  it.each([...OTHERS])(
    "**و$label لا يُدخل سجلاً — مرفوضٌ في الخادم** (منعاً للغش)",
    async ({ actor }) => {
      const world = seedWorld()
      const ep = endpointsFor(world)
      const viaManage = await ep.record.invoke(
        { circleId: world.circleId, at: NOW, rows: [{ ...ROW, enrollmentId: world.studentA }] },
        actor(),
        WRITE,
      )
      const viaTeach = await ep.recordMine.invoke(
        { circleId: world.circleId, at: NOW, rows: [{ ...ROW, enrollmentId: world.studentA }] },
        actor(),
        WRITE,
      )
      expect(viaManage.ok).toBe(false)
      expect(viaTeach.ok).toBe(false)
    },
  )

  it("**والمديرُ والمشرفُ يريان**: `circle.view` تفتح الكشفَ لهما — رؤيةٌ بلا إدخال", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    for (const personId of ["u-admin", "u-square", "u-rabita", "u-section-head"]) {
      const seen = await ep.dayView.invoke(
        { circleId: world.circleId, at: NOW },
        canonicalActor(personId),
        DECISION,
      )
      expect(seen.ok, personId).toBe(true)
    }
  })

  it("**وأميرُ مسجدٍ آخر مرفوضٌ في الخادم** — النطاقُ من الحلقة المخزَّنة لا من المدخل", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const done = await ep.record.invoke(
      { circleId: world.circleId, at: NOW, rows: [{ ...ROW, enrollmentId: world.studentA }] },
      canonicalActor("u-amir-bilal"),
      WRITE,
    )
    expect(done.ok).toBe(false)
    expect(!done.ok && done.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("وحلقةٌ مجهولةٌ ⇒ `NO_SCOPE` ⇒ **رفضٌ يُقفل ولا يُفتح** حتى لصاحب القدرة", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const done = await ep.record.invoke(
      { circleId: "لا-حلقة", at: NOW, rows: [{ ...ROW, enrollmentId: world.studentA }] },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(done.ok).toBe(false)
  })
})

describe("**قب-٣٨/٩ — القدرةُ الشخصية تسأل الدورَ والملكيةَ معاً**", () => {
  it("**مُسنَدٌ بلا دور المعلّم ⇒ `DENIED_PERSONAL_NOT_IN_ROLE`** — السببُ مميِّزٌ لا مبهم", async () => {
    const world = seedWorld()
    // الطالبُ **صاحبُ الحلقة** بالإسناد… ودورُه لا يحمل `circle.teach`.
    const circle = world.circles.getCircle(world.circleId)!
    world.circles.saveCircle({ ...circle, teacherPersonId: "u-student" })
    const ep = endpointsFor(world)
    const done = await ep.recordMine.invoke(
      { circleId: world.circleId, at: NOW, rows: [{ ...ROW, enrollmentId: world.studentA }] },
      canonicalActor("u-student"),
      WRITE,
    )
    expect(!done.ok && done.decision.reason).toBe("DENIED_PERSONAL_NOT_IN_ROLE")
  })

  it("**ومعلّمٌ في حلقةِ غيره ⇒ `DENIED_PERSONAL_NOT_OWNER`** — دورٌ يحملها وليس صاحبَها", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const done = await ep.recordMine.invoke(
      { circleId: world.circleId, at: NOW, rows: [{ ...ROW, enrollmentId: world.studentA }] },
      canonicalActor("u-teacher"),
      WRITE,
    )
    expect(!done.ok && done.decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
  })

  it("**وحلقةٌ بلا معلّمٍ ⇒ `NO_SCOPE`** — لا مالكَ فلا بابَ شخصيّ", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const done = await ep.recordMine.invoke(
      { circleId: world.otherCircleId, at: NOW, rows: [{ ...ROW, enrollmentId: world.studentA }] },
      mosqueTeacher(),
      WRITE,
    )
    expect(done.ok).toBe(false)
  })

  it("و«سجلُّ حلقاتي» يقرأ **بمعرّف الجلسة** — وطلبُ صفحة غيرك مرفوض", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const mine = await ep.mineView.invoke({ personId: MOSQUE_TEACHER_ID }, mosqueTeacher(), DECISION)
    expect(mine.ok && mine.value.circles.length).toBe(1)
    const foreign = await ep.mineView.invoke(
      { personId: "u-teacher" },
      mosqueTeacher(),
      DECISION,
    )
    expect(!foreign.ok && foreign.decision.reason).toBe("DENIED_PERSONAL_NOT_OWNER")
  })
})

describe("**ب-٣٥أ/٤ — المعلّمُ يقرأ ملاحظةَ المشرف ولا يحرّرها**", () => {
  it("**التحريرُ مرفوض**: `circle.notes.supervise` ليست في حزمة المعلّم (الخطأُ المكلف في v1)", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const done = await ep.noteRecord.invoke(
      { circleId: world.circleId, bodyAr: "أكتبُ عن نفسي" },
      mosqueTeacher(),
      WRITE,
    )
    expect(done.ok).toBe(false)
    expect(!done.ok && done.decision.deniedBy).toEqual({ requiredCapability: "circle.notes.supervise" })
  })

  it("**والقراءةُ مسموحة**: المعلّمُ يقرأ ما كتبه المشرفُ على حلقته", async () => {
    const world = seedWorld()
    recordNote(world.log, logContext(world, "u-square"), {
      circleId: world.circleId,
      bodyAr: "ملاحظةٌ إشرافية",
    })
    const ep = endpointsFor(world)
    const seen = await ep.notesMineView.invoke(
      { circleId: world.circleId },
      mosqueTeacher(),
      DECISION,
    )
    expect(seen.ok && seen.value.notes).toHaveLength(1)
  })

  it("**والمشرفُ يكتب** — و`circle.notes.supervise` هابطةٌ فتصل المربعَ والمنطقةَ والقسم", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    for (const personId of ["u-square", "u-rabita", "u-section-head", "u-amir"]) {
      const done = await ep.noteRecord.invoke(
        { circleId: world.circleId, bodyAr: `ملاحظةٌ من ${personId}` },
        canonicalActor(personId),
        WRITE,
      )
      expect(done.ok, personId).toBe(true)
    }
  })

  it("**والمديرُ لا يكتب**: `circle.notes.supervise` غائبةٌ عن حزمته (الشمولُ اطّلاعٌ لا عمل)", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const done = await ep.noteRecord.invoke(
      { circleId: world.circleId, bodyAr: "من المدير" },
      canonicalActor("u-admin"),
      WRITE,
    )
    expect(done.ok).toBe(false)
  })
})

describe("**١٠ — رابطُ وليّ الأمر والتقييمُ: أبوابٌ محروسةٌ بالقدرة والنطاق**", () => {
  it("الأميرُ يُصدر رابطاً ويجدّده ويلغيه، **والمعلّمُ على المسجد كذلك**", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const issued = await ep.linkIssue.invoke(
      { circleId: world.circleId, enrollmentId: world.studentA },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(issued.ok).toBe(true)

    const forB = await ep.linkIssue.invoke(
      { circleId: world.circleId, enrollmentId: world.studentB },
      mosqueTeacher(),
      WRITE,
    )
    expect(forB.ok).toBe(true)
  })

  it.each([...OTHERS])("**و$label لا يُصدر رابطاً** — `guardianLink.manage` ليست له", async ({ actor }) => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const done = await ep.linkIssue.invoke(
      { circleId: world.circleId, enrollmentId: world.studentA },
      actor(),
      WRITE,
    )
    expect(done.ok).toBe(false)
  })

  it("**ومعلّمٌ مُسنَدٌ على وحدةٍ أعمقَ من المسجد لا يبلغ البابَ** — أثرُ نطاق «ذ» المعلن", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const done = await ep.linkIssue.invoke(
      { circleId: world.circleId, enrollmentId: world.studentA },
      canonicalActor("u-teacher"),
      WRITE,
    )
    expect(!done.ok && done.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("والتقييمُ الدوريُّ يُفتح بـ`circle.view` للأمير والمشرف والمدير، ويُقفل على غيرهم", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    for (const personId of ["u-amir", "u-square", "u-admin"]) {
      const seen = await ep.rankingView.invoke({ unitId: "khalid" }, canonicalActor(personId), DECISION)
      expect(seen.ok, personId).toBe(true)
    }
    for (const personId of ["u-student", "u-media", "u-committee-head"]) {
      const seen = await ep.rankingView.invoke({ unitId: "khalid" }, canonicalActor(personId), DECISION)
      expect(seen.ok, personId).toBe(false)
    }
  })

  it("وسجلُّ الطالب التراكميُّ محروسٌ بـ`circle.view`، ومرفوضٌ لمن لا يملكها", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const allowed = await ep.studentRecordView.invoke(
      { circleId: world.circleId, enrollmentId: world.studentA },
      canonicalActor("u-amir"),
      DECISION,
    )
    expect(allowed.ok).toBe(true)
    const denied = await ep.studentRecordView.invoke(
      { circleId: world.circleId, enrollmentId: world.studentA },
      canonicalActor("u-student"),
      DECISION,
    )
    expect(denied.ok).toBe(false)
  })

  it("**ومصفوفةُ الأبواب**: كلُّ دالةٍ تعلن قدرةً من الخمس ونيّتَها وسجلَّ تدقيقها", () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const ALLOWED = new Set([
      "circle.view",
      "circle.manage",
      "circle.teach",
      "circle.notes.supervise",
      "guardianLink.manage",
    ])
    const declarations = Object.values(ep).map((fn) => fn.declaration)
    expect(declarations).toHaveLength(13)
    for (const d of declarations) {
      expect(ALLOWED, d.name).toContain(d.capability)
      expect(d.scope, d.name).toBeTypeOf("function")
      expect(d.audit.length, d.name).toBeGreaterThan(0)
    }
  })

  it("**والانتحالُ القرائيّ لا يكتب** (ب-٤٠أ): جلسةُ اطّلاعٍ تُردّ على كل فعلٍ كاتب", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const impersonated: Actor = { ...canonicalActor("u-amir"), impersonatedBy: "u-admin" }
    const done = await ep.record.invoke(
      { circleId: world.circleId, at: NOW, rows: [{ ...ROW, enrollmentId: world.studentA }] },
      impersonated,
      WRITE,
    )
    expect(!done.ok && done.decision.reason).toBe("DENIED_IMPERSONATION_READONLY")
  })

  it("وحسابٌ موقوفٌ مرفوضٌ على كل بابٍ — بوابةُ الهوية تسبق النطاق", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const suspended: Actor = { ...canonicalActor("u-amir"), accountStatus: "suspended" }
    const done = await ep.dayView.invoke({ circleId: world.circleId, at: NOW }, suspended, DECISION)
    expect(!done.ok && done.decision.reason).toBe("DENIED_ACCOUNT_SUSPENDED")
  })

  it("**وقائمةُ الروابط ونوافذُ العرض كلُّها على نطاق الحلقة** — لا نافذةَ بلا نطاقٍ مشتق", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const listed = await ep.linkList.invoke(
      { circleId: world.circleId },
      canonicalActor("u-amir-bilal"),
      DECISION,
    )
    expect(listed.ok).toBe(false)
    const notes = await ep.notesView.invoke(
      { circleId: world.circleId },
      canonicalActor("u-amir-bilal"),
      DECISION,
    )
    expect(notes.ok).toBe(false)
  })
})

describe("عزلُ النطاق على القراءة كذلك (ق-١٧: الاطّلاعُ هابطٌ لا صاعد)", () => {
  it("أميرُ خالد لا يقرأ كشفَ حلقةِ بلال — و`circle.view` نطاقُها ما تحته فقط", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const done = await ep.dayView.invoke(
      { circleId: world.otherCircleId, at: NOW },
      canonicalActor("u-amir"),
      DECISION,
    )
    expect(!done.ok && done.decision.reason).toBe("DENIED_OUT_OF_SCOPE")
  })

  it("ومشرفُ المربع يقرأ الحلقتين معاً — الاحتواءُ هابطٌ بالنطاق لا بالاسم", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    for (const circleId of [world.circleId, world.otherCircleId]) {
      const done = await ep.dayView.invoke(
        { circleId, at: NOW },
        canonicalActor("u-square"),
        DECISION,
      )
      expect(done.ok, circleId).toBe(true)
    }
  })

  it("**والنطاقُ يُشتقّ من وحدةٍ مخزَّنة**: التقييمُ لوحدةٍ مجهولةٍ ⇒ رفض", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const done = await ep.rankingView.invoke(
      { unitId: "لا-وحدة" },
      canonicalActor("u-admin"),
      DECISION,
    )
    expect(done.ok).toBe(false)
  })

  it("وأميرُ خالد لا يبلغ نطاقَ المربع في التقييم (نطاقُ `circle.view` هابطٌ من تكليفه)", async () => {
    const world = seedWorld()
    const ep = endpointsFor(world)
    const own = await ep.rankingView.invoke({ unitId: "khalid" }, canonicalActor("u-amir"), DECISION)
    expect(own.ok && own.value.scopePath).toBe(KHALID_PATH)
    const up = await ep.rankingView.invoke({ unitId: "sq2" }, canonicalActor("u-amir"), DECISION)
    expect(up.ok).toBe(false)
  })
})
