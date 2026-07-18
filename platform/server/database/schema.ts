import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'

// الوحدة التنظيمية — شجرة واحدة بالمسار المادّي (Materialized Path)
// path مثل: /idlib/bloc-north/sq-1/m-farouq/  — يدعم استعلام «كل ما تحت نطاقي» بـ LIKE
export const orgUnits = sqliteTable('org_units', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'),
  path: text('path').notNull(),
  type: text('type').notNull(),            // rabita | bloc | square | mosque
  genderTrack: text('gender_track').notNull().default('male'), // male | female
  name: text('name').notNull(),
  city: text('city'),
  district: text('district'),
  status: text('status').notNull().default('active'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  pathIdx: index('idx_org_units_path').on(t.path),
  parentIdx: index('idx_org_units_parent').on(t.parentId),
}))

// الشخص — قد يكون أميراً/عضواً/معلّماً/مشتركاً
export const persons = sqliteTable('persons', {
  id: text('id').primaryKey(),
  fullName: text('full_name').notNull(),
  gender: text('gender').notNull(),        // male | female
  birthYearHijri: integer('birth_year_hijri'),
  homeOrgUnitId: text('home_org_unit_id'),
  status: text('status').notNull().default('active'),
  createdAt: integer('created_at').notNull(),
})

// بيانات الاتصال في جدول منفصل (خصوصية + صلاحيات أضيق)
export const personContacts = sqliteTable('person_contacts', {
  personId: text('person_id').primaryKey(),
  phone: text('phone'),
  telegram: text('telegram'),
  guardianPhone: text('guardian_phone'),
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
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  loginIdx: index('idx_users_login').on(t.login),
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
  weekStart: text('week_start').notNull(),
  day: text('day').notNull(),               // sat | sun | mon | tue | wed | thu | fri
  activityTypeId: text('activity_type_id').notNull(),
  count: integer('count').notNull().default(0),
  points: integer('points').notNull().default(0), // لقطة محسوبة خادمياً
  note: text('note'),
  shuraConfirmed: integer('shura_confirmed', { mode: 'boolean' }).notNull().default(false),
  enteredBy: text('entered_by'),            // user id
  enteredByCommittee: text('entered_by_committee'), // الحقيبة إن أدخلتها لجنة (ق1)
  recordedAt: integer('recorded_at').notNull(),
  syncedAt: integer('synced_at').notNull(),
}, (t) => ({
  clientUuidIdx: index('idx_de_client_uuid').on(t.clientUuid),
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
  personId: text('person_id').notNull(),
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
  capacity: integer('capacity').notNull().default(30),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ teacherIdx: index('idx_halaqa_teacher').on(t.teacherId) }))

// تسجيل طالب في حلقة
export const enrollments = sqliteTable('enrollments', {
  id: text('id').primaryKey(),
  halaqaId: text('halaqa_id').notNull(),
  personId: text('person_id').notNull(),
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
  status: text('status').notNull().default('recorded'), // recorded | supervisor_ok | approved
  createdAt: integer('created_at').notNull(),
}, (t) => ({ teacherMonthIdx: index('idx_ls_teacher_month').on(t.teacherId, t.hijriMonth) }))

// تقييم الطالب في درس — متابعة تربوية (بلا أثر مالي حالياً)
export const studentEvaluations = sqliteTable('student_evaluations', {
  id: text('id').primaryKey(),
  enrollmentId: text('enrollment_id').notNull(),
  lessonSessionId: text('lesson_session_id').notNull(),
  score: integer('score'),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
})

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
  at: integer('at').notNull(),
}, (t) => ({ mosqueIdx: index('idx_don_mosque').on(t.mosqueId) }))

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  mosqueId: text('mosque_id').notNull(),
  category: text('category'),
  amount: real('amount').notNull(),
  spentBy: text('spent_by'),
  note: text('note'),
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

// أرشيف الوثائق/المراسلات (المادة 22)
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  mosqueId: text('mosque_id').notNull(),
  kind: text('kind').notNull().default('outgoing'), // minutes | incoming | outgoing
  title: text('title').notNull(),
  refUrl: text('ref_url'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
})

// ===== خطط اللجان السنوية (المواد 21، 24–33) =====
export const annualPlans = sqliteTable('annual_plans', {
  id: text('id').primaryKey(),
  orgUnitId: text('org_unit_id').notNull(),
  committee: text('committee').notNull(),
  yearHijri: text('year_hijri').notNull(),
  title: text('title').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const planItems = sqliteTable('plan_items', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull().default('planned'), // planned | in_progress | done
  dueAt: integer('due_at'),
  doneAt: integer('done_at'),
}, (t) => ({ planIdx: index('idx_pi_plan').on(t.planId) }))

// ===== حلقات التحفيظ (المادة 29، الباب السادس) =====
export const tahfeezCircles = sqliteTable('tahfeez_circles', {
  id: text('id').primaryKey(),
  mosqueId: text('mosque_id').notNull(),
  name: text('name').notNull(),
  teacherPersonId: text('teacher_person_id'),
  createdAt: integer('created_at').notNull(),
})

export const tahfeezStudents = sqliteTable('tahfeez_students', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull(),
  personId: text('person_id').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: integer('created_at').notNull(),
}, (t) => ({ circleIdx: index('idx_ts_circle').on(t.circleId) }))

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

// ===== الإشعارات =====
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  personId: text('person_id').notNull(),
  channel: text('channel').notNull(),    // push | telegram | inapp
  kind: text('kind').notNull(),          // entry_reminder | term_ending | ...
  payload: text('payload'),
  status: text('status').notNull().default('queued'), // queued | sent | failed
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
