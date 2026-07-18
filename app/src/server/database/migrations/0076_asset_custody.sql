-- «العُهد» ميزةً قائمةً بذاتها (قرار المالك ٢٠٢٦-٠٧-١٨): كان الأصل يحمل اسمَ حائزه الحاليّ فقط،
-- فإذا تبدّل ضاع «من كان يحوزها ومتى ومَن سلّمها» — لا سلسلةَ حيازةٍ ولا إقرارَ استلام.
-- سلسلةُ الحيازة: كلُّ تسليمٍ/استلامٍ/إعادةٍ/بلاغِ تلفٍ حدثٌ مسجَّلٌ لا يُحذف.
CREATE TABLE IF NOT EXISTS asset_custody (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  action TEXT NOT NULL,            -- assign | transfer | return | damaged | lost | retire
  from_person_id TEXT, from_name TEXT,
  to_person_id TEXT,   to_name TEXT,
  condition TEXT,                  -- new | good | fair | damaged
  note TEXT,
  at INTEGER NOT NULL,
  by_user_id TEXT,                 -- المسؤول الذي نفّذ الحركة
  ack_at INTEGER,                  -- إقرارُ المستلم بنفسه («استلمتُ») — كإقرار تسليم الصندوق
  ack_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_custody_asset ON asset_custody(asset_id);
CREATE INDEX IF NOT EXISTS idx_custody_to ON asset_custody(to_person_id);

-- حالةُ العهدة الحاليّة على الأصل نفسه (مشتقّةٌ من آخر حدثٍ، مُخزَّنةٌ للقراءة السريعة)
ALTER TABLE assets ADD COLUMN condition TEXT;
ALTER TABLE assets ADD COLUMN custody_since INTEGER;
