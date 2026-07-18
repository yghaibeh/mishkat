-- ط١ — تصحيحٌ وفهارس (تدقيق الجولة الخامسة):

-- (أ) تصحيحُ أثرٍ جانبيّ لهجرة 0054: حذفُ صفوف daily_entries المكرّرة لم يُعِد حساب
-- weekly_records.total_points، فبقيت مجاميعُ الأسابيع التي كان بها تكرارٌ منتفخةً حتى إدخالٍ لاحق.
-- نُعيد حسابَها من الصفوف الباقية (مجموعُ نقاط القيود المُقَرَّة بالشورى) — مطابقٌ لـrecomputeWeeklyTotal.
UPDATE weekly_records SET total_points = (
  SELECT COALESCE(SUM(points), 0) FROM daily_entries
  WHERE daily_entries.weekly_record_id = weekly_records.id AND daily_entries.shura_confirmed = 1
);

-- (ب) فهارسُ المسارات الساخنة (كلُّها إضافيّةٌ آمنة) — كانت استعلاماتٌ كثيرةٌ تمسح الجداول كاملةً:
CREATE INDEX IF NOT EXISTS idx_notif_status ON notifications (status);           -- dispatchQueued WHERE status='queued'
CREATE INDEX IF NOT EXISTS idx_notif_kind ON notifications (kind);               -- الكرون WHERE kind IN (...)
CREATE INDEX IF NOT EXISTS idx_notif_person_read ON notifications (person_id, read_at); -- عدّاد غير المقروء
CREATE INDEX IF NOT EXISTS idx_wr_status ON weekly_records (status);             -- صندوق الاعتماد + التصعيد
CREATE INDEX IF NOT EXISTS idx_wr_mosque_path ON weekly_records (mosque_path);   -- تجميع الطبقات LIKE
CREATE INDEX IF NOT EXISTS idx_ra_role_status_end ON role_assignments (role, approval_status, end_date); -- توجيه التذكيرات/الإشعارات
CREATE INDEX IF NOT EXISTS idx_ent_month ON monthly_entitlements (month);        -- مجاميع الماليّة الشهريّة
CREATE INDEX IF NOT EXISTS idx_supvisit_ref_created ON supervision_visits (circle_ref_id, created_at); -- آخر زيارةٍ لكلّ حلقة
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log (at);                       -- سجلّ التدقيق بالترتيب الزمنيّ
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity);
