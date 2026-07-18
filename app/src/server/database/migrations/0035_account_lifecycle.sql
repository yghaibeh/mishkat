-- الحلّ العالميّ لدورة حياة الحساب: بياناتُ حالةٍ صريحة + إبطالٌ لحظيّ للجلسات
-- persons.status يبقى المصدر الوحيد للحقيقة (active | disabled | deleted) — نضيف ميتاداتا الحالة
ALTER TABLE persons ADD COLUMN status_reason TEXT;
ALTER TABLE persons ADD COLUMN status_changed_by TEXT;
ALTER TABLE persons ADD COLUMN status_changed_at INTEGER;
-- session_epoch: يُرفَع عند التجميد/الإلغاء/تغيير كلمة المرور ⇒ إبطالُ كلّ الجلسات القائمة فورًا
ALTER TABLE users ADD COLUMN session_epoch INTEGER NOT NULL DEFAULT 0;
