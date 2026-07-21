/**
 * مستودعُ الاعتماد — طبقةُ بيانات الوحدة (عقدُ الوحدة §٢/§٨).
 *
 * **هنا وحدَه تعيش حالةُ الاعتماد في مِشكاة كلِّها** (G22): طلبٌ بحالته وحمولته وبصمات
 * قراراته، وإشعاراتٌ تتبع التوجيه، وقيودُ تدقيقٍ لا تُمحى (المادة ٤/٨).
 *
 * ثلاثةُ ثوابتٍ تعيش هنا فتستحيل مخالفتُها من أي مسار:
 *  ١. **الشبكةُ من المستودع لا من المدخل** (قب-١٨): يختمها على كلِّ كيانٍ يحفظه.
 *  ٢. **لا محو**: ليس في هذا السطح دالةُ حذف — الرفضُ حالةٌ والتصحيحُ بصمةٌ (المادة ٧/٤).
 *  ٣. **مفتاحٌ طبيعيّ**: `(النوع، الوحدة، الفترة)` يُقرأ بدالةٍ واحدة، فلا يبحث كلُّ مستدعٍ باجتهاده.
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا ساعةَ داخلية.
 * ولا SQL ولا مكتبةَ قاعدةٍ هنا (G17): بِنى JS خالصة.
 */

import type { ApprovalNotice, ApprovalRequest } from "../types.js"

export type ApprovalAuditRecord = {
  readonly tenantId: string
  readonly at: Date
  readonly actorPersonId: string
  readonly action: string
  readonly targetId: string
  readonly scopePath: string
  readonly reason: string | null
}

type Snapshot = {
  readonly requestMap: Map<string, ApprovalRequest>
  readonly noticeList: ApprovalNotice[]
  readonly auditList: ApprovalAuditRecord[]
  readonly seq: number
}

export class ApprovalStore {
  private requestMap = new Map<string, ApprovalRequest>()
  private noticeList: ApprovalNotice[] = []
  private auditList: ApprovalAuditRecord[] = []
  private seq = 0

  constructor(readonly tenantId: string) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  saveRequest(request: ApprovalRequest): void {
    this.requestMap.set(request.id, Object.freeze({ ...request, tenantId: this.tenantId }))
  }

  getRequest(id: string): ApprovalRequest | null {
    return this.requestMap.get(id) ?? null
  }

  requests(): readonly ApprovalRequest[] {
    return Object.freeze([...this.requestMap.values()])
  }

  /** المفتاحُ الطبيعيّ (ق-٦٧): نوعٌ ووحدةٌ وفترة — دالةٌ واحدةٌ لا اجتهادُ مستدعٍ. */
  findByKey(typeId: string, unitPath: string, periodId: string): ApprovalRequest | null {
    for (const r of this.requestMap.values()) {
      if (r.typeId === typeId && r.unitPath === unitPath && r.period.id === periodId) return r
    }
    return null
  }

  appendNotice(notice: Omit<ApprovalNotice, "tenantId">): void {
    this.noticeList.push(Object.freeze({ ...notice, tenantId: this.tenantId }))
  }

  notices(): readonly ApprovalNotice[] {
    return Object.freeze([...this.noticeList])
  }

  appendAudit(entry: Omit<ApprovalAuditRecord, "tenantId">): void {
    this.auditList.push(Object.freeze({ ...entry, tenantId: this.tenantId }))
  }

  audit(): readonly ApprovalAuditRecord[] {
    return Object.freeze([...this.auditList])
  }

  private snapshot(): Snapshot {
    return {
      requestMap: new Map(this.requestMap),
      noticeList: [...this.noticeList],
      auditList: [...this.auditList],
      seq: this.seq,
    }
  }

  private restore(s: Snapshot): void {
    this.requestMap = s.requestMap
    this.noticeList = s.noticeList
    this.auditList = s.auditList
    this.seq = s.seq
  }

  /** دفعةٌ ذرّية: عطبٌ جزئيٌّ يُرجع الحالةَ والإشعارَ والتدقيقَ معاً (ع-٣٣). */
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
