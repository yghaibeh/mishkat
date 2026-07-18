-- بذور تجريبية لمحافظة إدلب (الـPilot) — شجرة هيكلية مصغّرة
-- created_at = 0 للتبسيط؛ يُستبدل تلقائياً عند الإنشاء الحقيقي عبر الـAPI.

INSERT OR IGNORE INTO org_units (id, parent_id, path, type, gender_track, name, city, district, status, created_at) VALUES
  ('idlib', NULL, '/idlib/', 'rabita', 'male', 'رابطة محافظة إدلب', 'إدلب', NULL, 'active', 0),
  ('bloc-north', 'idlib', '/idlib/bloc-north/', 'bloc', 'male', 'كتلة الشمال', 'إدلب', NULL, 'active', 0),
  ('sq-1', 'bloc-north', '/idlib/bloc-north/sq-1/', 'square', 'male', 'مربع 1', 'إدلب', 'الحي الشمالي', 'active', 0),
  ('m-farouq', 'sq-1', '/idlib/bloc-north/sq-1/m-farouq/', 'mosque', 'male', 'مسجد الفاروق', 'إدلب', 'الحي الشمالي', 'active', 0),
  ('m-nour', 'sq-1', '/idlib/bloc-north/sq-1/m-nour/', 'mosque', 'male', 'مسجد النور', 'إدلب', 'الحي الشمالي', 'active', 0),
  ('m-taqwa', 'sq-1', '/idlib/bloc-north/sq-1/m-taqwa/', 'mosque', 'female', 'مسجد التقوى (نساء)', 'إدلب', 'الحي الشمالي', 'active', 0),
  ('sq-2', 'bloc-north', '/idlib/bloc-north/sq-2/', 'square', 'male', 'مربع 2', 'إدلب', 'الحي الغربي', 'active', 0),
  ('m-bilal', 'sq-2', '/idlib/bloc-north/sq-2/m-bilal/', 'mosque', 'male', 'مسجد بلال', 'إدلب', 'الحي الغربي', 'active', 0);
