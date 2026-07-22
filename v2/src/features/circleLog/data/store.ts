/**
 * مستودعُ السجلّ اليوميّ — طبقةُ بيانات الوحدة (عقدُ الوحدة §٢/§٨/§١٢).
 *
 * **لماذا في الذاكرة الآن؟** المخطط والهجرات مؤجَّلان في ADR-001 §٦-١؛ هذا المستودع يجسّد
 * **عقود** الوحدة ويُثبت سلوكها، ويُبدَّل لاحقاً بتنفيذٍ على D1 بلا تغيير سطرٍ في الخدمات.
 *
 * أربعةُ ثوابتٍ تعيش **هنا** فتستحيل مخالفتُها من أيّ مسارٍ يبلغ البيانات:
 *  ١. **جلسةٌ واحدةٌ لكل (حلقة × يوم)**: المفتاحُ طبيعيٌّ لا معرّفٌ مصطنع — فـ«upsert»
 *     (ق-٩٠) **بنيةٌ لا اتفاق**، ولا يوجد مقبضٌ يُنشئ جلسةً ثانيةً لليوم نفسِه.
 *  ٢. **لا عدّادَ مخزَّن**: ليس في هذا السطح ما يحفظ حضوراً ولا نسبةً — كلُّ رقمٍ استعلام.
 *  ٣. **لا كيانَ حلقةٍ ولا تسجيلٍ**: المستودعُ يحفظ مراجعَ (`circleId`/`enrollmentId`) لا نسخاً.
 *  ٤. **الشبكةُ من المستودع لا من المدخل** (قب-١٨): يحمل شبكتَه ويختمها على كل كيان.
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا ساعةَ داخلية.
 * ولا SQL ولا مكتبةَ قاعدةٍ هنا (G17): بِنى JS خالصة.
 */

import type {
  DaySession,
  GuardianLink,
  MushafRef,
  SupervisionNote,
  SurahRef,
} from "../types.js"

export class CircleLogStore {
  private surahMap = new Map<string, SurahRef>()
  private mushafMap = new Map<string, MushafRef>()
  private sessionMap = new Map<string, DaySession>()
  private noteMap = new Map<string, SupervisionNote>()
  private linkMap = new Map<string, GuardianLink>()
  private seq = 0

  constructor(readonly tenantId: string) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  // ── الكتالوجُ المرجعيّ: **بياناتٌ** لا كود (ق-٨٩/قب-٢٢) ─────────────────────
  saveSurah(s: SurahRef): void {
    this.surahMap.set(s.id, Object.freeze({ ...s, tenantId: this.tenantId }))
  }
  getSurah(id: string): SurahRef | null {
    return this.surahMap.get(id) ?? null
  }
  surahs(): readonly SurahRef[] {
    return Object.freeze([...this.surahMap.values()])
  }

  saveMushaf(m: MushafRef): void {
    this.mushafMap.set(m.id, Object.freeze({ ...m, tenantId: this.tenantId }))
  }
  getMushaf(id: string): MushafRef | null {
    return this.mushafMap.get(id) ?? null
  }

  // ── الجلسات: **مفتاحٌ طبيعيٌّ واحد** (حلقة × يوم) ────────────────────────────
  /** المفتاحُ الطبيعيّ — هو ما يجعل إعادةَ الإرسال آمنةً بالبنية لا بالانضباط. */
  private static key(circleId: string, dayKey: string): string {
    return `${circleId}|${dayKey}`
  }

  /** **الكاتبُ الوحيد للجلسة**: يُنشئ أو يستبدل — ولا مقبضَ ثالث. */
  upsertSession(session: DaySession): DaySession {
    const sealed = Object.freeze({
      ...session,
      tenantId: this.tenantId,
      rows: Object.freeze([...session.rows]),
    })
    this.sessionMap.set(CircleLogStore.key(session.circleId, session.dayKey), sealed)
    return sealed
  }

  getSession(circleId: string, dayKey: string): DaySession | null {
    return this.sessionMap.get(CircleLogStore.key(circleId, dayKey)) ?? null
  }

  sessions(): readonly DaySession[] {
    return Object.freeze([...this.sessionMap.values()])
  }

  // ── ملاحظاتُ الإشراف: **إلحاقٌ لا استبدال** (ق-٨٧) ──────────────────────────
  appendNote(note: SupervisionNote): void {
    if (this.noteMap.has(note.id)) {
      throw new Error(`ملاحظةٌ مكرَّرةُ المعرّف: ${note.id} — السجلُّ إلحاقٌ لا استبدال`)
    }
    this.noteMap.set(note.id, Object.freeze({ ...note, tenantId: this.tenantId }))
  }
  notes(): readonly SupervisionNote[] {
    return Object.freeze([...this.noteMap.values()])
  }

  // ── روابطُ وليّ الأمر ────────────────────────────────────────────────────────
  saveLink(link: GuardianLink): void {
    this.linkMap.set(link.id, Object.freeze({ ...link, tenantId: this.tenantId }))
  }
  getLink(id: string): GuardianLink | null {
    return this.linkMap.get(id) ?? null
  }
  /** حلُّ الرمز **في مستودع شبكته وحدها** (قب-١٨): تطابقُ رمزين بين شبكتين لا يفتح باباً. */
  linkByToken(token: string): GuardianLink | null {
    return [...this.linkMap.values()].find((l) => l.token === token) ?? null
  }
  links(): readonly GuardianLink[] {
    return Object.freeze([...this.linkMap.values()])
  }
}
