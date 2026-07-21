/**
 * المستودع المرجعيّ في الذاكرة — طبقة بيانات الوحدة (SPEC_org_and_accounts §٦).
 *
 * **لماذا في الذاكرة الآن؟** المخطط والهجرات مؤجَّلان في ADR-001 §٦-١ (نقطة اللاعودة:
 * مفتاح التوجيه وموضع التدقيق قبل أول هجرة). هذا المستودع يجسّد **عقود** الوحدة ويُثبت
 * سلوكها، ويُبدَّل لاحقاً بتنفيذٍ على D1 دون تغيير سطرٍ في الخدمات (عزلُ ADR-001 §٥).
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة؛ ولا تاريخَ زمن-تشغيل
 * (الساعة تُحقن في الخدمات). و**ذرّي**: `transaction` يلتقط لقطةً ويُرجعها عند أي رمية (ع-٣٣).
 *
 * لا SQL ولا مكتبة قاعدة هنا (G17): بِنى JS خالصة — يقفل تسرُّب لهجة القاعدة إلى الخدمات.
 */

import type {
  Account,
  OrgUnit,
  RegistrationRequest,
  StoredAssignment,
} from "../types.js"

/** الشبكةُ المبذورة الوحيدة اليوم (§١.٠، قب-١٨) — يختمها المستودعُ افتراضاً. */
export const DEFAULT_TENANT_ID = "t-main"

export type AuditRecord = {
  readonly tenantId: string
  readonly at: Date
  readonly actorPersonId: string
  readonly action: string
  readonly capability: string
  readonly scopePath: string
  readonly targetType: string
  readonly targetId: string
  readonly reason: string | null
}

type Snapshot = {
  readonly units: Map<string, OrgUnit>
  readonly accounts: Map<string, Account>
  readonly assignments: StoredAssignment[]
  readonly requests: Map<string, RegistrationRequest>
  readonly audit: AuditRecord[]
  readonly seq: number
}

/** بناء المسار دالةٌ لا سلسلةٌ حرة — تفعيلٌ لدرس ت-٢. */
export function childPath(parentPath: string, id: string): string {
  return `${parentPath}${id}/`
}

export class OrgStore {
  units = new Map<string, OrgUnit>()
  accounts = new Map<string, Account>()
  assignments: StoredAssignment[] = []
  requests = new Map<string, RegistrationRequest>()
  audit: AuditRecord[] = []
  private seq = 0

  /**
   * المستودعُ مقسَّمٌ بالشبكة (§١.٠): يحمل شبكتَه ويختمها على كلِّ كيانٍ يحفظه — فـ`tenantId`
   * **يُشتقّ من سياق المستودع لا من مدخل العميل**، ولا يُبلَغ كيانُ شبكةٍ من مستودع أخرى.
   */
  constructor(readonly tenantId: string = DEFAULT_TENANT_ID) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  getUnit(id: string): OrgUnit | null {
    return this.units.get(id) ?? null
  }

  saveUnit(u: OrgUnit): void {
    // ختمُ الشبكة عند الحفظ — درءٌ لأيّ `tenantId` وافدٍ مع كيانٍ من غير سياق المستودع.
    this.units.set(u.id, { ...u, tenantId: this.tenantId })
  }

  /** كل نسل الوحدة (بادئة المسار) — للتحريك والأرشفة الذرّية. */
  subtreeOf(path: string): OrgUnit[] {
    const out: OrgUnit[] = []
    for (const u of this.units.values()) if (u.path.startsWith(path)) out.push(u)
    return out
  }

  getAccount(personId: string): Account | null {
    return this.accounts.get(personId) ?? null
  }

  hasUsername(username: string): boolean {
    for (const a of this.accounts.values()) if (a.username === username) return true
    return false
  }

  saveAccount(a: Account): void {
    this.accounts.set(a.personId, { ...a, tenantId: this.tenantId })
  }

  addAssignment(a: StoredAssignment): void {
    this.assignments.push({ ...a, tenantId: this.tenantId })
  }

  assignmentsForPerson(personId: string): StoredAssignment[] {
    return this.assignments.filter((a) => a.personId === personId)
  }

  saveRequest(r: RegistrationRequest): void {
    this.requests.set(r.id, { ...r, tenantId: this.tenantId })
  }

  getRequest(id: string): RegistrationRequest | null {
    return this.requests.get(id) ?? null
  }

  /** قيدُ التدقيق يُختم بالشبكة كسائر الكيانات — المُنشئُ لا يزوّد `tenantId` (اشتقاقٌ لا مدخل). */
  appendAudit(entry: Omit<AuditRecord, "tenantId">): void {
    this.audit.push({ ...entry, tenantId: this.tenantId })
  }

  private snapshot(): Snapshot {
    return {
      units: new Map(structuredClone([...this.units])),
      accounts: new Map(structuredClone([...this.accounts])),
      assignments: structuredClone(this.assignments),
      requests: new Map(structuredClone([...this.requests])),
      audit: structuredClone(this.audit),
      seq: this.seq,
    }
  }

  private restore(s: Snapshot): void {
    this.units = s.units
    this.accounts = s.accounts
    this.assignments = s.assignments
    this.requests = s.requests
    this.audit = s.audit
    this.seq = s.seq
  }

  /** دفعةٌ ذرّية: عطبٌ جزئيّ يُرجع كل شيء (ع-٣٣، ق-١٥). */
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
