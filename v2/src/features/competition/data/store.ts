/**
 * مستودعُ المسابقة — طبقةُ بيانات الوحدة (عقدُ الوحدة §١ و§٦ و§٧).
 *
 * **لماذا في الذاكرة الآن؟** المخطط والهجرات مؤجَّلان في ADR-001 §٦-١؛ هذا المستودع يجسّد
 * **عقود** الوحدة ويُثبت سلوكها، ويُبدَّل لاحقاً بتنفيذٍ على D1 بلا تغيير سطرٍ في الخدمات.
 *
 * ثلاثةُ ثوابتٍ تعيش **هنا** فتستحيل مخالفتُها من أيّ مسارٍ يبلغ البيانات:
 *  ١. **صفرُ عدّادٍ مخزَّن** (ق-٩٢): ليس في هذا السطح ما يحفظ نقطةً ولا رتبةً ولا عدداً —
 *     كلُّ رقمٍ استعلامٌ على الأحداث المخزَّنة (ق-٤١).
 *  ٢. **المفتاحُ الطبيعيُّ للحدث فريدٌ بنيوياً**: خريطةٌ مفتاحُها المفتاحُ الطبيعيّ ⇒
 *     **الازدواجُ مستحيلٌ بغياب الموضع لا بالامتناع عن كتابته** (ق-٤٥/ق-٤٦).
 *  ٣. **الشبكةُ من المستودع لا من المدخل** (قب-١٨): يحمل شبكتَه ويختمها على كل كيان.
 *
 * **حتميّ** (TESTING_POLICY §٥): معرّفاتٌ بعدّادٍ متتابع لا عشوائيّة، ولا ساعةَ داخلية.
 * ولا SQL ولا مكتبةَ قاعدةٍ هنا (G17): بِنى JS خالصة.
 */

import type {
  Award,
  Category,
  Competition,
  CompetitionUnit,
  Contestant,
  Enrollment,
  Invite,
  ScoreEvent,
  ScoringEventType,
  Stage,
} from "../types.js"
import type { ResultAnnouncement } from "../services/results.js"

/** المفتاحُ الطبيعيّ (العقدُ الأمّ §٢-٤-٢ ثابت ١) — **موضعٌ واحدٌ لتركيبه** فلا صيغتان. */
export function naturalKey(
  contestantId: string,
  typeKey: string,
  periodKey: string,
  sourceRef: string | null,
): string {
  return [contestantId, typeKey, periodKey, sourceRef ?? ""].join("|")
}

export class CompetitionStore {
  private unitMap = new Map<string, CompetitionUnit>()
  private competitionMap = new Map<string, Competition>()
  private categoryMap = new Map<string, Category>()
  private stageMap = new Map<string, Stage>()
  private scoringTypeMap = new Map<string, ScoringEventType>()
  private contestantMap = new Map<string, Contestant>()
  private enrollmentMap = new Map<string, Enrollment>()
  private inviteMap = new Map<string, Invite>()
  /** **مفتاحُها المفتاحُ الطبيعيّ** — فالازدواجُ لا موضعَ له أصلاً. */
  private scoreEventMap = new Map<string, ScoreEvent>()
  private awardMap = new Map<string, Award>()
  /** المقتطفاتُ المختومة — **تُكتب مرّةً ولا تُمسّ** (قب-٤٥). */
  private announcementMap = new Map<string, ResultAnnouncement>()
  private seq = 0

  constructor(readonly tenantId: string) {}

  /** معرّفٌ متتابعٌ حتميّ — لا عشوائيّة (TESTING_POLICY §٥). */
  nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  // ── إسقاطُ الوحدات (قراءةٌ لاشتقاق النطاق) ──────────────────────────────────
  saveUnit(u: CompetitionUnit): void {
    this.unitMap.set(u.id, Object.freeze({ ...u, tenantId: this.tenantId }))
  }
  getUnit(id: string): CompetitionUnit | null {
    return this.unitMap.get(id) ?? null
  }
  /**
   * **بحثٌ مفهرَسٌ بالمسار لا مسحُ قائمة** — يخدم المسارَ العامَّ الذي يحرّم عليه قب-١٣
   * **استعلامَ القوائم**: فهذا سؤالٌ عن عقدةٍ بعينها لا استعراضٌ للشجرة، ولا شيءَ منه يخرج.
   */
  getUnitByPath(path: string): CompetitionUnit | null {
    for (const unit of this.unitMap.values()) {
      if (unit.path === path) return unit
    }
    return null
  }

  // ── المسابقة ────────────────────────────────────────────────────────────────
  saveCompetition(c: Competition): void {
    this.competitionMap.set(c.id, Object.freeze({ ...c, tenantId: this.tenantId }))
  }
  getCompetition(id: string): Competition | null {
    return this.competitionMap.get(id) ?? null
  }
  competitions(): readonly Competition[] {
    return Object.freeze([...this.competitionMap.values()])
  }

  // ── الفئاتُ والمراحل ────────────────────────────────────────────────────────
  saveCategory(c: Category): void {
    this.categoryMap.set(c.id, Object.freeze({ ...c, tenantId: this.tenantId }))
  }
  categories(): readonly Category[] {
    return Object.freeze([...this.categoryMap.values()])
  }
  /** فئاتُ **مسابقةٍ بعينها** — قراءةٌ مقيَّدةٌ بكيان الطلب، لا قائمةٌ شبكية (قب-١٣). */
  categoriesOfCompetition(competitionId: string): readonly Category[] {
    const found: Category[] = []
    for (const c of this.categoryMap.values()) {
      if (c.competitionId === competitionId) found.push(c)
    }
    return found
  }

  saveStage(s: Stage): void {
    this.stageMap.set(s.id, Object.freeze({ ...s, tenantId: this.tenantId }))
  }
  getStage(id: string): Stage | null {
    return this.stageMap.get(id) ?? null
  }

  // ── كتالوجُ التنقيط: **نسخٌ مؤرَّخة**، لا صفٌّ يُكتب فوقه ────────────────────
  saveScoringType(t: ScoringEventType): void {
    this.scoringTypeMap.set(t.id, Object.freeze({ ...t, tenantId: this.tenantId }))
  }
  getScoringType(id: string): ScoringEventType | null {
    return this.scoringTypeMap.get(id) ?? null
  }
  scoringTypes(): readonly ScoringEventType[] {
    return Object.freeze([...this.scoringTypeMap.values()])
  }

  // ── المتبارون ───────────────────────────────────────────────────────────────
  saveContestant(c: Contestant): void {
    this.contestantMap.set(c.id, Object.freeze({ ...c, tenantId: this.tenantId }))
  }
  getContestant(id: string): Contestant | null {
    return this.contestantMap.get(id) ?? null
  }
  contestants(): readonly Contestant[] {
    return Object.freeze([...this.contestantMap.values()])
  }

  // ── الالتحاقات ──────────────────────────────────────────────────────────────
  saveEnrollment(e: Enrollment): void {
    this.enrollmentMap.set(e.id, Object.freeze({ ...e, tenantId: this.tenantId }))
  }
  getEnrollment(id: string): Enrollment | null {
    return this.enrollmentMap.get(id) ?? null
  }
  enrollments(): readonly Enrollment[] {
    return Object.freeze([...this.enrollmentMap.values()])
  }

  /**
   * **فهرسُ منع التكرار** (العقدُ الأمّ §٤-٢): يبحث في خريطته مباشرةً ولا يمرّ بالقائمة —
   * فهو **عدٌّ مفهرَسٌ لا استعلامُ قائمة**، وهذا ما يجعله مشروعاً للمسار العامّ (§٤-٢).
   * والمرفوضُ **خارج الفهرس**: مَن رُفض يعيد التقديمَ ولا يُقفل عليه الباب.
   */
  activeEnrollmentFor(competitionId: string, personRef: string): Enrollment | null {
    for (const e of this.enrollmentMap.values()) {
      if (e.competitionId !== competitionId) continue
      if (e.personRef !== personRef) continue
      if (e.state === "rejected" || e.state === "expired") continue
      return e
    }
    return null
  }

  /** عدُّ الطلبات المعلّقة لهاتفٍ بعينه — **ضابطُ ق-٣٢**، عدٌّ لا قائمةٌ تخرج. */
  pendingCountForPhone(phone: string): number {
    let found = 0
    for (const e of this.enrollmentMap.values()) {
      if (e.phone === phone && e.state === "requested") found += 1
    }
    return found
  }

  // ── الدعوات ─────────────────────────────────────────────────────────────────
  saveInvite(i: Invite): void {
    this.inviteMap.set(i.id, Object.freeze({ ...i, tenantId: this.tenantId }))
  }
  getInvite(id: string): Invite | null {
    return this.inviteMap.get(id) ?? null
  }
  invites(): readonly Invite[] {
    return Object.freeze([...this.inviteMap.values()])
  }

  // ── أحداثُ التنقيط: **upsert على المفتاح الطبيعيّ** ──────────────────────────
  /**
   * الإدخالُ **استبدالٌ على المفتاح الطبيعيّ لا إلحاق**: فالرصدُ الثاني بالمفتاح نفسِه
   * **تصحيحٌ** (العقدُ الأمّ §٢-٤-٢)، والمزامنةُ المكرَّرة **لا تضاعف** (ق-٤٥).
   */
  upsertScoreEvent(e: ScoreEvent): ScoreEvent {
    const key = naturalKey(e.contestantId, e.typeKey, e.periodKey, e.sourceRef)
    const existing = this.scoreEventMap.get(key)
    const stored = Object.freeze({
      ...e,
      tenantId: this.tenantId,
      id: existing?.id ?? e.id,
    })
    this.scoreEventMap.set(key, stored)
    return stored
  }
  scoreEvents(): readonly ScoreEvent[] {
    return Object.freeze([...this.scoreEventMap.values()])
  }

  // ── الجوائز ─────────────────────────────────────────────────────────────────
  saveAward(a: Award): void {
    this.awardMap.set(a.id, Object.freeze({ ...a, tenantId: this.tenantId }))
  }
  awards(): readonly Award[] {
    return Object.freeze([...this.awardMap.values()])
  }

  // ── المقتطفُ المختوم: **يُكتب مرّةً ولا يُمسّ** (قب-٤٥) ──────────────────────
  /** ختمٌ ثانٍ **رميةٌ برمجية**: الحارسُ التشغيليّ في الخدمة، وهذا حرزُه الأخير. */
  sealAnnouncement(a: ResultAnnouncement): void {
    if (this.announcementMap.has(a.competitionId)) {
      throw new Error(`مقتطفٌ مختومٌ يُكتب فوقه: ${a.competitionId} — الإعلانُ لا رجعة فيه`)
    }
    this.announcementMap.set(a.competitionId, Object.freeze({ ...a }))
  }
  getAnnouncement(competitionId: string): ResultAnnouncement | null {
    return this.announcementMap.get(competitionId) ?? null
  }
}
