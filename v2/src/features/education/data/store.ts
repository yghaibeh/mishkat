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
  Lesson,
  LessonAttendance,
  LessonPhoto,
  ProgressCorrection,
} from "../types.js"

export class EducationStore {
  private curriculumMap = new Map<string, Curriculum>()
  private levelMap = new Map<string, CurriculumLevel>()
  private bookMap = new Map<string, CurriculumBook>()
  private sessionMap = new Map<string, CurriculumSession>()
  private lessonMap = new Map<string, Lesson>()
  private attendanceMap = new Map<string, LessonAttendance>()
  private photoMap = new Map<string, LessonPhoto>()
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

  // ── الدرسُ وحضورُه وصورُه ────────────────────────────────────────────────────
  saveLesson(l: Lesson): void {
    this.lessonMap.set(l.id, Object.freeze({ ...l, tenantId: this.tenantId }))
  }
  getLesson(id: string): Lesson | null {
    return this.lessonMap.get(id) ?? null
  }
  lessons(): readonly Lesson[] {
    return Object.freeze([...this.lessonMap.values()])
  }
  /** المفتاحُ الطبيعيّ `(الحلقة، المجلس)` — دالةٌ واحدةٌ لا اجتهادُ مستدعٍ. */
  findLesson(circleId: string, sessionId: string): Lesson | null {
    for (const l of this.lessonMap.values()) {
      if (l.circleId === circleId && l.sessionId === sessionId) return l
    }
    return null
  }

  /** حضورُ الدرس يُستبدَل كتلةً واحدة — فلا يبقى صفٌّ يتيمٌ من تسجيلٍ سابق. */
  saveAttendance(lessonId: string, rows: readonly LessonAttendance[]): void {
    for (const [key, row] of [...this.attendanceMap]) {
      if (row.lessonId === lessonId) this.attendanceMap.delete(key)
    }
    for (const row of rows) {
      this.attendanceMap.set(row.id, Object.freeze({ ...row, tenantId: this.tenantId }))
    }
  }
  attendance(): readonly LessonAttendance[] {
    return Object.freeze([...this.attendanceMap.values()])
  }

  savePhotos(lessonId: string, rows: readonly LessonPhoto[]): void {
    for (const [key, row] of [...this.photoMap]) {
      if (row.lessonId === lessonId) this.photoMap.delete(key)
    }
    for (const row of rows) {
      this.photoMap.set(row.id, Object.freeze({ ...row, tenantId: this.tenantId }))
    }
  }
  photos(): readonly LessonPhoto[] {
    return Object.freeze([...this.photoMap.values()])
  }

  // ── بصماتُ التصحيح: **إلحاقٌ لا استبدال** (المادة ٤/٨: سجلٌّ لا يُمحى) ───────
  saveCorrection(c: ProgressCorrection): void {
    this.correctionList.push(Object.freeze({ ...c, tenantId: this.tenantId }))
  }
  corrections(): readonly ProgressCorrection[] {
    return Object.freeze([...this.correctionList])
  }
}
