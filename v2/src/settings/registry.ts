/**
 * سجل الإعدادات الحية — عقد `SPEC_settings` §١ و§٢.
 *
 * هذا الملف هو **الموضع الوحيد المسموح فيه بالأرقام التشغيلية** في v2 (قب-٦):
 * «فيه تعيش الافتراضيات بحكم التعريف» (§١-٩). بوابة G14 تستثنيه وتفشل على ما عداه.
 *
 * عدد الإعدادات: **٨٦ = ٧٤ إعداد عمل + ١٢ إعداد منصة** — منها **٧ مفاتيح تفعيل**.
 * (المواصفة تسرد ٩٣؛ وقب-١١ أسقط `network.unit_status.done_pct` و`below_pct`
 *  حين اعتُمد تصنيف المسجد بنسبة الهدف ١٠٠٪/٥٠٪ — «يسقط ولا يُنقل إعداداً»؛
 *  وCR-008 شطب `finance.dual_control.exempt_roles` — **الإعداداتُ تضبط قِيَماً لا تُلغي
 *  ثوابت** (§١-٨أ): إعفاءٌ بالدور من الاعتماد الثنائي ينقض ق-٥٣ وتُفشله G6؛
 *  وCR-009 شطب `approval.draft_bypass_enabled` — **إعدادٌ يُحيي قاعدةً نسخها المالك**
 *  (ب-٣٠أ)، وهو مخالفٌ **بحكم الاسم** (§١-٨أ المُوسَّعة) فيُشطب ولو بلا مستهلك؛
 *  وCR-010 شطب `points.free_activity_scores` (ب-٤٢: «بلا نقاط آلية»)؛
 *  وCR-014 شطب `feature.tahfeez` و`feature.alaBaseera` — **إعدادان يُعيدان عَرَضاً
 *  عولج بإعادة تصميم** (ع-٨/ب-٢٨)، انظر سطر النسخ في مجال `feature`.)
 *
 * **٩٣ − ٢ (قب-١١) − ١ (CR-008) − ١ (CR-009) − ١ (CR-010) − ٢ (CR-014) = ٨٦.**
 * > **العدّادُ هنا تخلّف يوم CR-010** (بقي ٨٩ وقد صار ٨٨)، فالمواضعُ الخمسة تُعدّ وتُطابَق
 * > في كل شطب: هذا التعليق · ملخّص المواصفة · حاشيةُ العدّ · عنوان §٢-١ · اختبارُ العدّ.
 */

export type SettingType =
  | "number"
  | "percent"
  | "duration"
  | "money"
  | "timezone"
  | "toggle"
  | "enum"
  | "list"

/** سقف التخصيص المسموح (§١-٣) — «ما يدخل في مقارنة عبر الوحدات لا يجوز أن يختلف بينها». */
export type SettingLevel = "global" | "section" | "unit"

/** المؤثِّر مالياً بأثر قادم دائماً (ق-٣٦) — تغييره لا يعيد حساب الماضي أبداً. */
export type SettingEffect = "immediate" | "forward_dated"

export type SettingCategory = "business" | "platform"

export type SettingValue = string | number | boolean | readonly string[]

export type SettingDefinition = {
  readonly id: string
  readonly ar: string
  readonly type: SettingType
  /** `null` = مسجَّل بلا افتراضي عمداً (ق-م-٢، أقرّه قب-١١ بند ٣): يُملأ من الإنتاج لا باختراع رقم. */
  readonly default: SettingValue | null
  readonly level: SettingLevel
  readonly effect: SettingEffect
  readonly category: SettingCategory
  readonly source: string
  /** مفتاح تفعيل (§١-٧): عالمي حصراً، وله إجراء مرافق معلن لا يُقبل بدونه. */
  readonly featureFlag?: { readonly companionAction: string }
  /** قاموسٌ **مغلقٌ مسرودٌ في الكود** (§١-٢) — لِما قيمُه ثابتةٌ لا تتوسّع بالبيانات. */
  readonly allowed?: readonly string[]
  /**
   * قاموسٌ **مغلقٌ يعيش بياناتٍ مرجعية** (قب-٢٢) — يُعلَن **مصدرُه** ولا تُسرد قيمُه.
   * وُلد بـCR-014: `edu.paid_hours.curricula` كان يسرد أنواع الحلقات الأربعة يدوياً، فكان
   * نوعٌ خامس يُضاف **صفّاً** يعمل في الحلقات ولا يُختار هنا — **قائمةٌ تُسرد بدل أن تُشتقّ**
   * (نظير CR-011). والتحقّقُ من العضوية عند **المستهلك** الذي يملك المستأجر والمستودع،
   * لا هنا: السجلُّ وحدةٌ ساكنة بلا مستأجرٍ ولا مستودع (§١-٨: يُحقن ولا يستورد).
   */
  readonly allowedFrom?: string
  readonly min?: number
  readonly max?: number
}

function s(d: SettingDefinition): SettingDefinition {
  return Object.freeze(d)
}

export const SETTINGS: readonly SettingDefinition[] = Object.freeze([
  // ═══ points — النقاط والأهداف ═══
  s({ id: "points.weekly_target", ar: "هدف نقاط المسجد الأسبوعي", type: "number", default: 70, level: "section", effect: "forward_dated", category: "business", source: "ق-٤٢، ق-٤٣ · schema.ts:407", min: 1 }),
  s({ id: "points.participation_min_pct", ar: "عتبة نسبة حضور الأسرة التي يشترطها النشاط المشروط", type: "percent", default: 70, level: "global", effect: "forward_dated", category: "business", source: "ق-٤٠ · utils/points.ts:43-45", min: 0, max: 100 }),
  s({ id: "points.participation_fail_closed", ar: "حين لا يُضبط عدد طلاب الأسرة: امنع النقاط", type: "toggle", default: true, level: "global", effect: "forward_dated", category: "business", source: "ق-٤٠، ب-٣٢" }),
  // ❌ شُطب `points.free_activity_scores` بـCR-010 (٢٠٢٦-٠٧-٢٢): بندٌ **يَعِد بإلغاء قيدٍ
  // قرّره المالك نصاً** (ب-٤٢: «النشاط الحر يُسجَّل توثيقاً **بلا نقاط آلية**») — ثالثُ ظهورٍ
  // للصنف بعد CR-008 وCR-009، وقاعدتُه المعمَّمة في `SPEC_settings` §١-٨أ. وفيه فوق ذلك عيبٌ
  // يجعله غيرَ قابلٍ للتنفيذ: النشاطُ الحرُّ **خارج الكتالوج فلا وزنَ له** — فتفعيلُه يقتضي
  // اختراعَ وزنٍ بلا سند (ب-٣٢/ق-٤٠). والطريقُ المشروع قائم: يُضاف للكتالوج بوزنٍ معلن.
  s({ id: "points.tier.excellent_pct", ar: "عتبة «متميّز» من الهدف", type: "percent", default: 100, level: "global", effect: "immediate", category: "business", source: "ق-٤٤ (قب-١١: المقياس المعتمد)", min: 0, max: 100 }),
  s({ id: "points.tier.below_pct", ar: "عتبة «دون الهدف»", type: "percent", default: 50, level: "global", effect: "immediate", category: "business", source: "ق-٤٤ (قب-١١)", min: 0, max: 100 }),
  s({ id: "network.unit_status.stale_days", ar: "بعد كم يوم بلا إدخال تُوسم الوحدة «متأخرة»", type: "duration", default: 2, level: "global", effect: "immediate", category: "business", source: "scheduled.server.ts:58", min: 1 }),

  // ═══ time و records — الزمن والتأريخ ═══
  s({ id: "time.zone", ar: "المنطقة الزمنية التي تُحسب بها حدود اليوم والأسبوع والشهر", type: "timezone", default: "Asia/Damascus", level: "global", effect: "forward_dated", category: "business", source: "ق-٤٥ · utils/week.ts:6" }),
  s({ id: "time.week_start_day", ar: "يوم بدء الأسبوع", type: "enum", default: "saturday", level: "global", effect: "forward_dated", category: "business", source: "ق-٤٣ · utils/week.ts", allowed: ["saturday", "sunday", "monday"] }),
  s({ id: "time.hijri_calendar", ar: "تقويم العرض الهجري", type: "enum", default: "umm_al_qura", level: "global", effect: "immediate", category: "business", source: "ق-١١٧ · lib/format.ts", allowed: ["umm_al_qura", "civil"] }),
  s({ id: "records.allow_future_dating", ar: "قبول تأريخ إدخالٍ في المستقبل", type: "toggle", default: false, level: "global", effect: "immediate", category: "business", source: "ق-٤٥" }),
  s({ id: "records.backdate_lock_days", ar: "بعد كم يوم يُقفل الإدخال الرجعي", type: "duration", default: 14, level: "section", effect: "forward_dated", category: "business", source: "ب-٣٩د", min: 0 }),

  // ═══ approval — سلسلة الاعتماد ═══
  // ❌ شُطب `approval.draft_bypass_enabled` بـCR-009 (٢٠٢٦-٠٧-٢٢): بندٌ **يَعِد بإحياء قاعدةٍ
  // نسخها المالك نصاً** (ب-٣٠أ: «لا اعتمادَ لمسودةٍ قبل إقرار الأمير»)، فتفعيلُه نقضٌ صامتٌ
  // لقرارٍ مسجَّل في صورة إعدادٍ إداريّ (قب-١٠). **أخطرُ من CR-008**: ذاك يعطّل حارساً لم
  // يُقرَّر إلغاؤه، وهذا يُحيي قاعدةً قُرِّر إلغاؤها. والمحرّك لم يقرأه قط — واختبارُ
  // «الإعدادُ غيرُ مسجَّلٍ فلا يُقرأ» يبقى حارساً في `tests/features/approval/engine.test.ts`.
  s({ id: "approval.amir_can_withdraw", ar: "هل يسحب الأمير إقراره قبل اعتماد الطبقة", type: "toggle", default: true, level: "global", effect: "immediate", category: "business", source: "ب-٣٠ج" }),
  s({ id: "approval.escalation_days", ar: "بعد كم يوم من إقرار الأمير يُصعَّد المتأخر", type: "duration", default: 7, level: "global", effect: "immediate", category: "business", source: "ب-٣٠ب · scheduled.server.ts:70", min: 1 }),
  s({ id: "approval.escalation_mode", ar: "أثر التصعيد", type: "enum", default: "notify_only", level: "global", effect: "immediate", category: "business", source: "ب-٣٠ب (لا يفتح صلاحية)", allowed: ["notify_only"] }),
  s({ id: "approval.entry_reminder_after_days", ar: "بعد كم يوم بلا إدخال يُذكَّر المسجد", type: "duration", default: 2, level: "section", effect: "immediate", category: "business", source: "ق-١١ · scheduled.server.ts:58", min: 1 }),

  // ═══ finance — المال ═══
  s({ id: "finance.point_rate.amount", ar: "المبلغ المستحَق مقابل حزمة النقاط", type: "money", default: 5000, level: "global", effect: "forward_dated", category: "business", source: "ق-٣٦ · settings.server.ts:39-40 (بالسنتات — ق-٤٨)" }),
  s({ id: "finance.point_rate.per_unit", ar: "عدد النقاط المقابل للمبلغ", type: "number", default: 280, level: "global", effect: "forward_dated", category: "business", source: "ق-٣٦ · schema.ts:475", min: 1 }),
  s({ id: "finance.hourly_rate.amount", ar: "أجر ساعة درس «على بصيرة»", type: "money", default: null, level: "global", effect: "forward_dated", category: "business", source: "ق-٨٦ · ق-م-٢ (يُملأ من الإنتاج — قب-١١/٣)" }),
  s({ id: "finance.fixed_salary.amount", ar: "الراتب المقطوع الشهري", type: "money", default: null, level: "global", effect: "forward_dated", category: "business", source: "ق-٣٩، ب-٣٣أ · ق-م-٢" }),
  s({ id: "finance.currency.base", ar: "عملة الدفتر", type: "enum", default: "USD", level: "global", effect: "forward_dated", category: "business", source: "ق-٤٨، ق-٦٢", allowed: ["USD", "SYP", "TRY"] }),
  s({ id: "finance.currencies.enabled", ar: "عملات القبض المسموحة", type: "list", default: ["USD", "SYP", "TRY"], level: "global", effect: "immediate", category: "business", source: "ق-٦٢", allowed: ["USD", "SYP", "TRY"] }),
  s({ id: "finance.dual_control.enabled", ar: "الاعتماد الثنائي على أفعال المسؤول المالي", type: "toggle", default: true, level: "global", effect: "immediate", category: "business", source: "ق-٥٣" }),
  // ❌ شُطب `finance.dual_control.exempt_roles` بـCR-008 (٢٠٢٦-٠٧-٢١): إعفاءٌ **بالدور** من
  // الاعتماد الثنائي ينقض ق-٥٣ («نقطةُ خنقٍ واحدة لا تُلتف»)، وقراءتُه فحصُ دورٍ مقنّع تُفشله G6.
  // وما يحققه ق-٦٣ محققٌ **بالقدرة**: `mosqueFinance.manage` على المسجد بعينه (وحدة box §٤).
  s({ id: "finance.restricted_funds.block_overspend", ar: "منع الصرف من المقيَّد شرعاً فوق رصيده", type: "toggle", default: true, level: "global", effect: "immediate", category: "business", source: "ق-٥٥" }),
  s({ id: "finance.budget.overrun_blocking", ar: "هل تجاوز الموازنة يمنع الصرف", type: "toggle", default: false, level: "global", effect: "immediate", category: "business", source: "ق-٥٨" }),
  s({ id: "finance.budget.alert_pct", ar: "نسبة استهلاك الموازنة التي يبدأ عندها التنبيه", type: "percent", default: 100, level: "unit", effect: "immediate", category: "business", source: "ق-٥٨ · services/budgets.ts", min: 0, max: 100 }),
  s({ id: "finance.petty_cash.ceiling", ar: "سقف صندوق النثرية المستديم", type: "money", default: null, level: "unit", effect: "forward_dated", category: "business", source: "ق-٧٠ (يُضبط عند فتح كل صندوق)" }),
  s({ id: "finance.receipt.prefix", ar: "بادئة ترقيم سندات القبض", type: "enum", default: "R-", level: "global", effect: "immediate", category: "business", source: "ق-٥٦", allowed: ["R-", "REC-"] }),
  s({ id: "finance.receipt.number_padding", ar: "عدد خانات رقم السند", type: "number", default: 6, level: "global", effect: "immediate", category: "business", source: "ق-٥٦", min: 1 }),
  s({ id: "finance.deductions.display_enabled", ar: "إظهار الخصومات في الشاشات", type: "toggle", default: false, level: "global", effect: "immediate", category: "business", source: "ب-٣١" }),
  s({ id: "finance.penal_deductions_allowed", ar: "السماح بخصمٍ عقابي", type: "toggle", default: false, level: "global", effect: "immediate", category: "business", source: "ق-٣٤، ب-٣١" }),
  s({ id: "finance.entitlement.approval_required", ar: "إقرار الإدارة الشهري للمستحقات", type: "toggle", default: true, level: "global", effect: "immediate", category: "business", source: "ق-٥١" }),
  s({ id: "finance.closing.period", ar: "دورية الإقفال الدوري للصناديق", type: "enum", default: "hijri_monthly", level: "global", effect: "forward_dated", category: "business", source: "ق-٦٧، ق-٣٥", allowed: ["hijri_monthly"] }),

  // ═══ edu — التعليم والتحفيظ ═══
  s({ id: "edu.circle_ranking.attendance_weight", ar: "وزن الحضور في تقييم الحلقات", type: "percent", default: 60, level: "section", effect: "immediate", category: "business", source: "ق-٩١ · tahfeez.server.ts:325", min: 0, max: 100 }),
  s({ id: "edu.circle_ranking.grade_weight", ar: "وزن العلامات في تقييم الحلقات", type: "percent", default: 40, level: "section", effect: "immediate", category: "business", source: "ق-٩١ · tahfeez.server.ts:325", min: 0, max: 100 }),
  s({ id: "edu.circle_ranking.window_days", ar: "نافذة التقييم الدوري", type: "duration", default: 30, level: "section", effect: "immediate", category: "business", source: "ق-٩١ · tahfeez.server.ts:296", min: 1 }),
  s({ id: "edu.circle_ranking.hide_all_zero", ar: "إخفاء الترتيب إن كانت كل درجاته أصفاراً", type: "toggle", default: true, level: "global", effect: "immediate", category: "business", source: "ق-٩١، ق-١١٢" }),
  s({ id: "edu.grade.max", ar: "الحد الأعلى لعلامة الطالب", type: "number", default: 10, level: "global", effect: "immediate", category: "business", source: "ع-٩ / ب-١٣", min: 1 }),
  // ⚠️ `edu.paid_hours.curricula`: **قائمتُه `allowed` شُطبت بـCR-014** (٢٠٢٦-٠٧-٢٢). كانت
  // تسرد أنواع الحلقات الأربعة يدوياً — و**الأنواعُ بياناتٌ مرجعية قابلة للتوسّع** (ب-٢٨/قب-٢٢):
  // نوعٌ خامس يُضاف صفّاً **يعمل في الحلقات ولا يكون قابلاً للاختيار هنا**، فيصير في النظام
  // معجما أنواعٍ يتباعدان (عين ما عالجه قب-١٦). **والإعدادُ نفسُه حيٌّ المعنى** (ق-٨٦: ساعاتُ
  // منهج «على بصيرة» وحدَها تُحتسب) فلا يُشطب — يُشطب **سردُه** ويُعلَن **مصدرُ قاموسه**.
  s({ id: "edu.paid_hours.curricula", ar: "المناهج التي تُحتسب ساعاتها مالياً", type: "list", default: ["baseera"], level: "global", effect: "forward_dated", category: "business", source: "ق-٨٦ · CR-014", allowedFrom: "circles.typeCatalog" }),
  s({ id: "edu.paid_hours.approved_only", ar: "احتساب الدروس المعتمدة فقط", type: "toggle", default: true, level: "global", effect: "forward_dated", category: "business", source: "ق-٨٦" }),
  s({ id: "edu.guardian_token.ttl_days", ar: "عمر رمز وليّ الأمر", type: "duration", default: 365, level: "global", effect: "immediate", category: "business", source: "ب-٣٦أ", min: 1 }),
  s({ id: "edu.guardian_token.renewable", ar: "إتاحة زر «تجديد الرابط»", type: "toggle", default: true, level: "global", effect: "immediate", category: "business", source: "ب-٣٦أ" }),
  s({ id: "edu.weekly.max_group_activities", ar: "أقصى عدد أنشطة جماعية في السجل الأسبوعي للحلقة", type: "number", default: 5, level: "global", effect: "immediate", category: "business", source: "services/halaqaWeekly.ts:8", min: 1 }),
  s({ id: "edu.mosque_lesson.conflict_blocking", ar: "هل تعارض المواعيد يمنع الإضافة", type: "toggle", default: false, level: "global", effect: "immediate", category: "business", source: "ق-٩٧" }),
  s({ id: "edu.supervisor_notes.visible_to_teacher", ar: "إظهار ملاحظات المشرف للمعلم قراءةً", type: "toggle", default: true, level: "global", effect: "immediate", category: "business", source: "ب-٣٥أ" }),

  // ═══ supervision و materials ═══
  s({ id: "supervision.visit_cadence_days", ar: "دورة الزيارة الميدانية المستحقة", type: "duration", default: 30, level: "section", effect: "immediate", category: "business", source: "ق-٩٩ · supervision.server.ts:150", min: 1 }),
  s({ id: "supervision.reminder_interval_days", ar: "دورية تذكير المشرف بالحلقة المتأخرة", type: "duration", default: 7, level: "global", effect: "immediate", category: "business", source: "ق-٩٩ · scheduled.server.ts", min: 1 }),
  s({ id: "materials.mandatory_overdue_days", ar: "بعد كم يوم تُعدّ المادة الإلزامية متأخرة", type: "duration", default: 14, level: "global", effect: "immediate", category: "business", source: "ق-٩٦ · scheduled.server.ts:127", min: 1 }),
  s({ id: "materials.reminder_interval_days", ar: "دورية تذكير المتأخرين عن المكتبة", type: "duration", default: 7, level: "global", effect: "immediate", category: "business", source: "ق-٩٦", min: 1 }),

  // ═══ notify — الإشعارات ═══
  s({ id: "notify.channels.enabled", ar: "قنوات الإيصال المفعّلة", type: "list", default: ["bell", "telegram", "push"], level: "global", effect: "immediate", category: "business", source: "ق-٧٥، ت-١٦", allowed: ["bell", "telegram", "push"] }),
  s({ id: "notify.due_soon_hours", ar: "نافذة تذكير «يستحق قريباً»", type: "duration", default: 24, level: "global", effect: "immediate", category: "business", source: "scheduled.server.ts:192", min: 1 }),
  s({ id: "notify.telegram_link_ttl_minutes", ar: "عمر رابط ربط تيليغرام", type: "duration", default: null, level: "global", effect: "immediate", category: "business", source: "ع-١٦، ب-٢٠ · ق-م-٢" }),

  // ═══ identity — الهوية والدخول ═══
  s({ id: "identity.login.max_attempts", ar: "محاولات الدخول قبل الحظر المؤقت", type: "number", default: 5, level: "global", effect: "immediate", category: "business", source: "ت-٧ · services/authTokens.ts:50", min: 1 }),
  s({ id: "identity.login.window_minutes", ar: "نافذة عدّ المحاولات", type: "duration", default: 15, level: "global", effect: "immediate", category: "business", source: "ت-٧ · services/authTokens.ts:49", min: 1 }),
  s({ id: "identity.session.ttl_days", ar: "عمر جلسة الدخول", type: "duration", default: 7, level: "global", effect: "immediate", category: "business", source: "auth.server.ts:52", min: 1 }),
  s({ id: "identity.registration.public_enabled", ar: "فتح التسجيل الذاتي العام", type: "toggle", default: true, level: "global", effect: "immediate", category: "business", source: "ق-١٨" }),
  s({ id: "identity.registration.max_pending_per_phone", ar: "سقف الطلبات المعلّقة لكل رقم هاتف", type: "number", default: 3, level: "global", effect: "immediate", category: "business", source: "ق-٣٢ · registration.server.ts:114", min: 1 }),
  s({ id: "identity.registration.honeypot_enabled", ar: "فخّ الطلبات الآلية", type: "toggle", default: true, level: "global", effect: "immediate", category: "business", source: "ق-٣٢" }),
  s({ id: "identity.mfa.enabled", ar: "تفعيل مسار التحقق الثنائي", type: "toggle", default: false, level: "global", effect: "immediate", category: "business", source: "ب-٣٦ب" }),
  s({ id: "identity.mfa.required_roles", ar: "الأدوار المُلزَمة بالتحقق الثنائي", type: "list", default: ["admin", "finance_officer"], level: "global", effect: "immediate", category: "business", source: "ب-٣٦ب" }),
  s({ id: "identity.impersonation.read_only", ar: "حصر الانتحال بالقراءة", type: "toggle", default: true, level: "global", effect: "immediate", category: "business", source: "ب-٤٠أ، ق-٢٧" }),

  // ═══ retention — الاحتفاظ ═══
  s({ id: "retention.person_records_years", ar: "مدة الاحتفاظ بسجلات الفرد بعد انتهاء عضويته", type: "duration", default: 2, level: "global", effect: "immediate", category: "business", source: "ب-٣٧أ", min: 1 }),
  s({ id: "retention.anonymize_after_expiry", ar: "إخفاء الهوية بعد انقضاء المدة (بلا تنفيذٍ فعّال حتى تُكتب مواصفة الخصوصية — ق-م-٥)", type: "toggle", default: true, level: "global", effect: "immediate", category: "business", source: "ب-٣٧أ · ق-م-٥" }),

  // ═══ feature — مفاتيح التفعيل (قب-٧): عالمية، وتحريرها على الجذر، وبسبب نصّي ═══
  s({ id: "feature.layer_bloc_enabled", ar: "طبقة «الكتلة» في السلّم", type: "toggle", default: false, level: "global", effect: "immediate", category: "business", source: "ب-٣٨أ", featureFlag: { companionAction: "التفعيل يُدخل «الكتلة» نوعَ وحدةٍ متاحاً للإنشاء فقط — لا وحدة قائمة تُنقل ولا مسار يتغير، وNESSA لا تراها حتى تُنشأ كتلةٌ فعلية وتُنقل مناطق تحتها. والتعطيل يُرفض ما دامت وحدةٌ من النوع قائمة، مع بيان العدد والمسار." } }),
  s({ id: "feature.mosque_family_roles_enabled", ar: "أدوار أسرة المسجد الستة", type: "toggle", default: false, level: "global", effect: "immediate", category: "business", source: "ب-٣٨ب", featureFlag: { companionAction: "التفعيل يفتح الأدوار للإسناد ولا يُسند أحداً؛ والتعطيل يُرفض ما دام هناك إسنادٌ نشط عليها." } }),
  s({ id: "feature.competition_public_registration", ar: "التسجيل العام في المسابقة بموافقة الأمير", type: "toggle", default: false, level: "global", effect: "immediate", category: "business", source: "ب-٤٤", featureFlag: { companionAction: "التفعيل يفتح الرابط العام؛ والتعطيل يُغلقه ولا يمسّ المشتركين القائمين." } }),
  s({ id: "feature.manual_journal_entry", ar: "القيد المحاسبي اليدوي بواجهة", type: "toggle", default: true, level: "global", effect: "immediate", category: "business", source: "ب-٣٩أ", featureFlag: { companionAction: "التعطيل يمنع قيوداً جديدة ولا يمسّ المرحَّل." } }),
  s({ id: "feature.relief_committee", ar: "بيانات لجنة الإغاثة (حالات إنسانية)", type: "toggle", default: false, level: "global", effect: "immediate", category: "business", source: "ب-٣٧ج", featureFlag: { companionAction: "لا يُفعَّل قبل مواصفة أمنية مستقلة بعد القطع." } }),
  // ❌ شُطب `feature.alaBaseera` و`feature.tahfeez` بـCR-014 (٢٠٢٦-٠٧-٢٢، نُفِّذا في T17):
  // **مفهومُ «وحدةٍ تُخفى» سقط بب-٢٨** — «الحلقةُ كيانٌ واحد ابنٌ للمسجد، ونوعُها صفةٌ عليه،
  // بلا جسرٍ ولا تفعيلِ أقسام». فلم يعد «التحفيظ» و«على بصيرة» **وحدتين** بل **نوعين من أربعةٍ
  // في كتالوجٍ واحد**، والبديلُ المبنيّ في T16 هو **كتالوجُ الأنواع بياناتٍ** (قب-٢٢):
  // **نوعٌ لا يُراد لا يُضاف** أصلاً، **ولا «تعطيل» يمنع إدارة نوعٍ قائم** — و`CircleType`
  // ثلاثةُ حقولٍ لا رابعَ لها ولا حقلَ تفعيل، فالبابُ الثاني للمنع **غيرُ موجود بالبنية**.
  // **وهذا أخطرُ من CR-008/CR-009/CR-010 الثلاثة**: تلك تَعِد بتعطيل حارسٍ أو إحياء قاعدةٍ
  // منسوخة، وهذان **يَعِدان بإحياء عَرَضٍ شكاه العميل بلسانه** — ع-٨: «لم أقدر على إدارة حلقة
  // الرشيدي لأن قسمها غير مفعّل»، وهو البلاغ الذي وُلدت T16 كلُّها لقتله. **صفر مستهلك**:
  // لا قارئَ لهما في `v2/src` قبل الشطب ولا بعده (مسحٌ مثبت)، فالأثرُ السلوكيّ صفر —
  // والخطرُ كان **الدعوة** لا الأثر: أولُ بانٍ لسجل التحفيظ (ق-٩٠) يجد مفتاحاً باسم وحدته
  // فيربطه به، فيُولَد الانفصالُ من جديد بعد أن قُتل بنيوياً.
  // والقاعدةُ المُوسَّعة في `SPEC_settings` §١-٨أ (قب-٤٠): *لا يُعطِّل إعدادٌ حارساً محروساً،
  // ولا يُعيد إعدادٌ عَرَضاً عولج بإعادة تصميم؛ والذي يفترض نموذجاً سابقاً يُشطب يوم يُنسخ
  // النموذج لا يوم يُكتشف.* وحارسُها الآليّ في `tests/settings/resolver.test.ts`.
  s({ id: "feature.meetings", ar: "وحدة الاجتماعات", type: "toggle", default: true, level: "global", effect: "immediate", category: "business", source: "settings.server.ts:14", featureFlag: { companionAction: "التعطيل يُخفي الوحدة ولا يحذف بياناتها." } }),
  s({ id: "feature.committees", ar: "وحدة اللجان", type: "toggle", default: true, level: "global", effect: "immediate", category: "business", source: "settings.server.ts:15", featureFlag: { companionAction: "التعطيل يُخفي الوحدة ولا يحذف بياناتها." } }),

  // ═══ brand و ui و competition ═══
  s({ id: "brand.name", ar: "اسم المنظومة", type: "enum", default: "مِشكاة", level: "global", effect: "immediate", category: "business", source: "settings.server.ts:27", allowed: ["مِشكاة"] }),
  s({ id: "brand.letter", ar: "حرف الشعار", type: "enum", default: "م", level: "global", effect: "immediate", category: "business", source: "settings.server.ts:27", allowed: ["م"] }),
  s({ id: "ui.tree.lazy_threshold", ar: "عدد الأوراق الذي يتحول عنده العرض الشجري للتحميل الكسول", type: "number", default: 500, level: "global", effect: "immediate", category: "business", source: "ق-١١٦ · alaBaseera.server.ts:147", min: 1 }),
  s({ id: "competition.min_age", ar: "أدنى سن للاشتراك في المسابقة", type: "number", default: 15, level: "global", effect: "immediate", category: "business", source: "services/competition.ts:11", min: 1 }),
  s({ id: "competition.max_age", ar: "أقصى سن للاشتراك في المسابقة", type: "number", default: 40, level: "global", effect: "immediate", category: "business", source: "services/competition.ts:12", min: 1 }),

  // ═══ platform — إعدادات المنصة التقنية (لا تُعرض في الواجهة، §٢-٣) ═══
  s({ id: "platform.sql.chunk_size", ar: "حجم دفعة معرّفات IN(...)", type: "number", default: 90, level: "global", effect: "immediate", category: "platform", source: "ت-٣ · utils/chunks.ts:2", min: 1, max: 90 }),
  s({ id: "platform.import.max_rows", ar: "أقصى صفوف ملف الاستيراد", type: "number", default: 500, level: "global", effect: "immediate", category: "platform", source: "ق-٧٣ · services/financeImport.ts:11", min: 1 }),
  s({ id: "platform.import.max_bytes", ar: "أقصى حجم ملف الاستيراد", type: "number", default: 2097152, level: "global", effect: "immediate", category: "platform", source: "ق-٧٣ · services/financeImport.ts:11", min: 1 }),
  s({ id: "platform.cron.interval", ar: "دورية المجدولات", type: "enum", default: "hourly", level: "global", effect: "immediate", category: "platform", source: "ت-٩، ت-١٥", allowed: ["hourly", "daily"] }),
  s({ id: "platform.page_size.default", ar: "حجم الصفحة الافتراضي للقوائم", type: "number", default: 20, level: "global", effect: "immediate", category: "platform", source: "search.server.ts:8", min: 1 }),
  s({ id: "platform.page_size.users", ar: "صفحة المستخدمين", type: "number", default: 25, level: "global", effect: "immediate", category: "platform", source: "admin.server.ts:61", min: 1 }),
  s({ id: "platform.page_size.finance", ar: "صفحة المالية", type: "number", default: 25, level: "global", effect: "immediate", category: "platform", source: "finance.server.ts:111", min: 1 }),
  s({ id: "platform.page_size.media", ar: "صفحة المعرض", type: "number", default: 24, level: "global", effect: "immediate", category: "platform", source: "mediaHub.server.ts:17", min: 1 }),
  s({ id: "platform.finance_actions.list_limit", ar: "سقف قائمة أفعال الاعتماد الثنائي", type: "number", default: 60, level: "global", effect: "immediate", category: "platform", source: "services/financeActions.ts:286", min: 1 }),
  s({ id: "platform.refresh_token.ttl_days", ar: "عمر رمز التحديث", type: "duration", default: 30, level: "global", effect: "immediate", category: "platform", source: "services/authTokens.ts:24", min: 1 }),
  s({ id: "platform.upload.max_bytes", ar: "أقصى حجم ملف مرفوع", type: "number", default: null, level: "global", effect: "immediate", category: "platform", source: "المادة ٨/٤ · ق-م-٢" }),
  s({ id: "platform.media.cache_mode", ar: "سياسة تخبئة الوسائط", type: "enum", default: "private_no_sw", level: "global", effect: "immediate", category: "platform", source: "ت-٥", allowed: ["private_no_sw"] }),
])

export const SETTINGS_BY_ID: ReadonlyMap<string, SettingDefinition> = new Map(
  SETTINGS.map((d) => [d.id, d]),
)

/**
 * ثوابت تُركت صلبة عمداً — §٢-٤.
 * هذه هي القائمة الوحيدة التي تسمح لبوابة G14 بالمرور على رقمٍ بعينه،
 * وكلُّ عنصر فيها سببه شرعي أو محاسبي أو دستوري أو أن ضبطه يكسر النظام لا يعدّله.
 */
export const DELIBERATE_HARD_CONSTANTS: readonly { id: string; value: string; why: string }[] =
  Object.freeze([
    { id: "quran.surah_count", value: "١١٤", why: "شرعي/مرجعي (ق-٨٩)" },
    { id: "quran.page_count", value: "٦٠٤", why: "شرعي/مرجعي (ق-٨٩)" },
    { id: "ledger.balance_invariant", value: "Σمدين = Σدائن", why: "مبدأ محاسبي (ق-٤٩)" },
    { id: "money.storage_unit", value: "السنت الصحيح", why: "محاسبي (ق-٤٨)" },
    { id: "ledger.correction_method", value: "قيد عكسي لا حذف", why: "محاسبي/تدقيقي (ق-٤٩)" },
    { id: "audit.immutable", value: "لا يُمحى", why: "دستوري (المادة ٤/٨)" },
    { id: "data.no_physical_delete", value: "ممنوع", why: "دستوري (المادة ٧/٤)" },
    { id: "ui.language_direction", value: "عربي RTL", why: "دستوري (المادة ٢/٦)" },
    { id: "admin.not_tasked", value: "ثابت", why: "قاعدة عمل محروسة (ق-٤)" },
    { id: "nessa.nearest_only", value: "ثابت", why: "ق-١ — «إعدادها» يعيد فتحها" },
    { id: "caps.personal_not_granted_by_wildcard", value: "ثابت", why: "ق-٢٧" },
    { id: "auth.pbkdf2_iterations", value: "١٠٠٬٠٠٠", why: "تغييره يبطل الهاشات القائمة" },
    { id: "auth.jwt_fail_closed", value: "ثابت", why: "أمني (ت-٧)" },
    { id: "infra.production_names", value: "ثابتة", why: "تشغيلي (ت-١٥)" },
  ])
