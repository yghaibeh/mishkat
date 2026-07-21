/**
 * ق-١/ق-٢/ق-٣/ق-٤ — **التوجيه: الأقربُ النشطُ المكلَّف حصراً** (عقدُ الوحدة §١).
 *
 * أوّلُ أربعةٍ من الثلاثةَ عشرَ الإلزامية. والسلبُ فيها أكثرُ من الإيجاب: أن يُعرف مَن **لا**
 * يعتمد أهمُّ من أن يُعرف مَن يعتمد (درسُ ع-٢٢ — «حلقةٌ تنتظر اعتماداً عند غير أهلها»).
 */
import { describe, it, expect } from "vitest"
import {
  ancestorsOf,
  approverLayerFor,
  breakGlassHolders,
  isAboveLayer,
  isAboveUnit,
  type RoutingContext,
} from "../../../src/features/approval/services/routing.js"
import { makeCapabilityCheck } from "../../../src/features/approval/services/authority.js"
import type { Actor } from "../../../src/authorization/can.js"
import {
  HOMS_APPROVERS,
  HOMS_PATH,
  KHALID_PATH,
  LAYERS_ABOVE_KHALID,
  MEN_PATH,
  NOW,
  OMAR_PATH,
  READ,
  SQ2_APPROVERS,
  SQ2_PATH,
  canonicalPeople,
  peopleWithout,
  withEndedAssignments,
} from "./_seed.js"

function routing(people: readonly Actor[] = canonicalPeople()): RoutingContext {
  return { now: NOW, people, holds: makeCapabilityCheck(people, READ) }
}

function approversOf(ctx: RoutingContext, unitPath: string): readonly string[] {
  const layer = approverLayerFor(ctx, "report.approve", unitPath)
  return layer.kind === "layer" ? layer.approvers : []
}

function layerPathOf(ctx: RoutingContext, unitPath: string): string | null {
  const layer = approverLayerFor(ctx, "report.approve", unitPath)
  return layer.kind === "layer" ? layer.scopePath : null
}

describe("ق-١/١ — الأقربُ سلَفٌ **صارم**: لا وحدةَ تعتمد عملَ نفسها", () => {
  it("أسلافُ مسجدِ خالد بترتيب القرب: المربع ثم المنطقة ثم القسم ثم الجذر — ولا مسارُ المسجد نفسِه", () => {
    expect(ancestorsOf(KHALID_PATH)).toEqual([SQ2_PATH, HOMS_PATH, MEN_PATH, "/"])
  })

  it("والجذرُ بلا سلَف — فلا معتمِدَ فوق الشبكة", () => {
    expect(ancestorsOf("/")).toEqual([])
  })

  it("مع مربعٍ ومنطقةٍ ورأس قسم: المعتمِد **مكلَّفو المربع وحدهم**", () => {
    expect(layerPathOf(routing(), KHALID_PATH)).toBe(SQ2_PATH)
    expect(approversOf(routing(), KHALID_PATH)).toEqual([...SQ2_APPROVERS])
  })

  it("**والمنطقةُ ورأسُ القسم ليسا في الطبقة** ولو حملا `report.approve` على نطاقٍ يحتوي المسجد", () => {
    const holds = makeCapabilityCheck(canonicalPeople(), READ)
    // القدرةُ **لازمة**: المحرّكُ يجيبهما بنعم…
    expect(holds("u-rabita", "report.approve", KHALID_PATH)).toBe(true)
    expect(holds("u-section-head", "report.approve", KHALID_PATH)).toBe(true)
    // …و**غيرُ كافية**: الطبقةُ الأقربُ لا تضمّهما (برهانُ §٤.٢).
    const approvers = approversOf(routing(), KHALID_PATH)
    expect(approvers).not.toContain("u-rabita")
    expect(approvers).not.toContain("u-section-head")
  })
})

describe("ق-٢ — تخطّي الشاغر **آليّ**: بتفريغ التكليف لا بإعدادٍ يدويّ", () => {
  it("مسجدٌ تحت مربعٍ شاغرٍ أصلاً ⇒ الأقربُ المنطقةُ تلقائياً", () => {
    expect(layerPathOf(routing(), OMAR_PATH)).toBe(HOMS_PATH)
    expect(approversOf(routing(), OMAR_PATH)).toEqual([...HOMS_APPROVERS])
  })

  it("**تفريغُ تكليف الأقرب يصعد بالتوجيه بلا سطرِ إعداد**: المربع ⟵ المنطقة", () => {
    expect(layerPathOf(routing(), KHALID_PATH)).toBe(SQ2_PATH)
    const after = routing(withEndedAssignments(...SQ2_APPROVERS))
    expect(layerPathOf(after, KHALID_PATH)).toBe(HOMS_PATH)
    expect(approversOf(after, KHALID_PATH)).toEqual([...HOMS_APPROVERS])
  })

  it("وتفريغُ طبقتين يصعد إلى رأس القسم — الصعودُ يستمرّ ولا يقف", () => {
    const people = withEndedAssignments(...SQ2_APPROVERS, ...HOMS_APPROVERS)
    expect(layerPathOf(routing(people), KHALID_PATH)).toBe(MEN_PATH)
    expect(approversOf(routing(people), KHALID_PATH)).toEqual(["u-section-head"])
  })
})

describe("ق-٣/ق-٤ — الإدارةُ اطّلاعٌ لا عمل: **بلا حالةٍ خاصةٍ في الكود**", () => {
  it("الإدارةُ ليست في أي طبقةِ اعتمادٍ لأيّ وحدة — والسببُ أن المصفوفةَ لا تمنحها القدرة", () => {
    const holds = makeCapabilityCheck(canonicalPeople(), READ)
    expect(holds("u-admin", "report.approve", KHALID_PATH)).toBe(false)
    expect(holds("u-admin", "box.closing.approve", KHALID_PATH)).toBe(false)

    for (const path of [KHALID_PATH, OMAR_PATH, SQ2_PATH, HOMS_PATH]) {
      expect(approversOf(routing(), path), path).not.toContain("u-admin")
    }
  })

  it("**وحين تشغر كلُّ الطبقات فالتوجيهُ «شاغر» لا «الإدارة»** — كسرُ الزجاج بابٌ آخر", () => {
    const empty = routing(peopleWithout(...LAYERS_ABOVE_KHALID))
    expect(approverLayerFor(empty, "report.approve", KHALID_PATH).kind).toBe("vacant")
    // والإدارةُ هناك بقدرةِ كسرِ الزجاج وحدها — على الجذر صراحةً.
    expect(breakGlassHolders(empty)).toEqual(["u-admin"])
  })

  it("والدورُ الموقوف لا يصير طبقةً (قب-٧): أمينُ السرّ الموقوف لا يظهر معتمِداً لحلقةِ مسجده", () => {
    expect(approversOf(routing(), `${KHALID_PATH}c1/`)).not.toContain("u-suspended-role")
  })

  it("وسؤالُ «أهو فوق؟» عن شخصٍ خارج اللقطة جوابُه لا — لا افتراضَ حسنَ ظنّ", () => {
    expect(isAboveUnit(routing(), "u-ghost", KHALID_PATH)).toBe(false)
    expect(isAboveLayer(routing(), "u-ghost", SQ2_PATH)).toBe(false)
    expect(isAboveUnit(routing(), "u-section-head", KHALID_PATH)).toBe(true)
    expect(isAboveLayer(routing(), "u-amir", SQ2_PATH)).toBe(false)
  })

  it("والتكليفُ المعلّقُ لا يدخل الحساب إطلاقاً (ق-١٤/ق-٢٥)", () => {
    // في مسجد عمر أميران: معتمَدٌ ومعلَّق. طبقةُ حلقتِه تضمّ المعتمَدَ وحده.
    const approvers = approversOf(routing(), `${OMAR_PATH}c2/`)
    expect(approvers).toEqual(["u-amir-omar"])
    expect(approvers).not.toContain("u-pending")
  })
})
