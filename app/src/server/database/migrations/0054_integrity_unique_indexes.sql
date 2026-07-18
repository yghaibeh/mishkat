-- ق٣ — نزاهةُ البيانات ضدّ السباقات (تدقيق الجولة الرابعة):
-- ١) اسمُ الدخول فريدٌ حتمًا — كان فهرسًا غير فريد، فاعتمادُ تسجيلٍ مزدوجٌ متزامنٌ يُنشئ حسابين بنفس الاسم.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_uniq ON users (login);

-- ٢) القيدُ اليوميّ فريدٌ بمفتاحه الطبيعيّ (سجلّ الأسبوع، اليوم، النشاط) وبـclient_uuid —
-- كانت المزامنةُ المتزامنة تُدخل صفّين فتتضاعف نقاطُ الأسبوع. نُزيل التكرار القائم (نُبقي الأحدث) ثم نُفرِد.
DELETE FROM daily_entries WHERE rowid NOT IN (
  SELECT MAX(rowid) FROM daily_entries GROUP BY weekly_record_id, day, activity_type_id
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_de_natural_uniq ON daily_entries (weekly_record_id, day, activity_type_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_de_client_uuid_uniq ON daily_entries (client_uuid) WHERE client_uuid IS NOT NULL;
