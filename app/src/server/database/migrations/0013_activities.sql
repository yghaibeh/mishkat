-- Migration 0013: توسيع قائمة الأنشطة + حقل عدد المشاركين

-- 1. حقل عدد أفراد الأسرة المشاركين في كل إدخال (افتراضياً 1)
ALTER TABLE daily_entries ADD COLUMN participant_count INTEGER NOT NULL DEFAULT 1;

-- 2. تعطيل «أنشطة أخرى» المجمّلة (استُبدلت بأنشطة مسمّاة تفصيلاً)
UPDATE activity_types SET active=0 WHERE id IN ('m_other', 'f_other');

-- 3. أنشطة الرجال الجديدة
INSERT OR IGNORE INTO activity_types (id, code, name, gender_track, category, active, sort_order) VALUES
  -- صلاة
  ('m_prayer',         'prayer',          'إحياء صلوات الخمس مع الأسرة في المسجد', 'male', 'prayer', 1, 2),
  -- تعليمية إضافية
  ('m_lesson_mosque',  'lesson_mosque',   'درس شرعي أو تربوي في المسجد',           'male', 'edu',    1, 4),
  ('m_quran',          'quran',           'حلقة تحفيظ القرآن',                      'male', 'edu',    1, 5),
  ('m_lecture_attend', 'lecture_attend',  'حضور محاضرة أو مشاركة فيها',             'male', 'edu',    1, 6),
  -- إعلامية (مفصّلة)
  ('m_media_post',     'media_post',      'نشر منشور إعلامي',                       'male', 'media',  1, 9),
  ('m_media_design',   'media_design',    'تصميم مرئي',                             'male', 'media',  1, 10),
  ('m_media_stickers', 'media_stickers',  'تعليق ملصقات أو مطويات',                 'male', 'media',  1, 11),
  ('m_media_books',    'media_books',     'توزيع كتب أو مطبوعات',                   'male', 'media',  1, 12),
  -- دعوية إضافية
  ('m_give_lecture',   'give_lecture',    'إلقاء محاضرة أو كلمة',                   'male', 'dawah',  1, 14),
  ('m_dawah_visit',    'dawah_visit',     'زيارة دعوية',                            'male', 'dawah',  1, 15),
  -- اجتماعية إضافية
  ('m_visit_sick',     'visit_sick',      'زيارة مريض أو صاحب حاجة',               'male', 'social', 1, 17),
  ('m_social_event',   'social_event',    'مشاركة مناسبة اجتماعية',                 'male', 'social', 1, 18),
  -- إغاثية
  ('m_relief_case',    'relief_case',     'مساعدة حالة إغاثية',                     'male', 'relief', 1, 19),
  ('m_relief_collect', 'relief_collect',  'جمع تبرعات أو مساعدات',                  'male', 'relief', 1, 20),
  -- إدارية إضافية
  ('m_admin_meeting',  'admin_meeting',   'اجتماع تنظيمي',                          'male', 'admin',  1, 21),
  ('m_followup',       'followup',        'متابعة أفراد الأسرة',                    'male', 'admin',  1, 22);

-- 4. أنشطة النساء الجديدة
INSERT OR IGNORE INTO activity_types (id, code, name, gender_track, category, active, sort_order) VALUES
  ('f_media_post',     'media_post',      'نشر منشور إعلامي',                       'female', 'media',  1, 9),
  ('f_media_design',   'media_design',    'تصميم مرئي',                             'female', 'media',  1, 10),
  ('f_books_dist',     'books_dist',      'توزيع كتب أو مطبوعات',                   'female', 'media',  1, 11),
  ('f_relief_case',    'relief_case',     'مساعدة حالة إغاثية',                     'female', 'relief', 1, 12),
  ('f_relief_collect', 'relief_collect',  'جمع تبرعات أو مساعدات',                  'female', 'relief', 1, 13),
  ('f_social_event',   'social_event',    'نشاط اجتماعي',                           'female', 'social', 1, 14),
  ('f_quran',          'quran',           'حلقة تحفيظ القرآن',                      'female', 'edu',    1, 15),
  ('f_give_lecture',   'give_lecture',    'إلقاء محاضرة أو كلمة',                   'female', 'dawah',  1, 16);

-- 5. بنود مخطط النقاط — أنشطة الرجال الجديدة
-- الدروس في المسجد ومحاضرة تُعادل «على بصيرة» = نقطتان، الباقي نقطة
INSERT OR IGNORE INTO points_scheme_items (id, scheme_id, activity_type_id, points) VALUES
  ('pi-m-pr',  'scheme-male', 'm_prayer',         1),
  ('pi-m-lm',  'scheme-male', 'm_lesson_mosque',  2),
  ('pi-m-qu',  'scheme-male', 'm_quran',          1),
  ('pi-m-la',  'scheme-male', 'm_lecture_attend', 1),
  ('pi-m-mp',  'scheme-male', 'm_media_post',     1),
  ('pi-m-md',  'scheme-male', 'm_media_design',   1),
  ('pi-m-ms',  'scheme-male', 'm_media_stickers', 1),
  ('pi-m-mb',  'scheme-male', 'm_media_books',    1),
  ('pi-m-gl',  'scheme-male', 'm_give_lecture',   2),
  ('pi-m-dv',  'scheme-male', 'm_dawah_visit',    1),
  ('pi-m-vs',  'scheme-male', 'm_visit_sick',     1),
  ('pi-m-se',  'scheme-male', 'm_social_event',   1),
  ('pi-m-rc',  'scheme-male', 'm_relief_case',    1),
  ('pi-m-rl',  'scheme-male', 'm_relief_collect', 1),
  ('pi-m-am',  'scheme-male', 'm_admin_meeting',  1),
  ('pi-m-fu',  'scheme-male', 'm_followup',       1);

-- 6. بنود مخطط النقاط — أنشطة النساء الجديدة
INSERT OR IGNORE INTO points_scheme_items (id, scheme_id, activity_type_id, points) VALUES
  ('pi-f-mp',  'scheme-female', 'f_media_post',     1),
  ('pi-f-md',  'scheme-female', 'f_media_design',   1),
  ('pi-f-bd',  'scheme-female', 'f_books_dist',     1),
  ('pi-f-rc',  'scheme-female', 'f_relief_case',    1),
  ('pi-f-rl',  'scheme-female', 'f_relief_collect', 1),
  ('pi-f-se',  'scheme-female', 'f_social_event',   1),
  ('pi-f-qu',  'scheme-female', 'f_quran',          1),
  ('pi-f-gl',  'scheme-female', 'f_give_lecture',   2);
