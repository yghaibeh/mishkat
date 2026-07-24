/**
 * مستودعُ الإعلام — طبقةُ بياناتِ الوحدة (عقدُ الوحدة §١ و§٧ و§١٠).
 *
 * **لماذا في الذاكرة الآن؟** المخطط والهجرات مؤجَّلان (ADR-001 §٦-١)، وهذا المستودع يجسّد
 * **عقود** الوحدة ويُثبت سلوكها، ويُبدَّل لاحقاً بتنفيذٍ على D1 دون تغيير سطرٍ في الخدمات
 * (طبقةُ العزل — ADR-001 §٥، وهي عينُ ما أتاح العملَ المتوازي في قب-٣١).
 *
 * أربعةُ ثوابتٍ تعيش **هنا** فتستحيل مخالفتُها من أيّ مسار:
 *  ١. **الشبكةُ من المستودع لا من المدخل** (قب-١٨): يحمل شبكتَه ويختمها على كل كيان.
 *  ٢. **لا محو**: ليس في هذا السطح دالةُ حذف؛ الحذفُ **حالةٌ في البيانات** (المادة ٧/٤).
 *  ٣. **مفتاحُ التخزين من هنا**: يُشتقّ من عدّاد المستودع فلا يأتي من المدخل ولا يُخمَّن
 *     (المادة ٨/٤) — والوحدةُ لا تعرف مزوّداً.
 *  ٤. **الكياناتُ مجمَّدة**: تُستبدَل ولا تُعدَّل في مكانها.
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا ساعةَ داخلية.
 * ولا SQL ولا مكتبةَ قاعدةٍ هنا (G17): بِنى JS خالصة.
 */

import type { MediaCoverage, MediaFormat, MediaKind, MediaPhoto, MediaUnit } from "../types.js"

type Snapshot = {
  readonly coverageMap: Map<string, MediaCoverage>
  readonly photoList: MediaPhoto[]
  readonly seq: number
}

export class MediaStore {
  private unitMap = new Map<string, MediaUnit>()
  private kindMap = new Map<string, MediaKind>()
  private formatMap = new Map<string, MediaFormat>()
  private coverageMap = new Map<string, MediaCoverage>()
  private photoList: MediaPhoto[] = []
  private seq = 0

  constructor(readonly tenantId: string) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  // ── المراجعُ (إسقاطُ الوحدات والمعجمان) ────────────────────────────────────
  saveUnit(u: MediaUnit): void {
    this.unitMap.set(u.id, Object.freeze({ ...u, tenantId: this.tenantId }))
  }
  getUnit(id: string): MediaUnit | null {
    return this.unitMap.get(id) ?? null
  }
  /** كلُّ الوحدات — **لطبقةِ الاستمرار تُسقطها**؛ الخدماتُ تسأل بالمعرّف (`getUnit`). */
  units(): readonly MediaUnit[] {
    return Object.freeze([...this.unitMap.values()])
  }

  saveKind(k: MediaKind): void {
    this.kindMap.set(k.id, Object.freeze({ ...k, tenantId: this.tenantId }))
  }
  getKind(id: string): MediaKind | null {
    return this.kindMap.get(id) ?? null
  }
  /** كلُّ الأنواع — **لطبقةِ الاستمرار تُسقطها** (المعجمُ بياناتٌ مرجعيةٌ تُخزَّن). */
  kinds(): readonly MediaKind[] {
    return Object.freeze([...this.kindMap.values()])
  }

  saveFormat(f: MediaFormat): void {
    this.formatMap.set(f.id, Object.freeze({ ...f, tenantId: this.tenantId }))
  }
  /** الصيغةُ تُطلب **بنوع المحتوى** لأنه ما يصل من الحدّ لا معرّفُ المرجع. */
  formatByContentType(contentType: string): MediaFormat | null {
    for (const f of this.formatMap.values()) if (f.contentType === contentType) return f
    return null
  }
  formats(): readonly MediaFormat[] {
    return Object.freeze([...this.formatMap.values()])
  }

  // ── التغطياتُ وألبوماتُها ──────────────────────────────────────────────────
  saveCoverage(c: MediaCoverage): void {
    this.coverageMap.set(c.id, Object.freeze({ ...c, tenantId: this.tenantId }))
  }
  getCoverage(id: string): MediaCoverage | null {
    return this.coverageMap.get(id) ?? null
  }
  coverages(): readonly MediaCoverage[] {
    return Object.freeze([...this.coverageMap.values()])
  }

  savePhoto(p: MediaPhoto): void {
    this.photoList.push(Object.freeze({ ...p, tenantId: this.tenantId }))
  }
  photosOf(coverageId: string): readonly MediaPhoto[] {
    return Object.freeze(this.photoList.filter((p) => p.coverageId === coverageId))
  }
  /** كلُّ الصور بترتيب إضافتها — **لطبقةِ الاستمرار تُسقطها**؛ الخدماتُ تسأل بألبومها. */
  photos(): readonly MediaPhoto[] {
    return Object.freeze([...this.photoList])
  }

  // ── المعاملة الذرّية ───────────────────────────────────────────────────────
  private snapshot(): Snapshot {
    return { coverageMap: new Map(this.coverageMap), photoList: [...this.photoList], seq: this.seq }
  }

  private restore(s: Snapshot): void {
    this.coverageMap = s.coverageMap
    this.photoList = s.photoList
    this.seq = s.seq
  }

  /** **مقطعٌ حرجٌ متزامن** (لا `await` في داخله بحكم التوقيع) — الفشلُ يُرجع العدّادَ معه. */
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
