-- تنظيف بذرة الإنتاج التجريبية قبل التجربة الميدانية (قرار المالك ٢٠٢٦-٠٧-١٨، وأعاده بلاغ
-- الميدان: «المدخلات الحالية تسبب خربطة في العمل — خلّنا نضيف مدخلات فعلية واقعية»).
-- يبقي: المرجعيات (المنهاج/الأنشطة/المعدلات/العملات/شجرة الحسابات/المواد) + حساب admin
-- + **جذرَي القسمين** (men/women) فتبقى الشبكة ذات هيكلٍ صالحٍ تُبنى عليه الوحدات الحقيقية.
-- ⚠ حذفٌ لا رجعة فيه: نسخةٌ احتياطية كاملة تُؤخذ قبل التنفيذ (wrangler d1 export) — إلزاماً.
-- ⚠ يمسح المرفقات كلَّها بما فيها ما رفعه كادرٌ حقيقيّ — لا يُشغَّل بعد بدء الإدخال الحقيقيّ.
DELETE FROM activities;
DELETE FROM activity_responses;
DELETE FROM announcements;
DELETE FROM asset_expenses;
DELETE FROM assets;
DELETE FROM asset_custody;          -- سلسلة الحيازة (0076)
DELETE FROM media_coverages;        -- التغطيات الإعلامية (0075)
DELETE FROM attachments;
DELETE FROM audit_log;
DELETE FROM auth_attempts;
DELETE FROM budgets;
DELETE FROM central_exams;
DELETE FROM circle_students;
DELETE FROM circles;
DELETE FROM committee_plans;
DELETE FROM committees;
DELETE FROM competitions;
DELETE FROM counters;
DELETE FROM curriculum_progress;
DELETE FROM daily_entries;
DELETE FROM decisions;
DELETE FROM depreciation_runs;
DELETE FROM donations;
DELETE FROM donors;
DELETE FROM enrollments;
DELETE FROM entitlement_tracks;
DELETE FROM exam_questions;
DELETE FROM exam_results;
DELETE FROM exam_submissions;
DELETE FROM exams;
DELETE FROM expense_claims;
DELETE FROM expenses;
DELETE FROM finance_actions;
DELETE FROM fixed_assets;
DELETE FROM halaqa_group_activities;
DELETE FROM halaqat;
DELETE FROM import_batches;
DELETE FROM import_rows;
DELETE FROM incentives;
DELETE FROM journal_entries;
DELETE FROM journal_lines;
DELETE FROM lesson_attachments;
DELETE FROM lesson_attendance;
DELETE FROM lesson_sessions;
DELETE FROM material_progress;
DELETE FROM meeting_attendance;
DELETE FROM meetings;
DELETE FROM monthly_entitlements;
DELETE FROM monthly_programs;
DELETE FROM mosque_lesson_attendance;
DELETE FROM mosque_lessons;
DELETE FROM notifications;
DELETE FROM org_units WHERE id NOT IN ('men','women');  -- يبقى جذرا القسمين
DELETE FROM participant_scores;
DELETE FROM participants;
DELETE FROM payment_batch_items;
DELETE FROM payment_batches;
DELETE FROM payouts;
DELETE FROM payroll_adjustments;
DELETE FROM permission_overrides;
DELETE FROM person_contacts;
DELETE FROM petty_cash_boxes;
DELETE FROM petty_cash_txns;
DELETE FROM pledges;
DELETE FROM push_subscriptions;
DELETE FROM reconciliations;
DELETE FROM refresh_tokens;
DELETE FROM registration_requests;
DELETE FROM resignations;
DELETE FROM staff_advances;
DELETE FROM student_evaluations;
DELETE FROM supervision_visits;
DELETE FROM tahfeez_circles;
DELETE FROM tahfeez_daily_records;
DELETE FROM tahfeez_progress;
DELETE FROM tahfeez_sessions;
DELETE FROM tahfeez_students;
DELETE FROM teachers;
DELETE FROM venues;
DELETE FROM weekly_halaqa_records;
DELETE FROM weekly_records;
-- الحسابات: admin وحده يبقى (بشخصه وتكليفه)
DELETE FROM role_assignments WHERE person_id NOT IN (SELECT person_id FROM users WHERE login='admin');
DELETE FROM persons WHERE id NOT IN (SELECT person_id FROM users WHERE login='admin');
DELETE FROM users WHERE login != 'admin';
