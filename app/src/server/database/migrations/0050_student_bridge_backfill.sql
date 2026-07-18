-- ردم جسر الطلاب (0050): مرايا الطلاب القائمين بين سجلّ الحلقات ووحدة التحفيظ.
-- معرّفاتٌ اشتقاقيّة (ts-/cs-) + استبعادُ تطابق الاسم ⇒ آمنةٌ ومكرّرةٌ بلا ازدواج.

-- ١) طلاب سجلّ الحلقات (حلقات تحفيظ مجسورة) ⇒ وحدة التحفيظ
INSERT INTO tahfeez_students (id, circle_id, person_id, student_name, status, created_at)
SELECT 'ts-' || cs.id,
       COALESCE(
         (SELECT t1.id FROM tahfeez_circles t1 WHERE t1.id = 'tc-' || c.id),
         (SELECT t2.id FROM tahfeez_circles t2 WHERE t2.mosque_id = c.mosque_id AND t2.name = c.name LIMIT 1)
       ),
       COALESCE(cs.person_id, ''), cs.name, 'active', cs.created_at
FROM circle_students cs
JOIN circles c ON c.id = cs.circle_id AND c.type = 'tahfeez' AND c.status = 'active'
WHERE cs.status = 'active'
  AND COALESCE(
        (SELECT t1.id FROM tahfeez_circles t1 WHERE t1.id = 'tc-' || c.id),
        (SELECT t2.id FROM tahfeez_circles t2 WHERE t2.mosque_id = c.mosque_id AND t2.name = c.name LIMIT 1)
      ) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tahfeez_students ts0 WHERE ts0.id = 'ts-' || cs.id)
  AND NOT EXISTS (
    SELECT 1 FROM tahfeez_students ts1
    WHERE ts1.circle_id = COALESCE(
            (SELECT t1.id FROM tahfeez_circles t1 WHERE t1.id = 'tc-' || c.id),
            (SELECT t2.id FROM tahfeez_circles t2 WHERE t2.mosque_id = c.mosque_id AND t2.name = c.name LIMIT 1)
          )
      AND ts1.student_name = cs.name AND ts1.status = 'active'
  );

-- ٢) طلاب وحدة التحفيظ ⇒ سجلّ الحلقات (ليتطابق العدّ في تبويب الحلقات)
INSERT INTO circle_students (id, circle_id, name, person_id, notes, status, created_at)
SELECT 'cs-' || ts.id,
       COALESCE(
         CASE WHEN tc.id LIKE 'tc-%' THEN (SELECT c1.id FROM circles c1 WHERE c1.id = substr(tc.id, 4)) END,
         (SELECT c2.id FROM circles c2 WHERE c2.mosque_id = tc.mosque_id AND c2.name = tc.name AND c2.type = 'tahfeez' LIMIT 1)
       ),
       COALESCE(ts.student_name, '—'), NULLIF(ts.person_id, ''), NULL, 'active', ts.created_at
FROM tahfeez_students ts
JOIN tahfeez_circles tc ON tc.id = ts.circle_id
WHERE ts.status = 'active' AND ts.id NOT LIKE 'ts-%'
  AND COALESCE(
        CASE WHEN tc.id LIKE 'tc-%' THEN (SELECT c1.id FROM circles c1 WHERE c1.id = substr(tc.id, 4)) END,
        (SELECT c2.id FROM circles c2 WHERE c2.mosque_id = tc.mosque_id AND c2.name = tc.name AND c2.type = 'tahfeez' LIMIT 1)
      ) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM circle_students cs0 WHERE cs0.id = 'cs-' || ts.id)
  AND NOT EXISTS (
    SELECT 1 FROM circle_students cs1
    WHERE cs1.circle_id = COALESCE(
            CASE WHEN tc.id LIKE 'tc-%' THEN (SELECT c1.id FROM circles c1 WHERE c1.id = substr(tc.id, 4)) END,
            (SELECT c2.id FROM circles c2 WHERE c2.mosque_id = tc.mosque_id AND c2.name = tc.name AND c2.type = 'tahfeez' LIMIT 1)
          )
      AND cs1.name = COALESCE(ts.student_name, '—') AND cs1.status = 'active'
  );
