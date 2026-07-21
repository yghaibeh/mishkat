/**
 * شاشاتُ اللجان والاجتماعات — عقودُها في `SPEC.md` §٧، وحاكمُها G20.
 *
 * **طبقةُ عرضٍ نقيّة**: دالةٌ من (قشرةِ القدرات المحسوبة + لقطةِ الصفحة) إلى بنية عرض. لا
 * تقرر صلاحيةً ولا تفحص دوراً (المادة ٤/٦)، **ولا تحسب رقماً**: كلُّ رقمٍ فيها مُسقَطٌ من
 * **مصدر الصفحة الواحد** (ق-١١١) — علاجُ ج٥ البنيويّ (انفصامُ الكتابة عن القراءة).
 *
 * **ومفرداتُ كل عدسةٍ من عدستها**: «لجان مسجدي · اجتماعات المسجد» للأمير (§٢.٥)، و«لجنتي ·
 * خطتنا · أنشطتنا · إقرار الأمير» لمسؤول اللجنة (§٢.٧). **والطابعُ قب-٢٥**: الفراغُ مِحرابٌ
 * ينتظر (من مكوّن `EmptyState` نفسِه)، و**صفر صورة** في كل شجرة العرض.
 */

import type { CapId } from "../../../authorization/generated/capabilities.generated.js"
import { appShell, navProjection } from "../../../ui/shell/shell.js"
import { button } from "../../../ui/components/atoms.js"
import { field, form, statCard } from "../../../ui/components/molecules.js"
import { dataTable, emptyState } from "../../../ui/components/organisms.js"
import type { UiNode } from "../../../ui/components/kernel.js"
import { registerScreen } from "../../../ui/screens/registry.js"
import type { ScreenContract } from "../../../ui/screens/contract.js"
import { formatHijri, formatNumber } from "../../../ui/text/format.js"
import type { Committee, CommitteeActivity, CommitteeMember, Meeting } from "../types.js"

type Caps = ReadonlySet<CapId>

/** قيمةٌ غائبةٌ في المعاينة — محرفٌ محايدٌ لا نصَّ فيه (لا حرفَ خارج طبقة النصوص). */
const ABSENT = "—"

export type CommitteeRow = Readonly<Record<string, string>>

/** لقطةُ الصفحة — **مصدرُ بياناتٍ واحد** (ق-١١١)، منسّقةٌ في طبقةٍ واحدة قبل العرض. */
export type CommitteeSnapshot = {
  readonly unitLabelAr: string
  readonly scopePath: string
  readonly committeeRows: readonly CommitteeRow[]
  readonly memberRows: readonly CommitteeRow[]
  readonly activityRows: readonly CommitteeRow[]
  readonly meetingRows: readonly CommitteeRow[]
  /** أرقامُ البطاقات — **منسَّقةٌ** لا محسوبةٌ هنا. */
  readonly activeCommitteesAr: string
  readonly decisionsCountAr: string
  readonly participantsAr: string
}

export const EMPTY_COMMITTEE_SNAPSHOT: CommitteeSnapshot = Object.freeze({
  unitLabelAr: ABSENT,
  scopePath: "/",
  committeeRows: Object.freeze([]),
  memberRows: Object.freeze([]),
  activityRows: Object.freeze([]),
  meetingRows: Object.freeze([]),
  activeCommitteesAr: ABSENT,
  decisionsCountAr: ABSENT,
  participantsAr: ABSENT,
})

/** إسقاطُ لجان النطاق — **تنسيقٌ فقط**، بلا حسابٍ جديد. */
export function projectCommitteesSnapshot(input: {
  readonly unitLabelAr: string
  readonly scopePath: string
  readonly committees: readonly Committee[]
}): CommitteeSnapshot {
  return {
    ...EMPTY_COMMITTEE_SNAPSHOT,
    unitLabelAr: input.unitLabelAr,
    scopePath: input.scopePath,
    committeeRows: input.committees.map((c) => ({
      id: c.id,
      name: c.labelAr,
      head: c.headNameAr,
    })),
    activeCommitteesAr: formatNumber(input.committees.length),
  }
}

/** إسقاطُ «لجنتي» — الأعضاءُ أسماءٌ حرّةٌ والأنشطةُ بتاريخها الهجريّ (ق-١١٧). */
export function projectMyCommitteeSnapshot(input: {
  readonly committee: Committee
  readonly members: readonly CommitteeMember[]
  readonly activities: readonly CommitteeActivity[]
}): CommitteeSnapshot {
  return {
    ...EMPTY_COMMITTEE_SNAPSHOT,
    unitLabelAr: input.committee.labelAr,
    scopePath: input.committee.path,
    memberRows: input.members.map((m) => ({ id: m.id, name: m.nameAr })),
    activityRows: input.activities.map((a) => ({
      id: a.id,
      title: a.titleAr,
      participants: formatNumber(a.participantCount),
      completedAt: formatHijri(a.completedAt),
    })),
    participantsAr: formatNumber(
      input.activities.reduce((sum, a) => sum + a.participantCount, 0),
    ),
  }
}

/** إسقاطُ المحاضر — القراراتُ عددُها بطاقةٌ ونصُّها سطر. */
export function projectMeetingsSnapshot(input: {
  readonly unitLabelAr: string
  readonly scopePath: string
  readonly meetings: readonly Meeting[]
}): CommitteeSnapshot {
  return {
    ...EMPTY_COMMITTEE_SNAPSHOT,
    unitLabelAr: input.unitLabelAr,
    scopePath: input.scopePath,
    meetingRows: input.meetings.map((m) => ({
      id: m.id,
      heldAt: formatHijri(m.heldAt),
      decisions: formatNumber(m.decisionsAr.length),
    })),
    decisionsCountAr: formatNumber(
      input.meetings.reduce((sum, m) => sum + m.decisionsAr.length, 0),
    ),
  }
}

/** فراغُ المطّلع مُشخِّصٌ دائماً (ق-١١٢)، وبطابع المحراب (قب-٢٥ — من المكوّن نفسِه). */
function viewerEmpty(): UiNode {
  return emptyState({
    audience: "viewer",
    titleKey: "state.deniedTitle",
    diagnosisKey: "state.deniedHint",
  })
}

function shell(
  caps: Caps,
  snapshot: CommitteeSnapshot,
  surface: "family" | "myCommittee",
  content: readonly UiNode[],
): UiNode {
  return appShell({
    nav: navProjection({ caps, priority: null, currentSurface: surface }),
    scopePath: snapshot.scopePath,
    scopeLabelAr: snapshot.unitLabelAr,
    // البحثُ لمن يملك عرضَ الشبكة على نطاقه وحده — وليس من قدرات هذه الشاشة.
    showSearch: false,
    content,
  })
}

// ── شاشةُ لجان المسجد ───────────────────────────────────────────────────────
export const COMMITTEES_CONTRACT: ScreenContract = Object.freeze({
  route: "/family/committees",
  surface: "family",
  lenses: ["admin", "section_head", "rabita", "square", "amir"] as const,
  // موطنُ «اللجنة» (IA §١ ك-٢٣) — لا موطنَ ثانٍ لها.
  canonicalHome: ["committee"] as const,
  capabilities: ["committees.view", "committees.manage"] as const,
  dataSource: "committees.list",
  emptyStates: { owner: "committees.emptyOwner", viewer: "committees.emptyViewer" } as const,
})

export function committeesScreenNodes(caps: Caps, snapshot: CommitteeSnapshot): UiNode {
  if (!caps.has("committees.view")) return viewerEmpty()

  const blocks: UiNode[] = [
    statCard({
      sentenceKey: "committees.activeCount",
      valueAr: snapshot.activeCommitteesAr,
      scopeNoteKey: "committees.scopeNote",
      action: button({
        labelKey: "committees.heading",
        variant: "ghost",
        capability: "committees.view",
      }),
      tone: "brand",
    }),
    dataTable({
      columns: [
        { key: "name", labelKey: "committees.nameLabel" },
        { key: "head", labelKey: "committees.headLabel" },
      ],
      rows: snapshot.committeeRows,
      state: snapshot.committeeRows.length === 0 ? "empty" : "data",
      capability: "committees.view",
      emptyState: caps.has("committees.manage")
        ? emptyState({
            audience: "owner",
            titleKey: "committees.heading",
            actionKey: "committees.emptyOwner",
            capability: "committees.manage",
          })
        : emptyState({
            audience: "viewer",
            titleKey: "committees.heading",
            diagnosisKey: "committees.emptyViewer",
          }),
    }),
  ]

  // ع-١٧: الأميرُ يشكّل اللجنة **ويسمّي مسؤولها اسماً حرّاً** (ق-٣١) — والحسابُ يُمكَّن
  // من بابه في الإدارة (`users.provision`)، فلا تُعاد آلةُ التوفير هنا.
  if (caps.has("committees.manage")) {
    blocks.push(
      form({
        schema: "committeeFormInput",
        fields: [
          field({ name: "labelAr", labelKey: "committees.nameLabel", kind: "text", required: true }),
          field({
            name: "headNameAr",
            labelKey: "committees.headLabel",
            kind: "text",
            required: true,
            messageKey: "committees.headHint",
          }),
        ],
        submit: button({
          labelKey: "committees.formAction",
          variant: "primary",
          capability: "committees.manage",
        }),
      }),
    )
  }

  return shell(caps, snapshot, "family", blocks)
}

// ── شاشةُ «لجنتي» ───────────────────────────────────────────────────────────
export const MY_COMMITTEE_CONTRACT: ScreenContract = Object.freeze({
  route: "/my-committee",
  surface: "myCommittee",
  lenses: ["committee_head"] as const,
  // عرضٌ منسوبٌ بالملكية: موطنُ اللجنة القانونيّ شاشةُ `/family/committees` (IA §١ ك-٢٣).
  canonicalHome: [] as const,
  capabilities: ["committee.own"] as const,
  dataSource: "committee.own.view",
  emptyStates: { owner: "myCommittee.emptyOwner", viewer: "myCommittee.emptyViewer" } as const,
})

export function myCommitteeScreenNodes(caps: Caps, snapshot: CommitteeSnapshot): UiNode {
  if (!caps.has("committee.own")) return viewerEmpty()

  const blocks: UiNode[] = [
    // «كم أضافت لجنتي؟» — سؤالُ صباحه الثالث (§٢.٧)، ونطاقُه منطوقٌ على الصفحة (ق-١١٠).
    statCard({
      sentenceKey: "myCommittee.membersHeading",
      valueAr: snapshot.participantsAr,
      scopeNoteKey: "myCommittee.scopeNote",
      action: button({
        labelKey: "myCommittee.activitiesHeading",
        variant: "ghost",
        capability: "committee.own",
      }),
      tone: "brand",
    }),
    dataTable({
      columns: [
        { key: "title", labelKey: "myCommittee.activityTitleLabel" },
        { key: "participants", labelKey: "myCommittee.participantCountLabel" },
        { key: "completedAt", labelKey: "myCommittee.completedAtLabel" },
      ],
      rows: snapshot.activityRows,
      state: snapshot.activityRows.length === 0 ? "empty" : "data",
      capability: "committee.own",
      emptyState: emptyState({
        audience: "owner",
        titleKey: "myCommittee.activitiesHeading",
        actionKey: "myCommittee.emptyOwner",
        capability: "committee.own",
      }),
    }),
    dataTable({
      columns: [{ key: "name", labelKey: "myCommittee.memberNameLabel" }],
      rows: snapshot.memberRows,
      state: snapshot.memberRows.length === 0 ? "empty" : "data",
      capability: "committee.own",
      emptyState: emptyState({
        audience: "owner",
        titleKey: "myCommittee.membersHeading",
        actionKey: "myCommittee.emptyMembers",
        capability: "committee.own",
      }),
    }),
    // ق-٣١: العضوُ **اسمٌ نصّيٌّ حرّ** — لا منتقي أشخاصٍ ولا بحثٌ في مستخدمي النظام.
    form({
      schema: "committeeMemberInput",
      fields: [
        field({ name: "nameAr", labelKey: "myCommittee.memberNameLabel", kind: "text", required: true }),
      ],
      submit: button({
        labelKey: "myCommittee.addMemberAction",
        variant: "primary",
        capability: "committee.own",
      }),
    }),
    // ب-٤٣/ع-١٨: العددُ والأسماءُ وتاريخُ الإنجاز — ثلاثتُها في نموذجٍ واحد.
    form({
      schema: "committeeActivityInput",
      fields: [
        field({ name: "titleAr", labelKey: "myCommittee.activityTitleLabel", kind: "text", required: true }),
        field({
          name: "participantCount",
          labelKey: "myCommittee.participantCountLabel",
          kind: "number",
          required: true,
        }),
        field({
          name: "completedAt",
          labelKey: "myCommittee.completedAtLabel",
          kind: "date",
          required: true,
          // ق-١٣ منطوقةٌ على الشاشة: النقاطُ لا تُحتسب قبل إقرار الأمير — فلا يُفاجأ المسؤول.
          messageKey: "myCommittee.countedNote",
        }),
      ],
      submit: button({
        labelKey: "myCommittee.recordActivityAction",
        variant: "primary",
        capability: "committee.own",
      }),
    }),
  ]

  return shell(caps, snapshot, "myCommittee", blocks)
}

// ── شاشةُ اجتماعات المسجد ───────────────────────────────────────────────────
export const MEETINGS_CONTRACT: ScreenContract = Object.freeze({
  route: "/family/meetings",
  surface: "family",
  lenses: ["admin", "section_head", "rabita", "square", "amir"] as const,
  // موطنُ «الاجتماع/المحضر» (IA §١ ك-٢٤).
  canonicalHome: ["meeting"] as const,
  capabilities: ["meetings.view", "meetings.manage"] as const,
  dataSource: "meetings.list",
  emptyStates: { owner: "meetings.emptyOwner", viewer: "meetings.emptyViewer" } as const,
})

export function meetingsScreenNodes(caps: Caps, snapshot: CommitteeSnapshot): UiNode {
  if (!caps.has("meetings.view")) return viewerEmpty()

  const blocks: UiNode[] = [
    statCard({
      sentenceKey: "meetings.decisionsCount",
      valueAr: snapshot.decisionsCountAr,
      scopeNoteKey: "meetings.scopeNote",
      action: button({
        labelKey: "meetings.heading",
        variant: "ghost",
        capability: "meetings.view",
      }),
      tone: "brand",
    }),
    dataTable({
      columns: [
        { key: "heldAt", labelKey: "meetings.heldAtLabel" },
        { key: "decisions", labelKey: "meetings.decisionsLabel" },
      ],
      rows: snapshot.meetingRows,
      state: snapshot.meetingRows.length === 0 ? "empty" : "data",
      capability: "meetings.view",
      emptyState: caps.has("meetings.manage")
        ? emptyState({
            audience: "owner",
            titleKey: "meetings.heading",
            actionKey: "meetings.emptyOwner",
            capability: "meetings.manage",
          })
        : emptyState({
            audience: "viewer",
            titleKey: "meetings.heading",
            diagnosisKey: "meetings.emptyViewer",
          }),
    }),
  ]

  // ب-١٨ + **ب-٢ مدفون**: محضرٌ وقراراتٌ فقط — لا حقلَ نصابٍ ولا صوتٍ ولا كشفَ حضور.
  if (caps.has("meetings.manage")) {
    blocks.push(
      form({
        schema: "meetingRecordInput",
        fields: [
          field({ name: "heldAt", labelKey: "meetings.heldAtLabel", kind: "date", required: true }),
          field({ name: "minutesAr", labelKey: "meetings.minutesLabel", kind: "textarea", required: true }),
          field({
            name: "decisionsAr",
            labelKey: "meetings.decisionsLabel",
            kind: "textarea",
            required: true,
          }),
        ],
        submit: button({
          labelKey: "meetings.recordAction",
          variant: "primary",
          capability: "meetings.manage",
        }),
      }),
    )
  }

  return shell(caps, snapshot, "family", blocks)
}

registerScreen({
  contract: COMMITTEES_CONTRACT,
  preview: (caps) => committeesScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT),
})
registerScreen({
  contract: MY_COMMITTEE_CONTRACT,
  preview: (caps) => myCommitteeScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT),
})
registerScreen({
  contract: MEETINGS_CONTRACT,
  preview: (caps) => meetingsScreenNodes(caps, EMPTY_COMMITTEE_SNAPSHOT),
})
