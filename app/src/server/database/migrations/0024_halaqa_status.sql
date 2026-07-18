-- حالة الحلقة (للأرشفة من المدرّس) — active | archived
ALTER TABLE halaqat ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
