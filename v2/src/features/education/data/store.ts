/**
 * مستودعُ «على بصيرة» — طبقةُ بيانات الوحدة (عقدُ الوحدة §١/§٥/§١٠).
 *
 * **لماذا في الذاكرة الآن؟** المخطط والهجرات مؤجَّلان في ADR-001 §٦-١؛ هذا المستودع يجسّد
 * **عقود** الوحدة ويُثبت سلوكها، ويُبدَّل لاحقاً بتنفيذٍ على D1 بلا تغيير سطرٍ في الخدمات.
 *
 * أربعةُ ثوابتٍ تعيش **هنا** فتستحيل مخالفتُها من أيّ مسارٍ يبلغ البيانات:
 *  ١. **لا كيانَ حلقةٍ ولا التحاقٍ**: ليس في هذا السطح مِقبضٌ يكتب حلقةً أو طالباً — فلا
 *     سجلَّ ثانيَ يتباعد عن سجلّ `circles` (ع-١٩/ع-٢٩).
 *  ٢. **لا حالةَ اعتمادٍ**: ليس فيه حقلٌ ولا مِقبضٌ لحالة اعتماد — موطنُها مستودعُ المحرّك وحده (G22).
 *  ٢-ب. **ولا جلسةً يومية** (CR-016): موطنُها مستودعُ وحدة السجل اليوميّ — **مستودعان لكيانٍ
 *     واحدٍ هو الازدواجُ بعينه**، ولو تطابقا اليومَ لتباعدا غداً.
 *  ٣. **لا عدّادَ مخزَّن**: كلُّ رقمٍ استعلامٌ لحظةَ السؤال (ق-٩٢).
 *  ٤. **الشبكةُ من المستودع لا من المدخل** (قب-١٨): يحمل شبكتَه ويختمها على كل كيان.
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا ساعةَ داخلية.
 * ولا SQL ولا مكتبةَ قاعدةٍ هنا (G17): بِنى JS خالصة.
 */

import type {
  Curriculum,
  CurriculumBook,
  CurriculumLevel,
  CurriculumSession,
  ProgressCorrection,
} from "../types.js"

export class EducationStore {
  private curriculumMap = new Map<string, Curriculum>()
  private levelMap = new Map<string, CurriculumLevel>()
  private bookMap = new Map<string, CurriculumBook>()
  private sessionMap = new Map<string, CurriculumSession>()
  private correctionList: ProgressCorrection[] = []
  private seq = 0

  constructor(readonly tenantId: string) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  // ── المنهاجُ: بياناتٌ مرجعية (قب-٢٢) ────────────────────────────────────────
  saveCurriculum(c: Curriculum): void {
    this.curriculumMap.set(c.id, Object.freeze({ ...c, tenantId: this.tenantId }))
  }
  getCurriculum(id: string): Curriculum | null {
    return this.curriculumMap.get(id) ?? null
  }
  curricula(): readonly Curriculum[] {
    return Object.freeze([...this.curriculumMap.values()])
  }

  saveLevel(l: CurriculumLevel): void {
    this.levelMap.set(l.id, Object.freeze({ ...l, tenantId: this.tenantId }))
  }
  getLevel(id: string): CurriculumLevel | null {
    return this.levelMap.get(id) ?? null
  }
  levels(): readonly CurriculumLevel[] {
    return Object.freeze([...this.levelMap.values()])
  }

  saveBook(b: CurriculumBook): void {
    this.bookMap.set(b.id, Object.freeze({ ...b, tenantId: this.tenantId }))
  }
  getBook(id: string): CurriculumBook | null {
    return this.bookMap.get(id) ?? null
  }
  books(): readonly CurriculumBook[] {
    return Object.freeze([...this.bookMap.values()])
  }

  saveSession(s: CurriculumSession): void {
    this.sessionMap.set(s.id, Object.freeze({ ...s, tenantId: this.tenantId }))
  }
  getSession(id: string): CurriculumSession | null {
    return this.sessionMap.get(id) ?? null
  }
  sessions(): readonly CurriculumSession[] {
    return Object.freeze([...this.sessionMap.values()])
  }

  // ── الدرسُ **ليس هنا** (CR-016) ──────────────────────────────────────────────
  //
  // كان هذا السطحُ يحمل مقابضَ الدرس وحضورِه وصورِه، فكان **مستودعاً ثانياً لكيانٍ واحد**.
  // وبعد التوحيد: **صفر مِقبضٍ يكتب جلسةً هنا** — الكتابةُ بكاتبها في موطنها، والقراءةُ
  // بمنفذ. وهذا الغيابُ **هو الحارس**: ما لا مقبضَ له لا يُكتب من أيّ مسار.

  // ── بصماتُ التصحيح: **إلحاقٌ لا استبدال** (المادة ٤/٨: سجلٌّ لا يُمحى) ───────
  saveCorrection(c: ProgressCorrection): void {
    this.correctionList.push(Object.freeze({ ...c, tenantId: this.tenantId }))
  }
  corrections(): readonly ProgressCorrection[] {
    return Object.freeze([...this.correctionList])
  }
}
