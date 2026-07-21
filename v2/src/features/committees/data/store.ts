/**
 * مستودعُ اللجان — طبقةُ بيانات الوحدة (عقدُ الوحدة §١/§٥).
 *
 * **ما لا يعيش هنا أهمُّ ممّا يعيش**: لا حالةَ اعتمادٍ ولا نقطةَ محسوبة (G22 + ق-١٣) —
 * الاعتمادُ في مستودع المحرّك، والنقاطُ تُشتقّ ولا تُخزَّن. وهذا المستودع يحفظ **اللجانَ
 * وأعضاءَها وأنشطتَها ومحاضرَ الاجتماعات** لا غير.
 *
 * ثلاثةُ ثوابتٍ تعيش هنا فتستحيل مخالفتُها من أيّ مسار:
 *  ١. **الشبكةُ من المستودع لا من المدخل** (قب-١٨): المستودعُ يحمل شبكتَه ويختمها على كل كيان.
 *  ٢. **لا محو**: ليس في هذا السطح دالةُ حذف؛ إيقافُ اللجنة **حالةٌ في البيانات** (المادة ٧/٤).
 *  ٣. **الترتيبُ حتميّ**: كلُّ قائمةٍ تُعاد مرتَّبةً بمعرّفها، فلا يتسرّب ترتيبُ الإدراج نتيجةً.
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا ساعةَ داخلية.
 * ولا SQL ولا مكتبةَ قاعدةٍ هنا (G17): بِنى JS خالصة.
 */

import type { Committee, CommitteeActivity, CommitteeMember, CommitteeUnit, Meeting } from "../types.js"

type Snapshot = {
  readonly unitMap: Map<string, CommitteeUnit>
  readonly committeeMap: Map<string, Committee>
  readonly memberMap: Map<string, CommitteeMember>
  readonly activityMap: Map<string, CommitteeActivity>
  readonly meetingMap: Map<string, Meeting>
  readonly seq: number
}

function byId<T extends { readonly id: string }>(values: Iterable<T>): readonly T[] {
  return Object.freeze([...values].sort((a, b) => a.id.localeCompare(b.id)))
}

export class CommitteeStore {
  private unitMap = new Map<string, CommitteeUnit>()
  private committeeMap = new Map<string, Committee>()
  private memberMap = new Map<string, CommitteeMember>()
  private activityMap = new Map<string, CommitteeActivity>()
  private meetingMap = new Map<string, Meeting>()
  private seq = 0

  constructor(readonly tenantId: string) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  // ── وحداتُ الشجرة (مقروءةٌ فقط من منظور هذه الوحدة) ─────────────────────────
  saveUnit(unit: CommitteeUnit): void {
    this.unitMap.set(unit.id, Object.freeze({ ...unit, tenantId: this.tenantId }))
  }
  getUnit(id: string): CommitteeUnit | null {
    return this.unitMap.get(id) ?? null
  }

  // ── اللجان ──────────────────────────────────────────────────────────────────
  saveCommittee(committee: Committee): void {
    this.committeeMap.set(committee.id, Object.freeze({ ...committee, tenantId: this.tenantId }))
  }
  getCommittee(id: string): Committee | null {
    return this.committeeMap.get(id) ?? null
  }
  committees(): readonly Committee[] {
    return byId(this.committeeMap.values())
  }

  // ── الأعضاء (أسماءٌ حرّة — ق-٣١) ────────────────────────────────────────────
  saveMember(member: CommitteeMember): void {
    this.memberMap.set(member.id, Object.freeze({ ...member, tenantId: this.tenantId }))
  }
  members(): readonly CommitteeMember[] {
    return byId(this.memberMap.values())
  }

  // ── الأنشطة (ب-٤٣) ──────────────────────────────────────────────────────────
  saveActivity(activity: CommitteeActivity): void {
    this.activityMap.set(activity.id, Object.freeze({ ...activity, tenantId: this.tenantId }))
  }
  getActivity(id: string): CommitteeActivity | null {
    return this.activityMap.get(id) ?? null
  }
  activities(): readonly CommitteeActivity[] {
    return byId(this.activityMap.values())
  }

  // ── الاجتماعات (محضرٌ وقرارات — ب-١٨/ب-٢) ──────────────────────────────────
  saveMeeting(meeting: Meeting): void {
    this.meetingMap.set(meeting.id, Object.freeze({ ...meeting, tenantId: this.tenantId }))
  }
  meetings(): readonly Meeting[] {
    return byId(this.meetingMap.values())
  }

  // ── المعاملة الذرّية ────────────────────────────────────────────────────────
  private snapshot(): Snapshot {
    return {
      unitMap: new Map(this.unitMap),
      committeeMap: new Map(this.committeeMap),
      memberMap: new Map(this.memberMap),
      activityMap: new Map(this.activityMap),
      meetingMap: new Map(this.meetingMap),
      seq: this.seq,
    }
  }

  private restore(s: Snapshot): void {
    this.unitMap = s.unitMap
    this.committeeMap = s.committeeMap
    this.memberMap = s.memberMap
    this.activityMap = s.activityMap
    this.meetingMap = s.meetingMap
    this.seq = s.seq
  }

  /** **مقطعٌ حرجٌ متزامن** (لا `await` في داخله بحكم التوقيع) — نظيرُ معاملة الصندوق. */
  transaction<T>(fn: () => T): T {
    const before = this.snapshot()
    try {
      return fn()
    } catch (e) {
      this.restore(before)
      throw e
    }
  }
}
