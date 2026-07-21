// ⚠️ ملف مولَّد آلياً من authorization.matrix.json — لا يُحرَّر يدوياً.
// المولّد: tools/generate/emit-derived.mjs · الحارس: G5
// SPEC_authorization §٥.١ — المصدر الواحد وكل ما عداه مشتق.

/** معرّف القدرة — اتحادٌ مغلق. معرّفٌ مخترع لا يُترجم (G1 تمسكه زمن البناء). */
export type CapId =
  | "network.view"
  | "report.view"
  | "report.submit"
  | "report.approve"
  | "report.approve.override"
  | "approve.breakGlass"
  | "report.retract"
  | "report.export"
  | "records.editLocked"
  | "records.correct"
  | "dailyLog.view"
  | "dailyLog.edit"
  | "dailyLog.attach"
  | "familyRoster.manage"
  | "activityCatalog.manage"
  | "circle.view"
  | "circle.manage"
  | "circle.teach"
  | "circle.notes.supervise"
  | "guardianLink.manage"
  | "exam.manage"
  | "exam.take"
  | "duties.own"
  | "duties.manage"
  | "library.own"
  | "library.manage"
  | "meetings.view"
  | "meetings.manage"
  | "committees.view"
  | "committees.manage"
  | "committee.own"
  | "visit.conduct"
  | "visit.approve"
  | "visit.view"
  | "finance.view"
  | "finance.entry"
  | "finance.approve"
  | "finance.supervise"
  | "finance.payout"
  | "ledger.journal.entry"
  | "finance.import"
  | "finance.reconcile"
  | "finance.export"
  | "budget.manage"
  | "payroll.view"
  | "payroll.own"
  | "payroll.run"
  | "payroll.approve"
  | "incentive.manage"
  | "box.view"
  | "box.receive"
  | "box.spend"
  | "box.handover"
  | "box.handover.acknowledge"
  | "box.closing.submit"
  | "box.closing.approve"
  | "mosqueFinance.view"
  | "mosqueFinance.manage"
  | "custody.view"
  | "custody.grant"
  | "custody.own"
  | "asset.manage"
  | "media.hub"
  | "media.post"
  | "competition.view"
  | "competition.manage"
  | "competition.enroll.approve"
  | "competition.score.record"
  | "announcement.publish"
  | "users.provision"
  | "user.manage"
  | "user.role.grant.elevated"
  | "registration.approve"
  | "account.status.manage"
  | "account.password.reset"
  | "account.self"
  | "orgUnit.manage"
  | "orgUnit.manage.root"
  | "admin.view"
  | "permissions.manage"
  | "settings.view"
  | "settings.manage"
  | "audit.view"
  | "featureFlag.manage"
  | "support.impersonate_read"
  | "system.jobs.run"
  | "competition.result.declare"

export type CapType = "scoped" | "personal" | "root"
export type CapScopeKind = "subtree" | "exact" | "below" | "root" | "personal"

export type CapabilityMeta = {
  readonly no: number
  readonly ar: string
  readonly type: CapType
  readonly scopeKind: CapScopeKind
  readonly module: string
}

export const CAPS: Readonly<Record<CapId, CapabilityMeta>> = Object.freeze({
  "network.view": { no: 1, ar: "عرض الشبكة والتنقل", type: "scoped", scopeKind: "subtree", module: "network" },
  "report.view": { no: 2, ar: "عرض التقارير", type: "scoped", scopeKind: "subtree", module: "network" },
  "report.submit": { no: 3, ar: "تقديم تقرير الوحدة", type: "scoped", scopeKind: "exact", module: "network" },
  "report.approve": { no: 4, ar: "اعتماد/رفض عمل الأقرب", type: "scoped", scopeKind: "below", module: "network" },
  "report.approve.override": { no: 5, ar: "التدخل الفوقي", type: "scoped", scopeKind: "below", module: "network" },
  "approve.breakGlass": { no: 6, ar: "كسر الزجاج عند الشغور الكامل", type: "root", scopeKind: "root", module: "network" },
  "report.retract": { no: 7, ar: "سحب الإقرار قبل الاعتماد", type: "scoped", scopeKind: "exact", module: "network" },
  "report.export": { no: 8, ar: "تصدير التقارير والرولّ-أب", type: "scoped", scopeKind: "subtree", module: "network" },
  "records.editLocked": { no: 9, ar: "تعديل أسبوع مقفل", type: "scoped", scopeKind: "subtree", module: "network" },
  "records.correct": { no: 10, ar: "التعديل التصحيحي المحكوم", type: "root", scopeKind: "root", module: "network" },
  "dailyLog.view": { no: 11, ar: "عرض سجل اليوم", type: "scoped", scopeKind: "subtree", module: "dailyLog" },
  "dailyLog.edit": { no: 12, ar: "إدخال سجل اليوم", type: "scoped", scopeKind: "exact", module: "dailyLog" },
  "dailyLog.attach": { no: 13, ar: "رفع صور التوثيق", type: "scoped", scopeKind: "exact", module: "dailyLog" },
  "familyRoster.manage": { no: 14, ar: "ضبط عدد طلاب الأسرة", type: "scoped", scopeKind: "exact", module: "dailyLog" },
  "activityCatalog.manage": { no: 15, ar: "إدارة كتالوج الأنشطة وأوزانها", type: "root", scopeKind: "root", module: "dailyLog" },
  "circle.view": { no: 16, ar: "عرض الحلقات وسجلاتها", type: "scoped", scopeKind: "subtree", module: "circles" },
  "circle.manage": { no: 17, ar: "إنشاء الحلقات وإدارتها وسجلها اليومي", type: "scoped", scopeKind: "exact", module: "circles" },
  "circle.teach": { no: 18, ar: "حلقاتي (المعلم)", type: "personal", scopeKind: "personal", module: "circles" },
  "circle.notes.supervise": { no: 19, ar: "ملاحظات الإشراف على الحلقة", type: "scoped", scopeKind: "subtree", module: "circles" },
  "guardianLink.manage": { no: 20, ar: "إصدار وتجديد رابط وليّ الأمر", type: "scoped", scopeKind: "exact", module: "circles" },
  "exam.manage": { no: 21, ar: "إنشاء الاختبارات والواجبات", type: "scoped", scopeKind: "subtree", module: "circles" },
  "exam.take": { no: 22, ar: "تسليم اختباري", type: "personal", scopeKind: "personal", module: "circles" },
  "duties.own": { no: 23, ar: "المطلوب مني", type: "personal", scopeKind: "personal", module: "activities" },
  "duties.manage": { no: 24, ar: "إنشاء النشاطات ومتابعتها", type: "scoped", scopeKind: "subtree", module: "activities" },
  "library.own": { no: 25, ar: "مكتبتي", type: "personal", scopeKind: "personal", module: "activities" },
  "library.manage": { no: 26, ar: "إدارة الموادّ ومصفوفة المتابعة", type: "scoped", scopeKind: "subtree", module: "activities" },
  "meetings.view": { no: 27, ar: "عرض الاجتماعات والقرارات", type: "scoped", scopeKind: "subtree", module: "meetings" },
  "meetings.manage": { no: 28, ar: "تسجيل المحاضر والقرارات", type: "scoped", scopeKind: "exact", module: "meetings" },
  "committees.view": { no: 29, ar: "عرض اللجان وخططها", type: "scoped", scopeKind: "subtree", module: "meetings" },
  "committees.manage": { no: 30, ar: "تشكيل اللجان وتعيين مسؤوليها", type: "scoped", scopeKind: "exact", module: "meetings" },
  "committee.own": { no: 31, ar: "لجنتي", type: "personal", scopeKind: "personal", module: "meetings" },
  "visit.conduct": { no: 32, ar: "تنفيذ زيارة إشرافية", type: "scoped", scopeKind: "subtree", module: "supervision" },
  "visit.approve": { no: 33, ar: "اعتماد زيارة", type: "scoped", scopeKind: "below", module: "supervision" },
  "visit.view": { no: 34, ar: "العرض القيادي للزيارات", type: "scoped", scopeKind: "subtree", module: "supervision" },
  "finance.view": { no: 35, ar: "عرض الملف المالي", type: "scoped", scopeKind: "subtree", module: "finance" },
  "finance.entry": { no: 36, ar: "إدخال الحركات (مُدخِل)", type: "scoped", scopeKind: "subtree", module: "finance" },
  "finance.approve": { no: 37, ar: "اعتماد الصرف (معتمِد)", type: "scoped", scopeKind: "subtree", module: "finance" },
  "finance.supervise": { no: 38, ar: "الاعتماد الثنائي (البتّ في المقترحات)", type: "scoped", scopeKind: "subtree", module: "finance" },
  "finance.payout": { no: 39, ar: "تسجيل الصرف", type: "scoped", scopeKind: "subtree", module: "finance" },
  "ledger.journal.entry": { no: 40, ar: "القيد المحاسبي اليدوي", type: "scoped", scopeKind: "subtree", module: "finance" },
  "finance.import": { no: 41, ar: "الاستيراد والرصيد الافتتاحي", type: "scoped", scopeKind: "subtree", module: "finance" },
  "finance.reconcile": { no: 42, ar: "المطابقة البنكية", type: "scoped", scopeKind: "subtree", module: "finance" },
  "finance.export": { no: 43, ar: "تصدير الملف المالي", type: "scoped", scopeKind: "subtree", module: "finance" },
  "budget.manage": { no: 44, ar: "وضع الموازنات", type: "scoped", scopeKind: "subtree", module: "finance" },
  "payroll.view": { no: 45, ar: "عرض كشوف الرواتب", type: "scoped", scopeKind: "subtree", module: "finance" },
  "payroll.own": { no: 46, ar: "كشف راتبي", type: "personal", scopeKind: "personal", module: "finance" },
  "payroll.run": { no: 47, ar: "احتساب المستحقات الشهرية", type: "scoped", scopeKind: "subtree", module: "finance" },
  "payroll.approve": { no: 48, ar: "إقرار الإدارة آخر الشهر", type: "scoped", scopeKind: "subtree", module: "finance" },
  "incentive.manage": { no: 49, ar: "الحوافز الاستثنائية", type: "scoped", scopeKind: "subtree", module: "finance" },
  "box.view": { no: 50, ar: "عرض الصندوق", type: "scoped", scopeKind: "subtree", module: "box" },
  "box.receive": { no: 51, ar: "قبض (متعدد العملات)", type: "scoped", scopeKind: "exact", module: "box" },
  "box.spend": { no: 52, ar: "صرف بفئة مغلقة", type: "scoped", scopeKind: "exact", module: "box" },
  "box.handover": { no: 53, ar: "تسليم نازل", type: "scoped", scopeKind: "exact", module: "box" },
  "box.handover.acknowledge": { no: 54, ar: "إقرار الاستلام", type: "personal", scopeKind: "personal", module: "box" },
  "box.closing.submit": { no: 55, ar: "رفع الإقفال الدوري", type: "scoped", scopeKind: "exact", module: "box" },
  "box.closing.approve": { no: 56, ar: "اعتماد الإقفال", type: "scoped", scopeKind: "below", module: "box" },
  "mosqueFinance.view": { no: 57, ar: "عرض مالية المسجد", type: "scoped", scopeKind: "subtree", module: "mosqueFinance" },
  "mosqueFinance.manage": { no: 58, ar: "تبرعات ومصروفات المسجد", type: "scoped", scopeKind: "exact", module: "mosqueFinance" },
  "custody.view": { no: 59, ar: "عُهد نطاقي (اطّلاع)", type: "scoped", scopeKind: "subtree", module: "custody" },
  "custody.grant": { no: 60, ar: "تسليم/نقل/استرداد العهدة", type: "scoped", scopeKind: "subtree", module: "custody" },
  "custody.own": { no: 61, ar: "عُهدتي والإقرار بالاستلام", type: "personal", scopeKind: "personal", module: "custody" },
  "asset.manage": { no: 62, ar: "سجل الأصل ومحاسبته", type: "scoped", scopeKind: "subtree", module: "custody" },
  "media.hub": { no: 63, ar: "مركز الإعلام والمعرض", type: "scoped", scopeKind: "subtree", module: "media" },
  "media.post": { no: 64, ar: "نشر تغطية وحذفها", type: "personal", scopeKind: "personal", module: "media" },
  "competition.view": { no: 65, ar: "عرض المسابقة", type: "scoped", scopeKind: "subtree", module: "competition" },
  "competition.manage": { no: 66, ar: "إنشاء المسابقة وضبط فئاتها ومراحلها وكتالوج تنقيطها", type: "scoped", scopeKind: "subtree", module: "competition" },
  "competition.enroll.approve": { no: 67, ar: "الموافقة على مشترك", type: "scoped", scopeKind: "exact", module: "competition" },
  "competition.score.record": { no: 68, ar: "رصد نقاط المشتركين", type: "scoped", scopeKind: "exact", module: "competition" },
  "announcement.publish": { no: 69, ar: "نشر إعلان لنطاق", type: "scoped", scopeKind: "subtree", module: "announcement" },
  "users.provision": { no: 70, ar: "توفير حسابات وحدتي", type: "scoped", scopeKind: "subtree", module: "identity" },
  "user.manage": { no: 71, ar: "تعديل المستخدمين والتكاليف وإنهاؤها", type: "scoped", scopeKind: "subtree", module: "identity" },
  "user.role.grant.elevated": { no: 72, ar: "منح الأدوار العليا", type: "root", scopeKind: "root", module: "identity" },
  "registration.approve": { no: 73, ar: "بتّ طلبات الانضمام", type: "scoped", scopeKind: "subtree", module: "identity" },
  "account.status.manage": { no: 74, ar: "تجميد/إلغاء/تفعيل الحساب", type: "scoped", scopeKind: "subtree", module: "identity" },
  "account.password.reset": { no: 75, ar: "إعادة تعيين كلمة مرور", type: "scoped", scopeKind: "subtree", module: "identity" },
  "account.self": { no: 76, ar: "ملفي وكلمة مروري والتحقق الثنائي", type: "personal", scopeKind: "personal", module: "identity" },
  "orgUnit.manage": { no: 77, ar: "إنشاء الوحدات ونقلها وأرشفتها", type: "scoped", scopeKind: "subtree", module: "identity" },
  "orgUnit.manage.root": { no: 78, ar: "إنشاء/تعديل الوحدات الجذرية والأقسام", type: "root", scopeKind: "root", module: "identity" },
  "admin.view": { no: 79, ar: "عرض التهيئة", type: "scoped", scopeKind: "subtree", module: "governance" },
  "permissions.manage": { no: 80, ar: "منح/حجب القدرات (التجاوزات)", type: "scoped", scopeKind: "subtree", module: "governance" },
  "settings.view": { no: 81, ar: "عرض سجل الإعدادات", type: "scoped", scopeKind: "subtree", module: "governance" },
  "settings.manage": { no: 82, ar: "ضبط الإعدادات الحية", type: "scoped", scopeKind: "subtree", module: "governance" },
  "audit.view": { no: 83, ar: "عرض سجل التدقيق", type: "scoped", scopeKind: "subtree", module: "governance" },
  "featureFlag.manage": { no: 84, ar: "مفاتيح التفعيل", type: "root", scopeKind: "root", module: "governance" },
  "support.impersonate_read": { no: 85, ar: "الانتحال القرائي للدعم", type: "root", scopeKind: "root", module: "governance" },
  "system.jobs.run": { no: 86, ar: "تشغيل المجدولات يدوياً", type: "root", scopeKind: "root", module: "governance" },
  "competition.result.declare": { no: 87, ar: "التأهيل وإعلان الفائزين وإغلاق المسابقة", type: "scoped", scopeKind: "subtree", module: "competition" },
})

export const CAP_IDS: readonly CapId[] = Object.freeze(Object.keys(CAPS) as CapId[])
