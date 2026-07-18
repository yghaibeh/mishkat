-- بذور نظام النقاط: الأنشطة + مخططات الرجال/النساء + المعدّل المالي
-- الأوزان من وثيقة الأدوار (§5) والقرار ق6.
-- محدَّث بعد توسيع قائمة الأنشطة (الهجرة 0013)

-- أنشطة الرجال
INSERT OR IGNORE INTO activity_types (id, code, name, gender_track, category, active, sort_order) VALUES
  -- إدارية أساسية
  ('m_family_meeting', 'family_meeting', 'اجتماع الأسرة اليومي',                  'male', 'admin',  1,  1),
  -- صلاة
  ('m_prayer',         'prayer',          'إحياء صلوات الخمس مع الأسرة في المسجد', 'male', 'prayer', 1,  2),
  -- تعليمية
  ('m_ala_baseera',    'ala_baseera',     'تدريس «على بصيرة»',                     'male', 'edu',    1,  3),
  ('m_lesson_mosque',  'lesson_mosque',   'درس شرعي أو تربوي في المسجد',           'male', 'edu',    1,  4),
  ('m_quran',          'quran',           'حلقة تحفيظ القرآن',                      'male', 'edu',    1,  5),
  ('m_lecture_attend', 'lecture_attend',  'حضور محاضرة أو مشاركة فيها',             'male', 'edu',    1,  6),
  ('m_lessons',        'lessons',         'دروس شرعية وتربوية (عامة)',              'male', 'edu',    1,  7),
  -- إعلامية
  ('m_media_post',     'media_post',      'نشر منشور إعلامي',                       'male', 'media',  1,  8),
  ('m_media_design',   'media_design',    'تصميم مرئي',                             'male', 'media',  1,  9),
  ('m_media_stickers', 'media_stickers',  'تعليق ملصقات أو مطويات',                 'male', 'media',  1, 10),
  ('m_media_books',    'media_books',     'توزيع كتب أو مطبوعات',                   'male', 'media',  1, 11),
  ('m_media',          'media',           'عمل إعلامي (عام)',                       'male', 'media',  1, 12),
  -- دعوية
  ('m_give_lecture',   'give_lecture',    'إلقاء محاضرة أو كلمة',                   'male', 'dawah',  1, 13),
  ('m_dawah_visit',    'dawah_visit',     'زيارة دعوية',                            'male', 'dawah',  1, 14),
  -- اجتماعية
  ('m_social',         'social',          'عمل اجتماعي وعلاقات عامة',              'male', 'social', 1, 15),
  ('m_recruit',        'recruit',         'استقطاب شاب جديد',                       'male', 'social', 1, 16),
  ('m_visit_sick',     'visit_sick',      'زيارة مريض أو صاحب حاجة',               'male', 'social', 1, 17),
  ('m_social_event',   'social_event',    'مشاركة مناسبة اجتماعية',                 'male', 'social', 1, 18),
  -- إغاثية
  ('m_relief_case',    'relief_case',     'مساعدة حالة إغاثية',                     'male', 'relief', 1, 19),
  ('m_relief_collect', 'relief_collect',  'جمع تبرعات أو مساعدات',                  'male', 'relief', 1, 20),
  -- ترفيهية
  ('m_sport',          'sport',           'نشاط ترفيهي ورياضي',                     'male', 'sport',  1, 21),
  -- إدارية إضافية
  ('m_admin_meeting',  'admin_meeting',   'اجتماع تنظيمي',                          'male', 'admin',  1, 22),
  ('m_followup',       'followup',        'متابعة أفراد الأسرة',                    'male', 'admin',  1, 23),
  -- معطّل (استُبدل بأنشطة مسمّاة)
  ('m_other',          'other',           'أنشطة أخرى',                            'male', 'other',  0, 99);

-- أنشطة النساء
INSERT OR IGNORE INTO activity_types (id, code, name, gender_track, category, active, sort_order) VALUES
  -- تعليمية
  ('f_ala_baseera',    'ala_baseera',     'تدريس «على بصيرة»',         'female', 'edu',    1,  1),
  ('f_attend_lessons', 'attend_lessons',  'حضور دروس',                 'female', 'edu',    1,  2),
  ('f_quran',          'quran',           'حلقة تحفيظ القرآن',         'female', 'edu',    1,  3),
  -- دعوية
  ('f_dawah_visit',    'dawah_visit',     'زيارة دعوية',               'female', 'dawah',  1,  4),
  ('f_dawah_tour',     'dawah_tour',      'جولات دعوية',               'female', 'dawah',  1,  5),
  ('f_hijab_dist',     'hijab_dist',      'توزيع حجابات',              'female', 'dawah',  1,  6),
  ('f_hijab_convince', 'hijab_convince',  'إقناع امرأة بالحجاب',       'female', 'dawah',  1,  7),
  ('f_give_lecture',   'give_lecture',    'إلقاء محاضرة أو كلمة',      'female', 'dawah',  1,  8),
  ('f_lectures',       'lectures',        'إلقاء وملتقيات دعوية (عام)', 'female', 'dawah',  1,  9),
  -- إعلامية
  ('f_media_post',     'media_post',      'نشر منشور إعلامي',           'female', 'media',  1, 10),
  ('f_media_design',   'media_design',    'تصميم مرئي',                 'female', 'media',  1, 11),
  ('f_books_dist',     'books_dist',      'توزيع كتب أو مطبوعات',       'female', 'media',  1, 12),
  -- اجتماعية
  ('f_social_event',   'social_event',    'نشاط اجتماعي',               'female', 'social', 1, 13),
  -- إغاثية
  ('f_relief_case',    'relief_case',     'مساعدة حالة إغاثية',         'female', 'relief', 1, 14),
  ('f_relief_collect', 'relief_collect',  'جمع تبرعات أو مساعدات',      'female', 'relief', 1, 15),
  -- معطّل (استُبدل بأنشطة مسمّاة)
  ('f_other',          'other',           'أنشطة أخرى',                'female', 'other',  0, 99);

-- مخططا النقاط (هدف 70/أسبوع لكل مسار)
INSERT OR IGNORE INTO points_schemes (id, gender_track, weekly_target, valid_from, active) VALUES
  ('scheme-male',   'male',   70, 0, 1),
  ('scheme-female', 'female', 70, 0, 1);

-- بنود مخطط الرجال
-- الدرس في المسجد + إلقاء المحاضرة + تدريس «على بصيرة» = نقطتان، الباقي نقطة
INSERT OR IGNORE INTO points_scheme_items (id, scheme_id, activity_type_id, points) VALUES
  ('pi-m-1',  'scheme-male', 'm_family_meeting', 1),
  ('pi-m-pr', 'scheme-male', 'm_prayer',         1),
  ('pi-m-2',  'scheme-male', 'm_ala_baseera',    2),
  ('pi-m-lm', 'scheme-male', 'm_lesson_mosque',  2),
  ('pi-m-qu', 'scheme-male', 'm_quran',          1),
  ('pi-m-la', 'scheme-male', 'm_lecture_attend', 1),
  ('pi-m-3',  'scheme-male', 'm_lessons',        2),
  ('pi-m-mp', 'scheme-male', 'm_media_post',     1),
  ('pi-m-md', 'scheme-male', 'm_media_design',   1),
  ('pi-m-ms', 'scheme-male', 'm_media_stickers', 1),
  ('pi-m-mb', 'scheme-male', 'm_media_books',    1),
  ('pi-m-7',  'scheme-male', 'm_media',          1),
  ('pi-m-gl', 'scheme-male', 'm_give_lecture',   2),
  ('pi-m-dv', 'scheme-male', 'm_dawah_visit',    1),
  ('pi-m-4',  'scheme-male', 'm_social',         1),
  ('pi-m-5',  'scheme-male', 'm_recruit',        1),
  ('pi-m-vs', 'scheme-male', 'm_visit_sick',     1),
  ('pi-m-se', 'scheme-male', 'm_social_event',   1),
  ('pi-m-rc', 'scheme-male', 'm_relief_case',    1),
  ('pi-m-rl', 'scheme-male', 'm_relief_collect', 1),
  ('pi-m-6',  'scheme-male', 'm_sport',          1),
  ('pi-m-am', 'scheme-male', 'm_admin_meeting',  1),
  ('pi-m-fu', 'scheme-male', 'm_followup',       1),
  ('pi-m-8',  'scheme-male', 'm_other',          1);

-- بنود مخطط النساء
INSERT OR IGNORE INTO points_scheme_items (id, scheme_id, activity_type_id, points) VALUES
  ('pi-f-1',  'scheme-female', 'f_ala_baseera',    2),
  ('pi-f-6',  'scheme-female', 'f_attend_lessons', 1),
  ('pi-f-qu', 'scheme-female', 'f_quran',          1),
  ('pi-f-2',  'scheme-female', 'f_dawah_visit',    1),
  ('pi-f-3',  'scheme-female', 'f_dawah_tour',     1),
  ('pi-f-4',  'scheme-female', 'f_hijab_dist',     1),
  ('pi-f-5',  'scheme-female', 'f_hijab_convince', 1),
  ('pi-f-gl', 'scheme-female', 'f_give_lecture',   2),
  ('pi-f-7',  'scheme-female', 'f_lectures',       1),
  ('pi-f-mp', 'scheme-female', 'f_media_post',     1),
  ('pi-f-md', 'scheme-female', 'f_media_design',   1),
  ('pi-f-bd', 'scheme-female', 'f_books_dist',     1),
  ('pi-f-se', 'scheme-female', 'f_social_event',   1),
  ('pi-f-rc', 'scheme-female', 'f_relief_case',    1),
  ('pi-f-rl', 'scheme-female', 'f_relief_collect', 1),
  ('pi-f-8',  'scheme-female', 'f_other',          1);

-- المعدّل المالي الحالي: 280 نقطة = 50$ (ق2-ب) — قابل للتغيير بأثر قادم
INSERT OR IGNORE INTO rate_schemes (id, kind, amount, per_unit, currency, valid_from, active) VALUES
  ('rate-point-current', 'point_rate', 50, 280, 'USD', 0, 1);

-- الراتب المقطوع للإدارة العليا (ق2-ب) — مثال 100$
INSERT OR IGNORE INTO rate_schemes (id, kind, amount, per_unit, currency, valid_from, active) VALUES
  ('rate-fixed-admin', 'fixed_salary', 100, NULL, 'USD', 0, 1);
