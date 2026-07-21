/**
 * مولِّد حالات المصفوفة الذهبية — TESTING_POLICY §٤ الطبقة الأولى، وSPEC_authorization §٥.١.
 *
 * «تُولَّد الاختبارات آلياً من المصفوفة نفسها — لا تُكتب يدوياً لكل خلية — فإذا تغيرت
 *  المصفوفة تغيرت الاختبارات معها آلياً، ويستحيل انحرافهما.»
 *
 * القاعدة الذهبية المحروسة هنا: **حالات السلب أكثر من حالات الإيجاب دائماً.**
 * النظام الآمن يُعرَّف بما يمنعه.
 */

import { CAPS, CAP_IDS, type CapId } from "./generated/capabilities.generated.js"
import { ROLES, ROLE_IDS, ROLE_CAPABILITIES, type RoleId } from "./generated/roles.generated.js"
import { ROOT_PATH, contains } from "./scope.js"

export type MatrixCase = {
  readonly kind: "positive" | "negative"
  readonly roleId: RoleId
  readonly capId: CapId
  /** نطاق إسناد الفاعل. */
  readonly assignmentScope: string
  /** النطاق المطلوب في الاستدعاء. */
  readonly requestScope: string
  readonly expectAllowed: boolean
  readonly label: string
  readonly variant:
    | "role_holds_own_scope"
    | "role_lacks_capability"
    | "role_lacks_and_foreign_scope"
    | "role_holds_foreign_scope"
    | "override_grant"
    | "override_deny"
}

/** نطاق الإسناد القانوني لكل دور حيّ — من العالم القانوني (TESTING_POLICY §٥). */
export const ROLE_HOME_SCOPE: Readonly<Record<string, string>> = Object.freeze({
  admin: ROOT_PATH,
  section_head: "/men/",
  rabita: "/men/homs/",
  square: "/men/homs/sq2/",
  amir: "/men/homs/sq2/khalid/",
  teacher: "/men/homs/sq2/khalid/c1/",
  committee_head: "/men/homs/sq2/khalid/",
  media: ROOT_PATH,
  finance_officer: ROOT_PATH,
  student: "/men/homs/sq2/khalid/c1/",
})

/** نطاقٌ أجنبيّ مضمونُ الخروج عن نطاق الأدوار الرجالية. */
const FOREIGN_SCOPE = "/women/"

export type GenerationReport = {
  readonly cases: readonly MatrixCase[]
  readonly positives: number
  readonly negatives: number
  /** حالات تعذّر توليدها بنيوياً — تُعلن ولا تُبتلع صامتة. */
  readonly skipped: readonly string[]
}

export function generateMatrixCases(): GenerationReport {
  const cases: MatrixCase[] = []
  const skipped: string[] = []
  const liveRoles = ROLE_IDS.filter((r) => ROLES[r].state === "active")

  for (const roleId of liveRoles) {
    // كل دور حيّ له نطاق قانوني — يحرسه اختبارٌ صريح، فلا حاجة لفرعٍ ميت هنا.
    const home = ROLE_HOME_SCOPE[roleId]!
    const bundle = ROLE_CAPABILITIES[roleId]

    for (const capId of CAP_IDS) {
      const meta = CAPS[capId]
      const holds = bundle.has(capId)
      // القدرة الجذرية لا تُمارَس إلا على الجذر — فنطاق الطلب هو الجذر أياً كان نطاق الإسناد.
      const requestScope = meta.type === "root" ? ROOT_PATH : home

      if (holds) {
        // ── الإيجاب: بالدور على نطاقه ⇒ تنجح ──
        cases.push({
          kind: "positive",
          roleId,
          capId,
          assignmentScope: home,
          requestScope,
          expectAllowed: true,
          label: `«${ROLES[roleId].ar}» يملك «${meta.ar}» على نطاقه`,
          variant: "role_holds_own_scope",
        })

        // ── السلب: بالقدرة على نطاق آخر ⇒ تُرفض ──
        const foreign = meta.type === "root" ? "/men/" : FOREIGN_SCOPE
        if (meta.type !== "personal" && !contains(home, foreign)) {
          cases.push({
            kind: "negative",
            roleId,
            capId,
            assignmentScope: home,
            requestScope: foreign,
            expectAllowed: false,
            label: `«${ROLES[roleId].ar}» لا يمارس «${meta.ar}» خارج نطاقه`,
            variant: "role_holds_foreign_scope",
          })
        } else if (meta.type !== "personal") {
          // نطاق الإسناد هو الجذر: لا يوجد نطاقٌ أجنبيّ عنه بنيوياً — وهذا صحيحٌ لا نقص.
          skipped.push(`سلب النطاق الأجنبي متعذّر بنيوياً: ${roleId} × ${capId} (نطاقه الجذر)`)
        }
      } else {
        // ── السلب (الأهم): بلا القدرة ⇒ تُرفض، على نطاقه وعلى نطاق آخر ──
        cases.push({
          kind: "negative",
          roleId,
          capId,
          assignmentScope: home,
          requestScope,
          expectAllowed: false,
          label: `«${ROLES[roleId].ar}» لا يملك «${meta.ar}» ولو على نطاقه`,
          variant: "role_lacks_capability",
        })
        cases.push({
          kind: "negative",
          roleId,
          capId,
          assignmentScope: home,
          requestScope: meta.type === "root" ? "/men/" : FOREIGN_SCOPE,
          expectAllowed: false,
          label: `«${ROLES[roleId].ar}» لا يملك «${meta.ar}» ولا خارج نطاقه`,
          variant: "role_lacks_and_foreign_scope",
        })
      }
    }
  }

  // ── حالتا التجاوز لكل قدرة: منحٌ فوق الدور ينجح · حجبٌ تحته يُرفض ──
  for (const capId of CAP_IDS) {
    const meta = CAPS[capId]
    const scope = meta.type === "root" ? ROOT_PATH : "/men/homs/sq2/khalid/"
    cases.push({
      kind: "positive",
      roleId: "student",
      capId,
      assignmentScope: "/men/homs/sq2/khalid/",
      requestScope: scope,
      expectAllowed: true,
      label: `منحٌ فرديّ فوق الدور يفتح «${meta.ar}»`,
      variant: "override_grant",
    })
    cases.push({
      kind: "negative",
      roleId: "admin",
      capId,
      assignmentScope: ROOT_PATH,
      requestScope: scope,
      expectAllowed: false,
      label: `حجبٌ فرديّ يغلب الدور في «${meta.ar}»`,
      variant: "override_deny",
    })
  }

  return {
    cases,
    positives: cases.filter((c) => c.kind === "positive").length,
    negatives: cases.filter((c) => c.kind === "negative").length,
    skipped,
  }
}
