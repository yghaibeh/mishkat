/**
 * **سجلُّ التدقيق الواحد** — CR-027 (قرارُ مدير البرنامج ٢٠٢٦-٠٧-٢٢) والمادة ٤/٨:
 * *«سجلٌّ لا يُمحى: من، ماذا، متى، **على أي نطاق**»*.
 *
 * ### لماذا موضعُه هنا لا في وحدة ميزة
 * كان لكلِّ وحدةٍ سجلُّها المحليّ، وأحدُهما **أضيقُ من العقد المعلن** (`AuditEntry` في
 * `db/repositories/contracts.ts`) فلا يحمل نطاقاً. والعَرَضُ «فعلٌ بلا نطاق»، أمّا الجذرُ
 * فـ**مصدرا حقيقةٍ لشيءٍ واحد** (المادة ١/٢) — وتوسيعُ السجلّ المحليّ يُداوي العَرَض
 * ويُبقي الجذر. فالسجلُّ **مِرفقٌ عابرٌ للوحدات** كمحرّك `can()` ومُحلِّل الإعدادات: تناديه
 * الوحداتُ ولا تملكه واحدةٌ منها.
 *
 * ### وأثرُه ليس أكاديمياً
 * قيدُ تدقيقٍ عن حدثٍ في مسجدٍ بعينه كان **لا يظهر في تدقيق ذلك المسجد** — أي أن مسؤولاً
 * يفتّش سجلَّ مسجده يرى صفحةً ناقصةً **ولا يعلم أنها ناقصة**. و`listInScope` هنا هي الجواب.
 *
 * ### والنطاقُ **مطلوبٌ بالنوع** لا بالانضباط
 * `unitPath` حقلٌ إلزاميّ: من لا يملك نطاقاً لا يُترجم كودُه أصلاً. وما يستحيل اشتقاق
 * نطاقه يُوجَّه إلى جذر الشبكة **موسوماً** `scopeExact = false`، وقائمتُه **مُعلنةٌ محروسةٌ
 * بـ`toEqual`** فلا تنمو صامتةً ولا تنكمش. **الاستثناءُ المُعلَنُ المحروسُ ليس ثغرة —
 * والصمتُ هو الثغرة.**
 *
 * **حتميّ** (TESTING_POLICY §٥): تسلسلٌ متتابع لا عشوائيّة، ولا ساعةَ زمن-تشغيل (`at` يُحقن).
 */

import { ROOT_PATH, isValidScopePath, contains } from "../authorization/scope.js"

/**
 * **حَجْرٌ معلن**: أفعالُ تدقيقٍ لا يُشتقّ نطاقُها من كيانٍ مخزَّن، فتُوجَّه إلى جذر الشبكة
 * **موسومةً**. وحيدُها اليوم `ledger.post.failed`: هدفُه **مفتاحُ ترحيلٍ** لا كيان، والترحيلُ
 * لم يقع أصلاً فلا قيدَ يُشتقّ منه (`SPEC_finance_ledger` §٣.٤).
 *
 * القائمةُ محروسةٌ بـ`toEqual` في `tests/db/audit-routing.test.ts`: **لا تنمو صامتةً**
 * (فعلٌ جديدٌ بلا نطاقٍ يُرمى ويُفشل الطقم) **ولا تنكمش صامتةً** (ميتٌ فيها يُفشل الطقم).
 */
export const AUDIT_ACTIONS_WITHOUT_SCOPE: readonly string[] = ["ledger.post.failed"]

/**
 * **مصدرُ السجلّ** — بقيَ ضلعاً في المفتاح الطبيعيّ المستقرّ `(tenant_id, source, seq)`
 * (`db/README.md` الحسم ٣)، وصار بعد التوحيد **قيمةً واحدة**: السجلُّ واحدٌ فلا مصادرَ له.
 * والتصنيفُ الحقيقيُّ يعيش في `action` — **ولا يُكرَّر هنا** (المادة ١/٢).
 */
export const AUDIT_SOURCE = "audit"

/**
 * قيدُ تدقيقٍ كما يُقدَّم — **شكلُ `AuditEntry` المعلن** ناقصاً ما تولّده الطبقةُ نفسُها
 * (الشبكةُ والتسلسلُ والمعرّف). والحقولُ الستةُ التي لا يملكها مُستدعٍ اليوم تبقى فارغةً
 * **صراحةً بقيمةٍ معلنة** لا بالإغفال: عمودُها موجودٌ في المخطط منذ الهجرة الأولى، لأن
 * إضافتَه لاحقاً إلى أكبر جدولٍ في القاعدة هي الهجرةُ التي نتجنّبها (ADR ملحق أ).
 */
export type AuditAppend = {
  /** **زمن الخادم** لا زمن العميل (ب-٣٩هـ) — يُحقن ولا يُقرأ من ساعة التشغيل. */
  readonly at: Date
  readonly actorPersonId: string
  readonly action: string
  /**
   * **النطاق صريحاً** — بيتُ القصيد في CR-027. لا يُشتقّ من كيانٍ ولا يُخترع: مَن يكتب
   * القيدَ يعرف على أيِّ وحدةٍ وقع الحدث، فيقولها.
   */
  readonly unitPath: string
  /** قدرةُ الفاعل — `null` **قرارٌ صريح** لِما لا تملكه طبقةُ الخدمات (لا إغفال). */
  readonly capability: string | null
  readonly targetType: string
  readonly targetId: string
  readonly reason: string | null
}

/** القيدُ المخزَّن — يضيف ما تولّده الطبقة، ويطابق أعمدةَ `audit_log` حقلاً بحقل. */
export type AuditEntryRecord = AuditAppend & {
  readonly tenantId: string
  readonly source: string
  readonly seq: number
  /** معرّفٌ مشتقٌّ من المفتاح الطبيعيّ المستقرّ — لا عدّادٌ ثانٍ ولا عشوائيّة. */
  readonly id: string
  /** ١ = النطاقُ نطاقُ الحدث · ٠ = تعذّر فوُجِّه إلى الجذر **موسوماً** لا مُموَّهاً. */
  readonly scopeExact: boolean
}

/** علامةٌ في السجلّ — بها يرتدّ المستودعُ عن أثرٍ لم يكتمل (انظر `mark`/`rollbackTo`). */
export type AuditMark = number & { readonly __auditMark: unique symbol }

export class AuditJournal {
  private entries: AuditEntryRecord[] = []
  /** أعلى تسلسلٍ رآه السجلّ — يُستأنف عبر التحميل فلا يدهس جديدٌ محفوظاً خارج النطاق. */
  private highestSeq = 0

  /**
   * السجلُّ **مقسَّمٌ بالشبكة** كالمستودعات: يحمل شبكتَه ويختمها على كلِّ قيد، فـ`tenantId`
   * يُشتقّ من سياقه لا من مدخل العميل — ولا يُبلَغ قيدُ شبكةٍ من أخرى.
   */
  constructor(readonly tenantId: string) {}

  /**
   * الإلحاق — **المسارُ الوحيد** إلى السجلّ. يرمي على فعلٍ بلا نطاقٍ خارج الحَجْر المعلن:
   * الرميةُ تُفشل الطقم عند أول فعلٍ جديدٍ يُغفل نطاقَه، وهذا هو الغرض.
   */
  append(entry: AuditAppend): AuditEntryRecord {
    if (!isValidScopePath(entry.unitPath)) {
      throw new Error(
        `قيدُ تدقيقٍ بمسارٍ مخالفٍ لثابت التمثيل (§١.٥): ${entry.action} ⟵ ${JSON.stringify(entry.unitPath)}`,
      )
    }
    const exempt = AUDIT_ACTIONS_WITHOUT_SCOPE.includes(entry.action)
    if (entry.unitPath === ROOT_PATH && !exempt) {
      throw new Error(
        `فعلُ تدقيقٍ بلا نطاق: ${entry.action} ⟵ ${entry.targetId}. ` +
          `النطاقُ يُقال ولا يُشتقّ (CR-027)؛ وإن استحال فعلاً فأدرجه في ` +
          `AUDIT_ACTIONS_WITHOUT_SCOPE صراحةً — والقائمةُ محروسةٌ بـtoEqual`,
      )
    }
    this.highestSeq += 1
    const record: AuditEntryRecord = Object.freeze({
      ...entry,
      tenantId: this.tenantId,
      source: AUDIT_SOURCE,
      seq: this.highestSeq,
      id: `${AUDIT_SOURCE}-${this.highestSeq}`,
      scopeExact: !exempt,
    })
    this.entries.push(record)
    return record
  }

  /** السجلُّ يُقرأ ولا يُعدَّل: القائمةُ المُعادة **مجمَّدة** فلا يُنتزع منها قيد (المادة ٧/٤). */
  all(): readonly AuditEntryRecord[] {
    return Object.freeze([...this.entries])
  }

  /**
   * **معزولٌ بالنطاق عند القراءة** (عقدُ `AuditRepository`) — وهذا ما كان ناقصاً: حدثٌ في
   * مسجدٍ يظهر الآن في تدقيق ذلك المسجد، وفي تدقيق ما فوقه بالاحتواء لا بالمصادفة.
   */
  listInScope(scopePath: string, limit: number): readonly AuditEntryRecord[] {
    return Object.freeze(
      this.entries.filter((entry) => contains(scopePath, entry.unitPath)).slice(0, limit),
    )
  }

  // ── الذرّية: علامةٌ وارتداد (يستعملها `transaction` في المستودعات) ────────────
  /**
   * **العلامةُ طولُ السجلّ** لا نسخةٌ منه: السجلُّ **ملحقٌ فقط** فلا يتغيّر ما قبلَها أبداً،
   * فالارتدادُ قصٌّ لا استرجاع — وهو أرخصُ وأصدق.
   */
  mark(): AuditMark {
    return this.entries.length as AuditMark
  }

  /**
   * يقصّ ما بعد العلامة **ويُرجع العدّاد معها** — فلا تُحرق أرقامُ تسلسلٍ في فشلٍ مرتدّ
   * (نظيرُ عدّاد السندات §٦.٢: مصدرُ الفجوات الكلاسيكيّ).
   */
  rollbackTo(mark: AuditMark): void {
    if (mark > this.entries.length) throw new Error(`علامةُ تدقيقٍ من المستقبل: ${mark}`)
    const dropped = this.entries.splice(mark)
    this.highestSeq -= dropped.length
  }

  /**
   * **التحميلُ من القاعدة** — يُستعمل من طبقة الاستمرار وحدَها: يُلحق القيدَ **بتسلسله
   * المحفوظ** فلا يُعاد ترقيمُ محفوظ. وإعادةُ الترقيم على نطاقٍ جزئيّ كانت ستكتب فوق قيدِ
   * وحدةٍ **خارج النطاق** بنفس المفتاح — محوٌ صامتٌ في جدولٍ ملحقٍ فقط.
   */
  restore(records: readonly AuditEntryRecord[]): void {
    for (const record of records) {
      this.entries.push(Object.freeze({ ...record, tenantId: this.tenantId }))
      this.highestSeq = Math.max(this.highestSeq, record.seq)
    }
  }

  /** يرفع العدّادَ إلى المحفوظ — فالنطاقُ الجزئيّ لا يُنقص تسلسلاً ولا يُصادم خارجَه. */
  resumeAt(seq: number): void {
    this.highestSeq = Math.max(this.highestSeq, seq)
  }

  /** أعلى تسلسلٍ بلغه السجلّ — يُخزَّن في `sequences` فينجو عبر الجلسات. */
  get sequence(): number {
    return this.highestSeq
  }
}
