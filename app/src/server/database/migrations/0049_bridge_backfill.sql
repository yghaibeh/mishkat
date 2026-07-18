-- ردمُ الجسر (إصلاح «أضفتُ حلقاتٍ وكلّه مصفّر»): امتداداتُ حلقات السجلّ القائمة في وحداتها.
-- معرّفاتٌ اشتقاقيّةٌ (tc-/v-/t-/h-) + NOT EXISTS ⇒ آمنةٌ ومكرّرةٌ بلا ازدواج.

-- ١) حلقات التحفيظ ⇒ tahfeez_circles (سجلّ التحفيظ اليوميّ)
INSERT INTO tahfeez_circles (id, mosque_id, name, teacher_person_id, created_at)
SELECT 'tc-' || c.id, c.mosque_id, c.name, c.teacher_person_id, c.created_at
FROM circles c
WHERE c.type = 'tahfeez' AND c.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM tahfeez_circles t WHERE t.mosque_id = c.mosque_id AND t.name = c.name);

-- ٢) أماكن المساجد التي فيها حلقات «على بصيرة» بلا مكانٍ مسجَّل
INSERT INTO venues (id, type, name, org_unit_id, gender_track, created_at)
SELECT 'v-' || m.id, 'mosque', m.name, m.id, m.gender_track, strftime('%s','now')*1000
FROM org_units m
WHERE EXISTS (SELECT 1 FROM circles c WHERE c.mosque_id = m.id AND c.type = 'ala_baseera' AND c.status = 'active' AND c.teacher_person_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM venues v WHERE v.org_unit_id = m.id);

-- ٣) كيانات المعلّمين لمعلّمي حلقات «على بصيرة»
INSERT INTO teachers (id, person_id, hourly_rate_id, active, created_at)
SELECT DISTINCT 't-' || c.teacher_person_id, c.teacher_person_id, NULL, 1, strftime('%s','now')*1000
FROM circles c
WHERE c.type = 'ala_baseera' AND c.status = 'active' AND c.teacher_person_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.person_id = c.teacher_person_id);

-- ٤) حلقات «على بصيرة» ⇒ halaqat (الدروس بالساعة) — لمن مَعلّمُها معروف
INSERT INTO halaqat (id, name, venue_id, teacher_id, gender_track, curriculum, capacity, status, created_at)
SELECT 'h-' || c.id, c.name,
       (SELECT v.id FROM venues v WHERE v.org_unit_id = c.mosque_id LIMIT 1),
       (SELECT t.id FROM teachers t WHERE t.person_id = c.teacher_person_id LIMIT 1),
       c.gender_track, 'baseera', COALESCE(c.capacity, 30), 'active', c.created_at
FROM circles c
WHERE c.type = 'ala_baseera' AND c.status = 'active' AND c.teacher_person_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM venues v WHERE v.org_unit_id = c.mosque_id)
  AND NOT EXISTS (
    SELECT 1 FROM halaqat h
    JOIN venues v2 ON v2.id = h.venue_id
    WHERE v2.org_unit_id = c.mosque_id AND h.name = c.name
  );
