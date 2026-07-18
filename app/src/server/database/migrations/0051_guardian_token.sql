-- صفحة وليّ الأمر (المرحلة د): رمزٌ سرّيٌّ لكلّ طالب تحفيظٍ يفتح صفحةَ متابعةٍ للقراءة فقط
-- (حضورُه وتسميعُه وعلاماتُه) — يرسله المعلّم لوليّ الأمر عبر واتساب.
ALTER TABLE tahfeez_students ADD COLUMN guardian_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ts_guardian_token ON tahfeez_students(guardian_token);
