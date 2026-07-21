/**
 * دوالُّ خادم وحدة اللجان والاجتماعات — `SPEC_authorization` §٥.٢ + عقدُ الوحدة §٦.
 *
 * أربعةُ ثوابتٍ كما في سائر الوحدات:
 *  ١. **قدرةٌ معلنة** على كل دالة (G7) — لا افتراضيّ ولا غياب.
 *  ٢. **النطاقُ يُشتقّ من الكيان المخزَّن** لا من مدخل العميل، والغائبُ ⇒ `NO_SCOPE` ⇒ رفض.
 *  ٣. **الفاعلُ من الجلسة** لا من المدخل.
 *  ٤. **التدقيقُ جزءٌ من الإعلان** لا خطوةٌ تُنسى.
 *
 * و**«لجنتي» نطاقُها شخصيّ** (`committee.own` صنفُها «ش»): يُشتقّ من **مسؤول اللجنة المخزَّن**
 * (`selfScope`) — فلا يبلغ لجنةَ غيرِه أحدٌ **ولو ملك كلَّ شيءٍ آخر**؛ ولجنةٌ بلا مسؤولٍ ذي
 * حساب (اسمٌ حرّ — ق-٣١) **لا تُفتح لأحد** لأن الملكية شرطُ الباب لا الدور.
 *
 * **وصفر منطقِ اعتمادٍ هنا** (G22): تقديمُ نشاط اللجنة إلى سجل المسجد وإقرارُ الأمير
 * سطحُهما **محرّكُ الاعتماد** (`committee.activity.*`)، ولا نظيرَ لهما في هذه الوحدة.
 */

import { defineServerFn } from "../../../server/defineServerFn.js"
import { NO_SCOPE, selfScope, unitScope, type Scope } from "../../../authorization/scope.js"
import type { CommitteeStore } from "../data/store.js"
import {
  committeesWithin,
  deactivateCommittee,
  formCommittee,
  type FormCommitteeInput,
} from "../services/committees.js"
import { addMember, membersOf, type AddMemberInput } from "../services/members.js"
import { activitiesOf, recordActivity, type RecordActivityInput } from "../services/activities.js"
import { meetingsWithin, recordMeeting, type RecordMeetingInput } from "../services/meetings.js"
import type { CommitteeContext } from "../services/context.js"
import type { SettingsResolver } from "../../../settings/resolver.js"
import type { Actor, DecisionContext } from "../../../authorization/can.js"
import type {
  Committee,
  CommitteeActivity,
  CommitteeMember,
  Meeting,
  Result,
} from "../types.js"

/** نطاقٌ من وحدةٍ مخزَّنةٍ **في مستودع هذه الشبكة**، أو `NO_SCOPE` (قب-١٨ + §٥.٢). */
function unitById(store: CommitteeStore, unitId: string | undefined): Scope {
  const unit = unitId === undefined ? null : store.getUnit(unitId)
  return unit === null ? NO_SCOPE : unitScope(unit.path)
}

/**
 * نطاقُ **الاطّلاع** على لجنةٍ: مسارُها هي — يكفيه الاحتواء، فـ`committees.view` صنفُها «و»
 * (الوحدةُ وما تحتها) فيصل الأميرَ ومَن فوقه هابطاً (ق-١٧) ولا يصل مَن خارج الشجرة.
 */
function committeeScope(store: CommitteeStore, committeeId: string | undefined): Scope {
  const committee = committeeId === undefined ? null : store.getCommittee(committeeId)
  return committee === null ? NO_SCOPE : unitScope(committee.path)
}

/**
 * نطاقُ **إدارة** لجنةٍ: **مسجدُها** لا مسارُها — لأن `committees.manage` صنفُها «ذ»
 * (وحدةُ التكليف بذاتها حصراً)، وصاحبُها أميرُ المسجد المكلَّفُ عند مسار المسجد بعينه.
 * فلو أُخذ مسارُ اللجنة لَما طابق إسنادَ أحدٍ أبداً وصارت القدرةُ ميتةً (ع-٣١: خادمٌ يمنع الكل).
 */
function managedCommitteeScope(store: CommitteeStore, committeeId: string | undefined): Scope {
  const committee = committeeId === undefined ? null : store.getCommittee(committeeId)
  return committee === null ? NO_SCOPE : unitScope(committee.mosquePath)
}

/** نطاقٌ **شخصيّ** من مسؤول اللجنة المخزَّن (ك-٢٣: «لجنتي» قدرةٌ شخصية). */
function ownedCommitteeScope(store: CommitteeStore, committeeId: string | undefined): Scope {
  const committee = committeeId === undefined ? null : store.getCommittee(committeeId)
  if (committee === null || committee.headPersonId === null) return NO_SCOPE
  return selfScope(committee.headPersonId, "committee", committee.id)
}

export function makeCommitteeEndpoints(store: CommitteeStore, settings: SettingsResolver) {
  const contextOf = (actor: Actor, request: DecisionContext): CommitteeContext => ({
    now: request.now,
    actorPersonId: actor.personId,
    settings,
  })

  const formFn = defineServerFn({
    name: "committees.form",
    capability: "committees.manage",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "write",
    audit: "committees.form",
    handler: async (
      input: {
        unitId: string
        committeeId: string
        labelAr: string
        headPersonId: string | null
        headNameAr: string
      },
      { actor, request },
    ): Promise<Result<Committee>> => {
      const form: FormCommitteeInput = {
        id: input.committeeId,
        mosqueUnitId: input.unitId,
        labelAr: input.labelAr,
        headPersonId: input.headPersonId,
        headNameAr: input.headNameAr,
      }
      return formCommittee(store, contextOf(actor, request), form)
    },
  })

  const deactivateFn = defineServerFn({
    name: "committees.deactivate",
    capability: "committees.manage",
    scope: (input: { committeeId: string }) => managedCommitteeScope(store, input.committeeId),
    intent: "write",
    audit: "committees.deactivate",
    handler: async (
      input: { committeeId: string },
      { actor, request },
    ): Promise<Result<Committee>> =>
      deactivateCommittee(store, contextOf(actor, request), { committeeId: input.committeeId }),
  })

  const listFn = defineServerFn({
    name: "committees.list",
    capability: "committees.view",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "committees.list",
    handler: async (input: { unitId: string }): Promise<readonly Committee[]> => {
      const unit = store.getUnit(input.unitId)!
      return committeesWithin(store, unit.path)
    },
  })

  const myCommitteeFn = defineServerFn({
    name: "committee.own.view",
    capability: "committee.own",
    scope: (input: { committeeId: string }) => ownedCommitteeScope(store, input.committeeId),
    intent: "read",
    audit: "committee.own.view",
    handler: async (
      input: { committeeId: string },
    ): Promise<{
      readonly committee: Committee
      readonly members: readonly CommitteeMember[]
      readonly activities: readonly CommitteeActivity[]
    }> => {
      // اللجنةُ المجهولةُ رُدَّت عند الباب (`NO_SCOPE`) — فلا فرعَ ميتٌ لها هنا.
      const committee = store.getCommittee(input.committeeId)!
      return {
        committee,
        members: membersOf(store, committee.id),
        activities: store.activities().filter((a) => a.committeeId === committee.id),
      }
    },
  })

  const addMemberFn = defineServerFn({
    name: "committee.member.add",
    capability: "committee.own",
    scope: (input: { committeeId: string }) => ownedCommitteeScope(store, input.committeeId),
    intent: "write",
    audit: "committee.member.add",
    handler: async (
      input: AddMemberInput,
      { actor, request },
    ): Promise<Result<CommitteeMember>> => addMember(store, contextOf(actor, request), input),
  })

  const recordActivityFn = defineServerFn({
    name: "committee.activity.record",
    capability: "committee.own",
    scope: (input: { committeeId: string }) => ownedCommitteeScope(store, input.committeeId),
    intent: "write",
    audit: "committee.activity.record",
    handler: async (
      input: RecordActivityInput,
      { actor, request },
    ): Promise<Result<CommitteeActivity>> =>
      recordActivity(store, contextOf(actor, request), input),
  })

  const activitiesFn = defineServerFn({
    name: "committee.activities.view",
    capability: "committees.view",
    scope: (input: { committeeId: string }) => committeeScope(store, input.committeeId),
    intent: "read",
    audit: "committee.activities.view",
    handler: async (input: {
      committeeId: string
      periodId: string
    }): Promise<readonly CommitteeActivity[]> =>
      activitiesOf(store, input.committeeId, input.periodId),
  })

  const recordMeetingFn = defineServerFn({
    name: "meetings.record",
    capability: "meetings.manage",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "write",
    audit: "meetings.record",
    handler: async (
      input: { unitId: string; heldAt: Date; minutesAr: string; decisionsAr: readonly string[] },
      { actor, request },
    ): Promise<Result<Meeting>> => {
      const meeting: RecordMeetingInput = {
        mosqueUnitId: input.unitId,
        heldAt: input.heldAt,
        minutesAr: input.minutesAr,
        decisionsAr: input.decisionsAr,
      }
      return recordMeeting(store, contextOf(actor, request), meeting)
    },
  })

  const meetingsFn = defineServerFn({
    name: "meetings.list",
    capability: "meetings.view",
    scope: (input: { unitId: string }) => unitById(store, input.unitId),
    intent: "read",
    audit: "meetings.list",
    handler: async (input: { unitId: string }): Promise<readonly Meeting[]> => {
      const unit = store.getUnit(input.unitId)!
      return meetingsWithin(store, unit.path)
    },
  })

  return {
    form: formFn,
    deactivate: deactivateFn,
    list: listFn,
    myCommittee: myCommitteeFn,
    addMember: addMemberFn,
    recordActivity: recordActivityFn,
    activities: activitiesFn,
    recordMeeting: recordMeetingFn,
    meetings: meetingsFn,
  }
}
