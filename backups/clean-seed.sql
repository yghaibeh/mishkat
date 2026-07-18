-- تنظيف بيانات الـ Seed من قاعدة البيانات الاحتياطية
-- يحذف: seed_big (created_at=1781775663965) + seed_demo/seed_users (created_at=0)
-- يبقي: الهيكل التنظيمي الحقيقي + المساجد المضافة + المستخدمون الحقيقيون + إعدادات النظام

PRAGMA foreign_keys=OFF;
BEGIN;

-- ===== 1. حذف بيانات seed_big (3801 شخص، 435 وحدة، created_at=1781775663965) =====

-- الأشخاص والمستخدمون وتعيينات الأدوار
DELETE FROM role_assignments WHERE person_id IN (SELECT id FROM persons WHERE created_at = 1781775663965);
DELETE FROM monthly_entitlements WHERE person_id IN (SELECT id FROM persons WHERE created_at = 1781775663965);
DELETE FROM users WHERE person_id IN (SELECT id FROM persons WHERE created_at = 1781775663965);
DELETE FROM persons WHERE created_at = 1781775663965;

-- بيانات الوحدات التنظيمية والأنشطة المرتبطة
DELETE FROM daily_entries WHERE weekly_record_id IN (SELECT id FROM weekly_records WHERE mosque_id IN (SELECT id FROM org_units WHERE created_at = 1781775663965));
DELETE FROM weekly_records WHERE mosque_id IN (SELECT id FROM org_units WHERE created_at = 1781775663965);
DELETE FROM meeting_attendance WHERE meeting_id IN (SELECT id FROM meetings WHERE mosque_id IN (SELECT id FROM org_units WHERE created_at = 1781775663965));
DELETE FROM meetings WHERE mosque_id IN (SELECT id FROM org_units WHERE created_at = 1781775663965);
DELETE FROM donations WHERE mosque_id IN (SELECT id FROM org_units WHERE created_at = 1781775663965);
DELETE FROM expenses WHERE mosque_id IN (SELECT id FROM org_units WHERE created_at = 1781775663965);
DELETE FROM committees WHERE mosque_id IN (SELECT id FROM org_units WHERE created_at = 1781775663965);

-- حلقات على بصيرة والتحفيظ
DELETE FROM lesson_sessions WHERE halaqa_id IN (SELECT h.id FROM halaqat h JOIN venues v ON v.id = h.venue_id WHERE v.org_unit_id IN (SELECT id FROM org_units WHERE created_at = 1781775663965));
DELETE FROM enrollments WHERE halaqa_id IN (SELECT h.id FROM halaqat h JOIN venues v ON v.id = h.venue_id WHERE v.org_unit_id IN (SELECT id FROM org_units WHERE created_at = 1781775663965));
DELETE FROM halaqat WHERE venue_id IN (SELECT id FROM venues WHERE org_unit_id IN (SELECT id FROM org_units WHERE created_at = 1781775663965));
DELETE FROM venues WHERE org_unit_id IN (SELECT id FROM org_units WHERE created_at = 1781775663965);
DELETE FROM teachers WHERE person_id IN (SELECT id FROM persons WHERE created_at = 1781775663965);

-- الوحدات التنظيمية نفسها
DELETE FROM org_units WHERE created_at = 1781775663965;

-- ===== 2. حذف حسابات الاختبار من seed_demo/seed_users (created_at=0 للأشخاص/المستخدمين) =====
-- (الوحدات التنظيمية ذات created_at=0 هي الهيكل الأساسي — نحتفظ بها إن كانت لها بيانات حقيقية)

-- حذف حسابات الاختبار: p-admin, p-amir, p-rabita ... إلخ
DELETE FROM role_assignments WHERE person_id IN (SELECT id FROM persons WHERE created_at = 0);
DELETE FROM monthly_entitlements WHERE person_id IN (SELECT id FROM persons WHERE created_at = 0);
DELETE FROM users WHERE person_id IN (SELECT id FROM persons WHERE created_at = 0);
DELETE FROM persons WHERE created_at = 0;

-- ===== 3. حذف بيانات الأنشطة التجريبية للمساجد التجريبية =====
-- مساجد seed_demo ليس فيها بيانات حقيقية (عدا m-nour التي فيها مستخدم حقيقي)
DELETE FROM daily_entries WHERE weekly_record_id IN (SELECT id FROM weekly_records WHERE mosque_id IN ('m-farouq','m-taqwa','m-hamza','m-bilal','m-quds','m-rahma','m-huda','m-sahaba','m-othman','m-iman'));
DELETE FROM weekly_records WHERE mosque_id IN ('m-farouq','m-taqwa','m-hamza','m-bilal','m-quds','m-rahma','m-huda','m-sahaba','m-othman','m-iman','m-nour');
DELETE FROM meeting_attendance WHERE meeting_id IN (SELECT id FROM meetings WHERE mosque_id IN ('m-farouq','m-taqwa','m-hamza','m-bilal','m-quds','m-rahma','m-huda','m-sahaba','m-othman','m-iman','m-nour'));
DELETE FROM meetings WHERE mosque_id IN ('m-farouq','m-taqwa','m-hamza','m-bilal','m-quds','m-rahma','m-huda','m-sahaba','m-othman','m-iman','m-nour');
DELETE FROM donations WHERE mosque_id IN ('m-farouq','m-taqwa','m-hamza','m-bilal','m-quds','m-rahma','m-huda','m-sahaba','m-othman','m-iman','m-nour');
DELETE FROM expenses WHERE mosque_id IN ('m-farouq','m-taqwa','m-hamza','m-bilal','m-quds','m-rahma','m-huda','m-sahaba','m-othman','m-iman','m-nour');
DELETE FROM committees WHERE mosque_id IN ('m-farouq','m-taqwa','m-hamza','m-bilal','m-quds','m-rahma','m-huda','m-sahaba','m-othman','m-iman','m-nour');

-- حذف الوحدات التنظيمية التجريبية التي لا بيانات حقيقية فيها (الأماكن الوهمية)
-- نحتفظ بـ: idlib, bloc-north, sq-1, sq-3, m-nour (لأن فيها بيانات حقيقية أو مستخدم حقيقي)
DELETE FROM org_units WHERE id IN ('sq-2','m-farouq','m-taqwa','m-hamza','m-bilal','m-quds','m-rahma','m-huda','m-sahaba','m-othman','m-iman');

-- ===== 4. تنظيف المستحقات المالية اليتيمة (linked to deleted seed persons) =====
DELETE FROM monthly_entitlements WHERE person_id NOT IN (SELECT id FROM persons);

-- ===== 5. تنظيف الـ audit_log (كله نشاط تجريبي) =====
DELETE FROM audit_log;

-- ===== 6. إيقاف المسابقات والمنافسات (seed data) =====
DELETE FROM competitions WHERE created_at IN (0, 1781775663965);

-- ===== 7. تنظيف أي بقايا يتيمة =====
DELETE FROM role_assignments WHERE person_id NOT IN (SELECT id FROM persons);
DELETE FROM role_assignments WHERE org_unit_id NOT IN (SELECT id FROM org_units);
DELETE FROM daily_entries WHERE weekly_record_id NOT IN (SELECT id FROM weekly_records);

COMMIT;
PRAGMA foreign_keys=ON;

-- تحقق من النتيجة
SELECT 'org_units', COUNT(*) FROM org_units;
SELECT 'persons', COUNT(*) FROM persons;
SELECT 'users', COUNT(*) FROM users;
SELECT 'role_assignments', COUNT(*) FROM role_assignments;
SELECT 'monthly_entitlements', COUNT(*) FROM monthly_entitlements;
SELECT 'weekly_records', COUNT(*) FROM weekly_records;
SELECT 'meetings', COUNT(*) FROM meetings;
SELECT 'donations', COUNT(*) FROM donations;
SELECT 'expenses', COUNT(*) FROM expenses;
SELECT 'audit_log', COUNT(*) FROM audit_log;
SELECT 'app_settings', COUNT(*) FROM app_settings;
SELECT 'rate_schemes', COUNT(*) FROM rate_schemes;
SELECT 'points_schemes', COUNT(*) FROM points_schemes;
SELECT 'permission_overrides', COUNT(*) FROM permission_overrides;
