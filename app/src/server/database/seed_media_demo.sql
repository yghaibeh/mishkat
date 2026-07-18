-- بذرةُ الإعلام التجريبيّة (مولّدة عبر scripts/gen_media_demo.mjs) — تُطبَّق فوق بياناتٍ قائمة
-- مسؤول الإعلام (تجريبيّ): الدخول media / mishkat123
INSERT OR IGNORE INTO persons (id,full_name,gender,status,created_at) VALUES ('seed-p-media','مسؤول الإعلام','male','active',1784391322672);
INSERT OR IGNORE INTO users (id,person_id,login,password_hash,mfa_enabled,created_at) VALUES ('seed-u-media','seed-p-media','media','pbkdf2$100000$8T/B/AaCUb7IZ0bystvNjw==$LxZKTHYFK9tz1EnXiZLfi4Je5xflHrh4ndYv1TrR+qA=',0,1784391322672);
INSERT OR IGNORE INTO role_assignments (id,person_id,role,org_unit_id,org_path,start_date,term_number,approval_status,approved_by,created_at)
  SELECT 'seed-ra-media','seed-p-media','media',id,path,1774023322672,1,'approved','u-admin',1784391322672 FROM org_units WHERE section='men' AND type='section' LIMIT 1;
INSERT OR IGNORE INTO role_assignments (id,person_id,role,org_unit_id,org_path,start_date,term_number,approval_status,approved_by,created_at)
  SELECT 'seed-ra-media','seed-p-media','media',id,path,1774023322672,1,'approved','u-admin',1784391322672 FROM org_units WHERE section='men' ORDER BY length(path) LIMIT 1;
INSERT OR IGNORE INTO assets (id,kind,name,details,org_unit_id,org_path,holder_person_id,holder_name,status,created_by,created_at,updated_at)
  SELECT 'seed-as-cam','equipment','كاميرا التغطيات','Canon — مع حقيبة وحامل',id,path,'seed-p-media','مسؤول الإعلام','active','u-admin',1775751322672,1775751322672 FROM org_units WHERE section='men' ORDER BY length(path) LIMIT 1;
INSERT OR IGNORE INTO media_coverages (id,title,kind,org_unit_id,org_path,occurred_at,body,created_by,created_at)
  SELECT 'seed-cov-1','افتتاحُ مصلّى الحيّ الجديد','opening',id,path,1783872922672,'افتُتح المصلّى بحضور أهالي الحيّ ومسؤول المنطقة، وأُقيمت فيه أوّلُ صلاة جماعةٍ وحلقةُ تعريفٍ بالمنهاج.','seed-u-media',1783872922672
  FROM org_units WHERE type='mosque' AND status='active' ORDER BY id LIMIT 1 OFFSET 0;
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-1-1','media_post','seed-cov-1','seed-media/01.jpg','image/jpeg','seed-u-media',1783872922672);
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-1-2','media_post','seed-cov-1','seed-media/02.jpg','image/jpeg','seed-u-media',1783872922673);
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-1-3','media_post','seed-cov-1','seed-media/03.jpg','image/jpeg','seed-u-media',1783872922674);
INSERT OR IGNORE INTO media_coverages (id,title,kind,org_unit_id,org_path,occurred_at,body,created_by,created_at)
  SELECT 'seed-cov-2','توزيعُ السلال الغذائيّة على الأسر المتعفّفة','distribution',id,path,1783354522672,'وزّعت لجنةُ الإغاثة ١٢٠ سلّةً غذائيّةً على أسر الحيّ، بإشراف أمير المسجد ومتابعة اللجنة.','seed-u-media',1783354522672
  FROM org_units WHERE type='mosque' AND status='active' ORDER BY id LIMIT 1 OFFSET 5;
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-2-1','media_post','seed-cov-2','seed-media/04.jpg','image/jpeg','seed-u-media',1783354522672);
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-2-2','media_post','seed-cov-2','seed-media/05.jpg','image/jpeg','seed-u-media',1783354522673);
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-2-3','media_post','seed-cov-2','seed-media/06.jpg','image/jpeg','seed-u-media',1783354522674);
INSERT OR IGNORE INTO media_coverages (id,title,kind,org_unit_id,org_path,occurred_at,body,created_by,created_at)
  SELECT 'seed-cov-3','تكريمُ حفّاظ الجزء الثلاثين','ceremony',id,path,1782749722672,'كُرّم ثمانيةَ عشرَ طالباً أتمّوا حفظَ الجزء الثلاثين، بحضور ذويهم ومعلّميهم.','seed-u-media',1782749722672
  FROM org_units WHERE type='mosque' AND status='active' ORDER BY id LIMIT 1 OFFSET 10;
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-3-1','media_post','seed-cov-3','seed-media/07.jpg','image/jpeg','seed-u-media',1782749722672);
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-3-2','media_post','seed-cov-3','seed-media/08.jpg','image/jpeg','seed-u-media',1782749722673);
INSERT OR IGNORE INTO media_coverages (id,title,kind,org_unit_id,org_path,occurred_at,body,created_by,created_at)
  SELECT 'seed-cov-4','زيارةُ مسؤول المنطقة لحلقات المسجد','visit',id,path,1782058522672,'جولةٌ ميدانيّةٌ على ثلاث حلقاتٍ ولقاءٌ مع المعلّمين حول متابعة المنهاج.','seed-u-media',1782058522672
  FROM org_units WHERE type='mosque' AND status='active' ORDER BY id LIMIT 1 OFFSET 15;
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-4-1','media_post','seed-cov-4','seed-media/09.jpg','image/jpeg','seed-u-media',1782058522672);
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-4-2','media_post','seed-cov-4','seed-media/10.jpg','image/jpeg','seed-u-media',1782058522673);
INSERT OR IGNORE INTO media_coverages (id,title,kind,org_unit_id,org_path,occurred_at,body,created_by,created_at)
  SELECT 'seed-cov-5','درسُ «على بصيرة» — مجلسُ العقيدة','lesson',id,path,1781453722672,'المجلسُ الأوّل من مجالس العقيدة، بحضور أربعين طالباً.','seed-u-media',1781453722672
  FROM org_units WHERE type='mosque' AND status='active' ORDER BY id LIMIT 1 OFFSET 20;
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-5-1','media_post','seed-cov-5','seed-media/11.jpg','image/jpeg','seed-u-media',1781453722672);
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-5-2','media_post','seed-cov-5','seed-media/12.jpg','image/jpeg','seed-u-media',1781453722673);
INSERT OR IGNORE INTO media_coverages (id,title,kind,org_unit_id,org_path,occurred_at,body,created_by,created_at)
  SELECT 'seed-cov-6','ملتقى أمراء المساجد الفصليّ','event',id,path,1780503322672,'ملتقًى فصليٌّ جمع أمراءَ المساجد لعرض خطّة الفصل ومناقشة معوّقات الميدان.','seed-u-media',1780503322672
  FROM org_units WHERE type='mosque' AND status='active' ORDER BY id LIMIT 1 OFFSET 25;
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-6-1','media_post','seed-cov-6','seed-media/01.jpg','image/jpeg','seed-u-media',1780503322672);
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-6-2','media_post','seed-cov-6','seed-media/02.jpg','image/jpeg','seed-u-media',1780503322673);
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,content_type,uploaded_by,created_at) VALUES ('seed-att-6-3','media_post','seed-cov-6','seed-media/03.jpg','image/jpeg','seed-u-media',1780503322674);
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,caption,content_type,uploaded_by,created_at)
  SELECT 'seed-att-d1','daily_record',w.id,'seed-media/04.jpg','توزيعُ سلالٍ على الأسر','image/jpeg',
    (SELECT u.id FROM users u JOIN role_assignments ra ON ra.person_id=u.person_id AND ra.role='amir' AND ra.org_unit_id=w.mosque_id LIMIT 1),
    1784218522672
  FROM weekly_records w ORDER BY w.created_at DESC LIMIT 1 OFFSET 0;
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,caption,content_type,uploaded_by,created_at)
  SELECT 'seed-att-d2','daily_record',w.id,'seed-media/05.jpg','درسُ الفجر الأسبوعيّ','image/jpeg',
    (SELECT u.id FROM users u JOIN role_assignments ra ON ra.person_id=u.person_id AND ra.role='amir' AND ra.org_unit_id=w.mosque_id LIMIT 1),
    1784132122672
  FROM weekly_records w ORDER BY w.created_at DESC LIMIT 1 OFFSET 1;
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,caption,content_type,uploaded_by,created_at)
  SELECT 'seed-att-d3','daily_record',w.id,'seed-media/06.jpg','حملةُ نظافة المسجد','image/jpeg',
    (SELECT u.id FROM users u JOIN role_assignments ra ON ra.person_id=u.person_id AND ra.role='amir' AND ra.org_unit_id=w.mosque_id LIMIT 1),
    1784045722672
  FROM weekly_records w ORDER BY w.created_at DESC LIMIT 1 OFFSET 2;
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,caption,content_type,uploaded_by,created_at)
  SELECT 'seed-att-d4','daily_record',w.id,'seed-media/07.jpg','لقاءُ أسرة المسجد','image/jpeg',
    (SELECT u.id FROM users u JOIN role_assignments ra ON ra.person_id=u.person_id AND ra.role='amir' AND ra.org_unit_id=w.mosque_id LIMIT 1),
    1783959322672
  FROM weekly_records w ORDER BY w.created_at DESC LIMIT 1 OFFSET 3;
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,caption,content_type,uploaded_by,created_at)
  SELECT 'seed-att-d5','daily_record',w.id,'seed-media/08.jpg','زيارةُ مريضٍ من أهل الحيّ','image/jpeg',
    (SELECT u.id FROM users u JOIN role_assignments ra ON ra.person_id=u.person_id AND ra.role='amir' AND ra.org_unit_id=w.mosque_id LIMIT 1),
    1783872922672
  FROM weekly_records w ORDER BY w.created_at DESC LIMIT 1 OFFSET 4;
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,caption,content_type,uploaded_by,created_at)
  SELECT 'seed-att-d6','daily_record',w.id,'seed-media/09.jpg','إفطارُ صائمٍ في المسجد','image/jpeg',
    (SELECT u.id FROM users u JOIN role_assignments ra ON ra.person_id=u.person_id AND ra.role='amir' AND ra.org_unit_id=w.mosque_id LIMIT 1),
    1783786522672
  FROM weekly_records w ORDER BY w.created_at DESC LIMIT 1 OFFSET 5;
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,caption,content_type,uploaded_by,created_at)
  SELECT 'seed-att-d7','daily_record',w.id,'seed-media/10.jpg','درسُ النساء الأسبوعيّ','image/jpeg',
    (SELECT u.id FROM users u JOIN role_assignments ra ON ra.person_id=u.person_id AND ra.role='amir' AND ra.org_unit_id=w.mosque_id LIMIT 1),
    1783700122672
  FROM weekly_records w ORDER BY w.created_at DESC LIMIT 1 OFFSET 6;
INSERT OR IGNORE INTO attachments (id,scope,ref_id,r2_key,caption,content_type,uploaded_by,created_at)
  SELECT 'seed-att-d8','daily_record',w.id,'seed-media/11.jpg','ترتيبُ مكتبة المسجد','image/jpeg',
    (SELECT u.id FROM users u JOIN role_assignments ra ON ra.person_id=u.person_id AND ra.role='amir' AND ra.org_unit_id=w.mosque_id LIMIT 1),
    1783613722672
  FROM weekly_records w ORDER BY w.created_at DESC LIMIT 1 OFFSET 7;
INSERT OR IGNORE INTO lesson_attachments (id,lesson_session_id,r2_key,caption,content_type,created_at)
  SELECT 'seed-att-l1',s.id,'seed-media/12.jpg',coalesce(s.lesson_title,'درسُ الحلقة'),'image/jpeg',1784132122672
  FROM lesson_sessions s ORDER BY s.created_at DESC LIMIT 1 OFFSET 0;
INSERT OR IGNORE INTO lesson_attachments (id,lesson_session_id,r2_key,caption,content_type,created_at)
  SELECT 'seed-att-l2',s.id,'seed-media/01.jpg',coalesce(s.lesson_title,'درسُ الحلقة'),'image/jpeg',1784045722672
  FROM lesson_sessions s ORDER BY s.created_at DESC LIMIT 1 OFFSET 3;
INSERT OR IGNORE INTO lesson_attachments (id,lesson_session_id,r2_key,caption,content_type,created_at)
  SELECT 'seed-att-l3',s.id,'seed-media/02.jpg',coalesce(s.lesson_title,'درسُ الحلقة'),'image/jpeg',1783959322672
  FROM lesson_sessions s ORDER BY s.created_at DESC LIMIT 1 OFFSET 6;
INSERT OR IGNORE INTO lesson_attachments (id,lesson_session_id,r2_key,caption,content_type,created_at)
  SELECT 'seed-att-l4',s.id,'seed-media/03.jpg',coalesce(s.lesson_title,'درسُ الحلقة'),'image/jpeg',1783872922672
  FROM lesson_sessions s ORDER BY s.created_at DESC LIMIT 1 OFFSET 9;
INSERT OR IGNORE INTO lesson_attachments (id,lesson_session_id,r2_key,caption,content_type,created_at)
  SELECT 'seed-att-l5',s.id,'seed-media/04.jpg',coalesce(s.lesson_title,'درسُ الحلقة'),'image/jpeg',1783786522672
  FROM lesson_sessions s ORDER BY s.created_at DESC LIMIT 1 OFFSET 12;
INSERT OR IGNORE INTO lesson_attachments (id,lesson_session_id,r2_key,caption,content_type,created_at)
  SELECT 'seed-att-l6',s.id,'seed-media/05.jpg',coalesce(s.lesson_title,'درسُ الحلقة'),'image/jpeg',1783700122672
  FROM lesson_sessions s ORDER BY s.created_at DESC LIMIT 1 OFFSET 15;
