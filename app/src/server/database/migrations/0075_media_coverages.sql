-- التغطية الإعلاميّة كيانٌ له سياق (بلاغ المالك ٢٠٢٦-٠٧-١٨: «ما سياقها؟ من قام بها؟»)
-- كانت التغطية صورةً عائمةً بوصفٍ اختياريّ: بلا حدثٍ ولا مكانٍ ولا ناشرٍ ولا تاريخِ وقوع.
-- صارت سجلَّ حدثٍ: عنوانٌ ونوعٌ ووحدةٌ وتاريخُ وقوعٍ وناشرٌ ونصّ — وصورُه ألبومٌ لا صورةً واحدة
-- (attachments بنطاق media_post وref_id = معرّف التغطية).
CREATE TABLE IF NOT EXISTS media_coverages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,                  -- event | opening | distribution | visit | lesson | ceremony
  org_unit_id TEXT,                    -- الوحدة المغطّاة (مسجد/مربع/منطقة)
  org_path TEXT,                       -- مسارها — به يُعزل النطاق كسائر النظام
  occurred_at INTEGER NOT NULL,        -- تاريخُ وقوع الحدث (لا تاريخ الرفع)
  date_hijri TEXT,
  body TEXT,                           -- نصُّ التغطية (اختياريّ)
  created_by TEXT,                     -- users.id — الناشر
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_cov_org ON media_coverages(org_path);
CREATE INDEX IF NOT EXISTS idx_media_cov_at ON media_coverages(occurred_at);
