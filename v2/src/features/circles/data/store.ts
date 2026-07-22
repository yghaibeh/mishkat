/**
 * مستودعُ الحلقات — طبقةُ بيانات الوحدة (عقدُ الوحدة §١/§٥/§١٠).
 *
 * **لماذا في الذاكرة الآن؟** المخطط والهجرات مؤجَّلان في ADR-001 §٦-١؛ هذا المستودع يجسّد
 * **عقود** الوحدة ويُثبت سلوكها، ويُبدَّل لاحقاً بتنفيذٍ على D1 بلا تغيير سطرٍ في الخدمات.
 *
 * ثلاثةُ ثوابتٍ تعيش **هنا** فتستحيل مخالفتُها من أيّ مسارٍ يبلغ البيانات:
 *  ١. **سجلٌّ واحدٌ للحلقة وسجلٌّ واحدٌ للعضوية** (ب-٢٨/ق-٨٨ متقاعد): لا جدولَ توأمٍ ولا
 *     مِقبضَ مزامنةٍ — **فلا جسرَ يُبنى لأنّ لا انفصالَ يُخاط**.
 *  ٢. **لا عدّادَ مخزَّن**: ليس في هذا السطح ما يحفظ عدداً — كلُّ رقمٍ استعلامٌ (ع-١٩/ع-٢٩).
 *  ٣. **الشبكةُ من المستودع لا من المدخل** (قب-١٨): يحمل شبكتَه ويختمها على كل كيان.
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا ساعةَ داخلية.
 * ولا SQL ولا مكتبةَ قاعدةٍ هنا (G17): بِنى JS خالصة.
 */

import type { Circle, CircleType, CirclesUnit, Enrollment } from "../types.js"

export class CirclesStore {
  private unitMap = new Map<string, CirclesUnit>()
  private typeMap = new Map<string, CircleType>()
  private circleMap = new Map<string, Circle>()
  private enrollmentMap = new Map<string, Enrollment>()
  private seq = 0

  constructor(readonly tenantId: string) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  // ── إسقاطُ الوحدات (قراءةٌ لاشتقاق النطاق) ──────────────────────────────────
  saveUnit(u: CirclesUnit): void {
    this.unitMap.set(u.id, Object.freeze({ ...u, tenantId: this.tenantId }))
  }
  getUnit(id: string): CirclesUnit | null {
    return this.unitMap.get(id) ?? null
  }

  // ── كتالوجُ الأنواع: **بياناتٌ مرجعية** (قب-٢٢) ─────────────────────────────
  /** إضافةُ نوعٍ **صفٌّ** لا سطرُ كود — ولا حقلَ تفعيلٍ يُكتب لأنه غيرُ موجود (ع-٨). */
  saveType(t: CircleType): void {
    this.typeMap.set(t.id, Object.freeze({ ...t, tenantId: this.tenantId }))
  }
  getType(id: string): CircleType | null {
    return this.typeMap.get(id) ?? null
  }
  types(): readonly CircleType[] {
    return Object.freeze([...this.typeMap.values()])
  }

  // ── الحلقات: **سجلٌّ واحد** ─────────────────────────────────────────────────
  saveCircle(c: Circle): void {
    this.circleMap.set(c.id, Object.freeze({ ...c, tenantId: this.tenantId }))
  }
  getCircle(id: string): Circle | null {
    return this.circleMap.get(id) ?? null
  }
  circles(): readonly Circle[] {
    return Object.freeze([...this.circleMap.values()])
  }

  // ── العضوية: **سجلٌّ واحد** كذلك ────────────────────────────────────────────
  /** الالتحاقُ يُلحق: معرّفٌ مكرَّرٌ رميةٌ برمجية لا كتابةٌ فوق سابقه. */
  appendEnrollment(e: Enrollment): void {
    if (this.enrollmentMap.has(e.id)) {
      throw new Error(`التحاقٌ مكرَّرُ المعرّف: ${e.id} — السجلُّ إلحاقٌ لا استبدال`)
    }
    this.enrollmentMap.set(e.id, Object.freeze({ ...e, tenantId: this.tenantId }))
  }

  /**
   * **الكاتبُ الضيّق الوحيد بعد الإلحاق**: وسمُ الخروج — ولا يمسّ اسماً ولا حلقة.
   * ويعيد المختومَ نفسَه، فلا تحتاج الخدمةُ قراءةً ثانيةً تُنتج فرعاً دفاعياً لا يُبلَغ.
   */
  stampLeft(enrollmentId: string, at: Date): Enrollment {
    const current = this.enrollmentMap.get(enrollmentId)
    if (current === undefined) {
      throw new Error(`وسمُ خروجٍ لالتحاقٍ غير موجود: ${enrollmentId}`)
    }
    const stamped = Object.freeze({ ...current, leftAt: at })
    this.enrollmentMap.set(enrollmentId, stamped)
    return stamped
  }

  getEnrollment(id: string): Enrollment | null {
    return this.enrollmentMap.get(id) ?? null
  }
  enrollments(): readonly Enrollment[] {
    return Object.freeze([...this.enrollmentMap.values()])
  }
}
