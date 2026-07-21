/**
 * المصفوفة الذهبية المولَّدة — بوابة G5، كل تسليم.
 * لا تُكتب حالةٌ هنا يدوياً: كلها من `generateMatrixCases()` عن ملف المصفوفة.
 */
import { describe, it, expect } from "vitest"
import { generateMatrixCases, ROLE_HOME_SCOPE } from "../../src/authorization/matrix-cases.js"
import { ROLE_IDS, ROLES } from "../../src/authorization/generated/roles.generated.js"
import { can, type Actor, type DecisionContext } from "../../src/authorization/can.js"
import { CAPS } from "../../src/authorization/generated/capabilities.generated.js"
import { unitScope, selfScope } from "../../src/authorization/scope.js"

const CTX: DecisionContext = {
  now: new Date("2026-07-20T00:00:00.000Z"),
  intent: "read",
  isFeatureEnabled: () => true,
}

const START = new Date("2026-01-01T00:00:00.000Z")
const report = generateMatrixCases()

describe("القاعدة الذهبية: السلبيات أكثر من الإيجابيات دائماً وبنيوياً", () => {
  it("حالات السلب تفوق حالات الإيجاب", () => {
    expect(report.negatives).toBeGreaterThan(report.positives)
  })

  it("والحالات المولَّدة تغطي كل خلية في المصفوفة", () => {
    // ٨٧ قدرة × ١٠ أدوار حية = ٨٧٠ خلية، لكلٍّ حالةٌ واحدة على الأقل.
    const covered = new Set(report.cases.map((c) => `${c.roleId}|${c.capId}`))
    expect(covered.size).toBe(870)
  })

  it("لكل دور حيّ نطاقٌ قانوني في العالم — وإلا سقطت تغطيته صامتة", () => {
    for (const roleId of ROLE_IDS.filter((r) => ROLES[r].state === "active")) {
      expect(ROLE_HOME_SCOPE[roleId], `الدور ${roleId} بلا نطاق قانوني`).toBeDefined()
    }
  })

  it("ولا حالة مُسقَطة بصمت — المتعذّر بنيوياً معلَنٌ معدود", () => {
    expect(report.skipped.length).toBeGreaterThan(0)
    // نطاق الجذر لا نطاقَ أجنبيّ عنه: هذا صحيحٌ بنيوياً، ويُعلن ولا يُبتلع.
    for (const s of report.skipped) expect(s).toMatch(/متعذّر بنيوياً/)
  })
})

describe("المصفوفة الذهبية دور×قدرة — كل خلية مُختبَرة", () => {
  for (const c of report.cases) {
    const title = `${c.expectAllowed ? "✔" : "✘"} ${c.label} [${c.variant}]`
    it(title, () => {
      const actor: Actor = {
        personId: `gen-${c.roleId}`,
        accountStatus: "active",
        sessionEpoch: 1,
        currentSessionEpoch: 1,
        assignments: [
          {
            roleId: c.roleId,
            scopePath: c.assignmentScope,
            startDate: START,
            endDate: null,
            approvalStatus: "approved",
            unitArchived: false,
          },
        ],
        overrides:
          c.variant === "override_grant"
            ? [
                {
                  capId: c.capId,
                  scopePath: c.requestScope,
                  effect: "grant",
                  startDate: START,
                  endDate: null,
                  reason: "منح مولَّد للاختبار",
                },
              ]
            : c.variant === "override_deny"
              ? [
                  {
                    capId: c.capId,
                    scopePath: c.requestScope,
                    effect: "deny",
                    startDate: START,
                    endDate: null,
                    reason: "حجب مولَّد للاختبار",
                  },
                ]
              : [],
      }

      const meta = CAPS[c.capId]
      // القدرة الشخصية تُفحص بالملكية لا بالشجرة.
      const scope =
        meta.type === "personal"
          ? c.expectAllowed
            ? selfScope(actor.personId, meta.module, "e1")
            : selfScope("someone-else", meta.module, "e1")
          : unitScope(c.requestScope)

      const decision = can(actor, c.capId, scope, CTX)

      expect(decision.allowed, `${title} · السبب: ${decision.reason}`).toBe(c.expectAllowed)
      // التوكيد على **السبب الصحيح** لا على «رُفض» وحدها.
      if (!decision.allowed) expect(decision.reason).toMatch(/^DENIED_/)
      else expect(decision.reason).toMatch(/^ALLOWED_/)
    })
  }
})
