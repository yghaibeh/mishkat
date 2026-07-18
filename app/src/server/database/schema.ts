import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

// الوحدة التنظيمية — شجرة واحدة بالمسار المادّي (Materialized Path)
// path مثل: /idlib/bloc-north/sq-1/m-farouq/  — يدعم استعلام «كل ما تحت نطاقي» بـ LIKE
export const orgUnits = sqliteTable('org_units', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'),
  path: text('path').notNull(),
  type: text('type').notNull(),            // section | rabita | square | mosque | halaqa
  // القسم — بُعدٌ أوّل يقسم الشجرة (ذكور/نساء)؛ يُورَّث للأبناء ويُعزل تمامًا تحت الإدارة العليا
  section: text('section').notNull().default('men'), // men | women
  genderTrack: text('gender_track').notNull().default('male'), // male | female — لاختيار مخطط الأنشطة
  name: text('name').notNull(),
  city: text('city'),
  // الموقع الجغرافي الإداري (من قائمة سوريا) — رموز من lib/syria-regions.ts
  governorate: text('governorate'),       // رمز المحافظة (مثل idlib)
  district: text('district'),             // رمز المنطقة/القضاء (مثل harem)
  status: text('status').notNull().default('active'),
  familyStudents: integer('family_students'),   // طلاب الأسرة المسجّلون (مرجع عتبة الالتزام 0047)
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  pathIdx: index('idx_org_units_path').on(t.path),
  parentIdx: index('idx_org_units_parent').on(t.parentId),
  govIdx: index('idx_org_units_gov').on(t.governorate),
}))

// حلقات المسجد — المسجد الواحد قد يحوي عدة حلقات بأنواع مختلفة (lib/circles.ts)
export const circles = sqliteTable('circles', {
  id: text('id').primaryKey(),
  mosqueId: text('mosque_id').notNull(),
  type: text('type').notNull(),                 // tahfeez | rashidi | ala_baseera | ilmiyya (0048)
  genderTrack: text('gender_track').notNull().default('male'),
  name: text('name').notNull(),
  teacherPersonId: text('teacher_person_id'),   // مسؤول/معلّم الحلقة (اختياري)
  capacity: integer('capacity'),
  notes: text('notes'),
  status: text('status').notNull().default('active'), // active | archived
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  mosqueIdx: index('idx_circles_mosque').on(t.mosqueId),
  typeIdx: index('idx_circles_type').on(t.type),
}))

// طلاب الحلقة — أسماء نصّية حرّة (ليسوا بالضرورة مستخدمين — خصوصية)
export const circleStudents = sqliteTable('circle_students', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull(),
  name: text('name').notNull(),
  personId: text('person_id'),         // هوية الطالب المعتمَد ذاتيًّا (0040) — اختياري
  notes: text('notes'),
  status: text('status').notNull().default('active'), // active | left
  createdAt: integer('created_at').notNull(),
}, (t) => ({ circleIdx: index('idx_cstudent_circle').on(t.circleId) }))

// التسجيل الذاتيّ الهرميّ (0040، وثيقة ٢٦ §١) — لا حساب قبل الاعتماد؛ الاعتماد ينشئ الهيكلية ذرّيًّا
export const registrationRequests = sqliteTable('registration_requests', {
  id: text('id').primaryKey(),                  // uuid = رمز المتابعة العامّ
  kind: text('kind').notNull(),                 // student | teacher | amir | square | rabita
  fullName: text('full_name').notNull(),
  gender: text('gender').notNull().default('male'),
  login: text('login').notNull(),
  passwordHash: text('password_hash').notNull(),
  phone: text('phone'),
  targetUnitId: text('target_unit_id'),
  targetPath: text('target_path'),
  proposedUnitName: text('proposed_unit_name'),
  proposedParentId: text('proposed_parent_id'),
  circleId: text('circle_id'),
  note: text('note'),
  status: text('status').notNull().default('pending'), // pending | approved | rejected
  decidedBy: text('decided_by'),
  decidedByName: text('decided_by_name'),
  decidedAt: integer('decided_at'),
  rejectReason: text('reject_reason'),
  createdUnitId: text('created_unit_id'),
  createdPersonId: text('created_person_id'),
  createdUserId: text('created_user_id'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  statusIdx: index('idx_regreq_status').on(t.status),
  loginIdx: index('idx_regreq_login').on(t.login),
  targetIdx: index('idx_regreq_target').on(t.targetPath),
}))

// الشخص — قد يكون أميراً/عضواً/معلّماً/مشتركاً
export const persons = sqliteTable('persons', {
  id: text('id').primaryKey(),
  fullName: text('full_name').notNull(),
  gender: text('gender').notNull(),        // male | female
  birthYearHijri: integer('birth_year_hijri'),
  homeOrgUnitId: text('home_org_unit_id'),
  status: text('status').notNull().default('active'),   // active | disabled (موقوف) | deleted (ملغى ناعمًا)
  statusReason: text('status_reason'),                  // سبب التجميد/الإلغاء (يظهر للإدارة)
  statusChangedBy: text('status_changed_by'),
  statusChangedAt: integer('status_changed_at'),
  createdAt: integer('created_at').notNull(),
})

// بيانات الاتصال في جدول منفصل (خصوصية + صلاحيات أضيق)
export const personContacts = sqliteTable('person_contacts', {
  personId: text('person_id').primaryKey(),
  phone: text('phone'),
  telegram: text('telegram'),            // chat_id تيليغرام (رقميّ) بعد الربط
  guardianPhone: text('guardian_phone'),
  linkToken: text('link_token'),         // رمز ربطٍ مؤقّت (deep-link /start)
  linkExpires: integer('link_expires'),
})

// حساب الدخول
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull(),
  login: text('login').notNull(),
  passwordHash: text('password_hash').notNull(),
  lastLogin: integer('last_login'),
  mfaSecret: text('mfa_secret'),
  mfaEnabled: integer('mfa_enabled', { mode: 'boolean' }).notNull().default(false),
  sessionEpoch: integer('session_epoch').notNull().default(0), // يُرفَع ⇒ إبطالُ كلّ الجلسات القائمة فورًا
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  loginIdx: uniqueIndex('idx_users_login_uniq').on(t.login), // ق٣: فريدٌ حتمًا (كان غير فريد)
}))

// FR2.4 — اشتراكات Web Push (قناة مكمّلة للمتصفّح/PWA)
export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  endpointIdx: uniqueIndex('idx_push_endpoint').on(t.endpoint),
  personIdx: index('idx_push_person').on(t.personId),
}))

// تكليف بدور ضمن نطاق — مؤقت (له بداية ونهاية)، يدعم تعدد الأدوار للشخص
export const roleAssignments = sqliteTable('role_assignments', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull(),
  role: text('role').notNull(),            // انظر ROLES في utils/rbac.ts
  orgUnitId: text('org_unit_id').notNull(),
  orgPath: text('org_path').notNull(),     // منسوخ للتحقق السريع من النطاق
  portfolio: text('portfolio'),            // الحقيبة (لجنة/نائب/سر/صندوق…)
  startDate: integer('start_date'),
  endDate: integer('end_date'),
  termNumber: integer('term_number').notNull().default(1),
  approvalStatus: text('approval_status').notNull().default('approved'), // pending | approved
  approvedBy: text('approved_by'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  personIdx: index('idx_ra_person').on(t.personId),
  orgPathIdx: index('idx_ra_org_path').on(t.orgPath),
  orgUnitIdx: index('idx_ra_org_unit').on(t.orgUnitId),
}))

// المكتبة التدريبيّة (0041، وثيقة ٢٦ §ت) — موادّ مصنّفة بجمهورٍ مستهدفٍ وتتبّعٍ فرديّ
export const materials = sqliteTable('materials', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(),          // aqeedah|fiqh|seerah|tarbiya|admin_training|other
  kind: text('kind').notNull(),                  // pdf | audio | link
  r2Key: text('r2_key'),
  externalUrl: text('external_url'),
  contentType: text('content_type'),
  sizeBytes: integer('size_bytes'),
  description: text('description'),
  audience: text('audience').notNull().default('amir'), // amir | teacher | supervisor | all
  mandatory: integer('mandatory', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  status: text('status').notNull().default('active'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  statusIdx: index('idx_materials_status').on(t.status),
  audienceIdx: index('idx_materials_audience').on(t.audience),
}))

// تقدّم الفرد في المادّة: استلم → فتح → أنجز (إقرارٌ صريح)
export const materialProgress = sqliteTable('material_progress', {
  id: text('id').primaryKey(),
  materialId: text('material_id').notNull(),
  personId: text('person_id').notNull(),
  deliveredAt: integer('delivered_at'),
  openedAt: integer('opened_at'),
  completedAt: integer('completed_at'),
}, (t) => ({
  matIdx: index('idx_matprog_material').on(t.materialId),
  personIdx: index('idx_matprog_person').on(t.personId),
  uniq: uniqueIndex('idx_matprog_uniq').on(t.materialId, t.personId),
}))

// دروس/محاضرات المسجد (0042، وثيقة ٢٦ §د) — جدولةٌ بكشف تعارضٍ + حضور
export const mosqueLessons = sqliteTable('mosque_lessons', {
  id: text('id').primaryKey(),
  mosqueId: text('mosque_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  place: text('place'),
  startsAt: integer('starts_at').notNull(),
  durationMin: integer('duration_min').notNull().default(45),
  materialId: text('material_id'),
  status: text('status').notNull().default('scheduled'), // scheduled | confirmed | delivered | cancelled
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  mosqueIdx: index('idx_mlessons_mosque').on(t.mosqueId),
  startsIdx: index('idx_mlessons_starts').on(t.startsAt),
}))

export const mosqueLessonAttendance = sqliteTable('mosque_lesson_attendance', {
  id: text('id').primaryKey(),
  lessonId: text('lesson_id').notNull(),
  personId: text('person_id'),
  name: text('name').notNull(),
  present: integer('present', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  lessonIdx: index('idx_mlatt_lesson').on(t.lessonId),
  uniq: uniqueIndex('idx_mlatt_uniq').on(t.lessonId, t.name),
}))

// النشاطات والمتابعة (0043، وثيقة ٢٦ §ن) — «المطلوب منّي» للطالب ومتابعة الردود للمنشئ
export const activities = sqliteTable('activities', {
  id: text('id').primaryKey(),
  scopeKind: text('scope_kind').notNull(),   // circle | mosque
  scopeId: text('scope_id').notNull(),
  mosqueId: text('mosque_id'),
  title: text('title').notNull(),
  details: text('details'),
  dueAt: integer('due_at'),
  required: integer('required', { mode: 'boolean' }).notNull().default(true),
  status: text('status').notNull().default('active'), // active | closed
  createdBy: text('created_by').notNull(),
  createdByName: text('created_by_name'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  scopeIdx: index('idx_activities_scope').on(t.scopeKind, t.scopeId),
  mosqueIdx: index('idx_activities_mosque').on(t.mosqueId),
}))

export const activityResponses = sqliteTable('activity_responses', {
  id: text('id').primaryKey(),
  activityId: text('activity_id').notNull(),
  personId: text('person_id').notNull(),
  personName: text('person_name'),
  body: text('body').notNull(),
  submittedAt: integer('submitted_at').notNull(),
  reviewStatus: text('review_status').notNull().default('pending'), // pending | seen | accepted
  reviewedBy: text('reviewed_by'),
}, (t) => ({
  actIdx: index('idx_actresp_activity').on(t.activityId),
  personIdx: index('idx_actresp_person').on(t.personId),
  uniq: uniqueIndex('idx_actresp_uniq').on(t.activityId, t.personId),
}))

// الاختبارات والواجبات (0044، وثيقة ٢٦ §خ) — MCQ/صح-خطأ بتصحيحٍ آليّ
export const exams = sqliteTable('exams', {
  id: text('id').primaryKey(),
  scopeKind: text('scope_kind').notNull(),
  scopeId: text('scope_id').notNull(),
  mosqueId: text('mosque_id'),
  kind: text('kind').notNull().default('exam'), // exam | homework
  title: text('title').notNull(),
  description: text('description'),
  publishAt: integer('publish_at'),
  dueAt: integer('due_at'),
  status: text('status').notNull().default('draft'), // draft | published | closed
  createdBy: text('created_by').notNull(),
  createdByName: text('created_by_name'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  scopeIdx: index('idx_exams_scope').on(t.scopeKind, t.scopeId),
  statusIdx: index('idx_exams_status').on(t.status),
}))

export const examQuestions = sqliteTable('exam_questions', {
  id: text('id').primaryKey(),
  examId: text('exam_id').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  kind: text('kind').notNull(),        // mcq | tf
  text: text('text').notNull(),
  options: text('options'),            // JSON للاختيار من متعدّد
  correct: text('correct').notNull(),
  points: integer('points').notNull().default(1),
}, (t) => ({ examIdx: index('idx_examq_exam').on(t.examId) }))

export const examSubmissions = sqliteTable('exam_submissions', {
  id: text('id').primaryKey(),
  examId: text('exam_id').notNull(),
  personId: text('person_id').notNull(),
  personName: text('person_name'),
  answers: text('answers').notNull(),
  score: real('score').notNull().default(0),
  maxScore: real('max_score').notNull().default(0),
  submittedAt: integer('submitted_at').notNull(),
}, (t) => ({
  examIdx: index('idx_examsub_exam').on(t.examId),
  personIdx: index('idx_examsub_person').on(t.personId),
  uniq: uniqueIndex('idx_examsub_uniq').on(t.examId, t.personId),
}))

// العُهدة والأصول (0045، وثيقة ٢٦ §ع) — عُهدٌ شخصيّة ومركباتٌ بمصروفٍ شهريّ
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),        // personal_custody | vehicle | equipment
  name: text('name').notNull(),
  details: text('details'),
  orgUnitId: text('org_unit_id'),
  orgPath: text('org_path'),
  holderPersonId: text('holder_person_id'),
  holderName: text('holder_name'),
  status: text('status').notNull().default('active'), // active | returned | retired | damaged | lost
  condition: text('condition'),                      // new | good | fair | damaged (0076)
  custodySince: integer('custody_since'),             // متى صارت بيد حائزها الحاليّ (0076)
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  kindIdx: index('idx_assets_kind').on(t.kind),
  orgIdx: index('idx_assets_org').on(t.orgPath),
  holderIdx: index('idx_assets_holder').on(t.holderPersonId),
}))

// سلسلةُ حيازة العُهدة (0076): كلُّ تسليمٍ/إعادةٍ/بلاغٍ حدثٌ لا يُحذف — «من مَن، إلى مَن، متى،
// بأيّ حال، وبإقرار مَن». الإقرارُ (ack) بيد المستلم نفسِه كإقرار تسليم الصندوق.
export const assetCustody = sqliteTable('asset_custody', {
  id: text('id').primaryKey(),
  assetId: text('asset_id').notNull(),
  action: text('action').notNull(),
  fromPersonId: text('from_person_id'),
  fromName: text('from_name'),
  toPersonId: text('to_person_id'),
  toName: text('to_name'),
  condition: text('condition'),
  note: text('note'),
  at: integer('at').notNull(),
  byUserId: text('by_user_id'),
  ackAt: integer('ack_at'),
  ackBy: text('ack_by'),
}, (t) => ({
  assetIdx: index('idx_custody_asset').on(t.assetId),
  toIdx: index('idx_custody_to').on(t.toPersonId),
}))

export const assetExpenses = sqliteTable('asset_expenses', {
  id: text('id').primaryKey(),
  assetId: text('asset_id').notNull(),
  month: text('month').notNull(),      // YYYY-MM
  fuelAmount: real('fuel_amount').notNull().default(0),
  otherAmount: real('other_amount').notNull().default(0),
  note: text('note'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  assetIdx: index('idx_assetexp_asset').on(t.assetId),
  monthIdx: index('idx_assetexp_month').on(t.month),
  uniq: uniqueIndex('idx_assetexp_uniq').on(t.assetId, t.month),
}))

// إعلانات المنصّة (0046، وثيقة ٢٦ §ذ) — تصل جرس كلّ من في النطاق
export const announcements = sqliteTable('announcements', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  scopePath: text('scope_path').notNull().default('/'),
  audience: text('audience').notNull().default('all'), // all | leaders | students
  sentCount: integer('sent_count').notNull().default(0),
  createdBy: text('created_by'),
  createdByName: text('created_by_name'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ createdIdx: index('idx_announcements_created').on(t.createdAt) }))

// سجل التدقيق — لكل إنشاء/تعديل (من، متى، قبل/بعد)
export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  actorUserId: text('actor_user_id'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  before: text('before'),
  after: text('after'),
  at: integer('at').notNull(),
})

// ===== نظام النقاط (S3–S4) =====

// نوع النشاط — مجموعة مختلفة لكل مسار جنس (ق6)
export const activityTypes = sqliteTable('activity_types', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  genderTrack: text('gender_track').notNull(), // male | female
  category: text('category'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  // قواعد اللجنة (0047): سقفٌ يوميّ + عتبة مشاركةٍ مئويّة من طلاب الأسرة (الصلوات: 1 و70٪)
  maxPerDay: integer('max_per_day'),
  minParticipationPct: integer('min_participation_pct'),
})

// إصدار مخطط النقاط — مستقل لكل مسار جنس، versioned (ق2/ق6)
export const pointsSchemes = sqliteTable('points_schemes', {
  id: text('id').primaryKey(),
  genderTrack: text('gender_track').notNull(),
  weeklyTarget: integer('weekly_target').notNull().default(70),
  validFrom: integer('valid_from').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

export const pointsSchemeItems = sqliteTable('points_scheme_items', {
  id: text('id').primaryKey(),
  schemeId: text('scheme_id').notNull(),
  activityTypeId: text('activity_type_id').notNull(),
  points: integer('points').notNull(),
}, (t) => ({ schemeIdx: index('idx_psi_scheme').on(t.schemeId) }))

// السجل الأسبوعي لمسجد — الأسبوع يبدأ السبت (weekStart = YYYY-MM-DD)
export const weeklyRecords = sqliteTable('weekly_records', {
  id: text('id').primaryKey(),
  mosqueId: text('mosque_id').notNull(),
  mosquePath: text('mosque_path').notNull(),
  unitId: text('unit_id'),           // الوحدة المُدخِلة (مسجد أو حلقة نسائية) — المصدر الموحّد
  unitPath: text('unit_path'),
  weekStart: text('week_start').notNull(),
  hijriMonth: text('hijri_month'),
  schemeId: text('scheme_id').notNull(),
  totalPoints: integer('total_points').notNull().default(0),
  status: text('status').notNull().default('draft'), // draft | amir_approved | layer_approved
  locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
  lockedAt: integer('locked_at'),
  lastEntryAt: integer('last_entry_at'),
  approvedByAmir: text('approved_by_amir'),
  approvedByLayer: text('approved_by_layer'),
  amirApprovedAt: integer('amir_approved_at'),
  rejectedByLayer: text('rejected_by_layer'),
  rejectionReason: text('rejection_reason'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  mosqueWeekIdx: index('idx_wr_mosque_week').on(t.mosqueId, t.weekStart),
  weekIdx: index('idx_wr_week').on(t.weekStart),
}))

// الإدخال اليومي — قلب النظام، يدعم المزامنة دون اتصال (client_uuid)
export const dailyEntries = sqliteTable('daily_entries', {
  id: text('id').primaryKey(),
  clientUuid: text('client_uuid').notNull(),
  weeklyRecordId: text('weekly_record_id').notNull(),
  mosqueId: text('mosque_id').notNull(),
  unitId: text('unit_id'),           // الوحدة المُدخِلة (مسجد أو حلقة نسائية)
  weekStart: text('week_start').notNull(),
  day: text('day').notNull(),               // sat | sun | mon | tue | wed | thu | fri
  activityTypeId: text('activity_type_id').notNull(),
  count: integer('count').notNull().default(0),
  points: integer('points').notNull().default(0), // لقطة محسوبة خادمياً
  note: text('note'),
  participantCount: integer('participant_count').notNull().default(1), // عدد أفراد الأسرة المشاركين
  shuraConfirmed: integer('shura_confirmed', { mode: 'boolean' }).notNull().default(false),
  enteredBy: text('entered_by'),            // user id
  enteredByCommittee: text('entered_by_committee'), // الحقيبة إن أدخلتها لجنة (ق1)
  recordedAt: integer('recorded_at').notNull(),
  syncedAt: integer('synced_at').notNull(),
}, (t) => ({
  clientUuidIdx: uniqueIndex('idx_de_client_uuid_uniq').on(t.clientUuid), // ق٣
  naturalIdx: uniqueIndex('idx_de_natural_uniq').on(t.weeklyRecordId, t.day, t.activityTypeId), // ق٣
  recordIdx: index('idx_de_record').on(t.weeklyRecordId),
}))

// إصدار المعدّل المالي — موحّد، versioned، بأثر قادم فقط (ق2-ب/ق2-ج)
export const rateSchemes = sqliteTable('rate_schemes', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),             // point_rate | fixed_salary | hourly_rate
  amount: real('amount').notNull(),         // مثال point_rate: 50
  perUnit: integer('per_unit'),             // مثال: 280 (نقطة) → المعدّل = amount / perUnit
  currency: text('currency').notNull().default('USD'),
  validFrom: integer('valid_from').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

// ===== المالية (المرحلة 2) =====

// المستحق الشهري للشخص — يجمع مسارات أوصافه (مقطوع/نقاط/ساعات) — ق8
export const monthlyEntitlements = sqliteTable('monthly_entitlements', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull(),
  month: text('month').notNull(),            // شهر هجري مثل 1447-12
  grossAmount: real('gross_amount').notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  status: text('status').notNull().default('proposed'), // proposed | approved | paid
  approvedBy: text('approved_by'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ personMonthIdx: index('idx_ent_person_month').on(t.personId, t.month) }))

// تفصيل مسار داخل المستحق
export const entitlementTracks = sqliteTable('entitlement_tracks', {
  id: text('id').primaryKey(),
  entitlementId: text('entitlement_id').notNull(),
  kind: text('kind').notNull(),              // fixed | points | hours
  basis: real('basis'),                      // عدد النقاط/الساعات (null للمقطوع)
  rate: real('rate'),                        // المعدّل لكل وحدة / مبلغ المقطوع
  amount: real('amount').notNull(),
  sourceRef: text('source_ref'),
}, (t) => ({ entIdx: index('idx_track_ent').on(t.entitlementId) }))

// تحفيز تشغيلي اختياري (ق9-ب) — لا يوجد كيان خصم (ق4-ب)
export const incentives = sqliteTable('incentives', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull(),    // مهمل عملياً — قد يكون "" للإدخال الحرّ
  recipientName: text('recipient_name'),    // اسم المستفيد النصّي (خصوصية)
  month: text('month').notNull(),
  reason: text('reason'),
  amount: real('amount').notNull(),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
})

// الصرف الفعلي — المبلغ المصروف يُكتب يدوياً (ق7)
export const payouts = sqliteTable('payouts', {
  id: text('id').primaryKey(),
  entitlementId: text('entitlement_id').notNull(),
  netAmount: real('net_amount').notNull(),
  paidAmount: real('paid_amount').notNull(),
  reference: text('reference'),
  recordedBy: text('recorded_by'),
  paidAt: integer('paid_at').notNull(),
})

// ===== وحدة «على بصيرة» (المرحلة 3) =====

// مكان انعقاد الحلقات — مسجد/معهد/بيت. المعهد مجرد مكان لا كيان إداري (ق9-ب)
export const venues = sqliteTable('venues', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),            // mosque | institute | home
  name: text('name').notNull(),
  orgUnitId: text('org_unit_id'),          // ربط اختياري بالشجرة
  genderTrack: text('gender_track').notNull().default('male'),
  createdAt: integer('created_at').notNull(),
})

// معلّم «على بصيرة» — يُحاسَب بالساعة (ق8)
export const teachers = sqliteTable('teachers', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull(),
  qualification: text('qualification'),
  hourlyRateId: text('hourly_rate_id'),    // إصدار سعر الساعة الساري
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
})

// الحلقة
export const halaqat = sqliteTable('halaqat', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  venueId: text('venue_id').notNull(),
  teacherId: text('teacher_id').notNull(),
  genderTrack: text('gender_track').notNull().default('male'),
  curriculum: text('curriculum').notNull().default('baseera'), // baseera | tahfeez | rashidi | general — المالية لـbaseera فقط
  capacity: integer('capacity').notNull().default(30),
  status: text('status').notNull().default('active'), // active | archived
  createdAt: integer('created_at').notNull(),
}, (t) => ({ teacherIdx: index('idx_halaqa_teacher').on(t.teacherId) }))

// تسجيل طالب في حلقة
export const enrollments = sqliteTable('enrollments', {
  id: text('id').primaryKey(),
  halaqaId: text('halaqa_id').notNull(),
  personId: text('person_id').notNull(),       // قد يكون "" للإدخال الحرّ (طلاب حلقات المدرّس — خصوصية)
  studentName: text('student_name'),           // اسم نصّي حرّ حين لا يكون الطالب مستخدماً في النظام
  status: text('status').notNull().default('active'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ halaqaIdx: index('idx_enroll_halaqa').on(t.halaqaId) }))

// جلسة درس — أساس المحاسبة بالساعة
export const lessonSessions = sqliteTable('lesson_sessions', {
  id: text('id').primaryKey(),
  halaqaId: text('halaqa_id').notNull(),
  teacherId: text('teacher_id').notNull(),
  dateHijri: text('date_hijri'),
  hijriMonth: text('hijri_month'),         // للتجميع المالي الشهري
  lessonTitle: text('lesson_title'),
  majlis: text('majlis'),                  // موضعه بالمنهج (~20 مجلساً/6 أقسام)
  durationHours: real('duration_hours').notNull().default(0),
  materials: text('materials'),
  attendanceCount: integer('attendance_count'),     // عدد الطلاب الحاضرين (بلا أسماء)
  selfEval: integer('self_eval'),                    // تقييم الدرس من وجهة نظر المعلّم (١-٥)
  companionActivities: text('companion_activities'), // النشاطات المصاحبة للدرس
  status: text('status').notNull().default('recorded'), // recorded | approved | rejected
  rejectionReason: text('rejection_reason'),         // سبب الرفض من المدير/المشرف
  approvedBy: text('approved_by'),                    // معرّف مَن اعتمد (يظهر اسمه في السجل)
  clientUuid: text('client_uuid'),                    // معرّف العميل الثابت (idempotency للعمل دون اتصال)
  createdAt: integer('created_at').notNull(),
}, (t) => ({ teacherMonthIdx: index('idx_ls_teacher_month').on(t.teacherId, t.hijriMonth) }))

// مرفقات الدرس (صور توثيقية) — تُخزَّن في Cloudflare R2
export const lessonAttachments = sqliteTable('lesson_attachments', {
  id: text('id').primaryKey(),
  lessonSessionId: text('lesson_session_id').notNull(),
  r2Key: text('r2_key').notNull(),
  caption: text('caption'),
  contentType: text('content_type'),
  clientUuid: text('client_uuid'),       // idempotency للرفع دون اتصال
  createdAt: integer('created_at').notNull(),
}, (t) => ({ lessonIdx: index('idx_lesson_att_lesson').on(t.lessonSessionId) }))

// التغطية الإعلاميّة (0075): سجلُّ حدثٍ له عنوانٌ ونوعٌ ووحدةٌ وتاريخُ وقوعٍ وناشر،
// وصورُه ألبومٌ في attachments بنطاق media_post وref_id = معرّفها.
export const mediaCoverages = sqliteTable('media_coverages', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  kind: text('kind').notNull(),
  orgUnitId: text('org_unit_id'),
  orgPath: text('org_path'),
  occurredAt: integer('occurred_at').notNull(),
  dateHijri: text('date_hijri'),
  body: text('body'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  orgIdx: index('idx_media_cov_org').on(t.orgPath),
  atIdx: index('idx_media_cov_at').on(t.occurredAt),
}))

// مرفقات عامّة (صور توثيقية) لأيّ كيان — تُخزَّن في Cloudflare R2.
// scope='daily_record' و refId=معرّف سجل الأسبوع: توثيق أنشطة اليوم لاطّلاع الإشراف والإعلام.
export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  scope: text('scope').notNull(),        // daily_record | ...
  refId: text('ref_id').notNull(),       // معرّف الكيان (سجل الأسبوع)
  r2Key: text('r2_key').notNull(),
  caption: text('caption'),
  contentType: text('content_type'),
  uploadedBy: text('uploaded_by'),       // معرّف المستخدم الرافع
  clientUuid: text('client_uuid'),       // idempotency للرفع دون اتصال
  createdAt: integer('created_at').notNull(),
}, (t) => ({ scopeRefIdx: index('idx_att_scope_ref').on(t.scope, t.refId) }))

// تقييم الطالب في درس — متابعة تربوية (بلا أثر مالي حالياً)
export const studentEvaluations = sqliteTable('student_evaluations', {
  id: text('id').primaryKey(),
  enrollmentId: text('enrollment_id').notNull(),
  lessonSessionId: text('lesson_session_id').notNull(),
  score: integer('score'),
  note: text('note'),
  externalActivities: text('external_activities'),  // نشاطات تربوية أداها الطالب خارج الحلقة
  createdAt: integer('created_at').notNull(),
})

// تقدّم الطالبة في المنهج (٦ أقسام/~٢٠ مجلسًا) — يُحدَّث آليًّا من الحضور + يدويًّا
export const curriculumProgress = sqliteTable('curriculum_progress', {
  id: text('id').primaryKey(),
  enrollmentId: text('enrollment_id').notNull(),
  manhajKey: text('manhaj_key').notNull(),
  status: text('status').notNull().default('completed'), // not_started | in_progress | completed
  rating: integer('rating'),
  source: text('source').notNull().default('auto'),      // auto | manual
  dateHijri: text('date_hijri'),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({ enrollMajlisIdx: index('idx_cp_enroll_majlis').on(t.enrollmentId, t.manhajKey), enrollIdx: index('idx_cp_enroll').on(t.enrollmentId) }))

// حضور الطالب/ة في درس — حاضر/غائب/مستأذن (كشف الحضور لسجل الحلقة النسائية)
export const lessonAttendance = sqliteTable('lesson_attendance', {
  id: text('id').primaryKey(),
  lessonSessionId: text('lesson_session_id').notNull(),
  enrollmentId: text('enrollment_id').notNull(),
  state: text('state').notNull(),          // present | absent | excused
  note: text('note'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  lessonIdx: index('idx_att_lesson').on(t.lessonSessionId),
  enrollIdx: index('idx_att_enroll').on(t.enrollmentId),
}))

// ===== المسابقة (المرحلة 4) =====

// المسابقة — إطار زمني هجري (رجب 1447 → رجب 1448)
export const competitions = sqliteTable('competitions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  startMonth: text('start_month'),         // 1447-07
  endMonth: text('end_month'),             // 1448-07
  qualificationMonth: text('qualification_month'), // شعبان
  prizePool: real('prize_pool'),
  status: text('status').notNull().default('active'), // active | qualifying | closed
  createdAt: integer('created_at').notNull(),
})

// البرنامج الشهري الإلزامي (تعبدي/علمي/مسابقات) — من خطة الاثني عشر شهراً
export const monthlyPrograms = sqliteTable('monthly_programs', {
  id: text('id').primaryKey(),
  competitionId: text('competition_id').notNull(),
  monthHijri: text('month_hijri').notNull(),
  track: text('track').notNull(),          // worship | knowledge | activities
  title: text('title').notNull(),
  maxPoints: integer('max_points').notNull().default(0),
}, (t) => ({ compIdx: index('idx_mp_comp').on(t.competitionId) }))

// المشترك — فرد 15–40 سنة، مرتبط بمسجد (شرط الدخول)
export const participants = sqliteTable('participants', {
  id: text('id').primaryKey(),
  competitionId: text('competition_id').notNull(),
  personId: text('person_id').notNull(),
  mosqueId: text('mosque_id').notNull(),
  ageAtRegistration: integer('age_at_registration'),
  status: text('status').notNull().default('active'), // active | withdrawn | qualified | winner
  createdAt: integer('created_at').notNull(),
}, (t) => ({ compIdx: index('idx_part_comp').on(t.competitionId) }))

// نقاط المشترك في نشاط شهري — مع حالة العذر (الأعذار المقبولة لا تؤثر — ملف المسابقة)
export const participantScores = sqliteTable('participant_scores', {
  id: text('id').primaryKey(),
  participantId: text('participant_id').notNull(),
  programId: text('program_id').notNull(),
  points: integer('points').notNull().default(0),
  excuseStatus: text('excuse_status').notNull().default('none'), // none | excused
  recordedBy: text('recorded_by'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ partIdx: index('idx_ps_part').on(t.participantId) }))

// الاختبارات المركزية الفصلية ونتائجها
export const centralExams = sqliteTable('central_exams', {
  id: text('id').primaryKey(),
  competitionId: text('competition_id').notNull(),
  title: text('title').notNull(),
  dateHijri: text('date_hijri'),
  maxScore: integer('max_score').notNull().default(100),
  createdAt: integer('created_at').notNull(),
})

export const examResults = sqliteTable('exam_results', {
  id: text('id').primaryKey(),
  examId: text('exam_id').notNull(),
  participantId: text('participant_id').notNull(),
  score: integer('score').notNull().default(0),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ examIdx: index('idx_er_exam').on(t.examId) }))

// ===== دورة الإدارة / الحوكمة (المرحلة 5 — الباب الخامس) =====

// طلب استقالة من تكليف — يُبَتّ خلال شهر (الباب الخامس)
export const resignations = sqliteTable('resignations', {
  id: text('id').primaryKey(),
  roleAssignmentId: text('role_assignment_id').notNull(),
  personId: text('person_id').notNull(),
  reason: text('reason'),
  requestedAt: integer('requested_at').notNull(),
  decisionDeadline: integer('decision_deadline').notNull(), // requestedAt + 30 يوماً
  status: text('status').notNull().default('pending'),       // pending | accepted | rejected
  decidedBy: text('decided_by'),
  decidedAt: integer('decided_at'),
}, (t) => ({ raIdx: index('idx_resig_ra').on(t.roleAssignmentId) }))

// ===== المالية الداخلية للمسجد (المواد 23/35/36 — أمين الصندوق) =====
// منفصلة عن مستحقات المشروع المركزية؛ تبرعات الحي وميزانية المسجد.
export const donations = sqliteTable('donations', {
  id: text('id').primaryKey(),
  mosqueId: text('mosque_id').notNull(),
  donorName: text('donor_name'),
  amount: real('amount').notNull(),
  collectedBy: text('collected_by'),        // أمين الصندوق (أو بموافقة الأمير — المادة 36)
  approvedByAmir: integer('approved_by_amir', { mode: 'boolean' }).notNull().default(true),
  note: text('note'),
  fundId: text('fund_id').notNull().default('general'), // 0057: صندوق التبرّع
  donorId: text('donor_id'),                            // 0057: المانح (إن سُجّل)
  receiptNo: text('receipt_no'),                        // 0057: سند القبض المرقّم
  currency: text('currency'),                           // 0067: العملةُ الأصليّة (NULL = USD)
  origAmount: real('orig_amount'),                      // 0067: المبلغُ بالعملة الأصليّة
  at: integer('at').notNull(),
}, (t) => ({ mosqueIdx: index('idx_don_mosque').on(t.mosqueId), receiptIdx: index('idx_don_receipt').on(t.receiptNo) }))

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  mosqueId: text('mosque_id').notNull(),
  category: text('category'),
  amount: real('amount').notNull(),
  spentBy: text('spent_by'),
  note: text('note'),
  fundId: text('fund_id').notNull().default('general'), // 0057: صندوق المصروف (لضبط المقيّد)
  currency: text('currency'),                           // 0067: العملةُ الأصليّة (NULL = USD)
  origAmount: real('orig_amount'),                      // 0067: المبلغُ بالعملة الأصليّة
  at: integer('at').notNull(),
}, (t) => ({ mosqueIdx: index('idx_exp_mosque').on(t.mosqueId) }))

// ===== الاجتماعات والقرارات (المادة 18/22 — أمانة السر) =====
export const meetings = sqliteTable('meetings', {
  id: text('id').primaryKey(),
  mosqueId: text('mosque_id').notNull(),
  type: text('type').notNull().default('periodic'), // periodic | extraordinary
  calledBy: text('called_by'),
  scheduledAt: integer('scheduled_at').notNull(),
  memberCount: integer('member_count').notNull().default(0),
  minutes: text('minutes'),               // محضر/خلاصة ما جرى وما تُوصِّل إليه
  createdAt: integer('created_at').notNull(),
}, (t) => ({ mosqueIdx: index('idx_meet_mosque').on(t.mosqueId) }))

export const meetingAttendance = sqliteTable('meeting_attendance', {
  id: text('id').primaryKey(),
  meetingId: text('meeting_id').notNull(),
  personId: text('person_id').notNull(),
  present: integer('present', { mode: 'boolean' }).notNull().default(false),
}, (t) => ({ meetIdx: index('idx_att_meet').on(t.meetingId) }))

export const decisions = sqliteTable('decisions', {
  id: text('id').primaryKey(),
  meetingId: text('meeting_id').notNull(),
  title: text('title').notNull(),
  kind: text('kind').notNull().default('binding'), // binding (ملزمة) | advisory (معلمة)
  votesFor: integer('votes_for').notNull().default(0),
  votesAgainst: integer('votes_against').notNull().default(0),
  totalVoters: integer('total_voters').notNull().default(0),
  amirVoteFor: integer('amir_vote_for', { mode: 'boolean' }),
  result: text('result'),                          // passed | failed
  note: text('note'),
}, (t) => ({ meetIdx: index('idx_dec_meet').on(t.meetingId) }))

// ملاحظة: خطط اللجان السنوية (annual_plans/plan_items) أُزيلت — استُبدلت فعلياً بـcommittee_plans.

// ===== منهاج «على بصيرة» (محتوى تعليميّ ثابت — يُبذَر من book.json) =====
// بنية معماريّة: الشجرة (وحدات + عناوين) تُجلب خفيفةً؛ ومحتوى الدرس (blocks) يُجلب عند الطلب.
export const manhajUnits = sqliteTable('manhaj_units', {
  id: text('id').primaryKey(),
  ord: integer('ord').notNull().default(0),
  title: text('title').notNull(),
})

export const manhajLessons = sqliteTable('manhaj_lessons', {
  id: text('id').primaryKey(),
  unitId: text('unit_id').notNull(),
  ord: integer('ord').notNull().default(0),
  title: text('title').notNull(),
  subject: text('subject'),
  durationMin: integer('duration_min'),
  hadithCount: integer('hadith_count').notNull().default(0),
  quranCount: integer('quran_count').notNull().default(0),
  blocks: text('blocks').notNull(), // JSON: Block[] — محتوى الدرس
}, (t) => ({ unitIdx: index('idx_manhaj_lessons_unit').on(t.unitId) }))

// ===== حلقات التحفيظ (المادة 29، الباب السادس) =====
export const tahfeezCircles = sqliteTable('tahfeez_circles', {
  id: text('id').primaryKey(),
  mosqueId: text('mosque_id').notNull(),
  name: text('name').notNull(),
  teacherPersonId: text('teacher_person_id'),
  status: text('status').notNull().default('active'), // active | archived (0052 — مزامنة التوائم)
  createdAt: integer('created_at').notNull(),
})

export const tahfeezStudents = sqliteTable('tahfeez_students', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull(),
  personId: text('person_id').notNull(),  // (مهمَل للإدخال الجديد) — قد يكون فارغاً للأسماء النصّية
  studentName: text('student_name'),      // اسم الطالب نصّاً حرّاً (خصوصية)
  guardianToken: text('guardian_token'),   // رمز صفحة وليّ الأمر (0051)
  status: text('status').notNull().default('active'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ circleIdx: index('idx_ts_circle').on(t.circleId) }))

// المرحلة ب — سجلّ التحفيظ اليوميّ: جلسةٌ يوميّة للحلقة + سجلّ كلّ طالب فيها
export const tahfeezSessions = sqliteTable('tahfeez_sessions', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull(),
  dateHijri: text('date_hijri').notNull(),
  dayNo: integer('day_no'),
  mosqueId: text('mosque_id'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ circleDateIdx: uniqueIndex('idx_tsess_circle_date').on(t.circleId, t.dateHijri) }))

export const tahfeezDailyRecords = sqliteTable('tahfeez_daily_records', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  studentId: text('student_id').notNull(),
  attendance: text('attendance').notNull().default('present'), // present | absent | left | excused
  hifzScope: text('hifz_scope'), hifzFrom: integer('hifz_from'), hifzTo: integer('hifz_to'), hifzGrade: integer('hifz_grade'),
  hifzMode: text('hifz_mode'), hifzSurah: integer('hifz_surah'),          // surah|page + رقم السورة
  reviewScope: text('review_scope'), reviewFrom: integer('review_from'), reviewTo: integer('review_to'), reviewGrade: integer('review_grade'),
  reviewMode: text('review_mode'), reviewSurah: integer('review_surah'),
  tajweedGrade: integer('tajweed_grade'),
  companion: text('companion'), companionKind: text('companion_kind'),   // برنامج المصاحب أو 'other'
  note: text('note'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ sessStudentIdx: uniqueIndex('idx_tdr_session_student').on(t.sessionId, t.studentId), studentIdx: index('idx_tdr_student').on(t.studentId) }))

export const tahfeezProgress = sqliteTable('tahfeez_progress', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  scope: text('scope'),                  // سورة/جزء
  fromAyah: integer('from_ayah'),
  toAyah: integer('to_ayah'),
  rating: integer('rating'),
  dateHijri: text('date_hijri'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ studentIdx: index('idx_tp_student').on(t.studentId) }))

// ===== حلقات «على بصيرة» الأسبوعية التفصيلية =====
export const halaqaGroupActivities = sqliteTable('halaqa_group_activities', {
  id: text('id').primaryKey(),
  halaqaId: text('halaqa_id').notNull(),
  weekStart: text('week_start').notNull(),
  seq: integer('seq').notNull().default(1),  // حتى 5 أنشطة جماعية
  description: text('description').notNull(),
  dateHijri: text('date_hijri'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ halaqaIdx: index('idx_hga_halaqa').on(t.halaqaId) }))

export const weeklyHalaqaRecords = sqliteTable('weekly_halaqa_records', {
  id: text('id').primaryKey(),
  halaqaId: text('halaqa_id').notNull(),
  weekStart: text('week_start').notNull(),
  supervisorNotes: text('supervisor_notes'),
  adminNotes: text('admin_notes'),
  createdAt: integer('created_at').notNull(),
})

// ===== المرحلة أ — السجل الإشرافيّ على الحلقات (زيارة المشرف تُرفع للإدارة) =====
export const supervisionVisits = sqliteTable('supervision_visits', {
  id: text('id').primaryKey(),
  circleKind: text('circle_kind').notNull(),   // tahfeez | baseera
  circleRefId: text('circle_ref_id').notNull(),
  circleName: text('circle_name').notNull(),
  mosqueId: text('mosque_id'),
  unitPath: text('unit_path'),                 // مسار الحلقة (عرض/عزل)
  submitterPath: text('submitter_path'),       // مسار المشرف (توجيه الاعتماد للأعلى)
  visitedBy: text('visited_by').notNull(),
  visitedByName: text('visited_by_name'),
  visitDateHijri: text('visit_date_hijri'),
  monthlyVisitNo: integer('monthly_visit_no'),
  studentCount: integer('student_count'),
  finalScore: integer('final_score'),          // التقييم النهائيّ المئويّ
  notes: text('notes'),
  details: text('details'),                     // JSON بالحقول الخاصّة بالنوع
  status: text('status').notNull().default('draft'), // draft | submitted | approved
  approvedBy: text('approved_by'),
  approvedByName: text('approved_by_name'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({ visitedByIdx: index('idx_sv_visited_by').on(t.visitedBy), statusIdx: index('idx_sv_status').on(t.status), submitterIdx: index('idx_sv_submitter').on(t.submitterPath) }))

// ===== الإشعارات =====
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull(),
  channel: text('channel').notNull(),    // push | telegram | inapp
  kind: text('kind').notNull(),          // entry_reminder | term_ending | ...
  payload: text('payload'),
  status: text('status').notNull().default('queued'), // queued | sent | failed
  readAt: integer('read_at'),            // وقت قراءة الإشعار داخل الموقع (null = غير مقروء)
  createdAt: integer('created_at').notNull(),
  sentAt: integer('sent_at'),
}, (t) => ({ personIdx: index('idx_notif_person').on(t.personId) }))

// ===== تصلّب المصادقة =====
export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
  revoked: integer('revoked', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ hashIdx: index('idx_rt_hash').on(t.tokenHash) }))

export const authAttempts = sqliteTable('auth_attempts', {
  key: text('key').primaryKey(),         // login أو IP
  count: integer('count').notNull().default(0),
  windowStart: integer('window_start').notNull(),
})

// ===== الإعدادات العامة (مفتاح/قيمة) — أعلام تفعيل الوحدات وغيرها =====
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

// ===== اللجان (أسرة المسجد — المواد 24–33) =====
// لجان رئيسية/فرعية لكل مسجد، لكلٍّ مسؤول وخطة وأنشطة.
export const committees = sqliteTable('committees', {
  id: text('id').primaryKey(),
  mosqueId: text('mosque_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull().default('main'),       // main رئيسية | sub فرعية
  headPersonId: text('head_person_id'),               // (مهمَل) — كان يربط بشخص في النظام
  headName: text('head_name'),                        // اسم المسؤول كنصّ حرّ (ليس بالضرورة مستخدماً — خصوصية)
  status: text('status').notNull().default('active'), // active | archived
  createdAt: integer('created_at').notNull(),
}, (t) => ({ mosqueIdx: index('idx_comm_mosque').on(t.mosqueId) }))

export const committeePlans = sqliteTable('committee_plans', {
  id: text('id').primaryKey(),
  committeeId: text('committee_id').notNull(),
  title: text('title').notNull(),
  period: text('period'),                              // (مهمَل) وصف الفترة نصّاً
  recurring: integer('recurring', { mode: 'boolean' }).notNull().default(false), // مستمر يظهر كل الشهور
  monthHijri: text('month_hijri'),                     // الشهر الهجري المستهدَف 'YYYY-MM' (إن لم يكن مستمراً)
  status: text('status').notNull().default('planned'), // planned | done | cancelled
  note: text('note'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ commIdx: index('idx_plan_comm').on(t.committeeId) }))

// ===== تجاوزات الصلاحيات (RBAC قابل للتهيئة) =====
// منح/حجب قدرة لدور فوق الافتراضيات — يحرّرها المدير العام من المصفوفة.
export const permissionOverrides = sqliteTable('permission_overrides', {
  id: text('id').primaryKey(),
  role: text('role').notNull(),
  capability: text('capability').notNull(),
  effect: text('effect').notNull(),       // grant | revoke
  createdAt: integer('created_at').notNull(),
}, (t) => ({ roleCapIdx: index('idx_po_role_cap').on(t.role, t.capability) }))

// ===== المرحلة ٠: الأساس المحاسبيّ الخفيّ (دفترٌ مزدوجُ القيد، المال بالسنتات) — هجرة 0056 =====

// دليلُ الحسابات الهرميّ
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),                 // = الرمز المحاسبيّ (1110…)
  name: text('name').notNull(),
  type: text('type').notNull(),                // asset | liability | net_assets | income | expense
  parentId: text('parent_id'),
  normalBalance: text('normal_balance').notNull(), // debit | credit
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

// الصناديق (زكاة/صدقة/وقف/عامّ/مشاريع)
export const funds = sqliteTable('funds', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  restricted: integer('restricted', { mode: 'boolean' }).notNull().default(false),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
})

// الفتراتُ الماليّة (تُقفَل فيُمنع القيد فيها)
export const fiscalPeriods = sqliteTable('fiscal_periods', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  startsAt: integer('starts_at').notNull(),
  endsAt: integer('ends_at').notNull(),
  status: text('status').notNull().default('open'), // open | closed
  createdAt: integer('created_at').notNull(),
})

// قيدُ اليوميّة (رأسُ القيد المتوازن)
export const journalEntries = sqliteTable('journal_entries', {
  id: text('id').primaryKey(),
  entryDate: integer('entry_date').notNull(),
  dateHijri: text('date_hijri'),
  memo: text('memo'),
  source: text('source'),                      // donation|expense|payroll|payout|fuel|manual|reversal
  sourceRef: text('source_ref'),
  reversalOf: text('reversal_of'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ refIdx: index('idx_je_ref').on(t.source, t.sourceRef), dateIdx: index('idx_je_date').on(t.entryDate) }))

// سطورُ القيد (مدين/دائن بالسنتات — أحدهما صفر). currency/amountOrig مُذكِّرةٌ بالعملة الأصليّة (0066).
export const journalLines = sqliteTable('journal_lines', {
  id: text('id').primaryKey(),
  entryId: text('entry_id').notNull(),
  accountId: text('account_id').notNull(),
  fundId: text('fund_id').notNull(),
  debitCents: integer('debit_cents').notNull().default(0),
  creditCents: integer('credit_cents').notNull().default(0),
  currency: text('currency'),                 // NULL = الأساس (USD)
  amountOrig: integer('amount_orig'),         // بالوحدة الصغرى للعملة الأصليّة (مقدارٌ موجب)
  unitId: text('unit_id'),                    // ٠٠٧٣ «الصندوق»: بُعدُ الوحدة — رصيدُ صندوق كلّ وحدةٍ من الدفتر الواحد
}, (t) => ({ entryIdx: index('idx_jl_entry').on(t.entryId), accIdx: index('idx_jl_account').on(t.accountId), fundIdx: index('idx_jl_fund').on(t.fundId), unitIdx: index('idx_jl_unit').on(t.unitId) }))

// العملاتُ المدعومة + أسعارُ الصرف (تعدّد العملات، 0066)
export const currencies = sqliteTable('currencies', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  isBase: integer('is_base', { mode: 'boolean' }).notNull().default(false),
  cashAccount: text('cash_account').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
})
export const fxRates = sqliteTable('fx_rates', {
  id: text('id').primaryKey(),
  currency: text('currency').notNull(),
  rateToBase: real('rate_to_base').notNull(),
  effectiveAt: integer('effective_at').notNull(),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ curIdx: index('idx_fx_currency').on(t.currency, t.effectiveAt) }))

// محرّكُ الاعتماد الثنائيّ (0070): أفعالُ المسؤول الماليّ تُقترَح ولا تُنفَّذ إلا باعتماد المدير.
export const financeActions = sqliteTable('finance_actions', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  payload: text('payload').notNull(),            // JSON مُجمَّد
  summary: text('summary').notNull(),
  amountUsd: real('amount_usd').notNull().default(0),
  currency: text('currency'),
  origAmount: real('orig_amount'),
  status: text('status').notNull().default('pending'), // pending|approved|rejected|cancelled|executed|failed
  proposedBy: text('proposed_by').notNull(),
  proposedAt: integer('proposed_at').notNull(),
  decidedBy: text('decided_by'),
  decidedAt: integer('decided_at'),
  rejectReason: text('reject_reason'),
  executedAt: integer('executed_at'),
  resultRef: text('result_ref'),
  error: text('error'),
  resubmitOf: text('resubmit_of'),
  clientUuid: text('client_uuid').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  uqClient: uniqueIndex('uq_fa_client').on(t.clientUuid),
  statusIdx: index('idx_fa_status').on(t.status),
  proposerIdx: index('idx_fa_proposer').on(t.proposedBy, t.status),
  kindIdx: index('idx_fa_kind').on(t.kind),
}))
export const approvalPolicies = sqliteTable('approval_policies', {
  id: text('id').primaryKey(),
  role: text('role').notNull(),
  kind: text('kind').notNull().default('*'),
  mode: text('mode').notNull().default('approve'),
  thresholdUsd: real('threshold_usd').notNull().default(0),
}, (t) => ({ roleIdx: index('idx_pol_role').on(t.role) }))

// الاستيرادُ بالقوالب (0071): دفعةٌ ببصمة محتوًى + صفوفٌ بحالة تنفيذٍ ⇒ مستأنَفٌ لا يزدوج.
export const importBatches = sqliteTable('import_batches', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  filename: text('filename'),
  contentHash: text('content_hash').notNull(),
  rowCount: integer('row_count').notNull().default(0),
  totalUsd: real('total_usd').notNull().default(0),
  status: text('status').notNull().default('pending'), // pending|executing|done|failed
  executedRows: integer('executed_rows').notNull().default(0),
  meta: text('meta'),
  error: text('error'),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ uqHash: uniqueIndex('import_batches_kind_content_hash_unique').on(t.kind, t.contentHash), statusIdx: index('idx_imp_batches_status').on(t.status) }))
export const importRows = sqliteTable('import_rows', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').notNull(),
  rowNo: integer('row_no').notNull(),
  payload: text('payload').notNull(),
  status: text('status').notNull().default('pending'), // pending|done|failed
  resultRef: text('result_ref'),
  error: text('error'),
}, (t) => ({ uq: uniqueIndex('import_rows_batch_id_row_no_unique').on(t.batchId, t.rowNo), batchIdx: index('idx_imp_rows_batch').on(t.batchId, t.status) }))

// المطابقةُ البنكيّة/النقديّة (0068): وجودُ الصفّ = القيدُ مُطابَقٌ لهذا الحساب.
export const reconciliations = sqliteTable('reconciliations', {
  id: text('id').primaryKey(),
  entryId: text('entry_id').notNull(),
  accountId: text('account_id').notNull(),
  reconciledBy: text('reconciled_by'),
  reconciledAt: integer('reconciled_at').notNull(),
  note: text('note'),
}, (t) => ({ uq: uniqueIndex('uq_recon_entry_acc').on(t.entryId, t.accountId), accIdx: index('idx_recon_acc').on(t.accountId) }))


// المرحلة ١: المانحون والعدّادات المتسلسلة (0057)
export const donors = sqliteTable('donors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ nameIdx: index('idx_donors_name').on(t.name) }))

export const counters = sqliteTable('counters', {
  name: text('name').primaryKey(),
  value: integer('value').notNull().default(0),
})


// المرحلة ١: التعهّدات (0058)
export const pledges = sqliteTable('pledges', {
  id: text('id').primaryKey(),
  donorId: text('donor_id').notNull(),
  fundId: text('fund_id').notNull().default('general'),
  amount: real('amount').notNull(),
  fulfilled: real('fulfilled').notNull().default(0),
  dueAt: integer('due_at'),
  status: text('status').notNull().default('open'), // open | fulfilled | cancelled
  note: text('note'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ donorIdx: index('idx_pledge_donor').on(t.donorId), statusIdx: index('idx_pledge_status').on(t.status) }))


// المرحلة ٢: الموازنات (0059)
export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  period: text('period').notNull(),          // '1447' سنة أو '1447-12' شهر
  fundId: text('fund_id').notNull(),
  accountId: text('account_id').notNull().default(''), // '' = كلّ الصندوق
  amount: real('amount').notNull(),
  note: text('note'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ uniq: uniqueIndex('idx_budget_uniq').on(t.period, t.fundId, t.accountId) }))


// المرحلة ٣: مطالبات الصرف (0060)
export const expenseClaims = sqliteTable('expense_claims', {
  id: text('id').primaryKey(),
  mosqueId: text('mosque_id'),
  fundId: text('fund_id').notNull().default('general'),
  category: text('category'),
  amount: real('amount').notNull(),
  note: text('note'),
  status: text('status').notNull().default('pending'), // pending | approved | rejected
  requestedBy: text('requested_by').notNull(),
  requestedAt: integer('requested_at').notNull(),
  decidedBy: text('decided_by'),
  decidedAt: integer('decided_at'),
  rejectReason: text('reject_reason'),
  expenseId: text('expense_id'),
  receiptUrl: text('receipt_url'),        // 0069: مرفقُ الإيصال (رابطٌ/مرجع)
}, (t) => ({ statusIdx: index('idx_claim_status').on(t.status), mosqueIdx: index('idx_claim_mosque').on(t.mosqueId) }))


// المرحلة ٤: تعديلات الراتب (0061)
export const payrollAdjustments = sqliteTable('payroll_adjustments', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull(),
  month: text('month').notNull(),
  kind: text('kind').notNull(),          // allowance | deduction
  amount: real('amount').notNull(),
  note: text('note'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ personMonthIdx: index('idx_adj_person_month').on(t.personId, t.month) }))

// سُلَفُ الموظّفين: سُلفةٌ نقديّةٌ ⇒ ذمّةٌ مدينة (1200) تُستردُّ أقساطًا شهريّةً من الراتب حتى تُقفَل.
export const staffAdvances = sqliteTable('staff_advances', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull(),
  principal: real('principal').notNull(),           // أصلُ السلفة
  balance: real('balance').notNull(),               // المتبقّي للاسترداد
  monthlyDeduction: real('monthly_deduction').notNull(), // قسطُ الاسترداد الشهريّ
  fundId: text('fund_id').notNull().default('general'),
  status: text('status').notNull().default('active'),    // active | settled
  note: text('note'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ personIdx: index('idx_advance_person').on(t.personId, t.status) }))

// الصندوقُ النثريّ (السلفة المستديمة): سقفٌ ثابتٌ يُصرَف منه ويُزوَّد دوريًّا. الرصيدُ التشغيليّ هنا، والحقيقةُ المحاسبيّة في الدفتر (حساب 1130).
export const pettyCashBoxes = sqliteTable('petty_cash_boxes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  custodianPersonId: text('custodian_person_id'),
  custodianName: text('custodian_name'),
  floatAmount: real('float_amount').notNull(),   // السقف
  balance: real('balance').notNull(),            // الرصيد الحاليّ
  fundId: text('fund_id').notNull().default('general'),
  status: text('status').notNull().default('active'), // active | closed
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
})
export const pettyCashTxns = sqliteTable('petty_cash_txns', {
  id: text('id').primaryKey(),
  boxId: text('box_id').notNull(),
  kind: text('kind').notNull(),                  // open | expense | replenish
  amount: real('amount').notNull(),
  category: text('category'),
  note: text('note'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ boxIdx: index('idx_petty_txn_box').on(t.boxId) }))

// الأصولُ الثابتةُ (المرسمَلة) — تُهلَك بالقسط الثابت. القيمةُ الدفتريّة = التكلفة − مجمّعُ الإهلاك (حساب 1190).
export const fixedAssets = sqliteTable('fixed_assets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  cost: real('cost').notNull(),
  salvageValue: real('salvage_value').notNull().default(0),
  usefulLifeMonths: integer('useful_life_months').notNull(),
  startPeriod: text('start_period').notNull(),   // '1447-01'
  fundId: text('fund_id').notNull().default('general'),
  status: text('status').notNull().default('active'), // active | disposed
  note: text('note'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
})
export const depreciationRuns = sqliteTable('depreciation_runs', {
  id: text('id').primaryKey(),
  fixedAssetId: text('fixed_asset_id').notNull(),
  period: text('period').notNull(),              // شهرٌ هجريّ
  amount: real('amount').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ uq: uniqueIndex('uq_dep_asset_period').on(t.fixedAssetId, t.period) }))

// دفعاتُ الصرف المجمّعة: تجميعُ مستحقّي الصرف في دفعةٍ تُصرَف بقيدٍ واحدٍ متوازن.
export const paymentBatches = sqliteTable('payment_batches', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  period: text('period'),                         // شهرٌ هجريٌّ اختياريّ
  fundId: text('fund_id').notNull().default('general'),
  status: text('status').notNull().default('open'), // open | paid
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
  paidBy: text('paid_by'),
  paidAt: integer('paid_at'),
})
export const paymentBatchItems = sqliteTable('payment_batch_items', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').notNull(),
  personName: text('person_name').notNull(),
  amount: real('amount').notNull(),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ batchIdx: index('idx_batch_item').on(t.batchId) }))


// ٠٠٧٣ — «الصندوق» الهرمي (ق-د٢): التسليمات بين صناديق الوحدات — عمليةُ عهدةٍ بطرفين بإقرار استلام.
export const handovers = sqliteTable('handovers', {
  id: text('id').primaryKey(),
  fromUnitId: text('from_unit_id').notNull(),
  toUnitId: text('to_unit_id').notNull(),
  purpose: text('purpose').notNull(),          // salaries | operations | transfer | other
  batchId: text('batch_id'),                   // دفعة الرواتب الأمّ إن كانت السلسلة رواتب
  lines: text('lines').notNull(),              // أسطر العملات JSON [{currency, amount}] بالوحدة الصغرى
  note: text('note'),
  status: text('status').notNull().default('delivered'), // delivered | acknowledged
  deliveredBy: text('delivered_by').notNull(),
  deliveredAt: integer('delivered_at').notNull(),
  acknowledgedBy: text('acknowledged_by'),
  acknowledgedAt: integer('acknowledged_at'),
  entryId: text('entry_id'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  fromIdx: index('idx_ho_from').on(t.fromUnitId, t.status),
  toIdx: index('idx_ho_to').on(t.toUnitId, t.status),
  batchIdx: index('idx_ho_batch').on(t.batchId),
}))

// ٠٠٧٣ — قاموسُ فئات الصرف المغلق (محروقات/نقليات/رواتب…) — يُدار من «الإدارة»، لا نصَّ حرًّا.
export const expenseCategories = sqliteTable('expense_categories', {
  key: text('key').primaryKey(),
  label: text('label').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sort: integer('sort').notNull().default(0),
})


// ٠٠٧٤ — الإقفال الدوري للصندوق (٣٩): تقريرُ عهدةٍ شهريٌّ يُرفع للأعلى فيعتمده
export const boxClosings = sqliteTable('box_closings', {
  id: text('id').primaryKey(),
  unitId: text('unit_id').notNull(),
  month: text('month').notNull(),
  summary: text('summary').notNull(),          // JSON: received/spent/handedDown/remaining بأسطر عملات
  status: text('status').notNull().default('submitted'), // submitted | approved
  submittedBy: text('submitted_by').notNull(),
  submittedAt: integer('submitted_at').notNull(),
  approvedBy: text('approved_by'),
  approvedAt: integer('approved_at'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  unitMonthIdx: uniqueIndex('idx_bc_unit_month').on(t.unitId, t.month),
  statusIdx: index('idx_bc_status').on(t.status),
}))
