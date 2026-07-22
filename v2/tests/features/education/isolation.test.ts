/**
 * **الاختبارُ الإلزاميّ السابع** (T19) — **قب-١٨ عزلُ الشبكة** و**عزلُ النطاق**.
 *
 * الشبكةُ الثانية تُبنى **بنفس المسارات النسبيّة عمداً**: فلو كان العزلُ يقوم على تباعد
 * المسارات لَسقط هنا. وهو لا يقوم عليه — بل على أنّ **المستودعَ مستودعُ شبكةٍ واحدة**،
 * فمُحلِّلُ النطاق لا يجد كيانَ الشبكة الأخرى أصلاً ⇒ `NO_SCOPE` ⇒ **رفضٌ يُقفل ولا يُفتح**.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { clearRegistryForTests } from "../../../src/server/defineServerFn.js"
import { makeEducationEndpoints } from "../../../src/features/education/server/endpoints.js"
import { EducationTenantRegistry } from "../../../src/features/education/data/tenant.js"
import { curriculumProgress } from "../../../src/features/education/services/progress.js"
import { recordLesson } from "../../../src/features/education/services/lessons.js"
import {
  canonicalActor,
  DECISION,
  educationContext,
  educationPorts,
  emptyCircleOf,
  HELD_AT,
  KHALID_PATH,
  MAIN_TENANT_ID,
  SECOND_TENANT_ID,
  SESSION_A,
  SETTINGS,
  seedWorld,
  WRITE,
  circleDays,} from "./_seed.js"

beforeEach(() => {
  clearRegistryForTests()
})

describe("قب-١٨ — **عزلُ الشبكة بنيويّ**: لا مِقبضَ عابرٌ بين شبكتين", () => {
  it("مستودعُ كل شبكةٍ منفصلٌ ويُعاد هو نفسُه — ولا يتسرّب صفٌّ بينهما", () => {
    const registry = new EducationTenantRegistry()
    const a = registry.storeFor(MAIN_TENANT_ID)
    const b = registry.storeFor(SECOND_TENANT_ID)
    expect(a).not.toBe(b)
    expect(registry.storeFor(MAIN_TENANT_ID)).toBe(a)
    expect(registry.has(SECOND_TENANT_ID)).toBe(true)
    expect(registry.tenantIds().sort()).toEqual([MAIN_TENANT_ID, SECOND_TENANT_ID].sort())

    a.saveCurriculum({ tenantId: MAIN_TENANT_ID, id: "cur-x", ar: "منهاج", circleTypeId: "baseera" })
    expect(b.getCurriculum("cur-x")).toBeNull()
  })

  it("**والشبكةُ تُختم من المستودع لا من المدخل**: صفٌّ يدّعي شبكةً أخرى يُختم بشبكة مستودعه", () => {
    const registry = new EducationTenantRegistry()
    const store = registry.storeFor(MAIN_TENANT_ID)
    store.saveCurriculum({ tenantId: SECOND_TENANT_ID, id: "cur-y", ar: "منهاج", circleTypeId: "baseera" })
    expect(store.getCurriculum("cur-y")?.tenantId).toBe(MAIN_TENANT_ID)
  })

  it("**ودرسُ شبكةٍ لا يُرى من شبكةٍ أخرى ولو تطابق مسارُ حلقتها النسبيّ**", async () => {
    const main = seedWorld(MAIN_TENANT_ID)
    const other = seedWorld(SECOND_TENANT_ID)
    // حلقةٌ تعيش في الشبكة الثانية وحدها — **مسارُها النسبيُّ مطابقٌ** ومعرّفُها لا وجودَ له هناك.
    const strangerCircleId = emptyCircleOf(other)
    expect(main.circles.getCircle(strangerCircleId), "المعرّفُ موجودٌ في الشبكتين — الفحصُ عقيم").toBeNull()
    expect(other.circles.getCircle(strangerCircleId)?.unitPath).toBe(KHALID_PATH)

    const done = recordLesson(other.education, educationContext(other), {
      circleId: other.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 60,
      presentEnrollmentIds: [other.enrollmentIds[0]!],
    })
    expect(done.ok).toBe(true)

    // نقطةُ الخدمة مبنيّةٌ على **مستودعَي الشبكة الأولى** — فحلقةُ الثانية غيرُ موجودةٍ فيها
    // ⇒ `NO_SCOPE` ⇒ رفضٌ **قبل** فحص القدرة، ولو كان الفاعلُ أميرَ المسار نفسِه.
    const ep = makeEducationEndpoints(main.education, educationPorts(main), SETTINGS, () => false, circleDays(main))
    const r = await ep.circleLessons.invoke(
      { circleId: strangerCircleId },
      canonicalActor("u-amir"),
      DECISION,
    )
    expect(r.ok, "بلغ فاعلُ شبكةٍ حلقةَ شبكةٍ أخرى").toBe(false)

    const w = await ep.recordByOwner.invoke(
      {
        circleId: strangerCircleId,
        sessionId: SESSION_A,
        heldAt: HELD_AT,
        durationMinutes: 60,
        presentEnrollmentIds: [other.enrollmentIds[0]!],
      },
      canonicalActor("u-amir"),
      WRITE,
    )
    expect(w.ok, "كتب فاعلُ شبكةٍ في حلقةِ شبكةٍ أخرى").toBe(false)

    // **ولا يتسرّب درسُ الثانية إلى قراءة الأولى**: حلقةُ الأولى بلا درسٍ رغم تطابق المعرّفات.
    const own = await ep.circleLessons.invoke({ circleId: main.circleId }, canonicalActor("u-amir"), DECISION)
    expect(own.ok).toBe(true)
    if (!own.ok) return
    expect(own.value.lessons).toEqual([])
  })
})

describe("عزلُ النطاق — الحارسُ يشتقّ نطاقَه من **الكيان المخزَّن** لا من مدخل العميل", () => {
  it("درسُ حلقةٍ في مسجدٍ آخر مرفوضٌ لأمير المسجد الأول (لا للاختفاء بل للرفض)", async () => {
    const w = seedWorld()
    const ep = makeEducationEndpoints(w.education, educationPorts(w), SETTINGS, () => false, circleDays(w))
    const r = await ep.recordByOwner.invoke(
      {
        circleId: w.circleId,
        sessionId: SESSION_A,
        heldAt: HELD_AT,
        durationMinutes: 60,
        presentEnrollmentIds: [w.enrollmentIds[0]!],
      },
      canonicalActor("u-amir-bilal"),
      WRITE,
    )
    expect(r.ok).toBe(false)
  })

  it("**والاشتقاقُ لا يعبر الحلقات**: تقدّمُ حلقةٍ يُبنى من ملتحقيها ودروسِها هي وحدها", () => {
    const main = seedWorld(MAIN_TENANT_ID)
    const other = seedWorld(SECOND_TENANT_ID)
    recordLesson(other.education, educationContext(other), {
      circleId: other.circleId,
      sessionId: SESSION_A,
      heldAt: HELD_AT,
      durationMinutes: 60,
      presentEnrollmentIds: other.enrollmentIds.map((id) => id),
    })
    const matrix = curriculumProgress(main.education, educationContext(main), main.circleId)
    expect(matrix.ok).toBe(true)
    if (!matrix.ok) return
    expect(matrix.value.completedCells).toBe(0)
  })
})
