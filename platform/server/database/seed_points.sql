-- بذور نظام النقاط: الأنشطة + مخططات الرجال/النساء + المعدّل المالي
-- الأوزان من وثيقة الأدوار (§5) والقرار ق6.

-- أنشطة الرجال (8)
INSERT OR IGNORE INTO activity_types (id, code, name, gender_track, category, active, sort_order) VALUES
  ('m_family_meeting', 'family_meeting', 'اجتماع الأسرة اليومي', 'male', 'admin', 1, 1),
  ('m_ala_baseera',    'ala_baseera',    'تدريس «على بصيرة»',     'male', 'edu',   1, 2),
  ('m_lessons',        'lessons',        'دروس شرعية وتربوية',    'male', 'edu',   1, 3),
  ('m_social',         'social',         'عمل اجتماعي وعلاقات عامة', 'male', 'social', 1, 4),
  ('m_recruit',        'recruit',        'استقطاب شاب جديد',       'male', 'social', 1, 5),
  ('m_sport',          'sport',          'نشاط ترفيهي ورياضي',     'male', 'sport',  1, 6),
  ('m_media',          'media',          'عمل إعلامي',            'male', 'media',  1, 7),
  ('m_other',          'other',          'أنشطة أخرى',            'male', 'other',  1, 8);

-- أنشطة النساء (8) — تختلف عن الرجال (ق6)
INSERT OR IGNORE INTO activity_types (id, code, name, gender_track, category, active, sort_order) VALUES
  ('f_ala_baseera',     'ala_baseera',     'تدريس «على بصيرة»',  'female', 'edu',    1, 1),
  ('f_dawah_visit',     'dawah_visit',     'زيارة دعوية',        'female', 'dawah',  1, 2),
  ('f_dawah_tour',      'dawah_tour',      'جولات دعوية',        'female', 'dawah',  1, 3),
  ('f_hijab_dist',      'hijab_dist',      'توزيع حجابات',       'female', 'dawah',  1, 4),
  ('f_hijab_convince',  'hijab_convince',  'إقناع امرأة بالحجاب', 'female', 'dawah',  1, 5),
  ('f_attend_lessons',  'attend_lessons',  'حضور دروس',          'female', 'edu',    1, 6),
  ('f_lectures',        'lectures',        'إلقاء وملتقيات دعوية', 'female', 'dawah',  1, 7),
  ('f_other',           'other',           'أنشطة أخرى',         'female', 'other',  1, 8);

-- مخططا النقاط (هدف 70/أسبوع لكل مسار)
INSERT OR IGNORE INTO points_schemes (id, gender_track, weekly_target, valid_from, active) VALUES
  ('scheme-male',   'male',   70, 0, 1),
  ('scheme-female', 'female', 70, 0, 1);

-- بنود مخطط الرجال
INSERT OR IGNORE INTO points_scheme_items (id, scheme_id, activity_type_id, points) VALUES
  ('pi-m-1', 'scheme-male', 'm_family_meeting', 1),
  ('pi-m-2', 'scheme-male', 'm_ala_baseera',    2),
  ('pi-m-3', 'scheme-male', 'm_lessons',        2),
  ('pi-m-4', 'scheme-male', 'm_social',         1),
  ('pi-m-5', 'scheme-male', 'm_recruit',        1),
  ('pi-m-6', 'scheme-male', 'm_sport',          1),
  ('pi-m-7', 'scheme-male', 'm_media',          1),
  ('pi-m-8', 'scheme-male', 'm_other',          1);

-- بنود مخطط النساء
INSERT OR IGNORE INTO points_scheme_items (id, scheme_id, activity_type_id, points) VALUES
  ('pi-f-1', 'scheme-female', 'f_ala_baseera',    2),
  ('pi-f-2', 'scheme-female', 'f_dawah_visit',    1),
  ('pi-f-3', 'scheme-female', 'f_dawah_tour',     1),
  ('pi-f-4', 'scheme-female', 'f_hijab_dist',     1),
  ('pi-f-5', 'scheme-female', 'f_hijab_convince', 1),
  ('pi-f-6', 'scheme-female', 'f_attend_lessons', 1),
  ('pi-f-7', 'scheme-female', 'f_lectures',       1),
  ('pi-f-8', 'scheme-female', 'f_other',          1);

-- المعدّل المالي الحالي: 280 نقطة = 50$ (ق2-ب) — قابل للتغيير بأثر قادم
INSERT OR IGNORE INTO rate_schemes (id, kind, amount, per_unit, currency, valid_from, active) VALUES
  ('rate-point-current', 'point_rate', 50, 280, 'USD', 0, 1);

-- الراتب المقطوع للإدارة العليا (ق2-ب) — مثال 100$
INSERT OR IGNORE INTO rate_schemes (id, kind, amount, per_unit, currency, valid_from, active) VALUES
  ('rate-fixed-admin', 'fixed_salary', 100, NULL, 'USD', 0, 1);
