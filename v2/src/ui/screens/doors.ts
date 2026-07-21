/**
 * معجمُ الأبواب — تجسيدُ ق-٢٨ «لكل قدرةٍ باب» (SPEC_role_lenses §٢/§٢.١٢-أ).
 *
 * البابُ = (سطحٌ، قدراتٌ يفتحها ذلك السطح). واشتقاقُه من جداول أبواب العدسات لا من اجتهاد:
 * كلُّ صفٍّ هنا يقابل صفَّ «الباب» في عدسةِ دورٍ واحدٍ على الأقل. وG20 تفحصه في اتجاهين:
 *  - **الأمام**: كل قدرةٍ في الكتالوج لها بابٌ ⟵ لا «قدرةٌ ميتة» (خادمٌ يسمح وواجهةٌ تُقفل — ع-٣١).
 *  - **العكس**: لكل دورٍ حيّ، كلُّ قدرةٍ يحملها لها بابٌ **يصله** — والوصولُ يُحسب من
 *    قدراته وحدها (`openedBy` بـ`anyOf`)، فأميرُ المسجد الذي لا يملك `network.view` لا يُحسب
 *    بابُ «البيان» بابَه، ولذلك له أبوابُه على «مسجدي» (§٢.٥ ثابتٌ حاسم).
 */

import type { CapId } from "../../authorization/generated/capabilities.generated.js"
import { SURFACES, type SurfaceId } from "../shell/surfaces.js"

export type Door = {
  readonly surface: SurfaceId
  readonly capabilities: readonly CapId[]
}

export const DOORS: readonly Door[] = Object.freeze([
  // القشرة: الإعلانات (عدسات admin/section_head/rabita/square/amir — «القشرة: الإعلانات»).
  { surface: "home", capabilities: ["announcement.publish"] },
  // السطحُ الشخصيّ المشترك: المطلوب مني · مكتبتي · كشف راتبي · عُهدتي · حسابي (§٢ تصدير).
  {
    surface: "personal",
    capabilities: [
      "duties.own",
      "library.own",
      "payroll.own",
      "custody.own",
      "account.self",
      "box.handover.acknowledge",
    ],
  },
  // البيان: الاطّلاع الهابط والاعتماد والتدخل وصندوق القرار (عدسات القيادات).
  {
    surface: "bayan",
    capabilities: [
      "network.view",
      "report.view",
      "report.submit",
      "report.approve",
      "report.approve.override",
      "report.retract",
      "report.export",
      "records.editLocked",
      "records.correct",
      "approve.breakGlass",
      "dailyLog.view",
      "dailyLog.attach",
      "visit.conduct",
      "visit.approve",
      "visit.view",
    ],
  },
  // مسجدي: أبوابُ الأمير كلُّها من صفحة مسجده (§٢.٥) — لا يمرّ بالبيان.
  {
    surface: "myMosque",
    capabilities: [
      "report.view",
      "report.submit",
      "report.approve",
      "report.retract",
      "dailyLog.view",
      "dailyLog.edit",
      "dailyLog.attach",
      "familyRoster.manage",
      "circle.view",
      "circle.manage",
      "circle.notes.supervise",
      "guardianLink.manage",
      "visit.view",
    ],
  },
  // حلقاتي: عدسةُ المعلم بالملكية لا بالنطاق (ع-١١).
  { surface: "myCircles", capabilities: ["circle.teach", "guardianLink.manage"] },
  // لجنتي: مسؤول اللجنة (ق-١٣).
  { surface: "myCommittee", capabilities: ["committee.own"] },
  // التعليم (داخل صفحة الوحدة): الحلقة كيانٌ واحدٌ بمرشّح نوع (ب-٢٨).
  {
    surface: "education",
    capabilities: [
      "circle.view",
      "circle.manage",
      "circle.notes.supervise",
      "familyRoster.manage",
      "guardianLink.manage",
      "dailyLog.view",
      "dailyLog.edit",
    ],
  },
  { surface: "activities", capabilities: ["exam.manage", "exam.take", "duties.manage"] },
  { surface: "library", capabilities: ["library.own", "library.manage"] },
  {
    surface: "competition",
    capabilities: [
      "competition.view",
      "competition.manage",
      "competition.enroll.approve",
      "competition.score.record",
      "competition.result.declare",
    ],
  },
  {
    surface: "family",
    capabilities: ["committees.view", "committees.manage", "meetings.view", "meetings.manage"],
  },
  {
    surface: "box",
    capabilities: [
      "box.view",
      "box.receive",
      "box.spend",
      "box.handover",
      "box.handover.acknowledge",
      "box.closing.submit",
      "box.closing.approve",
      "mosqueFinance.view",
      "mosqueFinance.manage",
    ],
  },
  {
    surface: "centralFinance",
    capabilities: [
      "finance.view",
      "finance.entry",
      "finance.approve",
      "finance.supervise",
      "finance.payout",
      "ledger.journal.entry",
      "finance.import",
      "finance.reconcile",
      "finance.export",
      "budget.manage",
      "payroll.view",
      "payroll.run",
      "payroll.approve",
      "incentive.manage",
    ],
  },
  { surface: "custody", capabilities: ["custody.view", "custody.grant", "custody.own", "asset.manage"] },
  { surface: "media", capabilities: ["media.hub", "media.post"] },
  {
    surface: "admin",
    capabilities: [
      "users.provision",
      "user.manage",
      "user.role.grant.elevated",
      "registration.approve",
      "account.status.manage",
      "account.password.reset",
      "orgUnit.manage",
      "orgUnit.manage.root",
      "admin.view",
      "permissions.manage",
      "settings.view",
      "settings.manage",
      "audit.view",
      "featureFlag.manage",
      "support.impersonate_read",
      "system.jobs.run",
      "activityCatalog.manage",
    ],
  },
])

/** كل القدرات التي لها بابٌ ما. */
export function doorCapabilities(): ReadonlySet<CapId> {
  return new Set(DOORS.flatMap((d) => [...d.capabilities]))
}

/** الأبوابُ التي يصلها حاملُ هذه القدرات — الوصولُ بـ`anyOf` على سطح الباب. */
export function reachableDoorsFor(caps: ReadonlySet<CapId>): readonly Door[] {
  return DOORS.filter((door) => {
    const surface = SURFACES.find((s) => s.id === door.surface)
    if (surface === undefined) return false
    if (surface.openedBy.length === 0) return true
    return surface.openedBy.some((cap) => caps.has(cap))
  })
}
